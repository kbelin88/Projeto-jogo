// test_index_carrega.js — o index.html CARREGA sem estourar?
//
// Por que existe: `node --check` so valida SINTAXE, e ja deixou passar dois
// erros que quebraram o jogo inteiro em tela:
//   1. um bloco de constantes apagado por engano numa edicao (ReferenceError);
//   2. `const chaveVia` usado antes da declaracao — zona morta temporal, que
//      matou o script no carregamento e deixou a tela marrom (03/08).
// Os dois so aparecem ao EXECUTAR. Entao este teste executa: extrai o script
// embutido do index.html e roda num sandbox com um DOM de mentira.
//
// O dublê e permissivo de proposito (Proxy que aceita qualquer acesso): o alvo
// aqui nao e testar o desenho, e provar que o arquivo chega ao fim sem lancar.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");

let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("  ok  " + nome); };

// ---- dublê universal: responde a qualquer coisa sem reclamar ----
function dublê() {
  const alvo = function () { return dublê(); };
  return new Proxy(alvo, {
    get(_, k) {
      if (k === Symbol.toPrimitive || k === "valueOf") return () => 0;
      if (k === Symbol.iterator) return function* () {};
      if (k === "toString") return () => "";
      if (k === "then") return undefined;            // nao se passa por Promise
      if (k === "length" || k === "width" || k === "height") return 0;
      if (k === "style" || k === "classList" || k === "dataset") return dublê();
      return dublê();
    },
    set() { return true; },
    apply() { return dublê(); },
    construct() { return dublê(); },
    has() { return true; },
  });
}

console.log("CARGA DO index.html");

t("tem exatamente um bloco <script> embutido", () => {
  const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.strictEqual(blocos.length, 1, "esperava 1 bloco inline, achei " + blocos.length);
});

t("o script roda ate o fim sem lancar (pega TDZ e nome sumido)", () => {
  const codigo = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const janela = dublê();
  const ctx = {
    // modulos de verdade: e o contrato que o index consome
    World: require(path.join(RAIZ, "world.js")),
    Iberia: require(path.join(RAIZ, "world-iberia.js")),
    Engine: require(path.join(RAIZ, "engine.js")),
    document: janela,
    navigator: dublê(),
    location: { protocol: "http:", href: "http://localhost/index.html" },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    Image: function () { return dublê(); },
    Blob: function () { return dublê(); },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    fetch: () => ({ then: () => ({ catch: () => {} }) }),
    requestAnimationFrame: () => 0,
    setTimeout: () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    addEventListener: () => {}, alert: () => {}, confirm: () => true,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math: Math, JSON: JSON, Date: Date, Object: Object, Array: Array,
    Number: Number, String: String, Boolean: Boolean, Set: Set, Map: Map,
    isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat, Infinity: Infinity,
    performance: { now: () => 0 },
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;

  try {
    vm.runInNewContext(codigo, ctx, { filename: "index.html <script>", timeout: 15000 });
  } catch (e) {
    assert.fail("o index.html estourou ao carregar: " + e.message +
                "\n    (e isto que deixa a tela marrom no navegador)");
  }
});

t("o mapa autoral chegou inteiro ao index", () => {
  const Iberia = require(path.join(RAIZ, "world-iberia.js"));
  assert.strictEqual(Iberia.CIDADES.length, 24);
  assert.strictEqual(Iberia.ESTRADAS.length, 41);
  assert.deepStrictEqual(Iberia.verificarEquilibrio(), []);
  // os campos cosmeticos assados em 03/08 continuam la
  assert.ok(Iberia.CIDADES.some((c) => c.desloc), "sumiram os `desloc`");
  assert.ok(Iberia.ESTRADAS.some((e) => e.via), "sumiram as `via`");
});

console.log(`\n${ok} testes ok`);
