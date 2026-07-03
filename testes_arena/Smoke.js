// SMOKE TEST headless do index.html: stubs de DOM/canvas, roda 15 turnos burro
"use strict";
const noop = () => {};
const ctxStub = new Proxy({}, {
  get: (t, p) => {
    if (p === "canvas") return canvasStub;
    if (p === "measureText") return () => ({ width: 40 });
    if (p === "createRadialGradient" || p === "createLinearGradient")
      return () => ({ addColorStop: noop });
    if (typeof p === "string") return t[p] !== undefined ? t[p] : noop;
    return noop;
  },
  set: (t, p, v) => { t[p] = v; return true; },
});
const canvasStub = {
  getContext: () => ctxStub, style: {}, width: 0, height: 0,
  classList: { add: noop, remove: noop, toggle: noop },
  addEventListener: noop,
};
const listeners = {};   // id -> {evento: fn}
function el(id) {
  return {
    id, style: {}, innerHTML: "", textContent: "", value: id === "gmax" ? "6" : id === "gspeed" ? "500" : (id === "gmodA" || id === "gmodB") ? "burro" : "",
    checked: false, children: [], firstChild: null,
    classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: (ev, fn) => { (listeners[id] = listeners[id] || {})[ev] = fn; },
    appendChild(c) { this.children.push(c); this.firstChild = this.children[0]; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); this.firstChild = this.children[0]; },
    scrollTop: 0, scrollHeight: 0,
  };
}
const els = {};
let __idsHtml = null;
global.document = {
  getElementById: (id) => {
    if (id === "map") return canvasStub;
    if (__idsHtml && !__idsHtml.has(id)) return null; // ESTRITO: como o navegador
    return (els[id] = els[id] || el(id));
  },
  createElement: () => el("_dyn"),
  body: { classList: { toggle: noop, add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
};
global.window = {
  innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1,
  addEventListener: noop, matchMedia: () => ({ matches: false }),
  prompt: () => "", localStorage: { getItem: () => null, setItem: noop },
};
global.matchMedia = global.window.matchMedia;
global.localStorage = global.window.localStorage;
global.requestAnimationFrame = noop; // sem loop infinito no smoke
global.alert = noop;
global.fetch = () => Promise.reject(new Error("sem rede no smoke"));

// carrega world/engine como no browser (UMD cai no module.exports; injeta como globals)
global.World = require(process.cwd() + "/world.js");
global.Engine = require(process.cwd() + "/engine.js");

// executa o script inline do index.html
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf-8");
__idsHtml = new Set([...html.slice(0, html.lastIndexOf("<script>")).matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const i = html.lastIndexOf("<script>") + "<script>".length;
const j = html.lastIndexOf("</script>");
eval(html.slice(i, j));

// simula 15 turnos burro clicando em "Passo"
(async () => {
  for (let t = 0; t < 15; t++) await listeners["gstep"].click();
  const nA = els["sb-feedA"].children.length, nB = els["sb-feed"].children.length;
  console.log("turnos ok; cronicas A/B:", nA, "/", nB);
  if (!nA && !nB) throw new Error("cronicas vazias apos 15 turnos");
  console.log("placar:", els["pt-turno"].textContent, "| A:", els["sbA-stats"].textContent, "| B:", els["sbB-stats"].textContent);
  console.log("SMOKE OK");
})().catch((e) => { console.error("SMOKE FALHOU:", e); process.exit(1); });