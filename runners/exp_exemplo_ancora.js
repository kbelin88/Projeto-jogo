// ============================================================
//  exp_exemplo_ancora.js — EXPERIMENTO DE ANCORAGEM DO EXEMPLO
// ------------------------------------------------------------
//  Testa se o modelo copia a FORMA do exemploAncorado (tipo da construcao
//  e comprimento da lista de envios), nao so o formato. Um BRACO por
//  invocacao, N seeds, vs jogadorBurro. Prompt base: P2 monolitico.
//    uso: node runners/exp_exemplo_ancora.js <modelo> <E0|E1|E2|E3> <seeds> <turnos> [--stream]
//    ex:  node runners/exp_exemplo_ancora.js qwen2.5:3b E0 1,2,3,4,5 15
//
//  BRACOS (rotacao do exemplo, semeada por (seed,turno,dono) no engine):
//    E0 CONTROLO    exemplo atual: tipo "lanceiro", 2 envios
//    E1 TIPO        tipo rotativo (entre construiveis), 2 envios
//    E2 COMPRIMENTO tipo "lanceiro", nº de envios rotativo 1-3
//    E3 AMBOS       tipo rotativo E comprimento rotativo
//
//  Instrumentacao por envio aceite IDENTICA ao exp_prompt_tropas (comparavel
//  com 22/07). Colunas novas: exemploTipo e exemploNEnvios (o que o exemplo
//  MOSTROU naquele turno — vindo de Engine.planoExemplo, a mesma fonte que
//  o prompt usou) p/ cruzar com o que o modelo fez.
//
//  Saidas por braco:
//    exp/resultados_<tag>.csv  — 1 linha por ENVIO ACEITE (+exemploTipo,+exemploNEnvios,+temLanceiro)
//    exp/partidas_<tag>.csv    — 1 linha por PARTIDA
//    exp/resumo_<tag>.txt      — agregado media +- desvio (5 seeds)
//  Checkpoint: exp/_ckpt_<tag>.jsonl (1 JSON por partida)
//  tag = qwen2_5-3b_E0 (ponto -> "_", ":" -> "-")
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");
const Rei = require("../rei.js");

const EXP = path.join(__dirname, "..", "exp");

// ---- args ----
const modelo = process.argv[2];
const braco = process.argv[3];
const seeds = (process.argv[4] || "1").split(",").map((s) => parseInt(s, 10));
const turnos = parseInt(process.argv[5], 10) || 15;
const usaStream = process.argv.includes("--stream");
if (!modelo || !["E0", "E1", "E2", "E3"].includes(braco)) {
  console.error("uso: node runners/exp_exemplo_ancora.js <modelo> <E0|E1|E2|E3> <seeds> <turnos> [--stream]");
  process.exit(2);
}
// mapeia braco -> opcoes.rotativo (E0 = sem rotacao, byte-identico)
const ROT = {
  E0: undefined,
  E1: { tipo: true },
  E2: { comprimento: true },
  E3: { tipo: true, comprimento: true },
}[braco];

const tag = `${modelo.replace(/\./g, "_").replace(/[:\\/]/g, "-")}_${braco}`; // qwen2.5:3b -> qwen2_5-3b_E0
const arqCkpt = path.join(EXP, `_ckpt_${tag}.jsonl`);
const arqResEnvio = path.join(EXP, `resultados_${tag}.csv`);
const arqResPart = path.join(EXP, `partidas_${tag}.csv`);
const arqResumo = path.join(EXP, `resumo_${tag}.txt`);

// ---- cliente (standard, ou --stream p/ modelos lentos) ----
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

// ---- decisao do Rei B com o braco (rotativo no exemplo do prompt) ----
async function decidir(estado, cliente, rot) {
  const visao = Engine.montarVisao(estado, "B", { minimos: true });
  // META do exemplo — MESMA fonte que o prompt (planoExemplo) -> o que o
  // modelo REALMENTE viu naquele turno. Registrado por envio aceite.
  const plano = Engine.planoExemplo(visao, rot ? { rotativo: rot } : undefined);
  const prompt = Engine.montarPrompt(visao, rot ? { variante: "P2", rotativo: rot } : { variante: "P2" });
  let cru = "", erroRede = null;
  try { cru = await cliente.gerar(prompt); } catch (e) { erroRede = e.message; }
  const p = Engine.parsearOrdem(cru);
  const diag = Engine.diagnosticarOrdem(estado, "B", p.ordem);
  return {
    ordem: p.ordem, jsonValido: p.ok, erroRede, diag,
    exemploTipo: plano.tipo, exemploNEnvios: plano.nEnvios,
    enviosPropostos: ((p.ordem && p.ordem.envios) || []).length,
  };
}

// ---- uma partida (seed fixa) ----
async function rodarPartida(seed) {
  const cfg = Object.assign({}, Engine.CONFIG, { seed });
  const estado = Engine.criarEstadoInicial(cfg);
  const rej = { tropaNaoTem: 0, recurso: 0, faltouCampo: 0, zeroTropas: 0, tipoDesconhecido: 0, outro: 0 };
  const envios = []; // por envio aceite
  const propostosPorTurno = []; // nº de envios PROPOSTOS em cada turno de B (histograma + desvio)
  let enviosPropostos = 0, enviosAceites = 0, enviosRejeitados = 0;
  let vencedor = null, turnosCompletados = 0, errosRede = 0;

  while (estado.turno < turnos) {
    const tTurno = Date.now();
    Engine.tick(estado);
    for (const dono of ["A", "B"]) {
      if (!Engine.aldeiasDe(estado, dono).length) continue;
      if (dono === "B") {
        const r = await decidir(estado, cliente, ROT);
        if (r.erroRede) errosRede++;
        enviosPropostos += r.enviosPropostos;
        propostosPorTurno.push(r.enviosPropostos);
        enviosAceites += r.diag.aceitoEnvios.length;
        for (const msg of r.diag.rejeicoes) rej[categoria(msg)]++;
        enviosRejeitados += r.diag.rejeicoes.filter((m) => m.startsWith("envio")).length;
        // INSTRUMENTACAO por envio aceite — ANTES de executar (alvo no estado atual)
        for (const e of r.diag.aceitoEnvios) {
          const tipoEnviado = Engine.tipoDominante(estado, e.tropas);
          const alvo = e.alvo;
          const tipoAlvo = alvo.dono === null ? alvo.tipo : Engine.tipoDominante(estado, alvo.tropas);
          const v = Engine.vantagem(estado, tipoEnviado, tipoAlvo);
          const counter = v > 0 ? "sim" : v < 0 ? "nao" : "neutro";
          const Fatk = Engine.forcaTropas(estado, e.tropas);
          const minimo = Engine.minimoParaTomar(estado, tipoEnviado, alvo);
          const classif = minimo == null ? "suicidio"
            : Fatk === minimo ? "otimo" : Fatk > minimo ? "desperdicio" : "suicidio";
          const gap = minimo == null ? "" : minimo - Fatk;
          const temLanceiro = (e.tropas.lanceiro || 0) > 0 ? 1 : 0;
          envios.push({
            seed, turno: estado.turno, origemId: e.origemId, destinoId: e.destinoId,
            tipoEnviado, tipoAlvo, alvoDono: alvo.dono === null ? "neutra" : "inimigo",
            counter, Fatk, minimo: minimo == null ? "" : minimo, classif, gap, temLanceiro,
            exemploTipo: r.exemploTipo, exemploNEnvios: r.exemploNEnvios,
          });
        }
        Engine.executarOrdem(estado, "B", r.ordem);
      } else {
        Engine.executarOrdem(estado, "A", Engine.jogadorBurro(Engine.montarVisao(estado, "A")));
      }
    }
    turnosCompletados = estado.turno;
    if (usaStream) {
      console.log(`    [seed ${seed}] turno ${estado.turno}/${turnos} | aceites-acum ${enviosAceites} | ${((Date.now() - tTurno) / 1000).toFixed(0)}s`);
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
    enviosPropostos, enviosAceites, enviosRejeitados, errosRede,
    propostosPorTurno, rej, envios,
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
  // CSV por envio aceite (+ colunas novas do exemplo)
  const hE = ["modelo", "braco", "seed", "turno", "origemId", "destinoId",
    "tipoEnviado", "tipoAlvo", "alvoDono", "counter", "Fatk", "minimo", "classif", "gap",
    "temLanceiro", "exemploTipo", "exemploNEnvios"];
  const linhasE = [hE.join(",")];
  for (const p of partidas) for (const e of p.envios) {
    linhasE.push([modelo, braco, e.seed, e.turno, e.origemId, e.destinoId,
      e.tipoEnviado, e.tipoAlvo, e.alvoDono, e.counter, e.Fatk, e.minimo, e.classif, e.gap,
      e.temLanceiro, e.exemploTipo, e.exemploNEnvios].join(","));
  }
  fs.writeFileSync(arqResEnvio, linhasE.join("\n") + "\n");

  // CSV por partida
  const hP = ["modelo", "braco", "seed", "turnosCompletados", "completou", "vencedor",
    "aldeiasLLM", "aldeiasBurro", "enviosPropostos", "enviosAceites", "enviosRejeitados", "errosRede",
    "rej_tropaNaoTem", "rej_recurso", "rej_faltouCampo", "rej_zeroTropas", "rej_tipoDesconhecido", "rej_outro"];
  const linhasP = [hP.join(",")];
  for (const p of partidas) {
    linhasP.push([modelo, braco, p.seed, p.turnosCompletados, p.completou, p.vencedor,
      p.aldeiasLLM, p.aldeiasBurro, p.enviosPropostos, p.enviosAceites, p.enviosRejeitados, p.errosRede,
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
  const gapsSuic = enviosAll.filter((e) => e.classif === "suicidio" && e.gap !== "" && Number(e.gap) > 0).map((e) => Number(e.gap));
  // PRIMARIAS do experimento: histograma do nº de envios propostos por turno
  const propAll = partidas.flatMap((p) => p.propostosPorTurno || []);
  const hist = {};
  for (const n of propAll) { const k = n >= 3 ? "3+" : String(n); hist[k] = (hist[k] || 0) + 1; }
  const propostoPorSeed = partidas.map((p) => p.enviosPropostos); // total proposto por seed

  const L = [];
  L.push(`RESUMO — ${modelo} / ${braco} — seeds ${seedsCsv} (n=${partidas.length}) — ${turnos} turnos, temp 0, vs burro`);
  L.push(`EXP ANCORAGEM DO EXEMPLO (P2 monolitico). E0 controlo | E1 tipo | E2 comprimento | E3 ambos — este e ${braco}.`);
  L.push("");
  const linha = (nome, xs) => L.push(`  ${nome.padEnd(30)}: ${f2(media(xs))} +- ${f2(desvio(xs))}`);
  // ---- PRIMARIAS (testam a hipotese) ----
  L.push("PRIMARIAS:");
  if (taxaLanceiro.length) linha("% envio com lanceiro (partida)", taxaLanceiro);
  L.push(`  envios propostos por seed      : [${propostoPorSeed.join(", ")}]`);
  L.push(`  envios propostos (media seed)  : ${f2(media(propostoPorSeed))} +- ${f2(desvio(propostoPorSeed))}  <- desvio entre seeds`);
  L.push(`  histograma nº envios/turno     : ${["0", "1", "2", "3+"].map((k) => `${k}:${hist[k] || 0}`).join("  ")}`);
  L.push("");
  // ---- SECUNDARIAS (comparaveis com 22/07) ----
  L.push("SECUNDARIAS:");
  linha("aldeias LLM (fim)", perPart((p) => p.aldeiasLLM));
  linha("aldeias burro (fim)", perPart((p) => p.aldeiasBurro));
  linha("turnos completados", perPart((p) => p.turnosCompletados));
  linha("envios aceites", perPart((p) => p.enviosAceites));
  linha("envios rejeitados", perPart((p) => p.enviosRejeitados));
  linha("erros de rede", perPart((p) => p.errosRede));
  L.push(`  vitorias LLM (B)               : ${partidas.filter((p) => p.vencedor === "B").length}/${partidas.length}`);
  if (taxaCounter.length) linha("% counter certo (partida)", taxaCounter);
  if (taxaOtimo.length) linha("% otimo (partida)", taxaOtimo);
  if (taxaSuicidio.length) linha("% suicidio (partida)", taxaSuicidio);
  L.push(`  GAP suicidios: n=${gapsSuic.length} mediana=${gapsSuic.length ? f2(mediana(gapsSuic)) : "-"} media=${gapsSuic.length ? f2(media(gapsSuic)) : "-"}`);
  L.push("");
  L.push(`  total envios aceites (soma)    : ${enviosAll.length}`);
  const cc = (k, v) => enviosAll.filter((e) => e[k] === v).length;
  L.push(`  counter: sim ${cc("counter", "sim")} | nao ${cc("counter", "nao")} | neutro ${cc("counter", "neutro")}`);
  L.push(`  classif: otimo ${cc("classif", "otimo")} | desperdicio ${cc("classif", "desperdicio")} | suicidio ${cc("classif", "suicidio")}`);
  L.push(`  envios com lanceiro: ${enviosAll.filter((e) => e.temLanceiro === 1).length}/${enviosAll.length}`);
  L.push("");
  L.push(`  rejeicoes: tropaNaoTem ${sum(partidas, "tropaNaoTem")} | recurso ${sum(partidas, "recurso")} | faltouCampo ${sum(partidas, "faltouCampo")} | zeroTropas ${sum(partidas, "zeroTropas")} | tipoDesconhecido ${sum(partidas, "tipoDesconhecido")} | outro ${sum(partidas, "outro")}`);
  fs.writeFileSync(arqResumo, L.join("\n") + "\n");
}
function sum(partidas, k) { return partidas.reduce((s, p) => s + p.rej[k], 0); }

// ---- main ----
(async function main() {
  fs.mkdirSync(EXP, { recursive: true });
  const feitas = carregarCkpt();
  const t0 = Date.now();
  console.log(`BRACO ${modelo}/${braco} | seeds ${seeds.join(",")} | ${turnos}t | cliente ${cliente.nome} | rotativo ${JSON.stringify(ROT) || "(nenhum)"}`);
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
  console.log(`OK ${modelo}/${braco}: ${partidas.length} partidas em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`  -> ${path.relative(path.join(__dirname, ".."), arqResumo)}`);
})();
