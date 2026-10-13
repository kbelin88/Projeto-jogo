#!/usr/bin/env node
// gravar_clipes.js — os clipes 3D dos Shorts da Cidade de Agentes (13/10/2026).
//
// Um "trabalho" (JSON) com o replay e uma lista de clipes; cada clipe e um momento do Short:
//   { "replay": "<.replay.json completo>", "modo": "clipes" | "fotos", "formato": "vertical",
//     "clipes": [ { "inicio": turno, "fim": turno, "duracao": s, "acao": s, "roteiro": {keyframes}, "saida": "<.mp4|.jpg>" } ] }
//
// O replay anda do turno `inicio` ao turno `fim` e chega la aos `acao` segundos do clipe (os segundos por turno
// saem disso); depois fica no estado do turno `fim` (as tropas e o mar continuam). A camera segue o roteiro no
// tempo do FILME (0 = o inicio do clipe); os alvos podem ser uma aldeia, uma lista de aldeias (o centro delas) ou
// "mapa" (o centro do mapa). modo "fotos": um quadro por clipe, aos `acao` segundos (para ver depressa);
// modo "clipes": o MP4 inteiro, 30 fps.
//
//   node ferramentas/gravar_clipes.js --trabalho trabalho.json
//
// Usa o que o gravar_camera.js ja tem (o servidor, o Edge sem janela, o protocolo DevTools) e o ffmpeg.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const G = require("./gravar_camera.js");

const ESPERAR_MAPA = `(async()=>{const t0=Date.now();while(!window.gravacaoPronta){if(Date.now()-t0>20000)throw new Error('a pagina nao abriu em modo gravar');await new Promise(r=>setTimeout(r,100));}
  await Promise.race([window.gravacaoPronta,new Promise((_,no)=>setTimeout(()=>no(new Error('o mapa 3D nao ficou pronto em 120 s')),120000))]);
  if(typeof window.configurarGravacao!=='function')throw new Error('o index.html do jogo nao tem configurarGravacao');return true;})()`;

async function abrirClipe(cdp, url, c) {
  await cdp.envia("Page.navigate", { url });
  await G.avaliar(cdp, ESPERAR_MAPA);
  // 1.o os segundos por turno: com seg=1, o turno `fim` chega aos M segundos -> seg = acao / M
  const r1 = await G.avaliar(cdp, "configurarGravacao(" + JSON.stringify({ seg: 1, fimTurno: c.fim }) + ")");
  const seg = r1.tFim > 0 ? Math.min(4, Math.max(0.35, c.acao / r1.tFim)) : 1;
  return G.avaliar(cdp, "configurarGravacao(" + JSON.stringify({ seg, fimTurno: c.fim, cameraNoFilme: true, roteiro: c.roteiro }) + ")");
}

async function foto(cdp, ficheiro, qualidade) {
  const shot = await cdp.envia("Page.captureScreenshot", { format: "jpeg", quality: qualidade, optimizeForSpeed: true });
  fs.writeFileSync(ficheiro, Buffer.from(shot.data, "base64"));
}

async function main() {
  const i = process.argv.indexOf("--trabalho");
  if (i < 0 || !process.argv[i + 1]) throw new Error("uso: --trabalho <trabalho.json>");
  const job = JSON.parse(fs.readFileSync(process.argv[i + 1], "utf8"));
  const dim = G.FORMATOS[job.formato || "vertical"];
  if (!dim) throw new Error("formato: vertical | horizontal");
  const srv = await G.servidor({ "/__ext/replay.json": path.resolve(job.replay) });
  const base = "http://127.0.0.1:" + srv.address().port + "/index.html?replay=" + encodeURIComponent("/__ext/replay.json") + "&gravar=1";
  const exe = G.acharNavegador(job.navegador);
  let nav = null;
  const t0 = Date.now();
  try {
    // a GPU: a primeira opcao que abrir o mapa 3D (como no gravar_camera)
    const erros = [];
    let pronto = null;
    for (const gpu of G.GPUS) {
      try {
        nav = await G.abrirNavegador(exe, gpu.flags, dim);
        await nav.cdp.envia("Page.enable");
        await nav.cdp.envia("Runtime.enable");
        await nav.cdp.envia("Emulation.setDeviceMetricsOverride", { width: dim[0], height: dim[1], deviceScaleFactor: 1, mobile: false });
        pronto = await abrirClipe(nav.cdp, base + "&inicio=" + job.clipes[0].inicio, job.clipes[0]);
        console.log("GPU: " + gpu.nome);
        break;
      } catch (e) {
        erros.push(gpu.nome + ": " + e.message);
        if (nav) { await nav.fechar(); nav = null; }
        if (!/mapa 3D|WebGL|nao abriu|3d nao/i.test(e.message)) throw e;
      }
    }
    if (!nav) throw new Error("nenhuma GPU abriu o mapa 3D:\n  " + erros.join("\n  "));
    const { cdp } = nav;
    for (let k = 0; k < job.clipes.length; k++) {
      const c = job.clipes[k];
      if (k > 0) pronto = await abrirClipe(cdp, base + "&inicio=" + c.inicio, c);
      fs.mkdirSync(path.dirname(c.saida), { recursive: true });
      if (job.modo === "fotos") {
        const n = Math.round(c.acao * G.FPS);
        for (let j = 0; j < 4; j++) await G.avaliar(cdp, "gravarQuadro(" + n + ")");   // as tropas assentam
        await foto(cdp, c.saida, 88);
        console.log("foto " + (k + 1) + "/" + job.clipes.length + " (turnos " + c.inicio + "-" + c.fim + ", " + pronto.seg.toFixed(2) + " s/turno)");
        continue;
      }
      const total = Math.round(c.duracao * G.FPS);
      const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "gravar-clipes-quadros-"));
      const tc = Date.now();
      try {
        for (let n = 0; n < total; n++) {
          await G.avaliar(cdp, "gravarQuadro(" + n + ")");
          await foto(cdp, path.join(pasta, String(n).padStart(5, "0") + ".jpg"), 92);
        }
        const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(G.FPS), "-i", path.join(pasta, "%05d.jpg"),
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", c.saida], { stdio: "inherit" });
        if (ff.status !== 0) throw new Error("o ffmpeg falhou (codigo " + ff.status + ")");
      } finally {
        try { fs.rmSync(pasta, { recursive: true, force: true }); } catch (e) {}
      }
      const s = (Date.now() - tc) / 1000;
      console.log("clipe " + (k + 1) + "/" + job.clipes.length + ": " + total + " quadros em " + s.toFixed(0) + " s ("
        + (s / Math.max(1, total)).toFixed(2) + " s/quadro, turnos " + c.inicio + "-" + c.fim + ", " + pronto.seg.toFixed(2) + " s/turno)");
    }
  } finally {
    if (nav) await nav.fechar();
    srv.close();
  }
  console.log("pronto em " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
}

main().then(() => process.exit(0), (e) => { console.error("erro: " + e.message); process.exit(1); });
