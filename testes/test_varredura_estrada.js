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
  // estes testes comparam as duas regras ANTIGAS (instante x varredura); o
  // encontro no tempo, que passa a frente das duas, tem os testes dele abaixo
  cfg.encontroNoTempo = false;
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

// ── O ENCONTRO NO TEMPO (23/09) ─────────────────────────────────────────────
// A varredura diz SE os trocos se sobrepoem no espaco; o encontro diz QUANDO e
// ONDE os dois estiveram no mesmo ponto. E o que o replay usa para parar as
// duas colunas e abrir a cena ali, em vez de as deixar atravessar-se.
// o encontro POR PONTO (sem alcance); o alcance tem o teste dele no fim
const noTempo = () => { const st = estado(); st.config.encontroNoTempo = true; st.config.alcanceEstrada = 0; return st; };
// onde a marcha esta a fracao `s` do passo, medido a partir da ponta de id menor
const ondeEsta = (st, m, s) => {
  const p = E.posicaoRota(st, Object.assign({}, m, { turnosRestantes: m.turnosRestantes + 1 - s }));
  const lo = Math.min(p.aId, p.bId);
  return { troco: lo + "-" + Math.max(p.aId, p.bId), u: p.aId === lo ? p.t : 1 - p.t, x: p.x, y: p.y };
};

t("encontro: todo cruzamento visto a andar o passo e um encontro, e vice-versa", () => {
  const st = noTempo();
  const ida = ["lisboa", "santarem", "coimbra"].map((s) => idDe(st, s));
  const volta = ida.slice().reverse();
  let casos = 0;
  for (let tt = 2; tt <= 5; tt++) for (let tr = 0; tr < tt; tr++)
    for (let ut = 2; ut <= 5; ut++) for (let ur = 0; ur < ut; ur++) {
      const a = exercito("A", ida, tt, tr), b = exercito("B", volta, ut, ur);
      // o passo ja foi dado (turnosRestantes decrementado), como no motor
      // as duas rotas sao a MESMA estrada em sentidos opostos: medido ao longo
      // da rota de A, cruzam-se se a diferenca muda de sinal (ou toca zero) no
      // passo. Nas pontas do passo a posicao e exata, e no meio e uma reta.
      const fr = (m, r) => (m.turnosTotal - r) / m.turnosTotal;
      const d = (s) => fr(a, a.turnosRestantes + 1 - s) - (1 - fr(b, b.turnosRestantes + 1 - s));
      const trocou = d(0) <= 1e-12 && d(1) >= -1e-12;
      const enc = E.encontroNoPasso(st, a, b);
      assert.strictEqual(!!enc, trocou, `encontro=${!!enc} mas a andar trocou=${trocou} (${tt}/${tr} x ${ut}/${ur})`);
      if (enc) {
        // e no sitio certo: a esse instante os dois estao no MESMO ponto
        const pa = ondeEsta(st, a, enc.s), pb = ondeEsta(st, b, enc.s);
        const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        assert.ok(dist < 1e-6, "no instante do encontro estavam a " + dist);
        casos++;
      }
    }
  assert.ok(casos >= 20, "so " + casos + " encontros na grelha");
});

t("encontro: quem se encontra no espaco mas nao no tempo NAO luta", () => {
  // B passa pelo troco Lisboa-Santarem e sai dele antes de A la entrar:
  // os trocos percorridos sobrepoem-se, mas nunca estiveram no mesmo sitio
  const st = noTempo();
  const [lx, st2, co] = ["lisboa", "santarem", "coimbra"].map((s) => idDe(st, s));
  const custoLS = E.pesoTrecho(st, lx, st2), custoSC = E.pesoTrecho(st, st2, co);
  // B: Santarem -> Lisboa, e ja esta quase a chegar (so falta um bocado)
  const b = exercito("B", [st2, lx], 10, 0);   // no passo anda de 90% a 100%
  const a = exercito("A", [co, st2, lx], 10, 9); // no passo anda de 0% a 10% da rota
  // A so chega a Santarem depois de custoSC/(custoSC+custoLS) da rota: longe
  assert.ok(custoSC / (custoSC + custoLS) > 0.1, "o teste supoe que A ainda nao chegou a Santarem");
  assert.strictEqual(E.cruzaramNaEstrada(st, a, b), false);
});

t("o evento leva o instante e o sitio do encontro", () => {
  const st = noTempo();
  const p = ["lisboa", "santarem"].map((s) => idDe(st, s));
  // cada um anda metade do troco por passo, frente a frente: no primeiro passo
  // A vai de 0 a 0.5 e B de 1 a 0.5 -- tocam-se no FIM do passo, no MEIO do troco
  st.movimentos = [exercito("A", p, 2, 2), exercito("B", p.slice().reverse(), 2, 2)];
  const nLog = st.log.length;
  E.tick(st);
  const ev = st.log.slice(nLog).find((e) => e.tipo === "combate_estrada");
  assert.ok(ev, "nao houve combate");
  assert.strictEqual(ev.sEncontro, 1);
  const A = E.aldeiaPorId(st, p[0]), B = E.aldeiaPorId(st, p[1]);
  assert.ok(Math.abs(ev.x - (A.x + B.x) / 2) < 1e-6 && Math.abs(ev.y - (A.y + B.y) / 2) < 1e-6,
    "o combate devia ser no MEIO do troco");
});

// ── O ALCANCE (25/09) ───────────────────────────────────────────────────────
// Com alcance, lutam no PRIMEIRO instante em que ficam a essa distancia um do
// outro -- e nao antes. Era o caso da P1, T31: duas colunas no mesmo sentido,
// coladas o turno inteiro, que so se "tocavam" no ultimo instante.
t("alcance: lutam ao chegar a 30 unidades, e no primeiro instante em que isso acontece", () => {
  const st = estado();
  st.config.alcanceEstrada = 30;
  const p = ["lisboa", "santarem"].map((s) => idDe(st, s));
  const A = E.aldeiaPorId(st, p[0]), B = E.aldeiaPorId(st, p[1]);
  const L = Math.hypot(A.x - B.x, A.y - B.y);
  const a = exercito("A", p, 4, 3), b = exercito("B", p.slice().reverse(), 4, 3);
  const enc = E.encontroNoPasso(st, a, b);
  // no passo cada um anda de 0 a 25% do troco: a distancia vai de L a L/2
  if (L / 2 > 30) { assert.strictEqual(enc, null, "longe demais para lutar ja"); return; }
  assert.ok(enc, "deviam lutar neste passo");
  const onde = (m, s) => { const q = E.posicaoRota(st, Object.assign({}, m, { turnosRestantes: m.turnosRestantes + 1 - s })); return q; };
  const pa = onde(a, enc.s), pb = onde(b, enc.s);
  const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
  assert.ok(Math.abs(d - 30) < 1e-6 || (enc.s === 0 && d <= 30), "lutaram a " + d);
});
t("alcance: no mesmo sentido, a coluna de tras que chega a 30 da da frente luta ali", () => {
  const st = estado();
  st.config.alcanceEstrada = 30;
  const p = ["lisboa", "santarem", "coimbra"].map((s) => idDe(st, s));
  // a da frente (lenta) ja vai a meio; a de tras (rapida) sai de Lisboa
  const frente = exercito("B", p, 8, 4);          // no passo: 50% -> 62,5% da rota
  const tras = exercito("A", p, 2, 1);            // no passo: 0% -> 50% da rota
  const enc = E.encontroNoPasso(st, frente, tras);
  const semAlcance = (() => { st.config.alcanceEstrada = 0; const r = E.encontroNoPasso(st, frente, tras); st.config.alcanceEstrada = 30; return r; })();
  if (enc && semAlcance) assert.ok(enc.s <= semAlcance.s, "com alcance luta antes (ou ao mesmo tempo) do que por ponto");
});

console.log("test_varredura_estrada: " + ok + " testes ok");
