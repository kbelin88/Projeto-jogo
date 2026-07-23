// ============================================================
//  exp_duas_fases.js — EXPERIMENTO DECOMPOSICAO E TAMANHO DE CONTEXTO
// ------------------------------------------------------------
//  Um BRACO por invocacao, N seeds, vs jogadorBurro.
//    uso: node runners/exp_duas_fases.js <modelo> <F0|F1|F2|F3> <seeds> <turnos> [--stream]
//    ex:  node runners/exp_duas_fases.js qwen2.5:3b F0 1,2,3,4,5 15
//         node runners/exp_duas_fases.js qwen2.5:3b F1 1,2,3,4,5 15
//
//  DESENHO (brief 22/07 sessao 2). Prompt base: P2. So qwen2.5:3b.
//    F0 CONTROLO   P2 monolitico, 1 chamada/turno (== exp_prompt_tropas P2)
//    F1 INTEGRAL   2 fases, relatorio COMPLETO nas duas (so a saida separa)
//    F2 RESUMIDO   2 fases, construcao com neutras resumidas por tipo
//    F3 MINIMO     2 fases, construcao SEM neutras
//  F0->F1 isola "menos decisao" (mesmo contexto). F1->F2->F3 isola
//  "menos contexto" (mesmo n de fases, contexto decrescente).
//  A fase de ENVIO e IDENTICA em F1/F2/F3 — so a construcao varia.
//
//  As duas respostas juntam-se em {construir, envios} e passam por
//  executarOrdem SEM alteracao — o motor nao sabe que houve 2 chamadas.
//  Instrumentacao por envio aceite IDENTICA ao exp_prompt_tropas (comparavel
//  via F0). Metricas novas: chars por fase, tempo por chamada, gap dos
//  suicidios (mediana E media), rejeicoes construir vs envio, % envio c/ lanceiro.
//
//  Saidas por braco (em exp/, prefixo duasfases_):
//    duasfases_resultados_<modelo>_<F>.csv  — 1 linha por ENVIO ACEITE (+gap,+temLanceiro)
//    duasfases_partidas_<modelo>_<F>.csv    — 1 linha por PARTIDA
//    duasfases_resumo_<modelo>_<F>.txt      — agregado media +- desvio
//  Checkpoint: exp/_ckpt_duasfases_<modelo>_<F>.jsonl (1 JSON por partida)
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");
const Rei = require("../rei.js");
const Fases = require("./fases.js");

const EXP = path.join(__dirname, "..", "exp");

// ---- args ----
const modelo = process.argv[2];
const braco = process.argv[3];
const seeds = (process.argv[4] || "1").split(",").map((s) => parseInt(s, 10));
const turnos = parseInt(process.argv[5], 10) || 15;
const usaStream = process.argv.includes("--stream");
if (!modelo || !["F0", "F1", "F2", "F3"].includes(braco)) {
  console.error("uso: node runners/exp_duas_fases.js <modelo> <F0|F1|F2|F3> <seeds> <turnos> [--stream]");
  process.exit(2);
}
const duasFases = braco !== "F0";
const tag = `${modelo}_${braco}`.replace(/[:\\/]/g, "-");
const arqCkpt = path.join(EXP, `_ckpt_duasfases_${tag}.jsonl`);
const arqResEnvio = path.join(EXP, `duasfases_resultados_${tag}.csv`);
const arqResPart = path.join(EXP, `duasfases_partidas_${tag}.csv`);
const arqResumo = path.join(EXP, `duasfases_resumo_${tag}.txt`);

// ---- cliente (mesmo do exp_prompt_tropas: standard, ou --stream p/ lentos) ----
const TIMEOUT_STREAM_MS = 1800000;
function clienteStream(modelo) {
  return {
    nome: `ollama-stream:${modelo}`,
    async gerar(prompt) {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), TIMEOUT_STREAM_MS);
      try {
        const resp = await fetch("http://localhost:11434/api/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelo, prompt, stream: true, options: { temperature: 0 } }),
          signal: ac.signal,
        });
        if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "", resposta = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const linha = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
            if (!linha) continue;
            let o; try { o = JSON.parse(linha); } catch { continue; }
            if (typeof o.response === "string") resposta += o.response;
          }
        }
        return resposta;
      } finally { clearTimeout(to); }
    },
  };
}
const cliente = usaStream ? clienteStream(modelo) : Rei.criarCliente(`ollama:${modelo}`, { temperatura: 0 });

// ---- categorizacao de rejeicao (igual ao exp_prompt_tropas) ----
function categoria(msg) {
  if (/tropa que nao tem/.test(msg)) return "tropaNaoTem";
  if (/recurso insuficiente/.test(msg)) return "recurso";
  if (/faltou o campo/.test(msg)) return "faltouCampo";
  if (/zero tropas/.test(msg)) return "zeroTropas";
  if (/tipo invalido|tipo de tropa desconhecido|tipo desconhecido/.test(msg)) return "tipoDesconhecido";
  return "outro";
}

// ---- decisao do Rei B — devolve ordem MERGE + telemetria das chamadas ----
// F0: 1 chamada (P2 monolitico). F1/F2/F3: 2 chamadas (construir + envio),
// INDEPENDENTES, sobre a MESMA visao {minimos:true}.
async function decidir(estado, cliente, braco) {
  const visao = Engine.montarVisao(estado, "B", { minimos: true });
  let ordem, erroRede = null;
  const chars = {}; // charsMono OU {charsC, charsE}
  const tempos = []; // ms por chamada

  if (!duasFases) {
    const prompt = Engine.montarPrompt(visao, { variante: "P2" });
    chars.mono = prompt.length;
    let cru = "";
    const t = Date.now();
    try { cru = await cliente.gerar(prompt); } catch (e) { erroRede = e.message; }
    tempos.push(Date.now() - t);
    const p = Engine.parsearOrdem(cru);
    ordem = p.ordem;
  } else {
    const promptC = Fases.montarPromptConstrucao(visao, braco);
    const promptE = Fases.montarPromptEnvio(visao);
    chars.c = promptC.length; chars.e = promptE.length;
    let cruC = "", cruE = "";
    let t = Date.now();
    try { cruC = await cliente.gerar(promptC); } catch (e) { erroRede = (erroRede ? erroRede + "; " : "") + "C:" + e.message; }
    tempos.push(Date.now() - t);
    t = Date.now();
    try { cruE = await cliente.gerar(promptE); } catch (e) { erroRede = (erroRede ? erroRede + "; " : "") + "E:" + e.message; }
    tempos.push(Date.now() - t);
    const pC = Engine.parsearOrdem(cruC);
    const pE = Engine.parsearOrdem(cruE);
    // MERGE: construir da fase 1, envios da fase 2 (schema de UMA chave cada).
    ordem = { construir: (pC.ordem && pC.ordem.construir) || [], envios: (pE.ordem && pE.ordem.envios) || [] };
  }

  const diag = Engine.diagnosticarOrdem(estado, "B", ordem);
  return {
    ordem, erroRede, diag, chars, tempos,
    enviosPropostos: ((ordem && ordem.envios) || []).length,
  };
}

// ---- uma partida (seed fixa) ----
async function rodarPartida(seed) {
  const cfg = Object.assign({}, Engine.CONFIG, { seed });
  const estado = Engine.criarEstadoInicial(cfg);
  const rej = { tropaNaoTem: 0, recurso: 0, faltouCampo: 0, zeroTropas: 0, tipoDesconhecido: 0, outro: 0 };
  const envios = [];
  let enviosPropostos = 0, enviosAceites = 0, enviosRejeitados = 0;
  let rejConstrucao = 0, rejEnvio = 0; // rejeicoes por fase (metrica nova)
  let vencedor = null, turnosCompletados = 0, errosRede = 0;
  const charsC = [], charsE = [], charsMono = []; // chars por fase/braco
  const temposChamada = [], temposTurno = []; // ms

  while (estado.turno < turnos) {
    const tTurno = Date.now();
    Engine.tick(estado);
    for (const dono of ["A", "B"]) {
      if (!Engine.aldeiasDe(estado, dono).length) continue;
      if (dono === "B") {
        const r = await decidir(estado, cliente, braco);
        if (r.erroRede) errosRede++;
        enviosPropostos += r.enviosPropostos;
        enviosAceites += r.diag.aceitoEnvios.length;
        for (const msg of r.diag.rejeicoes) rej[categoria(msg)]++;
        // rejeicoes por fase (prefixo da mensagem do diagnostico)
        for (const msg of r.diag.rejeicoes) {
          if (/^construir/.test(msg)) rejConstrucao++;
          else if (/^envio/.test(msg)) rejEnvio++;
        }
        enviosRejeitados += r.diag.rejeicoes.filter((m) => m.startsWith("envio")).length;
        // telemetria de chars/tempo
        if (r.chars.mono != null) charsMono.push(r.chars.mono);
        if (r.chars.c != null) charsC.push(r.chars.c);
        if (r.chars.e != null) charsE.push(r.chars.e);
        for (const ms of r.tempos) temposChamada.push(ms);
        // INSTRUMENTACAO por envio aceite — ANTES de executar (alvo no estado atual)
        for (const e of r.diag.aceitoEnvios) {
          const tipoEnviado = Engine.tipoDominante(estado, e.tropas);
          const alvo = e.alvo;
          const tipoAlvo = alvo.dono === null ? alvo.tipo : Engine.tipoDominante(estado, alvo.tropas);
          const v = Engine.vantagem(estado, tipoEnviado, tipoAlvo);
          const counter = v > 0 ? "sim" : v < 0 ? "nao" : "neutro";
          const Fatk = Engine.forcaTropas(estado, e.tropas);
          const minimo = Engine.minimoParaTomar(estado, tipoEnviado, alvo); // null se nem 99 basta
          const classif = minimo == null ? "suicidio"
            : Fatk === minimo ? "otimo" : Fatk > minimo ? "desperdicio" : "suicidio";
          // GAP: quantas tropas de forca faltam/sobram vs o minimo (so faz sentido
          // com minimo finito). >0 = ficou curto (suicidio de margem); <0 = excesso.
          const gap = minimo == null ? "" : minimo - Fatk;
          const temLanceiro = (e.tropas.lanceiro || 0) > 0 ? 1 : 0;
          envios.push({
            seed, turno: estado.turno, origemId: e.origemId, destinoId: e.destinoId,
            tipoEnviado, tipoAlvo, alvoDono: alvo.dono === null ? "neutra" : "inimigo",
            counter, Fatk, minimo: minimo == null ? "" : minimo, classif, gap, temLanceiro,
          });
        }
        Engine.executarOrdem(estado, "B", r.ordem);
      } else {
        Engine.executarOrdem(estado, "A", Engine.jogadorBurro(Engine.montarVisao(estado, "A")));
      }
    }
    turnosCompletados = estado.turno;
    temposTurno.push(Date.now() - tTurno);
    if (usaStream) {
      console.log(`    [seed ${seed}] turno ${estado.turno}/${turnos} | aceites-acum ${enviosAceites} | ${((Date.now() - tTurno) / 1000).toFixed(0)}s neste turno`);
    }
    vencedor = Engine.checarVitoria(estado);
    if (vencedor) break;
  }

  return {
    modelo, braco, seed,
    turnosCompletados, alvoTurnos: turnos,
    completou: turnosCompletados >= turnos || !!vencedor,
    vencedor: vencedor || "limite",
    aldeiasLLM: Engine.aldeiasDe(estado, "B").length,
    aldeiasBurro: Engine.aldeiasDe(estado, "A").length,
    enviosPropostos, enviosAceites, enviosRejeitados, rejConstrucao, rejEnvio, errosRede,
    charsC, charsE, charsMono, temposChamada, temposTurno,
    rej, envios,
  };
}

// ---- checkpoint ----
function carregarCkpt() {
  const feitas = new Map();
  if (fs.existsSync(arqCkpt)) {
    for (const linha of fs.readFileSync(arqCkpt, "utf8").split(/\r?\n/)) {
      if (!linha.trim()) continue;
      try { const r = JSON.parse(linha); feitas.set(r.seed, r); } catch (_) {}
    }
  }
  return feitas;
}

// ---- estatistica ----
function media(xs) { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0; }
function desvio(xs) {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
function mediana(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length, mid = n >> 1;
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

// ---- CSVs + resumo ----
function escreverSaidas(partidas) {
  partidas.sort((a, b) => a.seed - b.seed);
  // CSV por envio aceite (+gap, +temLanceiro)
  const hE = ["modelo", "braco", "seed", "turno", "origemId", "destinoId",
    "tipoEnviado", "tipoAlvo", "alvoDono", "counter", "Fatk", "minimo", "classif", "gap", "temLanceiro"];
  const linhasE = [hE.join(",")];
  for (const p of partidas) for (const e of p.envios) {
    linhasE.push([modelo, braco, e.seed, e.turno, e.origemId, e.destinoId,
      e.tipoEnviado, e.tipoAlvo, e.alvoDono, e.counter, e.Fatk, e.minimo, e.classif, e.gap, e.temLanceiro].join(","));
  }
  fs.writeFileSync(arqResEnvio, linhasE.join("\n") + "\n");

  // CSV por partida
  const hP = ["modelo", "braco", "seed", "turnosCompletados", "completou", "vencedor",
    "aldeiasLLM", "aldeiasBurro", "enviosPropostos", "enviosAceites", "enviosRejeitados",
    "rejConstrucao", "rejEnvio", "errosRede",
    "charsConstrucaoMed", "charsEnvioMed", "charsMonoMed", "tempoChamadaMedMs", "tempoTurnoMedMs",
    "rej_tropaNaoTem", "rej_recurso", "rej_faltouCampo", "rej_zeroTropas", "rej_tipoDesconhecido", "rej_outro"];
  const linhasP = [hP.join(",")];
  for (const p of partidas) {
    linhasP.push([modelo, braco, p.seed, p.turnosCompletados, p.completou, p.vencedor,
      p.aldeiasLLM, p.aldeiasBurro, p.enviosPropostos, p.enviosAceites, p.enviosRejeitados,
      p.rejConstrucao, p.rejEnvio, p.errosRede,
      f2(media(p.charsC || [])), f2(media(p.charsE || [])), f2(media(p.charsMono || [])),
      f2(media(p.temposChamada || [])), f2(media(p.temposTurno || [])),
      p.rej.tropaNaoTem, p.rej.recurso, p.rej.faltouCampo, p.rej.zeroTropas, p.rej.tipoDesconhecido, p.rej.outro].join(","));
  }
  fs.writeFileSync(arqResPart, linhasP.join("\n") + "\n");

  // resumo agregado
  const seedsCsv = partidas.map((p) => p.seed).join(",");
  const perPart = (fn) => partidas.map(fn);
  const enviosAll = partidas.flatMap((p) => p.envios);
  const taxa = (pred) => partidas.map((p) => {
    const es = p.envios; if (!es.length) return null;
    return 100 * es.filter(pred).length / es.length;
  }).filter((x) => x != null);
  const taxaCounter = taxa((e) => e.counter === "sim");
  const taxaOtimo = taxa((e) => e.classif === "otimo");
  const taxaSuicidio = taxa((e) => e.classif === "suicidio");
  const taxaLanceiro = taxa((e) => e.temLanceiro === 1);

  // GAP dos suicidios (metrica primaria): so suicidios de MARGEM (minimo finito).
  const gapsSuic = enviosAll.filter((e) => e.classif === "suicidio" && e.gap !== "" && Number(e.gap) > 0).map((e) => Number(e.gap));

  const L = [];
  L.push(`RESUMO — ${modelo} / ${braco} — seeds ${seedsCsv} (n=${partidas.length}) — ${turnos} turnos, temp 0, vs burro`);
  L.push(`EXP DUAS FASES (decomposicao + tamanho de contexto). Base: P2. NAO comparavel com manha exceto via F0 (== P2 monolitico).`);
  L.push(`  F0 monolitico | F1 integral | F2 resumido | F3 minimo — este e ${braco}.`);
  L.push("");
  const linha = (nome, xs) => L.push(`  ${nome.padEnd(30)}: ${f2(media(xs))} +- ${f2(desvio(xs))}`);
  linha("aldeias LLM (fim)", perPart((p) => p.aldeiasLLM));
  linha("aldeias burro (fim)", perPart((p) => p.aldeiasBurro));
  linha("turnos completados", perPart((p) => p.turnosCompletados));
  linha("envios propostos", perPart((p) => p.enviosPropostos));
  linha("envios aceites", perPart((p) => p.enviosAceites));
  linha("envios rejeitados", perPart((p) => p.enviosRejeitados));
  linha("erros de rede", perPart((p) => p.errosRede));
  L.push("");
  linha("rejeicoes de CONSTRUCAO", perPart((p) => p.rejConstrucao));
  linha("rejeicoes de ENVIO", perPart((p) => p.rejEnvio));
  L.push("");
  L.push(`  vitorias LLM (B)              : ${partidas.filter((p) => p.vencedor === "B").length}/${partidas.length}`);
  L.push(`  partidas que completaram      : ${partidas.filter((p) => p.completou).length}/${partidas.length}`);
  L.push("");
  if (taxaCounter.length) linha("% counter certo (por partida)", taxaCounter);
  if (taxaOtimo.length) linha("% otimo (por partida)", taxaOtimo);
  if (taxaSuicidio.length) linha("% suicidio (por partida)", taxaSuicidio);
  if (taxaLanceiro.length) linha("% envio com lanceiro (partida)", taxaLanceiro);
  L.push("");
  // METRICA PRIMARIA: gap dos suicidios
  L.push(`  GAP DOS SUICIDIOS (tropas de forca em falta, so margem finita):`);
  L.push(`    n suicidios de margem        : ${gapsSuic.length}`);
  L.push(`    mediana do gap               : ${gapsSuic.length ? f2(mediana(gapsSuic)) : "-"}`);
  L.push(`    media do gap                 : ${gapsSuic.length ? f2(media(gapsSuic)) : "-"}`);
  L.push("");
  // TAMANHO DE CONTEXTO e TEMPO
  const allC = partidas.flatMap((p) => p.charsC || []);
  const allE = partidas.flatMap((p) => p.charsE || []);
  const allMono = partidas.flatMap((p) => p.charsMono || []);
  const allTC = partidas.flatMap((p) => p.temposChamada || []);
  const allTT = partidas.flatMap((p) => p.temposTurno || []);
  L.push(`  TAMANHO DO PROMPT (chars, media por chamada):`);
  if (allMono.length) L.push(`    monolitico (F0)              : ${f2(media(allMono))}`);
  if (allC.length) L.push(`    fase CONSTRUCAO              : ${f2(media(allC))}`);
  if (allE.length) L.push(`    fase ENVIO                   : ${f2(media(allE))}`);
  L.push(`  TEMPO:`);
  L.push(`    media por CHAMADA (s)        : ${f2(media(allTC) / 1000)}`);
  L.push(`    media por TURNO (s)          : ${f2(media(allTT) / 1000)}`);
  L.push("");
  L.push(`  total envios aceites (soma)    : ${enviosAll.length}`);
  const cc = (k, v) => enviosAll.filter((e) => e[k] === v).length;
  L.push(`  counter: sim ${cc("counter", "sim")} | nao ${cc("counter", "nao")} | neutro ${cc("counter", "neutro")}`);
  L.push(`  classif: otimo ${cc("classif", "otimo")} | desperdicio ${cc("classif", "desperdicio")} | suicidio ${cc("classif", "suicidio")}`);
  L.push(`  envios com lanceiro: ${enviosAll.filter((e) => e.temLanceiro === 1).length}/${enviosAll.length}`);
  fs.writeFileSync(arqResumo, L.join("\n") + "\n");
}

// ---- main ----
(async function main() {
  fs.mkdirSync(EXP, { recursive: true });
  const feitas = carregarCkpt();
  const t0 = Date.now();
  console.log(`BRACO ${modelo}/${braco} (${duasFases ? "2 fases" : "monolitico"}) | seeds ${seeds.join(",")} | ${turnos}t | cliente ${cliente.nome}`);
  if (feitas.size) console.log(`  (checkpoint: ${[...feitas.keys()].join(",")} ja feitas)`);

  for (const seed of seeds) {
    if (feitas.has(seed)) { console.log(`  seed ${seed}: pulada (checkpoint)`); continue; }
    const ts = Date.now();
    const reg = await rodarPartida(seed);
    fs.appendFileSync(arqCkpt, JSON.stringify(reg) + "\n");
    feitas.set(seed, reg);
    console.log(`  seed ${seed}: ${reg.vencedor} | LLM ${reg.aldeiasLLM}ald | aceites ${reg.enviosAceites} | rejC ${reg.rejConstrucao} rejE ${reg.rejEnvio} | ${((Date.now() - ts) / 1000).toFixed(0)}s`);
  }

  const partidas = seeds.map((s) => feitas.get(s)).filter(Boolean);
  escreverSaidas(partidas);
  console.log(`OK ${modelo}/${braco}: ${partidas.length} partidas em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`  -> ${path.relative(path.join(__dirname, ".."), arqResumo)}`);
})();
