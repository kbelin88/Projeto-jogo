#!/usr/bin/env node
// gravar_camera.js — grava um trecho de uma partida (replay) em MP4, com a
// camera a seguir um roteiro de keyframes. Sem dependencias: Node 24 (WebSocket
// nativo), o Edge ja instalado (protocolo DevTools) e o ffmpeg.
//
//   node ferramentas/gravar_camera.js --replay resultados/estadio/E1010-07.replay.json \
//        --roteiro roteiros/exemplo_E1010-07.json --duracao 8 --formato ambos
//
//   --replay   replay COMPLETO (.replay.json), relativo a raiz do repo ou absoluto
//   --roteiro  roteiro .json (ver ferramentas/GRAVAR_CAMERA.md); sem ele, plano geral fixo
//   --inicio   turno por onde comecar (omissao: o primeiro)
//   --duracao  segundos de filme (omissao: o replay inteiro)
//   --seg      segundos por turno (omissao 2)
//   --formato  vertical (1080x1920) | horizontal (1920x1080) | ambos (omissao)
//   --saida    pasta de saida (omissao videos/camera; videos/ esta no .gitignore)
//   --navegador  caminho do msedge.exe/chrome (omissao: procura o Edge)
//   --manter   nao apaga a pasta dos quadros (PNG)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

const RAIZ = path.resolve(__dirname, "..");
const FPS = 30;
const FORMATOS = { vertical: [1080, 1920], horizontal: [1920, 1080] };
// WebGL no Edge sem janela: tenta-se por esta ordem, e fica a que servir
const GPUS = [
  { nome: "predefinido", flags: [] },
  { nome: "d3d11", flags: ["--use-angle=d3d11"] },
  { nome: "swiftshader", flags: ["--enable-unsafe-swiftshader"] },
];

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new Error("argumento inesperado: " + a);
    const k = a.slice(2);
    if (k === "manter" || k === "verbose") { o[k] = true; continue; }
    o[k] = argv[++i];
    if (o[k] === undefined) throw new Error("falta o valor de --" + k);
  }
  return o;
}

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- servidor estatico minimo (o import de modulos e o fetch nao andam em file://) ----
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".css": "text/css",
  ".bin": "application/octet-stream", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml" };
function servidor(extras) {
  const srv = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      let rel = decodeURIComponent(url.pathname);
      let ficheiro;
      if (extras[rel]) ficheiro = extras[rel];
      else {
        ficheiro = path.resolve(RAIZ, "." + rel);
        if (ficheiro !== RAIZ && !ficheiro.startsWith(RAIZ + path.sep)) { res.writeHead(403).end(); return; }
        if (fs.existsSync(ficheiro) && fs.statSync(ficheiro).isDirectory()) ficheiro = path.join(ficheiro, "index.html");
      }
      if (!fs.existsSync(ficheiro)) { res.writeHead(404).end("nao existe"); return; }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(ficheiro).toLowerCase()] || "application/octet-stream",
                           "Cache-Control": "no-store" });
      fs.createReadStream(ficheiro).pipe(res);
    } catch (e) { res.writeHead(500).end(String(e)); }
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

// ---- navegador ----
function acharNavegador(pedido) {
  const cands = [pedido, process.env.EDGE_PATH,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].filter(Boolean);
  const c = cands.find((p) => fs.existsSync(p));
  if (!c) throw new Error("nao achei o Edge/Chrome (use --navegador <caminho>); NAO instale nada sem falar com o Lucas");
  return c;
}

class Cdp {
  constructor(wsUrl) {
    this.id = 0; this.pend = new Map(); this.ouv = [];
    this.ws = new WebSocket(wsUrl);
    this.pronto = new Promise((ok, no) => { this.ws.onopen = ok; this.ws.onerror = () => no(new Error("WebSocket do navegador falhou")); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pend.has(m.id)) {
        const p = this.pend.get(m.id); this.pend.delete(m.id);
        if (m.error) p.no(new Error(m.error.message)); else p.ok(m.result);
      } else if (m.method) this.ouv.forEach((f) => f(m));
    };
  }
  envia(method, params) {
    const id = ++this.id;
    return new Promise((ok, no) => { this.pend.set(id, { ok, no }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); });
  }
  fecha() { try { this.ws.close(); } catch (e) {} }
}

async function abrirNavegador(exe, flagsGpu, [W, H]) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "gravar-camera-perfil-"));
  const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + perfil,
    "--hide-scrollbars", "--mute-audio", "--no-first-run", "--no-default-browser-check",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--window-size=" + W + "," + H, ...flagsGpu, "about:blank"], { stdio: "ignore" });
  let saiu = false;
  proc.on("exit", () => { saiu = true; });
  const fich = path.join(perfil, "DevToolsActivePort");
  let porta = null;
  for (let i = 0; i < 200 && !porta; i++) {
    if (saiu) throw new Error("o navegador fechou ao arrancar");
    if (fs.existsSync(fich)) porta = fs.readFileSync(fich, "utf8").split(/\r?\n/)[0].trim();
    if (!porta) await dorme(100);
  }
  if (!porta) { proc.kill(); throw new Error("o navegador nao abriu a porta DevTools"); }
  let pagina = null;
  for (let i = 0; i < 50 && !pagina; i++) {
    try {
      const lista = await (await fetch("http://127.0.0.1:" + porta + "/json/list")).json();
      pagina = lista.find((t) => t.type === "page");
    } catch (e) {}
    if (!pagina) await dorme(100);
  }
  if (!pagina) { proc.kill(); throw new Error("nao achei a pagina do navegador"); }
  const cdp = new Cdp(pagina.webSocketDebuggerUrl);
  await cdp.pronto;
  const fechar = async () => {
    cdp.fecha();
    try { proc.kill(); } catch (e) {}
    await dorme(300);
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {}
  };
  return { cdp, fechar };
}

async function avaliar(cdp, expressao) {
  const r = await cdp.envia("Runtime.evaluate", { expression: expressao, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error((d.exception && (d.exception.description || d.exception.value)) || d.text);
  }
  return r.result.value;
}

// grava UM formato; devolve { ficheiro, quadros, s, gpu }
async function gravarFormato(cfg, formato) {
  const dim = FORMATOS[formato];
  const exe = acharNavegador(cfg.navegador);
  const erros = [];
  for (const gpu of GPUS) {
    let nav = null;
    try {
      nav = await abrirNavegador(exe, gpu.flags, dim);
      const { cdp } = nav;
      await cdp.envia("Page.enable");
      await cdp.envia("Runtime.enable");
      await cdp.envia("Log.enable");
      await cdp.envia("Emulation.setDeviceMetricsOverride", { width: dim[0], height: dim[1], deviceScaleFactor: 1, mobile: false });
      const logs = [];
      cdp.ouv.push((m) => {
        let l = null;
        if (m.method === "Runtime.exceptionThrown") l = "excecao: " + JSON.stringify(m.params.exceptionDetails.exception || m.params.exceptionDetails.text).slice(0, 300);
        else if (m.method === "Runtime.consoleAPICalled" && /error|warning/.test(m.params.type))
          l = "console." + m.params.type + ": " + m.params.args.map((x) => x.value || x.description || "").join(" ").slice(0, 300);
        else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") l = "log: " + m.params.entry.text + " " + (m.params.entry.url || "");
        if (l && cfg.verbose) console.log("    " + l);
      });
      console.log("[" + formato + "] a abrir a pagina (GPU: " + gpu.nome + ")...");
      await cdp.envia("Page.navigate", { url: cfg.url });
      console.log("[" + formato + "] a esperar o mapa 3D e o replay...");
      // espera o mapa e o replay; se o WebGL nao vier, cai para a proxima flag
      await avaliar(cdp, `(async()=>{const t0=Date.now();while(!window.gravacaoPronta){if(Date.now()-t0>20000)throw new Error('a pagina nao abriu em modo gravar');await new Promise(r=>setTimeout(r,100));}
        await Promise.race([window.gravacaoPronta,new Promise((_,no)=>setTimeout(()=>no(new Error('o mapa 3D nao ficou pronto em 120 s')),120000))]); return true;})()`);
      const durPag = await avaliar(cdp, "window.duracaoGravacao");
      const dur = cfg.duracao ? Math.min(cfg.duracao, durPag) : durPag;
      if (cfg.duracao && cfg.duracao > durPag + 1e-6)
        console.warn("aviso: o replay so tem " + durPag.toFixed(1) + " s a partir daqui; grava so isso");
      const total = Math.round(dur * FPS);
      const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "gravar-camera-quadros-"));
      fs.mkdirSync(cfg.saida, { recursive: true });
      const nome = cfg.base + "_" + formato + ".mp4";
      const destino = path.join(cfg.saida, nome);
      console.log("[" + formato + "] " + dim[0] + "x" + dim[1] + ", " + total + " quadros, GPU: " + gpu.nome);
      const t0 = Date.now();
      try {
        for (let n = 0; n < total; n++) {
          await avaliar(cdp, "gravarQuadro(" + n + ")");
          const shot = await cdp.envia("Page.captureScreenshot", { format: "png" });
          fs.writeFileSync(path.join(pasta, String(n).padStart(5, "0") + ".png"), Buffer.from(shot.data, "base64"));
          if (n % 10 === 9 || n === total - 1) {
            const s = (Date.now() - t0) / 1000;
            process.stdout.write("\r  quadro " + (n + 1) + "/" + total + "  " + (s / (n + 1)).toFixed(2) + " s/quadro  ");
          }
        }
        process.stdout.write("\n");
        const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS),
          "-i", path.join(pasta, "%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
          "-movflags", "+faststart", destino], { stdio: "inherit" });
        if (ff.status !== 0) throw new Error("o ffmpeg falhou (codigo " + ff.status + ")");
      } finally {
        if (cfg.manter) console.log("quadros mantidos em " + pasta);
        else try { fs.rmSync(pasta, { recursive: true, force: true }); } catch (e) {}
      }
      const segs = (Date.now() - t0) / 1000;
      console.log("[" + formato + "] " + destino + " (" + segs.toFixed(0) + " s)");
      await nav.fechar(); nav = null;
      return { ficheiro: destino, quadros: total, segundos: segs, gpu: gpu.nome };
    } catch (e) {
      erros.push(gpu.nome + ": " + e.message);
      if (nav) await nav.fechar();
      // so vale tentar outra GPU se o problema foi abrir o mapa; erro a meio da gravacao e definitivo
      if (!/mapa 3D|WebGL|nao abriu|3d nao/i.test(e.message)) throw e;
      console.warn("  [" + gpu.nome + "] sem WebGL/mapa: " + e.message);
    }
  }
  throw new Error("nenhuma opcao de GPU deu WebGL no navegador:\n  " + erros.join("\n  ")
    + "\nPare e fale com o Lucas: nao se instala navegador nem driver sem ele.");
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.replay) throw new Error("falta --replay <ficheiro .replay.json>");
  const extras = {};
  const mapear = (p, rotaExterna) => {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) throw new Error("nao existe: " + p);
    const rel = path.relative(RAIZ, abs);
    if (!rel.startsWith("..") && !path.isAbsolute(rel)) return "/" + rel.split(path.sep).join("/");
    extras[rotaExterna] = abs;   // fora do repo: serve-se por uma rota fixa
    return rotaExterna;
  };
  const replayUrl = mapear(a.replay, "/__ext/replay.json");
  const q = ["replay=" + encodeURIComponent(replayUrl), "gravar=1"];
  if (a.roteiro) q.push("roteiro=" + encodeURIComponent(mapear(a.roteiro, "/__ext/roteiro.json")));
  if (a.inicio) q.push("inicio=" + parseInt(a.inicio, 10));
  if (a.seg) q.push("segPorTurno=" + parseFloat(a.seg));
  const formato = a.formato || "ambos";
  const formatos = formato === "ambos" ? ["vertical", "horizontal"] : [formato];
  for (const f of formatos) if (!FORMATOS[f]) throw new Error("--formato: vertical | horizontal | ambos");
  const srv = await servidor(extras);
  try {
    const porta = srv.address().port;
    const cfg = {
      url: "http://127.0.0.1:" + porta + "/index.html?" + q.join("&"),
      duracao: a.duracao ? parseFloat(a.duracao) : null,
      saida: path.resolve(a.saida || path.join(RAIZ, "videos", "camera")),
      base: path.basename(a.replay).replace(/\.replay\.json$|\.json$/i, ""),
      navegador: a.navegador, manter: !!a.manter, verbose: !!a.verbose,
    };
    const res = [];
    for (const f of formatos) res.push(await gravarFormato(cfg, f));   // um de cada vez: RAM
    console.log("\npronto:");
    for (const r of res) console.log("  " + r.ficheiro + "  " + r.quadros + " quadros, " + r.segundos.toFixed(0) + " s, GPU " + r.gpu);
  } finally {
    srv.close();
  }
}

main().then(() => process.exit(0), (e) => { console.error("erro: " + e.message); process.exit(1); });
