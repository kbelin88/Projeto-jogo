// ============================================================
//  test_v1_relatorio.js  —  V1 PECA 1, PARTE B (tradutor visao->texto)
// ------------------------------------------------------------
//  Rodar:  node test_v1_relatorio.js
//
//  (1) Imprime o RELATORIO de um cenario representativo (todas as secoes
//      preenchidas) — o artefato que o Lucas inspeciona como se fosse o Rei.
//  (2) Confere contra a spec: todas as secoes; distancias em TURNOS (nao
//      coordenadas); sem "estimado"; sem x/y; sem veredito "vence"; ids em
//      [colchetes]; secao "ultimo turno" preenchida.
//  (3) Imprime tambem o relatorio de um turno de uma partida real.
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;

// ---- cenario sintetico (controle total p/ exercitar TODAS as secoes) ----
function aldeia(id, x, y, dono, tipo, tropas, recursos, construindo) {
  return {
    id, x, y, nome: "Vila" + id, dono, tipo: tipo || null,
    recursos: recursos || { madeira: 0, ferro: 0 },
    tropas: Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {}),
    construindo: construindo || [],
  };
}

const estado = {
  config: CONFIG,
  turno: 7,
  aldeias: [
    // minhas (Rei A)
    aldeia(0, 100, 100, "A", null, { lanceiro: 12, arqueiro: 4 }, { madeira: 85, ferro: 40 },
      [{ tipo: "cavaleiro", turnosRestantes: 2 }, { tipo: "lanceiro", turnosRestantes: 1 }]),
    aldeia(1, 104, 101, "A", null, { lanceiro: 6 }, { madeira: 30, ferro: 12 }, []),
    // neutras (tipo unico)
    aldeia(2, 107, 103, null, "lanceiro", { lanceiro: 22 }),
    aldeia(3, 118, 100, null, "cavaleiro", { cavaleiro: 31 }),
    aldeia(4, 101, 112, null, "arqueiro", { arqueiro: 27 }),
    aldeia(5, 125, 120, null, "lanceiro", { lanceiro: 38 }),
    // inimigo (Rei B)
    aldeia(9, 130, 130, "B", null, { lanceiro: 20, cavaleiro: 8 }),
  ],
  movimentos: [
    // meu exercito indo numa neutra
    { dono: "A", origemId: 0, destinoId: 3, tropas: { lanceiro: 0, arqueiro: 30, cavaleiro: 0 }, turnosRestantes: 2, turnosTotal: 3 },
    // exercito INIMIGO vindo para a MINHA aldeia (ataque!)
    { dono: "B", origemId: 9, destinoId: 1, tropas: { lanceiro: 25, arqueiro: 0, cavaleiro: 5 }, turnosRestantes: 3, turnosTotal: 6 },
  ],
  log: [
    // eventos DESTE turno (turno 7)
    { tipo: "combate", turno: 7, atacante: "A", alvoId: 2, alvoNome: "Vila2", vencedor: "atacante", baixasForca: 90, conquista: true, Fatk: 300, Fdef: 220 },
    { tipo: "combate", turno: 7, atacante: "A", alvoId: 4, alvoNome: "Vila4", vencedor: "defensor", baixasForca: 120, conquista: false, Fatk: 150, Fdef: 405 },
    { tipo: "reforco", turno: 7, alvoId: 1, alvoNome: "Vila1", dono: "A", tropas: { lanceiro: 6, arqueiro: 0, cavaleiro: 0 } },
    { tipo: "combate", turno: 6, atacante: "B", alvoId: 7, alvoNome: "Vila7", vencedor: "atacante", baixasForca: 10, conquista: true }, // turno antigo: NAO deve aparecer
  ],
};

const visao = Engine.montarVisao(estado, "A");
const rel = Engine.relatorioTexto(visao);

console.log("============ RELATORIO (cenario sintetico, visao do Rei A) ============");
console.log(rel);
console.log("=======================================================================\n");

// ---- conferencias automaticas ----
let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

console.log("Conferencias da Parte B:");
// FORCA TOTAL removida (19/07): na partida o Rei ve so tropa+quantidade+custo.
const secoes = ["SUAS ALDEIAS", "ALDEIAS NEUTRAS", "INIMIGO", "EXERCITOS EM TRANSITO", "O QUE ACONTECEU NO ULTIMO TURNO"];
checa("todas as 5 secoes presentes", secoes.every((s) => rel.includes("=== " + s)), secoes.filter((s) => !rel.includes("=== " + s)).join(",") || "ok");
checa("relatorio NAO fala 'forca' (so tropas)", !/forca/i.test(rel), (rel.match(/forca/i) || []).join());
checa("distancia em TURNOS DE MARCHA", rel.includes("turnos de marcha"));
checa('sem a palavra "estimado"', !/estimad/i.test(rel));
checa("sem coordenadas (x,y) entre parenteses", !/\(\s*\d+\s*,\s*\d+\s*\)/.test(rel));
checa('sem veredito "vence/vencer"', !/vence|vencer/i.test(rel));
checa("ids entre [colchetes]", /\[\d+\]/.test(rel));
checa("transito mostra chegada em turnos", /chega em \d+ turnos/.test(rel));
checa("transito inimigo visivel indo para SUA aldeia", /\(SUA\)/.test(rel));

// secao "ultimo turno" preenchida e SO com eventos do turno atual (7)
const idxUlt = rel.indexOf("=== O QUE ACONTECEU");
const trechoUlt = rel.slice(idxUlt);
checa("ultimo turno preenchido (nao 'nada de relevante')", !trechoUlt.includes("nada de relevante"));
checa("nao vaza evento de turno antigo (Vila7)", !rel.includes("Vila7"));
checa("neutras aparecem ordenadas por distancia (mais proxima primeiro)",
  rel.indexOf("[2]") < rel.indexOf("[3]") && rel.indexOf("[3]") < rel.indexOf("[5]"));

// ---- (3) relatorio de um turno de uma partida real ----
console.log("\n--- Relatorio de uma partida real (burro-vs-burro), turno 6, visao de A ---");
const g = Engine.criarEstadoInicial(CONFIG);
for (let i = 0; i < 6; i++) Engine.rodarTurno(g, null);
console.log(Engine.relatorioTexto(Engine.montarVisao(g, "A")));

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
