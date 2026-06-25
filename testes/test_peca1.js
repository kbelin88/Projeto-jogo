// ============================================================
//  test_peca1.js  —  TESTE DA PECA 1 (STATE)
// ------------------------------------------------------------
//  Rodar:  node test_peca1.js
//
//  Confere o que a spec pede para a Peca 1:
//    - 50 aldeias no total
//    - exatamente 2 com dono (1 Rei A, 1 Rei B)
//    - o resto neutras
//    - guarnicoes das neutras DENTRO da faixa [forca_min, forca_max]
//    - (extra) reis em lados opostos do teatro
// ============================================================
"use strict";
const Engine = require("../engine.js");

const CONFIG = Engine.CONFIG;
const estado = Engine.criarEstadoInicial(CONFIG);

console.log(Engine.resumoEstado(estado));
console.log("");

// ---- Conferencias automaticas ----
let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

console.log("Conferencias:");

const total = estado.aldeias.length;
checa(`total de aldeias = ${CONFIG.teatro.n_aldeias}`, total === CONFIG.teatro.n_aldeias, `tem ${total}`);

const reisA = Engine.aldeiasDe(estado, "A");
const reisB = Engine.aldeiasDe(estado, "B");
const neutras = Engine.aldeiasDe(estado, null);

checa("Rei A tem exatamente 1 aldeia", reisA.length === 1, `tem ${reisA.length}`);
checa("Rei B tem exatamente 1 aldeia", reisB.length === 1, `tem ${reisB.length}`);
checa("2 aldeias com dono", reisA.length + reisB.length === 2);
checa("resto sao neutras", neutras.length === total - 2, `tem ${neutras.length} neutras`);

// NEUTRAS TIPADAS (V1): cada uma tem UM tipo so, com N unidades na faixa
const fmin = CONFIG.neutra.forca_min, fmax = CONFIG.neutra.forca_max;
const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];
const umTipoSo = neutras.every((a) => {
  const tiposComTropa = TIPOS.filter((t) => a.tropas[t] > 0);
  return a.tipo && tiposComTropa.length === 1 && tiposComTropa[0] === a.tipo;
});
checa("cada neutra tem UM tipo so", umTipoSo);
const naFaixa = neutras.every((a) => a.tropas[a.tipo] >= fmin && a.tropas[a.tipo] <= fmax);
checa(`quantidade do tipo dentro de [${fmin}, ${fmax}]`, naFaixa);

// reis comecam SEM tipo, mas COM a guarnicao inicial da CONFIG (rei.tropas_iniciais)
const ti = CONFIG.rei.tropas_iniciais;
const forcaTi = Engine.forcaDe(ti, CONFIG);
checa("reis sem tipo e com a guarnicao inicial da CONFIG",
  reisA[0].tipo === null && Engine.forcaDe(reisA[0].tropas, CONFIG) === forcaTi &&
  reisB[0].tipo === null && Engine.forcaDe(reisB[0].tropas, CONFIG) === forcaTi);

// aldeias dentro do teatro
const t = CONFIG.teatro;
const foraTeatro = estado.aldeias.filter(
  (a) => a.x < t.x0 || a.x >= t.x0 + t.w || a.y < t.y0 || a.y >= t.y0 + t.h
);
checa("todas dentro do teatro", foraTeatro.length === 0,
  foraTeatro.length ? `${foraTeatro.length} fora` : "ok");

// reis em lados opostos (distancia razoavel entre eles)
if (reisA.length && reisB.length) {
  const a = reisA[0], b = reisB[0];
  const dist = Math.round(Math.hypot(a.x - b.x, a.y - b.y));
  checa("reis em lados opostos (distantes)", dist >= Math.min(t.w, t.h) * 0.5,
    `distancia ${dist}`);
}

// nenhuma aldeia repetida na mesma celula
const chaves = new Set(estado.aldeias.map((a) => a.x + "," + a.y));
checa("sem aldeias sobrepostas", chaves.size === total);

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
