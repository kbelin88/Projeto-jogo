// ============================================================
//  partida_local.js  —  PARTIDA LOCAL (burro vs burro, SEM REDE)
// ------------------------------------------------------------
//  Rodar:  node partida_local.js [maxTurnos]
//
//  Roda uma partida deterministica (seed da CONFIG) dos dois jogadores
//  burros, imprime a linha-por-turno e, no fim, o RELATORIO DE DESFECHO.
//  Sem Ollama/Gemini, sem cota: e o banco de teste das MECANICAS (forca
//  inicial, teto de producao, balanceamento) antes de gastar modelo.
// ============================================================
"use strict";
const E = require("../engine.js");

const maxTurnos = parseInt(process.argv[2], 10) || E.CONFIG.max_turnos;

console.log(`Partida LOCAL: jogadorBurro (A) vs jogadorBurro (B) | seed ${E.CONFIG.seed} | maxTurnos ${maxTurnos}\n`);

const res = E.rodarPartida(E.CONFIG, null, { verbose: true, maxTurnos });

console.log("\n" + E.relatorioDesfecho(res));
