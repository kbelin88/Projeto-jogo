// medir-assento.js — O LUGAR À MESA DECIDE A PARTIDA?
//
// Uso:  node ferramentas/medir-assento.js [seeds=300]
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Numa arena que mede modelos, o assento tem de ser neutro: se o Rei A ganha
// mais por ser A, cada vitória de um modelo que jogou como A está contaminada.
// Medido em 22/09/2026 com o jogador-base contra ele próprio — dois jogadores
// IDÊNTICOS — em 300 seeds: **o Rei A ganhava 64%** (z≈5). Não era acaso, e
// tinha duas causas, as duas corrigidas no mesmo dia:
//
//   1. OS IDS NÃO SÃO ESPELHO (`visaoEspelhada`). O mapa é um espelho perfeito,
//      mas o oeste está numerado capital→fronteira e o leste ao contrário. O
//      relatório e o jogador-base percorriam as aldeias por id: o Rei A lia a
//      capital em primeiro lugar, o Rei B em penúltimo, e o lado de Lisboa
//      ganhava ~9 pontos. A visão passou a vir por distância à própria casa.
//
//   2. A ORDEM DAS CHEGADAS (`chegadaSorteada`). Quando os dois Reis chegavam
//      à mesma aldeia no mesmo turno, A resolvia sempre primeiro — valia 5
//      pontos. Passou a ser uma moeda com semente por turno, como o desempate
//      de estrada (A4).
//
// Cada seed joga-se duas vezes, com Lisboa de um lado e depois do outro, e a
// ferramenta mede o jogo tal como está e com cada correção desligada.
//
// ⚠ Esta ferramenta MEDE; não muda o motor. O teste que TRANCA o resultado é o
// `testes/test_simetria_assento.js`.
"use strict";
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const E = require(path.join(RAIZ, "engine.js"));

const N = parseInt(process.argv[2], 10) || 300;

// uma partida do jogador-base contra ele proprio; `trocar` poe Lisboa do lado
// do Rei B (e a capital inicial acompanha a troca, senao a ordem espelhada
// continuava a medir "casa" a partir de Lisboa)
function partida(seed, flags, trocar) {
  const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed }, flags));
  if (trocar) {
    for (const a of st.aldeias) {
      if (a.dono === "A") a.dono = "B"; else if (a.dono === "B") a.dono = "A";
    }
    if (st.capitalInicial) st.capitalInicial = { A: st.capitalInicial.B, B: st.capitalInicial.A };
  }
  let v = null;
  for (let t = 0; t < 100 && !v; t++) {
    E.rodarTurno(st, { A: E.jogadorBurro, B: E.jogadorBurro });
    v = E.checarVitoria(st);
  }
  return v || "empate";
}

function medir(flags) {
  let vA = 0, lisboa = 0, n = 0;
  for (let seed = 1; seed <= N; seed++) {
    for (const trocar of [false, true]) {
      const v = partida(seed, flags, trocar);
      if (v === "empate") continue;
      n++;
      if (v === "A") vA++;
      if ((v === "A") !== trocar) lisboa++;   // Lisboa e A sem troca, B com troca
    }
  }
  return { vA, lisboa, n };
}

const pct = (x, n) => (100 * x / n).toFixed(1) + "%";
const z = (x, n) => ((x / n - 0.5) / Math.sqrt(0.25 / n)).toFixed(2);
const linha = (nome, r) => console.log(
  nome.padEnd(34) + `assento A ${pct(r.vA, r.n)} (z=${z(r.vA, r.n)})`.padEnd(28)
  + `lado de Lisboa ${pct(r.lisboa, r.n)} (z=${z(r.lisboa, r.n)})`);

console.log(`\nMEDIR ASSENTO — ${N} seeds x 2 lados, jogador-base contra ele proprio\n`);
linha("o jogo como esta", medir({}));
linha("sem a ordem espelhada", medir({ visaoEspelhada: false }));
linha("sem a moeda nas chegadas", medir({ chegadaSorteada: false }));
linha("sem as duas (o motor de 21/09)", medir({ visaoEspelhada: false, chegadaSorteada: false }));
console.log("\nLeitura: |z| < 2 e o que se espera de uma mesa neutra.\n");
process.exit(0);
