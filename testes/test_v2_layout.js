// test_v2_layout.js — MUNDO v2 (17/07): invariantes do layout espelhado.
// Regras aprovadas: espelho total (posicao+tipo+forca), 24 aldeias,
// 2 portas por rei, reis no eixo horizontal a >= 70% da largura,
// determinismo por seed, e a v1 preservada atras da flag.
const E = require("../engine.js");

const v2c = E.CONFIG.teatro_v2;
const t = { x0: v2c.x0 != null ? v2c.x0 : E.CONFIG.teatro.x0,
            y0: v2c.y0 != null ? v2c.y0 : E.CONFIG.teatro.y0,
            w: v2c.w || E.CONFIG.teatro.w, h: v2c.h || E.CONFIG.teatro.h };
const x1 = Math.min(200, t.x0 + t.w), y1 = Math.min(200, t.y0 + t.h);
const espX = (x) => t.x0 + (x1 - 1 - x);
const espY = (y) => y; // espelho AXIAL: mesma altura (correcao pos-gate 17/07)
let casos = 0;
function ok(cond, msg) { if (!cond) throw new Error("FALHOU: " + msg); casos++; }

for (const seed of [1, 7, 42, 99, 123]) {
  const g = E.gerarTeatro(Object.assign({}, E.CONFIG, { seed }));
  const alds = g.aldeias;
  ok(alds.length === 24, "seed " + seed + ": 24 aldeias (veio " + alds.length + ")");

  const A = alds.find((a) => a.dono === "A"), B = alds.find((a) => a.dono === "B");
  ok(A && B, "seed " + seed + ": dois reis");
  ok(B.x === espX(A.x) && B.y === espY(A.y), "seed " + seed + ": reis espelhados");
  ok(B.y === A.y, "seed " + seed + ": reis na MESMA altura (eixo horizontal)");
  ok(A.x < t.x0 + t.w / 2, "seed " + seed + ": rei A na metade oeste");
  const d = Math.hypot(A.x - B.x, A.y - B.y);
  ok(d >= t.w * E.CONFIG.teatro_v2.dist_rei_min,
    "seed " + seed + ": reis a " + d.toFixed(1) + " >= " + (100 * E.CONFIG.teatro_v2.dist_rei_min) + "% da largura");

  // espelho total das neutras: posicao, tipo e forca
  const neutras = alds.filter((a) => !a.dono);
  ok(neutras.length === 22, "seed " + seed + ": 22 neutras");
  for (const n of neutras) {
    const m = neutras.find((o) => o.x === espX(n.x) && o.y === espY(n.y));
    ok(!!m, "seed " + seed + ": neutra " + n.x + "," + n.y + " tem espelho");
    ok(m.tipo === n.tipo && m.tropas[m.tipo] === n.tropas[n.tipo],
      "seed " + seed + ": espelho com mesmo tipo/forca");
  }

  // portas: >= 2 neutras a distancia <= 7.5 do rei A (e por espelho, do B)
  const portas = neutras.filter((n) => Math.hypot(n.x - A.x, n.y - A.y) <= 7.5);
  ok(portas.length >= 2, "seed " + seed + ": " + portas.length + " portas do rei A (minimo 2)");

  // espacamento minimo entre todas
  for (let i = 0; i < alds.length; i++)
    for (let j = i + 1; j < alds.length; j++) {
      const dd = Math.hypot(alds[i].x - alds[j].x, alds[i].y - alds[j].y);
      ok(dd >= E.CONFIG.teatro_v2.min_dist, "seed " + seed + ": par " + i + "/" + j + " a " + dd.toFixed(1));
    }

  // determinismo: mesma seed, mesmo mundo (byte a byte)
  const g2 = E.gerarTeatro(Object.assign({}, E.CONFIG, { seed }));
  ok(JSON.stringify(g2.aldeias) === JSON.stringify(alds), "seed " + seed + ": deterministico");
}

// regressao v1: a flag antiga segue produzindo o mundo antigo (20 aldeias,
// reis por diagonal) — os numeros historicos continuam reproduziveis.
const gv1 = E.gerarTeatro(Object.assign({}, E.CONFIG, { seed: 1, layout: "v1" }));
ok(gv1.aldeias.length === 20, "v1 preservada: 20 aldeias");
ok(gv1.aldeias.filter((a) => a.dono).length === 2, "v1 preservada: 2 reis");

console.log("TEST V2 LAYOUT OK (" + casos + " verificacoes, 5 seeds + regressao v1)");
