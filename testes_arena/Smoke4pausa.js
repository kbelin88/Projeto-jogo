// SMOKE 4 — PAUSA/RESUME: o log do duelo NAO pode perder turnos.
// Bug real (partida do Lucas de 04/07): runDuelo zerava geminiLog a CADA
// Play — inclusive no resume — enquanto os contadores so zeram em
// novaPartida. Resultado: log comecando no turno 3, RESUMO dizendo 17
// turnos com 16 blocos no arquivo, e o fim da partida caindo num
// segundo arquivo.
// Invariantes deste teste:
//   1. depois de pausar e retomar, o TURNO 1 continua no log;
//   2. RESUMO(turnos) == numero de blocos de turno no arquivo (sincronia
//      por construcao — o turno fantasma do abort em voo nao conta nem
//      loga, entao os dois lados batem);
//   3. a linha === FIM === esta no MESMO arquivo (nao num segundo).
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
global.alert = (m) => { global.__alerta = String(m); console.log("[alert]", String(m).slice(0, 70)); };
global.URL = { createObjectURL: () => "blob:x", revokeObjectURL: noop };
global.Blob = class { constructor(parts) { global.__blob = parts.join(""); } };

// fetch fake: os dois constroem lanceiro na propria aldeia (jogo anda, log enche)
global.fetch = (url, opts) => {
  const corpo = JSON.parse(opts.body);
  const resposta = corpo.prompt.startsWith("responda") ? "ok"
    : '{"construir":[{"aldeiaId":18,"tipo":"lanceiro"}],"envios":[]}';
  return new Promise((res) => realTO(() =>
    res({ ok: true, json: async () => ({ response: resposta }) }), 25));
};

global.World = require(process.cwd() + "/world.js");
global.Engine = require(process.cwd() + "/engine.js");
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf-8");
__idsHtml = new Set([...html.slice(0, html.lastIndexOf("<script>")).matchAll(/id=\"([^\"]+)\"/g)].map((m) => m[1]));
eval(html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>")));

(async () => {
  listeners["gplay"].click();          // Play
  await dorme(400);                     // alguns turnos andam
  listeners["gplay"].click();          // Pausar (mesmo botao)
  await dorme(150);                     // decisao em voo aborta (fantasma, ok)
  listeners["gplay"].click();          // Play de novo (RESUME — aqui morava o bug)
  await dorme(3000);                    // partida vai ate o fim (gmax=8) e auto-baixa

  if (global.__alerta) throw new Error("alerta inesperado: " + global.__alerta);
  const log = global.__blob || "";

  // 1. o comeco da partida sobreviveu ao resume
  if (!/TURNO 1 /.test(log)) throw new Error("TURNO 1 sumiu do log apos pausa/resume (wipe no runDuelo)");

  // 2. FIM no MESMO arquivo
  if (!/=== FIM ===/.test(log)) throw new Error("linha === FIM === nao esta no arquivo baixado");

  // 3. RESUMO em sincronia com os blocos
  const blocosA = (log.match(/TURNO \d+ — Rei A /g) || []).length;
  const blocosB = (log.match(/TURNO \d+ — Rei B /g) || []).length;
  const mA = log.match(/Rei A \([^)]*\): (\d+) turnos/);
  const mB = log.match(/Rei B \([^)]*\): (\d+) turnos/);
  if (!mA || !mB) throw new Error("RESUMO ausente ou sem contagem de turnos");
  if (Number(mA[1]) !== blocosA) throw new Error(`dessincronia Rei A: RESUMO diz ${mA[1]}, arquivo tem ${blocosA} blocos`);
  if (Number(mB[1]) !== blocosB) throw new Error(`dessincronia Rei B: RESUMO diz ${mB[1]}, arquivo tem ${blocosB} blocos`);

  // 4. so UM cabecalho (resume nao reabre partida)
  const cab = (log.match(/=== PARTIDA Rei A/g) || []).length;
  if (cab !== 1) throw new Error(`esperava 1 cabecalho, achei ${cab}`);

  console.log(`pausa/resume ok | blocos A/B: ${blocosA}/${blocosB} | RESUMO A/B: ${mA[1]}/${mB[1]} | FIM presente`);
  console.log("SMOKE 4 (PAUSA) OK");
  process.exit(0);
})().catch((e) => { console.error("SMOKE 4 FALHOU:", e.message); process.exit(1); });
