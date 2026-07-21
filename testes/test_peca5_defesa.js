// ============================================================
//  test_peca5_defesa.js — FASE MOTOR #3: BONUS DE DEFESA (terreno)
// ------------------------------------------------------------
//  Rodar:  node testes/test_peca5_defesa.js
//
//  Regra (aprovada Lucas 19/07):
//    campo aberto / estrada (combate #2) -> x1.0 (sem bonus)
//    aldeia (neutra ou conquistada)      -> x1.25  (+25%)
//    capital / castelo                   -> x1.50  (+50%)
//  O bonus multiplica a forca EFETIVA do defensor (FdefEf), na mesma conta
//  que serve o motor E a UI. Numeros conferidos a mao (forca lanceiro = 10):
//    Fdef = 80 lanceiros = 800
//      aldeia  FdefEf = 800*1.25 = 1000
//      castelo FdefEf = 800*1.50 = 1200
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;
// fixa os valores que este teste confere (robusto a recalibracao do default)
CONFIG.combate.bonus_defesa_aldeia = 1.25;
CONFIG.combate.bonus_defesa_castelo = 1.5;
CONFIG.tropas.lanceiro.forca = 10; CONFIG.tropas.arqueiro.forca = 15; CONFIG.tropas.cavaleiro.forca = 30;

const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];
let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}
function estadoTeste() {
  return { config: CONFIG, turno: 0, aldeias: [], movimentos: [], log: [], jogadores: { A: {}, B: {} } };
}
function ald(id, dono, tropas, capital) {
  const tr = Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {});
  let tipo = null;
  if (!dono) { const p = TIPOS.filter((t) => tr[t] > 0); tipo = p.length ? p[0] : null; }
  return { id, x: 0, y: 0, nome: "Vila" + id, dono: dono || null,
    capital: !!capital, tipo, recursos: { madeira: 0, ferro: 0 }, tropas: tr, construindo: [] };
}
const clone = (o) => JSON.parse(JSON.stringify(o));
function combate(alvo, tropasAtk) {
  const e = estadoTeste(); e.aldeias.push(alvo);
  return Engine.resolverCombate(e, { dono: "A", tropas: tropasAtk }, clone(alvo));
}

// ---------------------------------------------------------
//  A) ALDEIA +25%: Fdef=800 -> FdefEf=1000. 900 nao toma; 1100 toma.
// ---------------------------------------------------------
console.log("A) Aldeia (+25%): FdefEf 800 -> 1000");
{
  const v = ald(1, null, { lanceiro: 80 });               // F=800
  const hold = combate(v, { lanceiro: 90 });              // Fatk=900 < 1000
  checa("900 NAO toma a aldeia (sem bonus tomaria: 900>800)", hold.vencedor === "defensor");
  checa("FdefEf = 1000 (800*1.25)", hold.FdefEf === 1000, `${hold.FdefEf}`);
  checa("aldeia continua neutra", hold.conquista === false);
  const win = combate(v, { lanceiro: 110 });              // Fatk=1100 > 1000
  checa("1100 conquista a aldeia", win.vencedor === "atacante" && win.conquista === true);
}

// ---------------------------------------------------------
//  B) CASTELO +50%: Fdef=800 -> FdefEf=1200. 1100 (que tomaria aldeia) NAO
//     toma o castelo; 1300 toma.
// ---------------------------------------------------------
console.log("\nB) Castelo (+50%): FdefEf 800 -> 1200");
{
  const c = ald(2, "B", { lanceiro: 80 }, true);          // capital, F=800
  const hold = combate(c, { lanceiro: 110 });             // 1100 < 1200
  checa("1100 (toma aldeia) NAO toma o castelo", hold.vencedor === "defensor");
  checa("FdefEf = 1200 (800*1.5)", hold.FdefEf === 1200, `${hold.FdefEf}`);
  const win = combate(c, { lanceiro: 130 });              // 1300 > 1200
  checa("1300 conquista o castelo", win.vencedor === "atacante" && win.conquista === true);
  // castelo conquistado CONTINUA castelo (novo dono): resolve direto p/ ver o alvo mutado
  const e = estadoTeste(); const c2 = ald(9, "B", { lanceiro: 80 }, true); e.aldeias.push(c2);
  Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 130 } }, c2);
  checa("castelo conquistado continua castelo (capital true, dono A)", c2.capital === true && c2.dono === "A");
}

// ---------------------------------------------------------
//  C) UI == MOTOR: a previsao (preverCombate) usa o MESMO bonus.
// ---------------------------------------------------------
console.log("\nC) Previsao (UI) casa com o motor, com o bonus:");
{
  const v = ald(3, null, { lanceiro: 80 });
  const e = estadoTeste(); e.aldeias.push(v);
  const prev = Engine.preverCombate(e, { lanceiro: 90 }, v);
  const real = combate(v, { lanceiro: 90 });
  checa("vencedor igual", prev.atacanteVence === (real.vencedor === "atacante"));
  checa("FdefEf igual", Math.round(prev.FdefEf) === real.FdefEf, `${Math.round(prev.FdefEf)} vs ${real.FdefEf}`);
}

// ---------------------------------------------------------
//  D) GERACAO marca a capital (integracao: mundo v2 real).
// ---------------------------------------------------------
console.log("\nD) Geracao marca a capital dos reis:");
{
  const g = Engine.gerarTeatro(Object.assign({}, Engine.CONFIG, { seed: 1 }));
  const caps = g.aldeias.filter((a) => a.capital);
  checa("exatamente 2 capitais", caps.length === 2, `${caps.length}`);
  checa("capitais tem dono (reis)", caps.every((a) => a.dono !== null));
  checa("nenhuma neutra e capital", g.aldeias.filter((a) => a.dono === null).every((a) => !a.capital));
}

// ---------------------------------------------------------
//  E) Conquistar uma aldeia NAO a transforma em castelo.
// ---------------------------------------------------------
console.log("\nE) Aldeia conquistada continua aldeia (nao vira castelo):");
{
  const e = estadoTeste(); const nv = ald(5, null, { lanceiro: 20 }); e.aldeias.push(nv);
  Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 200 } }, nv); // conquista
  checa("conquistada: dono A", nv.dono === "A");
  checa("conquistada: capital continua false (aldeia, nao castelo)", nv.capital === false);
}

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
