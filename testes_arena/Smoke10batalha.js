// Smoke10batalha.js — as regras da cena de batalha, trancadas.
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Defeitos vistos pelo Lucas no replay, medidos no jogo a correr:
//   1. (23/09) "a barra 1x4 fica no mapa varios turnos" — a cena media-se em
//      SEGUNDOS (5 de luta + 12 de rescaldo = ~8 turnos a 1x) e as barras
//      acumulavam-se. Agora a cena cabe no TURNO: mede-se no relogio do
//      replay, acaba em `fimT`, e nao ha marcador nem rescaldo.
//   2. as colunas em combate atravessavam-se por cima da cena — quem está a
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

// 1. a batalha cabe no turno
const codigo = batalha.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
conferir(!/Sprite|telaMarcador|CanvasTexture/.test(codigo),
  "nao ha marcador (a barra 1x4) por cima da batalha");
conferir(!/RESCALDO/.test(codigo),
  "nao ha rescaldo: quando a cena acaba, a estrada fica limpa");
conferir(/ba\.fimT/.test(codigo) && /relogio - ba\.inicioT/.test(codigo),
  "a cena mede-se no relogio do replay (inicioT -> fimT), nao em segundos");
conferir(/if \(u >= 1 \|\| esquecida\)[\s\S]{0,80}fechar\(ba\)/.test(codigo),
  "a cena fecha quando chega ao fim da janela");
const ponte = fs.readFileSync(path.join(RAIZ, "ponte3d.js"), "utf8");
const P = require(path.join(RAIZ, "ponte3d.js"));
conferir(P.janelaCena(0) <= 1 && P.janelaCena(0.99) <= 0.25 + 1e-9 && P.janelaCena(0.5) <= 0.5,
  "a janela da cena nunca passa de um quarto de turno para la do fim do turno");
conferir(/relogio: relogio\(\)/.test(ponte) && /relogio: relogioReplay/.test(jogo),
  "o jogo passa o relogio do replay ao mapa");
conferir(/batalhas\.passo\(dts, relogioJogo, msPorTurno\)/.test(mapa),
  "o mapa anda a cena com o relogio do jogo");

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
