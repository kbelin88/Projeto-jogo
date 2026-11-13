// test_mapa_usa.js — o segundo mapa (world-usa.js) e justo para os QUATRO lugares.
//
// O que tranca:
//   1. verificarEquilibrio() = 0: os tres espelhos (EO, NS e a rotacao) levam
//      estrada a estrada, com o mesmo custo, e capital a capital;
//   2. os numeros que o guia e o docs/MAPA_USA.md dizem (45 cidades, 72 estradas,
//      capitais vizinhas a 11, capitais de costas opostas a 26 e 27);
//   3. cada capital tem o mesmo "quintal": 9 cidades mais perto dela do que de
//      qualquer outra, e as 9 de eixo empatadas entre quem as partilha;
//   4. nenhuma estrada cruza outra no desenho (em linha reta, sem pontas comuns);
//   5. a verificacao APANHA um mapa torto (senao um 0 nao queria dizer nada);
//   6. o mapa da Iberia nao foi tocado: continua a dar 0.
"use strict";
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const U = require(path.join(RAIZ, "world-usa.js"));
const I = require(path.join(RAIZ, "world-iberia.js"));

let falhas = 0;
function t(nome, fn) {
  try { fn(); console.log("  ok  " + nome); }
  catch (e) { falhas++; console.log("FALHA " + nome + "\n      " + e.message); }
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperava ${b}, veio ${a}`); }

t("verificarEquilibrio() devolve 0 falhas", () => {
  const f = U.verificarEquilibrio();
  if (f.length) throw new Error(f.slice(0, 5).join(" | "));
});

t("45 cidades, 72 estradas, 4 capitais, 1 centro", () => {
  igual(U.CIDADES.length, 45, "cidades");
  igual(U.ESTRADAS.length, 72, "estradas");
  igual(U.CIDADES.filter((c) => c.papel === "capital").length, 4, "capitais");
  igual(U.CIDADES.filter((c) => c.dono).length, 4, "cidades com dono");
  igual(U.CIDADES.filter((c) => c.papel === "centro").length, 1, "centro");
  igual(new Set(U.CIDADES.map((c) => c.id)).size, 45, "ids distintos");
});

t("a rede e uma so, e cada capital tem duas saidas (como na Iberia)", () => {
  for (const c of U.CIDADES) if (!U.rota("seattle", c.id)) throw new Error("sem rota para " + c.id);
  for (const k of Object.values(U.MAPA.capitais)) igual(U.VIZINHOS[k].length, 2, "saidas de " + k);
  igual(I.VIZINHOS.lisboa.length, 2, "saidas de Lisboa");
});

t("distancias entre capitais: 11 pela costa, 26 e 27 de costa a costa", () => {
  const d = (a, b) => U.rota(a, b).custo;
  igual(d("seattle", "los_angeles"), 11, "Seattle-Los Angeles");
  igual(d("new_york", "miami"), 11, "New York-Miami");
  igual(d("seattle", "new_york"), 26, "Seattle-New York");
  igual(d("los_angeles", "miami"), 26, "Los Angeles-Miami");
  igual(d("seattle", "miami"), 27, "Seattle-Miami");
  igual(d("los_angeles", "new_york"), 27, "Los Angeles-New York");
});

t("cada capital tem o mesmo quintal: 9 cidades so dela; as 9 de eixo sao partilhadas", () => {
  const caps = Object.values(U.MAPA.capitais), conta = {}; let empatadas = 0;
  for (const c of U.CIDADES) {
    const ds = caps.map((k) => c.custoCapital[k]), m = Math.min(...ds);
    const donos = caps.filter((k, i) => ds[i] === m);
    if (donos.length > 1) { empatadas++; if (c.quadrante !== "eixo") throw new Error(c.id + " empata e nao e de eixo"); }
    else conta[donos[0]] = (conta[donos[0]] || 0) + 1;
  }
  for (const k of caps) igual(conta[k], 9, "quintal de " + k);
  igual(empatadas, 9, "cidades partilhadas");
});

t("as tres divisoes em equipas trocam-se pelo espelho que dizem", () => {
  const porId = {}; for (const c of U.CIDADES) porId[c.id] = c;
  for (const nome in U.MAPA.equipas) {
    const e = U.MAPA.equipas[nome];
    const s = (id) => e.espelho === "EO" ? porId[id].espelhoEO : porId[id].espelhoNS;
    const a = e.a.map((r) => U.MAPA.capitais[r]), b = e.b.map((r) => U.MAPA.capitais[r]);
    const img = a.map(s).sort().join(","), alvo = b.slice().sort().join(",");
    if (img !== alvo) throw new Error(`${nome}: o espelho ${e.espelho} leva ${a} a ${img}, e nao a ${alvo}`);
  }
});

t("nenhuma estrada cruza outra no desenho", () => {
  const P = {}; for (const c of U.CIDADES) P[c.id] = c;
  const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
  const cruza = (a, b, c, d) => ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(a, b, c) * ccw(a, b, d) < 0;
  const X = [];
  for (let i = 0; i < U.ESTRADAS.length; i++) for (let j = i + 1; j < U.ESTRADAS.length; j++) {
    const e = U.ESTRADAS[i], f = U.ESTRADAS[j];
    if ([e.de, e.para].some((k) => k === f.de || k === f.para)) continue;
    if (cruza(P[e.de], P[e.para], P[f.de], P[f.para])) X.push(`${e.de}-${e.para} x ${f.de}-${f.para}`);
  }
  if (X.length) throw new Error(X.join("; "));
});

t("nenhuma estrada e mais curta do que 70 unidades (o alcance de estrada e 30)", () => {
  const P = {}; for (const c of U.CIDADES) P[c.id] = c;
  for (const e of U.ESTRADAS) {
    const d = Math.hypot(P[e.de].x - P[e.para].x, P[e.de].y - P[e.para].y);
    if (d < 70) throw new Error(`${e.de}-${e.para} tem ${d.toFixed(0)}`);
  }
});

t("a verificacao apanha um mapa torto (um custo mexido, uma estrada a mais)", () => {
  const e = U.ESTRADAS.find((x) => x.de === "seattle" && x.para === "portland");
  const antes = e.custo;
  e.custo = antes + 0.5;
  const f1 = U.verificarEquilibrio().length;
  e.custo = antes;
  if (!f1) throw new Error("um custo mexido passou");
  U.ESTRADAS.push({ de: "seattle", para: "boise", custo: 2 });
  const f2 = U.verificarEquilibrio().length;
  U.ESTRADAS.pop();
  if (!f2) throw new Error("uma estrada a mais passou");
  igual(U.verificarEquilibrio().length, 0, "depois de repor");
});

t("a Iberia continua a dar 0", () => igual(I.verificarEquilibrio().length, 0, "falhas da Iberia"));

if (falhas) { console.log(`\n${falhas} FALHA(S)`); process.exit(1); }
console.log("\ntest_mapa_usa: tudo verde");
