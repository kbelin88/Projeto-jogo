// Smoke9tropas.js — UM SÓ DESENHO DE TROPA.
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Até 22/09 o mapa tinha dois desenhos de soldado: o poço de figuras com
// esqueleto (os modelos novos do ComfyUI) e um símbolo rígido instanciado que
// usava as peças assadas no `pecas.glb` — os modelos ANTIGOS. Quando o poço
// esgotava, o resto da coluna saía com o feitio velho. Medido no jogo a correr:
// 56 figuras novas e 4 antigas ao mesmo tempo, em 410 de 410 amostras.
//
// A regra passou a ser: acabando o poço, mostram-se MENOS figuras — nunca
// figuras de outro feitio. Este teste tranca as três pontas dessa regra, sem
// precisar de WebGL: lê o código e a saída do forno.
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
let falhas = 0;
const conferir = (ok, msg) => {
  if (!ok) { falhas++; console.error("FALHOU: " + msg); }
  else console.log("ok: " + msg);
};

// 1. o mapa não pode voltar a ter o símbolo rígido de tropa
const mapa = fs.readFileSync(path.join(RAIZ, "sonda3d", "mapa3d.js"), "utf8");
conferir(!/tropaInst/.test(mapa),
  "sonda3d/mapa3d.js nao tem `tropaInst` (o simbolo rigido dos soldados antigos)");
conferir(/figurasAntigas/.test(mapa),
  "o diagnostico expoe `figurasAntigas` (o numero que tem de ser sempre zero)");

// 2. as tropas do jogo são os GLB novos
for (const tipo of ["lanceiro", "arqueiro", "cavaleiro"]) {
  conferir(new RegExp(tipo + "_novo\\.glb").test(mapa),
    "o mapa carrega " + tipo + "_novo.glb");
}

// 3. o forno não volta a assar peças de soldado
const forno = fs.readFileSync(
  path.join(RAIZ, "ferramentas", "cena", "exportar_mapa.py"), "utf8");
conferir(!/P\.proto_lanceiro|P\.proto_arqueiro|P\.proto_cavaleiro/.test(forno),
  "o forno nao assa pecas de soldado (proto_lanceiro e companhia)");

// 4. e o mapa cozido, se existir nesta máquina, não as tem
const jsonMapa = path.join(RAIZ, "sonda3d", "mapa3d.json");
if (fs.existsSync(jsonMapa)) {
  const m = JSON.parse(fs.readFileSync(jsonMapa, "utf8"));
  const pecas = Object.keys(m.pecas || {});
  const soldados = pecas.filter((p) => /^(lanceiro|arqueiro|cavaleiro)$/.test(p));
  conferir(soldados.length === 0,
    "mapa3d.json sem pecas de soldado (achadas: " + (soldados.join(", ") || "nenhuma") + ")");
} else {
  console.log("(mapa3d.json nao esta nesta maquina — e saida de forno, fora do git)");
}

if (falhas) { console.error("\n" + falhas + " falha(s)"); process.exit(1); }
console.log("\nSmoke9tropas: um so desenho de tropa, confirmado");
