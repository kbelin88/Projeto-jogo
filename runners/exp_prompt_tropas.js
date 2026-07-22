// ============================================================
//  exp_prompt_tropas.js — EXPERIMENTO DE PROMPT DE TROPAS (v3)
// ------------------------------------------------------------
//  Um BRACO por invocacao (modelo x variante), N seeds, vs jogadorBurro.
//    uso: node runners/exp_prompt_tropas.js <modelo> <variante> <seeds> <turnos> [--stream]
//    ex:  node runners/exp_prompt_tropas.js qwen2.5:3b P0 1 15
//         node runners/exp_prompt_tropas.js llama3.1:8b P2 1,2,3,4,5 15
//         node runners/exp_prompt_tropas.js qwen3:8b P0 1 10 --stream   (sonda)
//
//  NAO e adaptacao do exp_cautela_2x2 (esse so agrega por partida). Aqui o
//  registo POR ENVIO ACEITE e codigo novo — e onde esta o mecanismo.
//
//  Instrumentacao (minimoParaTomar, counter) e calculada para TODOS os
//  bracos, inclusive P0/P1 — NAO entra no prompt (so o P2 mostra minimos ao
//  modelo, via visao {minimos:true}). P0 continua byte-identico ao baseline v3.
//
//  Saidas por braco (derivadas do checkpoint, sempre consistentes):
//    exp/resultados_<modelo>_<variante>.csv  — 1 linha por ENVIO ACEITE
//    exp/partidas_<modelo>_<variante>.csv    — 1 linha por PARTIDA (seed)
//    exp/resumo_<modelo>_<variante>.txt      — agregado media +- desvio (5 seeds)
//  Checkpoint resumivel:
//    exp/_ckpt_<modelo>_<variante>.jsonl     — 1 linha JSON por partida completa
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");
const Rei = require("../rei.js");

const EXP = path.join(__dirname, "..", "exp");

// ---- args ----
const modelo = process.argv[2];
const variante = process.argv[3];
const seeds = (process.argv[4] || "1").split(",").map((s) => parseInt(s, 10));
const turnos = parseInt(process.argv[5], 10) || 15;
const usaStream = process.argv.includes("--stream");
if (!modelo || !["P0", "P1", "P2"].includes(variante)) {
  console.error("uso: node runners/exp_prompt_tropas.js <modelo> <P0|P1|P2> <seeds> <turnos> [--stream]");
  process.exit(2);
}
const tag = `${modelo}_${variante}`.replace(/[:\\/]/g, "-"); // qwen2.5:3b -> qwen2.5-3b
const arqCkpt = path.join(EXP, `_ckpt_${tag}.jsonl`);
const arqResEnvio = path.join(EXP, `resultados_${tag}.csv`);
const arqResPart = path.join(EXP, `partidas_${tag}.csv`);
const arqResumo = path.join(EXP, `resumo_${tag}.txt`);

// ---- cliente ----
// Standard clienteOllama serve os modelos rapidos (<300s/turno). qwen3 (thinking,
// ~16min/turno) estoura o idle-timeout do fetch -> --stream le o stream token a
// token (mesma interface {nome, gerar}); o thinking sai separado, response=JSON.
const TIMEOUT_STREAM_MS = 1800000;
function clienteStream(modelo) {
  return {
    nome: `ollama-stream:${modelo}`,
    ultimosTokens: null,
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

// ---- categorizacao de rejeicao (5 categorias do brief + "outro") ----
function categoria(msg) {
  if (/tropa que nao tem/.test(msg)) return "tropaNaoTem";
  if (/recurso insuficiente/.test(msg)) return "recurso";
  if (/faltou o campo/.test(msg)) return "faltouCampo";
  if (/zero tropas/.test(msg)) return "zeroTropas";
  if (/tipo invalido|tipo de tropa desconhecido|tipo desconhecido/.test(msg)) return "tipoDesconhecido";
  return "outro";
}

// ---- decisao do Rei B com a variante (P2 liga minimos na visao) ----
async function decidir(estado, cliente, variante) {
  const visao = Engine.montarVisao(estado, "B", variante === "P2" ? { minimos: true } : undefined);
  const prompt = Engine.montarPrompt(visao, { variante });
  let cru = "", erroRede = null;
  try { cru = await cliente.gerar(prompt); } catch (e) { erroRede = e.message; }
  const p = Engine.parsearOrdem(cru);
  const diag = Engine.diagnosticarOrdem(estado, "B", p.ordem);
  return { ordem: p.ordem, jsonValido: p.ok, erroRede, diag,
    enviosPropostos: ((p.ordem && p.ordem.envios) || []).length };
}

// ---- uma partida (seed fixa), devolve o registo completo ----
async function rodarPartida(seed) {
  const cfg = Object.assign({}, Engine.CONFIG, { seed });
  const estado = Engine.criarEstadoInicial(cfg);
  const rej = { tropaNaoTem: 0, recurso: 0, faltouCampo: 0, zeroTropas: 0, tipoDesconhecido: 0, outro: 0 };
  const envios = []; // por envio aceite
  let enviosPropostos = 0, enviosAceites = 0, enviosRejeitados = 0;
  let vencedor = null, turnosCompletados = 0, errosRede = 0;

  while (estado.turno < turnos) {
    Engine.tick(estado);
    for (const dono of ["A", "B"]) {
      if (!Engine.aldeiasDe(estado, dono).length) continue;
      if (dono === "B") {
        const r = await decidir(estado, cliente, variante);
        if (r.erroRede) errosRede++;
        enviosPropostos += r.enviosPropostos;
        enviosAceites += r.diag.aceitoEnvios.length;
        for (const msg of r.diag.rejeicoes) rej[categoria(msg)]++;
        enviosRejeitados += r.diag.rejeicoes.filter((m) => m.startsWith("envio")).length;
        // INSTRUMENTACAO por envio aceite — ANTES de executar (alvo ainda no estado atual)
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
          envios.push({
            seed, turno: estado.turno, origemId: e.origemId, destinoId: e.destinoId,
            tipoEnviado, tipoAlvo, alvoDono: alvo.dono === null ? "neutra" : "inimigo",
            counter, Fatk, minimo: minimo == null ? "" : minimo, classif,
          });
        }
        Engine.executarOrdem(estado, "B", r.ordem);
      } else {
        Engine.executarOrdem(estado, "A", Engine.jogadorBurro(Engine.montarVisao(estado, "A")));
      }
    }
    turnosCompletados = estado.turno;
    vencedor = Engine.checarVitoria(estado);
    if (vencedor) break;
  }

  return {
    modelo, variante, seed,
    turnosCompletados, alvoTurnos: turnos,
    completou: turnosCompletados >= turnos || !!vencedor,
    vencedor: vencedor || "limite",
    aldeiasLLM: Engine.aldeiasDe(estado, "B").length,
    aldeiasBurro: Engine.aldeiasDe(estado, "A").length,
    enviosPropostos, enviosAceites, enviosRejeitados, errosRede,
    rej, envios,
  };
}

// ---- checkpoint: carrega partidas ja feitas (resume) ----
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

// ---- estatistica: media e desvio amostral (n-1) ----
function media(xs) { return xs.reduce((s, x) => s + x, 0) / xs.length; }
function desvio(xs) {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

// ---- escreve CSVs + resumo a partir das partidas do checkpoint ----
function escreverSaidas(partidas) {
  partidas.sort((a, b) => a.seed - b.seed);
  // CSV por envio aceite
  const hE = ["modelo", "variante", "seed", "turno", "origemId", "destinoId",
    "tipoEnviado", "tipoAlvo", "alvoDono", "counter", "Fatk", "minimo", "classif"];
  const linhasE = [hE.join(",")];
  for (const p of partidas) for (const e of p.envios) {
    linhasE.push([modelo, variante, e.seed, e.turno, e.origemId, e.destinoId,
      e.tipoEnviado, e.tipoAlvo, e.alvoDono, e.counter, e.Fatk, e.minimo, e.classif].join(","));
  }
  fs.writeFileSync(arqResEnvio, linhasE.join("\n") + "\n");

  // CSV por partida
  const hP = ["modelo", "variante", "seed", "turnosCompletados", "completou", "vencedor",
    "aldeiasLLM", "aldeiasBurro", "enviosPropostos", "enviosAceites", "enviosRejeitados", "errosRede",
    "rej_tropaNaoTem", "rej_recurso", "rej_faltouCampo", "rej_zeroTropas", "rej_tipoDesconhecido", "rej_outro"];
  const linhasP = [hP.join(",")];
  for (const p of partidas) {
    linhasP.push([modelo, variante, p.seed, p.turnosCompletados, p.completou, p.vencedor,
      p.aldeiasLLM, p.aldeiasBurro, p.enviosPropostos, p.enviosAceites, p.enviosRejeitados, p.errosRede,
      p.rej.tropaNaoTem, p.rej.recurso, p.rej.faltouCampo, p.rej.zeroTropas, p.rej.tipoDesconhecido, p.rej.outro].join(","));
  }
  fs.writeFileSync(arqResPart, linhasP.join("\n") + "\n");

  // resumo agregado (media +- desvio entre seeds)
  const seedsCsv = partidas.map((p) => p.seed).join(",");
  const perPartMetric = (fn) => partidas.map(fn);
  const enviosAll = partidas.flatMap((p) => p.envios);
  // taxa de counter certo POR PARTIDA (sim / aceites com alvo tipado)
  const taxaCounter = partidas.map((p) => {
    const es = p.envios; if (!es.length) return null;
    return 100 * es.filter((e) => e.counter === "sim").length / es.length;
  }).filter((x) => x != null);
  const taxaOtimo = partidas.map((p) => {
    const es = p.envios; if (!es.length) return null;
    return 100 * es.filter((e) => e.classif === "otimo").length / es.length;
  }).filter((x) => x != null);
  const taxaSuicidio = partidas.map((p) => {
    const es = p.envios; if (!es.length) return null;
    return 100 * es.filter((e) => e.classif === "suicidio").length / es.length;
  }).filter((x) => x != null);

  const L = [];
  L.push(`RESUMO — ${modelo} / ${variante} — seeds ${seedsCsv} (n=${partidas.length}) — ${turnos} turnos, temp 0, vs burro`);
  L.push(`BASELINE v3 (triangulo=bonus, objetivo=capital). NAO comparavel com 2x2/H2/H1.`);
  L.push("");
  const linha = (nome, xs) => L.push(`  ${nome.padEnd(28)}: ${f2(media(xs))} +- ${f2(desvio(xs))}`);
  linha("aldeias LLM (fim)", perPartMetric((p) => p.aldeiasLLM));
  linha("aldeias burro (fim)", perPartMetric((p) => p.aldeiasBurro));
  linha("turnos completados", perPartMetric((p) => p.turnosCompletados));
  linha("envios propostos", perPartMetric((p) => p.enviosPropostos));
  linha("envios aceites", perPartMetric((p) => p.enviosAceites));
  linha("envios rejeitados", perPartMetric((p) => p.enviosRejeitados));
  linha("erros de rede", perPartMetric((p) => p.errosRede));
  L.push("");
  L.push(`  vitorias LLM (B)            : ${partidas.filter((p) => p.vencedor === "B").length}/${partidas.length}`);
  L.push(`  partidas que completaram    : ${partidas.filter((p) => p.completou).length}/${partidas.length}`);
  L.push("");
  if (taxaCounter.length) linha("% counter certo (por partida)", taxaCounter);
  if (taxaOtimo.length) linha("% otimo (por partida)", taxaOtimo);
  if (taxaSuicidio.length) linha("% suicidio (por partida)", taxaSuicidio);
  L.push("");
  L.push(`  total envios aceites (soma)  : ${enviosAll.length}`);
  const cc = (k, v) => enviosAll.filter((e) => e[k] === v).length;
  L.push(`  counter: sim ${cc("counter", "sim")} | nao ${cc("counter", "nao")} | neutro ${cc("counter", "neutro")}`);
  L.push(`  classif: otimo ${cc("classif", "otimo")} | desperdicio ${cc("classif", "desperdicio")} | suicidio ${cc("classif", "suicidio")}`);
  fs.writeFileSync(arqResumo, L.join("\n") + "\n");
}

// ---- main: roda seeds em falta, faz checkpoint, escreve saidas ----
(async function main() {
  fs.mkdirSync(EXP, { recursive: true });
  const feitas = carregarCkpt();
  const t0 = Date.now();
  console.log(`BRACO ${modelo}/${variante} | seeds ${seeds.join(",")} | ${turnos}t | cliente ${cliente.nome}`);
  if (feitas.size) console.log(`  (checkpoint: ${[...feitas.keys()].join(",")} ja feitas)`);

  for (const seed of seeds) {
    if (feitas.has(seed)) { console.log(`  seed ${seed}: pulada (checkpoint)`); continue; }
    const ts = Date.now();
    const reg = await rodarPartida(seed);
    fs.appendFileSync(arqCkpt, JSON.stringify(reg) + "\n");
    feitas.set(seed, reg);
    console.log(`  seed ${seed}: ${reg.vencedor} | LLM ${reg.aldeiasLLM}ald | aceites ${reg.enviosAceites} | rej ${reg.enviosRejeitados} | ${((Date.now() - ts) / 1000).toFixed(0)}s`);
  }

  const partidas = seeds.map((s) => feitas.get(s)).filter(Boolean);
  escreverSaidas(partidas);
  console.log(`OK ${modelo}/${variante}: ${partidas.length} partidas em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`  -> ${path.relative(path.join(__dirname, ".."), arqResEnvio)}`);
  console.log(`  -> ${path.relative(path.join(__dirname, ".."), arqResumo)}`);
})();
