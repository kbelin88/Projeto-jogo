// ============================================================
//  test_camera_roteiro.js  —  TESTE DO ROTEIRO DA CAMERA
// ============================================================
// Rodar:  node test_camera_roteiro.js
//
// Confere o que o roteiro da camera pede:
//   - t exato num keyframe retorna a pose dele
//   - interpolacao linear a meio combina alvo e dist
//   - easing suave (cubic) difere de linear a 25%
//   - mesmo t retorna sempre o mesmo resultado
//   - angulos com wrapping (350->10) passam por 0
//   - antes/depois dos limites fica fixo
//   - alvo por aldeia resolve via callback
//   - roteiro invalido lanca Error
// ============================================================
"use strict";
const assert = require("assert");
const { validarRoteiro, poseNoTempo, ELEVACAO_PADRAO } = require("../camera-roteiro.js");

let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

// ---------------------------------------------------------
//  1) T EXATO NUM KEYFRAME DA A POSE DELE
// ---------------------------------------------------------
console.log("1) T exato num keyframe retorna a pose dele:");
const rot1 = validarRoteiro({
  keyframes: [
    { t: 0, alvo: [100, 0, 200], dist: 500, angulo: 45 },
    { t: 10, alvo: [200, 0, 300], dist: 600, angulo: 90 }
  ]
});

const pose1a = poseNoTempo(rot1, 0, null);
checa("t=0: alvo exato",
  pose1a.alvo[0] === 100 && pose1a.alvo[1] === 0 && pose1a.alvo[2] === 200,
  `alvo [${pose1a.alvo}]`);
checa("t=0: dist exato", pose1a.dist === 500, `dist ${pose1a.dist}`);
checa("t=0: angulo exato", pose1a.angulo === 45, `ang ${pose1a.angulo}`);

const pose1b = poseNoTempo(rot1, 10, null);
checa("t=10: alvo exato",
  pose1b.alvo[0] === 200 && pose1b.alvo[1] === 0 && pose1b.alvo[2] === 300,
  `alvo [${pose1b.alvo}]`);
checa("t=10: dist exato", pose1b.dist === 600, `dist ${pose1b.dist}`);
checa("t=10: angulo exato", pose1b.angulo === 90, `ang ${pose1b.angulo}`);

// ---------------------------------------------------------
//  2) T A MEIO COM EASING LINEAR DA O MEIO DO ALVO E DIST
// ---------------------------------------------------------
console.log("\n2) T a meio com easing linear:");
const rot2 = validarRoteiro({
  keyframes: [
    { t: 0, alvo: [0, 0, 0], dist: 100, angulo: 0, easing: "linear" },
    { t: 10, alvo: [100, 50, 200], dist: 200, angulo: 180, easing: "linear" }
  ]
});

const pose2 = poseNoTempo(rot2, 5, null);
checa("t=5: alvo meio (x=50)", pose2.alvo[0] === 50, `x=${pose2.alvo[0]}`);
checa("t=5: alvo meio (y=25)", pose2.alvo[1] === 25, `y=${pose2.alvo[1]}`);
checa("t=5: alvo meio (z=100)", pose2.alvo[2] === 100, `z=${pose2.alvo[2]}`);
checa("t=5: dist meio (150)", pose2.dist === 150, `dist=${pose2.dist}`);

// ---------------------------------------------------------
//  3) EASING SUAVE A 25% DIFERE DE LINEAR
// ---------------------------------------------------------
console.log("\n3) Easing suave a 25% difere de linear:");
const rot3linear = validarRoteiro({
  keyframes: [
    { t: 0, alvo: [0, 0, 0], dist: 100, angulo: 0, easing: "linear" },
    { t: 100, alvo: [1000, 0, 0], dist: 1000, angulo: 180, easing: "linear" }
  ]
});

const rot3suave = validarRoteiro({
  keyframes: [
    { t: 0, alvo: [0, 0, 0], dist: 100, angulo: 0, easing: "suave" },
    { t: 100, alvo: [1000, 0, 0], dist: 1000, angulo: 180, easing: "suave" }
  ]
});

const pose3linear = poseNoTempo(rot3linear, 25, null);
const pose3suave = poseNoTempo(rot3suave, 25, null);

const difX = Math.abs(pose3linear.alvo[0] - pose3suave.alvo[0]);
const difDist = Math.abs(pose3linear.dist - pose3suave.dist);
checa("x Linear != x Suave a 25%", difX > 1, `linear=${pose3linear.alvo[0]}, suave=${pose3suave.alvo[0]}, dif=${difX}`);
checa("dist Linear != dist Suave a 25%", difDist > 1, `linear=${pose3linear.dist}, suave=${pose3suave.dist}, dif=${difDist}`);

// ---------------------------------------------------------
//  4) MESMO T DUAS VEZES DA RESULTADO IDENTICO
// ---------------------------------------------------------
console.log("\n4) Mesmo T duas vezes retorna identico (deepStrictEqual):");
const rot4 = validarRoteiro({
  keyframes: [
    { t: 0, alvo: [10, 20, 30], dist: 500, angulo: 45, elevacao: 30 },
    { t: 100, alvo: [200, 40, 300], dist: 700, angulo: 270, elevacao: 50 }
  ]
});

const pose4a = poseNoTempo(rot4, 33.5, null);
const pose4b = poseNoTempo(rot4, 33.5, null);

try {
  assert.deepStrictEqual(pose4a, pose4b);
  checa("resultado identico para mesmo t", true);
} catch (e) {
  checa("resultado identico para mesmo t", false, e.message);
}

// ---------------------------------------------------------
//  5) ANGULO 350->10 PASSA POR 0, NAO 180
// ---------------------------------------------------------
console.log("\n5) Angulo 350->10 passa por 0 (wrapping):");
const rot5 = validarRoteiro({
  keyframes: [
    { t: 0, alvo: [0, 0, 0], dist: 100, angulo: 350 },
    { t: 100, alvo: [0, 0, 0], dist: 100, angulo: 10 }
  ]
});

const pose5meio = poseNoTempo(rot5, 50, null);
// A meio entre 350 e 10 (diferenca = 20 graus), passando por 0, o angulo deve ser ~360 ou ~0
// O codigo interpola como: A.angulo + difAngulo(A.angulo, B.angulo) * u
// difAngulo(350, 10) deve ser 20 (pelo caminho curto), entao a meio seria 350 + 20*0.5 = 360 mod 360 = 0
const angNorm = ((pose5meio.angulo % 360) + 360) % 360;
const perto0 = (angNorm < 10 || angNorm > 350);
const perto180 = (angNorm > 170 && angNorm < 190);
checa("angulo a meio perto de 0, nao 180", perto0 && !perto180, `angulo=${pose5meio.angulo}, norm=${angNorm}`);

// ---------------------------------------------------------
//  6) ANTES DO 1.O KEYFRAME FICA NO 1.O, DEPOIS DO ULTIMO FICA NO ULTIMO
// ---------------------------------------------------------
console.log("\n6) Limites (antes/depois) ficam fixos:");
const rot6 = validarRoteiro({
  keyframes: [
    { t: 10, alvo: [100, 0, 100], dist: 500, angulo: 90, elevacao: 45 },
    { t: 20, alvo: [200, 0, 200], dist: 600, angulo: 180, elevacao: 50 }
  ]
});

const poseBefore = poseNoTempo(rot6, -5, null);
const poseAfter = poseNoTempo(rot6, 1000, null);

checa("t=-5 fica no 1.o keyframe",
  poseBefore.alvo[0] === 100 && poseBefore.dist === 500,
  `alvo=[${poseBefore.alvo}], dist=${poseBefore.dist}`);
checa("t=1000 fica no ultimo keyframe",
  poseAfter.alvo[0] === 200 && poseAfter.dist === 600,
  `alvo=[${poseAfter.alvo}], dist=${poseAfter.dist}`);

// ---------------------------------------------------------
//  7) ALVO POR ALDEIA USA RESOLVEDOR
// ---------------------------------------------------------
console.log("\n7) Alvo por aldeia resolve via callback:");
const rot7 = validarRoteiro({
  keyframes: [
    { t: 0, alvo: "lisboa", dist: 500, angulo: 0 },
    { t: 10, alvo: "faro", dist: 600, angulo: 90 }
  ]
});

const mapa = {
  "lisboa": [1000, 0, 2000],
  "faro": [500, 0, 1000]
};
const resolvedor = (alvo) => mapa[alvo];

const pose7a = poseNoTempo(rot7, 0, resolvedor);
const pose7b = poseNoTempo(rot7, 10, resolvedor);

checa("t=0: alvo 'lisboa' resolvido",
  pose7a.alvo[0] === 1000 && pose7a.alvo[2] === 2000,
  `alvo=[${pose7a.alvo}]`);
checa("t=10: alvo 'faro' resolvido",
  pose7b.alvo[0] === 500 && pose7b.alvo[2] === 1000,
  `alvo=[${pose7b.alvo}]`);

// ---------------------------------------------------------
//  8) ROTEIRO INVALIDO LANCA ERROR COM MENSAGEM CLARA
// ---------------------------------------------------------
console.log("\n8) Roteiro invalido lanca Error:");

const casos8 = [
  { nome: "keyframes vazio", rot: { keyframes: [] }, esperado: "pelo menos 1 keyframe" },
  { nome: "t nao crescente", rot: { keyframes: [
      { t: 10, alvo: [0, 0, 0], dist: 100, angulo: 0 },
      { t: 5, alvo: [0, 0, 0], dist: 100, angulo: 0 }
    ] }, esperado: "maior que o do keyframe anterior" },
  { nome: "dist <= 0", rot: { keyframes: [
      { t: 0, alvo: [0, 0, 0], dist: 0, angulo: 0 }
    ] }, esperado: "numero > 0" },
  { nome: "easing desconhecido", rot: { keyframes: [
      { t: 0, alvo: [0, 0, 0], dist: 100, angulo: 0, easing: "saltarpelo" }
    ] }, esperado: "desconhecido" },
  { nome: "alvo [x,y] com 2 numeros", rot: { keyframes: [
      { t: 0, alvo: [100, 200], dist: 100, angulo: 0 }
    ] }, esperado: "[x,y,z] com 3 numeros" }
];

casos8.forEach(({ nome, rot, esperado }) => {
  try {
    validarRoteiro(rot);
    checa(nome, false, "nao lancou erro");
  } catch (e) {
    const temMsg = e.message && e.message.includes(esperado);
    checa(nome, temMsg, `msg: "${e.message}"`);
  }
});

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
