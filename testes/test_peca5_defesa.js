// ============================================================
//  test_peca5_defesa.js — BONUS DE DEFESA (terreno), combate v3
// ------------------------------------------------------------
//    campo aberto / estrada -> x1.0 (sem bonus)
//    aldeia                 -> x1.25 (+25%)
//    capital / castelo      -> x1.50 (+50%)
//  Multiplica a DEFESA EFETIVA (FdefEf), na conta que serve motor E UI.
//  Combate v3 (atq/def): 80 lanceiros defendem com def 80*2 = 160.
//      aldeia  FdefEf = 160*1.25 = 200
//      castelo FdefEf = 160*1.50 = 240
//  Atacante lanceiro vs defensor lanceiro = counter NEUTRO -> FatkEf = N.
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;
CONFIG.combate.bonus_defesa_aldeia = 1.25;
CONFIG.combate.bonus_defesa_castelo = 1.5;

const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];
let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}
function estadoTeste() { return { config: CONFIG, turno: 0, aldeias: [], movimentos: [], log: [] }; }
function ald(id, dono, tropas, capital) {
  const tr = Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {});
  const tipo = dono ? null : Engine.tipoDominante({ config: CONFIG }, tr);
  return { id, x: 0, y: 0, nome: "Vila" + id, dono: dono || null,
    capital: !!capital, tipo, recursos: { madeira: 0, ferro: 0 }, tropas: tr, construindo: [] };
}
const clone = (o) => JSON.parse(JSON.stringify(o));
function combate(alvo, tropasAtk) {
  const e = estadoTeste(); e.aldeias.push(alvo);
  return Engine.resolverCombate(e, { dono: "A", tropas: tropasAtk }, clone(alvo));
}

console.log("A) Aldeia (+25%): FdefEf 160 -> 200");
{
  const v = ald(1, null, { lanceiro: 80 });               // def=160
  const hold = combate(v, { lanceiro: 190 });             // 190 < 200
  checa("190 NAO toma a aldeia (sem bonus tomaria: 190>160)", hold.vencedor === "defensor");
  checa("FdefEf = 200 (160*1.25)", hold.FdefEf === 200, `${hold.FdefEf}`);
  checa("aldeia continua neutra", hold.conquista === false);
  const win = combate(v, { lanceiro: 210 });              // 210 > 200
  checa("210 conquista a aldeia", win.vencedor === "atacante" && win.conquista === true);
}

console.log("\nB) Castelo (+50%): FdefEf 160 -> 240");
{
  const c = ald(2, "B", { lanceiro: 80 }, true);          // capital, def=160
  const hold = combate(c, { lanceiro: 210 });             // 210 < 240 (mas tomaria aldeia)
  checa("210 (toma aldeia) NAO toma o castelo", hold.vencedor === "defensor");
  checa("FdefEf = 240 (160*1.5)", hold.FdefEf === 240, `${hold.FdefEf}`);
  const win = combate(c, { lanceiro: 250 });              // 250 > 240
  checa("250 conquista o castelo", win.vencedor === "atacante" && win.conquista === true);
  const e = estadoTeste(); const c2 = ald(9, "B", { lanceiro: 80 }, true); e.aldeias.push(c2);
  Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 250 } }, c2);
  checa("castelo conquistado continua castelo (capital true, dono A)", c2.capital === true && c2.dono === "A");
}

console.log("\nC) Previsao (UI) casa com o motor, com o bonus:");
{
  const v = ald(3, null, { lanceiro: 80 });
  const e = estadoTeste(); e.aldeias.push(v);
  const prev = Engine.preverCombate(e, { lanceiro: 190 }, v);
  const real = combate(v, { lanceiro: 190 });
  checa("vencedor igual", prev.atacanteVence === (real.vencedor === "atacante"));
  checa("FdefEf igual", Math.round(prev.FdefEf) === real.FdefEf, `${Math.round(prev.FdefEf)} vs ${real.FdefEf}`);
}

console.log("\nD) Geracao marca a capital dos reis:");
{
  const g = Engine.gerarTeatro(Object.assign({}, Engine.CONFIG, { seed: 1 }));
  const caps = g.aldeias.filter((a) => a.capital);
  checa("exatamente 2 capitais", caps.length === 2, `${caps.length}`);
  checa("capitais tem dono (reis)", caps.every((a) => a.dono !== null));
  checa("nenhuma neutra e capital", g.aldeias.filter((a) => a.dono === null).every((a) => !a.capital));
}

console.log("\nE) Aldeia conquistada continua aldeia (nao vira castelo):");
{
  const e = estadoTeste(); const nv = ald(5, null, { lanceiro: 20 }); e.aldeias.push(nv);
  Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 200 } }, nv);
  checa("conquistada: dono A", nv.dono === "A");
  checa("conquistada: capital continua false (aldeia, nao castelo)", nv.capital === false);
}

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
