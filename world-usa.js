// world-usa.js - Arena dos Reis, o SEGUNDO mapa (11/11/2026)
//
// 45 cidades / 72 estradas, para QUATRO Reis: Seattle (NO), Los Angeles (SO),
// New York (NE) e Miami (SE).
//
// EQUILIBRIO
// A Iberia tem UM espelho (oeste <-> este). Este mapa tem DOIS, e por isso
// quatro lugares iguais a mesa:
//   espelho EO: troca oeste com este   (Seattle <-> New York, Los Angeles <-> Miami)
//   espelho NS: troca norte com sul    (Seattle <-> Los Angeles, New York <-> Miami)
//   os dois juntos: a rotacao de 180   (Seattle <-> Miami, Los Angeles <-> New York)
// Cada um leva estrada a estrada com o MESMO custo, e portanto
//   custo(capital -> X) === custo(espelho(capital) -> espelho(X))  para toda cidade X.
// Daqui sai que QUALQUER divisao em duas equipas e justa (ver MAPA.equipas):
// ha sempre um espelho que troca uma equipa pela outra.
//
// COMO ESTA ESCRITO
// A simetria nao e conferida depois: e a forma do ficheiro. Ha UM quadrante
// modelo (9 papeis, 11 estradas, `QUADRANTE`), que se repete quatro vezes com
// os nomes e as posicoes reais de cada canto; mais 9 cidades de EIXO, que
// ficam em cima de um espelho e sao partilhadas por dois quadrantes (Kansas
// City, no cruzamento, e de todos). Um custo escreve-se uma vez por ORBITA.
// `verificarEquilibrio()` confere tudo outra vez a partir das listas finais,
// sem confiar na construcao, e TEM de devolver 0 falhas.
//
// Posicoes: geograficas reais (lat/lon projetados). O equilibrio vive nos
// custos, nao nos pixels -- como na Iberia. O custo de cada orbita e a MEDIA
// das distancias reais das estradas que a compoem, a 110 milhas por unidade,
// arredondada a meio, com minimo de 1.5 (a tabela esta em docs/MAPA_USA.md).
//
// FORMATO: UMD, igual ao world-iberia.js -- no Node module.exports, no
// navegador o global `Usa`. Mesma API: MAPA, CIDADES, ESTRADAS, VIZINHOS,
// rota, bloqueio, verificarEquilibrio.
(function (root, factory) {
  const Usa = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = Usa;
  else root.Usa = Usa;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

// ---- o quadrante modelo -----------------------------------------------------
// K  capital (o canto). Duas saidas, como Lisboa e Barcelona: P e H.
// P  a porta: a 1a cidade a sair da capital para o interior e para a costa
// C  costa: segue pela costa ate ao eixo horizontal (a fronteira com o vizinho
//    do mesmo lado do pais)
// H  a 1a cidade ao longo da fronteira de FORA (a do norte, ou a do sul)
// H2, H3, H4  a mesma linha, cada vez mais perto do meridiano central
// A, B  a diagonal, da porta para o centro do mapa
//
// Porque a capital so tem duas saidas: a primeira versao tinha um triangulo
// capital-costa-diagonal, e na Florida (uma peninsula estreita) o triangulo
// Miami-Orlando-Jacksonville ficava com duas estradas uma por cima da outra.
const PAPEIS = ["K", "P", "C", "H", "H2", "H3", "H4", "A", "B"];
const QUADRANTE = [               // [papel, papel, custo]
  ["K",  "P",  1.5],
  ["K",  "H",  1.5],
  ["P",  "C",  1.5],
  ["P",  "A",  3.0],
  ["H",  "H2", 2.5],
  ["H2", "A",  2.0],
  ["H2", "H3", 2.5],
  ["A",  "B",  3.0],
  ["H3", "H4", 3.0],
  ["H3", "B",  3.0],
  ["H4", "B",  2.5],
];
// do quadrante para o eixo: [papel, eixo, custo]. "H1" = a cidade de FORA do
// eixo horizontal do lado (O/E) deste quadrante, "H2" = a de DENTRO; "V1" e
// "V2" = as do meridiano do lado (N/S) deste quadrante.
const SAIDAS = [
  ["C",  "H1", 2.5],   // a costa fecha no eixo: San Francisco / Raleigh
  ["B",  "H2", 2.5],   // a diagonal chega a Denver / St. Louis
  ["H4", "H2", 2.0],   // ... e a linha de fora tambem
  ["H4", "V1", 4.0],   // a linha de fora chega a Minneapolis / Dallas
  ["H4", "V2", 3.5],   // ... e a Omaha / Oklahoma City
];
// a unica estrada que atravessa um espelho sem passar por uma cidade de eixo:
// B norte <-> B sul do mesmo lado (Salt Lake City-Albuquerque, Indianapolis-Nashville)
const TRAVESSIA_B = 3.5;
// dentro dos eixos
const EIXO_V1_V2 = 2.0;           // Minneapolis-Omaha, Dallas-Oklahoma City
const EIXO_V2_KC = 2.0;           // Omaha-Kansas City, Oklahoma City-Kansas City
const EIXO_H2_KC = 3.5;           // Denver-Kansas City, St. Louis-Kansas City

// ---- os quatro cantos: [nome, latitude, longitude] por papel ------------------
// A posicao e a do JOGO, nao a do atlas: 15 cidades de beira-mar foram puxadas
// ate meio grau para terra (Seattle saiu do Puget Sound, San Francisco passou
// para o lado de la da baia, New Orleans subiu do delta). Na grelha do forno a
// cidade real caia dentro de agua ou a menos de 10 m dela. A posicao nao entra
// no equilibrio -- esse vive nos custos.
const CANTOS = {
  NO: { rei: "noroeste",
    K: ["Seattle", 47.50, -122.00], P: ["Portland", 45.52, -122.68], C: ["Medford", 42.33, -122.87],
    H: ["Spokane", 47.66, -117.43], H2: ["Helena", 46.59, -112.04], H3: ["Billings", 45.78, -108.50],
    H4: ["Cheyenne", 41.14, -104.82], A: ["Boise", 43.62, -116.20], B: ["Salt Lake City", 40.76, -111.89] },
  SO: { rei: "sudoeste",
    K: ["Los Angeles", 34.05, -118.00], P: ["Bakersfield", 35.37, -119.02], C: ["Fresno", 36.74, -119.79],
    H: ["San Diego", 32.85, -116.90], H2: ["Phoenix", 33.45, -112.07], H3: ["El Paso", 32.00, -106.50],
    H4: ["Amarillo", 35.22, -101.83], A: ["Las Vegas", 36.17, -115.14], B: ["Albuquerque", 35.08, -106.65] },
  NE: { rei: "nordeste",
    K: ["New York", 40.85, -74.25], P: ["Philadelphia", 39.95, -75.17], C: ["Washington", 38.95, -77.30],
    H: ["Boston", 42.35, -71.45], H2: ["Buffalo", 42.75, -78.60], H3: ["Detroit", 42.35, -83.45],
    H4: ["Chicago", 41.85, -88.00], A: ["Pittsburgh", 40.44, -80.00], B: ["Indianapolis", 39.77, -86.16] },
  SE: { rei: "sudeste",
    K: ["Miami", 25.95, -80.40], P: ["Orlando", 28.75, -81.25], C: ["Jacksonville", 30.30, -81.90],
    H: ["Tampa", 27.95, -82.10], H2: ["Tallahassee", 30.44, -84.28], H3: ["New Orleans", 30.45, -90.60],
    H4: ["Memphis", 35.15, -90.05], A: ["Atlanta", 33.75, -84.39], B: ["Nashville", 36.16, -86.78] },
};
// ---- as 9 cidades de eixo ---------------------------------------------------
// chave: H = eixo horizontal, V = meridiano central; O/E/N/S = de que lado do
// OUTRO espelho; 1 = de fora, 2 = de dentro.
const EIXO = {
  HO1: ["San Francisco", 37.70, -121.90], HO2: ["Denver", 39.74, -104.99],
  HE1: ["Raleigh", 35.78, -78.64],        HE2: ["St. Louis", 38.63, -90.20],
  VN1: ["Minneapolis", 44.98, -93.27],    VN2: ["Omaha", 41.26, -95.93],
  VS1: ["Dallas", 32.78, -96.80],         VS2: ["Oklahoma City", 35.47, -97.52],
  KC:  ["Kansas City", 39.10, -94.58],
};

// ---- projecao -----------------------------------------------------------------
// Equirretangular com o paralelo 38 de referencia; 64 unidades por grau de
// latitude. O mapa fica com ~2 700 x 1 500 unidades: o dobro da Iberia em
// largura, para as cidades vizinhas mais juntas (New York-Philadelphia,
// Cheyenne-Denver) ficarem a mais de 70 unidades -- o `alcanceEstrada` do
// motor e 30, e uma estrada mais curta do que isso era uma luta a porta de casa.
const UN = 64, COS38 = Math.cos(38 * Math.PI / 180);
const px = (lon) => Math.round((lon + 125) * COS38 * UN * 10) / 10;
const py = (lat) => Math.round((49.5 - lat) * UN * 10) / 10;
const slug = (nome) => nome.toLowerCase().replace(/\./g, "").replace(/ /g, "_");

const outroEO = (q) => q[0] + (q[1] === "O" ? "E" : "O");
const outroNS = (q) => (q[0] === "N" ? "S" : "N") + q[1];
const eixoEO = (k) => k === "KC" ? k : k[0] === "H" ? "H" + (k[1] === "O" ? "E" : "O") + k[2] : k;
const eixoNS = (k) => k === "KC" ? k : k[0] === "V" ? "V" + (k[1] === "N" ? "S" : "N") + k[2] : k;

const TAMANHO = { K: "capital", P: "pequena", C: "pequena", H: "pequena", H2: "pequena",
                  H3: "media", H4: "grande", A: "media", B: "media" };
const PAPEL = { K: "capital", P: "porta", C: "costa", H: "linha1", H2: "linha2", H3: "linha3", H4: "linha4",
                A: "diagonal1", B: "diagonal2" };

const CIDADES = [];
// a ordem dos quadrantes e fixa, mas nada no jogo pode depender dela: quem
// percorre aldeias usa a ordem espelhada do motor (distancia a propria capital)
for (const q of ["NO", "SO", "NE", "SE"]) {
  for (const p of PAPEIS) {
    const [nome, lat, lon] = CANTOS[q][p];
    CIDADES.push({
      id: slug(nome), nome, x: px(lon), y: py(lat), lat, lon,
      quadrante: q, orbita: p, papel: PAPEL[p], tamanho: TAMANHO[p],
      sprite: p === "K" ? "castelo" : "aldeia_neutra",
      dono: p === "K" ? CANTOS[q].rei : null,
      espelhoEO: slug(CANTOS[outroEO(q)][p][0]),
      espelhoNS: slug(CANTOS[outroNS(q)][p][0]),
    });
  }
}
for (const k of Object.keys(EIXO)) {
  const [nome, lat, lon] = EIXO[k];
  CIDADES.push({
    id: slug(nome), nome, x: px(lon), y: py(lat), lat, lon,
    quadrante: "eixo", orbita: k === "KC" ? "KC" : k[0] + k[2],
    papel: k === "KC" ? "centro" : "eixo", tamanho: "grande",
    sprite: "aldeia_neutra", dono: null,
    espelhoEO: slug(EIXO[eixoEO(k)][0]),
    espelhoNS: slug(EIXO[eixoNS(k)][0]),
  });
}

const ESTRADAS = [];
const estrada = (a, b, custo, orbita) => ESTRADAS.push({ de: a, para: b, custo, orbita });
const cid = (q, p) => slug(CANTOS[q][p][0]);
const eix = (k) => slug(EIXO[k][0]);
for (const q of ["NO", "SO", "NE", "SE"]) {
  for (const [a, b, c] of QUADRANTE) estrada(cid(q, a), cid(q, b), c, a + "-" + b);
  for (const [p, e, c] of SAIDAS) {
    const chave = e[0] === "H" ? "H" + q[1] + e[1] : "V" + q[0] + e[1];
    estrada(cid(q, p), eix(chave), c, p + "-eixo" + e);
  }
}
estrada(cid("NO", "B"), cid("SO", "B"), TRAVESSIA_B, "B-B");
estrada(cid("NE", "B"), cid("SE", "B"), TRAVESSIA_B, "B-B");
estrada(eix("VN1"), eix("VN2"), EIXO_V1_V2, "V1-V2");
estrada(eix("VS1"), eix("VS2"), EIXO_V1_V2, "V1-V2");
estrada(eix("VN2"), eix("KC"), EIXO_V2_KC, "V2-KC");
estrada(eix("VS2"), eix("KC"), EIXO_V2_KC, "V2-KC");
estrada(eix("HO2"), eix("KC"), EIXO_H2_KC, "H2-KC");
estrada(eix("HE2"), eix("KC"), EIXO_H2_KC, "H2-KC");

// ---- por onde a estrada passa (so desenho) ----------------------------------
// Os EUA sao uma ILHA: o Canada e o Mexico sao mar, e os Grandes Lagos sao
// baias. Em linha reta, 20 das 72 estradas pisavam agua (Buffalo-Detroit ia
// pelo Ontario; Tampa-Tallahassee pelo Golfo). Cada uma leva aqui os pontos
// por onde a estrada REAL contorna a agua, em [latitude, longitude], na ordem
// de `de` para `para`. Como o `via` da Iberia: muda o desenho, nunca o custo,
// e por isso nao entra no `verificarEquilibrio()`. Quem mede se ainda ha
// estrada na agua e o `ferramentas/cena/preparar_usa.py`.
const VIAS = {
  "buffalo|detroit":           [[42.05, -80.00], [41.30, -81.80], [41.50, -83.60]],   // pela margem sul do Erie
  "detroit|chicago":           [[41.60, -85.00], [41.45, -87.00]],                    // por baixo do lago Michigan
  "new_york|boston":           [[41.75, -72.80]],                                     // por Hartford, longe do Sound
  "philadelphia|washington":   [[39.80, -76.70]],                                     // por cima da baia de Chesapeake
  "jacksonville|raleigh":      [[32.30, -81.80], [34.00, -80.60]],                    // por dentro, a costa faz barriga
  "tampa|tallahassee":         [[29.30, -82.20], [30.25, -83.20]],                    // por Ocala
  "tallahassee|new_orleans":   [[30.90, -86.50], [30.95, -88.30], [30.60, -89.70]],   // por cima de Mobile
  "los_angeles|san_diego":     [[33.60, -117.30]],
  "san_diego|phoenix":         [[33.35, -116.30], [33.60, -114.90]],                                    // longe da fronteira
  "phoenix|el_paso":           [[32.45, -109.50]],
  "seattle|portland":          [[46.60, -122.50]],
  "medford|san_francisco":     [[40.00, -122.30]],                                    // pelo vale de Sacramento
};

const MAPA = {
  nome: "usa",
  unidadesPorGrau: UN,
  pxPorTurno: 110 / 69 * UN,   // 110 milhas por unidade de custo; 69 milhas por grau
  capitais: { noroeste: "seattle", sudoeste: "los_angeles", nordeste: "new_york", sudeste: "miami" },
  centro: "kansas_city",
  // As tres maneiras de fazer duas equipas de dois. Todas justas: o espelho
  // indicado troca uma equipa pela outra.
  equipas: {
    costas:    { a: ["noroeste", "sudoeste"], b: ["nordeste", "sudeste"], espelho: "EO" },  // Oeste x Este: aliados vizinhos pela costa
    norte_sul: { a: ["noroeste", "nordeste"], b: ["sudoeste", "sudeste"], espelho: "NS" },  // Norte x Sul: aliados longe um do outro
    diagonal:  { a: ["noroeste", "sudeste"],  b: ["sudoeste", "nordeste"], espelho: "EO" }, // cada Rei entre dois inimigos
  },
};

for (const e of ESTRADAS) {
  const v = VIAS[e.de + "|" + e.para] || (VIAS[e.para + "|" + e.de] || []).slice().reverse();
  if (v.length) e.via = v.map(([lat, lon]) => [px(lon), py(lat)]);
}
if (Object.keys(VIAS).length !== ESTRADAS.filter((e) => e.via).length)
  throw new Error("world-usa: ha uma VIA que nao corresponde a nenhuma estrada");

const VIZINHOS = ESTRADAS.reduce((m, e) => {
  (m[e.de] ||= []).push({ id: e.para, custo: e.custo });
  (m[e.para] ||= []).push({ id: e.de, custo: e.custo });
  return m;
}, {});

// Dijkstra sobre a rede de estradas -> { custo, caminho }. Igual ao da Iberia.
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

function bloqueio(caminho, ehBloqueada) {
  for (let i = 1; i < caminho.length - 1; i++)
    if (ehBloqueada(caminho[i])) return caminho[i];
  return null;
}

// custo de marcha de cada capital a cada cidade (so leitura, para o gradiente
// de guarnicao e para a documentacao): c.custoCapital[slugDaCapital]
for (const c of CIDADES) {
  c.custoCapital = {};
  for (const r in MAPA.capitais) c.custoCapital[MAPA.capitais[r]] = rota(MAPA.capitais[r], c.id).custo;
}

// Teste de sanidade do equilibrio - chamar no CI. NAO confia na construcao
// acima: parte das listas finais e confere, para cada um dos tres espelhos,
//   1. que e uma troca (aplicado duas vezes volta ao mesmo sitio) e nao perde cidades;
//   2. que leva capital a capital;
//   3. que cada estrada tem a sua imagem, com o mesmo custo;
//   4. que o custo de marcha de cada capital a cada cidade se conserva;
//   5. que papel e tamanho se conservam (a guarnicao e o desenho saem deles).
function verificarEquilibrio() {
  const falhas = [];
  const porId = {};
  for (const c of CIDADES) {
    if (porId[c.id]) falhas.push(`id repetido: ${c.id}`);
    porId[c.id] = c;
  }
  const chave = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const custoDe = {};
  for (const e of ESTRADAS) {
    if (!porId[e.de] || !porId[e.para]) { falhas.push(`estrada para cidade que nao existe: ${e.de}-${e.para}`); continue; }
    if (custoDe[chave(e.de, e.para)] != null) falhas.push(`estrada repetida: ${e.de}-${e.para}`);
    custoDe[chave(e.de, e.para)] = e.custo;
  }
  const capitais = Object.values(MAPA.capitais);
  const espelhos = {
    EO: (id) => porId[id].espelhoEO,
    NS: (id) => porId[id].espelhoNS,
    rotacao: (id) => porId[porId[id].espelhoEO].espelhoNS,
  };
  for (const nome in espelhos) {
    const s = espelhos[nome];
    const imagens = new Set();
    for (const c of CIDADES) {
      const i = s(c.id);
      if (!porId[i]) { falhas.push(`${nome}: ${c.id} -> ${i} nao existe`); continue; }
      imagens.add(i);
      if (s(i) !== c.id) falhas.push(`${nome}: nao e uma troca em ${c.id}`);
      if (porId[i].papel !== c.papel || porId[i].tamanho !== c.tamanho) falhas.push(`${nome}: ${c.id} e ${i} nao tem o mesmo papel/tamanho`);
      if (!!c.dono !== !!porId[i].dono) falhas.push(`${nome}: ${c.id} e ${i} nao tem ambos dono`);
    }
    if (imagens.size !== CIDADES.length) falhas.push(`${nome}: perde cidades`);
    for (const k of capitais) if (!capitais.includes(s(k))) falhas.push(`${nome}: a capital ${k} nao vai dar a uma capital`);
    for (const e of ESTRADAS) {
      const c2 = custoDe[chave(s(e.de), s(e.para))];
      if (c2 == null) falhas.push(`${nome}: a estrada ${e.de}-${e.para} nao tem espelho`);
      else if (Math.abs(c2 - e.custo) > 1e-9) falhas.push(`${nome}: ${e.de}-${e.para}=${e.custo} != espelho=${c2}`);
    }
    for (const k of capitais) for (const c of CIDADES) {
      const a = rota(k, c.id), b = rota(s(k), s(c.id));
      if (!a || !b) { falhas.push(`${nome}: sem rota ${k} -> ${c.id}`); continue; }
      if (Math.abs(a.custo - b.custo) > 1e-9) falhas.push(`${nome}: ${k}->${c.id}=${a.custo} != ${s(k)}->${s(c.id)}=${b.custo}`);
    }
  }
  return falhas;
}

  return { MAPA, CIDADES, ESTRADAS, VIZINHOS, rota, bloqueio, verificarEquilibrio,
           QUADRANTE, SAIDAS, CANTOS, EIXO, VIAS };
});
