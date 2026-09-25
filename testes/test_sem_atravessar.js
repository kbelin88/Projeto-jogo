// test_sem_atravessar.js — no replay, nenhuma coluna atravessa outra sem lutar.
//
// A maior queixa do Lucas antes de gravar (22/09): as colunas inimigas
// passavam uma pela outra na estrada e so depois a cena abria, noutro sitio.
// O motor passou a gravar o INSTANTE e o PONTO do encontro (`sEncontro`,
// x/y), e o replay para as duas colunas ali (`progMarcha` no index.html).
//
// Isto corre o jogador-base e desenha cada turno com a mesma conta do mapa
// (`posicaoRota` com progresso fracionario), parando quem luta no instante do
// encontro -- exatamente o que o replay faz -- e exige zero inversoes de ordem
// entre colunas inimigas no mesmo troco.
"use strict";
const assert = require("assert");
const { simular } = require("../ferramentas/medir-cruzamentos.js");

const r = simular(8);
assert.ok(r.nLutas > 100, "o teste precisa de combates de estrada, houve " + r.nLutas);
assert.strictEqual(r.tudo.length, 0,
  "colunas que se atravessam no desenho: " + JSON.stringify(r.tudo.slice(0, 3)));
console.log(`test_sem_atravessar: ${r.nLutas} combates de estrada, 0 colunas atravessadas`);

// ── O VERIFICADOR DE REPLAY (25/09) ─────────────────────────────────────────
// O que corre antes de cada gravacao tem de dar zero em partidas novas: sem
// atravessamentos, sem identidades repetidas no desenho (o bug Valencia-Murcia),
// sem saltos, sem costuras na troca de turno. E cada marcha tem id proprio.
{
  const E = require("../engine.js");
  const { verificar } = require("../ferramentas/verificar-replay.js");
  for (const seed of [3, 7, 11]) {
    const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed }));
    const copia = () => ({ turno: st.turno, aldeias: JSON.parse(JSON.stringify(st.aldeias)),
      movimentos: JSON.parse(JSON.stringify(st.movimentos)), eventos: st.log.filter((e) => e.turno === st.turno) });
    const frames = [copia()];
    const ids = new Set();
    for (let t = 0; t < 60; t++) {
      const v = E.rodarTurno(st, { A: E.jogadorBurro, B: E.jogadorBurro });
      for (const m of st.movimentos) {
        assert.ok(Number.isFinite(m.id), "marcha sem id");
        if (m.turnosRestantes === m.turnosTotal) { assert.ok(!ids.has(m.id), "id repetido " + m.id); ids.add(m.id); }
      }
      frames.push(copia());
      if (v) break;
    }
    const r = verificar({ frames }, seed);
    for (const k of ["atravessamentos", "identidades", "saltos", "costuras", "coladas"]) {
      assert.strictEqual(r[k].length, 0, `seed ${seed}: ${k} ${JSON.stringify(r[k].slice(0, 2))}`);
    }
    console.log(`test_sem_atravessar: seed ${seed}, ${frames.length - 1} turnos, ${r.combatesEstrada} combates de estrada -- verificador limpo`);
  }
}
