// ============================================================
//  eval_validador.js — EVAL ISOLADO DO VALIDADOR (Fase 12, correcao)
// ------------------------------------------------------------
//  Contexto: H4 (Rei composto) deu ZERO vetos em 180 turnos — o
//  validador (3B e 8B) aprovou tudo enquanto o motor rejeitava ~50
//  ordens/partida logo depois. Acoplamos a peca SEM testa-la isolada
//  (violacao do metodo do Modulo 1). Esta bancada e a correcao:
//  a pergunta nao e mais "o validador melhora o Rei?" e sim
//  "o validador DISCRIMINA legal de ilegal?".
//
//  Desenho:
//    - UM estado real e deterministico (seed fixa): 6 turnos de burro
//      so-constroi, depois um envio real drena TODOS os cavaleiros
//      (cria o tipo zerado — a aldeia nasce com os 3 tipos), depois
//      1 turno parado (recurso paga lanceiro/arqueiro, NAO cavaleiro).
//    - 20 ordens rotuladas pelo PROPRIO MOTOR (diagnosticarOrdem):
//      10 legais + 10 ilegais em 5 categorias x 2 (origem nao e sua/
//      nao existe, quantidade insuficiente, tipo zerado, construcao
//      sem recurso, destino inexistente).
//    - ASSERT DE GABARITO antes de qualquer chamada de LLM: se o
//      rotulo do motor nao bater com a intencao do caso, aborta.
//      Caso ILEGAL exige alem disso ZERO itens aceitos (ordem 100%
//      ilegal — a tarefa do validador e binaria, sem caso misto).
//    - Prompt: montarPromptValidador do rei.js — O MESMO que rodou
//      no loop da Fase 12, nao uma copia.
//    - N rodadas por modelo (default 3, licao do ruido do Ollama a
//      temp 0); veredito por caso = MODA; caso que mudou de veredito
//      entre rodadas conta como INSTAVEL (gabarito do Lucas: "3B nao
//      estabiliza" vira numero).
//    - Loga a resposta CRUA de TODOS os casos, inclusive OK — cobre
//      o item 2 do handoff (o que o carimbo escreve alem do OK?).
//
//  Uso (da RAIZ):
//    node runners/eval_validador.js --stub                 (autoteste, sem Ollama)
//    node runners/eval_validador.js --modelo llama3.2:3b   (precisa do Ollama no ar)
//    node runners/eval_validador.js --modelo llama3:8b
//
//  Opcoes:
//    --rodadas N   rodadas por modelo (default 3)
//    --seed N      seed do mapa (default 1)
//    --tag NOME    sufixo do arquivo de log
//
//  METRICAS (sobre a moda das rodadas):
//    acuraciaGeral   — acertos / 20
//    acuraciaLegais  — OK onde devia OK (especificidade)
//    acuraciaIlegais — VETO onde devia VETO (a metrica que decide)
//    ilegiveis       — moda sem 'VALIDACAO: OK|VETO' na 1a linha (conta como erro)
//    instaveis       — casos com veredito diferente entre rodadas
//    quebra por categoria de ilegalidade — ONDE falha, nao so quanto
//
//  Gabaritos escritos ANTES de rodar (15/07):
//    Lucas : 3B nao estabiliza; 8B acerta a maioria.
//    Claude: ambos assimetricos — legais alta, ilegais < 30% de veto;
//            8B pouco melhor; carimbo se reproduz em isolamento.
//
//  Log completo em logs/exp/ (escrita atomica) + linha acumulada em
//  logs/exp/resumo_validador.txt p/ comparar modelos lado a lado.
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");
const Rei = require("../rei.js");

// ---------- args ----------
const args = process.argv.slice(2);
function opt(nome, def) {
  const i = args.indexOf("--" + nome);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : def;
}
const stub = args.indexOf("--stub") >= 0;
const modeloId = opt("modelo", null);
const rodadas = parseInt(opt("rodadas", "3"), 10);
const seed = parseInt(opt("seed", "1"), 10);
const tag = opt("tag", "");
const listar = args.indexOf("--listar") >= 0; // enquadramento invertido (3o ponto da tese)
if (!stub && !modeloId) {
  console.error("uso: node runners/eval_validador.js --stub | --modelo <modeloId> [--rodadas N] [--seed N] [--tag NOME]");
  process.exit(2);
}

// ---------- estado deterministico ----------
// Calibrado empiricamente (seed 1): 6 turnos so-constroi -> L7/A5/C3,
// rec 10m/26f. Drena os 3 cavaleiros (envio REAL, via executarOrdem,
// p/ o alvo mais distante — nao chega em 1 turno) -> tipo zerado de
// verdade. 1 turno parado -> rec 20m/32f: paga lanceiro (15m) e
// arqueiro (20m/10f), NAO paga cavaleiro (30m/30f). Os asserts do
// gerarCasos conferem essas tres condicoes em qualquer seed.
function criarEstadoBancada(seedMapa) {
  const config = Object.assign({}, Engine.CONFIG, { seed: seedMapa });
  const estado = Engine.criarEstadoInicial(config);
  const soConstroi = (visao) => {
    const o = Engine.jogadorBurro(visao);
    return { construir: o.construir, envios: [] };
  };
  const nada = () => ({ construir: [], envios: [] });
  for (let t = 0; t < 6; t++) Engine.rodarTurno(estado, { A: soConstroi, B: soConstroi });

  // drena os cavaleiros do Rei A (cria o tipo zerado)
  const v = Engine.montarVisao(estado, "A");
  const minha = v.minhas[0];
  const nCav = minha.tropas.cavaleiro;
  if (nCav > 0) {
    const longe = v.alvos.slice().sort((a, b) =>
      Engine.distancia(minha, b) - Engine.distancia(minha, a))[0];
    Engine.executarOrdem(estado, "A", {
      construir: [],
      envios: [{ origemId: minha.id, destinoId: longe.id, tropas: { lanceiro: 0, arqueiro: 0, cavaleiro: nCav } }],
    });
  }

  for (let t = 0; t < 1; t++) Engine.rodarTurno(estado, { A: nada, B: nada });
  return estado;
}

// ---------- geracao dos 20 casos (rotulados pelo motor) ----------
// Cada caso: { id, categoria, esperado: 'LEGAL'|'ILEGAL', ordem }.
// A construcao e DINAMICA (le o estado real), mas o rotulo final e
// sempre conferido por diagnosticarOrdem no assert — gabarito do
// motor, nao intencao do autor.
function gerarCasos(estado) {
  const dono = "A";
  const visao = Engine.montarVisao(estado, dono);
  const minha = visao.minhas[0];
  if (!minha) throw new Error("bancada: Rei A sem aldeia — estado inesperado");
  const alvos = visao.alvos;
  if (alvos.length < 2) throw new Error("bancada: menos de 2 alvos no mapa");
  const alvoNeutro = alvos.find((a) => a.dono === null) || alvos[0];
  const alvoInimigo = alvos.find((a) => a.dono === "B");
  if (!alvoInimigo) throw new Error("bancada: Rei B sem aldeia");
  const aldeiaB = alvoInimigo; // origem "que nao e sua" p/ categoria A

  const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];
  const tem = (t) => minha.tropas[t] || 0;
  const tiposComTropa = TIPOS.filter((t) => tem(t) > 0);
  const tipoZerado = TIPOS.find((t) => tem(t) === 0) || null;
  if (tiposComTropa.length < 2) throw new Error("bancada: menos de 2 tipos com tropa na aldeia A");
  if (!tipoZerado) throw new Error("bancada: nenhum tipo zerado (o dreno de cavaleiros falhou?)");

  const custo = (t) => estado.config.tropas[t].custo;
  const rec = minha.recursos;
  const paga = (t) => rec.madeira >= custo(t).madeira && rec.ferro >= custo(t).ferro;
  const tipoPagavel = TIPOS.find((t) => paga(t));
  const tipoCaro = TIPOS.slice().reverse().find((t) => !paga(t));
  if (!tipoPagavel) throw new Error("bancada: nenhum tipo pagavel (aumente os turnos parados)");
  if (!tipoCaro) throw new Error("bancada: todos os tipos pagaveis (reduza os turnos parados)");

  const t1 = tiposComTropa[0], t2 = tiposComTropa[1];
  const so = (t, n) => { const o = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 }; o[t] = n; return o; };
  const idInexistente1 = 9999;
  const idInexistente2 = Math.max(...estado.aldeias.map((a) => a.id)) + 1;

  const casos = [
    // ---- 10 LEGAIS ----
    { id: "L01", categoria: "legal_envio", esperado: "LEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoNeutro.id, tropas: so(t1, Math.max(1, Math.floor(tem(t1) / 2))) }] } },
    { id: "L02", categoria: "legal_envio", esperado: "LEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoInimigo.id, tropas: so(t2, 1) }] } },
    { id: "L03", categoria: "legal_envio", esperado: "LEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoNeutro.id, tropas: so(t1, tem(t1)) }] } }, // estoque exato
    { id: "L04", categoria: "legal_envio", esperado: "LEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoNeutro.id, tropas: { lanceiro: Math.min(1, tem("lanceiro")), arqueiro: Math.min(1, tem("arqueiro")), cavaleiro: Math.min(1, tem("cavaleiro")) } }] } },
    { id: "L05", categoria: "legal_envio", esperado: "LEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoInimigo.id, tropas: so(t2, Math.max(1, tem(t2) - 1)) }] } },
    { id: "L06", categoria: "legal_construir", esperado: "LEGAL",
      ordem: { construir: [{ aldeiaId: minha.id, tipo: tipoPagavel }], envios: [] } },
    { id: "L07", categoria: "legal_construir", esperado: "LEGAL",
      ordem: { construir: [{ aldeiaId: minha.id, tipo: tipoPagavel }], envios: [{ origemId: minha.id, destinoId: alvoNeutro.id, tropas: so(t1, 1) }] } },
    { id: "L08", categoria: "legal_envio", esperado: "LEGAL",
      ordem: { construir: [], envios: [
        { origemId: minha.id, destinoId: alvoNeutro.id, tropas: so(t1, 1) },
        { origemId: minha.id, destinoId: alvoInimigo.id, tropas: so(t2, 1) },
      ] } },
    { id: "L09", categoria: "legal_envio", esperado: "LEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvos[alvos.length - 1].id, tropas: so(t1, 1) }] } }, // ultimo alvo da lista
    { id: "L10", categoria: "legal_envio", esperado: "LEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoNeutro.id, tropas: so(t2, tem(t2)) }] } },

    // ---- 10 ILEGAIS (5 categorias x 2) ----
    { id: "I01", categoria: "origem_nao_sua", esperado: "ILEGAL",
      ordem: { construir: [], envios: [{ origemId: aldeiaB.id, destinoId: alvoNeutro.id, tropas: so("lanceiro", 1) }] } },
    { id: "I02", categoria: "origem_nao_sua", esperado: "ILEGAL",
      ordem: { construir: [], envios: [{ origemId: idInexistente1, destinoId: alvoNeutro.id, tropas: so("lanceiro", 1) }] } },
    { id: "I03", categoria: "qtd_insuficiente", esperado: "ILEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoNeutro.id, tropas: so(t1, tem(t1) + 10) }] } },
    { id: "I04", categoria: "qtd_insuficiente", esperado: "ILEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoInimigo.id, tropas: so(t2, tem(t2) * 2 + 1) }] } },
    { id: "I05", categoria: "tipo_zerado", esperado: "ILEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoNeutro.id, tropas: so(tipoZerado, 3) }] } },
    { id: "I06", categoria: "tipo_zerado", esperado: "ILEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: alvoInimigo.id, tropas: so(tipoZerado, 1) }] } },
    { id: "I07", categoria: "construir_sem_recurso", esperado: "ILEGAL",
      ordem: { construir: [{ aldeiaId: minha.id, tipo: tipoCaro }], envios: [] } },
    { id: "I08", categoria: "construir_sem_recurso", esperado: "ILEGAL",
      ordem: { construir: [{ aldeiaId: minha.id, tipo: tipoCaro }, { aldeiaId: minha.id, tipo: tipoCaro }], envios: [] } },
    { id: "I09", categoria: "destino_inexistente", esperado: "ILEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: idInexistente1, tropas: so(t1, 1) }] } },
    { id: "I10", categoria: "destino_inexistente", esperado: "ILEGAL",
      ordem: { construir: [], envios: [{ origemId: minha.id, destinoId: idInexistente2, tropas: so(t2, 1) }] } },
  ];
  return { casos, visao, dono };
}

// ---------- assert de gabarito (antes de qualquer LLM) ----------
function conferirGabarito(estado, dono, casos) {
  const erros = [];
  for (const c of casos) {
    const d = Engine.diagnosticarOrdem(estado, dono, c.ordem);
    const nAceitos = d.aceitoConstruir.length + d.aceitoEnvios.length;
    const nRej = d.rejeicoes.length;
    if (c.esperado === "LEGAL" && nRej > 0)
      erros.push(`${c.id} (${c.categoria}): esperava LEGAL, motor rejeitou: ${d.rejeicoes.join(" | ")}`);
    if (c.esperado === "ILEGAL" && (nRej === 0 || nAceitos > 0))
      erros.push(`${c.id} (${c.categoria}): esperava ILEGAL puro, motor aceitou ${nAceitos} item(ns), rejeicoes=${nRej}`);
    c.motorRejeicoes = d.rejeicoes; // vai pro log: o motivo REAL, p/ comparar com o motivo do validador
  }
  return erros;
}

// ---------- embaralhamento com seed (mesma ordem p/ todo modelo) ----------
function embaralhar(casos, seedShuffle) {
  const rng = Engine.criarRng(seedShuffle);
  const arr = casos.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Engine.rngInt(rng, 0, i);
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// ---------- enquadramento LISTADOR (mesma info, papel invertido) ----------
// Checklist: veredito e o 1o token util -> carimbo. Listador: forca
// gerar (enumerar problemas) ANTES de concluir. UMA variavel: o pedido.
function montarPromptListador(visao, ordem) {
  const base = Rei.montarPromptValidador(visao, ordem);
  const corte = base.indexOf("Confira APENAS legalidade:");
  return base.slice(0, corte) +
    "LISTE os problemas de LEGALIDADE desta ordem, um por linha (confira: aldeia e sua? recursos cobrem o custo? origem tem as tropas pedidas? destino existe?).\n" +
    "Estrategia boa ou ruim NAO e problema. Se nao houver problema, nao liste nada.\n" +
    "Termine com a linha exatamente 'PROBLEMAS: N' (N = quantos problemas listou; 0 se nenhum).";
}

function extrairVereditoListador(cru) {
  const m = /PROBLEMAS\s*:\s*(\d+)/i.exec(cru || "");
  if (!m) return "ilegivel";
  return parseInt(m[1], 10) > 0 ? "VETO" : "OK";
}

// ---------- veredito (o MESMO parse do decidirReiComposto) ----------
function extrairVeredito(cru) {
  const linha1 = (cru || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
  const m = /^VALIDACAO\s*:\s*(OK|VETO)/i.exec(linha1);
  return m ? m[1].toUpperCase() : "ilegivel";
}

function moda(vals) {
  const cont = {};
  for (const v of vals) cont[v] = (cont[v] || 0) + 1;
  let melhor = vals[0], n = 0;
  for (const k of Object.keys(cont)) if (cont[k] > n) { melhor = k; n = cont[k]; }
  return melhor;
}

// ---------- stubs (autoteste da bancada, sem Ollama) ----------
function stubCarimbo() {
  return { nome: "stub:carimbo", async gerar() { return "VALIDACAO: OK"; } };
}
function stubOraculo(estado, dono, casos) {
  // Responde CERTO consultando o motor — prova que a pontuacao da
  // bancada da 100% quando o validador e perfeito.
  const porOrdem = new Map();
  for (const c of casos) porOrdem.set(JSON.stringify(c.ordem), c.esperado);
  return {
    nome: "stub:oraculo",
    async gerar(prompt) {
      const linhaOrdem = prompt.split("ORDEM PROPOSTA (confira item por item):\n")[1].split("\n")[0];
      const esperado = porOrdem.get(linhaOrdem);
      return esperado === "ILEGAL" ? "VALIDACAO: VETO\nmotivo do oraculo" : "VALIDACAO: OK";
    },
  };
}

// ---------- pontuacao ----------
function pontuar(casos, vereditosPorCaso) {
  const r = {
    acertos: 0, total: casos.length,
    legaisOK: 0, legaisTotal: 0, ilegaisVETO: 0, ilegaisTotal: 0,
    ilegiveis: 0, instaveis: 0,
    porCategoria: {},
  };
  for (const c of casos) {
    const vs = vereditosPorCaso[c.id];
    const m = moda(vs);
    const instavel = new Set(vs).size > 1;
    if (instavel) r.instaveis++;
    const certoSe = c.esperado === "LEGAL" ? "OK" : "VETO";
    const acertou = m === certoSe;
    if (acertou) r.acertos++;
    if (m === "ilegivel") r.ilegiveis++;
    if (c.esperado === "LEGAL") { r.legaisTotal++; if (acertou) r.legaisOK++; }
    else { r.ilegaisTotal++; if (acertou) r.ilegaisVETO++; }
    if (!r.porCategoria[c.categoria]) r.porCategoria[c.categoria] = { acertos: 0, total: 0 };
    r.porCategoria[c.categoria].total++;
    if (acertou) r.porCategoria[c.categoria].acertos++;
    c.resultado = { vereditos: vs, moda: m, instavel, acertou };
  }
  return r;
}

// ---------- rodar um modelo/cliente ----------
async function rodar(cliente, estado, dono, visao, casosEmbaralhados, nRodadas, linhasLog) {
  let errosRede = 0;
  const vereditosPorCaso = {};
  const crusPorCaso = {};
  for (const c of casosEmbaralhados) { vereditosPorCaso[c.id] = []; crusPorCaso[c.id] = []; }
  const t0 = Date.now();
  for (let r = 1; r <= nRodadas; r++) {
    for (let i = 0; i < casosEmbaralhados.length; i++) {
      const c = casosEmbaralhados[i];
      const prompt = listar ? montarPromptListador(visao, c.ordem) : Rei.montarPromptValidador(visao, c.ordem);
      let cru = "";
      try { cru = await cliente.gerar(prompt); }
      catch (e) {
        cru = ""; errosRede++;
        console.error(`  !! ERRO rede r${r} ${c.id}: ${e.message}`); // grita NA HORA (licao do 404 silencioso)
        linhasLog.push(`ERRO rede r${r} ${c.id}: ${e.message}`);
      }
      const v = listar ? extrairVereditoListador(cru) : extrairVeredito(cru);
      vereditosPorCaso[c.id].push(v);
      crusPorCaso[c.id].push(cru);
      console.log(`  r${r} ${String(i + 1).padStart(2)}/20 ${c.id} [${c.categoria}] -> ${v}`);
    }
  }
  const dur = ((Date.now() - t0) / 1000).toFixed(0);
  // ausencia de resposta NAO e veredito: >10% de falha -> aborta sem pontuar
  const totalChamadas = nRodadas * casosEmbaralhados.length;
  if (errosRede > totalChamadas * 0.1) {
    console.error(`ABORTADO: ${errosRede}/${totalChamadas} chamadas falharam (infra, nao modelo). Nada foi pontuado.`);
    process.exit(1);
  }
  return { vereditosPorCaso, crusPorCaso, dur };
}

// ---------- main ----------
(async function main() {
  const estado = criarEstadoBancada(seed);
  const { casos, visao, dono } = gerarCasos(estado);

  // 1) gabarito do motor PRIMEIRO — sem isso, nada roda
  const erros = conferirGabarito(estado, dono, casos);
  if (erros.length) {
    console.error("GABARITO REPROVADO (o motor discorda da intencao dos casos):");
    for (const e of erros) console.error("  - " + e);
    process.exit(1);
  }
  console.log(`gabarito OK: 20 casos conferidos pelo motor (10 legais, 10 ilegais puros).`);

  const casosEmb = embaralhar(casos, seed + 1000);
  const linhasLog = [];

  if (stub) {
    // autoteste: carimbo tem que dar 50% (legais 100, ilegais 0);
    // oraculo tem que dar 100%. Falhou -> a PONTUACAO esta quebrada.
    const rC = pontuar(casos, (await rodar(stubCarimbo(), estado, dono, visao, casosEmb, 1, linhasLog)).vereditosPorCaso);
    const rO = pontuar(casos, (await rodar(stubOraculo(estado, dono, casos), estado, dono, visao, casosEmb, 1, linhasLog)).vereditosPorCaso);
    const falhas = [];
    if (rC.acertos !== 10 || rC.legaisOK !== 10 || rC.ilegaisVETO !== 0)
      falhas.push(`carimbo: esperava 10/20 (legais 10, ilegais 0), veio ${rC.acertos}/20 (legais ${rC.legaisOK}, ilegais ${rC.ilegaisVETO})`);
    if (rO.acertos !== 20)
      falhas.push(`oraculo: esperava 20/20, veio ${rO.acertos}/20`);
    if (falhas.length) {
      console.error("STUB REPROVADO:");
      for (const f of falhas) console.error("  - " + f);
      process.exit(1);
    }
    console.log("stub OK: carimbo 10/20 (so as legais), oraculo 20/20. Bancada mede o que diz medir.");
    process.exit(0);
  }

  // ---- modelo real ----
  const cliente = Rei.clienteOllama({ modelo: modeloId, temperatura: 0 });
  const enq = listar ? "listador" : "checklist";
  console.log(`\n== eval do validador | ${cliente.nome} | ${enq} | ${rodadas} rodada(s) | seed ${seed} ==`);
  const { vereditosPorCaso, crusPorCaso, dur } = await rodar(cliente, estado, dono, visao, casosEmb, rodadas, linhasLog);
  const R = pontuar(casos, vereditosPorCaso);

  // ---- resumo ----
  const pc = (a, b) => b ? ((100 * a) / b).toFixed(0) + "%" : "-";
  const resumo = [
    "",
    `== RESUMO | ${cliente.nome} | ${enq} | ${rodadas} rodadas | ${dur}s ==`,
    `acuracia geral : ${R.acertos}/${R.total} (${pc(R.acertos, R.total)})`,
    `legais  (OK)   : ${R.legaisOK}/${R.legaisTotal} (${pc(R.legaisOK, R.legaisTotal)})`,
    `ilegais (VETO) : ${R.ilegaisVETO}/${R.ilegaisTotal} (${pc(R.ilegaisVETO, R.ilegaisTotal)})  <- a metrica que decide`,
    `ilegiveis(moda): ${R.ilegiveis}   instaveis: ${R.instaveis}/20`,
    `por categoria ilegal:`,
    ...Object.keys(R.porCategoria).filter((k) => !k.startsWith("legal")).map(
      (k) => `  ${k.padEnd(22)} ${R.porCategoria[k].acertos}/${R.porCategoria[k].total}`),
  ].join("\n");
  console.log(resumo);

  // ---- log completo (atomico) ----
  const linhas = [];
  linhas.push("=== EVAL VALIDADOR — proveniencia ===");
  linhas.push(`data: ${new Date().toISOString()}  node: ${process.version}`);
  linhas.push(`modelo: ${cliente.nome}  temp: 0  rodadas: ${rodadas}  seed mapa: ${seed}  seed shuffle: ${seed + 1000}`);
  linhas.push(`estado: 6 turnos so-constroi + 2 parados  dono avaliado: ${dono}`);
  linhas.push(`enquadramento: ${enq}`);
  linhas.push(`prompt: ${listar ? "montarPromptListador (runner)" : "montarPromptValidador (rei.js) — o mesmo do loop composto"}`);
  linhas.push("");
  for (const c of casos) {
    linhas.push(`--- ${c.id} [${c.categoria}] esperado=${c.esperado} moda=${c.resultado.moda} ${c.resultado.acertou ? "ACERTO" : "ERRO"}${c.resultado.instavel ? " INSTAVEL" : ""}`);
    linhas.push(`ordem: ${JSON.stringify(c.ordem)}`);
    linhas.push(`motor: ${c.motorRejeicoes.length ? c.motorRejeicoes.join(" | ") : "(sem rejeicoes)"}`);
    c.resultado.vereditos.forEach((v, i) => {
      linhas.push(`r${i + 1}: ${v} | cru: ${JSON.stringify(crusPorCaso[c.id][i])}`);
    });
    linhas.push("");
  }
  linhas.push(resumo);
  linhas.push(...linhasLog);

  const dir = path.join(process.cwd(), "logs", "exp");
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const nomeMod = cliente.nome.replace(/[^a-z0-9._]/gi, "-");
  const nome = `evalval_${nomeMod}_${enq}_s${seed}${tag ? "_" + tag : ""}_${ts}.txt`;
  const alvo = path.join(dir, nome);
  fs.writeFileSync(alvo + ".tmp", linhas.join("\n"));
  fs.renameSync(alvo + ".tmp", alvo);

  // linha unica acumulada p/ comparar modelos lado a lado
  const linha = [ts, cliente.nome, `enq=${enq}`, `rodadas=${rodadas}`, `seed=${seed}`,
    `geral=${R.acertos}/20`, `legais=${R.legaisOK}/10`, `ilegais=${R.ilegaisVETO}/10`,
    `ilegiveis=${R.ilegiveis}`, `instaveis=${R.instaveis}`].join("  ");
  fs.appendFileSync(path.join(dir, "resumo_validador.txt"), linha + "\n");
  console.log(`\nlog: ${alvo}`);
})().catch((e) => { console.error("ERRO FATAL:", e); process.exit(1); });
