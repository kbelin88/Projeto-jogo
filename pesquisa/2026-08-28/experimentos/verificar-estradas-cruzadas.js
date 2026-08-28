// verificar-estradas-cruzadas.js — ITEM 1, achado B: estradas DIFERENTES que
// se cruzam no desenho do mapa.
//
// NAO EDITA world-iberia.js nem engine.js — so leitura.
//
// A PERGUNTA: cruzaramNaEstrada (engine.js:1355) so compara exercitos que
// estao no MESMO trecho (mesmo par de cidades). Mas o desenho do mapa (as
// coordenadas x,y das 24 cidades + as 41 estradas) e um grafo com atalhos
// (CLAUDE.md: "MST + k vizinhos + N travessias"), NAO um grafo planar — nada
// impede duas estradas DIFERENTES (arestas diferentes do grafo) de se
// cruzarem geometricamente no desenho. Se isso acontece, dois exercitos
// inimigos podem passar EXATAMENTE pelo mesmo ponto da tela, ao mesmo tempo,
// em estradas logicamente diferentes — visualmente identico a um cruzamento,
// mas cruzaramNaEstrada nunca os compara, porque o teste exige mesmo trecho.
// Isso nao e uma falha de amostragem (H1): e SEMPRE perdido, nao importa a
// frequencia da amostragem, porque o par nunca teria as mesmas (aId,bId).
//
// PASSO 1: acha pares de estradas (arestas sem cidade em comum) cujos
// segmentos de reta se cruzam no mapa.
// PASSO 2: varre os replays contando quantas vezes exercitos INIMIGOS
// ocuparam as duas estradas de um par cruzado NO MESMO TURNO.
//
// USO: node pesquisa/2026-08-28/experimentos/verificar-estradas-cruzadas.js

"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..", "..");
const Iberia = require(path.join(RAIZ, "world-iberia.js"));

const porSlug = {};
for (const c of Iberia.CIDADES) porSlug[c.id] = c;

// ---------------------------------------------------------------------------
// PASSO 1 — estradas que se cruzam no desenho
// ---------------------------------------------------------------------------
function poligono(e) {
  const a = porSlug[e.de], b = porSlug[e.para];
  return [[a.x, a.y], ...(e.via || []), [b.x, b.y]];
}
function segCruza(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

const PARES_CRUZADOS = [];
for (let i = 0; i < Iberia.ESTRADAS.length; i++) {
  for (let j = i + 1; j < Iberia.ESTRADAS.length; j++) {
    const e1 = Iberia.ESTRADAS[i], e2 = Iberia.ESTRADAS[j];
    const nos1 = new Set([e1.de, e1.para]), nos2 = new Set([e2.de, e2.para]);
    if ([...nos1].some((n) => nos2.has(n))) continue; // toca no MESMO no: nao conta
    const poli1 = poligono(e1), poli2 = poligono(e2);
    for (let a = 0; a + 1 < poli1.length; a++) {
      for (let b = 0; b + 1 < poli2.length; b++) {
        if (segCruza(poli1[a], poli1[a + 1], poli2[b], poli2[b + 1])) {
          PARES_CRUZADOS.push({ e1: [e1.de, e1.para], e2: [e2.de, e2.para] });
        }
      }
    }
  }
}

console.log(`estradas que se cruzam no mapa (arestas diferentes, sem cidade em comum): ${PARES_CRUZADOS.length}`);
for (const p of PARES_CRUZADOS) console.log(`  ${p.e1.join("-")}  x  ${p.e2.join("-")}`);
console.log("");

if (!PARES_CRUZADOS.length) { console.log("nenhum par cruzado — item 1-achado-B nao se aplica."); process.exit(0); }

// chave de trecho por SLUG, sem depender de ids numericos (o replay usa ids,
// entao resolvo id->slug por replay a partir de aldeias[].slug)
const chaveSlug = (a, b) => [a, b].sort().join("|");
const TRECHOS_ALVO = new Set();
for (const p of PARES_CRUZADOS) { TRECHOS_ALVO.add(chaveSlug(...p.e1)); TRECHOS_ALVO.add(chaveSlug(...p.e2)); }

// ---------------------------------------------------------------------------
// PASSO 2 — varredura dos replays
// ---------------------------------------------------------------------------
function acharReplays(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) acharReplays(p, out);
    else if (ent.name.endsWith(".replay.json")) out.push(p);
  }
}
const REPLAYS = [];
acharReplays(path.join(RAIZ, "resultados"), REPLAYS);

function chaveTrechoNum(a, b) { return Math.min(a, b) + "|" + Math.max(a, b); }
function pesoTrecho(custoPorTrecho, cidadesPorId, aId, bId) {
  const c = custoPorTrecho[chaveTrechoNum(aId, bId)];
  if (c != null) return c;
  const a = cidadesPorId[aId], b = cidadesPorId[bId];
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) / (Iberia.MAPA.pxPorTurno || 1) : 0;
}
function pesoRota(custoPorTrecho, cidadesPorId, caminho) {
  let p = 0;
  for (let i = 0; i + 1 < caminho.length; i++) p += pesoTrecho(custoPorTrecho, cidadesPorId, caminho[i], caminho[i + 1]);
  return p;
}
function posicaoRota(custoPorTrecho, cidadesPorId, mov) {
  const cam = mov.caminho;
  if (!cam || cam.length < 2) return null;
  const total = pesoRota(custoPorTrecho, cidadesPorId, cam);
  const frac = mov.turnosTotal ? (mov.turnosTotal - mov.turnosRestantes) / mov.turnosTotal : 1;
  let alvo = Math.max(0, frac) * total;
  for (let i = 0; i + 1 < cam.length; i++) {
    const seg = pesoTrecho(custoPorTrecho, cidadesPorId, cam[i], cam[i + 1]);
    if (alvo <= seg || i + 2 === cam.length) return { aId: cam[i], bId: cam[i + 1] };
    alvo -= seg;
  }
  return null;
}

let totalOcorrencias = 0;
const achados = [];

for (const arq of REPLAYS) {
  const r = JSON.parse(fs.readFileSync(arq, "utf8"));
  if (!r.frames || r.frames.length < 2) continue;

  const slugPorId = {}, cidadesPorId = {};
  for (const a of r.frames[0].aldeias) { slugPorId[a.id] = a.slug; cidadesPorId[a.id] = { x: a.x, y: a.y }; }
  const idPorSlug = {}; for (const id in slugPorId) idPorSlug[slugPorId[id]] = Number(id);
  const custoPorTrecho = {};
  for (const e of Iberia.ESTRADAS) {
    const a = idPorSlug[e.de], b = idPorSlug[e.para];
    if (a == null || b == null) continue;
    custoPorTrecho[chaveTrechoNum(a, b)] = e.custo;
  }

  // por turno: quem (dono) ocupa cada trecho-alvo
  for (const fr of r.frames) {
    const porTrecho = {}; // chaveSlug -> [{dono, mov}]
    for (const m of fr.movimentos || []) {
      const pos = posicaoRota(custoPorTrecho, cidadesPorId, m);
      if (!pos) continue;
      const sA = slugPorId[pos.aId], sB = slugPorId[pos.bId];
      const chave = chaveSlug(sA, sB);
      if (!TRECHOS_ALVO.has(chave)) continue;
      (porTrecho[chave] = porTrecho[chave] || []).push({ dono: m.dono, mov: m });
    }
    // para cada PAR de trechos cruzados, ha ocupantes inimigos nos dois ao mesmo tempo?
    for (const par of PARES_CRUZADOS) {
      const c1 = chaveSlug(...par.e1), c2 = chaveSlug(...par.e2);
      const o1 = porTrecho[c1] || [], o2 = porTrecho[c2] || [];
      for (const a of o1) for (const b of o2) {
        if (a.dono === b.dono) continue;
        totalOcorrencias++;
        achados.push({
          arquivo: path.basename(arq), turno: fr.turno,
          trecho1: par.e1.join("-"), trecho2: par.e2.join("-"),
          reiEmTrecho1: a.dono, reiEmTrecho2: b.dono,
        });
      }
    }
  }
}

console.log(`ocorrencias de exercitos INIMIGOS nos dois lados de uma estrada cruzada, no MESMO turno: ${totalOcorrencias}`);
console.log(`(cada uma delas e, por construcao, invisivel para cruzaramNaEstrada — nunca gera combate_estrada,`);
console.log(` porque as duas estao em trechos LOGICAMENTE diferentes, mesmo se tocando no mesmo pixel da tela)\n`);

for (const a of achados.slice(0, 20)) {
  console.log(`  ${a.arquivo} turno ${a.turno}: Rei ${a.reiEmTrecho1} em [${a.trecho1}]  x  Rei ${a.reiEmTrecho2} em [${a.trecho2}]`);
}
if (achados.length > 20) console.log(`  ... e mais ${achados.length - 20}`);

fs.writeFileSync(path.join(__dirname, "achados-estradas-cruzadas.json"),
  JSON.stringify({ paresCruzados: PARES_CRUZADOS, totalOcorrencias, achados }, null, 1));
console.log(`\nescrito: achados-estradas-cruzadas.json`);
