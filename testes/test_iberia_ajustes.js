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

console.log(`\n${ok} testes ok`);
