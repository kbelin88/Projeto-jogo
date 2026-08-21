// test_analisar_log_counter_alvo.js — ANALISE 20/08 §1 / recomendacao nº 1.
//
// A taxa de counter agregada soma duas competencias diferentes: contra aldeia
// NEUTRA a guarnicao e de um tipo so e o relatorio mostra qual (leitura de
// tabela); contra o INIMIGO o exercito e misto e muda a cada turno (previsao).
// Este teste fixa a separacao por dono do alvo NO INICIO do turno, lida do
// replay — e fixa a terceira categoria que a analise de 20/08 nao tinha
// isolado: a RECONQUISTA (alvo que era do proprio Rei no inicio do turno,
// mudou de dono durante a resolucao e foi atacado de volta).
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { analisarLog } = require("../ferramentas/analisar-log.js");

// Rei A ataca tres alvos no turno 2. No inicio do turno 2 (= frame do turno 1):
//   [5] neutra   -> vant=1  (acerta o triangulo)
//   [7] do rei B -> vant=0  (nao acerta)
//   [9] do rei A -> vant=1  (reconquista: perdeu-a durante o turno e retomou)
const LOG = `=== PARTIDA Rei A (modeloA) vs Rei B (modeloB) | seed 1 | maxTurnos 2 | teste ===
condicoes: teste

########## TURNO 2 — Rei A (modeloA) ##########
resposta crua: "{}"
ordem.construir: []
ordem.envios   : []
COMBATE [5] Neutra: atacante A Fatk=10 (ef 10) Fdef=2 (ef 3) vant=1 -> vence atacante (CONQUISTA) | baixas~1
COMBATE [7] DoInimigo: atacante A Fatk=10 (ef 10) Fdef=2 (ef 3) vant=0 -> vence atacante (CONQUISTA) | baixas~1
COMBATE [9] Retomada: atacante A Fatk=10 (ef 10) Fdef=2 (ef 3) vant=1 -> vence defensor | baixas~1

=== FIM === turno 2 | resultado: limite | A 3 ald | B 1 ald | neutras 0
`;

const REPLAY = {
  v: 1,
  frames: [
    { turno: 1, aldeias: [ { id: 5, dono: null }, { id: 7, dono: "B" }, { id: 9, dono: "A" } ] },
    { turno: 2, aldeias: [ { id: 5, dono: "A" }, { id: 7, dono: "A" }, { id: 9, dono: "B" } ] },
  ],
};

let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };

const base = path.join(os.tmpdir(), "test_counter_alvo_" + Date.now());
const fLog = base + ".txt", fRep = base + ".replay.json";
fs.writeFileSync(fLog, LOG, "utf8");
fs.writeFileSync(fRep, JSON.stringify(REPLAY), "utf8");

try {
  const r = analisarLog(fLog, fRep);
  const c = r.reis.A.counter_por_tipo_de_alvo;

  t("separa o alvo NEUTRA (leitura de tabela)", () => {
    assert.strictEqual(c.neutra.ataques, 1);
    assert.strictEqual(c.neutra.counter1, 1);
    assert.strictEqual(c.neutra.taxa, 1);
  });

  t("separa o alvo INIMIGO (estrategia)", () => {
    assert.strictEqual(c.inimigo.ataques, 1);
    assert.strictEqual(c.inimigo.counter1, 0);
    assert.strictEqual(c.inimigo.taxa, 0);
  });

  t("isola a RECONQUISTA em vez de a chamar bug", () => {
    assert.strictEqual(c.proprio.ataques, 1);
    assert.strictEqual(c.proprio.counter1, 1);
    assert.strictEqual(c.indeterminado, 0);
  });

  t("nao_inimigo reproduz o criterio binario pre-21/08", () => {
    // neutra + reconquista, que e o que a analise de 20/08 chamou de "neutra".
    assert.strictEqual(c.nao_inimigo.ataques, 2);
    assert.strictEqual(c.nao_inimigo.counter1, 2);
    assert.strictEqual(c.nao_inimigo.taxa, 1);
  });

  t("os tres baldes fecham com o total de ataques", () => {
    const soma = c.neutra.ataques + c.inimigo.ataques + c.proprio.ataques + c.indeterminado;
    assert.strictEqual(soma, r.reis.A.ataques);
    assert.strictEqual(r.reis.A.ataques, 3);
  });

  t("queda neutra->inimigo e a diferenca das duas taxas", () => {
    assert.strictEqual(c.queda_neutra_para_inimigo, 1);
  });

  t("sem replay diz indisponivel, nao mente um numero", () => {
    const sem = analisarLog(fLog);
    assert.strictEqual(typeof sem.reis.A.counter_por_tipo_de_alvo, "string");
    assert.ok(/indisponivel/.test(sem.reis.A.counter_por_tipo_de_alvo));
  });

  t("o Rei B, que nao atacou, sai com baldes vazios", () => {
    const cb = r.reis.B.counter_por_tipo_de_alvo;
    assert.strictEqual(cb.neutra.ataques, 0);
    assert.strictEqual(cb.inimigo.ataques, 0);
    assert.strictEqual(cb.neutra.taxa, null);
  });
} finally {
  fs.unlinkSync(fLog);
  fs.unlinkSync(fRep);
}

console.log(ok + " testes ok — test_analisar_log_counter_alvo.js");
