// test_clamp_envios.js — FASE 3 (04/08): clamp de envios como padrao.
//
// Cobre as regras da 3.2:
//   - clampeia POR TIPO ao estoque da aldeia;
//   - envio que zera apos o ajuste e RECUSADO ("zero tropas apos ajuste");
//   - dois envios da mesma origem resolvem sequencial (2o contra o estoque ja
//     reduzido pelo 1o);
//   - clamp DESLIGADO (flag false) reproduz o comportamento antigo (rejeita).
"use strict";
const assert = require("assert");
const E = require("../engine.js");

function estadoIberia(clamp) {
  const c = JSON.parse(JSON.stringify(E.CONFIG));
  c.layout = "iberia"; c.seed = 1; c.clamp_envios = clamp;
  return E.criarEstadoInicial(c);
}
function setTropas(est, dono, tropas) {
  const a = E.aldeiasDe(est, dono)[0];
  a.tropas = Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas);
  return a;
}
const naoMinhas = (est, dono) => est.aldeias.filter((x) => x.dono !== dono);

let ok = 0;
const t = (n, f) => { f(); ok++; console.log("  ok  " + n); };

// 1) CLAMP POR TIPO: pediu {4L,2A}, tem {1L,5A} -> envia {1L,2A}, com aviso.
(() => {
  const est = estadoIberia(true);
  const o = setTropas(est, "A", { lanceiro: 1, arqueiro: 5 });
  const d = naoMinhas(est, "A")[0];
  const ordem = { construir: [], envios: [{ origemId: o.id, destinoId: d.id, tropas: { lanceiro: 4, arqueiro: 2 } }] };
  const diag = E.diagnosticarOrdem(est, "A", ordem);
  t("clamp por tipo: 1 aviso, 0 rejeicao, aceito ajustado {1L,2A}", () => {
    assert.strictEqual(diag.rejeicoes.length, 0, JSON.stringify(diag.rejeicoes));
    assert.strictEqual(diag.avisos.length, 1, JSON.stringify(diag.avisos));
    assert.strictEqual(diag.aceitoEnvios.length, 1);
    assert.ok(diag.aceitoEnvios[0].ajustado);
    assert.deepStrictEqual(diag.aceitoEnvios[0].tropas, { lanceiro: 1, arqueiro: 2, cavaleiro: 0 });
  });
  E.executarOrdem(est, "A", ordem);
  t("clamp por tipo: origem fica {0L,3A}; 1 movimento {1L,2A}; aviso no canal", () => {
    assert.deepStrictEqual({ l: o.tropas.lanceiro, a: o.tropas.arqueiro, c: o.tropas.cavaleiro }, { l: 0, a: 3, c: 0 });
    const meus = est.movimentos.filter((m) => m.dono === "A");
    assert.strictEqual(meus.length, 1);
    assert.deepStrictEqual(meus[0].tropas, { lanceiro: 1, arqueiro: 2, cavaleiro: 0 });
    assert.strictEqual(est.avisosAnteriores.A.length, 1);
  });
})();

// 2) CLAMP QUE ZERA: pediu {2C}, tem {5L,0A,0C} -> recusa, nada sai.
(() => {
  const est = estadoIberia(true);
  const o = setTropas(est, "A", { lanceiro: 5 });
  const d = naoMinhas(est, "A")[0];
  const ordem = { construir: [], envios: [{ origemId: o.id, destinoId: d.id, tropas: { cavaleiro: 2 } }] };
  const diag = E.diagnosticarOrdem(est, "A", ordem);
  t("clamp que zera: 1 rejeicao 'zero tropas apos ajuste', 0 aviso, 0 aceito", () => {
    assert.strictEqual(diag.aceitoEnvios.length, 0);
    assert.strictEqual(diag.avisos.length, 0);
    assert.strictEqual(diag.rejeicoes.length, 1);
    assert.ok(/zero tropas apos ajuste/.test(diag.rejeicoes[0]), diag.rejeicoes[0]);
  });
  E.executarOrdem(est, "A", ordem);
  t("clamp que zera: 0 movimentos, origem intacta {5L}", () => {
    assert.strictEqual(est.movimentos.filter((m) => m.dono === "A").length, 0);
    assert.strictEqual(o.tropas.lanceiro, 5);
  });
})();

// 3) DOIS ENVIOS MESMA ORIGEM: tem {3A}; envia {2A} e {2A} -> 2A cheio, depois 1A clampado.
(() => {
  const est = estadoIberia(true);
  const o = setTropas(est, "A", { arqueiro: 3 });
  const alvos = naoMinhas(est, "A").slice(0, 2);
  const ordem = { construir: [], envios: [
    { origemId: o.id, destinoId: alvos[0].id, tropas: { arqueiro: 2 } },
    { origemId: o.id, destinoId: alvos[1].id, tropas: { arqueiro: 2 } },
  ] };
  const diag = E.diagnosticarOrdem(est, "A", ordem);
  t("dois envios mesma origem: 1o {2A} cheio, 2o {1A} ajustado, 1 aviso", () => {
    assert.strictEqual(diag.aceitoEnvios.length, 2);
    assert.deepStrictEqual(diag.aceitoEnvios[0].tropas, { lanceiro: 0, arqueiro: 2, cavaleiro: 0 });
    assert.ok(!diag.aceitoEnvios[0].ajustado);
    assert.deepStrictEqual(diag.aceitoEnvios[1].tropas, { lanceiro: 0, arqueiro: 1, cavaleiro: 0 });
    assert.ok(diag.aceitoEnvios[1].ajustado);
    assert.strictEqual(diag.avisos.length, 1);
  });
  E.executarOrdem(est, "A", ordem);
  t("dois envios mesma origem: origem zerada, movimentos {2A} e {1A}", () => {
    assert.strictEqual(o.tropas.arqueiro, 0);
    const qs = est.movimentos.filter((m) => m.dono === "A").map((m) => m.tropas.arqueiro).sort();
    assert.deepStrictEqual(qs, [1, 2]);
  });
})();

// 4) CLAMP DESLIGADO: mesmo pedido do caso 1 -> comportamento antigo (rejeita, nada sai).
(() => {
  const est = estadoIberia(false);
  const o = setTropas(est, "A", { lanceiro: 1, arqueiro: 5 });
  const d = naoMinhas(est, "A")[0];
  const ordem = { construir: [], envios: [{ origemId: o.id, destinoId: d.id, tropas: { lanceiro: 4, arqueiro: 2 } }] };
  const diag = E.diagnosticarOrdem(est, "A", ordem);
  t("clamp OFF: rejeicao 'tropa que nao tem' (byte antigo), 0 aviso, 0 aceito", () => {
    assert.strictEqual(diag.aceitoEnvios.length, 0);
    assert.strictEqual(diag.avisos.length, 0);
    assert.strictEqual(diag.rejeicoes.length, 1);
    assert.ok(/tropa que nao tem \(pediu 4 lanceiro, tem 1\)/.test(diag.rejeicoes[0]), diag.rejeicoes[0]);
  });
  E.executarOrdem(est, "A", ordem);
  t("clamp OFF: nada sai, origem intacta {1L,5A}", () => {
    assert.strictEqual(est.movimentos.filter((m) => m.dono === "A").length, 0);
    assert.strictEqual(o.tropas.lanceiro, 1);
    assert.strictEqual(o.tropas.arqueiro, 5);
  });
})();

console.log(`\n${ok} testes ok`);
