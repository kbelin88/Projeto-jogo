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
