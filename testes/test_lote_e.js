// test_lote_e.js — LOTE E (fairness do turno + interceptacao + desempate).
// E8.1 (regressao de COMPORTAMENTO do motor) entra no commit 1; E8.2-E8.5 depois.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../engine.js");

const REF = path.join(__dirname, "ref-lote-e");
const FLAGS_OFF = { ordensSimultaneas: false, interceptaChegada: false, desempateEstradaRng: false };
let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };

function partida(seed, flags) {
  const cfg = Object.assign(JSON.parse(JSON.stringify(E.CONFIG)), flags || {});
  cfg.layout = "iberia";
  cfg.seed = seed;
  const dec = { A: (v) => E.jogadorBurro(v), B: (v) => E.jogadorBurro(v) };
  const res = E.rodarPartida(cfg, dec, { maxTurnos: 60 });
  return JSON.stringify({ vencedor: res.vencedor, motivo: res.motivo, turnos: res.turnos, historico: res.historico });
}

// E8.1 — REGRESSAO DE COMPORTAMENTO: com TODAS as flags do lote E a false, o
// resultado de rodarPartida (burro vs burro) e byte-identico a baseline do E0.
t("E8.1 regressao de comportamento (3 seeds, flags E off)", () => {
  for (const s of [1, 2, 3]) {
    const ref = fs.readFileSync(path.join(REF, "seed" + s + ".json"), "utf8");
    assert.strictEqual(partida(s, FLAGS_OFF), ref, "divergiu em seed" + s);
  }
});

console.log("\ntest_lote_e: " + ok + " testes ok");
