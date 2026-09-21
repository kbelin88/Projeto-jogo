// Smoke11hover.js — O QUE O BALAO DIZ E O QUE ESTA DEBAIXO DO RATO.
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// O hover media a posicao das aldeias com `SX`/`SY`, que era a camara do canvas
// plano. Desde 11/09 essa camara esta PARADA no sitio onde o jogo abriu — nada
// a mexe e nada a pinta. Medido em 22/09, com a camara 3D sobre Barcelona: o
// balao no centro do ecra dizia "Lisboa". Nao e um desalinhamento de pixeis, e
// duas camaras diferentes.
//
// Depois de corrigido, seis aldeias apontadas, seis nomes certos. Este teste
// tranca a regra que o torna possivel: quem quer saber onde uma coisa aparece
// no ecra pergunta ao MAPA QUE ESTA NO ECRA.
//
// E um teste de LEITURA: nao ha WebGL no Node.
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const jogo = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
const mapa = fs.readFileSync(path.join(RAIZ, "sonda3d", "mapa3d.js"), "utf8");

let falhas = 0;
const conferir = (ok, msg) => {
  if (!ok) { falhas++; console.error("FALHOU: " + msg); } else console.log("ok: " + msg);
};

const hover = (jogo.match(/ {2}function atualizarHover\(e\)[\s\S]*?\n {2}\}/) || [])[0];
if (!hover) {
  console.error("FALHOU: nao achei atualizarHover no index.html.");
  console.error("Se mudou de nome, ATUALIZE este smoke — nao o apague.");
  process.exit(1);
}
conferir(true, "achou o atualizarHover");

conferir(/M3D\.ecraDoMundo\(/.test(hover),
  "o hover projeta com a camara do mapa 3D (`M3D.ecraDoMundo`)");
conferir(!/\bSX\(|\bSY\(/.test(hover),
  "o hover NAO usa SX/SY (a camara plana, que esta parada desde 11/09)");
conferir(/if \(!game \|\| !M3D\)/.test(hover),
  "sem mapa nao ha balao (em vez de apontar com uma camara que nao existe)");

// a marcha tem de sair da MESMA conta do motor que a ponte usa
const ponto = (jogo.match(/ {2}function pontoDaMarcha\(m\)[\s\S]*?\n {2}\}/) || [])[0] || "";
conferir(/Engine\.posicaoRota/.test(ponto) && /progMarcha\(m\)/.test(ponto),
  "a marcha apontada e a do MOTOR (posicaoRota + progMarcha), nao um palpite");

// e a camara nao pode ficar envenenada por um ecra de tamanho zero
conferir(/if \(!\(w > 0 && h > 0\)\) return;/.test(mapa),
  "um ecra 0x0 nao envenena a matriz de projecao com NaN");

if (falhas) { console.error("\n" + falhas + " falha(s)"); process.exit(1); }
console.log("\nSmoke11hover: o balao le o mapa que esta no ecra");
