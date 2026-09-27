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
    if (venceu) return `${cab}: VICTORY, conquered. You lost ${tropas(ev.baixasTropas)}; ${tropas(ev.sobreviventesForca)} ${ev.sobreviventesForca === 1 ? "stays" : "stay"} there as its new garrison.`;
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

// P5-5: o exercito inimigo avistado — para QUEM vai (a intencao).
// Decisao do Lucas (26/09): o fog nao se mexe. Sai a COMPOSICAO; a origem
// tambem nao entra (a aldeia de onde saiu pode estar no escuro). Fica so a
// leitura do dono do destino, que o Rei ja ve na mesma linha.
function intencaoMarcha(m, visao) {
  if (visao.minhas.find((a) => a.id === m.destinoId)) return "YOUR village";
  const a = visao.alvos.find((x) => x.id === m.destinoId) || {};
  return a.dono === null ? "a NEUTRAL village" : "THEIR OWN village (a reinforcement)";
}

// Os itens do P5, ligaveis um a um (o passo 3 do §12 isola cada grupo):
//   regras   P5-1/2/3  counter no exercito inteiro, atrito, guarnicao nova
//   combate  P5-4      combate de aldeia com numeros
//   intencao P5-5      para quem vai o exercito inimigo avistado
//   interior P5-6      a linha interior x fronteira sob o TOTAL
// O P5-7 (estoque inimigo) saiu por decisao do Lucas (26/09): mexe no fog.
//   placebo            CONTROLE: uma linha sem informacao no mesmo sitio do
//                      P5-6. Mede o efeito de mexer no prompt, seja no que for.
//
// Os BRACOS de formato (26/09, a pergunta do Lucas: "levar tropas a fronteira e
// acumular deve ser algo no nosso prompt"), fora do P5 por omissao:
//   avaliacao  o JSON ganha "assessment" ANTES das ordens: onde estao as tuas
//              tropas, onde e a frente, o que cada aldeia faz. Estrutura o
//              raciocinio; nao diz o que fazer.
//   semtotal   tira a linha TOTAL (o "reino = um exercito so").
//   conselho   CONTROLE POSITIVO: diz o que fazer. Quebra "o prompt informa,
//              nao recomenda" DE PROPOSITO: se nem isto move a retaguarda, o
//              prompt nao e a alavanca. So para diagnostico, nunca para o jogo.
//
// As VERDADES DE SEGURANCA (26/09, noite): o Sonnet e o Luna deixam 51-59% do
// exercito no interior depois das ordens (a politica REFORCA deixa 4%), e os
// planos dizem porque: "kept spearmen home to defend Lisboa". Tres coisas que
// o motor executa e o P4 cala, conferidas no motor antes de escritas:
//   alcance  o interior so e atacavel depois de cair uma vizinha (8842 ataques
//            do burro: 49 a aldeias interiores, todos com a vizinha tomada no
//            mesmo turno)
//   capital  perder a PROPRIA capital nao perde o jogo nem tem efeito especial
//   vigia    toda coluna inimiga ja em marcha para uma aldeia tua aparece
//            (2041 de 2041); so a ordenada neste turno nao
//
// APRESENTACAO (27/09): o Super escreve "Tarragona: 9S home, +2S build" e "other
// villages will focus on building spearmen to reinforce" -- reforcar = construir
// no sitio. Dois detalhes do P4 que podem empurrar para isso, nenhum e regra:
//   semteto      "troops at home: 9 / 300" em cada aldeia le-se como barra de
//                progresso; o teto fica nas regras, sai da linha de cada aldeia
//   movprimeiro  o esquema pede "build" antes de "movements"; inverte a ordem
const ITENS_P5 = ["regras", "combate", "intencao", "interior", "placebo", "avaliacao", "semtotal", "conselho", "alcance", "capital", "vigia", "semteto", "movprimeiro"];
const FORA_DO_PADRAO = new Set(["placebo", "avaliacao", "semtotal", "conselho", "alcance", "capital", "vigia", "semteto", "movprimeiro"]);

// troca que FALHA alto se a ancora sumir (um braco que nao muda nada e um
// braco que mente)
function troca(txt, de, para) {
  const antes = txt;
  txt = txt.replace(de, para);
  if (txt === antes) throw new Error("ancora do braco nao encontrada: " + String(de).slice(0, 60));
  return txt;
}

function montarP5(E, estado, dono, itens) {
  const liga = new Set(itens || ITENS_P5.filter((k) => !FORA_DO_PADRAO.has(k)));
  for (const k of liga) if (!ITENS_P5.includes(k)) throw new Error("item P5 desconhecido: " + k);
  const visao = E.montarVisao(estado, dono);
  const p4 = E.montarPrompt(visao, { rejeicaoNoFim: true });
  let txt = liga.has("regras") ? regrasP5(p4) : p4;

  // eventos de aldeia: troca linha a linha as frases de combate do P4
  const combates = liga.has("combate") ? (visao.eventos || []).filter((ev) => ev.tipo === "combate") : [];
  for (const ev of combates) {
    const euAtaquei = ev.atacante === dono;
    const quem = euAtaquei ? "You" : "King " + ev.atacante;
    // a frase do P4: com a flag baixasReais (25/09) em tropas, antes em forca
    const bt = ev.baixasTropas;
    const frases = ev.vencedor === "atacante"
      ? [`- ${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: VICTORY, conquered${euAtaquei ? ` (your losses: ${bt} troop${bt === 1 ? "" : "s"})` : ""}`,
         `- ${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: VICTORY, conquered${euAtaquei ? ` (your losses: ${ev.baixasForca} troops)` : ""}`]
      : [`- ${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: DEFEAT${euAtaquei ? " (your army was lost)" : ""}`];
    const fraseP4 = frases.find((f) => txt.includes(f));
    if (fraseP4) txt = txt.replace(fraseP4, "- " + eventoAldeiaP5(ev, dono, visao));
  }

  // marchas inimigas avistadas: cada linha do P4 ganha a intencao, que so
  // depende do destino (varias colunas para o mesmo destino: todas a ganham)
  if (liga.has("intencao")) {
    const porDestino = new Map((visao.transito || []).filter((x) => x.dono !== dono).map((m) => [m.destinoId, m]));
    txt = txt.replace(/^- enemy army marching toward \[(\d+)\]([^\n]*), arrives in (\d+) turns?$/gm, (l, id, nm, t) => {
      const m = porDestino.get(Number(id));
      return m ? `- enemy army marching toward [${id}]${nm} - ${intencaoMarcha(m, visao)} - arrives in ${t} turn${t === "1" ? "" : "s"}` : l;
    });
  }

  // P5-6 (nao decidido pelo Lucas: testar isolado): onde esta o exercito
  if (liga.has("interior")) {
    const adj = visao.estradas || {};
    const inimigo = new Set(visao.alvos.filter((a) => a.dono !== null && a.dono !== dono).map((a) => a.id));
    let interior = 0, fronteira = 0;
    for (const a of visao.minhas) {
      const k = nT(a.tropas);
      if ((adj[a.id] || []).some((v) => inimigo.has(v))) fronteira += k; else interior += k;
    }
    txt = txt.replace(/^TOTAL: .*$/m, (l) => `${l}\n  at home: ${interior} in INTERIOR villages (no enemy neighbour), ${fronteira} in BORDER villages`);
  }
  if (liga.has("semtotal")) txt = troca(txt, /^TOTAL: .*\n/m, "");
  if (liga.has("avaliacao")) {
    txt = troca(txt, '- "plan": your NOTE TO YOUR NEXT TURN',
      '- "assessment": FIRST, before any order: where your troops are right now (which villages hold how many, INTERIOR or BORDER), where the front with the enemy is, and what each of your villages will do this turn. 3 to 8 lines.\n- "plan": your NOTE TO YOUR NEXT TURN');
    txt = troca(txt, '  "build": [', '  "assessment": "<where your troops are, where the front is, what each village does this turn>",\n  "build": [');
  }
  if (liga.has("conselho")) {
    txt = troca(txt, "=== FOG OF WAR ===",
      "=== STRATEGY ADVICE ===\n" +
      "Troops in INTERIOR villages (no enemy neighbour) cannot reach the enemy from there and are not threatened by it: while they stay there they do not fight. " +
      "Strong players march them every turn to their BORDER villages, gather a large garrison there, and then attack ONE target with the WHOLE garrison of one village, " +
      "with a clear margin over its defense. Many small attacks from different villages lose one by one.\n\n=== FOG OF WAR ===");
  }
  if (liga.has("alcance")) txt = troca(txt, "You cannot march past an enemy or neutral village to hit one behind it.",
    "You cannot march past an enemy or neutral village to hit one behind it. The same rule protects your INTERIOR villages (no enemy neighbour): " +
    "every road into one of them passes through another of your villages, where an enemy army stops and fights. An interior village can only be attacked " +
    "after the enemy has taken one of your villages next to it, which can happen earlier in the same turn.");
  if (liga.has("capital")) txt = troca(txt, "taking it is NOT required to win.",
    "taking it is NOT required to win. The same holds for YOUR capital: losing it does not lose the game and has no special effect - a capital is a village with a bigger defense bonus.");
  if (liga.has("vigia")) txt = troca(txt, "The enemy is under the same rule: they see you only where their villages and armies reach.",
    "The enemy is under the same rule: they see you only where their villages and armies reach. " +
    "Every enemy army already on the march toward one of YOUR villages is always shown to you under ARMIES ON THE MARCH, whatever the fog; only an army ordered this same turn is not.");
  if (liga.has("semteto")) txt = troca(txt, /troops at home: (\d+) \/ 300/g, "troops at home: $1");
  if (liga.has("movprimeiro")) {
    const mB = txt.match(/^  "build": \[.*\],\n/m), mM = txt.match(/^  "movements": \[.*\],?\n/m);
    if (!mB || !mM || mB.index > mM.index) throw new Error("ancora do braco movprimeiro nao encontrada");
    const linhaM = mM[0].endsWith(",\n") ? mM[0] : mM[0].replace(/\n$/, ",\n");
    const linhaB = mB[0];
    txt = txt.slice(0, mB.index) + linhaM + txt.slice(mB.index + mB[0].length, mM.index) + linhaB + txt.slice(mM.index + mM[0].length);
  }
  if (liga.has("placebo")) txt = txt.replace(/^TOTAL: .*$/m, (l) => `${l}\n  (the list of your villages follows below)`);
  return { p4, p5: txt };
}

module.exports = { carregarMotorP5, montarP5, regrasP5, ITENS_P5 };

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
