// LOTE E, E0 — captura/compara a baseline de COMPORTAMENTO do motor.
// Diferente de ref-lote-c (que cobre TEXTO do relatorio): aqui o alvo e o
// RESULTADO da partida (vencedor/motivo/turnos/historico) de rodarPartida
// burro vs burro, layout iberia, seeds 1/2/3, maxTurnos 60, com TODAS as
// flags do LOTE E explicitamente a false. E a guarda de regressao do lote.
// Uso: node _capturar.js gravar    (grava seed1/2/3.json)
//      node _capturar.js conferir  (compara; sai 1 se divergir)
"use strict";
const E = require("../../engine.js");
const fs = require("fs");
const path = require("path");
const DIR = __dirname;
const SEEDS = [1, 2, 3];
// flags de COMPORTAMENTO do motor introduzidas pelo lote E (E1/E3/E4).
const FLAGS_OFF = { ordensSimultaneas: false, interceptaChegada: false, desempateEstradaRng: false };

function partida(seed) {
  const cfg = Object.assign(JSON.parse(JSON.stringify(E.CONFIG)), FLAGS_OFF);
  cfg.layout = "iberia";
  cfg.seed = seed;
  const dec = { A: (v) => E.jogadorBurro(v), B: (v) => E.jogadorBurro(v) };
  const res = E.rodarPartida(cfg, dec, { maxTurnos: 60 });
  return JSON.stringify({ vencedor: res.vencedor, motivo: res.motivo, turnos: res.turnos, historico: res.historico });
}

const modo = process.argv[2] || "conferir";
if (modo === "gravar") {
  for (const s of SEEDS) fs.writeFileSync(path.join(DIR, "seed" + s + ".json"), partida(s));
  console.log("baseline E0 gravada: " + SEEDS.map((s) => "seed" + s).join(", "));
} else {
  let ok = true;
  for (const s of SEEDS) {
    const ref = fs.readFileSync(path.join(DIR, "seed" + s + ".json"), "utf8");
    if (ref === partida(s)) console.log("  IDENTICO seed" + s);
    else { ok = false; console.log("  DIFERENTE seed" + s); }
  }
  process.exit(ok ? 0 : 1);
}
