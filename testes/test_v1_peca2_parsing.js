// ============================================================
//  test_v1_peca2_parsing.js  —  V1 PECA 2, PEDACO 3 (parsing+validacao)
// ------------------------------------------------------------
//  Rodar:  node test_v1_peca2_parsing.js
//
//  Exercita parsearOrdem + diagnosticarOrdem com a SUJEIRA que um modelo
//  pequeno produz (cercas ```json, texto em volta, JSON quebrado) e com
//  ordens INVALIDAS contra o estado. SEM RETRY: falha -> ordem vazia.
//  NADA de Ollama.
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;

let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

// ---------- (A) EXTRACAO / PARSE de respostas CRUAS sujas ----------
console.log("=== (A) parsearOrdem com respostas cruas tipicas do qwen ===");

const limpo = '{"construir":[{"aldeiaId":1,"tipo":"lanceiro"}],"envios":[]}';
const comCercas = "Claro! Aqui esta:\n```json\n" + limpo + "\n```\nEspero ter ajudado.";
const comTexto = "Vou atacar a aldeia 7.\n" + '{"construir":[],"envios":[{"origemId":1,"destinoId":7,"tropas":{"lanceiro":5,"arqueiro":0,"cavaleiro":0}}]}';
const quebrado = "```json\n{ \"construir\": [ {\"aldeiaId\": 1, \"tipo\": \"lanceiro\" } ,, ]"; // virgula dupla + nao fecha
const semJson = "Desculpe, nao posso ajudar com isso.";
const aninhado = 'texto {"construir":[],"envios":[{"origemId":1,"destinoId":2,"tropas":{"lanceiro":1,"arqueiro":0,"cavaleiro":0}}]} fim';

let r;
r = Engine.parsearOrdem(comCercas);
checa("cercas ```json: extrai e parseia", r.ok && r.ordem.construir.length === 1);
r = Engine.parsearOrdem(comTexto);
checa("texto antes do JSON: extrai e parseia", r.ok && r.ordem.envios.length === 1);
r = Engine.parsearOrdem(quebrado);
checa("JSON quebrado: ok=false e ORDEM VAZIA", !r.ok && r.ordem.construir.length === 0 && r.ordem.envios.length === 0, r.erro);
r = Engine.parsearOrdem(semJson);
checa("sem bloco {...}: ok=false e ordem vazia", !r.ok && r.ordem.envios.length === 0, r.erro);
r = Engine.parsearOrdem(aninhado);
checa("bloco com objeto aninhado: extrai o externo inteiro", r.ok && r.ordem.envios[0].destinoId === 2);
checa("nunca lanca (entrada nao-string)", (function () { try { Engine.parsearOrdem(null); Engine.parsearOrdem(123); return true; } catch (e) { return false; } })());

// ---------- (B) VALIDACAO contra o estado (LOGAR rejeicoes) ----------
console.log("\n=== (B) diagnosticarOrdem: o que e aceito vs rejeitado (e por que) ===");

// estado minimo controlado: Rei B tem a aldeia 1 (alguns lanceiros, pouco recurso)
function aldeia(id, dono, tipo, tropas, recursos) {
  return {
    id, x: 100, y: 100, nome: "Vila" + id, dono, tipo: tipo || null,
    recursos: recursos || { madeira: 0, ferro: 0 },
    tropas: Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {}),
    construindo: [],
  };
}
const estado = {
  config: CONFIG,
  turno: 1,
  movimentos: [],
  log: [],
  aldeias: [
    aldeia(1, "B", null, { lanceiro: 10 }, { madeira: 15, ferro: 0 }), // da uma construcao de lanceiro (15m)
    aldeia(2, "A", null, { lanceiro: 5 }),                              // do inimigo
    aldeia(7, null, "cavaleiro", { cavaleiro: 20 }),                    // neutra
  ],
};

const ordem = {
  construir: [
    { aldeiaId: 1, tipo: "lanceiro" },     // OK (15m, tem 15m)
    { aldeiaId: 1, tipo: "lanceiro" },     // REJEITA: recurso ja gasto
    { aldeiaId: 1, tipo: "dragao" },       // REJEITA: tipo invalido
    { aldeiaId: 2, tipo: "lanceiro" },     // REJEITA: aldeia nao e sua
    { aldeiaId: 99, tipo: "lanceiro" },    // REJEITA: aldeia inexistente
  ],
  envios: [
    { origemId: 1, destinoId: 7, tropas: { lanceiro: 5, arqueiro: 0, cavaleiro: 0 } },   // OK (tem 10)
    { origemId: 1, destinoId: 7, tropas: { lanceiro: 50, arqueiro: 0, cavaleiro: 0 } },  // REJEITA: tropa que nao tem
    { origemId: 2, destinoId: 7, tropas: { lanceiro: 1, arqueiro: 0, cavaleiro: 0 } },   // REJEITA: origem nao e sua
    { origemId: 1, destinoId: 99, tropas: { lanceiro: 1, arqueiro: 0, cavaleiro: 0 } },  // REJEITA: destino inexistente
  ],
};

const diag = Engine.diagnosticarOrdem(estado, "B", ordem);
console.log("  ACEITO construir:", JSON.stringify(diag.aceitoConstruir));
console.log("  ACEITO envios   :", JSON.stringify(diag.aceitoEnvios.map((e) => ({ o: e.origemId, d: e.destinoId, t: e.tropas }))));
console.log("  REJEITADO:");
diag.rejeicoes.forEach((m) => console.log("    - " + m));

checa("aceita 1 construcao (recurso so da p/ uma)", diag.aceitoConstruir.length === 1);
checa("aceita 1 envio (so o que cabe nas tropas)", diag.aceitoEnvios.length === 1 && diag.aceitoEnvios[0].destinoId === 7);
checa("loga recurso insuficiente", diag.rejeicoes.some((m) => /recurso insuficiente/.test(m)));
checa("loga tipo invalido", diag.rejeicoes.some((m) => /tipo invalido/.test(m)));
checa("loga origem que nao e do Rei", diag.rejeicoes.some((m) => /nao e sua/.test(m)));
checa("loga id inexistente (aldeia/destino)", diag.rejeicoes.some((m) => /nao existe/.test(m)));
checa("loga tropa que nao tem", diag.rejeicoes.some((m) => /tropa que nao tem/.test(m)));

// diagnostico NAO muta o estado
checa("diagnosticar NAO muta o estado (tropas/recursos intactos)",
  estado.aldeias[0].tropas.lanceiro === 10 && estado.aldeias[0].recursos.madeira === 15 && estado.movimentos.length === 0);

// ---------- (C) ordem vazia = Rei "passa" o turno (caso NORMAL) ----------
console.log("\n=== (C) ordem vazia e caso normal ===");
const vazia = Engine.parsearOrdem(semJson).ordem;
checa("ordem vazia: executarOrdem nao lanca e nao cria movimento",
  (function () { Engine.executarOrdem(estado, "B", vazia); return estado.movimentos.length === 0; })());

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
