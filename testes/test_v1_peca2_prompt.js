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
const iExemplo = prompt.lastIndexOf("{");

console.log("Conferencias do Pedaco 1:");
checa("funcao pura (mesma visao -> mesmo prompt)", prompt === Engine.montarPrompt(visao));
checa("TOPO: objetivo = conquistar a capital (nao 'eliminar')",
  iTopo >= 0 && /conquistar a CAPITAL inimiga/.test(prompt) && !/eliminando o inimigo/.test(prompt));
checa("MEIO: relatorioTexto integral injetado", iDados > iTopo && prompt.includes("=== ALDEIAS NEUTRAS"));
checa("FIM: instrucao de formato presente", iFormato > iDados);
// A frase de cautela ("E melhor nao fazer nada...") foi removida em
// exp-cautela-2x2 (braco B): congelava o llama3:8b. Guarda de regressao:
// nao reintroduzir nem ela nem a palavra "estrategico".
checa("frase de cautela AUSENTE (braco B aplicado)", !prompt.includes("Listas vazias sao uma resposta valida") && !/melhor nao fazer nada/i.test(prompt));
checa('prompt SEM a palavra "estrategico"', !/estrateg/i.test(prompt));
const iProcesso = prompt.indexOf("Antes de responder:");
checa("instrucao de PROCESSO antes do exemplo", iProcesso > iFormato && iProcesso < iExemplo);
checa("EXEMPLO depois de tudo (ordem tarefa->dados->formato)", iExemplo > iProcesso);
checa("prompt TERMINA com '}' (exemplo e a ultima coisa)", prompt.trimEnd().endsWith("}"));
checa("exemplo: tropas com os 3 tipos (inclusive zero)", /"lanceiro": 0|"arqueiro": 0|"cavaleiro": 0/.test(prompt));
checa('topo NAO nomeia "lado A/B"', !/lado [AB]/i.test(prompt));

// REGRAS DE COMBATE (triangulo v2): bloco gerado da CONFIG, entre topo e dados
const iRegras = prompt.indexOf("=== REGRAS DE COMBATE ===");
checa("REGRAS: bloco presente entre topo e dados", iRegras > iTopo && iRegras < iDados);
checa("REGRAS: bonus vem da CONFIG", prompt.includes(`tropas x ${CONFIG.bonus_forca_triangulo}`));
// Guarda DERIVADA da CONFIG (nao fixa a redacao): os tres pares do triangulo
// e o multiplicador presentes no bloco de combate. Sobrevive a mudancas de texto.
const blocoCombate = prompt.slice(iRegras, prompt.indexOf("=== REGRAS DE ECONOMIA ==="));
for (const t of ["lanceiro", "arqueiro", "cavaleiro"]) {
  const alvoTri = CONFIG.triangulo[t];
  checa(`REGRAS: par de counter ${t}->${alvoTri} presente (sem fixar redacao)`,
    new RegExp(`${t}\\b[^\\n]*\\b${alvoTri}\\b`).test(blocoCombate));
}
checa("REGRAS: multiplicador do triangulo vem da CONFIG",
  blocoCombate.includes(String(CONFIG.bonus_forca_triangulo)));
checa("REGRAS: exemplo numerico presente", /-> o atacante vence/.test(prompt));

// REGRAS DE ECONOMIA: bloco gerado da CONFIG, entre topo e dados
const iEco = prompt.indexOf("=== REGRAS DE ECONOMIA ===");
checa("ECONOMIA: bloco presente entre topo e dados", iEco > iTopo && iEco < iDados);
checa("ECONOMIA: custo do lanceiro vem da CONFIG",
  prompt.includes(`lanceiro: custa ${CONFIG.tropas.lanceiro.custo.madeira} madeira`));
checa("ECONOMIA: producao por turno vem da CONFIG",
  prompt.includes(`produz ${CONFIG.producao.madeira} madeira e ${CONFIG.producao.ferro} ferro`));
checa("ECONOMIA: teto de forca presente",
  !CONFIG.limite_forca_aldeia || prompt.includes(`atinge ${CONFIG.limite_forca_aldeia}`));

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