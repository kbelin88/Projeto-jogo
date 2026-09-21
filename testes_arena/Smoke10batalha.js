// Smoke10batalha.js — as regras da cena de batalha, trancadas.
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Três defeitos vistos pelo Lucas no replay, os três medidos no jogo a correr:
//   1. "em algumas estradas a batalha não acontece" — num turno cheio há 10
//      combates e só cabem 6 cenas; os outros não tinham nada. Agora o
//      MARCADOR nasce sempre, mesmo sem figuras (`soMarca`).
//   2. "a tropa fica parada depois" — o rescaldo deixava os sobreviventes de
//      pé. Agora ficam só os mortos e o vencedor volta a marchar.
//   3. as colunas em combate atravessavam-se por cima da cena — quem está a
//      lutar sai do desenho da marcha (`emLuta` / `aLutar`).
//
// Isto é um teste de LEITURA: não há WebGL no Node. Tranca a intenção no
// código, que é o que costuma regredir quando se mexe ao lado.
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const batalha = fs.readFileSync(path.join(RAIZ, "sonda3d", "batalha.js"), "utf8");
const mapa = fs.readFileSync(path.join(RAIZ, "sonda3d", "mapa3d.js"), "utf8");
const jogo = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");

let falhas = 0;
const conferir = (ok, msg) => {
  if (!ok) { falhas++; console.error("FALHOU: " + msg); } else console.log("ok: " + msg);
};

// 1. todo combate ganha marcador, mesmo sem cena
conferir(/soMarca/.test(batalha),
  "ha combates so com marcador (`soMarca`) quando o teto de cenas enche");
conferir(/MAX_VIVAS/.test(batalha) && /MAX_MARCAS/.test(batalha),
  "ha um teto para as cenas e outro para os marcadores");

// 2. no rescaldo ficam só os mortos
conferir(/rescaldo[\s\S]{0,900}filter\(\(f\) => \{[\s\S]{0,200}if \(f\.caido\) return true;/.test(batalha),
  "no rescaldo so os caidos ficam (os de pe saem da cena)");

// 3. quem luta não marcha
conferir(/emLuta/.test(batalha) && /aLutar/.test(batalha),
  "a cena diz ao mapa quem esta a lutar (`aLutar`)");
conferir(/batalhas\.aLutar\(m\.dono, m\.de, m\.para\)/.test(mapa),
  "o mapa nao desenha a marcha de quem esta a lutar");

// 4. a memória de combates já fechados não cresce para sempre
conferir(/const feitas = new Map\(\)/.test(batalha) && /MEMORIA_MS/.test(batalha),
  "a lista de combates ja feitos esquece os antigos");

// 5. a câmara é do jogador; há teclas para a emprestar
conferir(/let seguirCena = false/.test(mapa),
  "a camara automatica nasce DESLIGADA (o jogador manda nela)");
conferir(/seguirBatalhas/.test(jogo) && /verBatalha/.test(jogo),
  "o jogo tem as teclas B (seguir) e V (ir ver) ligadas ao mapa");

if (falhas) { console.error("\n" + falhas + " falha(s)"); process.exit(1); }
console.log("\nSmoke10batalha: as regras da cena de batalha estao no sitio");
