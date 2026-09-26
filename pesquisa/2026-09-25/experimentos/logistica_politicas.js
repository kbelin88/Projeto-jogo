// logistica_politicas.js — a regua do logistica_replay.js: a mesma conta
// (fracao do exercito no INTERIOR / FRONTEIRA / EM MARCHA, media por turno)
// para as politicas do motor, sem LLM. Diz quanto do "interior" e estrutural
// (tropa nova nasce onde a aldeia esta) e quanto e escolha.
"use strict";
const path = require("path");
const E = require(path.join(__dirname, "..", "..", "..", "engine.js"));
const { politica } = require("./variantes.js");
const nT = (t) => (t.lanceiro || 0) + (t.arqueiro || 0) + (t.cavaleiro || 0);
function fotografia(g, lado, s) {
  const minhas = E.aldeiasDe(g, lado); if (!minhas.length) return;
  let i = 0, b = 0;
  for (const a of minhas) {
    const k = nT(a.tropas);
    if (g.estradas.adj[a.id].some((v) => { const x = g.aldeias.find((q) => q.id === v); return x.dono && x.dono !== lado; })) b += k; else i += k;
  }
  const m = g.movimentos.filter((x) => x.dono === lado).reduce((q, x) => q + nT(x.tropas), 0);
  const tot = i + b + m; if (!tot) return;
  s.i += i / tot; s.b += b / tot; s.m += m / tot; s.n++;
}
const N = +process.argv[2] || 40;
const P = {
  "burro": E.jogadorBurro,
  "k1.5 retag.PARADA": politica({ k: 1.5, retaguarda: "parada" }),
  "k1.5 retag.ataca": politica({ k: 1.5, retaguarda: "ataca" }),
  "k1.5 retag.REFORCA": politica({ k: 1.5, retaguarda: "reforca" }),
};
for (const nome in P) {
  const s = { i: 0, b: 0, m: 0, n: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const cfg = Object.assign({}, E.CONFIG, { seed }); cfg.layout = "iberia";
    const g = E.criarEstadoInicial(cfg);
    for (let t = 0; t < 60; t++) {
      E.tick(g);
      if (E.checarVitoria && E.checarVitoria(g)) break;
      for (const [lado, dec] of [["A", P[nome]], ["B", E.jogadorBurro]]) {
        if (!E.aldeiasDe(g, lado).length) continue;
        E.executarOrdem(g, lado, dec(E.montarVisao(g, lado)));
      }
      // DEPOIS das ordens, como o frame do replay (runner e browser)
      fotografia(g, "A", s);
    }
  }
  const p = (x) => (100 * x / s.n).toFixed(0).padStart(3) + "%";
  console.log(`${nome.padEnd(20)} (lado A, contra o burro) INTERIOR ${p(s.i)} | FRONTEIRA ${p(s.b)} | EM MARCHA ${p(s.m)}   (${s.n} turnos)`);
}
