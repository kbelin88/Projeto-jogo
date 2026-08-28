// medir-tropa-inicial.js — quanto da forca de um Rei fica parada nas ALDEIAS DE
// PARTIDA (capital + anel 1) a partida inteira.
//
// POR QUE ESTA FERRAMENTA EXISTE (28/08): a medida ja tinha sido feita uma vez,
// dentro de pesquisa/2026-08-28/REVISAO-OPUS.md, mas o script nao ficou guardado —
// so o numero (34.1%). Sem o script, a proxima medicao seria OUTRA medicao.
//
// ⚠️ NAO CONFUNDIR COM medir-retaguarda.js. Sao duas coisas diferentes:
//   - INTERIOR  (aldeia sem vizinho inimigo)     -> 53.8% nos replays ate 25/08
//   - INICIAIS  (capital + anel 1, ESTA aqui)    -> 34.1% nos mesmos replays
// Uma aldeia conquistada no meio do mapa e INTERIOR mas NAO e inicial. A revisao
// de 28/08 apanhou exatamente essa troca: medir o proxy e concluir sobre o alvo.
// A afirmacao do Lucas — "a tropa nao sai das aldeias de partida" — e a de baixo.
//
// USO:
//   node ferramentas/medir-tropa-inicial.js                 (todos os replays)
//   node ferramentas/medir-tropa-inicial.js <dir-ou-arquivo> ...
//
// So leitura: nao toca no motor nem nos replays.
"use strict";

const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const Iberia = require(path.join(RAIZ, "world-iberia.js"));

// adjacencia por SLUG, direto do mapa autoral (a topologia e publica, CLAUDE.md 5.2)
const adjSlug = {};
for (const c of Iberia.CIDADES) adjSlug[c.id] = new Set();
for (const e of Iberia.ESTRADAS) { adjSlug[e.de].add(e.para); adjSlug[e.para].add(e.de); }

function acharReplays(alvo, out) {
  const st = fs.statSync(alvo);
  if (st.isDirectory()) {
    for (const ent of fs.readdirSync(alvo, { withFileTypes: true })) acharReplays(path.join(alvo, ent.name), out);
  } else if (alvo.endsWith(".replay.json")) out.push(alvo);
  return out;
}

const alvos = process.argv.slice(2);
const REPLAYS = [];
for (const a of (alvos.length ? alvos : [path.join(RAIZ, "resultados")])) acharReplays(a, REPLAYS);

const nTropas = (t) => (t.lanceiro || 0) + (t.arqueiro || 0) + (t.cavaleiro || 0);

const linhas = [];
let gTot = 0, gN = 0;
const gFase = { inicio: [0, 0], meio: [0, 0], fim: [0, 0] };

for (const arq of REPLAYS.sort()) {
  const r = JSON.parse(fs.readFileSync(arq, "utf8"));
  if (!r.frames || r.frames.length < 3) continue;
  const f0 = r.frames[0];
  const slugPorId = {}, idPorSlug = {};
  for (const a of f0.aldeias) { slugPorId[a.id] = a.slug; idPorSlug[a.slug] = a.id; }

  // ALDEIAS DE PARTIDA de cada Rei: a capital que ele tem no frame 0, mais os
  // vizinhos DIRETOS dela na rede (anel 1). Conjunto fixo, definido pela
  // topologia — nao muda quando o mapa muda de dono.
  const partida = {};
  for (const d of ["A", "B"]) {
    const cap = f0.aldeias.find((a) => a.dono === d);
    if (!cap) continue;
    const s = new Set([cap.id]);
    for (const viz of adjSlug[cap.slug] || []) if (idPorSlug[viz] != null) s.add(idPorSlug[viz]);
    partida[d] = s;
  }
  if (!partida.A || !partida.B) continue;

  const amostras = [];   // {frac, i}
  for (let i = 0; i < r.frames.length; i++) {
    const fr = r.frames[i];
    // so turnos em que HA combate em algum lugar do mapa: parado enquanto
    // ninguem luta nao e desperdicio, e espera.
    const temCombate = (fr.eventos || []).some((e) => e.tipo === "combate" || e.tipo === "combate_estrada");
    if (!temCombate) continue;
    for (const d of ["A", "B"]) {
      let emPartida = 0, total = 0;
      for (const a of fr.aldeias) {
        if (a.dono !== d) continue;
        const n = nTropas(a.tropas);
        total += n;
        if (partida[d].has(a.id)) emPartida += n;
      }
      for (const m of fr.movimentos || []) if (m.dono === d) total += nTropas(m.tropas);
      if (total > 0) amostras.push({ frac: emPartida / total, i });
    }
  }
  if (!amostras.length) continue;

  const nF = r.frames.length;
  const med = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const fase = (i) => (i < nF / 3 ? "inicio" : i < (2 * nF) / 3 ? "meio" : "fim");
  const porFase = { inicio: [], meio: [], fim: [] };
  for (const s of amostras) porFase[fase(s.i)].push(s.frac);
  for (const f of ["inicio", "meio", "fim"]) {
    if (porFase[f].length) { gFase[f][0] += porFase[f].reduce((x, y) => x + y, 0); gFase[f][1] += porFase[f].length; }
  }
  const geral = med(amostras.map((s) => s.frac));
  gTot += amostras.reduce((x, y) => x + y.frac, 0); gN += amostras.length;
  linhas.push({ arq: path.basename(arq), n: amostras.length, geral,
    inicio: porFase.inicio.length ? med(porFase.inicio) : null,
    fim: porFase.fim.length ? med(porFase.fim) : null });
}

const pc = (x) => (x == null ? "  -  " : (100 * x).toFixed(1).padStart(5) + "%");
console.log(`ALDEIAS DE PARTIDA (capital + anel 1) — fracao da forca de um Rei parada la,`);
console.log(`em turnos com combate em algum lugar do mapa. ${REPLAYS.length} replay(s), ${linhas.length} com dados.\n`);
console.log("  geral  inicio    fim   n   replay");
for (const l of linhas.sort((a, b) => b.geral - a.geral))
  console.log(`  ${pc(l.geral)} ${pc(l.inicio)} ${pc(l.fim)} ${String(l.n).padStart(4)}   ${l.arq}`);
console.log(`\n  MEDIA GERAL: ${pc(gN ? gTot / gN : null)}  (${gN} amostras rei x turno-com-combate)`);
for (const f of ["inicio", "meio", "fim"])
  console.log(`     ${f.padEnd(7)}: ${pc(gFase[f][1] ? gFase[f][0] / gFase[f][1] : null)}`);
