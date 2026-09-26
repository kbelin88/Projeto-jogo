// sonda_pareada.js — P5 contra P4 CASO A CASO (o mesmo turno, as mesmas N
// respostas por prompt), com teste de sinais bilateral. A tabela da sonda soma
// tudo; aqui ve-se se a diferenca vem de muitos casos ou de uma resposta so.
//
// uso: node sonda_pareada.js <resultado.json> [--comparar P4 P5]
"use strict";
const fs = require("fs");
const args = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(args[0], "utf8"));
const i = args.indexOf("--comparar");
const [A, B] = i >= 0 ? [args[i + 1], args[i + 2]] : ["P4", "P5"];
const res = (d.res || d).filter((r) => r.aval);
const casos = [...new Set(res.map((r) => r.caso))].sort((x, y) => x - y);
// P(X <= k) e (X >= n-k) com X ~ Bin(n, 1/2)
function sinais(pos, neg) {
  const n = pos + neg, k = Math.min(pos, neg);
  let c = 1, p = 0;
  for (let j = 0; j <= k; j++) { p += c; c = c * (n - j) / (j + 1); }
  return n ? Math.min(1, 2 * p / Math.pow(2, n)) : 1;
}
const media = (l, f) => l.length ? l.reduce((s, r) => s + f(r.aval), 0) / l.length : 0;
const metr = {
  "saldo V-D no turno seguinte": (a) => a.venceram - a.perderam,
  "ataques que ja perdiam": (a) => a.jaPerdiam,
  "ataques": (a) => a.ataques,
  "grupos convergentes": (a) => a.gruposConvergentes,
};
console.log(`${d.modelo || ""}  itens: ${(d.itens || []).join(",")}  |  ${casos.length} casos, ${B} - ${A} por caso (media das respostas)`);
for (const [nome, f] of Object.entries(metr)) {
  let pos = 0, neg = 0, soma = 0;
  const difs = [];
  for (const c of casos) {
    const dif = media(res.filter((r) => r.caso === c && r.prompt === B), f) - media(res.filter((r) => r.caso === c && r.prompt === A), f);
    difs.push(dif); soma += dif;
    if (dif > 1e-9) pos++; else if (dif < -1e-9) neg++;
  }
  console.log(`  ${nome.padEnd(28)} soma ${soma >= 0 ? "+" : ""}${soma.toFixed(1).padStart(5)} | casos ${B} acima ${pos}, abaixo ${neg}, iguais ${casos.length - pos - neg} | sinais p=${sinais(pos, neg).toFixed(2)}`);
}
