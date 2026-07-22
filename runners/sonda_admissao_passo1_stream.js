// ============================================================
//  sonda_admissao_passo1_stream.js — PASSO 1 com STREAMING + timeout longo
// ------------------------------------------------------------
//  So para capturar a resposta CRUA de modelos lentos (qwen3 thinking),
//  removendo o confound do timeout de transporte do fetch padrao. NAO
//  altera rei.js, engine, parser, schema nem CONFIG: usa o MESMO prompt
//  real (montarPrompt) e o MESMO endpoint/payload do clienteOllama
//  (options.temperature=0), so que com stream:true para o socket receber
//  tokens continuamente e nao estourar o idle-timeout.
//
//  Grava DOIS canais separados para inspecao honesta:
//    - response  : o que data.response acumularia (o que o parser veria)
//    - thinking  : o canal de raciocinio (se o Ollama separar)
//  O ficheiro _cru.txt guarda EXATAMENTE o campo `response` (o canal do
//  parser). O raciocinio vai para _thinking.txt a parte.
//    uso: node sonda_admissao_passo1_stream.js "ollama:qwen3:8b"
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");

const modeloId = process.argv[2] || "ollama:qwen3:8b";
const modelo = modeloId.replace(/^ollama:/i, "");
const arqNome = modelo.replace(/[:\\/]/g, "-");
const dirTraces = path.join(__dirname, "..", "traces", "admissao");
const arqCru = path.join(dirTraces, `${arqNome}_cru.txt`);
const arqThink = path.join(dirTraces, `${arqNome}_thinking.txt`);
const TIMEOUT_MS = 1200000; // 20 min de teto duro

(async function main() {
  fs.mkdirSync(dirTraces, { recursive: true });

  const estado = Engine.criarEstadoInicial(Engine.CONFIG);
  const visao = Engine.montarVisao(estado, "B");
  const prompt = Engine.montarPrompt(visao);

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  let resposta = "", thinking = "";
  let chunks = 0, erro = null, doneReason = null, evalCount = null, promptEval = null;

  try {
    const resp = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // payload identico ao clienteOllama, so stream:true
      body: JSON.stringify({ model: modelo, prompt, stream: true, options: { temperature: 0 } }),
      signal: ac.signal,
    });
    if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const linha = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!linha) continue;
        let o;
        try { o = JSON.parse(linha); } catch { continue; }
        if (typeof o.response === "string") resposta += o.response;
        if (typeof o.thinking === "string") thinking += o.thinking;
        chunks++;
        if (o.done) {
          doneReason = o.done_reason || "done";
          evalCount = o.eval_count != null ? o.eval_count : evalCount;
          promptEval = o.prompt_eval_count != null ? o.prompt_eval_count : promptEval;
        }
      }
    }
  } catch (e) {
    erro = e.name === "AbortError" ? `TIMEOUT apos ${TIMEOUT_MS/1000}s` : e.message;
  } finally {
    clearTimeout(to);
  }
  const segs = ((Date.now() - t0) / 1000).toFixed(1);

  // GRAVA CRU = exatamente o campo response (o que o parser consumiria).
  fs.writeFileSync(arqCru, resposta, "utf8");
  fs.writeFileSync(arqThink, thinking, "utf8");

  console.log("=== SONDA PASSO 1 (streaming) ===");
  console.log("modelo        :", "ollama:" + modelo);
  console.log("arquivo cru   :", path.relative(path.join(__dirname, ".."), arqCru), "(= campo response)");
  console.log("arquivo think :", path.relative(path.join(__dirname, ".."), arqThink));
  console.log("tempo         :", segs + "s");
  console.log("chunks        :", chunks, "| done_reason:", doneReason, "| erro:", erro);
  console.log("eval_count    :", evalCount, "| prompt_eval:", promptEval);
  console.log("len response  :", resposta.length, "| len thinking:", thinking.length);
  console.log("--- response: PRIMEIROS 300 CHARS (literal) ---");
  console.log(JSON.stringify(resposta.slice(0, 300)));
  console.log("--- thinking: PRIMEIROS 200 CHARS (literal) ---");
  console.log(JSON.stringify(thinking.slice(0, 200)));
  console.log("--- FIM ---");
})();
