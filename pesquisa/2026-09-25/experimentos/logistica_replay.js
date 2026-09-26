// logistica_replay.js — ONDE esta o exercito de cada Rei, turno a turno, lido so
// do replay (o JSON mede): em aldeias do INTERIOR (nenhuma vizinha inimiga),
// na FRONTEIRA, ou em MARCHA. Serve para comparar modelos de qualquer partida
// com replay, incluindo as do browser (Sonnet, Luna), sem reexecutar o motor.
//
// uso: node logistica_replay.js <partida.replay.json> [...]
"use strict";
const fs = require("fs");
const path = require("path");
const Iberia = require(path.join(__dirname, "..", "..", "..", "world-iberia.js"));
const nT = (t) => (t.lanceiro || 0) + (t.arqueiro || 0) + (t.cavaleiro || 0);

// a rede de estradas vem do mundo (a topologia e publica e fixa); o replay traz
// o slug de cada aldeia, e e por ele que se liga o id numerico a estrada
function adjacencia(frame) {
  const id = {}; for (const a of frame.aldeias) id[a.slug] = a.id;
  const adj = {};
  for (const e of Iberia.ESTRADAS) {
    const x = id[e.de], y = id[e.para];
    if (x == null || y == null) continue;
    (adj[x] = adj[x] || []).push(y); (adj[y] = adj[y] || []).push(x);
  }
  return adj;
}

function medir(arq) {
  const R = JSON.parse(fs.readFileSync(arq, "utf8"));
  const adj = adjacencia(R.frames[0]);
  const fr = R.frames.filter((f) => f.turno >= 1);
  const lados = {};
  for (const lado of ["A", "B"]) {
    const s = { interior: 0, fronteira: 0, marcha: 0, turnos: 0 };
    for (const f of fr) {
      const dono = {}; for (const a of f.aldeias) dono[a.id] = a.dono;
      const minhas = f.aldeias.filter((a) => a.dono === lado);
      if (!minhas.length) continue;
      let i = 0, b = 0;
      for (const a of minhas) {
        const k = nT(a.tropas);
        if ((adj[a.id] || []).some((v) => dono[v] && dono[v] !== lado)) b += k; else i += k;
      }
      const m = (f.movimentos || []).filter((x) => x.dono === lado).reduce((q, x) => q + nT(x.tropas), 0);
      const tot = i + b + m;
      if (!tot) continue;
      s.interior += i / tot; s.fronteira += b / tot; s.marcha += m / tot; s.turnos++;
    }
    const etq = (fr[0] && (lado === "A" ? fr[0].etiquetaA : fr[0].etiquetaB)) || lado;
    lados[lado] = { modelo: String(etq).replace(/^openrouter:/, ""), ...s };
  }
  return lados;
}

if (require.main === module) {
  console.log("media por turno da fracao do exercito:  INTERIOR | FRONTEIRA | EM MARCHA   (turnos)");
  for (const arq of process.argv.slice(2)) {
    const L = medir(arq);
    console.log("== " + path.basename(arq));
    for (const lado of ["A", "B"]) {
      const s = L[lado], p = (x) => (100 * x / Math.max(1, s.turnos)).toFixed(0).padStart(3) + "%";
      console.log(`  ${lado} ${s.modelo.slice(0, 38).padEnd(38)} ${p(s.interior)} | ${p(s.fronteira)} | ${p(s.marcha)}   (${s.turnos})`);
    }
  }
}
module.exports = { medir, adjacencia };
