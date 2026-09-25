// sonda_comum.js — o que a sonda P4 x P5 partilha: reconstruir o estado de um
// turno, e AVALIAR uma ordem contra esse estado, com o motor.
//
// Avaliar = duas coisas:
//   1. na hora da ordem (o que o Rei podia saber): ataques que ja perdiam,
//      ataques contra alvo com reforco inimigo a caminho, envios convergentes,
//      fracao da guarnicao enviada, retaguarda movida;
//   2. o turno seguinte A SERIO: executa a ordem avaliada + a ordem REAL que o
//      inimigo deu nesse turno (esta no .txt), corre o tick e conta as vitorias
//      e derrotas dos ataques que chegaram. E contrafactual so no lado avaliado.
"use strict";
const path = require("path");
const { carregar } = require("./reexec.js");

const nT = (t) => (t.lanceiro || 0) + (t.arqueiro || 0) + (t.cavaleiro || 0);
const mediana = (v) => { if (!v.length) return null; const s = v.slice().sort((a, b) => a - b); return s[s.length >> 1]; };

// estado DEPOIS do tick do turno t, antes das ordens (o que o Rei ve)
function estadoNoTurno(E, P, t) {
  const g = E.criarEstadoInicial(P.cfg);
  for (let k = 1; k <= t; k++) {
    E.tick(g);
    if (k === t) return g;
    for (const d of ["A", "B"]) {
      if (!E.aldeiasDe(g, d).length) continue;
      const j = P.jog[k + d];
      if (j) { E.executarOrdem(g, d, { construir: j.construir, envios: j.envios }); E.guardarPlano(g, d, j.plano); }
    }
  }
  return g;
}

function avaliar(E, P, t, lado, ordem) {
  const g = estadoNoTurno(E, P, t);
  const inimigo = lado === "A" ? "B" : "A";
  const r = { ataques: 0, jaPerdiam: 0, contraReforcoVisivel: 0, gruposConvergentes: 0, fracGuarnicao: [],
              retaguardaTropas: 0, retaguardaMovida: 0, reforcos: 0, chegaram: 0, venceram: 0, perderam: 0, tropasPerdidasEmDerrota: 0 };
  if (!ordem) return r;
  const diag = E.diagnosticarOrdem(g, lado, ordem);
  const envios = diag.aceitoEnvios || [];
  const aldeia = (id) => g.aldeias.find((a) => a.id === id);
  const visao = E.montarVisao(g, lado);
  const visivel = new Set(visao.alvos.filter((a) => a.visivel).map((a) => a.id));
  const porAlvo = {};
  const saiuDe = {};
  for (const e of envios) {
    saiuDe[e.origemId] = (saiuDe[e.origemId] || 0) + nT(e.tropas);
    const a = aldeia(e.destinoId);
    if (a.dono === lado) { r.reforcos++; continue; }
    r.ataques++;
    if (!E.preverCombate(g, e.tropas, a).atacanteVence) r.jaPerdiam++;
    if (visivel.has(a.id) && g.movimentos.some((m) => m.dono === inimigo && m.destinoId === a.id)) r.contraReforcoVisivel++;
    (porAlvo[a.id] = porAlvo[a.id] || new Set()).add(e.origemId);
    r.fracGuarnicao.push(nT(e.tropas) / Math.max(1, nT(aldeia(e.origemId).tropas)));
  }
  for (const id in porAlvo) if (porAlvo[id].size > 1) r.gruposConvergentes++;
  for (const a of E.aldeiasDe(g, lado)) {
    const ret = g.estradas.adj[a.id].every((v) => aldeia(v).dono === lado);
    if (ret) { r.retaguardaTropas += nT(a.tropas); r.retaguardaMovida += saiuDe[a.id] || 0; }
  }
  // o turno seguinte, com a ordem real do inimigo
  const antes = new Set(g.movimentos.map((m) => m.id));
  E.executarOrdem(g, lado, ordem);
  const jInim = P.jog[t + inimigo];
  if (jInim && E.aldeiasDe(g, inimigo).length) E.executarOrdem(g, inimigo, { construir: jInim.construir, envios: jInim.envios });
  const meus = g.movimentos.filter((m) => m.dono === lado && !antes.has(m.id)).map((m) => ({ id: m.id, tropas: Object.assign({}, m.tropas) }));
  E.tick(g);
  const ainda = new Set(g.movimentos.map((m) => m.id));
  for (const ev of g.log.filter((x) => x.turno === g.turno && x.tipo === "combate" && x.atacante === lado)) {
    r.chegaram++;
    if (ev.vencedor === "atacante") r.venceram++;
    else { r.perderam++; r.tropasPerdidasEmDerrota += ev.atkTropas ? nT(ev.atkTropas) : 0; }
  }
  r.aindaEmMarcha = meus.filter((m) => ainda.has(m.id)).length;
  return r;
}

// soma de varias avaliacoes (varias respostas, varios casos)
function somar(lista) {
  const s = { n: lista.length, ataques: 0, jaPerdiam: 0, contraReforcoVisivel: 0, gruposConvergentes: 0, fracGuarnicao: [],
              retaguardaTropas: 0, retaguardaMovida: 0, reforcos: 0, chegaram: 0, venceram: 0, perderam: 0 };
  for (const r of lista) {
    for (const k of Object.keys(s)) if (typeof s[k] === "number" && k !== "n") s[k] += r[k] || 0;
    s.fracGuarnicao.push(...(r.fracGuarnicao || []));
  }
  s.fracGuarnicaoMediana = mediana(s.fracGuarnicao);
  delete s.fracGuarnicao;
  return s;
}

module.exports = { carregar, estadoNoTurno, avaliar, somar, nT, mediana, RAIZ: path.join(__dirname, "..", "..", "..") };
