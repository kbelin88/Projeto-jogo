// medir-cruzamentos.js — ALGUMA TROPA ATRAVESSA OUTRA NA ESTRADA SEM LUTAR?
//
// Uso:  node ferramentas/medir-cruzamentos.js [seeds=40]
//       node ferramentas/medir-cruzamentos.js --replay caminho.replay.json
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// A maior dificuldade do Lucas antes de gravar (22/09): no replay, os
// exércitos atravessam-se na estrada em vez de pararem e se enfrentarem.
// Isto mede-o com a MESMA conta que o desenho usa: a posição de cada marcha
// dentro do turno é `posicaoRota` com o progresso fracionário (é o que a
// `ponte3d.js` faz com o `progMarcha`). Para cada turno, anda-se o turno em
// passos pequenos e procura-se qualquer par de exércitos inimigos, no mesmo
// troço, cuja ordem ao longo do troço se inverte — um passou pelo outro.
//
// Cada inversão é depois classificada:
//   * SEM LUTA        — o motor não registou combate entre os dois nesse turno.
//                       É o defeito grave: gente que se atravessa e segue.
//   * LUTA DEPOIS     — houve combate, mas no desenho os dois já se tinham
//                       ultrapassado quando ele aparece. É o que o Lucas vê
//                       como "cruzam e só depois lutam".
//   * LUTA NO SÍTIO   — as duas colunas param onde se encontram e lutam ali.
//                       É o único resultado aceitável.
//
// A meta é 0 SEM LUTA e 0 LUTA DEPOIS.
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const E = require(path.join(RAIZ, "engine.js"));

const PASSOS = 50;                                // amostras dentro de um turno

// posicao ao longo do troco (lo->hi) de uma marcha a fracao `r` do turno
function ondeEsta(estado, m, r) {
  const p = E.posicaoRota(estado, Object.assign({}, m, { turnosRestantes: m.turnosRestantes - r }));
  if (!p) return null;
  const lo = Math.min(p.aId, p.bId), hi = Math.max(p.aId, p.bId);
  return { chave: lo + "-" + hi, u: p.aId === lo ? p.t : 1 - p.t };
}

const idDe = (m) => m.dono + ":" + m.origemId + ">" + m.destinoId;

// um turno: `antes` sao as marchas no inicio do turno; `eventos` os combates de
// estrada que o motor registou nesse turno; `limite(m)` diz ate que fracao do
// turno o DESENHO deixa a marcha andar (1 = o turno todo)
function cruzamentosDoTurno(estado, antes, eventos, limite) {
  const lutas = new Set();
  for (const e of eventos) {
    const a = e.atacante + ":" + e.atkOrigemId + ">" + e.atkDestinoId;
    const d = e.defensor + ":" + e.defOrigemId + ">" + e.defDestinoId;
    lutas.add(a + "|" + d); lutas.add(d + "|" + a);
  }
  const achados = [];
  for (let i = 0; i < antes.length; i++) {
    for (let j = i + 1; j < antes.length; j++) {
      const m1 = antes[i], m2 = antes[j];
      if (m1.dono === m2.dono) continue;
      let prev = null;
      for (let k = 0; k <= PASSOS; k++) {
        const r = k / PASSOS;
        // quem ja lutou neste passo saiu da estrada: o perdedor morreu, e o
        // vencedor esta dentro da cena (o mapa esconde-o enquanto ela corre)
        const fora = (m) => limite(m) < 1 && r >= limite(m);
        if (fora(m1) || fora(m2)) { prev = null; continue; }
        const p1 = ondeEsta(estado, m1, r);
        const p2 = ondeEsta(estado, m2, r);
        if (!p1 || !p2 || p1.chave !== p2.chave) { prev = null; continue; }
        const dif = p1.u - p2.u;
        if (prev !== null && Math.sign(dif) !== 0 && Math.sign(prev) !== 0 && Math.sign(dif) !== Math.sign(prev)) {
          const houve = lutas.has(idDe(m1) + "|" + idDe(m2));
          achados.push({ tipo: houve ? "LUTA DEPOIS" : "SEM LUTA", troco: p1.chave, r,
                         a: idDe(m1), b: idDe(m2) });
          break;
        }
        if (Math.abs(dif) > 1e-9) prev = dif;
      }
    }
  }
  return achados;
}

function relatorio(titulo, tudo, nLutas) {
  const conta = (t) => tudo.filter((x) => x.tipo === t).length;
  console.log(`\n${titulo}`);
  console.log(`  combates de estrada registados pelo motor: ${nLutas}`);
  console.log(`  tropas que se ATRAVESSAM no desenho:       ${tudo.length}`);
  console.log(`     - sem luta nenhuma (defeito grave):     ${conta("SEM LUTA")}`);
  console.log(`     - luta depois de se atravessarem:        ${conta("LUTA DEPOIS")}`);
  for (const x of tudo.slice(0, 5))
    console.log(`       ex. (${x.tipo}): seed ${x.seed}, turno ${x.turno}, troco ${x.troco}, ${x.a} x ${x.b}, a ${(100 * x.r).toFixed(0)}% do turno`);
}

// ── modo 1: partidas do jogador-base, simuladas aqui ───────────────────────
function simular(nSeeds, flags) {
  const tudo = [];
  let nLutas = 0;
  for (let seed = 1; seed <= nSeeds; seed++) {
    const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed }, flags || {}));
    let v = null;
    for (let t = 0; t < 100 && !v; t++) {
      // as ordens deste turno ja estao em `movimentos` depois de decidir; o
      // rodarTurno decide DEPOIS do tick, portanto o que vai andar no proximo
      // tick e o que esta em `movimentos` agora
      const antes = JSON.parse(JSON.stringify(st.movimentos));
      const nLog = st.log.length;
      E.rodarTurno(st, { A: E.jogadorBurro, B: E.jogadorBurro });
      const evs = st.log.slice(nLog).filter((e) => e.tipo === "combate_estrada" && e.turno === st.turno);
      nLutas += evs.length;
      const lim = limitesDoDesenho(evs);
      for (const x of cruzamentosDoTurno(st, antes, evs, lim)) tudo.push(Object.assign(x, { turno: st.turno, seed }));
      v = E.checarVitoria(st);
    }
  }
  return { tudo, nLutas };
}

// Ate onde o desenho deixa cada marcha andar num turno com combate: se o
// evento traz `sEncontro` (a fracao do turno em que se encontraram), a marcha
// que lutou para ai; senao anda o turno inteiro, como sempre andou.
function limitesDoDesenho(evs) {
  const lim = new Map();
  for (const e of evs) {
    if (e.sEncontro == null) continue;
    // um vencedor pode lutar duas vezes no mesmo passo: para na PRIMEIRA
    for (const k of [e.atacante + ":" + e.atkOrigemId + ">" + e.atkDestinoId,
                     e.defensor + ":" + e.defOrigemId + ">" + e.defDestinoId])
      lim.set(k, Math.min(e.sEncontro, lim.has(k) ? lim.get(k) : 1));
  }
  return (m) => (lim.has(idDe(m)) ? lim.get(idDe(m)) : 1);
}

// ── modo 2: um replay gravado ──────────────────────────────────────────────
function doReplay(caminho) {
  const rep = JSON.parse(fs.readFileSync(caminho, "utf8"));
  const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: rep.seed || 1 }));
  const tudo = [];
  let nLutas = 0;
  for (let i = 0; i + 1 < rep.frames.length; i++) {
    const fr = rep.frames[i], prox = rep.frames[i + 1];
    st.aldeias = fr.aldeias;
    const antes = fr.movimentos || [];
    const evs = (prox.eventos || []).filter((e) => e.tipo === "combate_estrada");
    nLutas += evs.length;
    for (const x of cruzamentosDoTurno(st, antes, evs, limitesDoDesenho(evs))) tudo.push(Object.assign(x, { turno: prox.turno }));
  }
  return { tudo, nLutas };
}

module.exports = { simular, doReplay, cruzamentosDoTurno };
if (require.main !== module) return;

const iRep = process.argv.indexOf("--replay");
if (iRep > 0) {
  const r = doReplay(process.argv[iRep + 1]);
  relatorio("REPLAY " + path.basename(process.argv[iRep + 1]), r.tudo, r.nLutas);
} else {
  const n = parseInt(process.argv[2], 10) || 40;
  const r = simular(n);
  relatorio(`JOGADOR-BASE, ${n} partidas`, r.tudo, r.nLutas);
}
