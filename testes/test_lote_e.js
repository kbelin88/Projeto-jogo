// test_lote_e.js — LOTE E (fairness do turno + interceptacao + desempate).
// E8.1 (regressao de COMPORTAMENTO do motor) entra no commit 1; E8.2-E8.5 depois.
// 17/08: este ficheiro fixa numeros calculados A MAO sob o ruleset que hoje
// se chama CONFIG_V3_ARQUIVO. O que ele testa e a FORMULA (combate, rota,
// minimo), nao o balanceamento — entao continua a correr contra o arquivo,
// que e imutavel. Os mesmos invariantes sob o ruleset VIVO estao em
// testes/test_ruleset_vivo.js.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../engine.js");

const REF = path.join(__dirname, "ref-lote-e");
const FLAGS_OFF = { ordensSimultaneas: false, interceptaChegada: false, desempateEstradaRng: false, cruzamentoMesmoSentido: false };
let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };

function partida(seed, flags) {
  const cfg = Object.assign(JSON.parse(JSON.stringify(E.CONFIG_V3_ARQUIVO)), flags || {});
  cfg.layout = "iberia";
  cfg.seed = seed;
  const dec = { A: (v) => E.jogadorBurro(v), B: (v) => E.jogadorBurro(v) };
  const res = E.rodarPartida(cfg, dec, { maxTurnos: 60 });
  return JSON.stringify({ vencedor: res.vencedor, motivo: res.motivo, turnos: res.turnos, historico: res.historico });
}

// E8.1 — REGRESSAO DE COMPORTAMENTO: com TODAS as flags do lote E a false, o
// resultado de rodarPartida (burro vs burro) e byte-identico a baseline do E0.
t("E8.1 regressao de comportamento (3 seeds, flags E off)", () => {
  for (const s of [1, 2, 3]) {
    const ref = fs.readFileSync(path.join(REF, "seed" + s + ".json"), "utf8");
    assert.strictEqual(partida(s, FLAGS_OFF), ref, "divergiu em seed" + s);
  }
});

// helpers p/ estados sinteticos de estrada
function estadoIberia(flags, seed) {
  const cfg = Object.assign(JSON.parse(JSON.stringify(E.CONFIG_V3_ARQUIVO)), flags || {});
  cfg.layout = "iberia"; cfg.seed = seed || 1;
  return E.criarEstadoInicial(cfg);
}
const mkMov = (dono, o, d, tr) => ({ dono, origemId: o, destinoId: d, destinoPedido: d,
  tropas: { lanceiro: 10, arqueiro: 0, cavaleiro: 0 }, caminho: [o, d], turnosRestantes: tr, turnosTotal: 1 });

// E8.2 — simultaneidade: a visao de B do MESMO turno NAO ve o envio de A (flag on) e VE (off).
t("E8.2 simultaneidade (visao de B nao ve o envio de A do mesmo turno)", () => {
  function movsDeAvistosPorB(flag) {
    const e = estadoIberia({ ordensSimultaneas: flag });
    const aA = e.aldeias.find((a) => a.dono === "A" && (e.estradas.adj[a.id] || []).length);
    aA.tropas = { lanceiro: 10, arqueiro: 0, cavaleiro: 0 };
    const viz = e.estradas.adj[aA.id][0];
    let visaoB = null;
    E.rodarTurno(e, {
      A: () => ({ construir: [], envios: [{ origemId: aA.id, destinoId: viz, tropas: { lanceiro: 5 } }] }),
      B: (v) => { visaoB = v; return { construir: [], envios: [] }; },
    });
    return (visaoB.transito || []).filter((mv) => mv.dono === "A").length;
  }
  assert.strictEqual(movsDeAvistosPorB(true), 0, "flag ON: B nao devia ver o envio de A deste turno");
  assert.ok(movsDeAvistosPorB(false) >= 1, "flag OFF: B devia ver o envio de A (comportamento antigo)");
});

// E8.3 — interceptacao na chegada: dois inimigos no mesmo trecho, um no ultimo passo.
t("E8.3 interceptacao na chegada (on luta; off atravessa)", () => {
  function combatesEstrada(flag) {
    const e = estadoIberia({ interceptaChegada: flag });
    const id0 = e.aldeias[0].id, viz = (e.estradas.adj[id0] || [])[0];
    e.movimentos = [mkMov("A", id0, viz, 1), mkMov("B", viz, id0, 1)]; // ambos chegam este turno
    e.turno = 3;
    E.avancarMovimentos(e);
    return e.log.filter((l) => l.tipo === "combate_estrada").length;
  }
  assert.ok(combatesEstrada(true) >= 1, "flag ON: exercitos opostos no trecho deviam lutar");
  assert.strictEqual(combatesEstrada(false), 0, "flag OFF: ambos chegam sem lutar (reproduz o furo A3)");
});

// E8.4 — desempate: on varia com a seed; off da sempre B (o lado que fixava atk=A perde o empate).
t("E8.4 desempate: on varia com a seed, off e sempre B", () => {
  function venc(seed, flag) {
    const e = estadoIberia({ desempateEstradaRng: flag, interceptaChegada: true }, seed);
    const id0 = e.aldeias[0].id, viz = (e.estradas.adj[id0] || [])[0];
    e.movimentos = [mkMov("A", id0, viz, 1), mkMov("B", viz, id0, 1)]; // 10L vs 10L = empate exato
    e.turno = 5;
    E.avancarMovimentos(e);
    const ev = e.log.filter((l) => l.tipo === "combate_estrada").pop();
    return ev ? ev.vencedorDono : null;
  }
  for (const s of [1, 2, 3, 4]) assert.strictEqual(venc(s, false), "B", "off deveria dar B sempre (seed " + s + ")");
  const variados = new Set([1, 2, 3, 4, 5, 6].map((s) => venc(s, true)));
  assert.ok(variados.has("A") && variados.has("B"), "on: o vencedor do empate deveria variar com a seed");
});

// E8.5 — analisador: contagem de vazios/sem-usage/ms no fixture; e retro-compat (log antigo -> null, sem crash).
t("E8.5 analisador: vazios/sem-usage no fixture + retro-compat sem crash", () => {
  const { analisarLog } = require("../ferramentas/analisar-log.js");
  const fx = analisarLog(require("path").join(__dirname, "ref-lote-e", "fixture_vazios.txt"));
  assert.strictEqual(fx.reis.A.vazios, 0, "A nao tem vazio no fixture");
  assert.strictEqual(fx.reis.B.vazios, 3, "B tem 3 vazios no fixture");
  assert.strictEqual(fx.reis.B.vazios_sem_usage, 1, "1 dos 3 vazios de B e sem-usage");
  assert.strictEqual(fx.reis.B.finish_hist.stop, 3, "finish_hist de B deveria contar 3 stop");
  assert.strictEqual(fx.reis.B.ms_turnos_vazios.n, 3, "3 duracoes de turno vazio de B");
  // retro-compat: um log REAL antigo (03/08, pre-D1/E5) -> campos novos null, sem crash.
  const antigo = analisarLog(require("path").join(__dirname, "..", "resultados", "baseline", "partida_ollama-qwen2.5-3b_vs_openrouter-nvidia-nemotron-nano-9b-v2-free_2026-08-03-21-21.txt"));
  assert.strictEqual(antigo.reis.A.finish_hist, null, "log antigo: finish_hist deveria ser null");
  assert.strictEqual(antigo.reis.A.ms_turnos_vazios, null, "log antigo: ms deveria ser null");
});

console.log("\ntest_lote_e: " + ok + " testes ok");
