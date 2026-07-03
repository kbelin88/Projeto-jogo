// SMOKE 3 — DUELO: Rei A ollama:llama3:latest vs Rei B ollama:qwen2.5:3b
// (o cenario exato que falhou na maquina do Lucas)
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
    value: id === "gmax" ? "8" : id === "gspeed" ? "500" : id === "gmodA" ? "ollama:llama3:latest" : id === "gmodB" ? "ollama:qwen2.5:3b" : "",
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
    if (__idsHtml && !__idsHtml.has(id)) return null; // ESTRITO: como o navegador
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
global.alert = (m) => { global.__alerta = String(m); console.log("[alert]", String(m).slice(0, 70)); };
global.URL = { createObjectURL: () => "blob:x", revokeObjectURL: noop };
global.Blob = class { constructor(parts) { global.__blob = parts.join(""); } };

// fetch fake do Ollama: qwen manda counter, llama passa o turno
global.fetch = (url, opts) => {
  const corpo = JSON.parse(opts.body);
  const resposta = corpo.prompt.startsWith("responda") ? "ok"
    : corpo.model === "qwen2.5:3b"
      ? '{"construir":[{"aldeiaId":18,"tipo":"lanceiro"}],"envios":[]}'
      : '{"construir":[],"envios":[]}';
  return new Promise((res) => realTO(() =>
    res({ ok: true, json: async () => ({ response: resposta }) }), 25));
};

global.World = require(process.cwd() + "/world.js");
global.Engine = require(process.cwd() + "/engine.js");
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf-8");
__idsHtml = new Set([...html.slice(0, html.lastIndexOf("<script>")).matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
eval(html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>")));

(async () => {
  listeners["gplay"].click(); // Play: duelo ollama vs ollama
  await dorme(2500);
  if (global.__alerta) throw new Error("alerta inesperado: " + global.__alerta);
  const log = global.__blob || "";
  if (!/Rei A \(ollama:llama3:latest\)/.test(log)) throw new Error("log sem turnos do Rei A");
  if (!/Rei B \(ollama:qwen2\.5:3b\)/.test(log)) throw new Error("log sem turnos do Rei B");
  if (!/=== PARTIDA Rei A \(ollama:llama3:latest\) vs Rei B \(ollama:qwen2\.5:3b\)/.test(log))
    throw new Error("cabecalho do duelo errado");
  const nA = els["sb-feedA"].children.length, nB = els["sb-feed"].children.length;
  if (!nA || !nB) throw new Error(`feeds vazios: A=${nA} B=${nB}`);
  console.log("duelo ok | cronicas A/B:", nA, "/", nB, "| placar:", els["pt-turno"].textContent);
  console.log("rotulos:", els["sbA-modelo"].textContent, "vs", els["sb-modelo"].textContent);
  console.log("SMOKE 3 (DUELO) OK");
  process.exit(0);
})().catch((e) => { console.error("SMOKE 3 FALHOU:", e.message); process.exit(1); });