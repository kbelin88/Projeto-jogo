// SMOKE 2: partida burro 15 turnos -> salvar replay -> carregar -> reproduzir
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
    href: "", download: "", value: id === "gmax" ? "20" : id === "gspeed" ? "1200" : (id === "gmodA" || id === "gmodB") ? "burro" : "",
    checked: false, children: [], firstChild: null, files: [],
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
  createElement: (tag) => { const e = el("_" + tag); e.click = noop; return e; },
  body: { classList: { toggle: noop, add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop } };
global.window = { innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1,
  addEventListener: noop, matchMedia: () => ({ matches: false }), prompt: () => "",
  localStorage: { getItem: () => null, setItem: noop } };
global.matchMedia = global.window.matchMedia;
global.localStorage = global.window.localStorage;
global.requestAnimationFrame = noop;
global.alert = (m) => console.log("[alert]", String(m).slice(0, 80));
global.fetch = () => Promise.reject(new Error("sem rede"));
global.URL = { createObjectURL: () => "blob:x", revokeObjectURL: noop };
global.Blob = class { constructor(parts) { global.__blob = parts.join(""); } };
global.FileReader = class {
  readAsText(f) { this.result = f.__txt; realTO(() => this.onload(), 1); }
};
global.World = require(process.cwd() + "/world.js");
global.Engine = require(process.cwd() + "/engine.js");
const html = require("fs").readFileSync("index.html", "utf-8");
__idsHtml = new Set([...html.slice(0, html.lastIndexOf("<script>")).matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
eval(html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>")));

(async () => {
  for (let t = 0; t < 15; t++) await listeners["gstep"].click();
  listeners["greplaysave"].click();
  const dados = JSON.parse(global.__blob);
  if (dados.frames.length !== 15) throw new Error("esperava 15 frames, veio " + dados.frames.length);
  console.log("gravacao ok:", dados.frames.length, "frames;",
    "eventos no ultimo:", dados.frames[14].eventos.length);

  // carregar e reproduzir uma fixture do repo (gerada pelo PROPRIO codigo de
  // gravacao da arena — node testes_arena/fixtures/gerar_fixture.js). Sem
  // caminho de maquina e sem numero magico: frames/etiquetas vem do arquivo.
  // Para testar contra um replay de partida REAL, e so sobrescrever o .json.
  const realJson = require("fs").readFileSync("testes_arena/fixtures/replay_duelo.json", "utf-8");
  const fx = JSON.parse(realJson);
  const NF = fx.frames.length;
  const modBFx = fx.frames[NF - 1].etiquetaB;
  els["sb-feed"].children.length = 0;
  global.document.getElementById("grepVel").value = "2000";
  listeners["greplayload"].change({ target: { files: [{ __txt: realJson }], value: "" } });
  await dorme(1500); // setTimeout encurtado: os frames passam rapido
  // usuario assume a camera no meio (nao deve quebrar nada)
  listeners && els["grepCam"] && listeners["grepCam"] && listeners["grepCam"].click();
  await dorme(300);
  const modelo = els["sb-modelo"].textContent;
  if (!/^REPLAY/.test(modelo)) throw new Error("sb-modelo nao entrou em modo replay: " + modelo);
  if (!els["sb-feed"].children.length && !els["sb-feedA"].children.length) throw new Error("cronica vazia no replay");
  if (!els["banner"].textContent) throw new Error("nenhum banner de evento apareceu");
  const prog = els["grepProg"].textContent;
  if (!new RegExp("turno " + NF + "/" + NF).test(prog)) throw new Error("progresso nao chegou ao fim: " + prog);
  // restart deve voltar ao inicio e limpar a cronica
  listeners["grepRestart"].click();
  await dorme(120);
  if (!/turno /.test(els["grepProg"].textContent)) throw new Error("restart sem progresso");
  listeners["grepSair"].click();
  if (els["sb-modelo"].textContent.startsWith("REPLAY")) throw new Error("sair nao saiu do replay");
  console.log("replay ok:", els["sb-feedA"].children.length + els["sb-feed"].children.length, "entradas; banner:", JSON.stringify(els["banner"].textContent).slice(0, 60));
  // placar de transmissao alimentado durante o replay
  listeners["greplayload"].change({ target: { files: [{ __txt: realJson }], value: "" } });
  await dorme(400);
  if (!/TURNO \d+/.test(els["pt-turno"].textContent)) throw new Error("placar sem turno: " + els["pt-turno"].textContent);
  if (els["pt-b-mod"].textContent !== modBFx) throw new Error("placar sem modelo B (esperava " + modBFx + "): " + els["pt-b-mod"].textContent);
  console.log("placar ok:", els["pt-turno"].textContent, "| B:", els["pt-b-mod"].textContent, "forca", els["pt-b-f"].textContent);
  if (!/class="pip/.test(els["pt-pips"].innerHTML)) throw new Error("pips ausentes no placar");
  const todos = els["sb-feed"].children.concat(els["sb-feedA"].children);
  const temEv = todos.some((c) => /class="ev ev[AB]"/.test(c.innerHTML));
  if (!temEv) throw new Error("cronica de espectador sem frases-icone");
  const exemploEv = todos.find((c) => /ev ev[AB]/.test(c.innerHTML));
  console.log("cronica espectador:", exemploEv.innerHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 90));
  console.log("turno final:", els["pt-turno"].textContent);
  listeners["grepSair"].click();
  console.log("SMOKE 2 OK");
  process.exit(0);
})().catch((e) => { console.error("SMOKE 2 FALHOU:", e.message); process.exit(1); });