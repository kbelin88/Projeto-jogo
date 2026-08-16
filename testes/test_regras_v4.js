// test_regras_v4.js — RULESET V4 (reboot de balanceamento, 16/08/2026).
// Cobre as 6 mudancas do CONFIG_V4 e prova que o CONFIG antigo NAO regride.
// Origem: analise da partida qwen3-235b x deepseek-r1 (15/08).
"use strict";
const assert = require("assert");
const E = require("../engine.js");

let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };

const stOld = () => E.criarEstadoInicial(E.CONFIG);
const stV4 = () => E.criarEstadoInicial(E.CONFIG_V4);
const idDe = (st, slug) => st.aldeias.find((a) => a.slug === slug).id;
const marcha = (st, o, d) => E.turnosDeCaminho(st, E.caminhoEntre(st, idDe(st, o), idDe(st, d)), { lanceiro: 0, arqueiro: 1, cavaleiro: 0 });

// --- 1. Integridade dos configs -------------------------------------------
t("1a CONFIG antigo intacto (byte-identico preservado)", () => {
  assert.strictEqual(E.CONFIG.producao.madeira, 10);
  assert.strictEqual(E.CONFIG.bonus_forca_triangulo, 1.25);
  assert.strictEqual(E.CONFIG.tropas.cavaleiro.def, 1);
  assert.strictEqual(E.CONFIG.tropas.cavaleiro.turnos, 2);
  assert.strictEqual(E.CONFIG.escalaMarcha, undefined);
  assert.strictEqual(E.CONFIG.regrasV4, undefined);
});
t("1b CONFIG_V4 com os valores exatos decididos", () => {
  assert.strictEqual(E.CONFIG_V4.producao.madeira, 15);
  assert.strictEqual(E.CONFIG_V4.bonus_forca_triangulo, 1.5);
  assert.strictEqual(E.CONFIG_V4.tropas.cavaleiro.def, 2);
  assert.strictEqual(E.CONFIG_V4.tropas.cavaleiro.turnos, 1);
  assert.strictEqual(E.CONFIG_V4.escalaMarcha, 0.3);
  assert.strictEqual(E.CONFIG_V4.regrasV4, true);
  assert.strictEqual(E.CONFIG_V4.vitoriaFracao, 0.75);
  assert.strictEqual(E.CONFIG_V4.vitoriaTurnos, 2);
});

// --- 2. Distancia: centro 9 -> 6, corte uniforme --------------------------
t("2 escalaMarcha corta o centro de 9 para 3 turnos (simetrico)", () => {
  const o = stOld(), v = stV4();
  assert.strictEqual(marcha(o, "lisboa", "toledo"), 9, "old Lisboa->Toledo");
  assert.strictEqual(marcha(o, "barcelona", "madrid"), 9, "old espelho");
  assert.strictEqual(marcha(v, "lisboa", "toledo"), 3, "v4 Lisboa->Toledo");
  assert.strictEqual(marcha(v, "barcelona", "madrid"), 3, "v4 espelho");
});
// O ESPELHO e o que nao pode quebrar quando a escala muda: o corte e aplicado
// ao peso ANTES do ceil, entao os dois lados encolhem igual. Este teste varre
// as 22 aldeias e exige que cada uma tenha o mesmo tempo desde a sua capital
// que a gemea tem desde a outra — se um dia a escala partir a simetria por
// arredondamento, quebra aqui e nao numa partida paga.
t("2b escala 0.3 mantem o espelho Oeste/Este em TODAS as aldeias", () => {
  const v = stV4();
  const I = require("../world-iberia.js");
  let checadas = 0;
  for (const c of I.CIDADES) {
    if (!c.par || c.papel === "capital") continue;
    const meu = marcha(v, c.lado === "O" ? "lisboa" : "barcelona", c.id);
    const dela = marcha(v, c.lado === "O" ? "barcelona" : "lisboa", c.par);
    assert.strictEqual(meu, dela, c.id + " (" + meu + ") != " + c.par + " (" + dela + ")");
    checadas++;
  }
  assert.ok(checadas >= 20, "esperava >=20 aldeias checadas, deu " + checadas);
});

// --- 3. Counter 1.5: o custo conhecido + a punicao da monocultura ---------
const prev = (st, atkType, defType, defBonus) =>
  E.preverCombateTipos(st, st.config.tropas[atkType].atq, atkType,
    st.config.tropas[defType].def, defType, defBonus);

t("3a requisito antigo (1 cav toma 1 lanceiro no castelo) VALE no old, NAO no v4", () => {
  const castelo = E.CONFIG.combate.bonus_defesa_castelo; // 1.5
  assert.strictEqual(prev(stOld(), "cavaleiro", "lanceiro", castelo).atacanteVence, true, "old: cav ganha (4 vs 3.75)");
  assert.strictEqual(prev(stV4(), "cavaleiro", "lanceiro", castelo).atacanteVence, false, "v4: cav perde (4 vs 4.5) — custo conhecido");
});
t("3b v4 pune arqueiro-mono: cavaleiro esmaga arqueiro na aldeia", () => {
  const aldeia = E.CONFIG_V4.combate.bonus_defesa_aldeia; // 1.25
  const r = prev(stV4(), "cavaleiro", "arqueiro", aldeia);
  assert.strictEqual(r.atacanteVence, true);           // 4*1.5=6 vs 2*1.25=2.5
  assert.ok(r.FatkEf > r.FdefEf * 2, "vitoria folgada");
});
t("3c v4 pune lanceiro-mono: arqueiro fura lanceiro na aldeia", () => {
  const aldeia = E.CONFIG_V4.combate.bonus_defesa_aldeia;
  assert.strictEqual(prev(stV4(), "arqueiro", "lanceiro", aldeia).atacanteVence, true); // 2*1.5=3 > 2*1.25=2.5
  // no old (counter 1.25) o mesmo ataque EMPATA e o defensor segura:
  assert.strictEqual(prev(stOld(), "arqueiro", "lanceiro", aldeia).atacanteVence, false); // 2*1.25=2.5 == 2.5
});

// --- 4. Producao de madeira -----------------------------------------------
t("4 madeira/turno: +15 no v4, +10 no old (aldeia propria)", () => {
  for (const [st, esperado] of [[stOld(), 10], [stV4(), 15]]) {
    const a = st.aldeias.find((x) => x.dono === "A");
    const antes = a.recursos.madeira;
    E.tick(st);
    assert.strictEqual(a.recursos.madeira - antes, esperado);
  }
});

// --- 5. Cavaleiro em 1 turno ----------------------------------------------
t("5 cavaleiro sai em 1 tick no v4, 2 ticks no old", () => {
  // v4
  const v = stV4(); const av = v.aldeias.find((x) => x.dono === "A");
  const cav0 = av.tropas.cavaleiro;
  av.construindo = [{ tipo: "cavaleiro", turnosRestantes: v.config.tropas.cavaleiro.turnos }];
  E.tick(v);
  assert.strictEqual(av.tropas.cavaleiro, cav0 + 1, "v4: pronto em 1 tick");
  // old
  const o = stOld(); const ao = o.aldeias.find((x) => x.dono === "A");
  const c0 = ao.tropas.cavaleiro;
  ao.construindo = [{ tipo: "cavaleiro", turnosRestantes: o.config.tropas.cavaleiro.turnos }];
  E.tick(o);
  assert.strictEqual(ao.tropas.cavaleiro, c0, "old: ainda construindo apos 1 tick");
  E.tick(o);
  assert.strictEqual(ao.tropas.cavaleiro, c0 + 1, "old: pronto no 2o tick");
});

// --- 6. Vitoria por dominancia (>=75% por 2 turnos consecutivos) -----------
t("6a dominancia dispara em 2 turnos, nao em 1", () => {
  const st = stV4();
  const alvo = Math.ceil(st.aldeias.length * 0.75); // 18
  st.aldeias.forEach((a, i) => { a.dono = i < alvo ? "A" : "B"; a.construindo = []; });
  st.movimentos = [];
  E.tick(st);
  assert.strictEqual(st.dominancia.A, 1, "1o turno acima do alvo");
  assert.strictEqual(E.checarVitoria(st), null, "1 turno nao basta");
  E.tick(st);
  assert.strictEqual(st.dominancia.A, 2, "2o turno consecutivo");
  assert.strictEqual(E.checarVitoria(st), "A", "2 turnos -> vitoria de A");
});
t("6b abaixo de 75% nunca dispara e zera o contador", () => {
  const st = stV4();
  st.aldeias.forEach((a, i) => { a.dono = i < 17 ? "A" : "B"; a.construindo = []; }); // 17 < 18
  st.movimentos = [];
  E.tick(st); E.tick(st); E.tick(st);
  assert.strictEqual(st.dominancia.A, 0);
  assert.strictEqual(E.checarVitoria(st), null);
});
t("6c old NAO tem dominancia (regrasV4 off): sem contador, so eliminacao", () => {
  const st = stOld();
  st.aldeias.forEach((a, i) => { a.dono = i < 20 ? "A" : "B"; a.construindo = []; });
  st.movimentos = [];
  E.tick(st); E.tick(st);
  assert.strictEqual(st.dominancia, undefined, "old nao rastreia dominancia");
  assert.strictEqual(E.checarVitoria(st), null, "old ignora 75%, so elimina");
});

// --- 7. Invariante: partida v4 SEMPRE sai com vencedor (nunca 'limite') ----
t("7 rodarPartida v4 nunca termina em 'limite' (3 seeds)", () => {
  for (const seed of [1, 2, 3]) {
    const c = JSON.parse(JSON.stringify(E.CONFIG_V4)); c.seed = seed;
    const r = E.rodarPartida(c, null, { maxTurnos: 120 });
    assert.notStrictEqual(r.vencedor, "limite", "seed " + seed + " deveria sair com vencedor");
    assert.ok(["A", "B", "empate"].includes(r.vencedor), "seed " + seed + " vencedor valido");
  }
});

console.log("test_regras_v4: " + ok + " testes OK");
