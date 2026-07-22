// ============================================================
//  sonda_admissao_passo1.js — SONDA DE ADMISSAO (PASSO 1: resposta crua)
// ------------------------------------------------------------
//  Teste de CANAL, nao de agencia/validade. Nao altera montarPrompt,
//  schema, CONFIG, engine nem parser. Uma unica chamada por modelo com
//  o prompt REAL do turno inicial (seed 1, temp 0). Grava a resposta
//  CRUA em ficheiro ANTES de qualquer parsing.
//    uso: node sonda_admissao_passo1.js "ollama:qwen3:8b"
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");
const Rei = require("../rei.js");

const modeloId = process.argv[2] || "ollama:qwen3:8b";
const nomeModelo = modeloId.replace(/^ollama:/i, "");         // qwen3:8b
const arqNome = nomeModelo.replace(/[:\\/]/g, "-");           // qwen3-8b (': ' invalido no Windows)
const dirTraces = path.join(__dirname, "..", "traces", "admissao");
const arqCru = path.join(dirTraces, `${arqNome}_cru.txt`);

(async function main() {
  fs.mkdirSync(dirTraces, { recursive: true });
  const cliente = Rei.criarCliente(modeloId, { temperatura: 0 });

  // prompt REAL do turno inicial: estado inicial (seed 1) -> visao do Rei B -> montarPrompt
  const estado = Engine.criarEstadoInicial(Engine.CONFIG);
  const visao = Engine.montarVisao(estado, "B");
  const prompt = Engine.montarPrompt(visao); // ATUAL (ja com B_SEM_CAUTELA)

  const t0 = Date.now();
  let cru = "", erro = null;
  try { cru = await cliente.gerar(prompt); }
  catch (e) { erro = e.message; }
  const segs = ((Date.now() - t0) / 1000).toFixed(1);

  // GRAVAR CRU ANTES DE QUALQUER PARSING
  const conteudo = erro ? `[ERRO DE REDE] ${erro}` : cru;
  fs.writeFileSync(arqCru, conteudo, "utf8");

  console.log("=== SONDA PASSO 1 ===");
  console.log("modelo      :", cliente.nome);
  console.log("arquivo cru :", path.relative(path.join(__dirname, ".."), arqCru));
  console.log("tempo       :", segs + "s");
  console.log("tam. cru    :", conteudo.length, "chars");
  console.log("tokens      :", JSON.stringify(cliente.ultimosTokens));
  console.log("--- PRIMEIROS 300 CHARS (literal) ---");
  console.log(JSON.stringify(conteudo.slice(0, 300)));
  console.log("--- FIM ---");
})();
