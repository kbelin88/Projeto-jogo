// Agrega os 9 checkpoints da matriz -> tabela da Tarefa 7 (media +- desvio
// por braco/modelo). SO os numeros (sem interpretacao). Sonda qwen3 NAO entra.
"use strict";
const fs = require("fs");
const path = require("path");
const EXP = path.join(__dirname, "..", "exp");

const MODELOS = [["qwen2.5:3b", "qwen2.5-3b"], ["llama3:8b (=llama3:latest)", "llama3-latest"], ["llama3.1:8b", "llama3.1-8b"]];
const VARS = ["P0", "P1", "P2"];

function media(xs) { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN; }
function desvio(xs) {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
const md = (xs) => `${(Math.round(media(xs) * 100) / 100).toFixed(2)}±${(Math.round(desvio(xs) * 100) / 100).toFixed(2)}`;

function carregar(tagFs, variante) {
  const f = path.join(EXP, `_ckpt_${tagFs}_${variante}.jsonl`);
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.seed - b.seed);
}

// metricas por partida
function taxa(envios, pred) { return envios.length ? 100 * envios.filter(pred).length / envios.length : null; }
function metrPart(p) {
  const es = p.envios;
  return {
    aldeiasLLM: p.aldeiasLLM,
    turnos: p.turnosCompletados,
    propostos: p.enviosPropostos,
    aceites: p.enviosAceites,
    rejeitados: p.enviosRejeitados,
    errosRede: p.errosRede,
    pctCounter: taxa(es, (e) => e.counter === "sim"),
    pctNeutro: taxa(es, (e) => e.counter === "neutro"),
    pctNao: taxa(es, (e) => e.counter === "nao"),
    pctOtimo: taxa(es, (e) => e.classif === "otimo"),
    pctDesperdicio: taxa(es, (e) => e.classif === "desperdicio"),
    pctSuicidio: taxa(es, (e) => e.classif === "suicidio"),
    vitoria: p.vencedor === "B" ? 1 : 0,
    completou: p.completou ? 1 : 0,
  };
}

const L = [];
L.push("=".repeat(78));
L.push("  TAREFA 7 — RESULTADOS (matriz principal: 3 modelos x 3 variantes x 5 seeds)");
L.push("  15 turnos, temperatura 0, oponente = jogadorBurro (Rei A). Baseline v3.");
L.push("  Media +- desvio-padrao amostral (n-1) entre as 5 seeds. So os numeros.");
L.push("=".repeat(78));

const linhasFalha = [];
const linhasIncompletas = [];

const METRICAS = [
  ["% counter certo (sim)", "pctCounter"],
  ["% counter neutro", "pctNeutro"],
  ["% counter errado (nao)", "pctNao"],
  ["% otimo", "pctOtimo"],
  ["% desperdicio", "pctDesperdicio"],
  ["% suicidio", "pctSuicidio"],
  ["envios propostos", "propostos"],
  ["envios aceites", "aceites"],
  ["envios rejeitados", "rejeitados"],
  ["aldeias LLM (fim)", "aldeiasLLM"],
  ["turnos completados", "turnos"],
];

for (const [nomeModelo, tagFs] of MODELOS) {
  L.push("");
  L.push(`MODELO: ${nomeModelo}`);
  L.push(`  ${"metrica".padEnd(24)} ${"P0".padStart(14)} ${"P1".padStart(14)} ${"P2".padStart(14)}`);
  const dados = {};
  for (const v of VARS) {
    const parts = carregar(tagFs, v);
    if (!parts) { linhasFalha.push(`${nomeModelo}/${v}: checkpoint AUSENTE`); continue; }
    if (parts.length !== 5) linhasFalha.push(`${nomeModelo}/${v}: ${parts.length}/5 seeds (faltam ${[1,2,3,4,5].filter((s)=>!parts.some((p)=>p.seed===s)).join(",")})`);
    dados[v] = parts.map(metrPart);
    for (const p of parts) {
      if (!p.completou) linhasIncompletas.push(`${nomeModelo}/${v} seed ${p.seed}: turnos ${p.turnosCompletados}/15 (venc ${p.vencedor})`);
      if (p.errosRede) linhasFalha.push(`${nomeModelo}/${v} seed ${p.seed}: ${p.errosRede} erro(s) de rede`);
    }
  }
  for (const [rot, key] of METRICAS) {
    const cel = (v) => {
      if (!dados[v]) return "—".padStart(14);
      const xs = dados[v].map((m) => m[key]).filter((x) => x != null);
      return (xs.length ? md(xs) : "s/envios").padStart(14);
    };
    L.push(`  ${rot.padEnd(24)} ${cel("P0")} ${cel("P1")} ${cel("P2")}`);
  }
  // contagens (nao media): vitorias e completude
  const cont = (v, key) => dados[v] ? String(dados[v].reduce((s, m) => s + m[key], 0) + "/5").padStart(14) : "—".padStart(14);
  L.push(`  ${"vitorias LLM (B)".padEnd(24)} ${cont("P0","vitoria")} ${cont("P1","vitoria")} ${cont("P2","vitoria")}`);
  L.push(`  ${"partidas completas".padEnd(24)} ${cont("P0","completou")} ${cont("P1","completou")} ${cont("P2","completou")}`);
  // totais de envios (soma) p/ contexto do denominador das %
  const somaEnv = (v) => dados[v] ? String(dados[v].reduce((s,m)=>s+m.aceites,0)).padStart(14) : "—".padStart(14);
  L.push(`  ${"(total envios aceites)".padEnd(24)} ${somaEnv("P0")} ${somaEnv("P1")} ${somaEnv("P2")}`);
}

L.push("");
L.push("-".repeat(78));
L.push("NOTAS FACTUAIS:");
L.push(`  partidas que NAO completaram 15 turnos: ${linhasIncompletas.length || "nenhuma"}`);
for (const s of linhasIncompletas) L.push(`    - ${s}`);
L.push(`  seeds com falha (checkpoint ausente / erro de rede): ${linhasFalha.length || "nenhuma"}`);
for (const s of linhasFalha) L.push(`    - ${s}`);
L.push("-".repeat(78));

const out = L.join("\n") + "\n";
fs.writeFileSync(path.join(EXP, "TABELA_tarefa7.txt"), out);
process.stdout.write(out);
