// sonda_casos.js — escolhe, nas partidas gravadas, os TURNOS-TESTE da sonda
// P4 x P5: momentos em que o Rei errou de um jeito que o P5 pretende tocar.
//
// Cada caso e (partida, turno, lado) + a categoria + o que o Rei fez de facto
// (avaliado pelo motor). O gabarito e escrito ANTES de perguntar a qualquer
// modelo: a sonda so compara P4 e P5 nestes turnos.
//
//   ja_perdia          ordenou um ataque que ja perdia na hora da ordem
//   reforco_visivel    atacou um alvo com um exercito inimigo a caminho, a vista
//   apos_falha         o turno a seguir a um ataque falhado (o feedback importa)
//   retaguarda_parada  >= 20 tropas na retaguarda e moveu < 10% delas
//
// uso: node sonda_casos.js <saida.json> <por_categoria_por_modelo> <partidas.txt...>
"use strict";
const fs = require("fs");
const path = require("path");
const { carregarMotorP5 } = require("./p5_prototipo.js");
const { carregar, avaliar } = require("./sonda_comum.js");

const [saida, porCatStr, ...partidas] = process.argv.slice(2);
if (!saida || !partidas.length) {
  console.error("uso: node sonda_casos.js <saida.json> <por_categoria_por_modelo> <partidas.txt...>");
  process.exit(1);
}
const porCat = Number(porCatStr) || 3;
const E = carregarMotorP5();
const todos = [];
for (const f of partidas) {
  const P = carregar(f);
  const modelo = {};
  for (const l of ["A", "B"]) modelo[l] = (new RegExp("Rei " + l + " \\(([^)]+)\\)").exec(P.txt) || [])[1];
  const falhouEm = { A: new Set(), B: new Set() };
  for (let t = 1; t <= P.maxT; t++) {
    for (const lado of ["A", "B"]) {
      const j = P.jog[t + lado];
      if (!j) continue;
      const r = avaliar(E, P, t, lado, { construir: j.construir, envios: j.envios });
      if (r.perderam) falhouEm[lado].add(t + 1);   // o turno seguinte ja traz o relato
      const cats = [];
      if (r.jaPerdiam) cats.push("ja_perdia");
      if (r.contraReforcoVisivel) cats.push("reforco_visivel");
      if (falhouEm[lado].has(t)) cats.push("apos_falha");
      if (r.retaguardaTropas >= 20 && r.retaguardaMovida / r.retaguardaTropas < 0.1) cats.push("retaguarda_parada");
      for (const c of cats) todos.push({ partida: path.basename(f), caminho: path.resolve(f), turno: t, lado, modelo: modelo[lado], categoria: c, original: r });
    }
  }
}
// ate N por (modelo, categoria), espalhados pela partida
const grupos = {};
for (const c of todos) (grupos[c.modelo + "|" + c.categoria] = grupos[c.modelo + "|" + c.categoria] || []).push(c);
const escolhidos = [];
for (const k of Object.keys(grupos).sort()) {
  const g = grupos[k];
  const passo = Math.max(1, Math.floor(g.length / porCat));
  for (let i = 0; i < g.length && escolhidos.filter((x) => x.modelo + "|" + x.categoria === k).length < porCat; i += passo) escolhidos.push(g[i]);
  console.log(`${k.padEnd(60)} ${String(g.length).padStart(3)} candidatos -> ${escolhidos.filter((x) => x.modelo + "|" + x.categoria === k).length}`);
}
fs.writeFileSync(saida, JSON.stringify(escolhidos, null, 1));
console.log(`\n${escolhidos.length} casos gravados em ${saida}`);
