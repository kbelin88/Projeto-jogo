// ============================================================
//  Smoke5fog.js — A CAMARA DO REI (fog of war no canvas), P4 17/08
// ------------------------------------------------------------
//  Rodar:  node testes_arena/Smoke5fog.js
//
//  O que guarda: o seletor "olhos de" do index.html mostra o mapa como UM Rei
//  o ve, e o que ele desenha bate com Engine.visiveisPara / game.visto — as
//  MESMAS fontes que o prompt usa. Se este smoke passar e o prompt divergir,
//  o bug esta no render; se divergirem entre si, a camara esta a mentir ao
//  espectador, que e o pior caso (a narracao passaria a contar outra partida).
//
//  COMO: extrai reiObservado + desenharNevoaDoRei do index.html e roda-as
//  contra um contexto 2d FALSO que so registra chamadas. Nao abre browser e
//  nao depende do resto do script (o test_index_carrega ja garante que o
//  ficheiro inteiro roda). Se a extracao falhar, o teste FALHA em vez de
//  passar em silencio — um refactor que renomeie as funcoes tem de doer aqui.
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const E = require(path.join(__dirname, "..", "engine.js"));

let falhas = 0;
const ok = (nome, cond, detalhe) => {
  if (!cond) falhas++;
  console.log(`  [${cond ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
};

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// ---------- (A) o controlo existe e esta ligado ----------
console.log("\n=== (A) o seletor de olhos ===");
ok("select #gvisao existe", /id="gvisao"/.test(html));
ok("tres opcoes: espectador, Rei A, Rei B",
  /value=""[^>]*>espectador/.test(html) && /value="A">Rei A</.test(html) && /value="B">Rei B</.test(html));
ok("drawGame chama a nevoa no FIM (camada por cima de tudo)", /desenharNevoaDoRei\(\);\s*\n\s*\}/.test(html));
ok("trocar de olhos redesenha", /gvisao[\s\S]{0,200}addEventListener\("change"[\s\S]{0,40}draw\(\)/.test(html));

// ---------- (B) extracao das funcoes ----------
const src = (html.match(/function reiObservado\(\)[\s\S]*?\n  \}\n  function desenharNevoaDoRei\(\)[\s\S]*?\n  \}\n/) || [])[0];
if (!src) {
  console.log("  [XX ] extrair reiObservado + desenharNevoaDoRei do index.html");
  console.log("\nFALHOU: as funcoes da camara do fog nao foram encontradas no index.html.");
  console.log("Se foram renomeadas ou movidas, ATUALIZE este smoke — nao o apague:");
  console.log("ele e o unico ponto que compara o que o espectador VE com o que o Rei SABE.");
  process.exit(1);
}
ok("extraiu reiObservado + desenharNevoaDoRei do index.html", true);

const calls = [];
const ctx = new Proxy({}, {
  get: (t, k) => {
    if (k === "measureText") return () => ({ width: 120 });
    return (...a) => calls.push([k, ...a]);
  },
  set: () => true,
});
let olhos = "A";
const sandbox = {
  ctx, Engine: E, VW: 1200, VH: 800, TILE: 16, scale: 1.4,
  COR: { A: "#6c8cff", B: "#ff6c6c", neutra: "#bbbbbb" },
  SX: (x) => x * 0.5, SY: (y) => y * 0.5,
  game: null,
  document: { getElementById: (id) => (id === "gvisao" ? { value: olhos } : null) },
};
const fabricar = new Function(...Object.keys(sandbox),
  src + "; return { reiObservado, desenharNevoaDoRei };");
const montar = (g) => { sandbox.game = g; return fabricar(...Object.values(sandbox)); };

// ---------- (C) turno 1: ve pouco, o resto e '?' ----------
console.log("\n=== (B) turno 1: o Rei ve a sua aldeia e as vizinhas ===");
const g1 = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }));
E.tick(g1);
let api = montar(g1);
ok("reiObservado le o select", api.reiObservado() === "A");
calls.length = 0; api.desenharNevoaDoRei();
const vis1 = E.visiveisPara(g1, "A");
const txt1 = calls.filter((c) => c[0] === "fillText").map((c) => c[1]);
ok("pintou o veu com buracos (fill evenodd)", calls.some((c) => c[0] === "fill" && c[1] === "evenodd"));
ok("um buraco por aldeia visivel", calls.filter((c) => c[0] === "arc").length >= vis1.size,
  `${calls.filter((c) => c[0] === "arc").length} arcos p/ ${vis1.size} visiveis`);
ok("etiqueta diz de quem sao os olhos", txt1.some((t) => /olhos do Rei A/.test(t)),
  txt1.find((t) => /olhos/.test(t)));
ok("a contagem da etiqueta bate com visiveisPara",
  txt1.some((t) => t.includes(`ve ${vis1.size} `) && t.includes(`nunca viu ${g1.aldeias.length - vis1.size}`)));
ok("'?' em TODAS as nunca exploradas",
  txt1.filter((t) => t === "?").length === g1.aldeias.length - vis1.size,
  `${txt1.filter((t) => t === "?").length} de ${g1.aldeias.length - vis1.size}`);

// ---------- (D) desligado quando deve ----------
console.log("\n=== (C) a camara desliga: espectador e fogOfWar:false ===");
olhos = ""; calls.length = 0; montar(g1).desenharNevoaDoRei();
ok("espectador (valor vazio): nao desenha nada", calls.length === 0, `${calls.length} chamadas`);
olhos = "A";
g1.config.fogOfWar = false; calls.length = 0; montar(g1).desenharNevoaDoRei();
ok("fogOfWar:false: nao desenha nada", calls.length === 0, `${calls.length} chamadas`);
g1.config.fogOfWar = true;

// ---------- (E) o caminho 'LEMBRADA' ----------
// Este bloco testa o DESENHO da memoria. A semantica de quem entra e sai da
// memoria e do motor e esta trancada em testes/test_prompt_p4.js (B4/B5); aqui
// injetamos a entrada exatamente como o registrarAvistamentos a escreveria, e
// verificamos o que o espectador VE.
//
// Porque nao produzir a memoria "naturalmente": burro x burro nunca perde
// aldeia de vista, e a tentativa obvia (mandar um exercito longe e depois
// tira-lo) nao serve — a marcha PARA na 1a aldeia nao-sua do caminho, entao o
// destino que ela ilumina e quase sempre um vizinho direto, que ja era visivel.
// Foi este smoke que revelou isso, e a documentacao foi corrigida por causa
// dele: o cavaleiro nao "espia" longe, ele apenas CONQUISTA depressa — e cada
// conquista e que abre a vizinhanca seguinte.
console.log("\n=== (D) aldeia LEMBRADA: viu antes, nao ve agora ===");
const g2 = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }));
E.tick(g2);
const minhaG2 = E.aldeiasDe(g2, "A")[0];
const idAlvo = g2.aldeias.find((a) =>
  a.dono === null && !(g2.estradas.adj[minhaG2.id] || []).includes(a.id) && a.id !== minhaG2.id).id;
ok("pre-condicao: alvo escolhido esta FORA da visao", !E.visiveisPara(g2, "A").has(idAlvo));
const alvoReal = g2.aldeias.find((a) => a.id === idAlvo);
g2.visto.A[idAlvo] = {                             // a foto que o motor teria gravado
  turno: g2.turno, dono: alvoReal.dono, capital: !!alvoReal.capital,
  tropas: { lanceiro: alvoReal.tropas.lanceiro, arqueiro: alvoReal.tropas.arqueiro, cavaleiro: alvoReal.tropas.cavaleiro },
};
ok("memoria injetada como o motor a escreveria", !!g2.visto.A[idAlvo]);
ok("continua INVISIVEL (memoria nao da visao)", !E.visiveisPara(g2, "A").has(idAlvo));
calls.length = 0; montar(g2).desenharNevoaDoRei();
const txt2 = calls.filter((c) => c[0] === "fillText").map((c) => c[1]);
const lembradas = g2.aldeias.filter((a) => !E.visiveisPara(g2, "A").has(a.id) && g2.visto.A[a.id]).length;
ok("desenha 'Tn' (turno do ultimo avistamento) em cada lembrada",
  txt2.filter((t) => /^T\d+$/.test(t)).length === lembradas && lembradas > 0,
  `${txt2.filter((t) => /^T\d+$/.test(t)).length} de ${lembradas}`);
ok("a etiqueta conta a lembrada", txt2.some((t) => t.includes(`lembra ${lembradas} `)),
  txt2.find((t) => /olhos/.test(t)));
ok("usa pontilhado na lembrada (nao confundir com visivel)", calls.some((c) => c[0] === "setLineDash"));

// ---------- (F) os dois Reis veem coisas DIFERENTES ----------
console.log("\n=== (E) a camara e subjetiva: A e B nao veem o mesmo ===");
const g3 = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }));
for (let i = 0; i < 6; i++) E.rodarTurno(g3, { A: E.jogadorBurro, B: E.jogadorBurro });
const conta = (lado) => {
  olhos = lado; calls.length = 0; montar(g3).desenharNevoaDoRei();
  return calls.filter((c) => c[0] === "fillText").map((c) => c[1]).find((t) => /olhos do Rei/.test(t));
};
const eA = conta("A"), eB = conta("B");
ok("a etiqueta de A nao e a de B", eA !== eB, `A: "${eA}" | B: "${eB}"`);
ok("cada uma bate com o visiveisPara do seu Rei",
  eA.includes(`ve ${E.visiveisPara(g3, "A").size} `) && eB.includes(`ve ${E.visiveisPara(g3, "B").size} `));

console.log(falhas ? `\nSMOKE 5 FALHOU: ${falhas} checagem(ns)` : "\nSmoke5fog: todos ok");
process.exit(falhas ? 1 : 0);
