// world-iberia.js - Arena dos Reis  (v2, 24 cidades / 41 estradas)
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
  { id:'lisboa',    nome:'Lisboa',      x:  340.0, y:  680.5, lado:'O', papel:'capital', tamanho:'capital',  sprite:'castelo',       dono:'oeste', par:'barcelona', custoLisboa:  0.0, custoBarcelona: 18.0 },
  { id:'santarem',  nome:'Santarem',    x:  350.5, y:  615.7, lado:'O', papel:'anel1a',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'tarragona', custoLisboa:  1.0, custoBarcelona: 17.0 },
  { id:'evora',     nome:'Evora',       x:  418.2, y:  687.8, lado:'O', papel:'anel1b',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'girona',    custoLisboa:  1.5, custoBarcelona: 19.5 },
  { id:'coimbra',   nome:'Coimbra',     x:  386.0, y:  522.2, lado:'O', papel:'anel2a',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'castellon', custoLisboa:  2.5, custoBarcelona: 16.5 },
  { id:'porto',     nome:'Porto',       x:  405.2, y:  434.5, lado:'O', papel:'anel3a',  tamanho:'grande',   sprite:'aldeia_neutra', dono:null,    par:'valencia',  custoLisboa:  3.5, custoBarcelona: 16.5 },
  { id:'badajoz',   nome:'Badajoz',     x:  549.2, y:  626.3, lado:'O', papel:'anel2b',  tamanho:'media',    sprite:'aldeia_neutra', dono:null,    par:'zaragoza',  custoLisboa:  4.0, custoBarcelona: 14.0 },
  { id:'faro',      nome:'Faro',        x:  399.5, y:  840.3, lado:'O', papel:'anel2c',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'huesca',    custoLisboa:  5.0, custoBarcelona: 16.0 },
  { id:'vigo',      nome:'Vigo',        x:  470.7, y:  294.5, lado:'O', papel:'anel4a',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'murcia',    custoLisboa:  5.0, custoBarcelona: 15.0 },
  { id:'salamanca', nome:'Salamanca',   x:  660.6, y:  469.2, lado:'O', papel:'anel3c',  tamanho:'media',    sprite:'aldeia_neutra', dono:null,    par:'teruel',    custoLisboa:  6.5, custoBarcelona: 12.5 },
  { id:'sevilha',   nome:'Sevilha',     x:  591.0, y:  819.2, lado:'O', papel:'anel3b',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'pamplona',  custoLisboa:  7.0, custoBarcelona: 14.5 },
  { id:'cordoba',   nome:'Cordoba',     x:  787.5, y:  803.8, lado:'O', papel:'anel4b',  tamanho:'media',    sprite:'aldeia_neutra', dono:null,    par:'burgos',    custoLisboa:  8.0, custoBarcelona: 12.0 },
  { id:'toledo',    nome:'Toledo',      x:  766.9, y:  603.8, lado:'O', papel:'centro',  tamanho:'grande',   sprite:'aldeia_neutra', dono:null,    par:'madrid',    custoLisboa:  8.5, custoBarcelona:  9.5 },
  { id:'barcelona', nome:'Barcelona',   x: 1415.5, y:  482.7, lado:'E', papel:'capital', tamanho:'capital',  sprite:'castelo',       dono:'este',  par:'lisboa',    custoLisboa: 18.0, custoBarcelona:  0.0 },
  { id:'tarragona', nome:'Tarragona',   x: 1326.1, y:  507.4, lado:'E', papel:'anel1a',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'santarem',  custoLisboa: 17.0, custoBarcelona:  1.0 },
  { id:'girona',    nome:'Girona',      x: 1487.0, y:  436.4, lado:'E', papel:'anel1b',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'evora',     custoLisboa: 19.5, custoBarcelona:  1.5 },
  { id:'castellon', nome:'Castellon',   x: 1209.0, y:  559.0, lado:'E', papel:'anel2a',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'coimbra',   custoLisboa: 16.5, custoBarcelona:  2.5 },
  { id:'valencia',  nome:'Valencia',    x: 1152.1, y:  658.4, lado:'E', papel:'anel3a',  tamanho:'grande',   sprite:'aldeia_neutra', dono:null,    par:'porto',     custoLisboa: 16.5, custoBarcelona:  3.5 },
  { id:'zaragoza',  nome:'Zaragoza',    x: 1092.2, y:  449.6, lado:'E', papel:'anel2b',  tamanho:'media',    sprite:'aldeia_neutra', dono:null,    par:'badajoz',   custoLisboa: 14.0, custoBarcelona:  4.0 },
  { id:'huesca',    nome:'Huesca',      x: 1178.1, y:  395.2, lado:'E', papel:'anel2c',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'faro',      custoLisboa: 16.0, custoBarcelona:  5.0 },
  { id:'murcia',    nome:'Murcia',      x: 1063.9, y:  798.3, lado:'E', papel:'anel4a',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'vigo',      custoLisboa: 15.0, custoBarcelona:  5.0 },
  { id:'teruel',    nome:'Teruel',      x: 1030.5, y:  557.1, lado:'E', papel:'anel3c',  tamanho:'media',    sprite:'aldeia_neutra', dono:null,    par:'salamanca', custoLisboa: 12.5, custoBarcelona:  6.5 },
  { id:'pamplona',  nome:'Pamplona',    x:  993.1, y:  324.4, lado:'E', papel:'anel3b',  tamanho:'pequena',  sprite:'aldeia_neutra', dono:null,    par:'sevilha',   custoLisboa: 14.5, custoBarcelona:  7.0 },
  { id:'burgos',    nome:'Burgos',      x:  784.7, y:  341.2, lado:'E', papel:'anel4b',  tamanho:'media',    sprite:'aldeia_neutra', dono:null,    par:'cordoba',   custoLisboa: 12.0, custoBarcelona:  8.0 },
  { id:'madrid',    nome:'Madrid',      x:  843.1, y:  538.7, lado:'E', papel:'centro',  tamanho:'grande',   sprite:'aldeia_neutra', dono:null,    par:'toledo',    custoLisboa:  9.5, custoBarcelona:  8.5 },
];

// terreno multiplica o tempo de marcha:
//   costa .85 | vale .95 | planicie 1.00 | planalto 1.10 | serra 1.35
// `custo` ja inclui o multiplicador, arredondado a meio turno.
const ESTRADAS = [
  { de:'lisboa',    para:'santarem',  custo:  1.0, terreno:'costa'     },
  { de:'barcelona', para:'tarragona', custo:  1.0, terreno:'costa'     },
  { de:'evora',     para:'lisboa',    custo:  1.5, terreno:'planicie'  },
  { de:'barcelona', para:'girona',    custo:  1.5, terreno:'planicie'  },
  { de:'coimbra',   para:'santarem',  custo:  1.5, terreno:'costa'     },
  { de:'castellon', para:'tarragona', custo:  1.5, terreno:'costa'     },
  { de:'badajoz',   para:'santarem',  custo:  3.0, terreno:'planicie'  },
  { de:'tarragona', para:'zaragoza',  custo:  3.0, terreno:'planicie'  },
  { de:'evora',     para:'faro',      custo:  3.5, terreno:'planicie'  },
  { de:'girona',    para:'huesca',    custo:  3.5, terreno:'planicie'  },
  { de:'badajoz',   para:'faro',      custo:  2.0, terreno:'planicie'  },
  { de:'huesca',    para:'zaragoza',  custo:  2.0, terreno:'planicie'  },
  { de:'coimbra',   para:'porto',     custo:  1.0, terreno:'costa'     },
  { de:'castellon', para:'valencia',  custo:  1.0, terreno:'costa'     },
  { de:'coimbra',   para:'salamanca', custo:  4.0, terreno:'serra'     },
  { de:'castellon', para:'teruel',    custo:  4.0, terreno:'serra'     },
  { de:'porto',     para:'vigo',      custo:  1.5, terreno:'costa'     },
  { de:'murcia',    para:'valencia',  custo:  1.5, terreno:'costa'     },
  { de:'salamanca', para:'vigo',      custo:  5.5, terreno:'serra'     },
  { de:'murcia',    para:'teruel',    custo:  5.5, terreno:'serra'     },
  { de:'badajoz',   para:'salamanca', custo:  2.5, terreno:'planicie'  },
  { de:'teruel',    para:'zaragoza',  custo:  2.5, terreno:'planicie'  },
  { de:'badajoz',   para:'cordoba',   custo:  4.0, terreno:'planicie'  },
  { de:'burgos',    para:'zaragoza',  custo:  4.0, terreno:'planicie'  },
  { de:'badajoz',   para:'toledo',    custo:  4.5, terreno:'planicie'  },
  { de:'madrid',    para:'zaragoza',  custo:  4.5, terreno:'planicie'  },
  { de:'faro',      para:'sevilha',   custo:  2.0, terreno:'costa'     },
  { de:'huesca',    para:'pamplona',  custo:  2.0, terreno:'costa'     },
  { de:'cordoba',   para:'sevilha',   custo:  2.5, terreno:'vale'      },
  { de:'burgos',    para:'pamplona',  custo:  2.5, terreno:'vale'      },
  { de:'cordoba',   para:'toledo',    custo:  4.0, terreno:'serra'     },
  { de:'burgos',    para:'madrid',    custo:  4.0, terreno:'serra'     },
  { de:'salamanca', para:'toledo',    custo:  4.5, terreno:'serra'     },
  { de:'madrid',    para:'teruel',    custo:  4.5, terreno:'serra'     },
  { de:'cordoba',   para:'madrid',    custo:  4.0, terreno:'planalto'  },
  { de:'burgos',    para:'toledo',    custo:  4.0, terreno:'planalto'  },
  { de:'madrid',    para:'salamanca', custo:  4.0, terreno:'planalto'  },
  { de:'teruel',    para:'toledo',    custo:  4.0, terreno:'planalto'  },
  { de:'cordoba',   para:'murcia',    custo:  7.0, terreno:'planalto'  },   // via de contorno
  { de:'burgos',    para:'vigo',      custo:  7.0, terreno:'planalto'  },   // via de contorno
  { de:'madrid',    para:'toledo',    custo:  1.0, terreno:'planalto'  },
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
