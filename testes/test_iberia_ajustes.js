// test_iberia_ajustes.js — a premissa do editor de mapa em jogo.
//
// O editor deixa arrastar cidade e curvar estrada AO VIVO, sem pedir nada a
// ninguem. Isso so e seguro porque x,y e os pontos de curva sao COSMETICOS:
// nao entram em custo de marcha, rota, `par` nem equilibrio. Este teste
// e o que garante essa premissa — se um dia alguem passar a ler x,y no motor,
// ele quebra aqui e nao em silencio dentro de uma partida.
const assert = require("assert");
const Engine = require("../engine.js");
const Iberia = require("../world-iberia.js");

let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("  ok  " + nome); };

const foto = () => {
  const rotas = {};
  for (const a of Iberia.CIDADES) for (const b of Iberia.CIDADES) {
    if (a.id === b.id) continue;
    const r = Iberia.rota(a.id, b.id);
    rotas[a.id + ">" + b.id] = r.custo + "|" + r.caminho.join(",");
  }
  return rotas;
};

const antes = foto();
const originais = Iberia.CIDADES.map((c) => [c.x, c.y]);

console.log("AJUSTES COSMETICOS");
t("arrastar TODAS as cidades nao mexe em rota nem custo", () => {
  // embaralha as posicoes de proposito: o pior caso que o editor permite
  Iberia.CIDADES.forEach((c, i) => {
    c.x = 200 + (i * 137) % 1300;
    c.y = 200 + (i * 311) % 800;
  });
  assert.deepStrictEqual(Iberia.verificarEquilibrio(), [],
    "equilibrio quebrou so por mover pixel");
  assert.deepStrictEqual(foto(), antes, "alguma rota mudou ao mover as cidades");
});

t("marcha do motor tambem nao muda", () => {
  const cfg = JSON.parse(JSON.stringify(Object.assign({}, Engine.CONFIG, { layout: "iberia", seed: 1 })));
  const e = Engine.criarEstadoInicial(cfg);
  const id = (slug) => e.aldeias.find((a) => a.slug === slug).id;
  for (const alvo of ["toledo", "murcia", "girona", "porto"]) {
    const cam = Engine.caminhoEntre(e, id("lisboa"), id(alvo));
    assert.strictEqual(Engine.turnosDeCaminho(e, cam, { arqueiro: 1 }),
      Math.ceil(Iberia.rota("lisboa", alvo).custo),
      "marcha lisboa->" + alvo + " mudou por causa das posicoes");
  }
});

t("as posicoes chegaram mesmo ao teatro (o teste nao passa por acaso)", () => {
  const cfg = JSON.parse(JSON.stringify(Object.assign({}, Engine.CONFIG, { layout: "iberia", seed: 1 })));
  const e = Engine.criarEstadoInicial(cfg);
  const lis = e.aldeias.find((a) => a.slug === "lisboa");
  const src = Iberia.CIDADES.find((c) => c.id === "lisboa");
  assert.strictEqual(lis.x, src.x);
  assert.strictEqual(lis.y, src.y);
  assert.notDeepStrictEqual([src.x, src.y], originais[0], "as posicoes nem chegaram a mudar");
});

// devolve o arquivo ao estado original — outros testes rodam depois
Iberia.CIDADES.forEach((c, i) => { c.x = originais[i][0]; c.y = originais[i][1]; });

t("restaurado: equilibrio segue zerado", () => {
  assert.deepStrictEqual(Iberia.verificarEquilibrio(), []);
  assert.deepStrictEqual(foto(), antes);
});

// ----------------------------------------------------------------------------
// 7.1.3 (04/08): o teste que FALTAVA e que teria apanhado o L4. Nao basta provar
// que embaralhar x,y nao muda rotas — tem de provar que NAO MUDA AS DECISOES DO
// BURRO. Compara jogadorBurro(visao real) com jogadorBurro(visao com x,y
// permutado), NA MESMA jogada, para isolar a decisao de qualquer divergencia de
// execucao (combate de estrada usa x,y de propósito). Se alguem reintroduzir
// Math.hypot no burro, a permutacao adversarial muda o "mais proximo" e isto
// quebra — em vez de contaminar uma partida em silencio.
console.log("DECISAO DO BURRO NAO LE x,y (o teste que faltava no L4)");

// permuta x,y entre TODAS as aldeias da visao (adversarial p/ hypot), mantendo
// ids, tropas, recursos, forcaDefesa e a rede de estradas intactos.
function visaoComXYPermutado(v) {
  const c = JSON.parse(JSON.stringify(v));
  const todos = c.minhas.concat(c.alvos);
  const coords = todos.map((a) => [a.x, a.y]);
  const n = coords.length;
  todos.forEach((a, i) => { a.x = coords[(i + 7) % n][0]; a.y = coords[(i + 7) % n][1]; });
  return c;
}

t("decisao do burro e identica com x,y permutado (rota+rng, nao pixel)", () => {
  const cfg = JSON.parse(JSON.stringify(Object.assign({}, Engine.CONFIG, { layout: "iberia", seed: 1 })));
  const est = Engine.criarEstadoInicial(cfg);
  let mexeu = false; // garante que a permutacao MUDOU mesmo as coordenadas
  for (let turno = 0; turno < 25; turno++) {
    Engine.tick(est);
    for (const dono of ["A", "B"]) {
      if (!Engine.aldeiasDe(est, dono).length) continue;
      const vReal = Engine.montarVisao(est, dono);
      const vPerm = visaoComXYPermutado(vReal);
      if (vPerm.alvos.some((a, i) => a.x !== vReal.alvos[i].x || a.y !== vReal.alvos[i].y)) mexeu = true;
      const oReal = Engine.jogadorBurro(vReal);
      const oPerm = Engine.jogadorBurro(vPerm);
      assert.deepStrictEqual(oPerm, oReal,
        `turno ${est.turno} Rei ${dono}: burro decidiu diferente so por x,y (L4 de volta?)`);
      Engine.executarOrdem(est, dono, oReal); // trajetoria real segue com a decisao real
    }
    if (Engine.checarVitoria(est)) break;
  }
  assert.ok(mexeu, "a permutacao nem chegou a mudar x,y — o teste passaria por acaso");
});

console.log(`\n${ok} testes ok`);
