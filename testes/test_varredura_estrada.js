// test_varredura_estrada.js — dois inimigos nao se atravessam sem lutar.
//
// ── O QUE ESTE TESTE GUARDA ─────────────────────────────────────────────────
// A deteccao antiga comparava as POSICOES dos dois exercitos num instante: o
// fim do turno. Isso deixa passar quem se cruza ENTRE dois instantes -- medido
// na P6, um cruzamento real perdido em 834 pares. A causa nao era o limiar: era
// que, ao fim do passo, um dos dois ja tinha mudado de troco, e a comparacao,
// que exige os dois no MESMO troco, deixava de os ver.
//
// A varredura resolve isso por construcao: compara os TROCOS PERCORRIDOS no
// passo, nao o sitio onde cada um parou. Nao ha instante nenhum a amostrar,
// portanto nao ha nada que escape por entre dois instantes.
"use strict";
const assert = require("assert");
const E = require("../engine.js");

let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };

const estado = () => {
  const cfg = JSON.parse(JSON.stringify(E.CONFIG));
  cfg.layout = "iberia";
  cfg.seed = 1;
  return E.criarEstadoInicial(cfg);
};
const idDe = (st, slug) => st.aldeias.find((a) => a.slug === slug).id;
const exercito = (dono, cam, total, restantes) => ({
  dono, origemId: cam[0], destinoId: cam[cam.length - 1], caminho: cam,
  tropas: { lanceiro: 5, arqueiro: 0, cavaleiro: 0 },
  turnosTotal: total, turnosRestantes: restantes,
});

t("a varredura apanha cruzamentos que o instante perdia", () => {
  const st = estado();
  const ida = ["lisboa", "santarem", "coimbra"].map((s) => idDe(st, s));
  const volta = ida.slice().reverse();
  let apanhados = 0;
  for (let tt = 2; tt <= 4; tt++) {
    for (let tr = 0; tr <= tt; tr++) {
      for (let ut = 2; ut <= 4; ut++) {
        for (let ur = 0; ur <= ut; ur++) {
          const a = exercito("A", ida, tt, tr);
          const b = exercito("B", volta, ut, ur);
          st.config.varreduraEstrada = false;
          const antes = E.cruzaramNaEstrada(st, a, b);
          st.config.varreduraEstrada = true;
          const agora = E.cruzaramNaEstrada(st, a, b);
          // a varredura nunca PERDE o que o instante ja via
          assert.ok(!(antes && !agora),
            `a varredura perdeu um cruzamento que o instante via (${tt}/${tr} x ${ut}/${ur})`);
          if (agora && !antes) apanhados++;
        }
      }
    }
  }
  assert.ok(apanhados >= 10,
    "a varredura devia apanhar dezenas de casos a mais, apanhou " + apanhados);
});

t("dois exercitos do MESMO dono continuam a passar um pelo outro", () => {
  const st = estado();
  const ida = ["lisboa", "santarem", "coimbra"].map((s) => idDe(st, s));
  const a = exercito("A", ida, 2, 0);
  const b = exercito("A", ida.slice().reverse(), 2, 0);
  assert.strictEqual(E.cruzaramNaEstrada(st, a, b), false);
});

t("trocos diferentes nao se cruzam, por mais perto que passem no desenho", () => {
  // era a causa NUMERO UM do que o Lucas via: 41 das ocorrencias da P6 eram
  // exercitos em ESTRADAS DIFERENTES que o olho lia como a mesma estrada. O
  // motor sempre esteve certo aqui, e tem de continuar a estar.
  const st = estado();
  const a = exercito("A", ["lisboa", "santarem"].map((s) => idDe(st, s)), 2, 1);
  const b = exercito("B", ["madrid", "toledo"].map((s) => idDe(st, s)), 2, 1);
  assert.strictEqual(E.cruzaramNaEstrada(st, a, b), false);
});

t("frente a frente no mesmo troco: lutam sempre que andaram", () => {
  const st = estado();
  const p = ["lisboa", "santarem"].map((s) => idDe(st, s));
  // `turnosRestantes` igual ao total quer dizer que ainda NAO se andou: os dois
  // estao cada um a sua porta e nao varreram nada. Nao ha combate, e nao devia
  // haver -- o passo comeca com este teste e acaba com o exercito ja movido.
  for (let tr = 0; tr < 2; tr++) {
    const a = exercito("A", p, 2, tr);
    const b = exercito("B", p.slice().reverse(), 2, tr);
    assert.strictEqual(E.cruzaramNaEstrada(st, a, b), true,
      "passaram um pelo outro com turnosRestantes=" + tr);
  }
});

console.log("test_varredura_estrada: " + ok + " testes ok");
