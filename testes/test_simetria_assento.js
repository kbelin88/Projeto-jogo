// test_simetria_assento.js — A MESA É NEUTRA: nenhum Rei ganha por ser A ou B.
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Até 22/09 havia testes de MECANISMOS justos (o desempate de estrada, as
// gémeas do mapa), mas nenhum que jogasse o jogo inteiro com dois jogadores
// iguais e perguntasse: dá 50%? Não dava. Com o jogador-base contra ele
// próprio, o Rei A ganhava 64% (z≈5), por duas causas:
//
//   1. os ids não são espelho, e a visão/relatório/jogador-base percorriam as
//      aldeias por id — o lado de Lisboa ganhava ~9 pontos;
//   2. nas chegadas simultâneas à mesma aldeia, A resolvia sempre primeiro.
//
// Este teste tranca as duas correções por três vias: duas exatas (a ordem da
// visão é um espelho; a moeda das chegadas cai dos dois lados) e uma
// estatística (o jogo inteiro dá ~50%). Para medir com mais jogos, ver
// `ferramentas/medir-assento.js`.
"use strict";
const assert = require("assert");
const path = require("path");
const E = require(path.join(__dirname, "..", "engine.js"));
const I = require(path.join(__dirname, "..", "world-iberia.js"));

let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };

const porSlug = {}, parDeNome = {};
for (const c of I.CIDADES) porSlug[c.id] = c;
for (const c of I.CIDADES) parDeNome[c.nome] = porSlug[c.par].nome;

// um estado ESPELHADO: A fica com seis cidades do oeste, B com as gémeas delas
function estadoEspelhado(flags) {
  const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }, flags || {}));
  const oeste = ["lisboa", "santarem", "evora", "coimbra", "badajoz", "faro"];
  for (const a of st.aldeias) {
    if (oeste.includes(a.slug)) a.dono = "A";
    else if (oeste.map((s) => porSlug[s].par).includes(a.slug)) a.dono = "B";
  }
  return st;
}

// ── 1. a visão de A, levada pelo espelho, é a visão de B ───────────────────
t("a ordem das minhas aldeias e dos alvos e um espelho perfeito", () => {
  const st = estadoEspelhado();
  const vA = E.montarVisao(st, "A"), vB = E.montarVisao(st, "B");
  assert.deepStrictEqual(vA.minhas.map((a) => parDeNome[a.nome]), vB.minhas.map((a) => a.nome),
    "as MINHAS aldeias de A, espelhadas, tem de sair na ordem das de B");
  assert.deepStrictEqual(vA.alvos.map((a) => parDeNome[a.nome] || a.nome), vB.alvos.map((a) => a.nome),
    "os ALVOS de A, espelhados, tem de sair na ordem dos de B");
  assert.strictEqual(vA.minhas[0].nome, "Lisboa", "a capital vem primeiro para A");
  assert.strictEqual(vB.minhas[0].nome, "Barcelona", "e para B tambem");
});

t("o relatorio P4 lista as aldeias pela mesma ordem espelhada", () => {
  const st = estadoEspelhado();
  const cabecas = (lado) => {
    const txt = E.relatorioTexto(E.montarVisao(st, lado), {});
    const bloco = txt.slice(txt.indexOf("=== YOUR VILLAGES"), txt.indexOf("=== VILLAGES YOU CAN SEE"));
    return [...bloco.matchAll(/^\[\d+\] ([A-Za-z]+)/gm)].map((m) => m[1]);
  };
  const a = cabecas("A"), b = cabecas("B");
  assert.strictEqual(a.length, 6);
  assert.deepStrictEqual(a.map((n) => parDeNome[n]), b);
});

t("com a flag desligada volta a ordem por id (a de antes de 22/09)", () => {
  const vB = E.montarVisao(estadoEspelhado({ visaoEspelhada: false }), "B");
  const ids = vB.minhas.map((a) => a.id);
  assert.deepStrictEqual(ids, ids.slice().sort((x, y) => x - y));
  assert.notStrictEqual(vB.minhas[0].nome, "Barcelona", "por id, Barcelona NAO vem primeiro");
});

// ── 2. quem chega primeiro, quando chegam os dois ───────────────────────────
// A fica com Toledo, B com Zaragoza, e os dois marcham sobre Madrid (neutra,
// vizinha das duas) com um turno de caminho: chegam juntos, por estradas
// diferentes, e nenhum se cruza com o outro. O registo diz quem lutou primeiro.
function quemChegaPrimeiro(seed, flags) {
  const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed }, flags || {}));
  const id = (s) => st.aldeias.find((a) => a.slug === s).id;
  const toledo = id("toledo"), zaragoza = id("zaragoza"), madrid = id("madrid");
  st.aldeias[toledo].dono = "A";
  st.aldeias[zaragoza].dono = "B";
  const exercito = { lanceiro: 20, arqueiro: 0, cavaleiro: 0 };
  st.movimentos.push(
    { dono: "A", origemId: toledo, destinoId: madrid, destinoPedido: madrid, tropas: Object.assign({}, exercito), caminho: [toledo, madrid], turnosRestantes: 1, turnosTotal: 1 },
    { dono: "B", origemId: zaragoza, destinoId: madrid, destinoPedido: madrid, tropas: Object.assign({}, exercito), caminho: [zaragoza, madrid], turnosRestantes: 1, turnosTotal: 1 });
  E.tick(st);
  const ev = st.log.find((e) => e.tipo === "combate" && e.alvoId === madrid);
  assert.ok(ev, "tem de haver combate em Madrid (seed " + seed + ")");
  return ev.atacante;
}

t("nas chegadas simultaneas, a moeda cai dos dois lados", () => {
  let a = 0;
  const N = 400;
  for (let s = 1; s <= N; s++) if (quemChegaPrimeiro(s) === "A") a++;
  // 400 lancamentos de uma moeda justa: 50% +- 2,5 pontos de desvio-padrao
  assert.ok(a > N * 0.40 && a < N * 0.60, `A foi primeiro em ${a} de ${N} -- a moeda nao e justa`);
});

t("sem a moeda, A resolvia SEMPRE primeiro (o defeito de 21/09)", () => {
  for (let s = 1; s <= 40; s++) assert.strictEqual(quemChegaPrimeiro(s, { chegadaSorteada: false }), "A");
});

// ── 3. o jogo inteiro: jogador-base contra ele proprio, dos dois lados ──────
t("o jogo inteiro da ~50% ao assento A e ao lado de Lisboa", () => {
  let vA = 0, lisboa = 0, n = 0;
  for (let seed = 1; seed <= 150; seed++) {
    for (const trocar of [false, true]) {
      const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed }));
      if (trocar) {
        for (const a of st.aldeias) { if (a.dono === "A") a.dono = "B"; else if (a.dono === "B") a.dono = "A"; }
        st.capitalInicial = { A: st.capitalInicial.B, B: st.capitalInicial.A };
      }
      let v = null;
      for (let k = 0; k < 100 && !v; k++) { E.rodarTurno(st, { A: E.jogadorBurro, B: E.jogadorBurro }); v = E.checarVitoria(st); }
      if (v !== "A" && v !== "B") continue;
      n++;
      if (v === "A") vA++;
      if ((v === "A") !== trocar) lisboa++;
    }
  }
  const z = (x) => (x / n - 0.5) / Math.sqrt(0.25 / n);
  // |z| < 2,6: com 300 jogos isto deixa passar uma mesa neutra quase sempre e
  // apanha o defeito de 21/09 (Lisboa 61% -> z~3,9)
  assert.ok(Math.abs(z(vA)) < 2.6, `assento A venceu ${(100 * vA / n).toFixed(1)}% (z=${z(vA).toFixed(2)})`);
  assert.ok(Math.abs(z(lisboa)) < 2.6, `o lado de Lisboa venceu ${(100 * lisboa / n).toFixed(1)}% (z=${z(lisboa).toFixed(2)})`);
});

console.log(`\ntest_simetria_assento: ${ok} testes ok`);
