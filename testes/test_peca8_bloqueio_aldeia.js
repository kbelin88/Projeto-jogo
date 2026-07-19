// ============================================================
//  test_peca8_bloqueio_aldeia.js — FASE MOTOR #4: NAO PASSA POR ALDEIA ALHEIA
// ------------------------------------------------------------
//  Rodar:  node testes/test_peca8_bloqueio_aldeia.js
//
//  Regra (Lucas 19/07): o exercito NAO passa por aldeia que nao e do dono
//  (inimiga OU barbara nao conquistada). A marcha para na PRIMEIRA aldeia
//  nao-propria do caminho e briga ali. Aldeias PROPRIAS no meio: passa reto.
//  Assim nao da p/ enviar ataque a aldeia do lado do castelo no 2o turno.
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;

let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}
function mk(id, x, dono) {
  return { id, x, y: 0, nome: "V" + id, dono: dono || null, capital: false, tipo: null,
    recursos: { madeira: 0, ferro: 0 },
    tropas: { lanceiro: dono === "A" ? 100 : 10, arqueiro: 0, cavaleiro: 0 }, construindo: [] };
}
// linha 0-1-2-3 ligada por estradas; donos configuraveis
function linha(d1, d2, d3) {
  return { config: CONFIG, turno: 0, log: [], movimentos: [],
    aldeias: [mk(0, 0, "A"), mk(1, 5, d1), mk(2, 10, d2), mk(3, 15, d3)],
    estradas: { adj: { 0: [1], 1: [0, 2], 2: [1, 3], 3: [2] } } };
}

// ---------------------------------------------------------
//  A) BLOQUEIO em NEUTRA: 0(A)-1(neutra)-2(neutra)-3(B). Enviar 0->3 para na 1.
// ---------------------------------------------------------
console.log("A) Bloqueio na 1a aldeia neutra do caminho:");
{
  const e = linha(null, null, "B");
  const mov = Engine.enviarExercito(e, 0, 3, { lanceiro: 50 });
  checa("caminho truncado = [0,1]", mov.caminho.join(">") === "0>1", mov.caminho.join(">"));
  checa("destino real = 1 (nao 3)", mov.destinoId === 1);
}

// ---------------------------------------------------------
//  B) PASSA por aldeia PROPRIA: 0(A)-1(A)-2(neutra)-3(B). Enviar 0->3 para na 2.
// ---------------------------------------------------------
console.log("\nB) Passa reto por aldeia propria, para na 1a nao-propria:");
{
  const e = linha("A", null, "B");
  const mov = Engine.enviarExercito(e, 0, 3, { lanceiro: 50 });
  checa("caminho = [0,1,2] (passou pela propria 1)", mov.caminho.join(">") === "0>1>2", mov.caminho.join(">"));
  checa("destino real = 2", mov.destinoId === 2);
}

// ---------------------------------------------------------
//  C) BLOQUEIO em INIMIGA: 0(A)-1(B)-2(neutra). Enviar 0->2 para na 1.
// ---------------------------------------------------------
console.log("\nC) Bloqueio na aldeia inimiga:");
{
  const e = linha("B", null, null);
  const mov = Engine.enviarExercito(e, 0, 2, { lanceiro: 50 });
  checa("caminho = [0,1] (parou no inimigo)", mov.caminho.join(">") === "0>1", mov.caminho.join(">"));
  checa("destino real = 1", mov.destinoId === 1);
}

// ---------------------------------------------------------
//  D) REFORCO por territorio PROPRIO: 0(A)-1(A)-2(A). Enviar 0->2 chega em 2.
// ---------------------------------------------------------
console.log("\nD) Reforco atravessa territorio proprio ate o fim:");
{
  const e = linha("A", "A", null);
  const mov = Engine.enviarExercito(e, 0, 2, { lanceiro: 50 });
  checa("caminho = [0,1,2] (tudo proprio, sem truncar)", mov.caminho.join(">") === "0>1>2", mov.caminho.join(">"));
  checa("destino real = 2", mov.destinoId === 2);
}

// ---------------------------------------------------------
//  E) ADJACENTE inimiga: 0(A)-1(B). Enviar 0->1 vai direto (destino ja e o 1o).
// ---------------------------------------------------------
console.log("\nE) Ataque a aldeia adjacente segue normal:");
{
  const e = linha("B", null, null);
  const mov = Engine.enviarExercito(e, 0, 1, { lanceiro: 50 });
  checa("caminho = [0,1]", mov.caminho.join(">") === "0>1");
  checa("destino real = 1", mov.destinoId === 1);
}

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
