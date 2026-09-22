// ============================================================
//  Smoke5fog.js — A CAMARA DO REI (fog of war no mapa), P4 17/08
// ------------------------------------------------------------
//  Rodar:  node testes_arena/Smoke5fog.js
//
//  O que guarda: o seletor "olhos de" do index.html mostra o mapa como UM Rei
//  o ve, e o que chega ao mapa bate com Engine.visiveisPara / game.visto — as
//  MESMAS fontes que o prompt usa. Se este smoke passar e o prompt divergir,
//  o bug esta no render; se divergirem entre si, a camara esta a mentir ao
//  espectador, que e o pior caso (a narracao passaria a contar outra partida).
//
//  ── O QUE MUDOU EM 22/09 ───────────────────────────────────────────────
//  Ate aqui o smoke extraia `desenharNevoaDoRei`, que pintava um veu com
//  buracos no canvas plano. Esse canvas deixou de pintar em 11/09, quando o 3D
//  passou a default, e foi apagado em 22/09 com as outras 1031 linhas de
//  desenho que ninguem via.
//
//  A camara do Rei nao desapareceu: mudou de sitio. Hoje ela e a PONTE — o
//  `empurrarPara3D` decide, aldeia a aldeia, se manda o estado verdadeiro, a
//  ultima fotografia (`lembrada`) ou nada. O invariante e o mesmo e continua a
//  valer a pena tranca-lo: o que o espectador VE tem de ser o que o Rei SABE.
//
//  COMO: extrai reiObservado + empurrarPara3D do index.html e roda-os contra
//  um mapa 3D FALSO que so guarda o que recebeu. Nao abre browser e nao
//  depende do resto do script (o test_index_carrega ja garante que o ficheiro
//  inteiro roda). Se a extracao falhar, o teste FALHA em vez de passar em
//  silencio — um refactor que renomeie as funcoes tem de doer aqui.
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
ok("o index.html entrega os olhos a ponte",
  /reiObservado,/.test(html) && /_ponte\.sincronizar\(/.test(html));
ok("trocar de olhos redesenha", /gvisao[\s\S]{0,200}addEventListener\("change"[\s\S]{0,40}draw\(\)/.test(html));

// ---------- (B) a ponte, do modulo ----------
// ⚠ ATE 22/09 ESTE BLOCO EXTRAIA O `empurrarPara3D` DO index.html COM UMA
// EXPRESSAO REGULAR. A ponte mudou-se para `ponte3d.js` e passa a ser usada
// como o jogo a usa -- o que e melhor: deixa de haver uma copia do codigo a ser
// testada e passa a ser O codigo.
const fReiObs = (html.match(/ {2}function reiObservado\(\)[\s\S]*?\n {2}\}/) || [])[0];
if (!fReiObs) {
  console.log("  [XX ] extrair reiObservado do index.html");
  console.log("\nFALHOU: a funcao dos olhos nao foi encontrada no index.html.");
  console.log("Se foi renomeada ou movida, ATUALIZE este smoke — nao o apague:");
  console.log("ele e o unico ponto que compara o que o espectador VE com o que o Rei SABE.");
  process.exit(1);
}
ok("extraiu reiObservado do index.html", true);
const Ponte3D = require(path.join(__dirname, "..", "ponte3d.js"));
ok("ponte3d.js exporta criar()", typeof Ponte3D.criar === "function");

let olhos = "A";
let recebido = null;
const reiObservado = new Function("document",
  fReiObs + "; return reiObservado;")(
  { getElementById: (id) => (id === "gvisao" ? { value: olhos } : null) });

const ponte = Ponte3D.criar({ Engine: E });
const empurrar = (g) => {
  recebido = null;
  ponte.sincronizar({
    M3D: { atualizar: (d) => { recebido = d; } },
    game: g,
    reiObservado,
    // a ponte tambem carrega marchas e combates; nao e disso que este smoke
    // trata, e um progresso fixo chega para o codigo correr
    progMarcha: () => 0.5,
  });
  ponte.empurrarPara3D();
  return recebido;
};
const porSlug = (d) => new Map(d.aldeias.map((a) => [a.slug, a]));

// ---------- (C) turno 1: ve pouco, o resto e desconhecido ----------
console.log("\n=== (B) turno 1: o Rei ve a sua aldeia e as vizinhas ===");
const g1 = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }));
E.tick(g1);
ok("reiObservado le o select", reiObservado() === "A");

const d1 = empurrar(g1);
const vis1 = E.visiveisPara(g1, "A");
const m1 = porSlug(d1);
ok("o mapa recebe TODAS as aldeias (a geografia e publica)",
  d1.aldeias.length === g1.aldeias.length,
  `${d1.aldeias.length} de ${g1.aldeias.length}`);
ok("marcadas como visiveis exatamente as de visiveisPara",
  d1.aldeias.filter((a) => a.visivel).length === vis1.size,
  `${d1.aldeias.filter((a) => a.visivel).length} p/ ${vis1.size}`);
const naoVistas = g1.aldeias.filter((a) => !vis1.has(a.id) && !g1.visto.A[a.id]);
ok("nunca explorada nao leva dono nem tropas",
  naoVistas.length > 0 && naoVistas.every((a) => {
    const r = m1.get(a.slug);
    return r && r.dono === null && r.tropas === null && r.lembrada === null;
  }),
  `${naoVistas.length} nunca exploradas`);
ok("a aldeia visivel leva a contagem VERDADEIRA do motor",
  [...vis1].every((id) => {
    const a = g1.aldeias.find((v) => v.id === id);
    const r = m1.get(a.slug);
    return r && r.tropas === E.contarTropas(a.tropas) && r.dono === a.dono;
  }));

// ---------- (D) desligado quando deve ----------
console.log("\n=== (C) a camara desliga: espectador ve tudo ===");
olhos = "";
const dEsp = empurrar(g1);
ok("espectador (valor vazio): todas visiveis",
  dEsp.aldeias.every((a) => a.visivel), "omnisciente");
ok("e nenhuma marcada como lembrada",
  dEsp.aldeias.every((a) => a.lembrada === null));
olhos = "A";

// ---------- (E) o caminho 'LEMBRADA' ----------
// Este bloco testa o que CHEGA AO MAPA sobre a memoria. A semantica de quem
// entra e sai da memoria e do motor e esta trancada em testes/test_prompt_p4.js
// (B4/B5); aqui injetamos a entrada exatamente como o registrarAvistamentos a
// escreveria, e verificamos o que o espectador VE.
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
const d2 = empurrar(g2);
const r2 = porSlug(d2).get(alvoReal.slug);
ok("a lembrada chega ao mapa com o TURNO do ultimo avistamento",
  !!r2 && r2.visivel === false && r2.lembrada === g2.visto.A[idAlvo].turno,
  r2 && `lembrada: T${r2.lembrada}`);
ok("e com a fotografia, nao com o estado de agora",
  !!r2 && r2.tropas === E.contarTropas(g2.visto.A[idAlvo].tropas));
const lembradas = g2.aldeias.filter(
  (a) => !E.visiveisPara(g2, "A").has(a.id) && g2.visto.A[a.id]).length;
ok("uma entrada por lembrada, e so essas",
  d2.aldeias.filter((a) => a.lembrada !== null).length === lembradas && lembradas > 0,
  `${d2.aldeias.filter((a) => a.lembrada !== null).length} de ${lembradas}`);

// ---------- (F) os dois Reis veem coisas DIFERENTES ----------
console.log("\n=== (E) a camara e subjetiva: A e B nao veem o mesmo ===");
const g3 = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }));
for (let i = 0; i < 6; i++) E.rodarTurno(g3, { A: E.jogadorBurro, B: E.jogadorBurro });
// ⚠ COMPARAR CONJUNTOS, NAO CONTAGENS. O mapa e simetrico de proposito
// (fairness), por isso os dois Reis costumam ver o MESMO NUMERO de aldeias —
// uma versao anterior deste smoke comparava contagens e passava sem provar
// nada. O que tem de diferir e QUAIS.
const quais = (lado) => {
  olhos = lado;
  return empurrar(g3).aldeias.filter((a) => a.visivel).map((a) => a.slug).sort().join(",");
};
const sA = quais("A"), sB = quais("B");
ok("A e B nao veem as MESMAS aldeias", sA !== sB,
  `${sA.split(",").length} vs ${sB.split(",").length}, conjuntos distintos`);
const nomes = (lado) => [...E.visiveisPara(g3, lado)]
  .map((id) => g3.aldeias.find((a) => a.id === id).slug).sort().join(",");
ok("cada conjunto bate com o visiveisPara do seu Rei",
  sA === nomes("A") && sB === nomes("B"));

// ---------- (G) a marcha tambem obedece ao fog ----------
console.log("\n=== (F) marcha so aparece se o Rei ve uma das pontas ===");
olhos = "A";
const d3 = empurrar(g3);
const visSlugs = new Set([...E.visiveisPara(g3, "A")]
  .map((id) => g3.aldeias.find((a) => a.id === id).slug));
const foraDaVista = d3.marchas.filter((m) => !visSlugs.has(m.de) && !visSlugs.has(m.para));
ok("nao chega ao mapa marcha cujas DUAS pontas o Rei nao ve",
  foraDaVista.length === 0,
  `${d3.marchas.length} marchas entregues, ${foraDaVista.length} as cegas`);

console.log(falhas ? `\nSMOKE 5 FALHOU: ${falhas} checagem(ns)` : "\nSmoke5fog: todos ok");
process.exit(falhas ? 1 : 0);
