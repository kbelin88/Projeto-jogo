// ============================================================
//  test_v1_peca2_prompt.js  —  V1 PECA 2, PEDACO 1 (montarPrompt)
// ------------------------------------------------------------
//  Rodar:  node test_v1_peca2_prompt.js
//
//  ENTREGAVEL: imprime o PROMPT COMPLETO de um turno real, legivel,
//  como o qwen vai receber. NADA de Ollama aqui (funcao pura).
//  Depois confere a estrutura exigida pela spec.
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;

// turno real de uma partida burro-vs-burro (visao do Rei B)
const estado = Engine.criarEstadoInicial(CONFIG);
for (let i = 0; i < 5; i++) Engine.rodarTurno(estado, null);
const visao = Engine.montarVisao(estado, "B");
const prompt = Engine.montarPrompt(visao);

console.log("============ PROMPT COMPLETO (turno real, visao do Rei B) ============");
console.log(prompt);
console.log("======================================================================\n");

// ---- conferencias da estrutura (tarefa -> dados -> formato; exemplo por ultimo) ----
let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

const iTopo = prompt.indexOf("Voce e o Rei");
const iDados = prompt.indexOf("=== SUAS ALDEIAS");
const iFormato = prompt.indexOf("Responda APENAS com um JSON");
const iVazio = prompt.indexOf("Listas vazias sao uma resposta valida");
const iExemplo = prompt.lastIndexOf("{");

console.log("Conferencias do Pedaco 1:");
checa("funcao pura (mesma visao -> mesmo prompt)", prompt === Engine.montarPrompt(visao));
checa("TOPO: identidade + tarefa", iTopo >= 0 && /objetivo e vencer/.test(prompt));
checa("MEIO: relatorioTexto integral injetado", iDados > iTopo && prompt.includes("=== FORCA TOTAL"));
checa("FIM: instrucao de formato presente", iFormato > iDados);
checa("permissao de vazio presente", iVazio > iFormato);
checa('permissao de vazio SEM a palavra "estrategico"', !/estrateg/i.test(prompt));
const iProcesso = prompt.indexOf("Antes de responder:");
checa("instrucao de PROCESSO antes do exemplo", iProcesso > iVazio && iProcesso < iExemplo);
checa("EXEMPLO depois de tudo (ordem tarefa->dados->formato)", iExemplo > iProcesso);
checa("prompt TERMINA com '}' (exemplo e a ultima coisa)", prompt.trimEnd().endsWith("}"));
checa("exemplo: tropas com os 3 tipos (inclusive zero)", /"lanceiro": 0|"arqueiro": 0|"cavaleiro": 0/.test(prompt));
checa('topo NAO nomeia "lado A/B"', !/lado [AB]/i.test(prompt));

// EXEMPLO ANCORADO: origem = id real de SUAS ALDEIAS; destino = id real de um alvo.
const exemplo = Engine.exemploAncorado(visao);
const origemReal = visao.minhas[0].id;
const idsAlvos = visao.alvos.map((a) => a.id);
const mOrigem = exemplo.match(/"origemId": (\d+)/);
const mDestino = exemplo.match(/"destinoId": (\d+)/);
checa("exemplo usa origemId REAL (de SUAS ALDEIAS)", mOrigem && Number(mOrigem[1]) === origemReal, mOrigem && mOrigem[1]);
checa("exemplo usa aldeiaId REAL em construir", new RegExp(`"aldeiaId": ${origemReal}`).test(exemplo));
checa("exemplo usa destinoId REAL (alvo presente na visao)", mDestino && idsAlvos.includes(Number(mDestino[1])), mDestino && mDestino[1]);
// TODOS os ids do exemplo existem no estado (origem nas minhas, destinos em alvos/minhas)
const idsExemplo = [...exemplo.matchAll(/"(?:aldeiaId|origemId|destinoId)": (\d+)/g)].map((m) => Number(m[1]));
const idsReais = new Set([...visao.minhas.map((a) => a.id), ...idsAlvos]);
checa("TODOS os ids do exemplo existem na visao", idsExemplo.length > 0 && idsExemplo.every((id) => idsReais.has(id)), `[${idsExemplo.join(",")}]`);

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
