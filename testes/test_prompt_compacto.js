// test_prompt_compacto.js - O COMPACTO PERDE ROTULOS, NUNCA INFORMACAO.
//
// POR QUE EXISTE (29/09/2026, SPEC_TESTE_SESSAO_0929)
// A sessao manda o estado de cada turno num formato compacto (V2). A promessa e
// que ele perde so rotulos e constantes. Esta prova nao confia na promessa: le
// o prompt de hoje (P4) e o compacto do MESMO estado, tira dos dois os mesmos
// registos (aldeia -> recursos, defesa, tropas, marchas; alvo -> dono,
// guarnicao, defesa, marcha) e exige que sejam IGUAIS. A unica diferenca
// declarada e o "(was N, M turns ago)" que vira "(was N)".
//
// E tranca o resto do desenho: a rede de estradas vive na mensagem 1 (nao no
// turno), o inexplorado so aparece quando pedido, o pedido de memoria so no
// ultimo turno da sessao, e o P4 de um turno por vez NAO muda.
"use strict";
const assert = require("assert");
const E = require("../engine.js");

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log("  ok  " + nome); };

// ---- estados reais: partida do jogador-base contra ele proprio ---------------
function jogar(seed, ate) {
  const cfg = JSON.parse(JSON.stringify(E.CONFIG)); cfg.layout = "iberia"; cfg.seed = seed;
  const est = E.criarEstadoInicial(cfg);
  const amostras = [];
  while (est.turno < ate) {
    E.tick(est);
    for (const d of ["A", "B"]) {
      if (!E.aldeiasDe(est, d).length) continue;
      const visao = E.montarVisao(est, d);
      if ([1, 4, 8, 12, 16, 20].includes(est.turno)) amostras.push({ turno: est.turno, dono: d, visao });
    }
    for (const d of ["A", "B"]) {
      if (!E.aldeiasDe(est, d).length) continue;
      E.executarOrdem(est, d, E.jogadorBurro(E.montarVisao(est, d)));
    }
    if (E.checarVitoria(est)) break;
  }
  return amostras;
}
const amostras = [].concat(jogar(1, 20), jogar(5, 20));

// ---- extratores: o MESMO registo, a partir de cada formato ------------------
const num = (s) => parseInt(s, 10);
const tri = (s) => { // "6 spearmen, 1 archer, 2 knights" -> [6,1,2]
  const o = { S: 0, A: 0, K: 0 };
  for (const m of s.matchAll(/(\d+) (spearm[ae]n|archers?|knights?)/g)) o[{ s: "S", a: "A", k: "K" }[m[2][0]]] += num(m[1]);
  return [o.S, o.A, o.K];
};
const triCompacto = (s) => { // "6S 1A 2K"
  const o = { S: 0, A: 0, K: 0 };
  for (const m of s.matchAll(/(\d+)([SAK])/g)) o[m[2]] += num(m[1]);
  return [o.S, o.A, o.K];
};
const blocoEntre = (texto, ini, fim) => {
  const i = texto.indexOf(ini);
  if (i < 0) return "";
  const j = fim ? texto.indexOf(fim, i + ini.length) : -1;
  return j < 0 ? texto.slice(i) : texto.slice(i, j);
};

function registosLongo(texto) {
  const aldeias = {}, alvos = {};
  const bloco = blocoEntre(texto, "=== YOUR VILLAGES", "=== VILLAGES YOU CAN SEE");
  let cur = null;
  for (const l of bloco.split("\n")) {
    let m = /^\[(\d+)\]/.exec(l);
    if (m && l.includes("| wood ")) {
      const id = num(m[1]);
      const w = /wood (\d+)/.exec(l), f = /iron (\d+)/.exec(l), d = /: (\d+) \| troops at home: (\d+) \/ \d+/.exec(l);
      const b = / \| (INTERIOR|BORDER with ([^|]*?) \(enemy\))/.exec(l);
      const cap = l.includes("YOUR CAPITAL");
      cur = aldeias[id] = { id, w: num(w[1]), i: num(f[1]), def: num(d[1]), home: num(d[2]), cap,
        borda: b[1] === "INTERIOR" ? "INT" : b[2].replace(/\s/g, "") };
      continue;
    }
    if (!cur) continue;
    if ((m = /AVAILABLE TO SEND NOW: (.*) \(attack power if all sent: (\d+)\)/.exec(l))) { cur.send = tri(m[1]); cur.atk = num(m[2]); }
    else if ((m = /already marching out \(NOT available\): (.*)$/.exec(l))) cur.out = tri(m[1]);
    else if ((m = /from here to your nearest border village \[(\d+)\].*?: (\d+) slow \/ (\d+) medium \/ (\d+) fast turns/.exec(l))) cur.front = [num(m[1]), num(m[2]), num(m[3]), num(m[4])];
    else if ((m = /(ready next turn|ready in (\d+) turns): (.*?) \(cannot/.exec(l))) cur.ready = [m[2] || "1", tri(m[3])];
  }
  const tot = /TOTAL: (\d+) soldiers at home \((\d+) spearman, (\d+) archer, (\d+) knight\) \+ (\d+) marching/.exec(bloco);
  const blocoAlvos = texto.slice(texto.indexOf("=== VILLAGES YOU CAN SEE"), texto.indexOf("=== UNEXPLORED") > 0 ? texto.indexOf("=== UNEXPLORED") : texto.indexOf("=== ROAD NETWORK"));
  for (const l of blocoAlvos.split("\n")) {
    const m = /^\[(\d+)\]/.exec(l);
    if (!m || !l.includes("| garrison:")) continue;
    const id = num(m[1]);
    const dono = /\| (NEUTRAL|ENEMY CAPITAL \(King \w\)|ENEMY \(King \w\)) \|/.exec(l)[1];
    const gar = /garrison: (.*?) \| effective defense/.exec(l)[1];
    const def = /location bonus included\): (\d+)/.exec(l);
    const delta = /\((stable for \d+ turns|was (\d+), \d+ turns ago)\)/.exec(l);
    const mar = /march from \[(\d+)\].*?: (\d+) slow \/ (\d+) medium \/ (\d+) fast turns/.exec(l);
    const mem = /you attacked here (\d+)x in the last (\d+) turns \((\d+) conquered\)/.exec(l);
    alvos[id] = { id, dono, gar, def: num(def[1]),
      delta: delta ? (delta[2] ? "was " + delta[2] : delta[1]) : null,
      mar: mar ? [num(mar[1]), num(mar[2]), num(mar[3]), num(mar[4])] : null,
      mem: mem ? [num(mem[1]), num(mem[2]), num(mem[3])] : null };
  }
  return { aldeias, alvos, total: tot ? tot.slice(1).map(num) : null };
}

function registosCompacto(texto) {
  const aldeias = {}, alvos = {};
  const bloco = blocoEntre(texto, "=== YOUR VILLAGES", "=== VILLAGES YOU CAN SEE");
  let cur = null;
  for (const l of bloco.split("\n")) {
    let m = /^\[(\d+)\].*? w(\d+) i(\d+) \| def (\d+) \| home (\d+)/.exec(l);
    if (m) {
      const id = num(m[1]);
      const b = / (INT|BORDER ([^|]*?)) \|/.exec(l);
      cur = aldeias[id] = { id, w: num(m[2]), i: num(m[3]), def: num(m[4]), home: num(m[5]), cap: / CAP /.test(l),
        borda: b[1] === "INT" ? "INT" : b[2].replace(/\s/g, "") };
      continue;
    }
    if (!cur) continue;
    if ((m = /^\s+send (.*) \(atk (\d+)\)/.exec(l))) { cur.send = triCompacto(m[1]); cur.atk = num(m[2]); }
    else if ((m = /^\s+out: (.*)$/.exec(l))) cur.out = triCompacto(m[1]);
    else if ((m = /^\s+to front \[(\d+)\].*?: (\d+)s\/(\d+)m\/(\d+)f/.exec(l))) cur.front = [num(m[1]), num(m[2]), num(m[3]), num(m[4])];
    else if ((m = /^\s+(ready next turn|ready in (\d+) turns): (.*)$/.exec(l))) cur.ready = [m[2] || "1", triCompacto(m[3])];
  }
  const tot = /TOTAL: (\d+) home \((\d+)S (\d+)A (\d+)K\) \+ (\d+) marching/.exec(bloco);
  const iAlvos = texto.indexOf("=== VILLAGES YOU CAN SEE");
  const iFim = [texto.indexOf("=== UNEXPLORED"), texto.indexOf("=== ARMIES")].filter((x) => x > 0).sort((a, b) => a - b)[0];
  for (const l of texto.slice(iAlvos, iFim).split("\n")) {
    const m = /^\[(\d+)\]/.exec(l);
    if (!m || !l.includes(" | def ")) continue;
    const id = num(m[1]);
    const dono = /\| (NEUTRAL|ENEMY CAPITAL \(King \w\)|ENEMY \(King \w\)) \|/.exec(l)[1];
    const parts = l.split(" | ");
    const gar = parts[2];
    const def = /def (\d+)/.exec(l);
    const delta = /\((stable for \d+ turns|was (\d+))\)/.exec(l);
    const mar = /from \[(\d+)\] (\d+)\/(\d+)\/(\d+)/.exec(l);
    const mem = /you attacked here (\d+)x in the last (\d+) turns \((\d+) conquered\)/.exec(l);
    alvos[id] = { id, dono, gar, def: num(def[1]),
      delta: delta ? (delta[2] ? "was " + delta[2] : delta[1]) : null,
      mar: mar ? [num(mar[1]), num(mar[2]), num(mar[3]), num(mar[4])] : null,
      mem: mem ? [num(mem[1]), num(mem[2]), num(mem[3])] : null };
  }
  return { aldeias, alvos, total: tot ? [num(tot[1]), num(tot[2]), num(tot[3]), num(tot[4]), num(tot[5])] : null };
}

// ---- 1. paridade de informacao ---------------------------------------------
t("1 as amostras tem fronteira, marchas e alvos de varios tipos (a prova nao e vazia)", () => {
  assert.ok(amostras.length >= 20, "amostras: " + amostras.length);
  const longos = amostras.map((a) => E.montarPrompt(a.visao, { rejeicaoNoFim: true }));
  assert.ok(longos.some((p) => /BORDER with/.test(p)), "nenhuma amostra com fronteira");
  assert.ok(longos.some((p) => /already marching out/.test(p)), "nenhuma amostra com marcha");
  assert.ok(longos.some((p) => /from here to your nearest border village/.test(p)), "nenhuma amostra com tempo ate a frente");
  assert.ok(longos.some((p) => /ENEMY \(King/.test(p)), "nenhuma amostra com aldeia inimiga visivel");
  assert.ok(longos.some((p) => /ready (next turn|in)/.test(p)), "nenhuma amostra com construcao em curso");
});

t("2 o compacto tem EXATAMENTE os mesmos registos que o P4, em todas as amostras", () => {
  let aldeias = 0, alvos = 0;
  for (const a of amostras) {
    const longo = registosLongo(E.montarPrompt(a.visao, { rejeicaoNoFim: true }));
    const curto = registosCompacto(E.montarMensagemTurno(a.visao, {}));
    assert.deepStrictEqual(curto.aldeias, longo.aldeias, `T${a.turno} ${a.dono}: aldeias proprias diferem`);
    assert.deepStrictEqual(curto.alvos, longo.alvos, `T${a.turno} ${a.dono}: alvos diferem`);
    assert.deepStrictEqual(curto.total, longo.total, `T${a.turno} ${a.dono}: linha TOTAL difere`);
    aldeias += Object.keys(longo.aldeias).length; alvos += Object.keys(longo.alvos).length;
  }
  assert.ok(aldeias > 60 && alvos > 30, `pouca cobertura: ${aldeias} aldeias, ${alvos} alvos`);
});

t("3 marchas, o que aconteceu e avisos passam iguais (linha a linha)", () => {
  for (const a of amostras) {
    const longo = E.montarPrompt(a.visao, { rejeicaoNoFim: true });
    const curto = E.montarMensagemTurno(a.visao, {});
    for (const ini of ["=== ARMIES ON THE MARCH ===", "=== WHAT HAPPENED LAST TURN ==="]) {
      const fimL = ini.includes("ARMIES") ? "=== WHAT HAPPENED" : "Besides your orders";
      const fimC = ini.includes("ARMIES") ? "=== WHAT HAPPENED" : "Reply with ONE";
      assert.strictEqual(blocoEntre(curto, ini, fimC).trim(), blocoEntre(longo, ini, fimL).trim(), `T${a.turno} ${a.dono}: ${ini} difere`);
    }
  }
});

// ---- 2. o desenho da sessao ------------------------------------------------
t("4 a rede de estradas vive na mensagem 1: as 24 aldeias, e a capital inimiga marcada", () => {
  const v = amostras[0].visao;
  const sis = E.montarPromptSessao(v, { N: 4 });
  const bloco = blocoEntre(sis, "=== ROAD NETWORK", "=== HOW THE REPORT");
  const ids = [...bloco.matchAll(/^\[(\d+)\]/gm)].map((m) => num(m[1]));
  assert.strictEqual(ids.length, 24);
  assert.ok(/THE ENEMY CAPITAL/.test(bloco) && /YOUR CAPITAL/.test(bloco));
  assert.ok(!/\((yours|neutral|enemy|last seen)/.test(bloco), "a mensagem 1 nao pode levar dono das aldeias (ficaria velho)");
  for (const a of amostras) assert.ok(!/=== ROAD NETWORK/.test(E.montarMensagemTurno(a.visao, {})), "o turno nao repete a rede");
});

t("5 a mensagem 1 nao tem numeros de estado (igual em todas as sessoes do mesmo Rei)", () => {
  const a = amostras.find((x) => x.dono === "A" && x.turno === 1).visao;
  const b = amostras.find((x) => x.dono === "A" && x.turno === 20).visao;
  assert.strictEqual(E.montarPromptSessao(a, { N: 4 }), E.montarPromptSessao(b, { N: 4 }),
    "a mensagem 1 mudou com o estado: perderia o cache entre sessoes");
});

t("6 inexplorado so quando pedido; pedido de memoria so no ultimo turno; memoria antes do estado", () => {
  const v = amostras.find((x) => x.turno === 4).visao;
  assert.ok(!/UNEXPLORED/.test(E.montarMensagemTurno(v, {})));
  assert.ok(/UNEXPLORED/.test(E.montarMensagemTurno(v, { inexplorado: true })));
  assert.ok(!/"memory" field/.test(E.montarMensagemTurno(v, {})));
  const ult = E.montarMensagemTurno(v, { ultimoDaSessao: true });
  assert.ok(/last turn of this session/.test(ult) && /"memory" field/.test(ult) && new RegExp(String(E.TETO_MEMORIA)).test(ult));
  const mem = E.montarMensagemTurno(v, { memoria: { turno: 4, texto: "H1: he never attacks Toledo (T2, T3)." } });
  assert.ok(mem.indexOf("=== YOUR MEMORY FROM THE LAST SESSION (written by you on turn 4) ===") === 0);
  assert.ok(mem.indexOf("H1: he never attacks Toledo") < mem.indexOf("=== YOUR VILLAGES"));
});

t("7 o compacto e menor: a mensagem de turno pesa menos que a metade do relatorio do P4", () => {
  let curto = 0, longo = 0;
  for (const a of amostras) {
    curto += E.montarMensagemTurno(a.visao, {}).length;
    longo += E.montarPrompt(a.visao, { rejeicaoNoFim: true }).length;
  }
  assert.ok(curto < longo * 0.5, `compacto ${curto} chars contra ${longo} do P4 (${(100 * curto / longo).toFixed(0)}%)`);
});

// ---- 3. o P4 de um turno por vez NAO muda ------------------------------------
t("8 sem a opcao, o relatorio e o prompt P4 nao tem nenhum vestigio do compacto", () => {
  for (const a of amostras) {
    const p = E.montarPrompt(a.visao, { rejeicaoNoFim: true });
    assert.ok(/=== ROAD NETWORK/.test(p) && /AVAILABLE TO SEND NOW/.test(p) && /You are King /.test(p));
    assert.ok(!/replace all earlier ones/.test(p) && !/ send \d+S /.test(p) && !/to front \[/.test(p));
    assert.strictEqual(E.montarPrompt(a.visao, { rejeicaoNoFim: true, compacto: false }), p);
  }
});

// ---- 4. o parser aceita a memoria ------------------------------------------
t("9 parsearOrdem: 'memory' vem em .memoria (cortado a 1200), e a ordem nao a leva", () => {
  const longo = "x".repeat(2000);
  const r = E.parsearOrdem(JSON.stringify({ build: [], movements: [], plan: "p", statement: "s", memory: longo }));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.memoria.length, E.TETO_MEMORIA);
  assert.deepStrictEqual(Object.keys(r.ordem).sort(), ["construir", "envios"]);
  const sem = E.parsearOrdem(JSON.stringify({ build: [], movements: [], plan: "p", statement: "s" }));
  assert.ok(!("memoria" in sem), "sem 'memory' o resultado tem de ser o de sempre");
  const partido = E.parsearOrdem('{"build": [], "movements": [], "plan": "p", "memory": "guardar isto"');
  assert.strictEqual(partido.ok, false);
  assert.strictEqual(partido.memoria, "guardar isto", "o salvamento parcial tambem recupera a memoria");
});

console.log(`\ntest_prompt_compacto: ${n} provas ok`);
