// test_pacote2.js - O PROMPT CAMPEAO (pacote 2 + sessao) ESTA NO MOTOR E E O PADRAO DO RUNNER.
//
// POR QUE EXISTE (03/10/2026): o pacote 2 viveu duas semanas como um patch de pesquisa
// que reescrevia o engine.js em tempo de execucao. Entrou no motor, e o que se pode
// estragar em silencio tem de estar trancado:
//   1. o evento de combate de aldeia traz quem atacou com o que, quem defendia e as
//      baixas em tropas (o relato com numeros le-os);
//   2. as ancoras do texto da mensagem 1 e da mensagem de turno ainda existem (se uma
//      frase do motor mudar, o pacote tem de falhar alto, nao calar);
//   3. o mapa da frente aparece na mensagem de turno, com o tempo de marcha;
//   4. o runner joga o campeao por omissao e SESSAO_N=0 volta ao P4 de um turno por vez.
"use strict";
const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const E = require("../engine.js");
const Pac2 = require("../pacote2.js");

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log("  ok  " + nome); };

function jogoBurro(seed, turnos, aoFim) {
  const cfg = JSON.parse(JSON.stringify(E.CONFIG)); cfg.layout = "iberia"; cfg.seed = seed;
  const e = E.criarEstadoInicial(cfg);
  for (let i = 0; i < turnos; i++) {
    for (const d of ["A", "B"]) E.executarOrdem(e, d, E.jogadorBurro(E.montarVisao(e, d)));
    E.rodarTurno(e);
    if (aoFim) aoFim(e);
  }
  return e;
}

t("1 o evento de combate de aldeia traz os numeros do relato", () => {
  let achou = null;
  jogoBurro(3, 14, (e) => {
    for (const ev of (e.ultimosEventos || e.eventos || []).filter((x) => x.tipo === "combate")) achou = achou || ev;
  });
  if (!achou) { // o estado guarda os eventos do turno na visao
    const e = jogoBurro(3, 14);
    for (const d of ["A", "B"]) for (const ev of (E.montarVisao(e, d).eventos || []).filter((x) => x.tipo === "combate")) achou = achou || ev;
  }
  assert.ok(achou, "em 14 turnos de jogador-base tem de haver um combate de aldeia");
  for (const k of ["atkTropas", "defTropasAntes", "defensorDono", "baixasTropas"])
    assert.ok(k in achou, "o evento perdeu o campo " + k);
  assert.ok(Number.isFinite(achou.baixasTropas), "baixasTropas e um numero");
});

t("2 a mensagem 1 leva as seis verdades, a campanha e a legenda (as ancoras existem)", () => {
  const e = jogoBurro(3, 2);
  const base = E.montarPromptSessao(E.montarVisao(e, "A"), { N: 4 });
  const sis = Pac2.sistema(base); // lanca se uma ancora do motor mudou
  for (const frase of ["WHOLE army", "HALF of the loser", "stay there as its new garrison", "protects your INTERIOR villages",
    "YOUR capital", "ARMIES ON THE MARCH", "your CAMPAIGN", "FRONT MAP"])
    assert.ok(sis.includes(frase), "falta na mensagem 1: " + frase);
  assert.ok(sis.length > base.length, "o pacote acrescenta texto");
});

t("3 a mensagem de turno leva o mapa da frente com o tempo de marcha", () => {
  const e = jogoBurro(3, 9);
  const visao = E.montarVisao(e, "A");
  const msg = E.montarMensagemTurno(visao, { memoria: null, inexplorado: false, ultimoDaSessao: false });
  const com = Pac2.turno(E, msg, visao, "A");
  assert.ok(com.includes("=== FRONT MAP ==="), "falta o mapa da frente");
  assert.ok(/troops that can be here: now \d+/.test(com), "falta a tropa que pode estar em cada frente");
  assert.ok(/REAR - your villages/.test(com), "falta a retaguarda");
  assert.ok(com.indexOf("=== FRONT MAP ===") < com.indexOf("=== VILLAGES YOU CAN SEE"), "o mapa vem antes dos alvos");
});

t("4 o runner joga o campeao por omissao; SESSAO_N=0 volta ao P4 de um turno por vez", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pac2-"));
  const runner = path.join(__dirname, "..", "runners", "rei_vs_rei.js");
  const env = Object.assign({}, process.env); delete env.SESSAO_N; delete env.PACOTE2; delete env.SESSAO_SUBSTITUI; delete env.SEGUNDA_CHAMADA;
  const a = path.join(dir, "campeao.txt");
  spawnSync(process.execPath, [runner, "falso:sonnet", "falso:sonnet", "1", "6", a], { env, encoding: "utf8", timeout: 120000 });
  const la = fs.readFileSync(a, "utf8");
  assert.ok(/SESSAO N=4/.test(la) && /PACOTE2/.test(la), "o cabecalho tem de dizer que correu o campeao");
  assert.ok(fs.existsSync(a.replace(/\.txt$/, ".sessao.jsonl")), "o campeao grava o .sessao.jsonl");
  const msg1 = JSON.parse(fs.readFileSync(a.replace(/\.txt$/, ".sessao.jsonl"), "utf8").split("\n").filter(Boolean).find((l) => JSON.parse(l).tipo === "sessao_inicio")).system;
  assert.ok(/FRONT MAP/.test(msg1) && /Older reports are taken out of the conversation/.test(msg1), "a mensagem 1 tem o pacote e a substituicao");
  const b = path.join(dir, "p4.txt");
  spawnSync(process.execPath, [runner, "burro", "burro", "1", "6", b], { env: Object.assign({}, env, { SESSAO_N: "0" }), encoding: "utf8", timeout: 120000 });
  assert.ok(!/PACOTE2|SESSAO N=/.test(fs.readFileSync(b, "utf8")), "SESSAO_N=0 e o P4: sem sessao e sem pacote");
});

console.log(`\ntest_pacote2: ${n} provas ok`);
