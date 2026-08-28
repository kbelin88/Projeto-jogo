// medir-retaguarda.js — ITEM 3: tropas paradas na retaguarda.
//
// NAO EDITA engine.js. So leitura de world-iberia.js e dos .replay.json.
//
// Reproduz a MESMA regra de fronteira/interior que o prompt usa
// (engine.js:2254-2258, fronteiraTag): uma aldeia e INTERIOR se NENHUM
// vizinho DIRETO na rede de estradas e do inimigo; senao e BORDER. Usa a
// rede completa (a topologia e publica, CLAUDE.md 5.2), nao o fog.
//
// MEDE DUAS COISAS:
//  1. Quanto da forca de um rei fica parada em aldeias INTERIOR, em turnos
//     que TEM combate acontecendo em algum lugar do mapa (fracao do total).
//  2. Das ordens de reforco (envio aldeia-propria -> aldeia-propria), quantas
//     vao de INTERIOR para BORDER (retaguarda -> frente, o que o Lucas
//     esperava ver mais) contra as outras direcoes.
//
// USO: node pesquisa/2026-08-28/experimentos/medir-retaguarda.js

"use strict";

const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..", "..", "..");
const Iberia = require(path.join(RAIZ, "world-iberia.js"));

function acharReplays(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) acharReplays(p, out);
    else if (ent.name.endsWith(".replay.json")) out.push(p);
  }
}
const REPLAYS = [];
acharReplays(path.join(RAIZ, "resultados"), REPLAYS);

// adjacencia por SLUG (direto de world-iberia.js, publica sempre)
const adjSlug = {};
for (const c of Iberia.CIDADES) adjSlug[c.id] = new Set();
for (const e of Iberia.ESTRADAS) { adjSlug[e.de].add(e.para); adjSlug[e.para].add(e.de); }

let totFracaoParada = 0, nAmostrasParada = 0;
let reforcos = { interiorParaBorder: 0, borderParaInterior: 0, interiorParaInterior: 0, borderParaBorder: 0 };
const porArquivo = [];

for (const arq of REPLAYS) {
  const r = JSON.parse(fs.readFileSync(arq, "utf8"));
  if (!r.frames || r.frames.length < 3) continue;

  const slugPorId = {};
  for (const a of r.frames[0].aldeias) slugPorId[a.id] = a.slug;

  let arqParada = [], arqReforco = { interiorParaBorder: 0, borderParaInterior: 0, interiorParaInterior: 0, borderParaBorder: 0 };
  const vistosMov = new Set(); // origemId|destinoId|dono|turno-de-emissao, p/ nao contar 2x

  for (let i = 0; i < r.frames.length; i++) {
    const fr = r.frames[i];
    const donoDe = {};
    for (const a of fr.aldeias) donoDe[a.id] = a.dono;

    const interior = (id, dono) => {
      const s = slugPorId[id];
      for (const viz of adjSlug[s] || []) {
        const vizId = fr.aldeias.find((a) => a.slug === viz);
        if (vizId && vizId.dono && vizId.dono !== dono) return false; // vizinho inimigo -> BORDER
      }
      return true;
    };

    // --- medida 1: forca parada em INTERIOR, em turno com combate ---------
    const temCombate = (fr.eventos || []).some((e) => e.tipo === "combate" || e.tipo === "combate_estrada");
    if (temCombate) {
      for (const rei of ["A", "B"]) {
        let emCasa = 0, emInterior = 0;
        for (const a of fr.aldeias) {
          if (a.dono !== rei) continue;
          const n = a.tropas.lanceiro + a.tropas.arqueiro + a.tropas.cavaleiro;
          emCasa += n;
          if (interior(a.id, rei)) emInterior += n;
        }
        let marchando = 0;
        for (const m of fr.movimentos || []) if (m.dono === rei) marchando += m.tropas.lanceiro + m.tropas.arqueiro + m.tropas.cavaleiro;
        const total = emCasa + marchando;
        if (total > 0) {
          const frac = emInterior / total;
          totFracaoParada += frac; nAmostrasParada++;
          arqParada.push(frac);
        }
      }
    }

    // --- medida 2: reforcos, classificados por origem/destino -------------
    // um movimento e "reforco" se, no momento em que foi EMITIDO (1a vez que
    // aparece com turnosRestantes===turnosTotal), o destino ja e do mesmo dono.
    for (const m of fr.movimentos || []) {
      if (m.turnosRestantes !== m.turnosTotal) continue; // so a emissao, 1x
      const chave = [m.dono, m.origemId, m.destinoId, fr.turno].join("|");
      if (vistosMov.has(chave)) continue;
      vistosMov.add(chave);
      if (donoDe[m.destinoId] !== m.dono) continue; // nao e reforco, e ataque/conquista
      const origInt = interior(m.origemId, m.dono);
      const destInt = interior(m.destinoId, m.dono);
      let cat;
      if (origInt && !destInt) cat = "interiorParaBorder";
      else if (!origInt && destInt) cat = "borderParaInterior";
      else if (origInt && destInt) cat = "interiorParaInterior";
      else cat = "borderParaBorder";
      reforcos[cat]++;
      arqReforco[cat]++;
    }
  }

  const totReforcoArq = Object.values(arqReforco).reduce((a, b) => a + b, 0);
  if (totReforcoArq > 0 || arqParada.length > 0) {
    porArquivo.push({
      arquivo: path.basename(arq),
      mediaFracaoInterior: arqParada.length ? (arqParada.reduce((a, b) => a + b, 0) / arqParada.length) : null,
      reforcos: arqReforco, totReforco: totReforcoArq,
    });
  }
}

console.log(`${REPLAYS.length} replays encontrados, ${porArquivo.length} com dados uteis\n`);

console.log("=== MEDIDA 1: fracao da forca parada em aldeias INTERIOR, em turnos com combate ===");
console.log(`amostras (rei x turno-com-combate): ${nAmostrasParada}`);
if (nAmostrasParada) console.log(`media: ${(100 * totFracaoParada / nAmostrasParada).toFixed(1)}% da forca de um rei, em media, esta parada em aldeias sem fronteira com o inimigo, quando ha combate em algum lugar do mapa`);

console.log("\n=== MEDIDA 2: para onde vao os reforcos (aldeia propria -> aldeia propria) ===");
const totR = Object.values(reforcos).reduce((a, b) => a + b, 0);
console.log(`total de ordens de reforco medidas: ${totR}`);
for (const k in reforcos) {
  console.log(`  ${k.padEnd(20)} ${reforcos[k]}  (${totR ? (100 * reforcos[k] / totR).toFixed(1) : 0}%)`);
}
console.log(`\ntaxa retaguarda->frente (interiorParaBorder / total de reforcos): ${totR ? (100 * reforcos.interiorParaBorder / totR).toFixed(1) : 0}%`);

console.log("\n--- por arquivo (so com pelo menos 1 reforco) ---");
for (const r of porArquivo) {
  if (r.totReforco === 0) continue;
  console.log(`  ${r.arquivo.padEnd(60)} reforcos=${r.totReforco}  int->border=${r.reforcos.interiorParaBorder}  ` +
    `interior parado(media)=${r.mediaFracaoInterior != null ? (100 * r.mediaFracaoInterior).toFixed(0) + "%" : "-"}`);
}

fs.writeFileSync(path.join(__dirname, "achados-retaguarda.json"),
  JSON.stringify({ nAmostrasParada, mediaFracaoParada: nAmostrasParada ? totFracaoParada / nAmostrasParada : null, reforcos, porArquivo }, null, 1));
console.log("\nescrito: achados-retaguarda.json");
