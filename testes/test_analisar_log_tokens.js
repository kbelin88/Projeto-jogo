// test_analisar_log_tokens.js — FASE 0 do SPEC_SITE_V1 (§2.1).
// O browser escreve "tokens: ..."; o runner headless (rei_vs_rei.js) escreve
// "tokens.contexto: ...". Antes desta correcao, analisar-log.js so reconhecia
// o prefixo do browser e as 13 partidas headless liam tokens_prompt_total=0,
// custo_total_usd=0 e ms_turnos_nao_vazios=null. Este teste passa uma linha de
// cada formato e verifica que as duas sao contadas.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { analisarLog } = require("../ferramentas/analisar-log.js");

const LOG = `=== PARTIDA Rei A (modeloA) vs Rei B (modeloB) | seed 1 | maxTurnos 1 | teste ===
condicoes: teste

########## TURNO 1 — Rei A (modeloA) ##########
tokens: prompt 100 | resposta 200 | raciocinio 50 | finish stop | nativo STOP | ms 1000
resposta crua: "{}"
raciocinio: (nao capturado)
ordem.construir: []
ordem.envios   : []

########## TURNO 1 — Rei B (modeloB) ##########
tokens.contexto: prompt 111 | resposta 222 | raciocinio 33 | finish stop | ms 2000
resposta crua: "{}"
raciocinio: (nao capturado)
ordem.construir: []
ordem.envios   : []

=== FIM === turno 1 | resultado: limite | A 1 ald | B 1 ald | neutras 0
`;

let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };

const tmp = path.join(os.tmpdir(), "test_analisar_log_tokens_" + Date.now() + ".txt");
fs.writeFileSync(tmp, LOG, "utf8");
try {
  const r = analisarLog(tmp);

  t("formato browser (tokens:) e contado", () => {
    assert.strictEqual(r.reis.A.tokens_prompt_total, 100);
    assert.strictEqual(r.reis.A.tokens_resposta_total, 200);
    assert.strictEqual(r.reis.A.tokens_raciocinio_total, 50);
    assert.strictEqual(r.reis.A.ms_turnos_nao_vazios.n, 1);
  });

  t("formato runner headless (tokens.contexto:) e contado", () => {
    assert.strictEqual(r.reis.B.tokens_prompt_total, 111);
    assert.strictEqual(r.reis.B.tokens_resposta_total, 222);
    assert.strictEqual(r.reis.B.tokens_raciocinio_total, 33);
    assert.strictEqual(r.reis.B.ms_turnos_nao_vazios.n, 1);
  });
} finally {
  fs.unlinkSync(tmp);
}

console.log(ok + " testes ok — test_analisar_log_tokens.js");
