// ============================================================
//  test_peca7_combate_estrada.js — FASE MOTOR #2: COMBATE NA ESTRADA
// ------------------------------------------------------------
//  Rodar:  node testes/test_peca7_combate_estrada.js
//
//  Regra: dois exercitos INIMIGOS que se cruzam no MESMO trecho, em sentidos
//  opostos, se enfrentam NO CAMINHO — combate campo aberto (sem bonus de
//  terreno). O perdedor e eliminado; o vencedor segue com baixas.
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
function mk(id, x, y, dono, tropas) {
  return { id, x, y, nome: "V" + id, dono: dono || null, capital: false, tipo: null,
    recursos: { madeira: 0, ferro: 0 },
    tropas: Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {}), construindo: [] };
}
// estado com 2 aldeias ligadas por uma estrada (0<->1)
function estado2() {
  return { config: CONFIG, turno: 0, log: [], movimentos: [],
    aldeias: [mk(0, 0, 0, "A", { lanceiro: 100 }), mk(1, 0, 12, "B", { lanceiro: 100 })],
    estradas: { adj: { 0: [1], 1: [0] } } };
}

// ---------------------------------------------------------
//  A) FRENTE A FRENTE: A (100L, F=1000) e B (50L, F=500) marcham um contra
//     o outro no trecho 0-1. Encontram no meio; A vence (campo aberto, sem
//     bonus); B eliminado; A segue.
// ---------------------------------------------------------
console.log("A) Cruzamento frontal na estrada (A 1000 vs B 500):");
{
  const e = estado2();
  e.aldeias[1].tropas.lanceiro = 50; // B mais fraco
  Engine.enviarExercito(e, 0, 1, { lanceiro: 100 }); // A -> B
  Engine.enviarExercito(e, 1, 0, { lanceiro: 50 });  // B -> A
  checa("2 exercitos em transito", e.movimentos.length === 2);
  let evento = null;
  for (let t = 0; t < 4 && !evento; t++) {
    Engine.avancarMovimentos(e);
    evento = e.log.find((l) => l.tipo === "combate_estrada");
  }
  checa("houve combate NA ESTRADA", !!evento, evento ? `venc ${evento.vencedorDono}` : "nenhum");
  checa("vencedor = A (1000 > 500)", evento && evento.vencedorDono === "A");
  const vivos = e.movimentos.map((m) => m.dono);
  checa("B foi eliminado do transito", !vivos.includes("B"), `vivos: ${vivos.join(",") || "-"}`);
  checa("A segue viajando (com baixas)", vivos.includes("A"));
  const exA = e.movimentos.find((m) => m.dono === "A");
  checa("A sofreu baixas (< 100 lanceiros)", exA && exA.tropas.lanceiro < 100, exA ? `L${exA.tropas.lanceiro}` : "-");
}

// ---------------------------------------------------------
//  B) MESMO DONO nao se enfrenta; INIMIGO no MESMO trecho, sentidos opostos, sim.
// ---------------------------------------------------------
console.log("\nB) Deteccao de cruzamento:");
{
  const e = estado2();
  const mA = Engine.enviarExercito(e, 0, 1, { lanceiro: 10 }); // 0->1
  const mB = Engine.enviarExercito(e, 1, 0, { lanceiro: 10 }); // 1->0 (oposto)
  // avanca 1 turno: ambos ao meio (dist 12, passo 6 -> 2 turnos; frac .5 -> pos 6 e 6)
  mA.turnosRestantes -= 1; mB.turnosRestantes -= 1;
  checa("inimigos em sentidos opostos no mesmo trecho = cruzaram", Engine.cruzaramNaEstrada(e, mA, mB) === true);
  // mesmo dono nunca cruza
  const e2 = estado2();
  const mA1 = Engine.enviarExercito(e2, 0, 1, { lanceiro: 10 });
  e2.aldeias[1].dono = "A"; // agora 1 e do A tambem
  const mA2 = Engine.enviarExercito(e2, 1, 0, { lanceiro: 10 });
  mA1.turnosRestantes -= 1; mA2.turnosRestantes -= 1;
  checa("mesmo dono nao se enfrenta", Engine.cruzaramNaEstrada(e2, mA1, mA2) === false);
}

// ---------------------------------------------------------
//  C) Ainda NAO se encontraram (comeco da marcha) -> sem combate.
// ---------------------------------------------------------
console.log("\nC) Antes de se encontrarem, nao ha combate:");
{
  const e = estado2();
  const mA = Engine.enviarExercito(e, 0, 1, { lanceiro: 10 });
  const mB = Engine.enviarExercito(e, 1, 0, { lanceiro: 10 });
  // sem avancar: A na ponta 0 (pos 0), B na ponta 1 (pos 12) -> nao cruzaram
  checa("no inicio (pontas opostas) nao cruzaram", Engine.cruzaramNaEstrada(e, mA, mB) === false);
}

// ---------------------------------------------------------
//  D) Combate na estrada NAO usa bonus de terreno (campo aberto):
//     forcas IGUAIS -> quem vence e o desempate canonico (defensor), nao um
//     bonus. Aqui so garantimos que o tipo do evento e "combate_estrada" e que
//     nenhum FdefEf recebeu x1.25/x1.5.
// ---------------------------------------------------------
console.log("\nD) Campo aberto (sem bonus de aldeia/castelo):");
{
  const e = estado2(); // ambos 100L (F=1000, iguais)
  const rep = Engine.resolverCombateEstrada(e,
    { dono: "A", tropas: { lanceiro: 100 }, caminho: [0, 1], turnosTotal: 2, turnosRestantes: 1 },
    { dono: "B", tropas: { lanceiro: 100 }, caminho: [1, 0], turnosTotal: 2, turnosRestantes: 1 });
  checa("evento tipo combate_estrada", rep.ev.tipo === "combate_estrada");
  // forcas iguais: nenhum lado teve vantagem de terreno (senao um veria x1.25+)
  checa("empate real (forcas 1000 x 1000, sem bonus)", rep.ev.Fatk === 1000 && rep.ev.Fdef === 1000);
}

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
