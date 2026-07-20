// ============================================================
//  exp_cautela_2x2.js — EXPERIMENTO CONTROLADO (medicao, NAO baseline)
// ------------------------------------------------------------
//  Pergunta: a frase de cautela do montarPrompt ("E melhor nao fazer
//  nada do que enviar um ataque ruim") congela modelos obedientes?
//  E QUAL parte de um nudge pro-ativo recupera a agencia?
//
//  NAO altera engine.js. Intercepta Engine.montarPrompt por um wrapper
//  que troca APENAS o paragrafo de cautela (o resto do prompt e byte-
//  igual ao baseline). Uma variavel por celula.
//
//  DESENHO — 4 bracos x 3 modelos x N seeds, vs jogadorBurro, temp 0:
//    A) BASE           : prompt atual (com a frase de cautela)
//    B) SEM_CAUTELA    : frase removida, nada adicionado
//    C) NUDGE_PURO     : cautela -> so o principio estrategico
//    D) NUDGE_COMPLETO : cautela -> principio + avaliacao factual das neutras
//
//  Rodar:  node runners/exp_cautela_2x2.js [turnos=30] [seeds=5]
//  Saida:  tabela no console + docs/EXP_cautela_2x2_resultados.txt
//  Precisa do Ollama no ar com os 3 modelos.
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");
const Rei = require("../rei.js");

const TURNOS = parseInt(process.argv[2], 10) || 30;
const NSEEDS = parseInt(process.argv[3], 10) || 5;
// maxNovas: teto de partidas NOVAS por execucao (o resto vem do checkpoint).
// Serve p/ fatiar o run em pedacos curtos que cabem numa janela (o background
// desta maquina mata tasks longas; foreground tem timeout de 10 min). 0/omitido
// = sem teto. Ex.: `node exp_cautela_2x2.js 15 5 1` roda 1 partida nova e sai.
const MAX_NOVAS = parseInt(process.argv[4], 10) || Infinity;
let novasFeitas = 0;
const SEEDS = Array.from({ length: NSEEDS }, (_, i) => i + 1);
const MODELOS = ["llama3:latest", "llama3.2:3b", "qwen2.5:3b"];
const LADO_REI = "B"; // convencao da harness: A=burro, B=rei
const SAIDA = path.join(__dirname, "..", "docs", "EXP_cautela_2x2_resultados.txt");
// CHECKPOINT resumivel: 1 linha JSON por partida completa. Relancar retoma de
// onde parou (o run de 2h ja foi morto 1x por limite de vida do background;
// nenhum minuto de compute pode se perder). A chave (modelo|braco|seed|turnos)
// inclui TURNOS: mudar a escala invalida o checkpoint antigo (nao mistura runs).
const CHECKPOINT = path.join(__dirname, "..", "docs", `EXP_cautela_2x2_ckpt_${TURNOS}t.jsonl`);
function chave(modelo, braco, seed) { return `${modelo}|${braco}|${seed}|${TURNOS}`; }
function carregarCheckpoint() {
  const feitos = new Map();
  if (!fs.existsSync(CHECKPOINT)) return feitos;
  for (const linha of fs.readFileSync(CHECKPOINT, "utf8").split(/\r?\n/)) {
    if (!linha.trim()) continue;
    try { const r = JSON.parse(linha); feitos.set(chave(r.modelo, r.braco, r.seed), r); } catch (_) {}
  }
  return feitos;
}
function anexarCheckpoint(rec) { fs.appendFileSync(CHECKPOINT, JSON.stringify(rec) + "\n", "utf8"); }

// ---- O paragrafo de cautela, byte-exato como no engine.js (montarPrompt) ----
const FRASE_CAUTELA =
  "Listas vazias sao uma resposta valida. Se uma aldeia nao deve atacar nem construir neste turno, simplesmente nao a inclua. E melhor nao fazer nada do que enviar um ataque ruim ou construir sem motivo.";

// Textos inseridos (sem acento, no registro do prompt existente; D = C + factual).
const PRINCIPIO =
  "Voce ganha o jogo tomando aldeias, nao acumulando tropas em casa. Prefira expandir a estagnar.";
const COMPLETO =
  "Voce ganha o jogo tomando aldeias, nao acumulando tropas em casa. As aldeias neutras proximas tem poucas tropas e sao alvos faceis agora no comeco. Prefira expandir a estagnar; so deixe 'envios' vazio se realmente nao houver um bom alvo.";

// Cada braco = uma transformacao pura sobre o prompt-base ja montado.
const BRACOS = {
  A_BASE:           (p) => p,
  B_SEM_CAUTELA:    (p) => p.replace(FRASE_CAUTELA, "").replace(/\n{3,}/g, "\n\n"),
  C_NUDGE_PURO:     (p) => p.replace(FRASE_CAUTELA, PRINCIPIO),
  D_NUDGE_COMPLETO: (p) => p.replace(FRASE_CAUTELA, COMPLETO),
};
const NOMES_BRACOS = Object.keys(BRACOS);

// ---- INTERCEPTACAO: wrapper sobre o export Engine.montarPrompt --------------
// decidirRei chama Engine.montarPrompt(visao, opcoes); trocamos o export.
const montarOriginal = Engine.montarPrompt;
let transformAtual = BRACOS.A_BASE;
Engine.montarPrompt = function (visao, opcoes) {
  return transformAtual(montarOriginal(visao, opcoes));
};

// ---- CONFIG por seed (clone raso; seed e escalar de topo) -------------------
function cfg(seed) { return Object.assign({}, Engine.CONFIG, { seed }); }

// ---- RESILIENCIA: wrapper de retry sobre o cliente --------------------------
// Run de 2h sem babá: um blip transitório do Ollama (fetch failed) NAO pode
// matar horas de compute. Retry curto so em ERRO DE TRANSPORTE (excecao do
// fetch); NAO mexe no conteudo da resposta -> nao corrompe a medicao (erro de
// rede != decisao do modelo). Se esgotar as tentativas, propaga (decidirRei
// captura como erroRede e "passa" o turno; o TXT conta os erroRede por celula).
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function clienteComRetry(cli, tentativas, esperaMs) {
  return {
    nome: cli.nome,
    get ultimosTokens() { return cli.ultimosTokens; },
    async gerar(prompt) {
      let ultimoErro;
      for (let i = 1; i <= tentativas; i++) {
        try { return await cli.gerar(prompt); }
        catch (e) {
          ultimoErro = e;
          if (i < tentativas) { process.stderr.write(`      [retry ${i}/${tentativas - 1}] ${e.message}\n`); await espera(esperaMs); }
        }
      }
      throw ultimoErro;
    },
  };
}

// ---- ASSERCAO: a substituicao de cada braco REALMENTE aconteceu -------------
// (ausencia de erro nao e sucesso — conferimos e guardamos o prompt de cada braco)
function visaoReferencia() {
  const e = Engine.criarEstadoInicial(cfg(1));
  Engine.tick(e);
  return Engine.montarVisao(e, LADO_REI);
}
function assertBracos() {
  const vRef = visaoReferencia();
  const base = montarOriginal(vRef, undefined);
  if (!base.includes(FRASE_CAUTELA))
    throw new Error("ABORTA: a FRASE_CAUTELA nao esta no prompt-base. O montarPrompt mudou? Atualize FRASE_CAUTELA.");
  const promptsBracos = {};
  for (const nome of NOMES_BRACOS) {
    const p = BRACOS[nome](base);
    promptsBracos[nome] = p;
    // conferencias especificas por braco
    if (nome === "A_BASE") {
      if (!p.includes(FRASE_CAUTELA) || p !== base) throw new Error("A_BASE deveria ser identico ao base");
    } else {
      if (p.includes(FRASE_CAUTELA)) throw new Error(`${nome}: a frase de cautela NAO foi removida`);
      if (p === base) throw new Error(`${nome}: prompt identico ao base (substituicao nao ocorreu)`);
    }
    if (nome === "C_NUDGE_PURO" && !p.includes(PRINCIPIO)) throw new Error("C: principio nao inserido");
    if (nome === "D_NUDGE_COMPLETO" && !p.includes("alvos faceis agora")) throw new Error("D: avaliacao factual nao inserida");
  }
  return promptsBracos;
}

// ---- METRICAS de uma partida ------------------------------------------------
function metricasPartida(res) {
  const regs = res.registros;
  const n = regs.length || 1;
  let enviosParsed = 0, enviosAceitos = 0, turnosComRej = 0, rejRecurso = 0, reincid = 0, erroRede = 0;
  for (let i = 0; i < regs.length; i++) {
    const r = regs[i];
    enviosParsed += ((r.ordemParseada && r.ordemParseada.envios) || []).length;
    enviosAceitos += ((r.aceito && r.aceito.envios) || []).length;
    if ((r.rejeicoes || []).length) turnosComRej++;
    rejRecurso += (r.rejeicoes || []).filter((m) => /recurso insuficiente/.test(m)).length;
    if (r.erroRede) erroRede++;
    // reincidencia: resposta crua byte-identica a do turno anterior (e nao-vazia)
    if (i > 0 && r.cru && r.cru === regs[i - 1].cru) reincid++;
  }
  return {
    turnos: regs.length,
    agencia: enviosParsed / n,          // envios PEDIDOS por turno (intencao)
    agenciaAceita: enviosAceitos / n,   // envios ACEITOS por turno (passaram no motor)
    taxaRej: turnosComRej / n,          // fracao de turnos com >=1 rejeicao
    reincid,                            // nº de turnos byte-identicos ao anterior
    aldeias: Engine.aldeiasDe(res.estado, res.ladoRei).length,
    rejRecurso,                         // construcoes rejeitadas por recurso insuficiente (soma)
    erroRede,
  };
}

// ---- agregacao (media e desvio amostral entre seeds) ------------------------
function agg(vals) {
  const n = vals.length;
  const m = vals.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? vals.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1) : 0;
  return { m, sd: Math.sqrt(varr) };
}
const f2 = (x) => x.toFixed(2);
const ms = (o) => `${f2(o.m)}±${f2(o.sd)}`;

// ---- execucao ---------------------------------------------------------------
async function rodarCelula(modelo, nomeBraco, feitos) {
  transformAtual = BRACOS[nomeBraco];
  const cliente = clienteComRetry(Rei.criarCliente(`ollama:${modelo}`, { temperatura: 0 }), 4, 3000);
  const porSeed = [];
  for (const seed of SEEDS) {
    const k = chave(modelo, nomeBraco, seed);
    const jaFeito = feitos.get(k);
    if (jaFeito) { // retomada: usa o checkpoint, nao regera
      porSeed.push(jaFeito);
      process.stderr.write(`    [${modelo} | ${nomeBraco} | seed ${seed}] (checkpoint) ag=${f2(jaFeito.agencia)}\n`);
      continue;
    }
    if (novasFeitas >= MAX_NOVAS) { porSeed.push(null); continue; } // teto do pedaco: deixa p/ a proxima execucao
    const t0 = Date.now();
    const res = await Rei.rodarPartidaRei({ cliente, ladoRei: LADO_REI, maxTurnos: TURNOS, config: cfg(seed) });
    const met = metricasPartida(res);
    met.segundos = (Date.now() - t0) / 1000;
    const rec = Object.assign({ modelo, braco: nomeBraco, seed }, met);
    anexarCheckpoint(rec); // grava ANTES de seguir: kill nao perde esta partida
    feitos.set(k, rec);
    novasFeitas++;
    porSeed.push(rec);
    process.stderr.write(
      `    [${modelo} | ${nomeBraco} | seed ${seed}] ag=${f2(met.agencia)} rej=${f2(met.taxaRej)} ` +
      `reinc=${met.reincid} ald=${met.aldeias} rejRec=${met.rejRecurso} (${met.segundos.toFixed(0)}s)\n`);
  }
  return porSeed;
}

(async function main() {
  const inicio = new Date();
  console.log(`EXPERIMENTO cautela 2x2 | turnos=${TURNOS} | seeds=${SEEDS.join(",")} | modelos=${MODELOS.join(", ")}`);
  console.log(`bracos: ${NOMES_BRACOS.join(", ")}\n`);

  // sanity: ollama responde? (com retry — tolera blip transitorio no arranque)
  try { await clienteComRetry(Rei.criarCliente(`ollama:${MODELOS[0]}`, { temperatura: 0 }), 5, 3000).gerar("responda apenas: ok"); }
  catch (e) { console.error("ERRO: Ollama nao respondeu apos retries (" + e.message + "). Suba o Ollama e os modelos."); process.exit(2); }

  // ASSERCAO das substituicoes + captura dos prompts de cada braco
  let promptsBracos;
  try { promptsBracos = assertBracos(); }
  catch (e) { console.error(e.message); process.exit(3); }
  console.log("OK: as 4 substituicoes de prompt foram conferidas (ver dump no TXT).\n");

  // CHECKPOINT: retoma o que ja rodou (o run e longo e ja foi morto 1x)
  const feitos = carregarCheckpoint();
  const totalCelulas = MODELOS.length * NOMES_BRACOS.length * NSEEDS;
  if (feitos.size) console.log(`Checkpoint: ${feitos.size}/${totalCelulas} partidas ja feitas; retomando as faltantes.\n`);

  // roda todas as celulas, agrupando por modelo (mantem o modelo na VRAM)
  const dados = {}; // dados[modelo][braco] = [metricas por seed]
  for (const modelo of MODELOS) {
    dados[modelo] = {};
    process.stderr.write(`\n=== MODELO ${modelo} ===\n`);
    for (const nomeBraco of NOMES_BRACOS) {
      dados[modelo][nomeBraco] = await rodarCelula(modelo, nomeBraco, feitos);
    }
  }

  // completude: conta EXATAMENTE as celulas requeridas (nao feitos.size, que
  // poderia carregar entradas de runs antigos). So escreve a TABELA com as 60.
  let presentes = 0;
  for (const modelo of MODELOS) for (const b of NOMES_BRACOS) for (const seed of SEEDS)
    if (feitos.has(chave(modelo, b, seed))) presentes++;
  if (presentes < totalCelulas) {
    console.log(`\nPARCIAL: ${presentes}/${totalCelulas} partidas feitas. Relance o mesmo comando para continuar; a tabela sai quando completar.`);
    return;
  }

  // ---- monta o relatorio ----
  const L = [];
  L.push("================================================================");
  L.push("  EXPERIMENTO CONTROLADO — frase de cautela no montarPrompt (2x2)");
  L.push("  MEDICAO, nao mudanca de baseline. engine.js NAO foi alterado.");
  L.push("================================================================");
  L.push(`inicio: ${inicio.toISOString()} | fim: ${new Date().toISOString()}`);
  L.push(`turnos/partida: ${TURNOS} | seeds: ${SEEDS.join(",")} (n=${NSEEDS}) | temp: 0 | lado do Rei: ${LADO_REI} (oponente: burro)`);
  L.push(`modelos: ${MODELOS.join(", ")}`);
  L.push(`mundo: v2 (Engine.CONFIG), seed varia por partida`);
  L.push("");
  L.push("BRACOS (o UNICO trecho que muda entre celulas e o paragrafo de cautela):");
  L.push("  A_BASE           : prompt atual, com a frase de cautela");
  L.push("  B_SEM_CAUTELA    : frase removida, nada adicionado");
  L.push("  C_NUDGE_PURO     : cautela -> principio estrategico apenas");
  L.push("  D_NUDGE_COMPLETO : cautela -> principio + avaliacao factual das neutras");
  L.push("");
  L.push("--- TEXTO trocado em cada braco (no lugar da frase de cautela) ---");
  L.push(`FRASE_CAUTELA (removida em B/C/D):\n  "${FRASE_CAUTELA}"`);
  L.push(`A_BASE   : (mantida)`);
  L.push(`B        : (nada)`);
  L.push(`C_PRINCIPIO:\n  "${PRINCIPIO}"`);
  L.push(`D_COMPLETO:\n  "${COMPLETO}"`);
  L.push("");
  L.push("METRICAS (media±desvio amostral entre as seeds):");
  L.push("  agencia    = envios PEDIDOS por turno (intencao de mover)");
  L.push("  ag.aceita  = envios ACEITOS pelo motor por turno");
  L.push("  taxaRej    = fracao de turnos com >=1 rejeicao");
  L.push("  reincid    = nº de turnos com resposta crua byte-identica a anterior (por partida)");
  L.push("  aldeias    = aldeias do Rei no turno final");
  L.push("  rejRecurso = construcoes rejeitadas por recurso insuficiente (soma por partida)");
  L.push("");

  for (const modelo of MODELOS) {
    L.push("================================================================");
    L.push(`MODELO: ${modelo}`);
    L.push("================================================================");
    L.push("braco             agencia     ag.aceita   taxaRej     reincid     aldeias     rejRecurso");
    for (const b of NOMES_BRACOS) {
      const s = dados[modelo][b];
      const col = (k) => ms(agg(s.map((x) => x[k])));
      L.push(
        b.padEnd(17) +
        col("agencia").padEnd(12) +
        col("agenciaAceita").padEnd(12) +
        col("taxaRej").padEnd(12) +
        col("reincid").padEnd(12) +
        col("aldeias").padEnd(12) +
        col("rejRecurso"));
    }
    L.push("");
    // dump cru por seed (nada escondido)
    L.push("  --- valores por seed (crus) ---");
    for (const b of NOMES_BRACOS) {
      const s = dados[modelo][b];
      L.push(`  ${b}:`);
      L.push(`     agencia   : [${s.map((x) => f2(x.agencia)).join(", ")}]`);
      L.push(`     taxaRej   : [${s.map((x) => f2(x.taxaRej)).join(", ")}]`);
      L.push(`     reincid   : [${s.map((x) => x.reincid).join(", ")}]`);
      L.push(`     aldeias   : [${s.map((x) => x.aldeias).join(", ")}]`);
      L.push(`     rejRecurso: [${s.map((x) => x.rejRecurso).join(", ")}]`);
      L.push(`     erroRede  : [${s.map((x) => x.erroRede).join(", ")}] (esperado tudo 0)`);
    }
    L.push("");
  }

  // dump dos 4 prompts finais (assercao visivel)
  L.push("================================================================");
  L.push("  PROMPTS FINAIS DE CADA BRACO (seed 1, turno 1) — prova da substituicao");
  L.push("================================================================");
  for (const nome of NOMES_BRACOS) {
    L.push(`\n########## ${nome} ##########`);
    L.push(promptsBracos[nome]);
  }

  const txt = L.join("\n");
  fs.writeFileSync(SAIDA, txt, "utf8");
  console.log("\n" + txt.split("\n").slice(0, 3).join("\n"));
  console.log(`\nRelatorio completo escrito em: ${SAIDA}`);
})();
