// ============================================================
//  test_v1_prompt_h2.js — H2: posicao do feedback de rejeicao
// ------------------------------------------------------------
//  Rodar:  node testes/test_v1_prompt_h2.js
//
//  Hipotese (handoff 03/07): o feedback de rejeicao hoje entra no MEIO
//  do relatorio e nao quebra o loop de perseveracao. Modelos pequenos
//  pesam mais o FIM do prompt. Variante testavel, UMA variavel (a
//  POSICAO do bloco): montarPrompt(visao, { rejeicaoNoFim: true }) MOVE
//  o bloco de rejeicoes do relatorio para o fim absoluto do prompt, com
//  a instrucao anti-repeticao do handoff.
//
//  Garantias:
//  - default (sem opcoes) fica BYTE-IGUAL ao de hoje (benchmark antigo
//    permanece comparavel);
//  - variante sem rejeicoes tambem fica byte-igual (a variavel so age
//    quando ha rejeicao);
//  - com rejeicoes: bloco some do meio e aparece DEPOIS do exemplo.
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

const REJ = 'envio [1]->[2]: tropa que nao tem (pediu 5 lanceiro, tem 1)';

function visaoCom(rejeicoes) {
  const estado = Engine.criarEstadoInicial(CONFIG);
  estado.rejeicoesAnteriores = { A: [], B: rejeicoes };
  return Engine.montarVisao(estado, "B");
}

console.log("=== (A) default intocado: benchmark antigo segue comparavel ===");
const v = visaoCom([REJ]);
const base = Engine.montarPrompt(v);
checa("bloco de rejeicao no MEIO (dentro do relatorio)", base.indexOf("ORDENS RECUSADAS") >= 0 &&
  base.indexOf("ORDENS RECUSADAS") < base.indexOf("=== SUAS ALDEIAS"));
checa("fim do prompt e o exemplo (nada de rejeicao no rabo)",
  base.lastIndexOf(REJ) < base.lastIndexOf("{"));
checa("funcao pura: duas chamadas, mesma string", base === Engine.montarPrompt(v));
checa("chamada com opcoes vazias = default byte-igual", base === Engine.montarPrompt(v, {}));

console.log("\n=== (B) variante rejeicaoNoFim: bloco MOVIDO para o fim absoluto ===");
const fim = Engine.montarPrompt(v, { rejeicaoNoFim: true });
checa("rejeicao presente na variante", fim.indexOf(REJ) >= 0);
checa("bloco saiu do meio do relatorio (ocorre 1x so)",
  fim.indexOf(REJ) === fim.lastIndexOf(REJ));
checa("bloco vem DEPOIS do exemplo (fim absoluto)",
  fim.lastIndexOf(REJ) > fim.lastIndexOf("{"), `idxRej=${fim.lastIndexOf(REJ)} idxEx=${fim.lastIndexOf("{")}`);
checa("instrucao anti-repeticao do handoff presente no bloco final",
  /NAO repita a mesma ordem/.test(fim.slice(fim.lastIndexOf("ATENCAO"))));
checa("aponta o modelo de volta ao relatorio (numeros disponiveis)",
  /relatorio/i.test(fim.slice(fim.lastIndexOf("ATENCAO"))));

console.log("\n=== (C) variante SEM rejeicoes: identica ao default (variavel unica) ===");
const v0 = visaoCom([]);
checa("sem rejeicao, rejeicaoNoFim nao muda NADA (byte-igual)",
  Engine.montarPrompt(v0) === Engine.montarPrompt(v0, { rejeicaoNoFim: true }));

console.log("\n" + (falhas ? `FALHOU: ${falhas} checagem(ns)` : "TODOS OS CASOS PASSARAM"));
process.exit(falhas ? 1 : 0);
