// ============================================================
//  test_v1_peca1.js  —  TESTE DA V1 PECA 1, PARTE A (neutras tipadas)
// ------------------------------------------------------------
//  Rodar:  node test_v1_peca1.js
//
//  Confere o que a spec_v1 pede (Parte A):
//    1) NEUTRAS TIPADAS: 20 aldeias (18 neutras + 2 reis); cada neutra
//       tem UM tipo so, quantidade na faixa; mesma seed -> mesmos tipos.
//    2) ENDURECIMENTO TIPADO: cada neutra acumula +inc do SEU tipo por
//       turno (e so daquele tipo).
//  (A Parte B — relatorioTexto — entra depois.)
// ============================================================
"use strict";
const Engine = require("./engine.js");
const CONFIG = Engine.CONFIG;
const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];

let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

// ---------------------------------------------------------
//  1) NEUTRAS TIPADAS
// ---------------------------------------------------------
console.log("1) Neutras tipadas (estado inicial):");
const e = Engine.criarEstadoInicial(CONFIG);
const reis = e.aldeias.filter((a) => a.dono !== null);
const neutras = Engine.aldeiasDe(e, null);

checa(`${CONFIG.teatro.n_aldeias} aldeias (escala de teste)`, e.aldeias.length === CONFIG.teatro.n_aldeias, `${e.aldeias.length}`);
checa("2 reis + resto neutras", reis.length === 2 && neutras.length === CONFIG.teatro.n_aldeias - 2, `${reis.length} reis / ${neutras.length} neutras`);

const fmin = CONFIG.neutra.forca_min, fmax = CONFIG.neutra.forca_max;
const umTipo = neutras.every((a) => {
  const presentes = TIPOS.filter((t) => a.tropas[t] > 0);
  return a.tipo && presentes.length === 1 && presentes[0] === a.tipo;
});
checa("cada neutra tem UM tipo so (= seu a.tipo)", umTipo);
checa(`quantidade do tipo na faixa [${fmin},${fmax}]`, neutras.every((a) => a.tropas[a.tipo] >= fmin && a.tropas[a.tipo] <= fmax));
checa("reis sem tipo e sem tropas", reis.every((a) => a.tipo === null && Engine.forcaDe(a.tropas, CONFIG) === 0));

// distribuicao de tipos (so para inspecao)
const dist = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
for (const a of neutras) dist[a.tipo]++;
console.log(`     tipos das neutras: ${dist.lanceiro} lanceiro / ${dist.arqueiro} arqueiro / ${dist.cavaleiro} cavaleiro`);
console.log("     exemplos: " + neutras.slice(0, 5).map((a) => `[${a.id}] ${a.tropas[a.tipo]} ${a.tipo}`).join(" | "));

// mesma seed -> mesmos tipos e quantidades
const e2 = Engine.criarEstadoInicial(CONFIG);
const mesmaSeed = Engine.aldeiasDe(e2, null).every((a, i) =>
  a.tipo === neutras[i].tipo && a.tropas[a.tipo] === neutras[i].tropas[neutras[i].tipo]);
checa("mesma seed -> mesmos tipos e quantidades (deterministico)", mesmaSeed);

// ---------------------------------------------------------
//  2) ENDURECIMENTO TIPADO
// ---------------------------------------------------------
console.log("\n2) Endurecimento tipado (rodar turnos):");
const e3 = Engine.criarEstadoInicial(CONFIG);
const ini = new Map(Engine.aldeiasDe(e3, null).map((a) => [a.id, { tipo: a.tipo, n: a.tropas[a.tipo] }]));
const N = 5;
const inc = CONFIG.neutra.endurecimento;
for (let i = 0; i < N; i++) Engine.tick(e3);

const neutras3 = Engine.aldeiasDe(e3, null); // as que nao foram conquistadas
const endurOk = neutras3.every((a) => {
  const base = ini.get(a.id);
  const soDoTipo = TIPOS.filter((t) => t !== a.tipo).every((t) => a.tropas[t] === 0);
  return a.tropas[a.tipo] === base.n + inc * N && soDoTipo;
});
checa(`cada neutra +${inc}/turno do SEU tipo (e so dele) apos ${N} turnos`, endurOk);
const ex = neutras3[0];
console.log(`     ex.: neutra #${ex.id} ${ini.get(ex.id).n} -> ${ex.tropas[ex.tipo]} ${ex.tipo}(s)`);

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
