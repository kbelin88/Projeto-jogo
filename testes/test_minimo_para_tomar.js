// ============================================================
//  test_minimo_para_tomar.js  —  minimoParaTomar (motor)
// ------------------------------------------------------------
//  Rodar:  node testes/test_minimo_para_tomar.js
//
//  minimoParaTomar(estado, atkType, alvo) = menor numero de tropas do
//  tipo atkType que CONQUISTA o alvo, usando preverCombateTipos (a MESMA
//  conta do combate). Este teste ANCORA os valores contra uma tabela de
//  referencia calculada a mao a partir da CONFIG atual:
//    neutra = 1 tropa, bonus_defesa_aldeia 1.25, bonus_defesa_castelo 1.5,
//    bonus_forca_triangulo 1.5, triangulo lanceiro>cavaleiro>arqueiro>lanceiro.
//  Se um valor divergir, o motor mudou de comportamento — o teste FALHA e
//  mostra o valor obtido (nao se ajusta a tabela).
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;

let falhas = 0;
function checa(nome, obtido, esperado) {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}  -> obtido ${obtido} | esperado ${esperado}`);
}

// estado real so p/ a CONFIG (triangulo, bonus, forcas); os alvos sao
// sinteticos — minimoParaTomar consome o objeto alvo direto, nao por id.
const estado = Engine.criarEstadoInicial(CONFIG);

// ---------- (A) NEUTRAS: fortaleza de 1 tropa de um tipo so ----------
// Tabela de referencia (linhas = tipo da neutra; colunas = tipo atacante):
//   alvo                 lanceiro  arqueiro  cavaleiro
//   neutra de lanceiro      2         1         2
//   neutra de arqueiro      2         2         1
//   neutra de cavaleiro     1         2         2
console.log("=== (A) neutras (1 tropa, aldeia x1.25) — 9 valores ===");

function neutra(tipo) {
  return {
    id: 900, dono: null, tipo, capital: false,
    tropas: { lanceiro: 0, arqueiro: 0, cavaleiro: 0, [tipo]: 1 },
  };
}

const TAB = {
  lanceiro:  { lanceiro: 2, arqueiro: 1, cavaleiro: 2 },
  arqueiro:  { lanceiro: 2, arqueiro: 2, cavaleiro: 1 },
  cavaleiro: { lanceiro: 1, arqueiro: 2, cavaleiro: 2 },
};

for (const tipoNeutra of ["lanceiro", "arqueiro", "cavaleiro"]) {
  const alvo = neutra(tipoNeutra);
  for (const atk of ["lanceiro", "arqueiro", "cavaleiro"]) {
    checa(`neutra ${tipoNeutra} <- ${atk}`,
      Engine.minimoParaTomar(estado, atk, alvo), TAB[tipoNeutra][atk]);
  }
}

// ---------- (B) CAPITAL inimiga (castelo x1.5) ----------
// 5 lanceiros / 4 arqueiros / 3 cavaleiros -> Fdef 12, dominante lanceiro.
//   lanceiro 19 | arqueiro 13 | cavaleiro 28
console.log("=== (B) capital inimiga (Fdef 12 dom. lanceiro, castelo x1.5) — 3 valores ===");

const capital = {
  id: 800, dono: "A", capital: true,
  tropas: { lanceiro: 5, arqueiro: 4, cavaleiro: 3 },
};
checa("capital <- lanceiro",  Engine.minimoParaTomar(estado, "lanceiro",  capital), 19);
checa("capital <- arqueiro",  Engine.minimoParaTomar(estado, "arqueiro",  capital), 13);
checa("capital <- cavaleiro", Engine.minimoParaTomar(estado, "cavaleiro", capital), 28);

console.log("\n" + (falhas ? `FALHOU: ${falhas} checagem(ns)` : "TODOS OS CASOS PASSARAM"));
process.exit(falhas ? 1 : 0);
