// ============================================================
//  Smoke8estrada.js — O COMBATE DE ESTRADA APARECE (28/08)
// ------------------------------------------------------------
//  Rodar:  node testes_arena/Smoke8estrada.js
//
//  O QUE GUARDA, e por que existe:
//  Os combates de estrada ACONTECIAM e o jogo nao os mostrava. Nas duas
//  partidas do video (25/08) houve 16 — 5 no G1, 11 no G2 — e o Lucas assistiu
//  as duas em camera lenta sem ver um unico. A causa eram quatro exclusoes no
//  index.html, todas a mesma condicao `e.tipo !== "combate"`:
//      cronica do espectador | camera automatica | cronica de jogo | log .txt
//  O runner headless ja registava (runners/rei_vs_rei.js); so o browser e que
//  ficou de fora — e era no browser que as partidas do video corriam.
//
//  Este smoke tranca as quatro portas ABERTAS. Se alguem voltar a filtrar por
//  `tipo === "combate"` num destes canais, isto tem de doer aqui, porque o
//  sintoma no jogo e a AUSENCIA de uma coisa — e ausencia ninguem repara.
//
//  Tranca tambem os campos do evento no motor: sem eles a cronica nao consegue
//  nomear os dois exercitos, e volta a haver evento sem historia.
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const E = require(path.join(__dirname, "..", "engine.js"));

let falhas = 0;
const ok = (nome, cond, detalhe) => {
  if (!cond) falhas++;
  console.log(`  [${cond ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
};

// ---------- (A) o motor produz o evento, com o que a cena precisa ----------
console.log("\n=== (A) o evento do motor ===");
const cfg = JSON.parse(JSON.stringify(E.CONFIG));
cfg.layout = "iberia"; cfg.seed = 1;
const st = E.criarEstadoInicial(cfg);
for (let i = 0; i < 40; i++) E.rodarTurno(st, { A: E.jogadorBurro, B: E.jogadorBurro });
const evs = st.log.filter((e) => e.tipo === "combate_estrada");
ok("burro x burro (seed 1, 40 turnos) produz combate de estrada", evs.length > 0, `${evs.length} evento(s)`);

if (evs.length) {
  const e = evs[0];
  // Sem estes campos a cronica so consegue dizer "houve um combate" — nao QUEM,
  // nao ONDE, nao com que custo. Foi o estado ate 28/08.
  for (const campo of ["atkOrigemId", "atkDestinoId", "defOrigemId", "defDestinoId",
                       "vencedorDono", "perdedorDono", "perdedorTropas", "aniquilados",
                       "baixasVencedor", "FatkEf", "FdefEf", "x", "y"])
    ok(`evento carrega '${campo}'`, e[campo] !== undefined);
  const somaPerd = (e.perdedorTropas.lanceiro || 0) + (e.perdedorTropas.arqueiro || 0) + (e.perdedorTropas.cavaleiro || 0);
  ok("aniquilados = soma da composicao perdida", e.aniquilados === somaPerd, `${e.aniquilados} vs ${somaPerd}`);
  ok("o perdedor nao e o vencedor", e.perdedorDono !== e.vencedorDono);
  ok("o exercito perdido nao e vazio (sai INTEIRO do transito)", somaPerd > 0, `${somaPerd} tropas`);
}

// ---------- (B) as quatro portas do index.html ----------
console.log("\n=== (B) os quatro canais do browser ===");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// Cada canal e localizado pela sua funcao/bloco e tem de MENCIONAR o tipo.
const canais = [
  ["log .txt do browser (registrarEventosTurno)", /function registrarEventosTurno\(\)[\s\S]*?\n  \}/],
  ["cronica de jogo (cronicaEventos)", /function cronicaEventos\(tn\)[\s\S]*?\n  \}/],
  ["efeitos de mapa (registrarEfeitosTurno)", /function registrarEfeitosTurno\(tn\)[\s\S]*?\n  \}/],
];
for (const [nome, re] of canais) {
  const bloco = (html.match(re) || [])[0];
  if (!bloco) { ok(`localizar ${nome}`, false, "bloco nao encontrado — ATUALIZE este smoke, nao o apague"); continue; }
  ok(`${nome} trata combate_estrada`, /combate_estrada/.test(bloco));
}

// A cronica do espectador e a camera vivem no mesmo bloco de replay; localiza-se
// pelos nomes proprios em vez de pela funcao inteira.
const espectador = (html.match(/const espPorLado = \{ A: \[\], B: \[\] \};[\s\S]*?\n    \}/) || [])[0];
ok("cronica do espectador trata combate_estrada", !!espectador && /combate_estrada/.test(espectador));

const camera = (html.match(/let alvoCam = null[\s\S]*?apontarCamera[\s\S]{0,400}?\n    \}/) || [])[0];
ok("camera automatica considera combate_estrada", !!camera && /combate_estrada/.test(camera));
ok("camera tem PRIORIDADE (conquista > estrada > assalto repelido)",
  !!camera && /prioCam/.test(camera));
ok("camera aponta ao PONTO da estrada, nao a uma aldeia inexistente",
  !!camera && /combate_estrada[\s\S]{0,120}apontarCamera\(\s*alvoCam\.x/.test(camera));

// ---------- (C) a cena, e o que ela NAO pode ser ----------
console.log("\n=== (C) a cena do choque ===");
const efeitos = (html.match(/function registrarEfeitosTurno\(tn\)[\s\S]*?\n  \}/) || [])[0] || "";
ok("duas batidas: choque e queda do estandarte",
  /choqueEstrada/.test(efeitos) && /quedaEstandarte/.test(efeitos));
ok("a queda vem DEPOIS do choque (batida atrasada)", /quedaEstandarte[\s\S]{0,160}t0: ag \+ \d+/.test(efeitos));
ok("o desenho das duas batidas existe",
  /if \(e\.choqueEstrada\)/.test(html) && /if \(e\.quedaEstandarte\)/.test(html));
// 25/08, decisao do Lucas: "circulos piscando e numero de tropas mortas poluem
// o momento". A cena do choque nao pode reintroduzir nenhum dos dois.
ok("a cena NAO usa numero flutuante de baixas (decisao de 25/08)",
  !/quedaEstandarte[\s\S]{0,400}dano:/.test(efeitos) && !/choqueEstrada[\s\S]{0,300}dano:/.test(efeitos));

// ---------- (D) todo campo que a UI le existe MESMO no evento ----------
// Este e o modo de falha silencioso: um nome trocado (e.atkOrigem em vez de
// e.atkOrigemId) nao lanca erro nenhum — imprime "undefined" no log e no painel,
// e ninguem repara, porque combate de estrada e justamente o que ninguem estava
// a ver. Por isso o smoke confronta os campos LIDOS com um evento REAL do motor.
console.log("\n=== (D) os campos lidos pela UI existem no evento ===");
if (!evs.length) {
  ok("ha evento para confrontar", false);
} else {
  const evReal = evs[0];
  // trechos do index.html que tratam combate_estrada, com o `e.` do laco
  const trechos = [
    (html.match(/else if \(e\.tipo === "combate_estrada"\)\s*\n\s*L\.push\([\s\S]*?\);/) || [])[0],
    (html.match(/\} else if \(e\.tipo === "combate_estrada"\) \{[\s\S]*?\n      \}/) || [])[0],
    (html.match(/if \(e\.tipo === "combate_estrada"\) \{[\s\S]*?continue;\n      \}/g) || []).join("\n"),
  ].filter(Boolean).join("\n");
  ok("localizou os trechos que leem o evento", trechos.length > 200, `${trechos.length} chars`);
  const campos = [...new Set([...trechos.matchAll(/\be\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))]
    .filter((c) => c !== "tipo");
  ok("leu pelo menos 8 campos distintos", campos.length >= 8, campos.join(", "));
  const faltam = campos.filter((c) => evReal[c] === undefined);
  ok("nenhum campo lido pela UI e undefined no evento real", faltam.length === 0,
    faltam.length ? "FALTAM: " + faltam.join(", ") : `${campos.length} campos conferidos`);
}

console.log(falhas ? `\nFALHOU: ${falhas} verificacao(oes).` : "\nSmoke8estrada: tudo ok.");
process.exit(falhas ? 1 : 0);
