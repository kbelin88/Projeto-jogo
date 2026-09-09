// world-iberia.js - Arena dos Reis  (v3, 24 cidades / 39 estradas)
//
// EQUILIBRIO
// O grafo do Oeste e o do Este sao isomorfos: cada cidade tem uma gemea
// estrutural (`par`) com os custos de marcha invertidos.
//   custo(lisboa -> X) === custo(barcelona -> par(X))  para toda cidade X
// Posicoes sao geograficas reais; o equilibrio vive nos custos, nao nos pixels.
// Alcance total das 22 aldeias: 215.5 turnos de qualquer capital.
//
// v2: acrescentadas as vias de contorno Cordoba-Murcia e Burgos-Vigo
// (sao espelho uma da outra, por isso entram em par e a simetria se mantem).
// Trafego minimo por Toledo/Madrid caiu de 12.6% para 8.1%.

// FORMATO (02/08): UMD, igual ao world.js — no Node vira module.exports, no
// navegador vira o global `Iberia`. O engine.js e o index.html sao script
// classico, entao ES module aqui obrigaria a converter os dois. Os dados
// abaixo nao mudaram: so o involucro.
(function (root, factory) {
  const Iberia = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = Iberia;
  else root.Iberia = Iberia;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

const MAPA = {
  escalaDesenho: 1.6,        // x/y abaixo ja incluem esta escala
  viewBox: '130 144 1429 886',
  pxPorTurno: 67.2,          // 42 * escalaDesenho
  capitais: { oeste: 'lisboa', este: 'barcelona' },
  eixoCentral: ['toledo', 'madrid'],
  viasDeContorno: [['cordoba','murcia'], ['burgos','vigo']],
};

// sprite: peca do kit a desenhar. ancora = centro da BASE em (x, y).
const CIDADES = [
  { id:'lisboa',     nome:'Lisboa',      x:   326.5, y:   668.1, lado:'O', papel:'capital', tamanho:'capital',  sprite:'castelo',       dono:'oeste', par:'barcelona', custoLisboa:  0.0, custoBarcelona: 17.0, desloc:[-21.4,6.7] },
  { id:'santarem',   nome:'Santarem',    x:   426.9, y:   574.9, lado:'O', papel:'anel1a', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'tarragona', custoLisboa:  1.5, custoBarcelona: 15.5, desloc:[-6,8] },
  { id:'evora',      nome:'Evora',       x:   469.3, y:   661.3, lado:'O', papel:'anel1b', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'girona',    custoLisboa:  2.0, custoBarcelona: 17.5, desloc:[4.7,9.3] },
  { id:'coimbra',    nome:'Coimbra',     x:   554.0, y:   515.6, lado:'O', papel:'anel2a', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'castellon', custoLisboa:  3.5, custoBarcelona: 13.5, desloc:[2.7,16] },
  { id:'badajoz',    nome:'Badajoz',     x:   650.8, y:   614.8, lado:'O', papel:'anel2b', tamanho:'media',    sprite:'aldeia_neutra', dono:null,   par:'zaragoza',  custoLisboa:  4.5, custoBarcelona: 12.5 },
  { id:'faro',       nome:'Faro',        x:   393.0, y:   818.2, lado:'O', papel:'anel2c', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'huesca',    custoLisboa:  4.5, custoBarcelona: 15.0, desloc:[2,12.7] },
  { id:'porto',      nome:'Porto',       x:   471.7, y:   395.8, lado:'O', papel:'anel3a', tamanho:'grande',   sprite:'aldeia_neutra', dono:null,   par:'valencia',  custoLisboa:  5.5, custoBarcelona: 12.5, desloc:[0,10] },
  { id:'salamanca',  nome:'Salamanca',   x:   685.9, y:   434.5, lado:'O', papel:'anel3c', tamanho:'media',    sprite:'aldeia_neutra', dono:null,   par:'teruel',    custoLisboa:  7.0, custoBarcelona: 10.0, desloc:[2.7,11.3] },
  { id:'toledo',     nome:'Toledo',      x:   753.7, y:   681.4, lado:'O', papel:'centro', tamanho:'grande',   sprite:'aldeia_neutra', dono:null,   par:'madrid',    custoLisboa:  7.0, custoBarcelona: 10.0, desloc:[2,10] },
  { id:'sevilha',    nome:'Sevilha',     x:   601.5, y:   773.0, lado:'O', papel:'anel3b', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'pamplona',  custoLisboa:  8.0, custoBarcelona: 14.0, desloc:[0.8,10.9] },
  { id:'vigo',       nome:'Vigo',        x:   511.8, y:   290.7, lado:'O', papel:'anel4a', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'murcia',    custoLisboa:  8.0, custoBarcelona: 12.5, desloc:[2,8] },
  { id:'cordoba',    nome:'Cordoba',     x:   820.3, y:   877.5, lado:'O', papel:'anel4b', tamanho:'media',    sprite:'aldeia_neutra', dono:null,   par:'burgos',    custoLisboa:  9.5, custoBarcelona: 11.0, desloc:[-0.7,16] },
  { id:'madrid',     nome:'Madrid',      x:   854.2, y:   485.3, lado:'E', papel:'centro', tamanho:'grande',   sprite:'aldeia_neutra', dono:null,   par:'toledo',    custoLisboa: 10.0, custoBarcelona:  7.0, desloc:[2.7,11.3] },
  { id:'teruel',     nome:'Teruel',      x:   951.0, y:   618.5, lado:'E', papel:'anel3c', tamanho:'media',    sprite:'aldeia_neutra', dono:null,   par:'salamanca', custoLisboa: 10.0, custoBarcelona:  7.0, desloc:[3.3,11.7] },
  { id:'burgos',     nome:'Burgos',      x:   777.9, y:   324.3, lado:'E', papel:'anel4b', tamanho:'media',    sprite:'aldeia_neutra', dono:null,   par:'cordoba',   custoLisboa: 11.0, custoBarcelona:  9.5, desloc:[4.7,8.7] },
  { id:'murcia',     nome:'Murcia',      x:  1013.7, y:   817.8, lado:'E', papel:'anel4a', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'vigo',      custoLisboa: 12.5, custoBarcelona:  8.0, desloc:[1.3,8] },
  { id:'valencia',   nome:'Valencia',    x:  1121.1, y:   704.8, lado:'E', papel:'anel3a', tamanho:'grande',   sprite:'aldeia_neutra', dono:null,   par:'porto',     custoLisboa: 12.5, custoBarcelona:  5.5, desloc:[2.7,4] },
  { id:'zaragoza',   nome:'Zaragoza',    x:  1068.8, y:   444.9, lado:'E', papel:'anel2b', tamanho:'media',    sprite:'aldeia_neutra', dono:null,   par:'badajoz',   custoLisboa: 12.5, custoBarcelona:  4.5, desloc:[1.7,14.2] },
  { id:'castellon',  nome:'Castellon',   x:  1141.7, y:   553.4, lado:'E', papel:'anel2a', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'coimbra',   custoLisboa: 13.5, custoBarcelona:  3.5, desloc:[2,11.3] },
  { id:'pamplona',   nome:'Pamplona',    x:   930.4, y:   301.3, lado:'E', papel:'anel3b', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'sevilha',   custoLisboa: 14.0, custoBarcelona:  8.0, desloc:[7.3,13.3] },
  { id:'huesca',     nome:'Huesca',      x:  1173.7, y:   348.6, lado:'E', papel:'anel2c', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'faro',      custoLisboa: 15.0, custoBarcelona:  4.5, desloc:[1.7,10] },
  { id:'tarragona',  nome:'Tarragona',   x:  1289.4, y:   501.0, lado:'E', papel:'anel1a', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'santarem',  custoLisboa: 15.5, custoBarcelona:  1.5, desloc:[4.2,10.7] },
  { id:'barcelona',  nome:'Barcelona',   x:  1414.6, y:   463.6, lado:'E', papel:'capital', tamanho:'capital',  sprite:'castelo',       dono:'este', par:'lisboa',    custoLisboa: 17.0, custoBarcelona:  0.0, desloc:[-13.1,0] },
  { id:'girona',     nome:'Girona',      x:  1299.6, y:   382.4, lado:'E', papel:'anel1b', tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,   par:'evora',     custoLisboa: 17.5, custoBarcelona:  2.0, desloc:[-0.9,12.2] },
];

// terreno multiplica o tempo de marcha:
//   costa .85 | vale .95 | planicie 1.00 | planalto 1.10 | serra 1.35
// `custo` ja inclui o multiplicador, arredondado a meio turno.
const ESTRADAS = [
  { de:'barcelona',  para:'tarragona',  custo:  1.5, terreno:'costa'     , via:[[1350.1,476.1]] },
  { de:'lisboa',     para:'santarem',   custo:  1.5, terreno:'costa'     , via:[[380.6,625.7]] },
  { de:'barcelona',  para:'girona',     custo:  2.0, terreno:'serra'     , via:[[1361.0,417.4]] },
  { de:'evora',      para:'lisboa',     custo:  2.0, terreno:'costa'     , via:[[397.6,658.2]] },
  { de:'castellon',  para:'tarragona',  custo:  2.0, terreno:'costa'     , via:[[1217.8,533.4]] },
  { de:'coimbra',    para:'santarem',   custo:  2.0, terreno:'planicie'  , via:[[487.2,538.2]] },
  { de:'castellon',  para:'valencia',   custo:  2.0, terreno:'planicie'  , via:[[1124.8,628.2]] },
  { de:'coimbra',    para:'porto',      custo:  2.0, terreno:'planicie'  , via:[[517.6,452.4]] },
  { de:'badajoz',    para:'faro',       custo:  2.5, terreno:'costa'     , via:[[511.8,703.7]] },
  { de:'huesca',     para:'zaragoza',   custo:  2.5, terreno:'costa'     , via:[[1116.7,391.8]] },
  { de:'badajoz',    para:'toledo',     custo:  2.5, terreno:'planicie'  , via:[[698.7,653.6]] },
  { de:'madrid',     para:'zaragoza',   custo:  2.5, terreno:'planicie'  , via:[[963.0,472.8]] },
  { de:'burgos',     para:'madrid',     custo:  2.5, terreno:'planalto'  , via:[[808.9,408.2]] },
  { de:'cordoba',    para:'toledo',     custo:  2.5, terreno:'costa'     , via:[[796.2,776.3]] },
  { de:'evora',      para:'faro',       custo:  2.5, terreno:'costa'     , via:[[425.9,737.2]] },
  { de:'girona',     para:'huesca',     custo:  2.5, terreno:'serra'     , via:[[1237.7,361.7]] },
  { de:'murcia',     para:'valencia',   custo:  2.5, terreno:'planicie'  , via:[[1071.1,764.8]] },
  { de:'porto',      para:'vigo',       custo:  2.5, terreno:'serra'     , via:[[496.1,344.9]] },
  { de:'porto',      para:'salamanca',  custo:  2.5, terreno:'vale'      , via:[[577.2,424.2]] },
  { de:'teruel',     para:'valencia',   custo:  2.5, terreno:'planicie'  , via:[[1031.3,671.1]] },
  { de:'badajoz',    para:'santarem',   custo:  3.0, terreno:'planicie'  , via:[[540.2,587.3]] },
  { de:'tarragona',  para:'zaragoza',   custo:  3.0, terreno:'costa'     , via:[[1182.1,461.0]] },
  { de:'burgos',     para:'pamplona',   custo:  3.0, terreno:'serra'     , via:[[854.9,317.9]] },
  { de:'cordoba',    para:'sevilha',    custo:  3.0, terreno:'costa'     , via:[[716.5,813.6]] },
  { de:'burgos',     para:'vigo',       custo:  3.0, terreno:'planalto'  , via:[[646.2,296.9]] },
  { de:'cordoba',    para:'murcia',     custo:  3.0, terreno:'costa'     , via:[[918.9,853.7]] },
  { de:'madrid',     para:'salamanca',  custo:  3.0, terreno:'planicie'  , via:[[772.9,450.5]] },
  { de:'teruel',     para:'toledo',     custo:  3.0, terreno:'planicie'  , via:[[849.5,641.1]] },
  { de:'badajoz',    para:'sevilha',    custo:  3.5, terreno:'planicie'  , via:[[617.2,691.1]] },
  { de:'pamplona',   para:'zaragoza',   custo:  3.5, terreno:'serra'     , via:[[994.9,377.6]] },
  { de:'castellon',  para:'teruel',     custo:  3.5, terreno:'serra'     , via:[[1043.0,576.1]] },
  { de:'coimbra',    para:'salamanca',  custo:  3.5, terreno:'planicie'  , via:[[623.0,480.0]] },
  { de:'faro',       para:'sevilha',    custo:  3.5, terreno:'costa'     , via:[[498.7,802.4]] },
  { de:'huesca',     para:'pamplona',   custo:  3.5, terreno:'serra'     , via:[[1054.5,312.3]] },
  { de:'badajoz',    para:'salamanca',  custo:  4.0, terreno:'serra'     , via:[[678.4,526.6]] },
  { de:'teruel',     para:'zaragoza',   custo:  4.0, terreno:'serra'     , via:[[1015.5,535.5]] },
  { de:'madrid',     para:'toledo',     custo:  4.5, terreno:'serra'     , via:[[797.4,580.0]] },
];

const VIZINHOS = ESTRADAS.reduce((m, e) => {
  (m[e.de] ||= []).push({ id: e.para, custo: e.custo });
  (m[e.para] ||= []).push({ id: e.de, custo: e.custo });
  return m;
}, {});

// Dijkstra sobre a rede de estradas -> { custo, caminho }.
// Fonte UNICA de tempo de marcha: use tambem no relatorio (lacuna L3).
function rota(origem, destino) {
  const dist = { [origem]: 0 }, prev = {}, visto = new Set();
  for (;;) {
    let u = null, melhor = Infinity;
    for (const k in dist) if (!visto.has(k) && dist[k] < melhor) { melhor = dist[k]; u = k; }
    if (u === null || u === destino) break;
    visto.add(u);
    for (const v of VIZINHOS[u] || []) {
      const nc = dist[u] + v.custo;
      if (nc < (dist[v.id] ?? Infinity)) { dist[v.id] = nc; prev[v.id] = u; }
    }
  }
  if (dist[destino] === undefined) return null;
  const caminho = [destino];
  while (caminho[0] !== origem) caminho.unshift(prev[caminho[0]]);
  return { custo: dist[destino], caminho };
}

// L2: a marcha para na primeira cidade intermedia bloqueada.
// O destino nunca bloqueia - e o alvo.
function bloqueio(caminho, ehBloqueada) {
  for (let i = 1; i < caminho.length - 1; i++)
    if (ehBloqueada(caminho[i])) return caminho[i];
  return null;
}

// Teste de sanidade do equilibrio - chamar no CI.
function verificarEquilibrio() {
  const falhas = [];
  for (const c of CIDADES) {
    const a = rota('lisboa', c.id).custo, b = rota('barcelona', c.par).custo;
    if (Math.abs(a - b) > 1e-9) falhas.push(`${c.id}=${a} != espelho ${c.par}=${b}`);
  }
  return falhas;
}

  return { MAPA, CIDADES, ESTRADAS, VIZINHOS, rota, bloqueio, verificarEquilibrio };
});
