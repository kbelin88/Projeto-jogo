// test_lote_c.js — LOTE C, E12. Testa as etapas de VISAO DE MAPA (E5, E8-E11)
// e a regressao byte-identica (E12.1). E6/E7/E3 ficam para quando implementados.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../engine.js");

// LOTE E: a baseline de TEXTO (ref-lote-c) foi capturada no motor pre-E (sequencial).
// As flags de COMPORTAMENTO do motor do lote E ficam off aqui para o ESTADO gerado por
// estadoNoTurno continuar sendo o mesmo que alimentou aquela baseline (regra 2).
// 17/08: esta baseline nasceu com o ruleset que hoje se chama CONFIG_V3_ARQUIVO.
// A regressao mede o TEXTO do relatorio, nao o balanceamento — entao continua
// a correr contra o arquivo, que e imutavel por definicao.
const cfgIberia = () => { const c = JSON.parse(JSON.stringify(E.CONFIG_V3_ARQUIVO)); c.layout = "iberia"; c.seed = 1;
  c.ordensSimultaneas = false; c.interceptaChegada = false; c.desempateEstradaRng = false; return c; };
function estadoNoTurno(n) {
  const e = E.criarEstadoInicial(cfgIberia());
  const d = { A: (v) => E.jogadorBurro(v), B: (v) => E.jogadorBurro(v) };
  for (let i = 0; i < n; i++) E.rodarTurno(e, d);
  return e;
}
const rel = (e, opcoes) => E.relatorioTexto(E.montarVisao(e, "A", { minimos: true }), opcoes);
let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };

// E12.1 — REGRESSAO BYTE-IDENTICA: todas as flags LOTE C a false = baseline.
const FLAGS_OFF = { marchaComOrigem: false, redeComDono: false, marcarFronteira: false,
  contagemAgregada: false, rotulosExpectativa: false, deltaDefesa: false, memoriaAlvo: false };
const REF = path.join(__dirname, "ref-lote-c");
t("E12.1 regressao byte-identica (3 estados, flags off)", () => {
  for (const [nome, n] of [["s1_inicio", 1], ["s2_meio", 20], ["s3_avancado", 45]]) {
    const ref = fs.readFileSync(path.join(REF, nome + ".txt"), "utf8");
    assert.strictEqual(rel(estadoNoTurno(n), FLAGS_OFF), ref, "divergiu em " + nome);
  }
});

// E5 — origem nomeada (default on)
t("E5 marcha nomeia a origem", () => {
  const texto = rel(estadoNoTurno(20));
  assert.ok(/marcha desde \[\d+\][^:]*: \d+ lenta \/ \d+ media \/ \d+ rapida/.test(texto), "sem 'marcha desde [id]'");
  assert.ok(!/marcha desde/.test(rel(estadoNoTurno(20), { marchaComOrigem: false })), "flag off ainda mostra origem");
});

// E10 — contagem agregada bate com a soma manual (casa + em marcha)
t("E10 TOTAL == soma manual (casa + marcha)", () => {
  const e = estadoNoTurno(20);
  const v = E.montarVisao(e, "A", { minimos: true });
  let casa = 0, marcha = 0;
  for (const m of v.minhas) casa += m.tropas.lanceiro + m.tropas.arqueiro + m.tropas.cavaleiro;
  for (const mv of v.transito) if (mv.dono === "A") marcha += mv.tropas.lanceiro + mv.tropas.arqueiro + mv.tropas.cavaleiro;
  const m = rel(e).match(/^TOTAL: (\d+) soldados em casa .* \+ (\d+) em marcha/m);
  assert.ok(m, "sem linha TOTAL");
  assert.strictEqual(Number(m[1]), casa, "casa nao bate");
  assert.strictEqual(Number(m[2]), marcha, "marcha nao bate");
});

// E9 — fronteira/interior num estado sintetico: um vizinho vira inimigo.
t("E9 FRONTEIRA (vizinho inimigo) vs INTERIOR", () => {
  const e = E.criarEstadoInicial(cfgIberia());
  // acha uma aldeia de A com vizinho na rede; torna esse vizinho inimigo (B).
  const idA = e.aldeias.find((a) => a.dono === "A" && (e.estradas.adj[a.id] || []).length);
  const vizId = e.estradas.adj[idA.id][0];
  e.aldeias.find((a) => a.id === vizId).dono = "B"; // sintetico: cria uma divisa
  // uma SEGUNDA aldeia de A, longe da divisa (nao vizinha do inimigo) -> INTERIOR.
  const outra = e.aldeias.find((a) => a.dono === null && a.id !== vizId && !(e.estradas.adj[a.id] || []).includes(vizId));
  outra.dono = "A";
  const texto = rel(e);
  assert.ok(new RegExp("\\[" + idA.id + "\\][^\\n]*FRONTEIRA com \\[" + vizId + "\\] INIMIGA").test(texto), "aldeia na divisa nao saiu FRONTEIRA");
  assert.ok(/INTERIOR \(sem divisa inimiga\)/.test(texto), "nenhuma aldeia INTERIOR");
});

// E8 — rede com dono anotado
t("E8 rede de estradas anota dono (classifica)", () => {
  const texto = rel(estadoNoTurno(5));
  assert.ok(/Aldeia \[\d+\][^\n]*\(SUA\) liga-se a: \[\d+\] (SUA|NEUTRA|INIMIGA)/.test(texto), "rede sem dono anotado");
});

// D6.2 (D4) — delta de defesa: subiu / estavel / sem historico na janela
t("D4 delta de defesa (era X / estavel / sem historico)", () => {
  const e = E.criarEstadoInicial(cfgIberia());
  e.turno = 5;
  const alvo = e.aldeias.find((a) => a.dono === null);
  const D = Number((rel(e).match(new RegExp("\\[" + alvo.id + "\\][^\\n]*defesa efetiva[^:]*: (\\d+)")) || [])[1]);
  assert.ok(D > 0, "nao achou defesa efetiva do alvo");
  e.histDefesa = { [alvo.id]: [{ turno: 2, defEf: D - 2 }] }; // subiu
  assert.ok(new RegExp("\\[" + alvo.id + "\\][^\\n]*\\(era " + (D - 2) + " ha 3 turnos\\)").test(rel(e)), "sem 'era X'");
  e.histDefesa = { [alvo.id]: [{ turno: 2, defEf: D }] }; // estavel
  assert.ok(new RegExp("\\[" + alvo.id + "\\][^\\n]*\\(estavel ha 3 turnos\\)").test(rel(e)), "sem 'estavel'");
  e.histDefesa = { [alvo.id]: [{ turno: 4, defEf: D - 5 }] }; // recente demais (turno 4 > 5-2): fora da janela
  assert.ok(!new RegExp("\\[" + alvo.id + "\\][^\\n]*\\((era|estavel) ").test(rel(e)), "sufixo sem entrada na janela");
});

// D6.3 (D5) — memoria: conta so as minhas, so na janela de 8
t("D5 memoria de ataque (so minhas, so na janela, sem linha se nunca atacou)", () => {
  const e = E.criarEstadoInicial(cfgIberia());
  e.turno = 10;
  const alvo = e.aldeias.find((a) => a.dono === null);
  const outro = e.aldeias.find((a) => a.dono === null && a.id !== alvo.id);
  e.log = [
    { tipo: "combate", turno: 5, alvoId: alvo.id, atacante: "A", conquista: false },
    { tipo: "combate", turno: 7, alvoId: alvo.id, atacante: "A", conquista: false },
    { tipo: "combate", turno: 9, alvoId: alvo.id, atacante: "A", conquista: false },
    { tipo: "combate", turno: 8, alvoId: alvo.id, atacante: "B", conquista: false }, // inimigo: nao conta
    { tipo: "combate", turno: 1, alvoId: alvo.id, atacante: "A", conquista: true },  // fora da janela (1 nao > 2)
  ];
  const texto = rel(e);
  assert.ok(new RegExp("\\[" + alvo.id + "\\][^\\n]*voce atacou aqui 3x nos ultimos 8 turnos \\(0 conquistas\\)").test(texto), "contagem errada");
  assert.ok(!new RegExp("\\[" + outro.id + "\\][^\\n]*voce atacou aqui").test(texto), "alvo nunca atacado rendeu memoria");
});

console.log("\ntest_lote_c: " + ok + " testes ok");
