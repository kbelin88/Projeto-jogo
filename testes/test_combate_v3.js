// test_combate_v3.js — FASE 7.3/7.4 (04/08): combate com ATAQUE e DEFESA
// separados. Teste AUTORITATIVO da mecanica nova. Os 9 casos da 7.3.4 mais:
// empate fica com o defensor, atrito, vencedor sobrevive, ataqueDe/defesaDe
// nunca trocados, tipoDominante = mais numeroso, tetos contam unidades,
// regrasCombateTexto reflete a CONFIG.
// 17/08: este ficheiro fixa numeros calculados A MAO sob o ruleset que hoje
// se chama CONFIG_V3_ARQUIVO. O que ele testa e a FORMULA (combate, rota,
// minimo), nao o balanceamento — entao continua a correr contra o arquivo,
// que e imutavel. Os mesmos invariantes sob o ruleset VIVO estao em
// testes/test_ruleset_vivo.js.
"use strict";
const assert = require("assert");
const E = require("../engine.js");

let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("  ok  " + nome); };

const cfg = () => JSON.parse(JSON.stringify(E.CONFIG_V3_ARQUIVO));
const full = (x) => Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, x);
function estado() { return { config: cfg(), turno: 0, aldeias: [], movimentos: [], log: [] }; }

// vencedor de atk (exercito) contra def (guarnicao) num terreno.
//   campo   -> preverCombateTipos com defBonus 1 (choque em campo aberto)
//   aldeia  -> resolverCombate numa neutra (capital=false)
//   castelo -> resolverCombate numa capital
function vencedor(atk, def, terreno) {
  const e = estado();
  if (terreno === "campo") {
    const at = full(atk), df = full(def);
    const r = E.preverCombateTipos(e, E.ataqueDe(at, e.config), E.tipoDominante(e, at),
      E.defesaDe(df, e.config), E.tipoDominante(e, df), 1);
    return r.atacanteVence ? "atacante" : "defensor";
  }
  const alvo = {
    id: 9, nome: "X", dono: terreno === "castelo" ? "B" : null,
    capital: terreno === "castelo", tipo: E.tipoDominante(e, full(def)),
    tropas: full(def), recursos: { madeira: 0, ferro: 0 }, construindo: [],
  };
  e.aldeias.push(alvo);
  return E.resolverCombate(e, { dono: "A", tropas: full(atk) }, alvo).vencedor;
}

console.log("OS 9 CASOS DA 7.3.4");
const casos = [
  ["1 cav > 1 lanc CAMPO",   { cavaleiro: 1 }, { lanceiro: 1 }, "campo",   "atacante"],
  ["1 cav > 1 lanc ALDEIA",  { cavaleiro: 1 }, { lanceiro: 1 }, "aldeia",  "atacante"],
  ["1 cav > 1 lanc CASTELO", { cavaleiro: 1 }, { lanceiro: 1 }, "castelo", "atacante"],
  ["1 lanc > 1 cav ALDEIA",  { lanceiro: 1 }, { cavaleiro: 1 }, "aldeia",  "defensor"],
  ["2 lanc > 1 cav ALDEIA",  { lanceiro: 2 }, { cavaleiro: 1 }, "aldeia",  "atacante"],
  ["1 arq > 1 lanc ALDEIA",  { arqueiro: 1 }, { lanceiro: 1 }, "aldeia",  "defensor"],
  ["2 arq > 1 lanc ALDEIA",  { arqueiro: 2 }, { lanceiro: 1 }, "aldeia",  "atacante"],
  ["3 cav > 3 lanc ALDEIA",  { cavaleiro: 3 }, { lanceiro: 3 }, "aldeia",  "atacante"],
  ["2 cav > 3 lanc ALDEIA",  { cavaleiro: 2 }, { lanceiro: 3 }, "aldeia",  "defensor"],
];
for (const [nome, atk, def, terr, esp] of casos) {
  t(nome + " -> " + esp, () => assert.strictEqual(vencedor(atk, def, terr), esp));
}

console.log("EMPATE, ATRITO, SOBREVIVENCIA");
t("empate fica com o DEFENSOR (1 lanc vs 1 cav aldeia = 1.25 vs 1.25)", () => {
  assert.strictEqual(vencedor({ lanceiro: 1 }, { cavaleiro: 1 }, "aldeia"), "defensor");
});
t("vencedor SOBREVIVE com >=1 tropa (atrito nao zera o vencedor)", () => {
  const e = estado();
  const alvo = { id: 1, nome: "X", dono: null, capital: false, tipo: "lanceiro",
    tropas: full({ lanceiro: 3 }), recursos: { madeira: 0, ferro: 0 }, construindo: [] };
  e.aldeias.push(alvo);
  const rep = E.resolverCombate(e, { dono: "A", tropas: full({ cavaleiro: 3 }) }, alvo);
  assert.strictEqual(rep.vencedor, "atacante");
  assert.strictEqual(rep.conquista, true);
  assert.ok(E.contarTropas(alvo.tropas) >= 1, "vencedor sobreviveu com tropas");
});
t("atrito: o defensor que segura perde tropas (mas nao zera)", () => {
  const e = estado();
  const alvo = { id: 1, nome: "X", dono: null, capital: false, tipo: "lanceiro",
    tropas: full({ lanceiro: 10 }), recursos: { madeira: 0, ferro: 0 }, construindo: [] };
  e.aldeias.push(alvo);
  const rep = E.resolverCombate(e, { dono: "A", tropas: full({ cavaleiro: 1 }) }, alvo); // atacante perde
  assert.strictEqual(rep.vencedor, "defensor");
  assert.ok(alvo.tropas.lanceiro < 10 && alvo.tropas.lanceiro >= 1, "defensor sofreu baixas sem zerar");
});

console.log("ATAQUE vs DEFESA NUNCA TROCADOS (7.4)");
t("ataqueDe usa atq; defesaDe usa def", () => {
  const c = E.CONFIG_V3_ARQUIVO;
  assert.strictEqual(E.ataqueDe(full({ cavaleiro: 1 }), c), c.tropas.cavaleiro.atq); // 4
  assert.strictEqual(E.defesaDe(full({ cavaleiro: 1 }), c), c.tropas.cavaleiro.def); // 1
  assert.strictEqual(E.ataqueDe(full({ lanceiro: 1 }), c), c.tropas.lanceiro.atq);   // 1
  assert.strictEqual(E.defesaDe(full({ lanceiro: 1 }), c), c.tropas.lanceiro.def);   // 2
  // exercito atacante mede so atq; defensor so def — nunca o inverso
  assert.notStrictEqual(E.ataqueDe(full({ cavaleiro: 1 }), c), E.defesaDe(full({ cavaleiro: 1 }), c));
});

console.log("TIPO DOMINANTE = MAIS NUMEROSO (7.4-B)");
t("mais numeroso, nao mais forte: 1 cav + 3 lanc -> lanceiro", () => {
  assert.strictEqual(E.tipoDominante(estado(), full({ lanceiro: 3, cavaleiro: 1 })), "lanceiro");
});
t("desempate fixo lanceiro>arqueiro>cavaleiro: 2 lanc + 2 arq -> lanceiro", () => {
  assert.strictEqual(E.tipoDominante(estado(), full({ lanceiro: 2, arqueiro: 2 })), "lanceiro");
  assert.strictEqual(E.tipoDominante(estado(), full({ arqueiro: 2, cavaleiro: 2 })), "arqueiro");
});

console.log("TETOS CONTAM UNIDADES E NAO MUDAM COM atq/def (7.4-A)");
t("tropasComprometidas conta unidades + fila, imune a atq/def", () => {
  const e = estado();
  const a = { id: 1, dono: "A", tropas: full({ lanceiro: 2, cavaleiro: 1 }),
    construindo: [{ tipo: "arqueiro", turnosRestantes: 1 }] };
  const antes = E.tropasComprometidas(e, a); // 3 em casa + 1 na fila = 4
  assert.strictEqual(antes, 4);
  // dobrar atq/def NAO pode mudar a contagem do teto
  e.config.tropas.cavaleiro.atq = 99; e.config.tropas.lanceiro.def = 99;
  assert.strictEqual(E.tropasComprometidas(e, a), antes);
});

console.log("regrasCombateTexto REFLETE A CONFIG");
t("mudar cavaleiro.atq na CONFIG muda o texto do prompt", () => {
  const c1 = cfg(); const txt1 = E.regrasCombateTexto(c1);
  assert.ok(txt1.includes(`ataque ${c1.tropas.cavaleiro.atq}`), "texto tem o atq do cavaleiro");
  const c2 = cfg(); c2.tropas.cavaleiro.atq = 7;
  assert.ok(E.regrasCombateTexto(c2).includes("ataque 7"), "texto acompanha a CONFIG");
});

console.log(`\n${ok} testes ok`);
