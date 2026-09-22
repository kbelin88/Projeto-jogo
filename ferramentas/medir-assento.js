// medir-assento.js — O LUGAR À MESA DECIDE A PARTIDA?
//
// Uso:  node ferramentas/medir-assento.js [seeds=300]
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Numa arena que mede modelos, o assento tem de ser neutro: se o Rei A ganha
// mais por ser A, cada vitória de um modelo que jogou como A está contaminada.
// Medido em 23/09/2026 com o jogador-base contra ele próprio — dois jogadores
// IDÊNTICOS — em 300 seeds: **o Rei A ganhou 64%** (z≈5). Não é acaso.
//
// Isto separa as duas causas que se misturam nesse número:
//
//   1. O LADO DO MAPA. O mapa é um espelho perfeito (37 estradas, 37 espelhos,
//      custos iguais), mas os ids não: o oeste está numerado capital→fronteira
//      (0 Lisboa, 1 Santarém…) e o leste fronteira→capital (…22 Barcelona). O
//      jogador-base percorre as suas aldeias por id, e isso bastava para dar
//      ~9 pontos ao lado de Lisboa. A mesma ordem por id chega ao PROMPT: o
//      Rei A lê a capital em primeiro lugar, o Rei B em penúltimo.
//
//   2. A ORDEM DAS CHEGADAS. As ordens são decididas em simultâneo mas
//      executadas A→B, e no `tick` as chegadas resolvem-se pela ordem da lista.
//      Quando os dois Reis chegam à mesma aldeia no mesmo turno, A resolve
//      primeiro. É a alavanca maior: "sempre A primeiro" dá 73,5% a A, "sempre
//      B primeiro" dá 27,8%.
//
// Para isolar (2), o jogador-base corre aqui com a ordem ESPELHADA (por custo
// até à própria capital) e cada seed joga-se duas vezes, com os lados trocados.
//
// ⚠ Esta ferramenta MEDE; não muda o motor. Corrigir é uma decisão de regra.
"use strict";
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const E = require(path.join(RAIZ, "engine.js"));
const I = require(path.join(RAIZ, "world-iberia.js"));

const N = parseInt(process.argv[2], 10) || 300;

// custo de cada cidade às duas capitais, pelo nome (a visão não traz o slug)
const porNome = {};
for (const c of I.CIDADES) porNome[c.nome] = { A: c.custoLisboa, B: c.custoBarcelona };

// o MESMO jogador-base, a ver as suas aldeias numa ordem igual dos dois lados
function burroEspelhado(visao) {
  const v = Object.assign({}, visao), eu = visao.dono, outro = eu === "A" ? "B" : "A";
  v.minhas = [...visao.minhas].sort((p, q) =>
    (porNome[p.nome][eu] - porNome[q.nome][eu]) || (porNome[p.nome][outro] - porNome[q.nome][outro]));
  return E.jogadorBurro(v);
}

// `trocar`: Lisboa passa a ser do Rei B e Barcelona do Rei A
function corre(decisor, trocar) {
  const r = { A: 0, B: 0, empate: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed }));
    if (trocar) for (const a of st.aldeias) {
      if (a.dono === "A") a.dono = "B"; else if (a.dono === "B") a.dono = "A";
    }
    let v = null;
    for (let t = 0; t < 100 && !v; t++) {
      E.rodarTurno(st, { A: decisor, B: decisor });
      v = E.checarVitoria(st);
    }
    r[v || "empate"]++;
  }
  return r;
}

const pct = (x, n) => (100 * x / n).toFixed(1) + "%";
const z = (x, n) => ((x / n - 0.5) / Math.sqrt(0.25 / n)).toFixed(2);

console.log(`\nMEDIR ASSENTO — ${N} seeds por configuracao, jogador-base contra ele proprio\n`);

const idNormal = corre(E.jogadorBurro, false);
const idTrocado = corre(E.jogadorBurro, true);
console.log("1) jogador-base TAL COMO E (percorre as aldeias por id)");
console.log(`   Lisboa=A: A vence ${pct(idNormal.A, N)} | Lisboa=B: A vence ${pct(idTrocado.A, N)}`);
const lisboa = idNormal.A + idTrocado.B;
console.log(`   -> o lado de LISBOA vence ${pct(lisboa, 2 * N)} (z=${z(lisboa, 2 * N)})`);

const esNormal = corre(burroEspelhado, false);
const esTrocado = corre(burroEspelhado, true);
const soA = esNormal.A + esTrocado.A;
console.log("\n2) ordem ESPELHADA (tira o efeito dos ids; sobra so o motor)");
console.log(`   Lisboa=A: A vence ${pct(esNormal.A, N)} | Lisboa=B: A vence ${pct(esTrocado.A, N)}`);
console.log(`   -> o ASSENTO A vence ${pct(soA, 2 * N)} (z=${z(soA, 2 * N)})`);

console.log("\nLeitura: |z| < 2 e o que se espera de um assento neutro.");
console.log("Se (1) der longe de 50%, o jogador-base depende dos ids; se (2) der");
console.log("longe de 50%, e o MOTOR que favorece um dos Reis.\n");
process.exit(0);
