// ============================================================
//  engine.js  —  MOTOR DO JOGO (V0, sem IA)
// ------------------------------------------------------------
//  Camada de ESTADO MUTAVEL por cima do MUNDO (world.js).
//  O mundo e o tabuleiro (fixo, lido); aqui moram as aldeias
//  da partida, com dono, recursos e tropas.
//
//  PECA 1 (esta entrega): CONFIG + estrutura da aldeia + teatro.
//    - Producao/construcao/endurecimento -> PECA 2.
//    - Movimento/combate/conquista        -> PECA 3.
//    - Jogador burro + loop + log         -> PECA 4.
//
//  Roda no navegador (global `Engine`, usa global `World`) e no
//  Node (module.exports, require('./world')).
// ============================================================
(function (root, factory) {
  let World;
  if (typeof module !== "undefined" && module.exports) {
    World = require("./world.js");
    module.exports = factory(World);
  } else {
    World = root.World;
    root.Engine = factory(World);
  }
})(typeof self !== "undefined" ? self : this, function (World) {
  "use strict";

  // ==========================================================
  //  CONFIG  —  A FOLHA DE BALANCEAMENTO INTEIRA
  // ----------------------------------------------------------
  //  UMA fonte de verdade. Todo numero balanceavel vive aqui,
  //  nunca espalhado pelo codigo. TODOS sao PROVISORIOS (V1 do
  //  balanceamento): ponto de partida coerente, nao a verdade.
  // ==========================================================
  const CONFIG = {
    // Semente da partida: torna a geracao (guarnicoes, escolhas)
    // reproduzivel. Mude para gerar outra partida.
    seed: 1,

    // Referencia de design (NAO e um limite de turnos).
    partida_alvo_turnos: 30,

    // PRODUCAO por aldeia, por turno.
    producao: { madeira: 10, ferro: 6 },

    // TETO DE FORCA POR ALDEIA: SO A PRODUCAO respeita. Aldeia cuja forca
    // (em casa + ja na fila de construcao) atinge este valor PARA de construir
    // tropas — mas segue juntando recurso. Reforco e conquista PODEM passar do
    // teto: o limite morde so a fabricacao, p/ punir empilhar massa num lugar
    // so sem travar quem reforca/conquista. null = sem teto. PROVISORIO.
    limite_forca_aldeia: 300,

    // TROPAS: custo / forca / velocidade / turnos para construir.
    // A forca e quase proporcional ao custo de proposito: o
    // cavaleiro paga a mais por velocidade, nao por forca bruta.
    tropas: {
      // FORCA ACHATADA (experimento 19/07, hipotese do Lucas): forca 1 por
      // unidade -> "forca total" = NUMERO DE TROPAS. Remove a indireção (contagem
      // 5/4/3 vs forca 200) que confundia os modelos fracos. Trade-off: cavaleiro
      // perde a vantagem de PODER; diferencia so por triangulo+velocidade+custo.
      // Reversivel/calibravel: p/ manter o cavaleiro forte, use 1/2/3 aqui.
      lanceiro:  { custo: { madeira: 15, ferro: 0  }, forca: 1, vel: "lenta",  turnos: 1 },
      arqueiro:  { custo: { madeira: 20, ferro: 10 }, forca: 1, vel: "media",  turnos: 1 },
      cavaleiro: { custo: { madeira: 30, ferro: 30 }, forca: 1, vel: "rapida", turnos: 2 },
    },

    // TRIANGULO pedra-papel-tesoura: cada tropa VENCE a indicada.
    //   lanceiro > cavaleiro > arqueiro > lanceiro
    // TRIANGULO v2: o counter multiplica a FORCA EFETIVA no combate
    // (decide o vencedor), nao mais so as baixas. Knob varrivel no eval.
    bonus_forca_triangulo: 1.5,
    triangulo: { lanceiro: "cavaleiro", cavaleiro: "arqueiro", arqueiro: "lanceiro" },

    // COMBATE: atrito_base = fracao da forca do PERDEDOR que o vencedor
    // perde, antes do triangulo. Vencedor sempre sobrevive (com base*m < 1).
    // PROVISORIO.
    //
    // BONUS DE DEFESA POR TERRENO (fase motor #3, 19/07): tropa parada numa
    // aldeia resiste mais que em campo aberto; castelo (capital) resiste ainda
    // mais. Multiplica a forca EFETIVA do defensor. Calibravel no eval.
    //   campo aberto / estrada (combate #2) -> 1.0 (nao passa por aqui)
    //   aldeia (neutra ou conquistada)      -> +25%
    //   capital / castelo                   -> +50%
    combate: { atrito_base: 0.5, bonus_defesa_aldeia: 1.25, bonus_defesa_castelo: 1.5 },

    // ESTRADAS (fase motor #1): a rede liga as aldeias. Base = arvore geradora
    // minima (garante que da p/ chegar a todas); + os k vizinhos mais proximos
    // de cada aldeia como ATALHOS; + N TRAVESSIAS ligando os lados oeste/leste
    // (o mapa e espelhado, as metades se conectam pouco pela vizinhanca).
    // vizinhos = densidade local; travessias = rotas entre os dois jogadores.
    estradas: { vizinhos: 3, travessias: 5 },

    // MOVIMENTO (usado na PECA 3): turnos de viagem = ceil(distancia / passo).
    // Cavaleiro rapido, lanceiro lento. Numeros PROVISORIOS, a calibrar.
    // Exercito misto viaja na velocidade da tropa MAIS LENTA.
    velocidade_passo: { lenta: 6, media: 9, rapida: 14 },

    // NEUTRAS (V1): cada neutra e uma FORTALEZA DE UM TIPO SO, sorteado pela
    // seed. Produz/endurece so aquele tipo -> fraqueza permanente pelo triangulo.
    //   tipos_sorteaveis : pool de onde sai o tipo dominante de cada neutra.
    //   forca_min/max    : quantidade inicial (em UNIDADES do tipo sorteado).
    //   endurecimento    : unidades do tipo dominante ganhas por turno.
    // CORTE A 25% (era 20-40 -> forca 200-1200): com a guarnicao do rei capada
    // em ~300, quase nenhuma neutra era conquistavel. 5-10 un. = forca 50-300,
    // dentro do alcance de um exercito no teto.
    //   endurecimento           : unidades do tipo ganhas por TICK de endurecimento.
    //   endurecimento_intervalo : 1 tick a cada N turnos (maior = mais lento).
    //   teto_forca              : a neutra PARA de endurecer ao atingir esta forca.
    // NEUTRAS MUITO FACEIS: saem com 1 unidade (forca 10-30 por tipo) e sobem
    // devagar (+1 a cada 5 turnos). O burro batia a IA local em parte porque as
    // neutras endureciam rapido demais; comecar minusculo abre a janela de
    // expansao p/ um Rei que envia tropa aos poucos (nao all-in).
    neutra: {
      tipos_sorteaveis: ["lanceiro", "arqueiro", "cavaleiro"],
      forca_min: 1, forca_max: 1,
      endurecimento: 1, endurecimento_intervalo: 5, teto_forca: 300,
    },

    // TEATRO: regiao contida do mapa 200x200 onde rola a partida.
    // n_aldeias = total (2 reis + neutras). Reis comecam em lados opostos.
    // ESCALA DE TESTE DO 1o REI (V1): 20 aldeias (18 neutras + 2 reis) para o
    // relatorio caber num modelo pequeno. O jogo "de verdade" e ~50; reversivel.
    teatro: { x0: 80, y0: 80, w: 40, h: 40, n_aldeias: 20, min_dist: 3 },

    // MUNDO v2 (17/07): layout espelhado p/ fairness de benchmark.
    // "v1" reproduz os numeros antigos; "v2" e o padrao daqui em diante.
    layout: "v2",
    teatro_v2: {
      // palco proprio da v2 (calibrado 17/07 v2): 60x34 — WIDESCREEN.
      // Gate do Lucas revelou: teatro quase quadrado estoura a tela na
      // vertical e desperdica as laterais. O teatro agora tem o formato
      // da tela: cabe inteiro sem scroll e os reis ficam a >=51.
      x0: 70, y0: 83, w: 60, h: 34,
      n_aldeias: 24,        // 2 reis + 22 neutras (11 pares espelhados)
      min_dist: 5,          // calibrado pos-gate: 4 aglomerava
      portas_por_rei: 2,    // neutras de expansao garantida perto do rei
      dist_porta: [4, 7],   // faixa de distancia das portas ao rei
      faixa_rei_y: 0.20,    // rei nasce no centro vertical +- 20% da altura
      faixa_rei_x: 0.25,    // rei nasce no quarto oeste (B = espelho)
      miolo: 0.40,          // calibrado pos-gate: 0.60 afunilava no centro
      dist_rei_min: 0.85,   // reis a >= 85% da largura (48 -> minimo 40.8)
    },

    // JOGADOR BURRO (V0, sem IA): parametros da decisao simples.
    //   composicao_alvo : proporcao desejada do exercito (puxa o mix).
    //   max_construir_por_turno : teto de tropas enfileiradas por aldeia/turno.
    //   margem_ataque : so ataca alvo cuja defesa*margem < nossa forca.
    jogador: {
      composicao_alvo: { lanceiro: 3, arqueiro: 2, cavaleiro: 1 },
      max_construir_por_turno: 6,
      margem_ataque: 1.2,
    },

    // REI: guarnicao INICIAL de cada rei (V1). Sem ela o rei comeca com 0
    // tropas e leva muitos turnos so produzindo -> nao ataca cedo. Os 3 tipos
    // deixam o Rei ESCOLHER o counter do triangulo. PROVISORIO.
    // Forca = 5*10 + 4*15 + 3*30 = 50 + 60 + 90 = 200 (baixado de 550 p/ tirar
    // o all-in da abertura: menos massa inicial torna o envio-total arriscado).
    rei: { tropas_iniciais: { lanceiro: 5, arqueiro: 4, cavaleiro: 3 } },

    // RELATORIO DO REI (V1): velocidade usada para PRE-CALCULAR "turnos de
    // marcha" no relatorio (o modelo nao faz geometria). "media" = referencia
    // neutra entre lento (lanceiro) e rapido (cavaleiro).
    relatorio: { velocidade_referencia: "media" },

    // Guarda de seguranca do loop (NAO e regra do jogo): teto de turnos
    // para a simulacao nunca rodar para sempre. Partida real deve acabar antes.
    max_turnos: 500,
  };

  // ==========================================================
  //  PRNG semeado da partida (mulberry32)
  // ----------------------------------------------------------
  //  Separado do hash do mundo: serve para as escolhas da PARTIDA
  //  (guarnicoes, selecao de aldeias). Mesma seed -> mesma partida.
  // ==========================================================
  function criarRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // inteiro em [min, max] inclusive
  function rngInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }

  // ==========================================================
  //  ESTRUTURA DA ALDEIA-DO-JOGO
  // ----------------------------------------------------------
  //  Dado que muda por aldeia mora AQUI. Regra que vale para
  //  todas mora na CONFIG.
  // ==========================================================
  function criarAldeia(id, x, y, nome, dono) {
    return {
      id,
      x, y,                                   // posicao no grid do mundo
      nome,
      dono,                                   // null = neutra | "A" | "B"
      capital: false,                         // true = aldeia PRINCIPAL do rei (castelo); persistente
      tipo: null,                             // (neutra) tipo dominante sorteado; reis = null
      recursos: { madeira: 0, ferro: 0 },     // estoque da aldeia
      tropas: { lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, // tropas tipadas (todos)
      construindo: [],                        // [{ tipo, turnosRestantes }]
    };
  }

  // ==========================================================
  //  GERACAO DO TEATRO
  // ----------------------------------------------------------
  //  1) varre a regiao do teatro e coleta as celulas que JA sao
  //     aldeia no mundo (cellData.village) -> aldeias caem em
  //     pontos reais do mapa.
  //  2) seleciona ~n_aldeias com um espacamento minimo.
  //  3) os 2 reis = par mais "em lados opostos" (cantos do teatro);
  //     o resto vira neutra de UM tipo sorteado, com N unidades na faixa.
  // ==========================================================
  function gerarTeatro(config) {
    if ((config.layout || "v1") === "v2") return gerarTeatroV2(config);
    return gerarTeatroV1(config);
  }

  // ===== MUNDO v2 (17/07) — layout ESPELHADO ponto-central =====
  // Regras aprovadas pelo Lucas: reis no eixo horizontal (oeste/leste,
  // faixa vertical central); TODAS as neutras nascem na metade oeste e sao
  // espelhadas (posicao + tipo + forca) p/ a leste — fairness total, lado
  // nao e desculpa; 2 "portas" por rei (expansao inicial garantida);
  // pares comuns com vies p/ o miolo (a zona de disputa vale a guerra).
  // Determinismo: TUDO sai do rng semeado; mesma seed -> mesmo mundo.
  function gerarTeatroV2(config) {
    const rng = criarRng(config.seed);
    const v2 = config.teatro_v2;
    // teatro proprio da v2 quando definido; senao herda o da v1
    const t = { x0: v2.x0 != null ? v2.x0 : config.teatro.x0,
                y0: v2.y0 != null ? v2.y0 : config.teatro.y0,
                w: v2.w || config.teatro.w, h: v2.h || config.teatro.h };
    const x1 = Math.min(World.WORLD, t.x0 + t.w);
    const y1 = Math.min(World.WORLD, t.y0 + t.h);
    // espelho AXIAL (17/07, correcao pos-gate): a linha vertical central e
    // o espelho — B nasce na MESMA ALTURA de A, confronto horizontal puro.
    // (o rotacional invertia Y tambem e devolvia a diagonal pela porta dos fundos)
    const esp = (p) => ({ x: t.x0 + (x1 - 1 - p.x), y: p.y });
    const agua = (p) => World.isWater(p.x, p.y);
    const cyMin = Math.floor(t.y0 + t.h * (0.5 - v2.faixa_rei_y));
    const cyMax = Math.ceil(t.y0 + t.h * (0.5 + v2.faixa_rei_y));

    const pontos = [];   // {x,y} ja aceitos (inclui espelhos)
    const minD2 = v2.min_dist * v2.min_dist;
    const longe = (p) => pontos.every((q) => {
      const dx = q.x - p.x, dy = q.y - p.y; return dx * dx + dy * dy >= minD2;
    });
    const longeDoEspelho = (p) => {
      const m = esp(p); const dx = m.x - p.x, dy = m.y - p.y;
      return dx * dx + dy * dy >= minD2;
    };
    function sortearPar(xa, xb, ya, yb, tenta) {
      for (let i = 0; i < tenta; i++) {
        const p = { x: Math.floor(xa + rng() * (xb - xa)), y: Math.floor(ya + rng() * (yb - ya)) };
        const m = esp(p);
        if (agua(p) || agua(m)) continue;
        if (!longe(p) || !longe(m) || !longeDoEspelho(p)) continue;
        return p;
      }
      return null;
    }

    // 1) REI A: quarto oeste, faixa vertical central; B = espelho exato.
    //    Garantia: dist(A, B) >= dist_rei_min * largura — o jogo precisa correr.
    const distMin = t.w * v2.dist_rei_min;
    let reiA = null;
    for (let i = 0; i < 600 && !reiA; i++) {
      const c = sortearPar(t.x0 + 1, t.x0 + Math.floor(t.w * v2.faixa_rei_x), cyMin, cyMax, 1);
      if (!c) continue;
      const m = esp(c);
      if (Math.hypot(m.x - c.x, m.y - c.y) < distMin) continue;
      reiA = c;
    }
    if (!reiA) reiA = { x: t.x0 + 3, y: Math.floor(t.y0 + t.h / 2) }; // fallback deterministico
    pontos.push(reiA, esp(reiA));

    // 2) PORTAS: neutras a [dist_porta] do rei, metade oeste; espelhadas.
    const portas = [];
    for (let k = 0; k < v2.portas_por_rei; k++) {
      let p = null;
      for (let i = 0; i < 400 && !p; i++) {
        const ang = rng() * Math.PI * 2;
        const d = v2.dist_porta[0] + rng() * (v2.dist_porta[1] - v2.dist_porta[0]);
        const c = { x: Math.round(reiA.x + Math.cos(ang) * d), y: Math.round(reiA.y + Math.sin(ang) * d) };
        if (c.x <= t.x0 || c.x >= t.x0 + t.w / 2 || c.y <= t.y0 || c.y >= y1 - 1) continue;
        const m = esp(c);
        if (agua(c) || agua(m) || !longe(c) || !longe(m) || !longeDoEspelho(c)) continue;
        p = c;
      }
      if (p) { portas.push(p); pontos.push(p, esp(p)); }
    }

    // 3) PARES COMUNS ate fechar a cota: vies p/ o miolo (fracao `miolo`
    //    sorteia no terco central-oeste; o resto, na metade oeste toda).
    const cotaPares = Math.floor((v2.n_aldeias - 2) / 2) - portas.length;
    const comuns = [];
    for (let k = 0; k < cotaPares; k++) {
      const noMiolo = rng() < v2.miolo;
      const xa = noMiolo ? t.x0 + Math.floor(t.w * 0.26) : t.x0 + 1;
      const xb = Math.floor(t.x0 + t.w / 2) - 2; // folga do eixo do espelho
      const p = sortearPar(xa, xb, t.y0 + 1, y1 - 1, 600);
      if (p) { comuns.push(p); pontos.push(p, esp(p)); }
    }

    // 4) montar aldeias: A primeiro, B (espelho) segundo, depois pares
    //    (oeste, leste, oeste, leste...) — ids estaveis e legiveis.
    const aldeias = [];
    let id = 0;
    function porRei(p, dono) {
      const ald = criarAldeia(id++, p.x, p.y, World.villageName(p.x, p.y), dono);
      ald.capital = true;                        // aldeia principal do rei (castelo)
      const ti = (config.rei && config.rei.tropas_iniciais) || {};
      for (const tp of ["lanceiro", "arqueiro", "cavaleiro"]) ald.tropas[tp] = ti[tp] || 0;
      aldeias.push(ald);
    }
    function parNeutra(p) {
      // tipo e forca sorteados UMA vez e aplicados aos DOIS lados (fairness)
      const pool = config.neutra.tipos_sorteaveis;
      const tipo = pool[Math.floor(rng() * pool.length)];
      const n = rngInt(rng, config.neutra.forca_min, config.neutra.forca_max);
      for (const q of [p, esp(p)]) {
        const ald = criarAldeia(id++, q.x, q.y, World.villageName(q.x, q.y), null);
        ald.tipo = tipo; ald.tropas[tipo] = n;
        aldeias.push(ald);
      }
    }
    porRei(reiA, "A"); porRei(esp(reiA), "B");
    for (const p of portas) parNeutra(p);
    for (const p of comuns) parNeutra(p);

    return montarJogo(config, aldeias);
  }

  function gerarTeatroV1(config) {
    const rng = criarRng(config.seed);
    const t = config.teatro;
    const x1 = Math.min(World.WORLD, t.x0 + t.w);
    const y1 = Math.min(World.WORLD, t.y0 + t.h);

    // 1) candidatos: celulas-aldeia dentro do teatro
    const candidatos = [];
    for (let y = t.y0; y < y1; y++) {
      for (let x = t.x0; x < x1; x++) {
        const d = World.cellData(x, y);
        if (d.village) candidatos.push({ x, y });
      }
    }

    // embaralha (Fisher-Yates semeado) para a selecao nao ter vies espacial
    for (let i = candidatos.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = candidatos[i]; candidatos[i] = candidatos[j]; candidatos[j] = tmp;
    }

    // 2) seleciona com espacamento minimo
    const escolhidas = [];
    const minD2 = t.min_dist * t.min_dist;
    for (const c of candidatos) {
      if (escolhidas.length >= t.n_aldeias) break;
      let ok = true;
      for (const e of escolhidas) {
        const dx = e.x - c.x, dy = e.y - c.y;
        if (dx * dx + dy * dy < minD2) { ok = false; break; }
      }
      if (ok) escolhidas.push(c);
    }
    // se o espacamento minimo nao encheu a cota, completa sem o filtro
    if (escolhidas.length < t.n_aldeias) {
      for (const c of candidatos) {
        if (escolhidas.length >= t.n_aldeias) break;
        if (!escolhidas.includes(c)) escolhidas.push(c);
      }
    }

    // 3) reis em lados opostos: min e max de (x+y) entre as escolhidas
    let iMin = 0, iMax = 0;
    for (let i = 1; i < escolhidas.length; i++) {
      if (escolhidas[i].x + escolhidas[i].y < escolhidas[iMin].x + escolhidas[iMin].y) iMin = i;
      if (escolhidas[i].x + escolhidas[i].y > escolhidas[iMax].x + escolhidas[iMax].y) iMax = i;
    }

    const aldeias = escolhidas.map((c, i) => {
      const nome = World.villageName(c.x, c.y);
      let dono = null;
      if (i === iMin) dono = "A";
      else if (i === iMax) dono = "B";
      const ald = criarAldeia(i, c.x, c.y, nome, dono);
      if (dono === null) {
        // neutra: sorteia UM tipo (deterministico) e N unidades dele na faixa.
        const pool = config.neutra.tipos_sorteaveis;
        const tipo = pool[Math.floor(rng() * pool.length)];
        const n = rngInt(rng, config.neutra.forca_min, config.neutra.forca_max);
        ald.tipo = tipo;
        ald.tropas[tipo] = n;
      } else {
        // rei: guarnicao inicial (CONFIG.rei.tropas_iniciais) p/ poder atacar cedo.
        ald.capital = true;                     // aldeia principal do rei (castelo)
        const ti = (config.rei && config.rei.tropas_iniciais) || {};
        for (const t of ["lanceiro", "arqueiro", "cavaleiro"]) ald.tropas[t] = ti[t] || 0;
      }
      return ald;
    });

    return montarJogo(config, aldeias);
  }

  // Rede de ESTRADAS (fase motor #1, 19/07): grafo que liga as aldeias.
  //   base : arvore geradora minima (Prim do id 0, empates por id) -> garante
  //          conectividade (da p/ chegar a qualquer aldeia).
  //   + k  : os k vizinhos mais proximos de cada aldeia como ATALHOS -> rotas
  //          alternativas, sem serpentear o mapa (a MST pura fazia isso).
  // Deterministica; so depende das posicoes (fixas na partida). Devolve
  // adjacencia { id: [idVizinho,...] } com vizinhos ordenados por id.
  function construirEstradas(aldeias, k, travessias) {
    k = (k == null) ? 3 : k;                        // respeita k=0 (so MST)
    travessias = (travessias == null) ? 0 : travessias;
    const n = aldeias.length;
    const adjSet = {};
    for (const a of aldeias) adjSet[a.id] = new Set();
    const ligar = (a, b) => { if (a !== b) { adjSet[a].add(b); adjSet[b].add(a); } };
    const d2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };

    if (n >= 2) {
      // 1) MST base (Prim do id 0, empates por id) — conectividade garantida
      const inTree = new Array(n).fill(false);
      const idx0 = aldeias.findIndex((a) => a.id === 0);
      inTree[idx0 >= 0 ? idx0 : 0] = true;
      for (let added = 1; added < n; added++) {
        let best = null;
        for (let i = 0; i < n; i++) {
          if (!inTree[i]) continue;
          for (let j = 0; j < n; j++) {
            if (inTree[j]) continue;
            const d = d2(aldeias[i], aldeias[j]);
            if (!best || d < best.d ||
                (d === best.d && (aldeias[j].id < best.jid ||
                  (aldeias[j].id === best.jid && aldeias[i].id < best.iid)))) {
              best = { i, j, d, jid: aldeias[j].id, iid: aldeias[i].id };
            }
          }
        }
        inTree[best.j] = true;
        ligar(aldeias[best.i].id, aldeias[best.j].id);
      }
      // 2) k vizinhos mais proximos de cada aldeia (atalhos), simetrizado
      for (let i = 0; i < n; i++) {
        const perto = aldeias
          .filter((_, j) => j !== i)
          .map((b) => ({ id: b.id, d: d2(aldeias[i], b) }))
          .sort((p, q) => p.d - q.d || p.id - q.id);
        for (let t = 0; t < Math.min(k, perto.length); t++) ligar(aldeias[i].id, perto[t].id);
      }
      // 3) TRAVESSIAS entre os lados: o mapa e espelhado no eixo vertical, entao
      //    as metades quase nao se ligam. Liga os N pares oeste-leste mais
      //    proximos ainda nao ligados (medido pela mediana do x). Determinismo:
      //    ordena por distancia, depois pelos ids.
      if (travessias > 0) {
        const xs = aldeias.map((a) => a.x).slice().sort((p, q) => p - q);
        const med = xs[Math.floor(xs.length / 2)];
        const pares = [];
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          if ((aldeias[i].x < med) === (aldeias[j].x < med)) continue; // mesmo lado
          pares.push({ i, j, d: d2(aldeias[i], aldeias[j]) });
        }
        pares.sort((p, q) => p.d - q.d ||
          aldeias[p.i].id - aldeias[q.i].id || aldeias[p.j].id - aldeias[q.j].id);
        let add = 0;
        for (const pr of pares) {
          if (add >= travessias) break;
          const a = aldeias[pr.i].id, b = aldeias[pr.j].id;
          if (adjSet[a].has(b)) continue; // ja ligado (nao conta como nova travessia)
          ligar(a, b); add++;
        }
      }
    }
    const adj = {};
    for (const id in adjSet) adj[id] = [...adjSet[id]].sort((x, y) => x - y);
    return { adj };
  }

  // estado inicial da partida a partir das aldeias — COMPARTILHADO v1/v2
  function montarJogo(config, aldeias) {
    return {
      config,
      turno: 0,
      aldeias,
      estradas: construirEstradas(aldeias,
        (config.estradas && config.estradas.vizinhos) != null ? config.estradas.vizinhos : 3,
        (config.estradas && config.estradas.travessias) != null ? config.estradas.travessias : 5),
      movimentos: [],   // exercitos em transito (PECA 3)
      jogadores: {
        A: { id: "A", nome: "Rei A" },
        B: { id: "B", nome: "Rei B" },
      },
      log: [],
      // FEEDBACK (memoria): ordens RECUSADAS no ultimo turno, por dono. O
      // relatorio do turno seguinte ecoa isto p/ o Rei nao repetir o erro.
      rejeicoesAnteriores: { A: [], B: [] },
    };
  }

  // estado inicial completo da partida
  function criarEstadoInicial(config) {
    return gerarTeatro(config || CONFIG);
  }

  // ==========================================================
  //  RESUMO LEGIVEL (observabilidade — base do eval)
  // ==========================================================
  function aldeiasDe(estado, dono) {
    return estado.aldeias.filter((a) => a.dono === dono);
  }

  function resumoEstado(estado) {
    const linhas = [];
    const nA = aldeiasDe(estado, "A").length;
    const nB = aldeiasDe(estado, "B").length;
    const nN = aldeiasDe(estado, null).length;
    linhas.push(`== Estado | turno ${estado.turno} ==`);
    linhas.push(`Aldeias: ${estado.aldeias.length}  (Rei A: ${nA} | Rei B: ${nB} | neutras: ${nN})`);

    const reis = estado.aldeias.filter((a) => a.dono !== null);
    for (const a of reis) {
      linhas.push(
        `  [${a.dono}] #${a.id} ${a.nome} (${a.x},${a.y})  ` +
        `mad ${a.recursos.madeira} fer ${a.recursos.ferro}  ` +
        `tropas L${a.tropas.lanceiro}/A${a.tropas.arqueiro}/C${a.tropas.cavaleiro}`
      );
    }

    const neutras = aldeiasDe(estado, null);
    const porTipo = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
    for (const a of neutras) if (a.tipo) porTipo[a.tipo]++;
    linhas.push(`  Neutras por tipo: ${porTipo.lanceiro} lanceiro / ${porTipo.arqueiro} arqueiro / ${porTipo.cavaleiro} cavaleiro`);
    for (const a of neutras) {
      const n = a.tropas[a.tipo] || 0;
      linhas.push(`    #${a.id} ${a.nome}: ${n} ${a.tipo}(s)`);
    }
    return linhas.join("\n");
  }

  // ==========================================================
  //  PECA 2  —  TICK (o tempo passa)
  // ----------------------------------------------------------
  //  Producao, construcao de tropas e endurecimento das neutras.
  //  Movimento/combate (PECA 3) e decisao/vitoria (PECA 4) entram
  //  como no-op aqui, mantendo a ORDEM do loop de turno da spec.
  // ==========================================================

  // helper de aldeia por id
  function aldeiaPorId(estado, id) {
    return estado.aldeias.find((a) => a.id === id);
  }

  // (1) PRODUCAO: cada aldeia COM DONO acumula producao nos seus recursos.
  //     Neutras nao acumulam recurso (so endurecem).
  function produzir(estado) {
    const p = estado.config.producao;
    for (const a of estado.aldeias) {
      if (a.dono === null) continue;
      a.recursos.madeira += p.madeira;
      a.recursos.ferro += p.ferro;
    }
  }

  // Enfileira a construcao de uma tropa numa aldeia (decisao do jogador).
  // Reserva (debita) o custo na hora; devolve true se foi possivel pagar.
  function enfileirarConstrucao(estado, aldeiaId, tipo) {
    const a = aldeiaPorId(estado, aldeiaId);
    if (!a || a.dono === null) return false;
    const def = estado.config.tropas[tipo];
    if (!def) return false;
    // TETO DE PRODUCAO: aldeia que ja atingiu o limite de forca para de
    // fabricar (segue com recurso, e pode receber reforco/conquista acima dele).
    const limite = estado.config.limite_forca_aldeia;
    if (limite != null && forcaComprometida(estado, a) >= limite) return false;
    if (a.recursos.madeira < def.custo.madeira || a.recursos.ferro < def.custo.ferro) return false;
    a.recursos.madeira -= def.custo.madeira;
    a.recursos.ferro -= def.custo.ferro;
    a.construindo.push({ tipo, turnosRestantes: def.turnos });
    return true;
  }

  // (2) CONSTRUCAO: tropas em producao avancam; as que completam
  //     entram na guarnicao tipada (tropas) da aldeia.
  function avancarConstrucao(estado) {
    for (const a of estado.aldeias) {
      if (!a.construindo.length) continue;
      const restantes = [];
      for (const item of a.construindo) {
        item.turnosRestantes -= 1;
        if (item.turnosRestantes <= 0) a.tropas[item.tipo] += 1;
        else restantes.push(item);
      }
      a.construindo = restantes;
    }
  }

  // (5) ENDURECIMENTO: cada neutra ganha +inc unidades do SEU tipo, mas SO a
  //     cada `endurecimento_intervalo` turnos (crescimento lento) e SO enquanto
  //     sua forca esta abaixo de `teto_forca` (limite, como o dos reis).
  function endurecer(estado) {
    const n = estado.config.neutra;
    const intervalo = n.endurecimento_intervalo || 1;
    if (estado.turno % intervalo !== 0) return;     // ainda nao e turno de endurecer
    const inc = n.endurecimento;
    const teto = n.teto_forca;
    for (const a of estado.aldeias) {
      if (a.dono !== null || !a.tipo) continue;
      if (teto != null && forcaTropas(estado, a.tropas) >= teto) continue; // no teto: para
      a.tropas[a.tipo] += inc;
    }
  }

  // ==========================================================
  //  PECA 3  —  MOVIMENTO + COMBATE + CONQUISTA
  // ==========================================================

  const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];

  // normalizarTipo(t) -> tipo canonico OU o valor cru intacto.
  // H3 (partida 3B vs 3B de 03/07): "arqueiros" perdeu a jogada por UMA
  // letra. Escopo Degrau 0->1 APENAS: espaco, caixa, acento, plural.
  // Traducao ("archer") e tipo inventado sao erro REAL: ficam crus para
  // a rejeicao nomear o que o modelo escreveu e o eval contar o desvio.
  function normalizarTipo(t) {
    if (typeof t !== "string") return t;
    let s = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    if (TIPOS.indexOf(s) >= 0) return s;
    if (s.endsWith("s") && TIPOS.indexOf(s.slice(0, -1)) >= 0) return s.slice(0, -1);
    return t; // fora do escopo: devolve o cru
  }

  // ---- Forca ----
  function forcaTropas(estado, tropas) {
    let f = 0;
    for (const t of TIPOS) f += (tropas[t] || 0) * estado.config.tropas[t].forca;
    return f;
  }
  // Forca defensiva da aldeia: todas (reis E neutras) usam tropas tipadas.
  function forcaDefesa(estado, aldeia) {
    return forcaTropas(estado, aldeia.tropas);
  }
  // Forca COMPROMETIDA da aldeia = em casa + a que ja esta na fila de
  // construcao. E isto que o teto de producao (limite_forca_aldeia) mede:
  // contar a fila impede furar o teto enfileirando varias tropas num turno so.
  function forcaComprometida(estado, aldeia) {
    let f = forcaTropas(estado, aldeia.tropas);
    for (const c of aldeia.construindo) f += estado.config.tropas[c.tipo].forca;
    return f;
  }
  // Tipo que mais contribui em forca (matchup do triangulo). null se sem tipo.
  function tipoDominante(estado, tropas) {
    let best = null, bf = 0;
    for (const t of TIPOS) {
      const f = (tropas[t] || 0) * estado.config.tropas[t].forca;
      if (f > bf) { bf = f; best = t; }
    }
    return best;
  }
  // Bonus de defesa por TERRENO (fase motor #3): tropa numa aldeia resiste
  // mais que em campo aberto; castelo (capital) resiste ainda mais. alvo null
  // = combate em campo aberto/estrada (#2 futuro) -> sem bonus.
  function bonusDefesa(estado, alvo) {
    if (!alvo) return 1;
    return alvo.capital ? estado.config.combate.bonus_defesa_castelo
                        : estado.config.combate.bonus_defesa_aldeia;
  }

  // Nucleo da conta do combate (v2): usado pelo resolverCombate E pela
  // previsao de confronto da UI — uma conta so, impossivel divergir.
  // defBonus = multiplicador de terreno do defensor (1 = campo aberto).
  function preverCombateTipos(estado, Fatk, atkType, Fdef, defType, defBonus) {
    const v = vantagem(estado, atkType, defType); // +1 atk tem counter, -1 def tem
    const B = estado.config.bonus_forca_triangulo;
    const dB = defBonus || 1;                      // terreno do defensor (aldeia/castelo/campo)
    const FatkEf = Fatk * (v > 0 ? B : 1);
    const FdefEf = Fdef * (v < 0 ? B : 1) * dB;
    return { v, FatkEf, FdefEf, atacanteVence: FatkEf > FdefEf }; // empate -> defensor segura
  }

  // Previsao a partir de tropas cruas (p/ a UI: exercito em marcha vs alvo).
  function preverCombate(estado, tropasAtk, alvo) {
    const cfg = estado.config;
    const Fatk = forcaDe(tropasAtk, cfg), Fdef = forcaDe(alvo.tropas, cfg);
    const atkType = tipoDominante(estado, tropasAtk);
    const defType = alvo.dono === null ? alvo.tipo : tipoDominante(estado, alvo.tropas);
    return Object.assign({ Fatk, Fdef, atkType, defType },
      preverCombateTipos(estado, Fatk, atkType, Fdef, defType, bonusDefesa(estado, alvo)));
  }

  // +1 se atkType vence defType; -1 se defType vence atkType; 0 neutro/sem tipo.
  function vantagem(estado, atkType, defType) {
    if (!atkType || !defType) return 0;
    if (estado.config.triangulo[atkType] === defType) return 1;
    if (estado.config.triangulo[defType] === atkType) return -1;
    return 0;
  }

  // Remove uma fracao da forca das tropas (baixas), proporcional por tipo.
  // Garante >=1 tropa do tipo dominante se havia tropas (vencedor sobrevive).
  function aplicarBaixas(estado, tropas, fracao) {
    const dom = tipoDominante(estado, tropas);
    let total = 0;
    for (const t of TIPOS) {
      const perdidos = Math.round((tropas[t] || 0) * fracao);
      tropas[t] = Math.max(0, (tropas[t] || 0) - perdidos);
      total += tropas[t];
    }
    if (total === 0 && dom) tropas[dom] = 1;
  }

  // ----------------------------------------------------------
  //  COMBATE: numero decide o vencedor; triangulo modula baixas.
  //  Muta a aldeia-alvo (conquista/baixas). Retorna um relatorio.
  // ----------------------------------------------------------
  function resolverCombate(estado, exercito, alvo) {
    const cfg = estado.config;
    const Fatk = forcaTropas(estado, exercito.tropas);
    const Fdef = forcaDefesa(estado, alvo);
    const atkType = tipoDominante(estado, exercito.tropas);
    const defType = tipoDominante(estado, alvo.tropas); // neutra agora e tipada

    // TRIANGULO v2: counter multiplica a forca EFETIVA -> decide o vencedor.
    // A conta vive em preverCombateTipos p/ NUNCA divergir da previsao da UI.
    const defBonus = bonusDefesa(estado, alvo); // #3: terreno do defensor (aldeia/castelo)
    const { v, FatkEf, FdefEf, atacanteVence } =
      preverCombateTipos(estado, Fatk, atkType, Fdef, defType, defBonus);
    const FwinEf = atacanteVence ? FatkEf : FdefEf;
    const FloseEf = atacanteVence ? FdefEf : FatkEf;

    let baixasEf = FloseEf * cfg.combate.atrito_base;
    baixasEf = Math.min(baixasEf, FwinEf);
    const fracao = FwinEf > 0 ? baixasEf / FwinEf : 0;
    // baixas reportadas em forca REAL (fracao aplicada sobre a forca real do vencedor)
    const baixasForca = fracao * (atacanteVence ? Fatk : Fdef);

    const rep = {
      tipo: "combate",
      turno: estado.turno,
      alvoId: alvo.id, alvoNome: alvo.nome,
      atacante: exercito.dono,
      atkType, defType,
      Fatk, Fdef, FatkEf: Math.round(FatkEf), FdefEf: Math.round(FdefEf),
      vantagem: v, // +1 atacante tinha counter, -1 defensor, 0 neutro
      vencedor: atacanteVence ? "atacante" : "defensor",
      baixasForca: Math.round(baixasForca),
      conquista: false,
    };

    if (atacanteVence) {
      // sobreviventes do atacante viram a guarnicao tipada da aldeia tomada
      const sobrevivente = Object.assign({}, exercito.tropas);
      aplicarBaixas(estado, sobrevivente, fracao);
      alvo.dono = exercito.dono;
      alvo.tipo = null;   // deixa de ser neutra de tipo unico
      alvo.tropas = { lanceiro: sobrevivente.lanceiro || 0, arqueiro: sobrevivente.arqueiro || 0, cavaleiro: sobrevivente.cavaleiro || 0 };
      alvo.construindo = [];
      rep.conquista = true;
      rep.sobreviventesForca = forcaTropas(estado, alvo.tropas);
    } else {
      // defensor segura (rei ou neutra); atacante eliminado; defensor sofre baixas
      aplicarBaixas(estado, alvo.tropas, fracao);
      rep.sobreviventesForca = forcaDefesa(estado, alvo);
    }
    return rep;
  }

  // ---- Movimento ----
  function distancia(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Exercito viaja na velocidade da tropa MAIS LENTA presente.
  function velExercito(estado, tropas) {
    const ordem = { lenta: 0, media: 1, rapida: 2 };
    let pior = "rapida";
    for (const t of TIPOS) {
      if ((tropas[t] || 0) > 0) {
        const v = estado.config.tropas[t].vel;
        if (ordem[v] < ordem[pior]) pior = v;
      }
    }
    return pior;
  }
  function turnosPorDist(estado, dist, tropas) {
    const passo = estado.config.velocidade_passo[velExercito(estado, tropas)];
    return Math.max(1, Math.ceil(dist / passo));
  }
  function turnosViagem(estado, origem, destino, tropas) {
    return turnosPorDist(estado, distancia(origem, destino), tropas);
  }

  // MENOR caminho (lista de ids, origem->destino) pela rede de estradas.
  // A rede tem ciclos (MST + atalhos) -> Dijkstra ponderado pela distancia
  // euclidiana dos trechos. null se nao ha rede. Deterministico: a fila
  // escolhe sempre o menor id entre empates (ids iterados em ordem crescente).
  function caminhoEntre(estado, aId, bId) {
    const est = estado.estradas;
    if (!est || !est.adj) return null;
    if (aId === bId) return [aId];
    const pos = {}; for (const a of estado.aldeias) pos[a.id] = a;
    const ids = Object.keys(est.adj).map(Number);
    const dist = {}, prev = {}, visto = {};
    dist[aId] = 0;
    for (;;) {
      let u = null;                                  // menor dist ainda nao visitada
      for (const id of ids) {
        if (visto[id] || dist[id] == null) continue;
        if (u === null || dist[id] < dist[u]) u = id; // ids crescentes -> empate = menor id
      }
      if (u === null || u === bId) break;
      visto[u] = true;
      for (const v of est.adj[u]) {
        if (visto[v]) continue;
        const nd = dist[u] + Math.hypot(pos[u].x - pos[v].x, pos[u].y - pos[v].y);
        if (dist[v] == null || nd < dist[v]) { dist[v] = nd; prev[v] = u; }
      }
    }
    if (dist[bId] == null) return null;              // desconexo (nao ocorre)
    const caminho = [bId]; let c = bId;
    while (c !== aId) { c = prev[c]; caminho.push(c); }
    return caminho.reverse();
  }
  // Distancia total ao longo de um caminho (soma dos trechos).
  function distanciaRota(estado, caminho) {
    let d = 0;
    for (let i = 0; i + 1 < caminho.length; i++) {
      d += distancia(aldeiaPorId(estado, caminho[i]), aldeiaPorId(estado, caminho[i + 1]));
    }
    return d;
  }

  // Envia um exercito de uma aldeia (do jogador) a outra. Deduz as tropas
  // da origem e cria o transito. Devolve o movimento ou null se invalido.
  function enviarExercito(estado, origemId, destinoId, tropas) {
    const o = aldeiaPorId(estado, origemId), d = aldeiaPorId(estado, destinoId);
    if (!o || !d || o.dono === null || origemId === destinoId) return null;
    if (!tropas || typeof tropas !== "object") return null;
    for (const t of TIPOS) if ((tropas[t] || 0) > (o.tropas[t] || 0)) return null;
    const carga = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
    let total = 0;
    for (const t of TIPOS) { const n = tropas[t] || 0; carga[t] = n; o.tropas[t] -= n; total += n; }
    if (total === 0) return null;
    // MOTOR #1: o exercito segue a ESTRADA (menor caminho). Tempo = distancia
    // AO LONGO da rota / passo. Sem rede (estados sinteticos), reta.
    let caminho = caminhoEntre(estado, origemId, destinoId);
    if (!caminho || caminho.length < 2) caminho = [origemId, destinoId];
    // MOTOR #4 (19/07): NAO passa por aldeia que nao e do dono. A marcha para na
    // PRIMEIRA aldeia inimiga/barbara do trajeto e briga ali (nao da p/ pular ate
    // a aldeia ao lado do castelo). Aldeias proprias no caminho: passa reto.
    for (let i = 1; i < caminho.length; i++) {
      const passo = aldeiaPorId(estado, caminho[i]);
      if (passo && passo.dono !== o.dono) { caminho = caminho.slice(0, i + 1); break; }
    }
    const destinoReal = caminho[caminho.length - 1];
    const turnos = turnosPorDist(estado, distanciaRota(estado, caminho), carga);
    const mov = { dono: o.dono, origemId, destinoId: destinoReal, tropas: carga, caminho,
      turnosRestantes: turnos, turnosTotal: turnos };
    estado.movimentos.push(mov);
    return mov;
  }

  // Resolve a chegada de um exercito: reforco (mesmo dono) ou combate.
  function resolverChegada(estado, mov) {
    const alvo = aldeiaPorId(estado, mov.destinoId);
    if (alvo.dono === mov.dono) {
      for (const t of TIPOS) alvo.tropas[t] += mov.tropas[t];
      const ev = { tipo: "reforco", turno: estado.turno, alvoId: alvo.id, alvoNome: alvo.nome, dono: mov.dono, tropas: mov.tropas };
      estado.log.push(ev);
      return ev;
    }
    const rep = resolverCombate(estado, { dono: mov.dono, tropas: mov.tropas }, alvo);
    estado.log.push(rep);
    return rep;
  }

  // ---- MOTOR #2: combate na ESTRADA (exercitos que se cruzam) ----

  // Ponto atual de um exercito ao longo da sua rota (pelo progresso de turnos).
  // Devolve o trecho (aId->bId no sentido da marcha), t em [0,1] e o ponto x,y.
  function posicaoRota(estado, mov) {
    const cam = mov.caminho;
    if (!cam || cam.length < 2) return null;
    const total = distanciaRota(estado, cam);
    const frac = mov.turnosTotal ? (mov.turnosTotal - mov.turnosRestantes) / mov.turnosTotal : 1;
    let alvo = Math.max(0, frac) * total;
    for (let i = 0; i + 1 < cam.length; i++) {
      const a = aldeiaPorId(estado, cam[i]), b = aldeiaPorId(estado, cam[i + 1]);
      const seg = distancia(a, b);
      if (alvo <= seg || i + 2 === cam.length) {
        const t = seg > 0 ? Math.max(0, Math.min(1, alvo / seg)) : 0;
        return { aId: cam[i], bId: cam[i + 1], t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      alvo -= seg;
    }
    return null;
  }

  // Dois exercitos INIMIGOS se cruzaram no mesmo trecho, em sentidos opostos?
  // Teste instantaneo: no trecho lo<->hi, quem vai lo->hi ja alcancou quem vai
  // hi->lo (posicoes medidas a partir de lo). Sem estado anterior -> deterministico.
  function cruzaramNaEstrada(estado, m1, m2) {
    if (m1.dono === m2.dono) return false;
    const p1 = posicaoRota(estado, m1), p2 = posicaoRota(estado, m2);
    if (!p1 || !p2) return false;
    const lo = Math.min(p1.aId, p1.bId), hi = Math.max(p1.aId, p1.bId);
    if (lo !== Math.min(p2.aId, p2.bId) || hi !== Math.max(p2.aId, p2.bId)) return false; // trecho diferente
    const dir1 = p1.aId < p1.bId ? 1 : -1, dir2 = p2.aId < p2.bId ? 1 : -1;
    if (dir1 === dir2) return false; // mesmo sentido: nao tratado (nao se enfrentam de frente)
    const seg = distancia(aldeiaPorId(estado, lo), aldeiaPorId(estado, hi));
    const posLo = (p) => (p.aId < p.bId ? p.t : 1 - p.t) * seg; // distancia a partir de lo
    const posX = dir1 === 1 ? posLo(p1) : posLo(p2); // o que marcha lo->hi
    const posY = dir1 === 1 ? posLo(p2) : posLo(p1); // o que marcha hi->lo
    return posX >= posY; // se encontraram (ou passaram) no trecho
  }

  // Combate CAMPO ABERTO entre dois exercitos (sem bonus de terreno). Vencedor
  // segue com baixas; perdedor eliminado. Determinismo do empate: dono "A" e o
  // "atacante" (a conta em si nao depende da ordem dos argumentos).
  function resolverCombateEstrada(estado, m1, m2) {
    const cfg = estado.config;
    const atk = m1.dono < m2.dono ? m1 : m2;
    const def = atk === m1 ? m2 : m1;
    const Fa = forcaTropas(estado, atk.tropas), Fd = forcaTropas(estado, def.tropas);
    const ta = tipoDominante(estado, atk.tropas), td = tipoDominante(estado, def.tropas);
    const { v, FatkEf, FdefEf, atacanteVence } = preverCombateTipos(estado, Fa, ta, Fd, td, 1); // campo aberto
    const vencedor = atacanteVence ? atk : def, perdedor = atacanteVence ? def : atk;
    const Fwin = atacanteVence ? FatkEf : FdefEf, Flose = atacanteVence ? FdefEf : FatkEf;
    const baixasEf = Math.min(Flose * cfg.combate.atrito_base, Fwin);
    const fracao = Fwin > 0 ? baixasEf / Fwin : 0;
    aplicarBaixas(estado, vencedor.tropas, fracao);
    const pa = posicaoRota(estado, atk) || { x: 0, y: 0 };
    const ev = { tipo: "combate_estrada", turno: estado.turno,
      atacante: atk.dono, defensor: def.dono, vencedorDono: vencedor.dono,
      Fatk: Fa, Fdef: Fd, vantagem: v, x: pa.x, y: pa.y };
    estado.log.push(ev);
    return { vencedor, perdedor, ev };
  }

  // Varre os exercitos em transito e resolve os cruzamentos inimigos. Devolve
  // os sobreviventes (perdedores saem do transito). O(m^2), m pequeno.
  function detectarCombatesEstrada(estado, movs) {
    const mortos = new Set();
    for (let i = 0; i < movs.length; i++) {
      if (mortos.has(movs[i])) continue;
      for (let j = i + 1; j < movs.length; j++) {
        if (mortos.has(movs[i])) break;
        if (mortos.has(movs[j])) continue;
        if (!cruzaramNaEstrada(estado, movs[i], movs[j])) continue;
        const { perdedor } = resolverCombateEstrada(estado, movs[i], movs[j]);
        mortos.add(perdedor);
      }
    }
    return movs.filter((m) => !mortos.has(m));
  }

  // (3+4) MOVIMENTO + COMBATE: avanca transitos; cruzamentos na estrada
  // resolvem no meio do caminho; os que chegam resolvem no destino.
  function avancarMovimentos(estado) {
    const chegaram = [], viajando = [];
    for (const m of estado.movimentos) {
      m.turnosRestantes -= 1;
      (m.turnosRestantes <= 0 ? chegaram : viajando).push(m);
    }
    // #2: quem segue viajando pode se cruzar com inimigo no mesmo trecho
    estado.movimentos = detectarCombatesEstrada(estado, viajando);
    for (const m of chegaram) resolverChegada(estado, m);
  }

  // TICK: avanca um turno seguindo a ORDEM da spec.
  function tick(estado) {
    estado.turno += 1;
    produzir(estado);            // 1
    avancarConstrucao(estado);   // 2
    avancarMovimentos(estado);   // 3 MOVIMENTO + 4 COMBATE
    endurecer(estado);           // 5
    // 6) DECISAO e 7) VITORIA sao orquestrados por rodarTurno (PECA 4),
    //    para manter o TICK puramente mecanico e a decisao isolada.
    return estado;
  }

  // ==========================================================
  //  PECA 4  —  JOGADOR BURRO + LOOP + OBSERVABILIDADE
  // ----------------------------------------------------------
  //  FRONTEIRA decisao/motor (pensando na IA da V1):
  //    montarVisao(estado, dono) -> visao  (relatorio que o jogador ve)
  //    decisor(visao)            -> ordem  (ORDEM ESTRUTURADA)
  //    executarOrdem(estado, ...) aplica a ordem com as primitivas.
  //  Na V1, um dos `decisor` vira o Rei (IA); o resto do motor nao muda.
  // ==========================================================

  // forca de um objeto de tropas, usando so a config (sem estado)
  function forcaDe(tropas, config) {
    let f = 0;
    for (const t of TIPOS) f += (tropas[t] || 0) * config.tropas[t].forca;
    return f;
  }

  // VISAO: relatorio (somente leitura) do que aquele jogador conhece.
  // SEM fog of war: tropas reais dos alvos e transito de todos sao visiveis.
  function montarVisao(estado, dono) {
    const copiaTropas = (t) => ({ lanceiro: t.lanceiro, arqueiro: t.arqueiro, cavaleiro: t.cavaleiro });
    return {
      dono,
      turno: estado.turno,
      config: estado.config,
      minhas: aldeiasDe(estado, dono).map((a) => ({
        id: a.id, x: a.x, y: a.y,
        recursos: { madeira: a.recursos.madeira, ferro: a.recursos.ferro },
        tropas: copiaTropas(a.tropas),
        construindo: a.construindo.map((c) => ({ tipo: c.tipo, turnosRestantes: c.turnosRestantes })),
      })),
      alvos: estado.aldeias.filter((a) => a.dono !== dono).map((a) => ({
        id: a.id, x: a.x, y: a.y, dono: a.dono, tipo: a.tipo,
        tropas: copiaTropas(a.tropas),
        forcaDefesa: forcaDefesa(estado, a), // usado pelo jogador burro
      })),
      // todos os exercitos em transito (meus e inimigos). destinoDono = dono atual do destino.
      transito: estado.movimentos.map((m) => ({
        dono: m.dono, origemId: m.origemId, destinoId: m.destinoId,
        tropas: copiaTropas(m.tropas), turnosRestantes: m.turnosRestantes,
        destinoDono: (aldeiaPorId(estado, m.destinoId) || {}).dono,
      })),
      // o que aconteceu NESTE turno (combates/reforcos) — a memoria do Rei
      eventos: estado.log.filter((ev) => ev.turno === estado.turno),
      // ordens que o motor RECUSOU no turno anterior (memoria anti-loop)
      rejeicoesAnteriores: (estado.rejeicoesAnteriores && estado.rejeicoesAnteriores[dono]) || [],
      // ordens EXECUTADAS COM AJUSTE no turno anterior (modo clamp; vazio fora dele)
      avisosAnteriores: (estado.avisosAnteriores && estado.avisosAnteriores[dono]) || [],
    };
  }

  // ----------------------------------------------------------
  //  TRADUTOR: visao (objeto) -> RELATORIO EM TEXTO (o Rei le isto).
  //  PRINCIPIO: pre-calcula o que um modelo fraco erra (turnos de marcha,
  //  ordenacao por distancia, somas de forca) e deixa CRU so a decisao
  //  (numeros lado a lado). Sem coordenadas, sem "estimado", sem veredito
  //  "voce vence". Ids sempre entre [colchetes].
  // ----------------------------------------------------------

  // composicao em texto, so os tipos presentes (ex.: "20 lanceiros, 5 cavaleiros")
  function compTexto(t) {
    const p = [];
    if (t.lanceiro) p.push(`${t.lanceiro} lanceiros`);
    if (t.arqueiro) p.push(`${t.arqueiro} arqueiros`);
    if (t.cavaleiro) p.push(`${t.cavaleiro} cavaleiros`);
    return p.length ? p.join(", ") : "sem tropas";
  }

  // descricao de UM evento do log, da perspectiva do Rei `me`
  function eventoTexto(ev, me) {
    if (ev.tipo === "combate") {
      const euAtaquei = ev.atacante === me;
      const quem = euAtaquei ? "Voce" : "Rei " + ev.atacante;
      if (ev.vencedor === "atacante") {
        const baixas = euAtaquei ? ` (suas baixas: ${ev.baixasForca} tropas)` : "";
        return `${quem} atacou [${ev.alvoId}] ${ev.alvoNome}: VITORIA, conquistou${baixas}`;
      }
      const perdeu = euAtaquei ? " (seu exercito foi perdido)" : "";
      return `${quem} atacou [${ev.alvoId}] ${ev.alvoNome}: DERROTA${perdeu}`;
    }
    if (ev.tipo === "reforco") {
      const quem = ev.dono === me ? "Seu reforco" : "Reforco do Rei " + ev.dono;
      return `${quem} (${compTexto(ev.tropas)}) chegou em [${ev.alvoId}] ${ev.alvoNome}`;
    }
    if (ev.tipo === "cancelado") {
      return `Ordem ignorada: ${ev.motivo || "envio invalido"}`;
    }
    return JSON.stringify(ev);
  }

  // RELATORIO EM TEXTO de uma visao.
  function relatorioTexto(visao, opcoes) {
    const cfg = visao.config;
    const me = visao.dono;
    const inimigo = me === "A" ? "B" : "A";
    const semRejeicoes = !!(opcoes && opcoes.semRejeicoes); // H2: bloco vai p/ o fim do prompt
    const L = [];

    const passoRef = cfg.velocidade_passo[cfg.relatorio.velocidade_referencia];
    // turnos de marcha da MINHA aldeia mais proxima ate (x,y)
    const marcha = (x, y) => {
      let best = Infinity;
      for (const m of visao.minhas) {
        const d = Math.hypot(m.x - x, m.y - y);
        if (d < best) best = d;
      }
      return best === Infinity ? "?" : Math.max(1, Math.ceil(best / passoRef));
    };
    const classifica = (dono) => (dono === me ? "SUA" : dono === null ? "NEUTRA" : "INIMIGA");

    // cabecalho
    L.push(`TURNO ${visao.turno} - Voce e o Rei ${me}.`);
    L.push("");

    // FEEDBACK DE REJEICAO (memoria anti-loop): ecoa as ordens que o motor
    // RECUSOU no turno anterior, p/ o modelo corrigir e nao repetir o erro.
    // So aparece se houve rejeicao. Sem retry: e apenas memoria no relatorio.
    if (!semRejeicoes && visao.rejeicoesAnteriores && visao.rejeicoesAnteriores.length) {
      L.push("=== ATENCAO: SUAS ORDENS RECUSADAS NO TURNO ANTERIOR ===");
      L.push("As ordens abaixo NAO foram executadas (foram recusadas pelo motor). Corrija estes erros nesta jogada e NAO repita a mesma ordem:");
      for (const r of visao.rejeicoesAnteriores) L.push(`- ${r}`);
      L.push("");
    }
    // Canal SEPARADO das rejeicoes: aviso de clamp NAO e recusa — a ordem
    // FOI executada, ajustada. Meter isto sob "NAO foram executadas" seria
    // mentir pro modelo (pecado do H3). Fora do modo clamp, nunca renderiza.
    if (!semRejeicoes && visao.avisosAnteriores && visao.avisosAnteriores.length) {
      L.push("=== SUAS ORDENS AJUSTADAS NO TURNO ANTERIOR ===");
      L.push("As ordens abaixo FORAM executadas, mas com a quantidade reduzida ao estoque real. Nesta jogada, peca apenas o que voce TEM:");
      for (const a of visao.avisosAnteriores) L.push(`- ${a}`);
      L.push("");
    }

    // SUAS ALDEIAS
    L.push(`=== SUAS ALDEIAS (${visao.minhas.length}) ===`);
    for (const a of visao.minhas) {
      L.push(`[${a.id}] | recursos: ${a.recursos.madeira} madeira, ${a.recursos.ferro} ferro`);
      L.push(`       tropas em casa: ${a.tropas.lanceiro} lanceiros, ${a.tropas.arqueiro} arqueiros, ${a.tropas.cavaleiro} cavaleiros`);
      if (a.construindo.length) {
        const cont = {};
        let maxT = 0;
        for (const c of a.construindo) { cont[c.tipo] = (cont[c.tipo] || 0) + 1; maxT = Math.max(maxT, c.turnosRestantes); }
        const desc = TIPOS.filter((t) => cont[t]).map((t) => `${cont[t]} ${t}`).join(", ");
        L.push(`       construindo: ${desc} (pronto em ${maxT} turno(s))`);
      } else {
        L.push(`       construindo: nada`);
      }
    }
    L.push("");

    // FORCA TOTAL removida (19/07, filosofia do Lucas): na partida o Rei ve so
    // TROPA + QUANTIDADE (por aldeia, acima) + CUSTO (nas regras). Sem numero de
    // "forca" — 1 lanceiro e 1 lanceiro. A tabela de calculo fica nas REGRAS.

    // ALDEIAS NEUTRAS (ordenadas por distancia da minha mais proxima)
    const neutras = visao.alvos.filter((a) => a.dono === null)
      .map((a) => ({ a, t: marcha(a.x, a.y) }))
      .sort((p, q) => p.t - q.t || p.a.id - q.a.id);
    L.push(`=== ALDEIAS NEUTRAS (${neutras.length}) - ordenadas por distancia da sua mais proxima ===`);
    for (const { a, t } of neutras) {
      L.push(`[${a.id}] ${compTexto(a.tropas)} | ${t} turnos de marcha`);
    }
    L.push("");

    // INIMIGO
    const inimigas = visao.alvos.filter((a) => a.dono === inimigo)
      .map((a) => ({ a, t: marcha(a.x, a.y) }))
      .sort((p, q) => p.t - q.t || p.a.id - q.a.id);
    L.push(`=== INIMIGO (Rei ${inimigo}) - ${inimigas.length} aldeia(s) ===`);
    if (!inimigas.length) L.push("(nenhuma aldeia inimiga)");
    for (const { a, t } of inimigas) {
      L.push(`[${a.id}] ${compTexto(a.tropas)} | ${t} turnos de marcha`);
    }
    L.push("");

    // EXERCITOS EM TRANSITO
    L.push(`=== EXERCITOS EM TRANSITO ===`);
    const meus = visao.transito.filter((m) => m.dono === me);
    const dele = visao.transito.filter((m) => m.dono !== me);
    const linhaMov = (m) => `- ${compTexto(m.tropas)}: aldeia [${m.origemId}] -> aldeia [${m.destinoId}] (${classifica(m.destinoDono)}), chega em ${m.turnosRestantes} turnos`;
    L.push("SEUS:");
    if (!meus.length) L.push("- nenhum");
    else meus.forEach((m) => L.push(linhaMov(m)));
    L.push("INIMIGOS:");
    if (!dele.length) L.push("- nenhum");
    else dele.forEach((m) => L.push(linhaMov(m)));
    L.push("");

    // O QUE ACONTECEU NO ULTIMO TURNO (a memoria do Rei)
    L.push(`=== O QUE ACONTECEU NO ULTIMO TURNO ===`);
    if (!visao.eventos.length) L.push("- nada de relevante");
    else visao.eventos.forEach((ev) => L.push("- " + eventoTexto(ev, me)));

    return L.join("\n");
  }

  // ==========================================================
  //  V1 PECA 2  —  O REI (IA): PROMPT + PARSING  (partes PURAS)
  // ----------------------------------------------------------
  //  A CHAMADA ao modelo (Ollama hoje, API depois) NAO mora aqui: fica
  //  isolada em rei.js, atras de um "cliente" trocavel. Aqui so o que e
  //  PURO e testavel sem rede: montar o prompt e parsear/validar a ordem.
  // ==========================================================

  // EXEMPLO de ordem — a ULTIMA coisa do prompt (induz o 1o token "{").
  // ANCORADO nos ids REAIS da visao do turno (achado: o modelo pequeno copia
  // o exemplo ao pe da letra; um exemplo fixo com ids 3/7/1 inexistentes p/
  // ele gerava 100% de ordens rejeitadas). Aqui o exemplo ensina so o MOLDE:
  //   - formato completo (construir + envios; tropas com os 3 tipos, com zero);
  //   - QUAIS ids existem (origem = uma aldeia do `minhas`; destino = um alvo
  //     presente na visao).
  // NAO ensina a DECISAO: alvo e tropas sao genericos/arbitrarios (1a aldeia,
  // 1o alvo, numero redondo qualquer), NAO a jogada otima.
  function exemploAncorado(visao) {
    const minhas = (visao && visao.minhas) || [];
    const alvos = (visao && visao.alvos) || [];
    const a0 = minhas.length ? minhas[0] : null;
    const origem = a0 ? a0.id : 0;                          // id real de uma aldeia minha
    // prefere NEUTRAS como alvo do exemplo (expansao sensata); copiar nao vira
    // ataque suicida a capital inimiga. Cai p/ qualquer alvo se nao houver neutra.
    const neutras = alvos.filter((a) => a.dono === null);
    const poolAlvo = neutras.length ? neutras : alvos;
    const alvoAtk = poolAlvo.length ? poolAlvo[0].id : origem;
    const tropas = (l, a, c) => `{"lanceiro": ${l}, "arqueiro": ${a}, "cavaleiro": ${c}}`;

    // ANCORAGEM DAS QUANTIDADES (19/07): os modelos fracos copiam o exemplo ao
    // pe da letra. Antes o exemplo pedia 10 lanceiros / 5 arqueiros — mais do que
    // o rei tem (5/4/3) -> copia = 100% rejeitada. Agora as quantidades saem das
    // tropas REAIS da 1a aldeia (metade de cada): um copia-cola sai VALIDO, e
    // ainda sobra guarnicao (2x floor(n/2) <= n). Numeros = os do turno, nao fixos.
    const tr = a0 ? a0.tropas : { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
    let hl = Math.floor((tr.lanceiro || 0) / 2), ha = Math.floor((tr.arqueiro || 0) / 2), hc = Math.floor((tr.cavaleiro || 0) / 2);
    if (hl + ha + hc === 0) { // aldeia quase vazia: manda 1 de um tipo que exista (senao so o molde)
      if ((tr.lanceiro || 0) > 0) hl = 1; else if ((tr.arqueiro || 0) > 0) ha = 1; else if ((tr.cavaleiro || 0) > 0) hc = 1;
    }
    const envios = [
      `    {"origemId": ${origem}, "destinoId": ${alvoAtk}, "tropas": ${tropas(hl, ha, hc)}}`,
    ];
    // 2a linha mostra o molde com 2 envios; mesmas quantidades (2x metade <= total),
    // destino = outro id real. So aparece se ha um 2o alvo E tropas p/ enviar.
    const segundoDestino = poolAlvo.length >= 2 ? poolAlvo[1].id : (minhas.length >= 2 ? minhas[1].id : null);
    if (segundoDestino != null && hl + ha + hc > 0) {
      envios.push(`    {"origemId": ${origem}, "destinoId": ${segundoDestino}, "tropas": ${tropas(hl, ha, hc)}}`);
    }
    return [
      "{",
      '  "construir": [',
      `    {"aldeiaId": ${origem}, "tipo": "lanceiro"}`,
      "  ],",
      '  "envios": [',
      envios.join(",\n"),
      "  ]",
      "}",
    ].join("\n");
  }

  // montarPrompt(visao) -> string. FUNCAO PURA: sem rede, sem efeito
  // colateral, sem chamar modelo. NAO recebe `lado`: a visao ja carrega
  // de quem e (campo `minhas`). Ordem critica p/ modelo pequeno:
  // TAREFA -> DADOS -> FORMATO, com o EXEMPLO por ultimo.
  // REGRAS DE COMBATE em texto, GERADAS da CONFIG: se o eval varrer o bonus,
  // o prompt conta a verdade automaticamente. Regra no prompt divergindo da
  // regra no motor e o pior bug possivel num benchmark.
  function regrasCombateTexto(cfg) {
    const B = cfg.bonus_forca_triangulo;
    const L = [];
    L.push("=== REGRAS DE COMBATE ===");
    L.push("Cada tropa vale 1: o que conta e o NUMERO de tropas de cada lado.");
    L.push(`Triangulo de counters: ${TIPOS.map((t) => `${t} vence ${cfg.triangulo[t]}`).join("; ")}.`);
    L.push(`O tipo com MAIS tropas em cada exercito define o matchup. O lado com o counter certo conta suas tropas x ${B}. Vence o maior numero efetivo de tropas; empate favorece o defensor.`);
    if (B > 1) {
      const def = 5;
      const atk = Math.ceil((def + 1) / B); // atk*B > def
      if (atk < def) {
        const atkEf = Math.round(atk * B);
        L.push(`Exemplo: ${atk} arqueiros atacando ${def} lanceiros: com o counter certo, ${atk} x ${B} = ${atkEf} contra ${def} -> o atacante vence mesmo com MENOS tropas. Com o counter errado, seria o inverso.`);
      }
    }
    const bA = cfg.combate && cfg.combate.bonus_defesa_aldeia, bC = cfg.combate && cfg.combate.bonus_defesa_castelo;
    if (bA || bC)
      L.push(`Defender e mais facil: tropas paradas numa aldeia contam x ${bA}; num castelo (capital), x ${bC}. Em campo aberto (na estrada) nao ha bonus. Para TOMAR uma aldeia, leve tropas com folga — 1 unidade nao conquista nada.`);
    return L.join("\n");
  }

  // REGRAS DE ECONOMIA em texto, GERADAS da CONFIG (mesmo principio do
  // bloco de combate): custo/forca/tempo por tropa, producao e teto.
  // Sem isso o modelo so aprende os precos errando (51 rejeicoes do
  // gemini na partida de 02/07 — todas de construcao).
  function regrasEconomiaTexto(cfg) {
    const L = [];
    L.push("=== REGRAS DE ECONOMIA ===");
    for (const t of TIPOS) {
      const d = cfg.tropas[t];
      L.push(`${t}: custa ${d.custo.madeira} madeira + ${d.custo.ferro} ferro, ` +
        `fica pronto em ${d.turnos} turno${d.turnos > 1 ? "s" : ""}, velocidade ${d.vel}.`);
    }
    L.push(`Cada aldeia sua produz ${cfg.producao.madeira} madeira e ${cfg.producao.ferro} ferro por turno.`);
    if (cfg.limite_forca_aldeia)
      L.push(`Teto por aldeia: quando a forca das tropas em casa atinge ${cfg.limite_forca_aldeia}, ` +
        `a aldeia PARA de construir (mas segue produzindo recursos e pode receber reforcos).`);
    L.push("So ordene construir se a aldeia tem recursos para pagar o custo AGORA.");
    return L.join("\n");
  }

  // opcoes (H2, experimento de POSICAO do feedback — uma variavel):
  //   { rejeicaoNoFim: true } MOVE o bloco de rejeicoes do meio do relatorio
  //   para o FIM ABSOLUTO do prompt (depois do exemplo), com a instrucao
  //   anti-repeticao do handoff. Sem opcoes ou sem rejeicoes: prompt
  //   BYTE-IGUAL ao de sempre — o benchmark antigo segue comparavel.
  function montarPrompt(visao, opcoes) {
    const rejNoFim = !!(opcoes && opcoes.rejeicaoNoFim) &&
      !!(visao.rejeicoesAnteriores && visao.rejeicoesAnteriores.length);
    const L = [];
    // TOPO: identidade + tarefa (curto)
    L.push('Voce e o Rei. As aldeias listadas em "SUAS ALDEIAS" pertencem a voce.');
    L.push("Seu objetivo e vencer eliminando o inimigo.");
    L.push("");
    L.push(regrasCombateTexto(visao.config));
    L.push("");
    L.push(regrasEconomiaTexto(visao.config));
    L.push("");
    // MEIO: dados do turno (relatorio integral)
    L.push(relatorioTexto(visao, rejNoFim ? { semRejeicoes: true } : undefined));
    L.push("");
    // FIM: instrucao de formato -> processo -> exemplo (ultimo).
    // A "permissao de vazio" ("Listas vazias sao uma resposta valida... E melhor
    // nao fazer nada do que enviar um ataque ruim...") foi REMOVIDA. Experimento
    // exp-cautela-2x2 (braco B, 4x3x5, 15t, temp0): a frase congelava o
    // llama3:8b em agencia 0.00 envios/turno (5/5 seeds, variancia zero) — ele
    // copiava a linha construir do exemplo e esvaziava os envios. Remove-la
    // destrava (0->1.71 envios/turno, 1->5.2 aldeias) e ajuda tambem os 3B, sem
    // o efeito colateral do nudge factual (que fazia MAL ao llama3.2:3b).
    L.push("Responda APENAS com um JSON valido no formato abaixo. Nenhum texto antes ou depois do JSON.");
    L.push("");
    // INSTRUCAO DE PROCESSO (curta, logo antes do exemplo): forca o modelo a
    // ancorar nos ids REAIS da visao em vez de copiar numeros do exemplo.
    L.push("Antes de responder: em 'origemId' e em 'aldeiaId' use SOMENTE ids que aparecem na secao SUAS ALDEIAS. Escolha o 'destinoId' entre os ids das secoes ALDEIAS NEUTRAS e INIMIGO. Nao envie tropas que voce nao tem: se uma aldeia esta sem tropas, nao a use em 'envios'. O exemplo abaixo so mostra o FORMATO com ids reais deste turno; nao copie os numeros dele como se fossem sua jogada.");
    L.push("");
    L.push(exemploAncorado(visao));
    if (rejNoFim) {
      // FIM ABSOLUTO (H2): modelos pequenos pesam mais o rabo do prompt.
      L.push("");
      L.push("=== ATENCAO: SUAS ORDENS RECUSADAS NO TURNO ANTERIOR ===");
      L.push("As ordens abaixo foram RECUSADAS pelo motor:");
      for (const r of visao.rejeicoesAnteriores) L.push(`- ${r}`);
      L.push("NAO repita a mesma ordem. Os numeros de tropas e recursos DISPONIVEIS estao no relatorio acima: use-os.");
    }
    return L.join("\n");
  }

  // Extrai o PRIMEIRO bloco {...} BALANCEADO de um texto (o qwen poe cercas
  // ```json e texto em volta). Respeita aspas/escape p/ nao contar { } dentro
  // de strings. null se nao houver bloco fechado.
  function extrairBlocoJSON(texto) {
    if (typeof texto !== "string") return null;
    const ini = texto.indexOf("{");
    if (ini < 0) return null;
    let prof = 0, emString = false, escape = false;
    for (let i = ini; i < texto.length; i++) {
      const ch = texto[i];
      if (emString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') emString = false;
        continue;
      }
      if (ch === '"') emString = true;
      else if (ch === "{") prof++;
      else if (ch === "}") { prof--; if (prof === 0) return texto.slice(ini, i + 1); }
    }
    return null; // bloco aberto sem fechar
  }

  // parsearOrdem(textoCru) -> { ok, ordem, erro, bloco, normalizacoes }.
  // SEM RETRY (decisao de design: medir a taxa CRUA de falha do qwen).
  // Qualquer falha -> ORDEM VAZIA (o Rei "passa" o turno) + erro p/ o log.
  // NUNCA lanca.
  // H3: normaliza variacao TRIVIAL (normalizarTipo) no `tipo` de construir
  // e nas CHAVES de `tropas` dos envios — choke point unico: motor,
  // diagnostico e log consomem a MESMA ordem. Cada correcao vira uma linha
  // em `normalizacoes` p/ o txt registrar "normalizado:" (mede-se cru E
  // normalizado; a normalizacao nao esconde o desvio, so impede que uma
  // letra mate a partida).
  function parsearOrdem(textoCru) {
    const vazia = { construir: [], envios: [] };
    const bloco = extrairBlocoJSON(textoCru);
    if (bloco == null) return { ok: false, ordem: vazia, erro: "nenhum bloco {...} na resposta", bloco: null, normalizacoes: [] };
    let obj;
    try { obj = JSON.parse(bloco); }
    catch (e) { return { ok: false, ordem: vazia, erro: "JSON invalido: " + e.message, bloco, normalizacoes: [] }; }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return { ok: false, ordem: vazia, erro: "JSON nao e um objeto", bloco, normalizacoes: [] };
    }
    const construir = Array.isArray(obj.construir) ? obj.construir : [];
    const envios = Array.isArray(obj.envios) ? obj.envios
      : Array.isArray(obj.ataques) ? obj.ataques : []; // aceita nome antigo
    const normalizacoes = [];
    for (const c of construir) {
      if (!c || typeof c !== "object" || typeof c.tipo !== "string") continue;
      const n = normalizarTipo(c.tipo);
      if (n !== c.tipo) {
        normalizacoes.push(`construir [${c.aldeiaId}]: tipo "${c.tipo}" -> "${n}"`);
        c.tipo = n;
      }
    }
    for (const e of envios) {
      if (!e || typeof e !== "object" || !e.tropas || typeof e.tropas !== "object") continue;
      for (const k of Object.keys(e.tropas)) {
        const n = normalizarTipo(k);
        if (n === k) continue;
        normalizacoes.push(`envio [${e.origemId}]->[${e.destinoId}]: tropa "${k}" -> "${n}"`);
        e.tropas[n] = (Number(e.tropas[n]) || 0) + (Number(e.tropas[k]) || 0); // colisao: soma
        delete e.tropas[k];
      }
    }
    return { ok: true, ordem: { construir, envios }, erro: null, bloco, normalizacoes };
  }

  // diagnosticarOrdem(estado, dono, ordem) -> { aceitoConstruir, aceitoEnvios,
  // rejeicoes }. NAO MUTA o estado: so antecipa o que executarOrdem faria, p/
  // o LOG (o eval). Espelha as regras de tolerancia do motor:
  //   - construir: aldeia existe e e sua; tipo valido; recurso suficiente
  //     (depleta sequencialmente, como o motor faz no turno).
  //   - envio: origem existe e e sua; destino existe; origem != destino;
  //     TUDO-OU-NADA nas tropas (enviarExercito rejeita o envio inteiro se
  //     faltar QUALQUER tipo); total > 0.
  function diagnosticarOrdem(estado, dono, ordem) {
    const rejeicoes = [];
    const aceitoConstruir = [], aceitoEnvios = [];
    const construir = (ordem && Array.isArray(ordem.construir)) ? ordem.construir : [];
    const envios = (ordem && Array.isArray(ordem.envios)) ? ordem.envios : [];

    const recSim = {};   // recursos restantes por aldeia (simula o gasto do turno)
    const forcaSim = {}; // forca comprometida por aldeia (simula o teto de producao)
    const limite = estado.config.limite_forca_aldeia;
    for (const c of construir) {
      if (!c || typeof c !== "object") { rejeicoes.push("construir: item nao e objeto"); continue; }
      const a = aldeiaPorId(estado, c.aldeiaId);
      if (!a) { rejeicoes.push(`construir: aldeia [${c.aldeiaId}] nao existe`); continue; }
      if (a.dono !== dono) { rejeicoes.push(`construir: aldeia [${c.aldeiaId}] nao e sua`); continue; }
      const def = estado.config.tropas[c.tipo];
      if (!def) {
        const motivo = c.tipo == null
          ? `faltou o campo "tipo" (escreva "lanceiro", "arqueiro" ou "cavaleiro")`
          : `tipo invalido "${c.tipo}" (use "lanceiro", "arqueiro" ou "cavaleiro")`;
        rejeicoes.push(`construir [${c.aldeiaId}]: ${motivo}`);
        continue;
      }
      if (!(c.aldeiaId in forcaSim)) forcaSim[c.aldeiaId] = forcaComprometida(estado, a);
      if (limite != null && forcaSim[c.aldeiaId] >= limite) {
        rejeicoes.push(`construir [${c.aldeiaId}]: no teto de forca (${forcaSim[c.aldeiaId]}/${limite}) - producao parada`);
        continue;
      }
      if (!(c.aldeiaId in recSim)) recSim[c.aldeiaId] = { madeira: a.recursos.madeira, ferro: a.recursos.ferro };
      const r = recSim[c.aldeiaId];
      if (r.madeira < def.custo.madeira || r.ferro < def.custo.ferro) {
        rejeicoes.push(`construir [${c.aldeiaId}]: recurso insuficiente p/ ${c.tipo} (tem ${r.madeira}m/${r.ferro}f, custa ${def.custo.madeira}m/${def.custo.ferro}f)`);
        continue;
      }
      r.madeira -= def.custo.madeira; r.ferro -= def.custo.ferro;
      forcaSim[c.aldeiaId] += def.forca;
      aceitoConstruir.push({ aldeiaId: c.aldeiaId, tipo: c.tipo });
    }

    for (const e of envios) {
      if (!e || typeof e !== "object") { rejeicoes.push("envio: item nao e objeto"); continue; }
      const o = aldeiaPorId(estado, e.origemId);
      if (!o) { rejeicoes.push(`envio: origem [${e.origemId}] nao existe`); continue; }
      if (o.dono !== dono) { rejeicoes.push(`envio: origem [${e.origemId}] nao e sua`); continue; }
      const d = aldeiaPorId(estado, e.destinoId);
      if (!d) { rejeicoes.push(`envio: destino [${e.destinoId}] nao existe`); continue; }
      if (e.origemId === e.destinoId) { rejeicoes.push(`envio [${e.origemId}]: origem igual ao destino`); continue; }
      const pedido = sanitizarTropas(e.tropas);
      // FEEDBACK HONESTO (H3): sanitizarTropas descarta chave desconhecida
      // em silencio. Antes, {"archer":5} virava rejeicao "zero tropas" —
      // mensagem que NAO descreve o erro e alimenta o loop de perseveracao
      // (o modelo nao tem como corrigir o que ninguem nomeou).
      const desconhecidas = (e.tropas && typeof e.tropas === "object")
        ? Object.keys(e.tropas).filter((k) => TIPOS.indexOf(k) < 0 && Number(e.tropas[k]) > 0)
        : [];
      const faltam = TIPOS.filter((t) => pedido[t] > o.tropas[t]);
      if (faltam.length) {
        rejeicoes.push(`envio [${e.origemId}]->[${e.destinoId}]: tropa que nao tem (${faltam.map((t) => `pediu ${pedido[t]} ${t}, tem ${o.tropas[t]}`).join("; ")})`);
        continue;
      }
      if (TIPOS.reduce((s, t) => s + pedido[t], 0) === 0) {
        rejeicoes.push(desconhecidas.length
          ? `envio [${e.origemId}]->[${e.destinoId}]: tipo de tropa desconhecido (${desconhecidas.map((k) => `"${k}"`).join(", ")}) - use "lanceiro", "arqueiro" ou "cavaleiro"`
          : `envio [${e.origemId}]->[${e.destinoId}]: zero tropas`);
        continue;
      }
      if (desconhecidas.length) { // misto: a parte valida VAI (espelha o motor), mas o descarte e avisado
        rejeicoes.push(`envio [${e.origemId}]->[${e.destinoId}]: tipo desconhecido ignorado (${desconhecidas.map((k) => `"${k}"`).join(", ")}) - enviado so o que e valido`);
      }
      aceitoEnvios.push({ origemId: e.origemId, destinoId: e.destinoId, tropas: pedido, alvo: d });
    }

    return { aceitoConstruir, aceitoEnvios, rejeicoes };
  }

  // ==========================================================
  //  CLAMP DE ENVIOS (afford do motor — sobrevivente da Fase 12)
  //  Ajusta APENAS quantidade: pediu mais do que tem -> envia o que
  //  tem, com AVISO (nunca silencioso — licao do H3). Ilegalidades
  //  de identidade (origem nao e sua, destino nao existe) NAO sao
  //  clampaveis: passam adiante e o motor rejeita como sempre.
  //  Envio ajustado a zero e cancelado (com aviso).
  // ==========================================================
  function clampearEnvios(estado, dono, ordem) {
    const avisos = [];
    const construir = (ordem && Array.isArray(ordem.construir)) ? ordem.construir : [];
    const enviosIn = (ordem && Array.isArray(ordem.envios)) ? ordem.envios : [];
    const envios = [];
    for (const e of enviosIn) {
      if (!e || typeof e !== "object") { envios.push(e); continue; }
      const o = aldeiaPorId(estado, e.origemId);
      const d = aldeiaPorId(estado, e.destinoId);
      if (!o || o.dono !== dono || !d || e.origemId === e.destinoId) { envios.push(e); continue; }
      const pedido = sanitizarTropas(e.tropas);
      const ajust = {}; const cortes = []; let total = 0;
      for (const t of TIPOS) {
        ajust[t] = Math.min(pedido[t], o.tropas[t]);
        if (ajust[t] < pedido[t]) cortes.push(`pediu ${pedido[t]} ${t}, enviado ${ajust[t]}`);
        total += ajust[t];
      }
      if (!cortes.length) { envios.push(e); continue; }
      if (total === 0) {
        avisos.push(`envio [${e.origemId}]->[${e.destinoId}]: ajustado a ZERO (${cortes.join("; ")}) - envio cancelado`);
        continue;
      }
      avisos.push(`envio [${e.origemId}]->[${e.destinoId}]: ajustado ao estoque (${cortes.join("; ")})`);
      envios.push({ origemId: e.origemId, destinoId: e.destinoId, tropas: ajust });
    }
    return { ordem: { construir, envios }, avisos };
  }

  // escolhe a tropa a construir: a mais "em falta" vs composicao_alvo,
  // entre as que cabem no recurso. null se nada cabe.
  function escolherTropa(rec, counts, config) {
    const alvo = config.jogador.composicao_alvo;
    const somaAlvo = TIPOS.reduce((s, t) => s + (alvo[t] || 0), 0);
    const total = TIPOS.reduce((s, t) => s + (counts[t] || 0), 0) || 1;
    let melhor = null, melhorDef = -Infinity;
    for (const t of TIPOS) {
      const c = config.tropas[t].custo;
      if (rec.madeira < c.madeira || rec.ferro < c.ferro) continue;
      const deficit = (alvo[t] || 0) / somaAlvo - (counts[t] || 0) / total;
      if (deficit > melhorDef) { melhorDef = deficit; melhor = t; }
    }
    return melhor;
  }

  // melhor alvo: entre os que podemos vencer (defesa*margem < forca),
  // o mais proximo (desempate: mais fraco, depois id).
  function melhorAlvo(origem, alvos, forca, config) {
    const margem = config.jogador.margem_ataque;
    let melhor = null, melhorChave = null;
    for (const t of alvos) {
      if (t.forcaDefesa * margem >= forca) continue;
      const d = Math.hypot(origem.x - t.x, origem.y - t.y);
      const chave = [d, t.forcaDefesa, t.id];
      if (!melhor ||
          chave[0] < melhorChave[0] ||
          (chave[0] === melhorChave[0] && chave[1] < melhorChave[1]) ||
          (chave[0] === melhorChave[0] && chave[1] === melhorChave[1] && chave[2] < melhorChave[2])) {
        melhor = t; melhorChave = chave;
      }
    }
    return melhor;
  }

  // O JOGADOR BURRO: decisor(visao) -> ordem. Deterministico (sem RNG):
  //   1) constroi puxando a composicao_alvo enquanto houver recurso.
  //   2) se a guarnicao tipada vence algum alvo, manda TODA ela no mais proximo.
  function jogadorBurro(visao) {
    const cfg = visao.config;
    const construir = [], envios = [];
    for (const a of visao.minhas) {
      // 1) construir
      const rec = { madeira: a.recursos.madeira, ferro: a.recursos.ferro };
      const counts = {};
      for (const t of TIPOS) counts[t] = a.tropas[t];
      for (const c of a.construindo) counts[c.tipo] = (counts[c.tipo] || 0) + 1;
      for (let i = 0; i < cfg.jogador.max_construir_por_turno; i++) {
        const t = escolherTropa(rec, counts, cfg);
        if (!t) break;
        rec.madeira -= cfg.tropas[t].custo.madeira;
        rec.ferro -= cfg.tropas[t].custo.ferro;
        counts[t]++;
        construir.push({ aldeiaId: a.id, tipo: t });
      }
      // 2) enviar (unificado: aqui o burro so ataca o mais proximo vencivel)
      const forca = forcaDe(a.tropas, cfg);
      if (forca > 0) {
        const alvo = melhorAlvo(a, visao.alvos, forca, cfg);
        if (alvo) envios.push({ origemId: a.id, destinoId: alvo.id, tropas: Object.assign({}, a.tropas) });
      }
    }
    return { construir, envios };
  }

  // Sanitiza um objeto de tropas vindo de uma ORDEM (pode ser de um modelo
  // que erra): devolve sempre {lanceiro,arqueiro,cavaleiro} inteiros >= 0.
  function sanitizarTropas(t) {
    const out = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
    if (t && typeof t === "object") {
      for (const k of TIPOS) {
        const v = Math.floor(Number(t[k]));
        if (Number.isFinite(v) && v > 0) out[k] = v;
      }
    }
    return out;
  }

  // Aplica uma ORDEM ESTRUTURADA. TOLERANTE A ORDEM INVALIDA (pensando no Rei
  // movido por um modelo pequeno que erra): nunca lanca; ignora partes invalidas.
  //   ordem = { construir:[{aldeiaId,tipo}], envios:[{origemId,destinoId,tropas}] }
  //   ENVIO UNIFICADO: o motor decide pelo DONO do destino (reforco vs ataque).
  function executarOrdem(estado, dono, ordem) {
    // FEEDBACK (memoria, sem retry): guarda as ordens RECUSADAS desta jogada
    // p/ o relatorio do PROXIMO turno (montarVisao le isto). Ordem invalida
    // continua sendo "passa o turno" — aqui so registramos o porque.
    if (!estado.rejeicoesAnteriores) estado.rejeicoesAnteriores = {};
    if (!ordem || typeof ordem !== "object") { estado.rejeicoesAnteriores[dono] = []; return; }
    estado.rejeicoesAnteriores[dono] = diagnosticarOrdem(estado, dono, ordem).rejeicoes;
    const construir = Array.isArray(ordem.construir) ? ordem.construir : [];
    const envios = Array.isArray(ordem.envios) ? ordem.envios
      : Array.isArray(ordem.ataques) ? ordem.ataques : []; // aceita nome antigo
    for (const c of construir) {
      if (!c || typeof c !== "object") continue;
      const a = aldeiaPorId(estado, c.aldeiaId);
      if (a && a.dono === dono) enfileirarConstrucao(estado, c.aldeiaId, c.tipo);
    }
    for (const e of envios) {
      if (!e || typeof e !== "object") continue;
      const o = aldeiaPorId(estado, e.origemId);
      if (o && o.dono === dono) enviarExercito(estado, e.origemId, e.destinoId, sanitizarTropas(e.tropas));
    }
  }

  // (6) DECISAO: cada jogador vivo monta visao, decide e executa.
  function decidirEExecutar(estado, decisores) {
    for (const dono of ["A", "B"]) {
      if (!aldeiasDe(estado, dono).length) continue; // morto nao decide
      const decisor = (decisores && decisores[dono]) || jogadorBurro;
      executarOrdem(estado, dono, decisor(montarVisao(estado, dono)));
    }
  }

  // jogador vivo = possui >=1 aldeia. Regra literal da spec: perdeu a ULTIMA
  // aldeia, perdeu a partida (exercito em transito sem base nao salva).
  function jogadorVivo(estado, dono) {
    return aldeiasDe(estado, dono).length > 0;
  }

  // (7) VITORIA por eliminacao. null = partida continua.
  function checarVitoria(estado) {
    const aVivo = jogadorVivo(estado, "A"), bVivo = jogadorVivo(estado, "B");
    if (aVivo && bVivo) return null;
    if (aVivo) return "A";
    if (bVivo) return "B";
    return "empate";
  }

  // snapshot resumido do turno (observabilidade / base do eval)
  function resumoTurno(estado) {
    const A = aldeiasDe(estado, "A"), B = aldeiasDe(estado, "B");
    const forca = (lista) => lista.reduce((s, a) => s + forcaDe(a.tropas, estado.config), 0);
    const combates = estado.log.filter((l) => l.turno === estado.turno && l.tipo === "combate").length;
    return {
      turno: estado.turno,
      aldeiasA: A.length, aldeiasB: B.length,
      neutras: aldeiasDe(estado, null).length,
      forcaA: forca(A), forcaB: forca(B),
      transito: estado.movimentos.length,
      combates,
    };
  }

  // rodarTurno = TICK (1-5) + DECISAO (6) + VITORIA (7). Devolve vencedor|null.
  function rodarTurno(estado, decisores) {
    tick(estado);
    decidirEExecutar(estado, decisores);
    return checarVitoria(estado);
  }

  // RODAR PARTIDA completa. decisores = { A: fn, B: fn } (default: jogadorBurro).
  // opcoes: { verbose, maxTurnos }. Modo rapido = verbose falso.
  function rodarPartida(config, decisores, opcoes) {
    opcoes = opcoes || {};
    const estado = criarEstadoInicial(config || CONFIG);
    const maxTurnos = opcoes.maxTurnos || (config || CONFIG).max_turnos || 500;
    const historico = [];
    let vencedor = null;
    while (estado.turno < maxTurnos) {
      vencedor = rodarTurno(estado, decisores);
      const snap = resumoTurno(estado);
      historico.push(snap);
      if (opcoes.verbose) {
        console.log(
          `T${String(snap.turno).padStart(3)} | A:${snap.aldeiasA}ald F${snap.forcaA} | ` +
          `B:${snap.aldeiasB}ald F${snap.forcaB} | neutras ${snap.neutras} | ` +
          `transito ${snap.transito} | combates ${snap.combates}`
        );
      }
      if (vencedor) break;
    }
    return {
      vencedor: vencedor || "limite",
      motivo: vencedor ? (vencedor === "empate" ? "empate" : "eliminacao") : "limite",
      turnos: estado.turno,
      aldeiasA: aldeiasDe(estado, "A").length,
      aldeiasB: aldeiasDe(estado, "B").length,
      historico,
      estado,
    };
  }

  // ==========================================================
  //  RELATORIO DE DESFECHO (pos-partida)
  // ----------------------------------------------------------
  //  Le o RESULTADO de rodarPartida/rodarPartidaRei e resume COMO a
  //  partida terminou. Texto PURO (sem rede). Foco no desfecho + nos
  //  sinais das mecanicas: forca por aldeia vs teto, pico de massa
  //  (mede o efeito de baixar a guarnicao inicial + o teto), conquistas.
  // ==========================================================
  function relatorioDesfecho(res, config) {
    const cfg = config || (res.estado && res.estado.config) || CONFIG;
    const est = res.estado;
    const L = [];
    const barra = "=".repeat(56);

    L.push(barra);
    L.push("  DESFECHO DA PARTIDA");
    L.push(barra);

    // 1) RESULTADO
    const venc = res.vencedor;
    const quem = venc === "A" ? "Rei A venceu" : venc === "B" ? "Rei B venceu"
      : venc === "empate" ? "EMPATE (ambos eliminados)" : "SEM DECISAO (bateu o limite de turnos)";
    L.push(`Resultado : ${quem}  [${res.motivo}]`);
    const alvo = cfg.partida_alvo_turnos;
    L.push(`Duracao   : ${res.turnos} turnos` + (alvo ? `  (alvo de design: ${alvo})` : ""));

    // 2) PLACAR FINAL de aldeias
    const A = aldeiasDe(est, "A"), B = aldeiasDe(est, "B"), N = aldeiasDe(est, null);
    L.push(`Placar    : Rei A ${A.length} | Rei B ${B.length} | neutras ${N.length}  (de ${est.aldeias.length} aldeias)`);
    L.push("");

    // 3) FORCA FINAL + DISTRIBUICAO (o teto de producao deve aparecer aqui)
    const teto = cfg.limite_forca_aldeia;
    L.push("FORCA FINAL:");
    const resumoLado = (lista, nome) => {
      const forcas = lista.map((a) => forcaDe(a.tropas, cfg));
      const total = forcas.reduce((s, f) => s + f, 0);
      const maior = forcas.length ? Math.max.apply(null, forcas) : 0;
      const noTeto = teto != null ? forcas.filter((f) => f >= teto).length : 0;
      L.push(`  ${nome}: forca total ${total} em ${lista.length} aldeia(s) | maior guarnicao ${maior}` +
        (teto != null ? ` (teto ${teto}: ${noTeto} aldeia(s) no teto)` : ""));
    };
    resumoLado(A, "Rei A");
    resumoLado(B, "Rei B");
    L.push("");

    // 4) PICO DE MASSA ao longo da partida (efeito de 550->200 + teto de 300)
    const hist = res.historico || [];
    if (hist.length) {
      let picoA = 0, picoB = 0, tA = 0, tB = 0;
      for (const h of hist) {
        if (h.forcaA > picoA) { picoA = h.forcaA; tA = h.turno; }
        if (h.forcaB > picoB) { picoB = h.forcaB; tB = h.turno; }
      }
      L.push(`PICO DE FORCA (total do lado, ao longo da partida): Rei A ${picoA} (T${tA}) | Rei B ${picoB} (T${tB})`);
      L.push("");
    }

    // 5) ATIVIDADE: combates e conquistas (quem tomou o que, e quando)
    const combates = (est.log || []).filter((e) => e.tipo === "combate");
    const conquistas = combates.filter((e) => e.conquista);
    L.push(`COMBATES  : ${combates.length} no total | ${conquistas.length} conquista(s)`);
    const MOSTRA = 15;
    conquistas.slice(0, MOSTRA).forEach((c) => {
      L.push(`  T${c.turno}: Rei ${c.atacante} tomou [${c.alvoId}] ${c.alvoNome} (Fatk ${c.Fatk} vs Fdef ${c.Fdef}, m=${c.m.toFixed(2)})`);
    });
    if (conquistas.length > MOSTRA) L.push(`  (+${conquistas.length - MOSTRA} conquista(s) nao listada(s))`);
    L.push(barra);
    return L.join("\n");
  }

  // E3/1c-i — assinatura SEMANTICA de rejeicao (promovida do runner de
  // perseveracao em 17/07): prefixo da acao + ids entre colchetes. Um so
  // calculo p/ reincidencia, dois consumidores (runner Node + arena browser).
  function assinaturasRejeitadas(rejeicoes) {
    const sigs = new Set();
    for (const r of rejeicoes || []) {
      const ids = [...r.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
      if (!ids.length) continue;
      if (r.startsWith("construir")) sigs.add("construir@" + ids[0]);
      else if (r.startsWith("envio")) sigs.add("envio@" + ids.join(">"));
    }
    return sigs;
  }

  return {
    CONFIG,
    relatorioDesfecho,
    criarRng, rngInt,
    criarAldeia,
    gerarTeatro,
    criarEstadoInicial,
    aldeiasDe,
    aldeiaPorId,
    resumoEstado,
    // Peca 2
    produzir,
    enfileirarConstrucao,
    avancarConstrucao,
    endurecer,
    tick,
    // Peca 3
    forcaTropas,
    forcaDefesa,
    forcaComprometida,
    tipoDominante,
    regrasCombateTexto,
    regrasEconomiaTexto,
    preverCombate,
    vantagem,
    resolverCombate,
    distancia,
    velExercito,
    turnosViagem,
    turnosPorDist,
    construirEstradas,
    caminhoEntre,
    distanciaRota,
    posicaoRota,
    cruzaramNaEstrada,
    resolverCombateEstrada,
    enviarExercito,
    avancarMovimentos,
    // Peca 4
    forcaDe,
    montarVisao,
    relatorioTexto,
    compTexto,
    eventoTexto,
    jogadorBurro,
    executarOrdem,
    sanitizarTropas, normalizarTipo,
    // V1 Peca 2 (Rei IA): partes puras (prompt + parsing)
    montarPrompt,
    exemploAncorado,
    extrairBlocoJSON,
    parsearOrdem,
    diagnosticarOrdem,
    assinaturasRejeitadas,
    clampearEnvios,
    decidirEExecutar,
    checarVitoria,
    resumoTurno,
    rodarTurno,
    rodarPartida,
  };
});