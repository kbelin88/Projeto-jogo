// ============================================================
//  test_v1_normalizacao.js  —  H3: parser tolerante a variacao TRIVIAL
// ------------------------------------------------------------
//  Rodar:  node testes/test_v1_normalizacao.js
//
//  Contexto (partida 3B vs 3B de 03/07): llama escreveu "arqueiros"
//  (plural) e perdeu a jogada por UMA letra. Decisao de design:
//  NORMALIZAR com registro — Degrau 0->1 apenas (plural/caixa/acento/
//  espaco). Traducao ("archer") e tipo inventado sao ERRO REAL e ficam
//  intactos, para o eval continuar contando o desvio.
//
//  Regras testadas:
//  1. parsearOrdem normaliza `tipo` em construir e as CHAVES de
//     `tropas` em envios; devolve `normalizacoes: []` (sempre array).
//  2. Fora do escopo fica cru ("archer" nao vira "arqueiro").
//  3. diagnosticarOrdem para de MENTIR no envio: chave desconhecida
//     que zera o envio e nomeada na rejeicao (hoje diz so "zero
//     tropas" — feedback que nao descreve o erro alimenta o loop de
//     perseveracao do H2).
//  4. Equivalencia com o motor: ordem normalizada EXECUTA de verdade.
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

// ---------- (A) parsearOrdem: normalizacao do `tipo` em construir ----------
console.log("=== (A) construir: plural/caixa/acento/espaco viram tipo canonico ===");

let r = Engine.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"arqueiros"}],"envios":[]}');
checa("'arqueiros' -> 'arqueiro'", r.ok && r.ordem.construir[0].tipo === "arqueiro",
  JSON.stringify(r.ordem.construir[0]));
checa("normalizacao registrada (cru E normalizado no registro)",
  Array.isArray(r.normalizacoes) && r.normalizacoes.length === 1 &&
  /arqueiros/.test(r.normalizacoes[0]) && /arqueiro/.test(r.normalizacoes[0]),
  JSON.stringify(r.normalizacoes));

r = Engine.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":" Lanceiros "}],"envios":[]}');
checa("' Lanceiros ' (caixa+espaco+plural) -> 'lanceiro'",
  r.ordem.construir[0].tipo === "lanceiro", JSON.stringify(r.ordem.construir[0]));

r = Engine.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"cavaleir\u00f4"}],"envios":[]}');
checa("'cavaleir\u00f4' (acento) -> 'cavaleiro'", r.ordem.construir[0].tipo === "cavaleiro",
  JSON.stringify(r.ordem.construir[0]));

r = Engine.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"arqueiro"}],"envios":[]}');
checa("tipo ja canonico: intocado e SEM registro", r.ordem.construir[0].tipo === "arqueiro" &&
  r.normalizacoes.length === 0, JSON.stringify(r.normalizacoes));

r = Engine.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"archer"}],"envios":[]}');
checa("'archer' (traducao = erro REAL) fica CRU, sem registro",
  r.ordem.construir[0].tipo === "archer" && r.normalizacoes.length === 0,
  JSON.stringify(r.ordem.construir[0]));

r = Engine.parsearOrdem('{"construir":[{"aldeiaId":1}],"envios":[]}');
checa("tipo ausente: nao lanca, fica ausente", r.ok && r.ordem.construir[0].tipo === undefined);

// ---------- (B) parsearOrdem: chaves de `tropas` nos envios ----------
console.log("\n=== (B) envios: chaves de tropas normalizadas pelas mesmas regras ===");

r = Engine.parsearOrdem('{"construir":[],"envios":[{"origemId":1,"destinoId":2,"tropas":{"arqueiros":5}}]}');
checa("chave 'arqueiros' -> 'arqueiro' com valor preservado",
  r.ordem.envios[0].tropas.arqueiro === 5 && !("arqueiros" in r.ordem.envios[0].tropas),
  JSON.stringify(r.ordem.envios[0].tropas));
checa("registro da chave normalizada", r.normalizacoes.length === 1 &&
  /arqueiros/.test(r.normalizacoes[0]), JSON.stringify(r.normalizacoes));

r = Engine.parsearOrdem('{"construir":[],"envios":[{"origemId":1,"destinoId":2,"tropas":{"arqueiro":2,"arqueiros":3}}]}');
checa("colisao canonico+plural: SOMA (2+3=5) e registra",
  r.ordem.envios[0].tropas.arqueiro === 5, JSON.stringify(r.ordem.envios[0].tropas));

r = Engine.parsearOrdem('{"construir":[],"envios":[{"origemId":1,"destinoId":2,"tropas":{"Lanceiro":4}}]}');
checa("chave 'Lanceiro' (caixa) -> 'lanceiro'", r.ordem.envios[0].tropas.lanceiro === 4,
  JSON.stringify(r.ordem.envios[0].tropas));

r = Engine.parsearOrdem('{"construir":[],"envios":[{"origemId":1,"destinoId":2,"tropas":{"archer":5}}]}');
checa("chave 'archer' fica CRUA (erro real preservado p/ o diagnostico nomear)",
  r.ordem.envios[0].tropas.archer === 5, JSON.stringify(r.ordem.envios[0].tropas));

// contrato: normalizacoes SEMPRE array, mesmo em falha de parse
r = Engine.parsearOrdem("sem json nenhum aqui");
checa("falha de parse: normalizacoes = [] (contrato estavel)",
  Array.isArray(r.normalizacoes) && r.normalizacoes.length === 0);

// ---------- (C) diagnosticarOrdem: feedback HONESTO no envio ----------
console.log("\n=== (C) rejeicao de envio nomeia a chave desconhecida (fim do 'zero tropas' mentiroso) ===");

function aldeia(id, dono, tipo, tropas, recursos) {
  return {
    id, x: 100, y: 100, nome: "Vila" + id, dono, tipo: tipo || null,
    recursos: recursos || { madeira: 0, ferro: 0 },
    tropas: Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {}),
    construindo: [],
  };
}
const estado = {
  config: CONFIG, turno: 1, movimentos: [],
  aldeias: [
    aldeia(1, "B", null, { lanceiro: 10 }, { madeira: 100, ferro: 100 }),
    aldeia(2, "A", null, { lanceiro: 5 }),
  ],
};

// chave desconhecida zera o envio: a mensagem tem que dizer O QUE o modelo escreveu
let d = Engine.diagnosticarOrdem(estado, "B",
  { construir: [], envios: [{ origemId: 1, destinoId: 2, tropas: { archer: 5 } }] });
checa("envio zerado por chave desconhecida: rejeitado", d.aceitoEnvios.length === 0);
checa("mensagem NOMEIA 'archer' e ensina os tipos validos",
  d.rejeicoes.length === 1 && /archer/.test(d.rejeicoes[0]) && /lanceiro/.test(d.rejeicoes[0]),
  JSON.stringify(d.rejeicoes));

// tropas realmente vazias: mensagem antiga de zero tropas continua
d = Engine.diagnosticarOrdem(estado, "B",
  { construir: [], envios: [{ origemId: 1, destinoId: 2, tropas: {} }] });
checa("tropas {} de verdade: mantem 'zero tropas'",
  d.rejeicoes.length === 1 && /zero tropas/.test(d.rejeicoes[0]), JSON.stringify(d.rejeicoes));

// misto: parte valida VAI (motor manda o que existe), mas a chave ignorada e AVISADA
d = Engine.diagnosticarOrdem(estado, "B",
  { construir: [], envios: [{ origemId: 1, destinoId: 2, tropas: { archer: 3, lanceiro: 2 } }] });
checa("misto: envio valido aceito (espelha o motor)",
  d.aceitoEnvios.length === 1 && d.aceitoEnvios[0].tropas.lanceiro === 2,
  JSON.stringify(d.aceitoEnvios));
checa("misto: aviso nomeando a chave ignorada",
  d.rejeicoes.length === 1 && /archer/.test(d.rejeicoes[0]), JSON.stringify(d.rejeicoes));

// ---------- (D) equivalencia com o MOTOR: ordem normalizada EXECUTA ----------
console.log("\n=== (D) fim-a-fim: 'arqueiros' construido de verdade pelo motor ===");

const p = Engine.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"arqueiros"}],"envios":[]}');
const antes = estado.aldeias[0].recursos.madeira;
Engine.executarOrdem(estado, "B", p.ordem);
const a1 = estado.aldeias[0];
const naFila = a1.construindo.some((c) => c.tipo === "arqueiro");
const custou = a1.recursos.madeira === antes - CONFIG.tropas.arqueiro.custo.madeira;
checa("motor aceitou e enfileirou 'arqueiro'", naFila, JSON.stringify(a1.construindo));
checa("recurso debitado (a ordem valeu, nao foi engolida)", custou,
  `madeira ${antes} -> ${a1.recursos.madeira}`);

console.log("\n" + (falhas ? `FALHOU: ${falhas} checagem(ns)` : "TODOS OS CASOS PASSARAM"));
process.exit(falhas ? 1 : 0);
