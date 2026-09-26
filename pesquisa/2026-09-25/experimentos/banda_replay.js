// banda_replay.js — por Rei, a partir do replay: ONDE constroi (interior x
// fronteira) e de QUANTAS aldeias do interior sai tropa por turno. Mede se a
// tropa parada e escolha (nao quer mover) ou banda (constroi em todo o lado e
// nao da ordem a cada aldeia). Marcha nova = turnosRestantes === turnosTotal.
"use strict";
const fs = require("fs");
const path = require("path");
const Iberia = require(path.join(__dirname, "..", "..", "..", "world-iberia.js"));
const nT = (t) => (t.lanceiro || 0) + (t.arqueiro || 0) + (t.cavaleiro || 0);
function adjacencia(frame) {
  const id = {}; for (const a of frame.aldeias) id[a.slug] = a.id;
  const adj = {};
  for (const e of Iberia.ESTRADAS) { const x = id[e.de], y = id[e.para]; if (x == null || y == null) continue; (adj[x] = adj[x] || []).push(y); (adj[y] = adj[y] || []).push(x); }
  return adj;
}
for (const arq of process.argv.slice(2)) {
  const R = JSON.parse(fs.readFileSync(arq, "utf8"));
  const adj = adjacencia(R.frames[0]);
  console.log("== " + path.basename(arq));
  for (const lado of ["A", "B"]) {
    const s = { constrInt: 0, constrFront: 0, aldInt: 0, aldIntQueEnviam: 0, tropaIntSaiu: 0, tropaIntFicou: 0, turnos: 0 };
    for (const f of R.frames.filter((x) => x.turno >= 2)) {
      const dono = {}; for (const a of f.aldeias) dono[a.id] = a.dono;
      const minhas = f.aldeias.filter((a) => a.dono === lado); if (!minhas.length) continue;
      s.turnos++;
      const novas = (f.movimentos || []).filter((m) => m.dono === lado && m.turnosRestantes === m.turnosTotal);
      for (const a of minhas) {
        const interior = (adj[a.id] || []).every((v) => dono[v] === lado);
        const c = (a.construindo || []).length;
        if (interior) s.constrInt += c; else s.constrFront += c;
        if (!interior) continue;
        s.aldInt++;
        const saiu = novas.filter((m) => m.origemId === a.id).reduce((q, m) => q + nT(m.tropas), 0);
        if (saiu) s.aldIntQueEnviam++;
        s.tropaIntSaiu += saiu; s.tropaIntFicou += nT(a.tropas);
      }
    }
    const etq = String(lado === "A" ? R.frames[1].etiquetaA : R.frames[1].etiquetaB).replace(/^openrouter:/, "").slice(0, 38);
    const pc = (a, b) => (b ? (100 * a / b).toFixed(0) : "-") + "%";
    console.log(`  ${lado} ${etq.padEnd(38)} producao ordenada no interior ${pc(s.constrInt, s.constrInt + s.constrFront).padStart(4)} | aldeias do interior que enviam/turno ${pc(s.aldIntQueEnviam, s.aldInt).padStart(4)} | tropa do interior que sai ${pc(s.tropaIntSaiu, s.tropaIntSaiu + s.tropaIntFicou).padStart(4)}`);
  }
}
