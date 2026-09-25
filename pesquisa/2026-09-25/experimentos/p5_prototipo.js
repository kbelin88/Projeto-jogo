// p5_prototipo.js — RASCUNHO do P5, renderizado sobre turnos REAIS de partidas.
//
// NAO toca no jogo. Carrega uma COPIA do engine.js com o evento de combate de
// aldeia a carregar os numeros que hoje faltam (tropas enviadas, guarnicao
// antes, baixas em TROPAS), reexecuta a partida a partir das ordens do .txt,
// e escreve lado a lado o prompt P4 que o Rei viu e o P5 proposto.
//
// Cada mudanca e INFORMACAO (uma regra que o motor ja executa, ou um numero
// que o motor ja sabe). Nenhuma diz o que fazer.
//
// uso: node p5_prototipo.js <partida.txt> <turno> <A|B> <dir_saida>
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..", "..", "..");

// ---- 1. a copia do motor, com o evento de aldeia completo ------------------
function carregarMotorP5() {
  let src = fs.readFileSync(path.join(RAIZ, "engine.js"), "utf8");
  const trocar = (de, para) => {
    if (!src.includes(de)) throw new Error("ancora do patch nao encontrada: " + de.slice(0, 60));
    src = src.replace(de, para);
  };
  trocar('Iberia = require("./world-iberia.js");', `Iberia = require(${JSON.stringify(path.join(RAIZ, "world-iberia.js"))});`);
  trocar("    if (atacanteVence) {\n      // sobreviventes do atacante",
    "    rep.atkTropas = Object.assign({}, exercito.tropas);\n" +
    "    rep.defTropasAntes = Object.assign({}, alvo.tropas);\n" +
    "    rep.defensorDono = alvo.dono;\n" +
    "    if (atacanteVence) {\n      // sobreviventes do atacante");
  trocar("      rep.sobreviventesForca = contarTropas(alvo.tropas); // contagem de sobreviventes (nao poder)",
    "      rep.sobreviventesForca = contarTropas(alvo.tropas); // contagem de sobreviventes (nao poder)\n" +
    "      rep.baixasTropas = contarTropas(rep.atkTropas) - contarTropas(alvo.tropas);");
  trocar("      aplicarBaixas(estado, alvo.tropas, fracao);\n      rep.sobreviventesForca = contarTropas(alvo.tropas);",
    "      aplicarBaixas(estado, alvo.tropas, fracao);\n      rep.sobreviventesForca = contarTropas(alvo.tropas);\n" +
    "      rep.baixasTropas = contarTropas(rep.defTropasAntes) - contarTropas(alvo.tropas);");
  const m = { exports: {} };
  new Function("module", "exports", "require", src)(m, m.exports, require);
  return m.exports;
}

// ---- 2. o texto P5 ---------------------------------------------------------
const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];
const EN = { lanceiro: ["spearman", "spearmen"], arqueiro: ["archer", "archers"], cavaleiro: ["knight", "knights"] };
const nT = (t) => TIPOS.reduce((s, k) => s + (t[k] || 0), 0);
const comp = (t) => TIPOS.filter((k) => t[k]).map((k) => `${t[k]} ${EN[k][t[k] === 1 ? 0 : 1]}`).join(", ") || "no troops";
const tropas = (x) => `${x} troop${x === 1 ? "" : "s"}`;

function nomeDe(visao, id) {
  const a = visao.minhas.concat(visao.alvos).find((v) => v.id === id);
  return `[${id}]${a && a.nome ? " " + a.nome : ""}`;
}

// P5-1 a P5-3: regras que o motor executa e o P4 nao diz (ou diz vago)
function regrasP5(txt) {
  const trocas = [
    ["Having the counter multiplies your force by 1.5.",
     "Having the counter multiplies your WHOLE army's force by 1.5 (every troop in it, not only the countering type)."],
    ["The winner also takes losses (attrition against the loser's effective force).",
     "The LOSER is destroyed entirely - this includes an attacker that fails against a village. " +
     "The WINNER loses troops worth HALF of the loser's effective force, spread over its troop types: " +
     "that amount does not depend on the winner's size, so a bigger winning army loses a smaller share of itself. " +
     "A defender that holds its village loses troops the same way."],
    ["You cannot march past an enemy or neutral village to hit one behind it.",
     "You cannot march past an enemy or neutral village to hit one behind it. " +
     "When an attack conquers a village, the surviving attackers stay there as its new garrison."],
  ];
  for (const [de, para] of trocas) {
    if (!txt.includes(de)) throw new Error("regra P4 nao encontrada: " + de);
    txt = txt.replace(de, para);
  }
  return txt;
}

// P5-4: o combate de aldeia com numeros, como o de estrada ja tem desde 23/09
function eventoAldeiaP5(ev, me, visao) {
  const onde = nomeDe(visao, ev.alvoId);
  const forcas = (quem) => `effective force ${ev.FatkEf} vs ${quem} defense ${ev.FdefEf}`;
  const venceu = ev.vencedor === "atacante";
  if (ev.atacante === me) {
    const cab = `You attacked ${onde} with ${comp(ev.atkTropas)} (${forcas("its")})`;
    if (venceu) return `${cab}: VICTORY, conquered. You lost ${tropas(ev.baixasTropas)}; ${tropas(ev.sobreviventesForca)} stay there as its new garrison.`;
    return `${cab}: DEFEAT. Your whole army was destroyed; the defenders lost ${tropas(ev.baixasTropas)} (${ev.sobreviventesForca} left).`;
  }
  if (ev.defensorDono === me) {
    const cab = `King ${ev.atacante} attacked YOUR ${onde} with ${comp(ev.atkTropas)} (${forcas("your")})`;
    if (venceu) return `${cab}: the village FELL. Your garrison (${comp(ev.defTropasAntes)}) was destroyed.`;
    return `${cab}: REPELLED, their army was destroyed. You lost ${tropas(ev.baixasTropas)} (${ev.sobreviventesForca} left).`;
  }
  const alvoTag = ev.defensorDono === null ? "neutral" : `King ${ev.defensorDono}'s`;
  return `King ${ev.atacante} attacked the ${alvoTag} village ${onde}: ${venceu ? "conquered it" : "failed, their army was destroyed"}.`;
}

// P5-5: o exercito inimigo avistado — de onde, quanto, e para QUEM vai
function linhaMarchaInimigaP5(m, visao, me) {
  const alvo = visao.minhas.find((a) => a.id === m.destinoId) ? "YOUR village"
    : ((visao.alvos.find((a) => a.id === m.destinoId) || {}).dono === null ? "a NEUTRAL village"
      : "THEIR OWN village (a reinforcement)");
  const t = m.turnosRestantes;
  return `- enemy army of ${comp(m.tropas)} from ${nomeDe(visao, m.origemId)} marching to ${nomeDe(visao, m.destinoId)} - ${alvo} - arrives in ${t} turn${t === 1 ? "" : "s"}`;
}

function montarP5(E, estado, dono) {
  const visao = E.montarVisao(estado, dono);
  const p4 = E.montarPrompt(visao, { rejeicaoNoFim: true });
  let txt = regrasP5(p4);

  // eventos de aldeia: troca linha a linha as frases de combate do P4
  const combates = (visao.eventos || []).filter((ev) => ev.tipo === "combate");
  for (const ev of combates) {
    const euAtaquei = ev.atacante === dono;
    const quem = euAtaquei ? "You" : "King " + ev.atacante;
    const fraseP4 = ev.vencedor === "atacante"
      ? `- ${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: VICTORY, conquered${euAtaquei ? ` (your losses: ${ev.baixasForca} troops)` : ""}`
      : `- ${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: DEFEAT${euAtaquei ? " (your army was lost)" : ""}`;
    if (txt.includes(fraseP4)) txt = txt.replace(fraseP4, "- " + eventoAldeiaP5(ev, dono, visao));
  }

  // marchas inimigas avistadas
  for (const m of (visao.transito || []).filter((x) => x.dono !== dono)) {
    const fraseP4 = `- enemy army marching toward [${m.destinoId}]`;
    const i = txt.indexOf(fraseP4);
    if (i < 0) continue;
    const fim = txt.indexOf("\n", i);
    const linhaP4 = txt.slice(i, fim);
    if (!new RegExp(`arrives in ${m.turnosRestantes} turn`).test(linhaP4)) continue;
    txt = txt.slice(0, i) + linhaMarchaInimigaP5(m, visao, dono) + txt.slice(fim);
  }

  // P5-6 (OPCIONAL — decisao do Lucas): onde esta o exercito que ja existe
  const adj = visao.estradas || {};
  const inimigo = new Set(visao.alvos.filter((a) => a.dono !== null && a.dono !== dono).map((a) => a.id));
  let interior = 0, fronteira = 0;
  for (const a of visao.minhas) {
    const k = nT(a.tropas);
    if ((adj[a.id] || []).some((v) => inimigo.has(v))) fronteira += k; else interior += k;
  }
  const totalLinha = /^TOTAL: .*$/m;
  txt = txt.replace(totalLinha, (l) => `${l}\n  at home: ${interior} in INTERIOR villages (no enemy neighbour), ${fronteira} in BORDER villages`);

  // P5-7 (OPCIONAL — decisao do Lucas, mexe no fog): o estoque das aldeias
  // inimigas VISIVEIS. A defesa de um alvo pode saltar num turno so (Teruel,
  // P3 T11: 8 -> 23 com 90 de madeira guardada); em 25 de 29 ataques que
  // falharam assim, o estoque ja o dizia.
  for (const a of visao.alvos.filter((x) => x.visivel && x.dono !== null && x.dono !== dono)) {
    const real = estado.aldeias.find((x) => x.id === a.id);
    const re = new RegExp(`^(\\[${a.id}\\][^\\n]*\\| ENEMY[^\\n]*)$`, "m");
    txt = txt.replace(re, (l) => `${l} | stock: wood ${real.recursos.madeira}, iron ${real.recursos.ferro}`);
  }
  return { p4, p5: txt };
}

module.exports = { carregarMotorP5, montarP5, regrasP5 };

// ---- 3. CLI: reexecuta a partida e fotografa o turno pedido ------------------
if (require.main === module) {
  const [txtPath, turnoStr, lado, outDir] = process.argv.slice(2);
  if (!txtPath || !turnoStr || !lado || !outDir) {
    console.error("uso: node p5_prototipo.js <partida.txt> <turno> <A|B> <dir_saida>");
    process.exit(1);
  }
  const E = carregarMotorP5();
  const { carregar } = require("./reexec.js");
  const P = carregar(txtPath);
  const g = E.criarEstadoInicial(P.cfg);
  const alvo = Number(turnoStr);
  let feito = false;
  for (let t = 1; t <= P.maxT && !feito; t++) {
    E.tick(g);
    if (t === alvo) {
      const { p4, p5 } = montarP5(E, g, lado);
      fs.mkdirSync(outDir, { recursive: true });
      const base = path.join(outDir, `${path.basename(txtPath, ".txt")}_T${t}_${lado}`);
      fs.writeFileSync(base + ".P4.txt", p4);
      fs.writeFileSync(base + ".P5.txt", p5);
      console.log(`gravado ${base}.P4.txt (${p4.length} chars) e .P5.txt (${p5.length} chars, +${p5.length - p4.length})`);
      feito = true;
    }
    for (const d of ["A", "B"]) {
      if (!E.aldeiasDe(g, d).length) continue;
      const j = P.jog[t + d];
      if (j) { E.executarOrdem(g, d, { construir: j.construir, envios: j.envios }); E.guardarPlano(g, d, j.plano); }
    }
  }
}
