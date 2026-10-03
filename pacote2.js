// pacote2.js (29/09; no motor desde 03/10) — o PACOTE 2, parte do PROMPT CAMPEAO.
//
// O prompt campeao e o pacote 2 dentro do modo sessao (sessao.js: N turnos seguidos
// na mesma conversa, o relatorio novo substitui o anterior, memoria do Rei, segunda
// chamada em resposta vazia). Em partidas inteiras, contra o P4 do mesmo modelo na
// mesma partida, ficou a frente em 11 de 12 (Luna 2-0; dots, Super e Ultra 9 de 10).
// A logistica e do pacote (leva a tropa do interior para a frente: +31 pp no dots);
// o placar precisa da sessao junto (o pacote sozinho: 1 de 4 no dots, 0 de 2 no Super).
//
// O pacote: as seis verdades das regras (counter no exercito inteiro, atrito exato,
// quem conquista fica, alcance, capital, vigia), a campanha (o "plan" passa a ser a
// guerra dos proximos turnos) e o mapa da frente v2 (tempo de marcha e a tropa que
// pode estar em cada frente, agora / no turno seguinte / daqui a 2). O prompt
// informa, nao recomenda: sao so somas do que o P4 ja escreve.
// Cada peca vai para onde nao se repete:
//   - mensagem 1 (fixa na sessao, fica em cache): as verdades de REGRA, a CAMPANHA e
//     a LEGENDA do mapa da frente (sistema);
//   - mensagem de turno (so o estado de hoje): o MAPA DA FRENTE v2, os combates de
//     aldeia com numeros e o destino das colunas inimigas (turno).
// O evento de combate de aldeia traz atkTropas/defTropasAntes/defensorDono/
// baixasTropas (engine.js, resolverCombate), que o relato com numeros le.
"use strict";

// ---- utilitarios ------------------------------------------------------------
const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];
const EN = { lanceiro: ["spearman", "spearmen"], arqueiro: ["archer", "archers"], cavaleiro: ["knight", "knights"] };
const nT = (t) => TIPOS.reduce((s, k) => s + ((t && t[k]) || 0), 0);
const comp = (t) => TIPOS.filter((k) => t && t[k]).map((k) => `${t[k]} ${EN[k][t[k] === 1 ? 0 : 1]}`).join(", ") || "no troops";
const tropas = (x) => `${x} troop${x === 1 ? "" : "s"}`;
function nomeDe(visao, id) {
  const a = visao.minhas.concat(visao.alvos).find((v) => v.id === id);
  return `[${id}]${a && a.nome ? " " + a.nome : ""}`;
}
// troca que FALHA alto se a ancora sumir (uma peca que nao entra e uma peca que mente)
function troca(txt, de, para) {
  if (!txt.includes(de)) throw new Error("pacote2_sessao: ancora nao encontrada: " + String(de).slice(0, 70));
  return txt.replace(de, para);
}

// ---- mensagem 1: as verdades, a campanha e a legenda -------------------------
function sistema(txt) {
  // regras (P5-1/2/3): counter no exercito inteiro, atrito exato, quem conquista fica
  txt = troca(txt, "Having the counter multiplies your force by 1.5.",
    "Having the counter multiplies your WHOLE army's force by 1.5 (every troop in it, not only the countering type).");
  txt = troca(txt, "The winner also takes losses (attrition against the loser's effective force).",
    "The LOSER is destroyed entirely - this includes an attacker that fails against a village. " +
    "The WINNER loses troops worth HALF of the loser's effective force, spread over its troop types: " +
    "that amount does not depend on the winner's size, so a bigger winning army loses a smaller share of itself. " +
    "A defender that holds its village loses troops the same way.");
  txt = troca(txt, "You cannot march past an enemy or neutral village to hit one behind it.",
    "You cannot march past an enemy or neutral village to hit one behind it. " +
    "When an attack conquers a village, the surviving attackers stay there as its new garrison.");
  // alcance, capital, vigia: as tres verdades de seguranca
  txt = troca(txt, "You cannot march past an enemy or neutral village to hit one behind it.",
    "You cannot march past an enemy or neutral village to hit one behind it. The same rule protects your INTERIOR villages (no enemy neighbour): " +
    "every road into one of them passes through another of your villages, where an enemy army stops and fights. An interior village can only be attacked " +
    "after the enemy has taken one of your villages next to it, which can happen earlier in the same turn.");
  txt = troca(txt, "taking it is NOT required to win.",
    "taking it is NOT required to win. The same holds for YOUR capital: losing it does not lose the game and has no special effect - a capital is a village with a bigger defense bonus.");
  txt = troca(txt, "The enemy is under the same rule: they see you only where their villages and armies reach.",
    "The enemy is under the same rule: they see you only where their villages and armies reach. " +
    "Every enemy army already on the march toward one of YOUR villages is always shown to you under ARMIES ON THE MARCH, whatever the fog; only an army ordered this same turn is not.");
  // a campanha: o "plan" passa a ser a guerra dos proximos turnos, reescrita todo turno
  txt = troca(txt, '- "plan": your NOTE TO YOUR NEXT TURN, 2 to 4 lines (anything past 600 characters is cut off). Write what you are trying to do, what you must not forget, and what you decided NOT to do.',
    '- "plan": your CAMPAIGN - the war you are running over the NEXT SEVERAL TURNS, not just this one: which front you push, where your troops gather, what you take next and after that. 2 to 6 lines (anything past 600 characters is cut off). Your earlier replies stay above in this conversation; rewrite the campaign every turn: keep it, update it or replace it.');
  txt = troca(txt, '  "plan": "<your note to your next turn>",', '  "plan": "<your campaign over the next turns>",');
  // a legenda do mapa da frente: uma vez so, aqui, e nao em cada turno
  txt = troca(txt, "| from [x] a/b/c = turns to march there from your village x with slow/medium/fast troops.",
    "| from [x] a/b/c = turns to march there from your village x with slow/medium/fast troops.\n" +
    "FRONT MAP (in every report; the same facts, arranged by front): FRONT LINE = your villages that touch a village not yours, with what each one faces. " +
    "\"troops that can be here\" adds up, for that village, the troops at home, your armies already marching there, and everything AVAILABLE TO SEND NOW in the REAR villages " +
    "whose nearest front village it is, if sent this turn - now, next turn and in 2 turns, with their attack power (troops sent together march at the speed of the slowest; " +
    "routes go only through your own villages). REAR = your villages with no neighbour that is not yours, with the nearest front village and the turns to reach it (slow/medium/fast).");
  return txt;
}

// ---- mensagem de turno: o mapa v2, os combates com numeros, a intencao --------
// P5-4: o combate de aldeia com numeros, como o de estrada
function eventoAldeia(ev, me, visao) {
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
// P5-5: para QUEM vai a coluna inimiga avistada (so o dono do destino, que o Rei ja ve)
function intencaoMarcha(m, visao) {
  if (visao.minhas.find((a) => a.id === m.destinoId)) return "YOUR village";
  const a = visao.alvos.find((x) => x.id === m.destinoId) || {};
  return a.dono === null ? "a NEUTRAL village" : "THEIR OWN village (a reinforcement)";
}

// o mapa da frente v2: o texto da sonda de 29/09, sem a frase de explicacao (que
// passou para a legenda da mensagem 1). Caminhos SO por aldeias proprias.
function mapaDaFrente2(E, dono, visao, txt) {
  // a defesa que o PROPRIO relatorio mostra na linha do alvo (compacto: "| def N")
  const defNoTexto = (id) => {
    const m = txt.match(new RegExp("^\\[" + id + "\\][^\\n]*\\| def (\\d+(?:\\.\\d+)?)", "m"))
      || txt.match(new RegExp("^\\[" + id + "\\][^\\n]*effective defense \\(location bonus included\\): (\\d+)", "m"));
    return m ? m[1] : null;
  };
  const adj = visao.estradas || {};
  const alvo = (id) => visao.alvos.find((a) => a.id === id);
  const minha = new Set(visao.minhas.map((a) => a.id));
  const nome = (id) => nomeDe(visao, id);
  const cfg = visao.config;
  const atq = (t) => E.ataqueDe(t, cfg);
  const adjProprio = {};
  for (const a of visao.minhas) adjProprio[a.id] = (adj[a.id] || []).filter((v) => minha.has(v));
  const shim = { config: cfg, estradas: { adj: adjProprio, custo: visao.estradasCusto || null }, aldeias: visao.minhas.slice() };
  const borda = visao.minhas.filter((a) => (adj[a.id] || []).some((v) => !minha.has(v)));
  const interior = visao.minhas.filter((a) => !borda.includes(a));
  const destino = new Map();   // id da retaguarda -> { frente, cam }: cada uma conta UMA vez
  for (const a of interior) {
    let best = null, bd = Infinity;
    for (const b of borda) { const c = E.caminhoEntre(shim, a.id, b.id); if (!c) continue; const d = E.pesoRota(shim, c); if (d < bd) { bd = d; best = { frente: b, cam: c }; } }
    if (best) destino.set(a.id, best);
  }
  const quando = (t) => (t === 1 ? "next turn" : `in ${t} turns`);
  const L = ["=== FRONT MAP ==="];
  L.push("FRONT LINE - your villages that touch a village not yours:");
  for (const a of borda) {
    const viz = (adj[a.id] || []).filter((v) => !minha.has(v)).map((v) => {
      const t = alvo(v) || {};
      const quem = t.dono === null ? "neutral" : (t.dono && t.dono !== dono ? "ENEMY" : "unknown");
      const d = t.visivel ? defNoTexto(v) : null;
      return `${nome(v)} (${quem}${d != null ? `, effective defense ${d}` : ""})`;
    });
    L.push(`- ${nome(a.id)} with ${nT(a.tropas)} troops at home faces: ${viz.join(", ")}`);
    const chega = [];
    for (const m of (visao.transito || []).filter((x) => x.dono === dono && x.destinoId === a.id && nT(x.tropas) > 0))
      chega.push({ t: m.turnosRestantes, tropas: m.tropas, txt: `your army already marching here, ${nT(m.tropas)} (arrives ${quando(m.turnosRestantes)})` });
    for (const r of interior) {
      const d = destino.get(r.id);
      if (!d || d.frente.id !== a.id || !nT(r.tropas)) continue;
      const t = E.turnosDeCaminho(shim, d.cam, r.tropas);
      chega.push({ t, tropas: r.tropas, txt: `${nome(r.id)} ${nT(r.tropas)} (${quando(t)})` });
    }
    if (!chega.length) continue;
    const ate = (k) => { const s = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 }; for (const x of [{ t: 0, tropas: a.tropas }].concat(chega)) if (x.t <= k) for (const tp of TIPOS) s[tp] += x.tropas[tp] || 0; return s; };
    const passos = [0, 1, 2].map((k) => ate(k));
    L.push(`    troops that can be here: now ${nT(passos[0])} (attack power ${atq(passos[0])}) | next turn ${nT(passos[1])} (attack power ${atq(passos[1])}) | in 2 turns ${nT(passos[2])} (attack power ${atq(passos[2])})`);
    L.push(`    from: ${chega.sort((x, y) => x.t - y.t).map((x) => x.txt).join("; ")}`);
  }
  L.push("REAR - your villages with no neighbour that is not yours:");
  if (!interior.length) L.push("- none");
  for (const a of interior) {
    const d = destino.get(a.id);
    const ate = d ? ` - nearest front village ${nome(d.frente.id)}: ${E.turnosDeCaminho(shim, d.cam, { lanceiro: 1 })} slow / ${E.turnosDeCaminho(shim, d.cam, { arqueiro: 1 })} medium / ${E.turnosDeCaminho(shim, d.cam, { cavaleiro: 1 })} fast turns` : "";
    L.push(`- ${nome(a.id)} with ${nT(a.tropas)} troops at home${ate}`);
  }
  return L.join("\n") + "\n";
}

function turno(E, txt, visao, dono) {
  // combate: troca, linha a linha, as frases de combate de aldeia do relatorio
  for (const ev of (visao.eventos || []).filter((x) => x.tipo === "combate")) {
    const euAtaquei = ev.atacante === dono;
    const quem = euAtaquei ? "You" : "King " + ev.atacante;
    const frase = ev.vencedor === "atacante"
      ? `- ${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: VICTORY, conquered${euAtaquei ? ` (your losses: ${ev.baixasForca} troops)` : ""}`
      : `- ${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: DEFEAT${euAtaquei ? " (your army was lost)" : ""}`;
    if (txt.includes(frase) && ev.atkTropas) txt = txt.replace(frase, "- " + eventoAldeia(ev, dono, visao));
  }
  // intencao: cada coluna inimiga avistada ganha o dono do destino
  const porDestino = new Map((visao.transito || []).filter((x) => x.dono !== dono).map((m) => [m.destinoId, m]));
  txt = txt.replace(/^- enemy army marching toward \[(\d+)\]([^\n]*), arrives in (\d+) turns?$/gm, (l, id, nm, t) => {
    const m = porDestino.get(Number(id));
    return m ? `- enemy army marching toward [${id}]${nm} - ${intencaoMarcha(m, visao)} - arrives in ${t} turn${t === "1" ? "" : "s"}` : l;
  });
  // o mapa da frente v2, antes dos alvos
  return troca(txt, "=== VILLAGES YOU CAN SEE", mapaDaFrente2(E, dono, visao, txt) + "\n=== VILLAGES YOU CAN SEE");
}

// o que o sessao.js recebe: transforma a mensagem 1 e cada mensagem de turno
function transformador(E) {
  return {
    sistema: (txt) => sistema(txt),
    turno: (txt, visao, dono) => turno(E, txt, visao, dono),
  };
}

module.exports = { transformador, sistema, turno, mapaDaFrente2 };
