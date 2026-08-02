// test_iberia_marcha.js — Fase 3, fatia 1: mundo da Iberia + marcha por custo.
//
// O que este teste protege:
//   1. o teatro nasce do arquivo autoral (24 cidades, 41 estradas, 2 capitais)
//   2. a marcha sai de rota(), NAO de Math.hypot  (a lacuna L3, de vez)
//   3. o fator de tropa preserva o espelhamento do mapa
//   4. o mapa procedural (v1/v2) continua medindo por pixel como antes
const assert = require("assert");
const Engine = require("../engine.js");
const Iberia = require("../world-iberia.js");

let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("  ok  " + nome); };

const cfgIberia = () => JSON.parse(JSON.stringify(
  Object.assign({}, Engine.CONFIG, { layout: "iberia", seed: 1 })));

const idDe = (estado, slug) => estado.aldeias.find((a) => a.slug === slug).id;

console.log("EQUILIBRIO DO ARQUIVO");
t("verificarEquilibrio() zerado (o teste de sanidade do mapa, no CI)", () => {
  assert.deepStrictEqual(Iberia.verificarEquilibrio(), []);
});
t("24 cidades / 41 estradas / par bijetivo", () => {
  assert.strictEqual(Iberia.CIDADES.length, 24);
  assert.strictEqual(Iberia.ESTRADAS.length, 41);
  const byId = Object.fromEntries(Iberia.CIDADES.map((c) => [c.id, c]));
  for (const c of Iberia.CIDADES) assert.strictEqual(byId[c.par].par, c.id, "par quebrado em " + c.id);
  assert.strictEqual(Iberia.CIDADES.filter((c) => c.lado === "O").length, 12);
  assert.strictEqual(Iberia.CIDADES.filter((c) => c.lado === "E").length, 12);
});

console.log("MUNDO");
t("24 cidades, 2 capitais, 12 por lado", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  assert.strictEqual(e.aldeias.length, 24);
  assert.strictEqual(e.aldeias.filter((a) => a.capital).length, 2);
  assert.strictEqual(e.aldeias.filter((a) => a.dono === "A").length, 1);
  assert.strictEqual(e.aldeias.filter((a) => a.dono === "B").length, 1);
  assert.strictEqual(e.aldeias.filter((a) => a.dono === null).length, 22);
});

t("as 41 estradas do arquivo viraram a rede (nenhuma derivada)", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  const n = Object.values(e.estradas.adj).reduce((s, v) => s + v.length, 0) / 2;
  assert.strictEqual(n, Iberia.ESTRADAS.length);
  assert.ok(e.estradas.custo, "a rede tem de carregar o custo autoral");
});

t("posicao e nome vem do arquivo", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  const lis = e.aldeias[idDe(e, "lisboa")];
  const src = Iberia.CIDADES.find((c) => c.id === "lisboa");
  assert.strictEqual(lis.nome, src.nome);
  assert.strictEqual(lis.x, src.x);
  assert.strictEqual(lis.y, src.y);
});

console.log("MARCHA (L3)");
t("o caminho do motor e o mesmo de rota()", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  for (const alvo of ["toledo", "salamanca", "murcia", "girona"]) {
    const cam = Engine.caminhoEntre(e, idDe(e, "lisboa"), idDe(e, alvo));
    const slugs = cam.map((id) => e.aldeias[id].slug);
    assert.deepStrictEqual(slugs, Iberia.rota("lisboa", alvo).caminho,
      "motor e arquivo divergiram na rota lisboa->" + alvo);
  }
});

t("turnos saem do custo autoral, nao da linha reta", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  const ref = e.config.velocidade_passo[e.config.relatorio.velocidade_referencia];
  // arqueiro = velocidade de referencia -> fator 1 -> turnos = ceil(custo)
  for (const alvo of ["toledo", "sevilha", "porto"]) {
    const cam = Engine.caminhoEntre(e, idDe(e, "lisboa"), idDe(e, alvo));
    const turnos = Engine.turnosDeCaminho(e, cam, { arqueiro: 5 });
    assert.strictEqual(turnos, Math.ceil(Iberia.rota("lisboa", alvo).custo),
      "lisboa->" + alvo + " nao bateu com o custo do arquivo");
  }
  assert.strictEqual(ref, e.config.velocidade_passo.media);
});

t("salamanca-toledo (serra) cobra o custo autoral, nao o pixel", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  const a = e.aldeias[idDe(e, "salamanca")], b = e.aldeias[idDe(e, "toledo")];
  const porPixel = Math.hypot(a.x - b.x, a.y - b.y) / Iberia.MAPA.pxPorTurno;
  const cam = Engine.caminhoEntre(e, a.id, b.id);
  const turnos = Engine.turnosDeCaminho(e, cam, { arqueiro: 5 });
  assert.strictEqual(turnos, 5);                 // ceil(4.5)
  assert.ok(Math.ceil(porPixel) < turnos,
    "o teste perde o sentido se o pixel nao subestimar a serra");
});

t("tropa lenta demora mais, rapida menos", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  const cam = Engine.caminhoEntre(e, idDe(e, "lisboa"), idDe(e, "toledo"));
  const lento = Engine.turnosDeCaminho(e, cam, { lanceiro: 5 });
  const medio = Engine.turnosDeCaminho(e, cam, { arqueiro: 5 });
  const rapido = Engine.turnosDeCaminho(e, cam, { cavaleiro: 5 });
  assert.ok(lento > medio && medio > rapido, `esperado lento>medio>rapido, veio ${lento}/${medio}/${rapido}`);
  assert.deepStrictEqual([lento, medio, rapido], [13, 9, 6]);
  // exercito misto viaja na velocidade da tropa mais lenta
  assert.strictEqual(Engine.turnosDeCaminho(e, cam, { lanceiro: 1, cavaleiro: 9 }), lento);
});

console.log("ESPELHO");
t("o fator de tropa preserva o espelhamento do mapa", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  for (const tropa of [{ lanceiro: 5 }, { arqueiro: 5 }, { cavaleiro: 5 }]) {
    for (const c of Iberia.CIDADES) {
      const oeste = Engine.turnosDeCaminho(e,
        Engine.caminhoEntre(e, idDe(e, "lisboa"), idDe(e, c.id)), tropa);
      const este = Engine.turnosDeCaminho(e,
        Engine.caminhoEntre(e, idDe(e, "barcelona"), idDe(e, c.par)), tropa);
      assert.strictEqual(oeste, este,
        `espelho quebrou: lisboa->${c.id}=${oeste} vs barcelona->${c.par}=${este}`);
    }
  }
});

t("guarnicao inicial de um par e igual dos dois lados", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  for (const c of Iberia.CIDADES) {
    if (c.papel === "capital") continue;
    const a = e.aldeias[idDe(e, c.id)], b = e.aldeias[idDe(e, c.par)];
    assert.strictEqual(a.tipo, b.tipo, `tipo diferente entre ${c.id} e ${c.par}`);
    assert.deepStrictEqual(a.tropas, b.tropas, `guarnicao diferente entre ${c.id} e ${c.par}`);
  }
});

t("mesma seed -> mesmo mundo (determinismo)", () => {
  const a = Engine.criarEstadoInicial(cfgIberia());
  const b = Engine.criarEstadoInicial(cfgIberia());
  assert.deepStrictEqual(a.aldeias, b.aldeias);
});

console.log("L3 — relatorio x motor");
t("a marcha mostrada no relatorio e a que o motor pratica", () => {
  const e = Engine.criarEstadoInicial(cfgIberia());
  for (let i = 0; i < 8; i++) Engine.rodarTurno(e);
  const visao = Engine.montarVisao(e, "A");
  assert.ok(visao.estradasCusto, "a visao tem de levar o custo autoral ao relatorio");
  const texto = Engine.relatorioTexto(visao);

  // para cada alvo listado, refaz a conta pelo motor e compara com o texto
  let conferidos = 0;
  for (const alvo of visao.alvos) {
    const m = texto.match(new RegExp("\\[" + alvo.id + "\\][^\\n]*?(\\d+) turnos de marcha"));
    if (!m) continue;
    let melhor = Infinity;
    for (const minha of visao.minhas) {
      const cam = Engine.caminhoEntre(e, minha.id, alvo.id);
      if (!cam) continue;
      // relatorio nao sabe a composicao -> velocidade de referencia
      const turnos = Engine.turnosDeCaminho(e, cam, { arqueiro: 1 });
      if (turnos < melhor) melhor = turnos;
    }
    assert.strictEqual(Number(m[1]), melhor,
      `alvo ${alvo.id}: relatorio diz ${m[1]}, motor pratica ${melhor}`);
    conferidos++;
  }
  assert.ok(conferidos >= 5, "poucos alvos conferidos (" + conferidos + ")");
});

console.log("NAO-REGRESSAO");
t("mapa procedural (v2) continua medindo por pixel", () => {
  const cfg = JSON.parse(JSON.stringify(Object.assign({}, Engine.CONFIG, { layout: "v2", seed: 7 })));
  const e = Engine.criarEstadoInicial(cfg);
  assert.ok(!e.estradas.custo, "o mapa procedural nao deve ter custo autoral");
  const a = e.aldeias[0], b = e.aldeias[1];
  const cam = Engine.caminhoEntre(e, a.id, b.id) || [a.id, b.id];
  const esperado = Math.max(1, Math.ceil(
    Engine.distanciaRota(e, cam) / e.config.velocidade_passo.media));
  assert.strictEqual(Engine.turnosDeCaminho(e, cam, { arqueiro: 5 }), esperado);
});

console.log(`\n${ok} testes ok`);
