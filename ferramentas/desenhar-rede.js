// desenhar-rede.js — a rede de um mapa num SVG, para se VER antes de haver 3D.
//
// Uso:  node ferramentas/desenhar-rede.js [usa|iberia] [saida.svg]
//
// Desenha as cidades na posicao que o motor usa, as estradas com o custo
// escrito a meio, e (no mapa dos EUA) os dois espelhos. Serve para conferir a
// olho o que o `verificarEquilibrio()` confere por conta: se uma estrada
// parece absurda no mapa, ve-se aqui.
"use strict";
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
const qual = (process.argv[2] || "usa").toLowerCase();
const M = require(path.join(RAIZ, qual === "iberia" ? "world-iberia.js" : "world-usa.js"));
const saida = process.argv[3] || path.join(RAIZ, "pesquisa", `rede-${qual}.svg`);

const xs = M.CIDADES.map((c) => c.x), ys = M.CIDADES.map((c) => c.y);
const m = 110, x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m;
const W = Math.max(...xs) - x0 + m, H = Math.max(...ys) - y0 + m;
const pos = {}; for (const c of M.CIDADES) pos[c.id] = c;
const COR = { noroeste: "#2f6fb5", sudoeste: "#2a9d8f", nordeste: "#c8443c", sudeste: "#e08a1e", oeste: "#2f6fb5", este: "#c8443c" };
const raio = { capital: 17, grande: 12, media: 10, pequena: 8 };
const L = [];
L.push(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${x0} ${y0} ${W} ${H}" font-family="Georgia, serif">`);
L.push(`<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="#f1ead8"/>`);
if (qual !== "iberia") {
  const kc = pos[M.MAPA.centro];
  L.push(`<line x1="${kc.x}" y1="${y0}" x2="${kc.x}" y2="${y0 + H}" stroke="#b9ad90" stroke-width="2" stroke-dasharray="14 10"/>`);
  L.push(`<line x1="${x0}" y1="${kc.y}" x2="${x0 + W}" y2="${kc.y}" stroke="#b9ad90" stroke-width="2" stroke-dasharray="14 10"/>`);
}
for (const e of M.ESTRADAS) {
  const a = pos[e.de], b = pos[e.para];
  L.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#7a6a4a" stroke-width="${2 + e.custo}" stroke-linecap="round" opacity="0.55"/>`);
}
for (const e of M.ESTRADAS) {
  const a = pos[e.de], b = pos[e.para], x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
  L.push(`<circle cx="${x}" cy="${y}" r="13" fill="#f1ead8"/><text x="${x}" y="${y + 5}" font-size="15" text-anchor="middle" fill="#4a3f2a">${e.custo}</text>`);
}
for (const c of M.CIDADES) {
  const r = raio[c.tamanho] || 9, cor = c.dono ? COR[c.dono] : (c.quadrante === "eixo" ? "#8a8170" : "#fbf7ea");
  L.push(`<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="${cor}" stroke="#3b3222" stroke-width="2.5"/>`);
  L.push(`<text x="${c.x}" y="${c.y - r - 7}" font-size="${c.dono ? 24 : 18}" font-weight="${c.dono ? 700 : 400}" text-anchor="middle" fill="#2b2418" stroke="#f1ead8" stroke-width="4" paint-order="stroke">${c.nome}</text>`);
}
L.push("</svg>");
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, L.join("\n"));
console.log(`${M.CIDADES.length} cidades, ${M.ESTRADAS.length} estradas -> ${saida}`);
