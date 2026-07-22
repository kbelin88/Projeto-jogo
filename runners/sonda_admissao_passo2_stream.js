// ============================================================
//  sonda_admissao_passo2_stream.js — PASSO 2 para modelos LENTOS (qwen3)
// ------------------------------------------------------------
//  IGUAL ao sonda_admissao_passo2.js, mas injeta um CLIENTE de streaming
//  (mesma interface { nome, gerar(prompt) } do clienteOllama) em
//  rodarPartidaRei INTACTO. Streaming so serve para o socket receber
//  tokens continuamente e nao estourar o idle-timeout do fetch com um
//  modelo que pensa ~16 min/turno. NAO altera rei.js, engine, parser,
//  montarPrompt, schema nem CONFIG. `gerar()` devolve o campo `response`
//  acumulado — EXATAMENTE o que o clienteOllama devolveria (o thinking
//  do qwen3 sai separado no campo `thinking`, fora do canal do parser).
//    uso: node sonda_admissao_passo2_stream.js "ollama:qwen3:8b" [maxTurnos]
// ============================================================
"use strict";
const Engine = require("../engine.js");
const Rei = require("../rei.js");

const modeloId = process.argv[2] || "ollama:qwen3:8b";
const modelo = modeloId.replace(/^ollama:/i, "");
const maxTurnos = parseInt(process.argv[3], 10) || 10;
const TIMEOUT_MS = 1800000; // 30 min por turno

// cliente de streaming — MESMA interface do clienteOllama, so que le o
// stream linha-a-linha e acumula `response` (canal do parser).
function clienteOllamaStream(modelo) {
  return {
    nome: `ollama-stream:${modelo}`,
    ultimosTokens: null,
    async gerar(prompt) {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
      try {
        const resp = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelo, prompt, stream: true, options: { temperature: 0 } }),
          signal: ac.signal,
        });
        if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "", resposta = "", evalCount = 0, promptEval = 0;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const linha = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!linha) continue;
            let o; try { o = JSON.parse(linha); } catch { continue; }
            if (typeof o.response === "string") resposta += o.response;
            if (o.done) { evalCount = o.eval_count || 0; promptEval = o.prompt_eval_count || 0; }
          }
        }
        this.ultimosTokens = { prompt: promptEval, resposta: evalCount };
        return resposta;
      } finally { clearTimeout(to); }
    },
  };
}

const cliente = clienteOllamaStream(modelo);
const linhas = [];
function onTurno(reg) {
  const parseou = !!reg.jsonValido;
  const valido = parseou && reg.rejeicoes.length === 0;
  const nAceito = reg.aceito.construir.length + reg.aceito.envios.length;
  linhas.push({ turno: reg.turno, parseou, valido });
  console.log(
    `turno ${String(reg.turno).padStart(2)} | parseou ${parseou ? "S" : "N"} | valido ${valido ? "S" : "N"}` +
    ` | rej ${reg.rejeicoes.length} | aceito ${nAceito} | cru ${(reg.cru||"").length}ch` +
    (reg.erroRede ? ` | REDE: ${reg.erroRede}` : "") +
    (!parseou && !reg.erroRede ? ` | PARSE: ${reg.erroParse}` : "")
  );
}

(async function main() {
  console.log(`=== SONDA PASSO 2 (streaming) === ${cliente.nome} | ${maxTurnos} turnos | seed=${Engine.CONFIG.seed} | temp 0`);
  const t0 = Date.now();
  await Rei.rodarPartidaRei({ cliente, ladoRei: "B", maxTurnos, onTurno });
  const segs = ((Date.now() - t0) / 1000).toFixed(1);
  const n = linhas.length;
  const nParse = linhas.filter((l) => l.parseou).length;
  const nValid = linhas.filter((l) => l.valido).length;
  console.log("\n=== RESUMO ===");
  console.log(`turnos do Rei : ${n} | tempo: ${segs}s`);
  console.log(`parseou       : ${nParse}/${n}`);
  console.log(`valido        : ${nValid}/${n}`);
  console.log(`CRITERIO ADMISSAO (>=8/10 parseou): ${nParse >= 8 ? "ADMITIDO" : "NAO ADMITIDO"}`);
})();
