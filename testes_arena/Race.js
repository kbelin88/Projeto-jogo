// TESTE DE CORRIDA: reproduz o incidente da partida de 02/07
// ollama pendente no await -> pausa -> troca p/ gemini -> play
// APROVADO se: nenhuma entrada rotulada ollama aparece depois da primeira gemini
"use strict";
const realSetTimeout = setTimeout;
global.setTimeout = (fn, ms) => realSetTimeout(fn, Math.min(ms || 0, 25)); // encurta pacing de 13s
const dorme = (ms) => new Promise((r) => realSetTimeout(r, ms));

const noop = () => {};
const ctxStub = new Proxy({}, {
  get: (t, p) => p === "measureText" ? () => ({ width: 40 })
    : (p === "createRadialGradient" || p === "createLinearGradient") ? () => ({ addColorStop: noop })
    : (typeof t[p] !== "undefined" ? t[p] : noop),
  set: (t, p, v) => { t[p] = v; return true; },
});
const canvasStub = { getContext: () => ctxStub, style: {}, width: 0, height: 0,
  classList: { add: noop, remove: noop }, addEventListener: noop };
const listeners = {}, els = {};
function el(id) {
  return { id, style: {}, innerHTML: "", textContent: "", click: noop, href: "", download: "",
    value: id === "gmax" ? "3" : id === "gspeed" ? "500" : (id === "gmodA" || id === "gmodB") ? "burro" : "",
    checked: false, children: [], firstChild: null,
    classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: (ev, fn) => { (listeners[id] = listeners[id] || {})[ev] = fn; },
    appendChild(c) { this.children.push(c); this.firstChild = this.children[0]; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); this.firstChild = this.children[0]; },
    scrollTop: 0, scrollHeight: 0 };
}
let __idsHtml = null; // preenchido apos ler o index.html
global.document = {
  getElementById: (id) => {
    if (id === "map") return canvasStub;
    if (__idsHtml && !__idsHtml.has(id)) return null; // ESTRITO: como o navegador
    return (els[id] = els[id] || el(id));
  },
  createElement: () => el("_dyn"),
  body: { classList: { toggle: noop, add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
};
global.window = { innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1,
  addEventListener: noop, matchMedia: () => ({ matches: true }), // reduz mov: sem rAF no teste
  prompt: () => "", localStorage: { getItem: (k) => k === "GEMINI_API_KEY" ? "chave-fake" : null, setItem: noop } };
global.matchMedia = global.window.matchMedia;
global.localStorage = global.window.localStorage;
global.requestAnimationFrame = noop;
global.alert = (m) => console.log("[alert]", String(m).slice(0, 60));
global.URL = { createObjectURL: () => "blob:x", revokeObjectURL: noop };
global.Blob = class {};

// fetch fake: OLLAMA responde LENTO (400ms reais), GEMINI responde rapido
global.fetch = (url) => {
  const ollama = String(url).includes("11434");
  const corpo = ollama
    ? { response: '{"construir":[],"envios":[]}' }
    : { candidates: [{ content: { parts: [{ text: '{"construir":[],"envios":[]}' }] } }] };
  return new Promise((res) => realSetTimeout(() =>
    res({ ok: true, json: async () => corpo, text: async () => "" }), ollama ? 400 : 30));
};

global.World = require(process.cwd() + "/world.js");
global.Engine = require(process.cwd() + "/engine.js");
const html = require("fs").readFileSync("index.html", "utf-8");
__idsHtml = new Set([...html.slice(0, html.lastIndexOf("<script>")).matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
eval(html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>")));

(async () => {
  // 1) marca Ollama e Play (fica preso no sanity check lento de 400ms)
  global.document.getElementById("gmodB").value = "ollama:qwen2.5:3b";
  listeners["gplay"].click();          // play -> runOllama
  await dorme(60);                     // ainda no meio do await do sanity/turno
  // 2) usuario "desiste": Play de novo (pausa), troca p/ Gemini, Play
  listeners["gplay"].click();          // pause
  global.document.getElementById("gmodB").value = "gemini"; listeners["gmodB"].change();
  listeners["gplay"].click();          // play -> runGemini (novo runId)
  // 3) deixa tudo assentar: respostas atrasadas do ollama chegam nesse meio tempo
  await dorme(1500);

  const rotulos = els["sb-feed"].children.map((c) => {
    const m = /ent-m">([^<]+)</.exec(c.innerHTML); return m ? m[1] : "?";
  });
  console.log("sequencia de rotulos na cronica:", JSON.stringify(rotulos));
  const iG = rotulos.indexOf("gemini");
  const vazou = iG >= 0 && rotulos.slice(iG).some((r) => r.startsWith("ollama"));
  if (iG < 0) throw new Error("gemini nao jogou nenhum turno");
  if (vazou) throw new Error("CORRIDA AINDA EXISTE: turno ollama depois do gemini");
  console.log("RACE TEST OK: nenhum turno do run antigo vazou");
})().catch((e) => { console.error("RACE TEST FALHOU:", e.message); process.exit(1); });