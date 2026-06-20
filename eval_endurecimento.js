// ============================================================
//  eval_endurecimento.js  —  varredura de balanceamento
// ------------------------------------------------------------
//  Mede o efeito do endurecimento das neutras sobre:
//    - quantas neutras sao conquistadas (= elas sao atrativas?)
//    - duracao da partida
//    - equilibrio de vitorias
//  Rodar:  node eval_endurecimento.js
// ============================================================
"use strict";
const Engine = require("./engine.js");
const base = Engine.CONFIG;
const N = 30;                       // partidas por valor (seeds 1..N)
const valores = [5, 4, 3, 2, 1, 0]; // endurecimento a testar

console.log(`Varredura de neutra.endurecimento | ${N} seeds cada | 48 neutras iniciais\n`);
console.log("endur | turnos(med) | neutras conquistadas(med/48) | %tomadas | A/B/semfim");
console.log("------+-------------+-----------------------------+----------+-----------");

for (const e of valores) {
  let somaTurnos = 0, somaConq = 0, vitA = 0, vitB = 0, semFim = 0;
  for (let s = 1; s <= N; s++) {
    const cfg = JSON.parse(JSON.stringify(base));
    cfg.seed = s;
    cfg.neutra.endurecimento = e;
    const r = Engine.rodarPartida(cfg, null, {});
    somaTurnos += r.turnos;
    const neutrasFim = r.estado.aldeias.filter((a) => a.dono === null).length;
    somaConq += 48 - neutrasFim;
    if (r.vencedor === "A") vitA++;
    else if (r.vencedor === "B") vitB++;
    else semFim++;
  }
  const turnos = (somaTurnos / N).toFixed(0);
  const conq = (somaConq / N).toFixed(1);
  const pct = ((somaConq / N / 48) * 100).toFixed(0);
  console.log(
    `  +${e}  |    ${String(turnos).padStart(4)}     |` +
    `            ${String(conq).padStart(4)}             |   ${String(pct).padStart(3)}%   | ${vitA}/${vitB}/${semFim}`
  );
}
