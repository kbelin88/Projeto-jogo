// tokens-crescimento.js — analise do CONTEXTO (tokens de prompt/input) enviado
// ao modelo a cada turno e como CRESCE ao longo da partida. Numeros vem do log
// (uso real reportado pela API, capturado pelo runner em "tokens.contexto:").
// Uso: node ferramentas/tokens-crescimento.js <log1.txt> [log2.txt ...]
//
// Atribui cada linha "tokens.contexto: prompt N | resposta M" ao lado LLM pelo
// cabeçalho "########## TURNO X — Rei D (modelo) ##########" que a precede.
"use strict";
const fs = require("fs");

function parseLog(caminho) {
  const txt = fs.readFileSync(caminho, "utf8");
  const linhas = txt.split(/\r?\n/);
  let turnoAtual = null, ladoAtual = null, modeloAtual = null;
  const series = {}; // chave "D (modelo)" -> [{turno, prompt, resposta}]
  const reTurno = /^#+\s*TURNO\s+(\d+)\s+—\s+Rei\s+(\w+)\s+\(([^)]+)\)/;
  const reTok = /^tokens\.contexto:\s*prompt\s+(\d+)\s*\|\s*resposta\s+(\d+)/;
  for (const l of linhas) {
    const mt = reTurno.exec(l);
    if (mt) { turnoAtual = parseInt(mt[1], 10); ladoAtual = mt[2]; modeloAtual = mt[3]; continue; }
    const mk = reTok.exec(l);
    if (mk && ladoAtual) {
      const chave = `${ladoAtual} (${modeloAtual})`;
      (series[chave] = series[chave] || []).push({ turno: turnoAtual, prompt: +mk[1], resposta: +mk[2] });
    }
  }
  return series;
}

function stats(serie) {
  const ps = serie.map((x) => x.prompt);
  const n = ps.length;
  const soma = ps.reduce((a, b) => a + b, 0);
  const media = soma / n;
  const k = Math.max(1, Math.floor(n / 3));
  const ini = ps.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const fim = ps.slice(n - k).reduce((a, b) => a + b, 0) / k;
  // regressao linear simples (tokens por turno) p/ inclinacao
  const xs = serie.map((x) => x.turno);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = media;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ps[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den ? num / den : 0;
  return { n, media, min: Math.min(...ps), max: Math.max(...ps), primeiro: ps[0], ultimo: ps[n - 1], iniTerco: ini, fimTerco: fim, slope };
}

// mini-sparkline ASCII (8 niveis) sobre a serie de prompt
function spark(serie) {
  const ps = serie.map((x) => x.prompt);
  const lo = Math.min(...ps), hi = Math.max(...ps), rng = hi - lo || 1;
  const bars = "▁▂▃▄▅▆▇█";
  return ps.map((v) => bars[Math.min(7, Math.floor(((v - lo) / rng) * 7.999))]).join("");
}

const arquivos = process.argv.slice(2);
if (!arquivos.length) { console.error("uso: node ferramentas/tokens-crescimento.js <log...>"); process.exit(1); }

for (const arq of arquivos) {
  console.log(`\n== ${arq.split(/[\\/]/).pop()}`);
  const series = parseLog(arq);
  const chaves = Object.keys(series);
  if (!chaves.length) { console.log("  (sem tokens de contexto — lado nao-LLM ou log antigo sem instrumentacao)"); continue; }
  for (const ch of chaves) {
    const s = stats(series[ch]);
    console.log(`  Rei ${ch}`);
    console.log(`     turnos com token : ${s.n}`);
    console.log(`     media contexto   : ${s.media.toFixed(0)} tokens/turno`);
    console.log(`     min / max        : ${s.min} / ${s.max}`);
    console.log(`     1o -> ultimo     : ${s.primeiro} -> ${s.ultimo} (${((s.ultimo / s.primeiro - 1) * 100).toFixed(0)}%)`);
    console.log(`     1o terco -> ult. : ${s.iniTerco.toFixed(0)} -> ${s.fimTerco.toFixed(0)} (${((s.fimTerco / s.iniTerco - 1) * 100).toFixed(0)}%)`);
    console.log(`     inclinacao       : ${s.slope >= 0 ? "+" : ""}${s.slope.toFixed(0)} tokens/turno`);
    console.log(`     curva            : ${spark(series[ch])}`);
    console.log(`     serie            : ${series[ch].map((x) => x.turno + ":" + x.prompt).join("  ")}`);
  }
}
