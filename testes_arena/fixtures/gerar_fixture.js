// ============================================================
//  gerar_fixture.js — produz testes_arena/fixtures/replay_duelo.json
// ------------------------------------------------------------
//  Rodar da RAIZ:  node testes_arena/fixtures/gerar_fixture.js
//
//  Por que existe: o Smoke2 dependia de um replay com caminho absoluto
//  da maquina antiga. Esta fixture e gerada pelo PROPRIO codigo de
//  gravacao da arena (gravarFrame/baixarReplay), num duelo com fetch
//  falso que ATACA de verdade (le os ids do relatorio no prompt), para
//  o replay ter combates -> banners/cronica no Smoke2.
//
//  Quando o Lucas tiver um replay de partida REAL, basta sobrescrever
//  replay_duelo.json: o Smoke2 le frames/etiquetas do arquivo, nao tem
//  numero magico.
//
//  Escrita ATOMICA (tmp + rename) — licao da sessao de 03/07.
// ============================================================
"use strict";
const realTO = setTimeout;
global.setTimeout = (fn, ms) => realTO(fn, Math.min(ms || 0, 15));
const dorme = (ms) => new Promise((r) => realTO(r, ms));
const noop = () => {};
const ctxStub = new Proxy({}, {
  get: (t, p) => p === "measureText" ? () => ({ width: 40 })
    : (p === "createRadialGradient" || p === "createLinearGradient") ? () => ({ addColorStop: noop })
    : (typeof t[p] !== "undefined" ? t[p] : noop),
  set: (t, p, v) => { t[p] = v; return true; } });
const canvasStub = { getContext: () => ctxStub, style: {}, width: 0, height: 0,
  classList: { add: noop, remove: noop }, addEventListener: noop };
const listeners = {}, els = {};
function el(id) {
  return { id, style: {}, innerHTML: "", textContent: "", click() { (listeners[id]||{}).click && listeners[id].click(); },
    href: "", download: "",
    value: id === "gmax" ? "40" : id === "gspeed" ? "500"
      : id === "gmodA" ? "ollama:llama3.2:3b" : id === "gmodB" ? "ollama:qwen2.5:3b" : "",
    checked: false, children: [], firstChild: null, files: [],
    classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: (ev, fn) => { (listeners[id] = listeners[id] || {})[ev] = fn; },
    appendChild(c) { this.children.push(c); this.firstChild = this.children[0]; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); this.firstChild = this.children[0]; },
    scrollTop: 0, scrollHeight: 0 };
}
let __idsHtml = null;
global.document = {
  getElementById: (id) => {
    if (id === "map") return canvasStub;
    if (__idsHtml && !__idsHtml.has(id)) return null; // ESTRITO, como sempre
    return (els[id] = els[id] || el(id));
  },
  createElement: (tag) => { const e = el("_" + tag); e.click = noop; return e; },
  body: { classList: { toggle: noop, add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop } };
global.window = { innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1,
  addEventListener: noop, matchMedia: () => ({ matches: false }), prompt: () => "",
  localStorage: { getItem: () => null, setItem: noop } };
global.matchMedia = global.window.matchMedia;
global.localStorage = global.window.localStorage;
global.requestAnimationFrame = noop;
global.alert = (m) => console.log("[alert]", String(m).slice(0, 80));
global.URL = { createObjectURL: () => "blob:x", revokeObjectURL: noop };
global.Blob = class { constructor(parts) { global.__blob = parts.join(""); } };

// Modelo falso que JOGA: le os ids reais do relatorio (SUAS ALDEIAS /
// ALDEIAS NEUTRAS / INIMIGO) e manda 2 lanceiros no alvo mais proximo,
// alem de construir. Gera combates -> o replay tem eventos/banners.
function jogadaFake(prompt) {
  if (prompt.startsWith("responda")) return "ok";
  const sec = (nome) => {
    const i = prompt.indexOf("=== " + nome);
    if (i < 0) return "";
    const j = prompt.indexOf("\n=== ", i); // proximo CABECALHO, nao o fecho deste
    return prompt.slice(i, j < 0 ? undefined : j);
  };
  const ids = (txt) => [...txt.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const minhas = ids(sec("SUAS ALDEIAS"));
  const alvos = ids(sec("ALDEIAS NEUTRAS")).concat(ids(sec("INIMIGO")));
  if (!minhas.length) return '{"construir":[],"envios":[]}';
  const ordem = { construir: [{ aldeiaId: minhas[0], tipo: "lanceiro" }], envios: [] };
  if (alvos.length) ordem.envios.push({ origemId: minhas[0], destinoId: alvos[0],
    tropas: { lanceiro: 2, arqueiro: 0, cavaleiro: 0 } });
  return JSON.stringify(ordem);
}
global.fetch = (url, opts) => {
  const corpo = JSON.parse(opts.body);
  return new Promise((res) => realTO(() =>
    res({ ok: true, json: async () => ({ response: jogadaFake(corpo.prompt) }) }), 5));
};

global.World = require(process.cwd() + "/world.js");
global.Engine = require(process.cwd() + "/engine.js");
const fs = require("fs"), os = require("path");
const html = fs.readFileSync("index.html", "utf-8");
__idsHtml = new Set([...html.slice(0, html.lastIndexOf("<script>")).matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
eval(html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>")));

(async () => {
  const N = 20;
  for (let t = 0; t < N; t++) await listeners["gstep"].click();
  listeners["greplaysave"].click();
  const dados = JSON.parse(global.__blob);
  if (!dados.frames || dados.frames.length !== N) throw new Error(`esperava ${N} frames, veio ${dados.frames && dados.frames.length}`);
  const comEventos = dados.frames.filter((f) => f.eventos && f.eventos.length).length;
  if (!comEventos) throw new Error("nenhum frame com eventos — fixture inutil p/ testar banner/cronica");
  const alvo = os.join(process.cwd(), "testes_arena", "fixtures", "replay_duelo.json");
  const tmp = alvo + ".tmp";
  fs.writeFileSync(tmp, global.__blob);   // atomico: tmp + rename
  fs.renameSync(tmp, alvo);
  console.log(`fixture ok: ${dados.frames.length} frames, ${comEventos} com eventos,`,
    `etiquetas ${dados.frames[0].etiquetaA} vs ${dados.frames[0].etiquetaB} -> ${alvo}`);
  process.exit(0);
})().catch((e) => { console.error("GERADOR FALHOU:", e.message); process.exit(1); });
