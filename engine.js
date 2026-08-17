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
  let World, Iberia;
  if (typeof module !== "undefined" && module.exports) {
    World = require("./world.js");
    Iberia = require("./world-iberia.js");
    module.exports = factory(World, Iberia);
  } else {
    World = root.World;
    Iberia = root.Iberia;
    root.Engine = factory(World, Iberia);
  }
})(typeof self !== "undefined" ? self : this, function (World, Iberia) {
  "use strict";

  // ==========================================================
  //  CONFIG  —  A FOLHA DE BALANCEAMENTO INTEIRA
  // ----------------------------------------------------------
  //  UMA fonte de verdade. Todo numero balanceavel vive aqui,
  //  nunca espalhado pelo codigo. TODOS sao PROVISORIOS (V1 do
  //  balanceamento): ponto de partida coerente, nao a verdade.
  // ==========================================================
  // ==========================================================
  //  CONFIG_V3_ARQUIVO — o ruleset ANTIGO, congelado.
  // ----------------------------------------------------------
  //  NAO e jogavel. Existe por UM motivo: `testes/test_lote_c.js` congela o
  //  texto do relatorio contra 3 estados de referencia gerados com estes
  //  valores, e essa regressao e o que garante que mexer no PROMPT nao muda o
  //  texto sem querer. Nenhum caminho da UI ou do runner chega aqui.
  //
  //  17/08 — porque deixou de ser selecionavel: enquanto havia DOIS rulesets
  //  escolhiveis em tempo de execucao, existia a possibilidade de correr o
  //  errado. E aconteceu: as 3 partidas pagas de 16/08 (~$2.25) correram com
  //  este objeto enquanto o log dizia v4, porque o checkbox era lido depois do
  //  estado ja estar criado. A licao nao foi "faltou um listener" — foi que uma
  //  regra que PODE nao estar ligada mais cedo ou mais tarde nao esta. Agora o
  //  jogo tem um ruleset so, o CONFIG abaixo, e nao ha como escolher outro.
  // ==========================================================
  const CONFIG_V3_ARQUIVO = {
    // Semente da partida: torna a geracao (guarnicoes, escolhas)
    // reproduzivel. Mude para gerar outra partida.
    seed: 1,

    // Referencia de design (NAO e um limite de turnos).
    partida_alvo_turnos: 30,

    // PRODUCAO por aldeia, por turno.
    // Fase 7.2 (04/08): REVERTIDA a Fase 4 (madeira 15 -> 10). A Fase 4 falhou o
    // proprio teste (5A): o ferro seguiu morto (~240) e a madeira abundante so
    // criou monocultura de lanceiro. Manter uma alteracao reprovada poluia o
    // experimento do combate v3. Volta ao original.
    producao: { madeira: 10, ferro: 6 },

    // TETO DE TROPAS POR ALDEIA: SO A PRODUCAO respeita. Aldeia cuja CONTAGEM de
    // tropas (em casa + ja na fila de construcao) atinge este valor PARA de
    // construir — mas segue juntando recurso. Reforco e conquista PODEM passar do
    // teto: o limite morde so a fabricacao, p/ punir empilhar massa num lugar
    // so sem travar quem reforca/conquista. null = sem teto. PROVISORIO.
    // 7.4 (04/08): renomeado de limite_forca_aldeia — conta UNIDADES, nao poder
    // de combate, entao nao pode passar a somar atq/def (armadilha 7.4-A).
    limite_tropas_aldeia: 300,

    // TROPAS: custo / forca / velocidade / turnos para construir.
    // A forca e quase proporcional ao custo de proposito: o
    // cavaleiro paga a mais por velocidade, nao por forca bruta.
    tropas: {
      // COMBATE v3 (Fase 7.3, 04/08): ATAQUE e DEFESA SEPARADOS. A forca achatada
      // (forca 1 p/ todos) matou dois tercos do roster — com o tipo a entrar so
      // pelo counter, arqueiro e cavaleiro eram economicamente dominados (5A).
      // Agora: o lanceiro e o defensor barato, o cavaleiro e o ariete que nao
      // guarnece nada, o arqueiro e o meio-termo flexivel.
      //   atacante usa `atq`, defensor usa `def`. NUNCA se trocam (armadilha 7.4).
      lanceiro:  { custo: { madeira: 15, ferro: 0  }, atq: 1, def: 2, vel: "lenta",  turnos: 1 },
      arqueiro:  { custo: { madeira: 20, ferro: 10 }, atq: 2, def: 2, vel: "media",  turnos: 1 },
      cavaleiro: { custo: { madeira: 30, ferro: 30 }, atq: 4, def: 1, vel: "rapida", turnos: 2 },
    },

    // TRIANGULO pedra-papel-tesoura: cada tropa VENCE a indicada.
    //   lanceiro > cavaleiro > arqueiro > lanceiro
    // COMBATE v3 (7.3.2): o counter MODULA, nao decide. Baixado 1.5 -> 1.25: com
    // 1.5 um cavaleiro (atq 4) ainda perdia p/ um lanceiro no castelo (2x1.5x1.5=
    // 4.5); com 1.25 ganha a justa (4 vs 3.75). O requisito do Lucas so se cumpre
    // baixando o counter.
    bonus_forca_triangulo: 1.25,
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
      endurecimento: 1, endurecimento_intervalo: 5, teto_tropas: 300,
      // GRADIENTE DE GUARNICAO POR DISTANCIA (proposta 23/07): trava a corrida
      // por aldeias barbaras no inicio. Neutra perto de um rei nasce fraca (1);
      // no miolo nasce forte (3). Medida: distancia ao rei MAIS PROXIMO,
      // normalizada pela METADE da separacao entre os reis -> 0 (no rei) a
      // ~1 (centro). SIMETRICO por construcao (layout v2 espelhado): o par
      // recebe a MESMA guarnicao, entao e fair. So muda a QUANTIDADE — o tipo
      // e a posicao das neutras seguem byte-identicos (o rng e consumido igual).
      //   ativo: false => usa forca_min/forca_max (comportamento antigo).
      //   faixas: primeira cujo `ate` (fracao) >= frac define as tropas.
      guarnicao_gradiente: {
        ativo: true,
        faixas: [
          { ate: 0.47, tropas: 1 }, // perto da base
          { ate: 0.80, tropas: 2 }, // media distancia
          { ate: 999,  tropas: 3 }, // miolo (pega o resto)
        ],
      },
    },

    // TEATRO: regiao contida do mapa 200x200 onde rola a partida.
    // n_aldeias = total (2 reis + neutras). Reis comecam em lados opostos.
    // ESCALA DE TESTE DO 1o REI (V1): 20 aldeias (18 neutras + 2 reis) para o
    // relatorio caber num modelo pequeno. O jogo "de verdade" e ~50; reversivel.
    teatro: { x0: 80, y0: 80, w: 40, h: 40, n_aldeias: 20, min_dist: 3 },

    // MUNDO v2 (17/07): layout espelhado p/ fairness de benchmark.
    // "v1" reproduz os numeros antigos; "v2" e o padrao daqui em diante.
    // "iberia" (02/08): mapa AUTORAL, 24 cidades reais e 41 estradas escritas
    // a mao, com custo de marcha em turnos. Substitui o v2 procedural.
    // ZERA a comparabilidade com o historico: partidas do v2 viram historia,
    // nao baseline. O ELO comeca do zero neste mapa (decisao do Lucas).
    layout: "iberia",
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
    // LOTE B: flag UNICA do prompt P3 (default LIGADO apos merge). false reproduz o
    // P2 byte-a-byte (o lote de logs de controlo). Liga/desliga B1+B2+B3 JUNTOS.
    promptP3: true,

    // ORDENACAO DAS ALDEIAS no relatorio (7.5.3). 'id' = como sempre (por id);
    // 'custo' = por custo de marcha desde a capital (simetrico, tira o vies de
    // posicao Oeste/Este). FLAG DESLIGADA de proposito: fica 'id' para o proximo
    // lote de llama3 servir de CONTROLO do teste de ordenacao (3 partidas, nao 6).
    ordemAldeias: "id",

    // CLAMP DE ENVIOS (Fase 3, 04/08): quando o modelo pede mais tropas do que
    // tem numa aldeia, o motor ENVIA O QUE HA (clampeado ao estoque, por tipo)
    // em vez de recusar o turno inteiro. O corte vai como AVISO no relatorio
    // seguinte (canal avisosAnteriores), nunca como rejeicao silenciosa.
    // Envio que zera apos o ajuste continua RECUSADO ("zero tropas apos ajuste").
    // Construcao NAO e clampada. false = comportamento antigo (rejeita). O flag
    // fica para se poder correr o braco de controlo (clamp desligado).
    clamp_envios: true,

    // Guarda de seguranca do loop (NAO e regra do jogo): teto de turnos
    // para a simulacao nunca rodar para sempre. Partida real deve acabar antes.
    max_turnos: 500,
  };

  // RULESET V4 (16/08/2026): reboot deliberado de balanceamento a partir da
  // analise da partida qwen3-235b x deepseek-r1 (15/08). NAO e byte-identico ao
  // CONFIG — de proposito (o Lucas aprovou fechar a comparabilidade). O CONFIG
  // (regras congeladas) continua o default; o v4 e opt-in (runner: passe-o como
  // config; browser: toggle "regras v4"). Muda 6 coisas, todas lidas do config:
  //   1. madeira 10->15  (afrouxa o gargalo; risco Fase 4 coberto pelo counter)
  //   2. cavaleiro def 1->2 e turnos 2->1 (deixa de ser vidro; sai em 1 turno;
  //      vira o SUMIDOURO de ferro que faltava)
  //   3. counter 1.25->1.5 (revive o triangulo; pune QUALQUER monocultura).
  //      CUSTO CONHECIDO: 1 cavaleiro deixa de tomar 1 lanceiro NO CASTELO
  //      (2*1.5castelo*1.5counter=4.5 > atq 4). Coerente e reversivel.
  //   4. escalaMarcha 0.3 (centro do mapa 9->3 turnos, corte UNIFORME; nao toca
  //      world-iberia.js nem verificarEquilibrio()). Comecou em 2/3 (16/08) e
  //      desceu para 0.3 no mesmo dia: com 2/3 o primeiro combate REI-x-REI so
  //      chegava no turno ~36 (mediana, burro x burro, 12 seeds) e a partida
  //      arrastava-se ate 68; a 0.3 o duelo cai para ~22 e a cauda de 127 para
  //      81 turnos. O que encarece o benchmark e a QUANTIDADE de turnos, e o
  //      dado que falta e o duelo entre modelos — nao a expansao contra neutras.
  //   5-6. VITORIA por dominancia: >=75% das aldeias por 2 turnos consecutivos
  //      (alem da eliminacao). Faz a partida TERMINAR com vencedor.
  // ==========================================================
  //  CONFIG — O RULESET DO JOGO. Unico. Sem toggle, sem opt-in.
  // ----------------------------------------------------------
  //  Foi o "reboot v4" enquanto era opcional; desde 17/08 e simplesmente o
  //  jogo. Derivado do arquivo v3 acima para o diff continuar legivel: cada
  //  linha abaixo e uma decisao de balanceamento, com o porque ao lado.
  // ==========================================================
  const CONFIG = (function () {
    const c = JSON.parse(JSON.stringify(CONFIG_V3_ARQUIVO)); // sem funcoes: seguro
    c.producao.madeira = 30;
    // FERRO 6 -> 20 (16/08, v5). A madeira sozinha nao resolvia: com ferro 6 o
    // arqueiro fica preso em 0.60 e o cavaleiro em 0.20 unidade por aldeia por
    // turno (5 turnos por cavaleiro!) por mais madeira que se ponha. Subir so a
    // madeira dobrava APENAS o lanceiro (1.00 -> 2.00) e empurrava direto para
    // a lanceiro-mono — o modo de falha que o Gemini ja mostrou no smoke.
    // Com ferro 20: arqueiro 1.50, cavaleiro 0.67. E a primeira vez que o
    // cavaleiro do v4 (def 2, 1 turno, counter 1.5) e comprável de facto.
    c.producao.ferro = 20;
    c.tropas.cavaleiro.def = 2;
    c.tropas.cavaleiro.turnos = 1;
    c.bonus_forca_triangulo = 1.5;
    c.escalaMarcha = 0.2;
    c.dicaNeutras = false;
    c.vitoriaPorDominancia = true;
    c.vitoriaFracao = 0.75;
    c.vitoriaTurnos = 2;
    // PROMPT P4 (17/08, sessao Fable): prompt em INGLES, sem exemplo com valores
    // (esquema declarado), sem "para tomar" (o minimo pre-calculado saiu do jogo
    // a pedido do Lucas: o prompt informa, nao recomenda), com a condicao de
    // vitoria REAL (dominancia 75%/2t), com a simultaneidade dita, e com o
    // reforco a aldeia propria dito como MECANICA (a instrucao antiga proibia
    // no texto o que o motor sempre aceitou — o Nemotron obedeceu e perdeu).
    // LEITURA `=== true` (deliberada, diferente das flags de lote `!== false`):
    // os estados congelados do test_lote_c usam CONFIG_V3_ARQUIVO, que nao tem
    // esta chave — com `!== false` eles virariam ingles e a regressao byte-
    // identica morreria. O ruleset vivo poe `true` aqui, e test_prompt_p4
    // tranca que isto esta ligado no jogo real (mesma protecao do bug do toggle).
    c.promptP4 = true;
    // FOG OF WAR (17/08, sessao Fable): o Rei ve as SUAS aldeias, as vizinhas
    // diretas na rede e o destino dos seus exercitos em marcha. O resto e
    // memoria ("last seen") guardada NO MOTOR (estado.visto) — o modelo e
    // stateless, a memoria tem de ser do motor (mesma familia do histDefesa).
    // A topologia (REDE DE ESTRADAS) continua publica: mapa e conhecimento de
    // qualquer rei; o fog esconde dono/guarnicao/defesa de quem esta longe.
    // O fog e do RELATORIO (o que o Rei LE): o motor continua onisciente, o
    // espectador ve tudo, o jogadorBurro (ancora deterministica) ve tudo.
    c.fogOfWar = true;
    return c;
  })();

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
    const layout = config.layout || "v1";
    if (layout === "iberia") return gerarTeatroIberia(config);
    if (layout === "v2") return gerarTeatroV2(config);
    return gerarTeatroV1(config);
  }

  // ===== MUNDO IBERIA (02/08) — mapa AUTORAL, nao procedural =====
  // Diferenca de especie em relacao ao v1/v2: as 24 cidades e as 41 estradas
  // sao ESCRITAS A MAO em world-iberia.js, e o custo de cada estrada ja vem
  // em TURNOS (com o multiplicador de terreno embutido). Aqui nao se sorteia
  // posicao nem se deriva rede: le-se o arquivo.
  //
  // O equilibrio do mapa vive nos custos, NAO nos pixels — em linha reta o
  // mapa nao e espelhado (19 das 24 cidades quebram o espelho euclidiano por
  // mais de 30px). Por isso a marcha tem de sair de `rota()`, nunca de
  // Math.hypot. Ver pesoTrecho()/turnosViagem().
  //
  // ids: indice no array CIDADES (0..23) — o motor inteiro usa id numerico.
  // O id textual do arquivo ('lisboa') fica em `slug`, para casar com as
  // estradas e com o world-iberia.
  function gerarTeatroIberia(config) {
    const rng = criarRng(config.seed);
    const idPorSlug = {};
    Iberia.CIDADES.forEach((c, i) => { idPorSlug[c.id] = i; });

    // separacao das capitais em custo de marcha: base do gradiente de guarnicao
    const custoEntreCapitais = Iberia.rota(
      Iberia.MAPA.capitais.oeste, Iberia.MAPA.capitais.este).custo;

    const aldeias = Iberia.CIDADES.map((c, i) => {
      const dono = c.dono === "oeste" ? "A" : c.dono === "este" ? "B" : null;
      const ald = criarAldeia(i, c.x, c.y, c.nome, dono);
      ald.slug = c.id;                     // ligacao com world-iberia
      ald.papel = c.papel;                 // anel1a, centro, capital...
      ald.tamanho = c.tamanho;             // usado pelo desenho (sprite)
      ald.sprite = c.sprite;
      ald.par = c.par;                     // gemea estrutural (espelho)
      if (c.papel === "capital") {
        ald.capital = true;
        const ti = (config.rei && config.rei.tropas_iniciais) || {};
        for (const tp of TIPOS) ald.tropas[tp] = ti[tp] || 0;
      }
      return ald;
    });

    // NEUTRAS: tipo e forca sorteados UMA vez por PAR e aplicados aos dois
    // lados — mesma regra de fairness do v2. Percorre so o Oeste e espelha
    // via `par`, entao o stream do rng nao depende da ordem do array.
    const pool = config.neutra.tipos_sorteaveis;
    for (const c of Iberia.CIDADES) {
      if (c.lado !== "O" || c.papel === "capital") continue;
      const tipo = pool[Math.floor(rng() * pool.length)];
      // rngInt SEMPRE consumido (estabilidade do stream), o gradiente so sobrepoe
      const nBase = rngInt(rng, config.neutra.forca_min, config.neutra.forca_max);
      const n = guarnicaoIberia(config, c, custoEntreCapitais, nBase);
      for (const id of [idPorSlug[c.id], idPorSlug[c.par]]) {
        const ald = aldeias[id];
        ald.tipo = tipo;
        ald.tropas[tipo] = n;
      }
    }

    return montarJogo(config, aldeias, estradasIberia(idPorSlug));
  }

  // Guarnicao da neutra pelo GRADIENTE, versao Iberia: a distancia usada e o
  // CUSTO DE MARCHA ate a capital mais proxima (custoLisboa/custoBarcelona do
  // arquivo), nao a linha reta. frac = 0 na capital, ~1 no meio do mapa.
  // Como custoLisboa/custoBarcelona sao espelhados entre `par`, as duas
  // cidades de um par recebem SEMPRE o mesmo frac -> mesma guarnicao.
  function guarnicaoIberia(config, cidade, custoEntreCapitais, fallback) {
    const g = config.neutra && config.neutra.guarnicao_gradiente;
    if (!g || !g.ativo || !(custoEntreCapitais > 0)) return fallback;
    const d = Math.min(cidade.custoLisboa, cidade.custoBarcelona);
    const frac = d / (custoEntreCapitais / 2);
    for (const f of g.faixas) if (frac <= f.ate) return f.tropas;
    return g.faixas[g.faixas.length - 1].tropas;
  }

  // Rede de estradas da Iberia: adjacencia + CUSTO AUTORAL por trecho.
  // Mesma forma do construirEstradas ({ adj }) mais o mapa `custo`, cuja
  // presenca e o que faz o motor marchar por custo em vez de por pixel.
  function estradasIberia(idPorSlug) {
    const adjSet = {}, custo = {};
    for (const s in idPorSlug) adjSet[idPorSlug[s]] = new Set();
    for (const e of Iberia.ESTRADAS) {
      const a = idPorSlug[e.de], b = idPorSlug[e.para];
      adjSet[a].add(b); adjSet[b].add(a);
      custo[chaveTrecho(a, b)] = e.custo;
    }
    const adj = {};
    for (const id in adjSet) adj[id] = [...adjSet[id]].sort((x, y) => x - y);
    return { adj, custo };
  }

  function chaveTrecho(a, b) { return Math.min(a, b) + "|" + Math.max(a, b); }

  // GUARNICAO INICIAL de uma neutra pelo GRADIENTE de distancia (v2).
  // frac = dist(neutra, rei mais proximo) / (separacao_reis / 2): 0 no rei,
  // ~1 no centro. Devolve as tropas da 1a faixa cujo `ate` >= frac. Gradiente
  // inativo (ou sem reis) -> devolve `fallback` (o sorteio forca_min/max).
  function guarnicaoNeutra(config, q, reiA, reiB, fallback) {
    const g = config.neutra && config.neutra.guarnicao_gradiente;
    if (!g || !g.ativo || !reiA || !reiB) return fallback;
    const distReis = Math.hypot(reiA.x - reiB.x, reiA.y - reiB.y);
    if (!(distReis > 0)) return fallback;
    const d = Math.min(
      Math.hypot(q.x - reiA.x, q.y - reiA.y),
      Math.hypot(q.x - reiB.x, q.y - reiB.y)
    );
    const frac = d / (distReis / 2);
    for (const f of g.faixas) if (frac <= f.ate) return f.tropas;
    return g.faixas[g.faixas.length - 1].tropas;
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
    const reiB = esp(reiA); // rei espelhado (posicao) — usado pelo gradiente
    function parNeutra(p) {
      // tipo e forca sorteados UMA vez e aplicados aos DOIS lados (fairness)
      const pool = config.neutra.tipos_sorteaveis;
      const tipo = pool[Math.floor(rng() * pool.length)];
      // rngInt e SEMPRE consumido (mantem o stream do rng estavel: tipo e
      // posicao das neutras seguintes nao mudam). O gradiente so SOBREPOE o
      // valor. p e esp(p) sao equidistantes dos reis -> mesma guarnicao (fair).
      const nBase = rngInt(rng, config.neutra.forca_min, config.neutra.forca_max);
      const n = guarnicaoNeutra(config, p, reiA, reiB, nBase);
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
  // `estradas` pre-montadas (mapa autoral) tem precedencia; sem elas, a rede
  // e derivada das posicoes como sempre (v1/v2 procedurais).
  function montarJogo(config, aldeias, estradas) {
    return {
      config,
      turno: 0,
      aldeias,
      estradas: estradas || construirEstradas(aldeias,
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
      // RESUMOS DO REI (v5): `plano` e a nota que o Rei escreve para o seu
      // PROXIMO turno — a unica memoria deliberada que ele tem entre turnos.
      // O `depoimento` NAO mora aqui: e so para a tela/log, nunca volta ao
      // contexto, e por isso nao e estado de jogo.
      planosAnteriores: { A: null, B: null },
      // FOG OF WAR (P4): memoria de avistamentos POR REI. visto[dono][id] =
      // { turno, dono, tropas, capital } — a ultima fotografia que aquele Rei
      // teve daquela aldeia. Atualizada no tick (registrarAvistamentos). O
      // modelo e stateless: se a memoria nao morar no motor, nao existe.
      visto: { A: {}, B: {} },
    };
  }

  // ---- FOG OF WAR (P4): visibilidade e memoria de avistamentos ----
  // Regra de visibilidade (deliberadamente simples e deterministica):
  //   1. aldeias do proprio Rei;
  //   2. vizinhas DIRETAS das suas na rede de estradas (posto de vigia);
  //   3. o DESTINO efetivo de cada exercito seu em marcha (batedores do
  //      exercito reportam o alvo desde que a coluna parte).
  // A topologia inteira e sempre publica — o fog esconde ESTADO (dono,
  // guarnicao), nunca GEOGRAFIA.
  function visiveisPara(estado, dono) {
    const vis = new Set();
    for (const a of estado.aldeias) if (a.dono === dono) vis.add(a.id);
    if (estado.estradas && estado.estradas.adj) {
      for (const a of estado.aldeias) {
        if (a.dono !== dono) continue;
        for (const v of (estado.estradas.adj[a.id] || [])) vis.add(v);
      }
    }
    for (const m of estado.movimentos) {
      if (m.dono !== dono) continue;
      vis.add(m.destinoId);
      if (m.caminho && m.caminho.length) vis.add(m.caminho[m.caminho.length - 1]);
    }
    return vis;
  }

  // Grava, para cada Rei, a fotografia das aldeias que ele VE neste turno.
  // Chamada no fim do tick (combates ja resolvidos): o que se ve e o estado
  // real do fim do turno, o mesmo que o relatorio mostra.
  function registrarAvistamentos(estado) {
    if (estado.config.fogOfWar !== true) return;
    estado.visto = estado.visto || { A: {}, B: {} };
    for (const dono of ["A", "B"]) {
      const vis = visiveisPara(estado, dono);
      const mem = (estado.visto[dono] = estado.visto[dono] || {});
      for (const a of estado.aldeias) {
        if (!vis.has(a.id)) continue;
        mem[a.id] = {
          turno: estado.turno,
          dono: a.dono,
          tropas: { lanceiro: a.tropas.lanceiro, arqueiro: a.tropas.arqueiro, cavaleiro: a.tropas.cavaleiro },
          capital: !!a.capital,
        };
      }
    }
  }

  // estado inicial completo da partida
  function criarEstadoInicial(config) {
    // COPIA PROFUNDA (17/08). Antes o estado guardava a config POR REFERENCIA:
    // `criarEstadoInicial(Engine.CONFIG)` devolvia uma partida cujo `config` ERA
    // o objeto global. Bastava alguem escrever em `estado.config.producao.x`
    // para o ruleset mudar para todas as partidas seguintes da mesma pagina —
    // um estado de jogo a reescrever as regras do jogo.
    // Nao mordeu ainda, mas e a mesma familia do bug do checkbox: uma via pela
    // qual a partida pode acabar a correr com regras que ninguem escolheu.
    // O CONFIG nao tem funcoes (ja assumido em varios sitios), entao o clone
    // por JSON e seguro e custa uma vez por partida.
    return gerarTeatro(JSON.parse(JSON.stringify(config || CONFIG)));
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
    // TETO DE PRODUCAO: aldeia que ja atingiu o limite de TROPAS para de
    // fabricar (segue com recurso, e pode receber reforco/conquista acima dele).
    const limite = estado.config.limite_tropas_aldeia;
    if (limite != null && tropasComprometidas(estado, a) >= limite) return false;
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
  //     sua CONTAGEM de tropas esta abaixo de `teto_tropas`.
  function endurecer(estado) {
    const n = estado.config.neutra;
    const intervalo = n.endurecimento_intervalo || 1;
    if (estado.turno % intervalo !== 0) return;     // ainda nao e turno de endurecer
    const inc = n.endurecimento;
    const teto = n.teto_tropas;
    for (const a of estado.aldeias) {
      if (a.dono !== null || !a.tipo) continue;
      if (teto != null && contarTropas(a.tropas) >= teto) continue; // no teto: para
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
  // P4: sinonimos INGLESES aceites como variacao trivial (o prompt e em ingles;
  // os tokens canonicos do protocolo continuam PT \u2014 lanceiro/arqueiro/cavaleiro \u2014
  // mas um modelo que escreva o nome ingles nao pode perder a jogada por isso).
  // Cada correcao continua a virar linha em `normalizacoes` (H3: mede-se o desvio).
  const TIPO_EN = {
    spearman: "lanceiro", spearmen: "lanceiro", lancer: "lanceiro", pikeman: "lanceiro", pikemen: "lanceiro",
    archer: "arqueiro", archers: "arqueiro", bowman: "arqueiro", bowmen: "arqueiro",
    knight: "cavaleiro", knights: "cavaleiro", cavalry: "cavaleiro", horseman: "cavaleiro", horsemen: "cavaleiro",
  };
  function normalizarTipo(t) {
    if (typeof t !== "string") return t;
    let s = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    if (TIPOS.indexOf(s) >= 0) return s;
    if (s.endsWith("s") && TIPOS.indexOf(s.slice(0, -1)) >= 0) return s.slice(0, -1);
    if (TIPO_EN[s]) return TIPO_EN[s];
    return t; // fora do escopo: devolve o cru
  }

  // ---- Ataque, Defesa, Contagem (COMBATE v3, 7.4) ----
  // TRES funcoes explicitas, nunca intercambiaveis (armadilha 7.4-A):
  //   ataqueDe  -> soma dos `atq` (so o EXERCITO ATACANTE usa)
  //   defesaDe  -> soma dos `def` (so o DEFENSOR usa)
  //   contarTropas -> soma das UNIDADES (tetos, placar, desfecho: TAMANHO, nao poder)
  function ataqueDe(tropas, config) {
    let f = 0;
    for (const t of TIPOS) f += (tropas[t] || 0) * config.tropas[t].atq;
    return f;
  }
  function defesaDe(tropas, config) {
    let f = 0;
    for (const t of TIPOS) f += (tropas[t] || 0) * config.tropas[t].def;
    return f;
  }
  function contarTropas(tropas) {
    let n = 0;
    for (const t of TIPOS) n += (tropas[t] || 0);
    return n;
  }
  // Forca DEFENSIVA da aldeia (reis E neutras usam tropas tipadas). So `def`.
  function forcaDefesa(estado, aldeia) {
    return defesaDe(aldeia.tropas, estado.config);
  }
  // LOTE D, D4: defesa EFETIVA = defesa crua x bonus do terreno. MESMA conta que o
  // `defefetiva` do relatorio (defesaDe x terreno) — extraida p/ o historico D4 usar a
  // mesma implementacao (invariante i: uma regra, uma conta).
  function defesaEfetivaDe(tropas, capital, cfg) {
    const bonus = capital ? cfg.combate.bonus_defesa_castelo : cfg.combate.bonus_defesa_aldeia;
    return Math.round(defesaDe(tropas, cfg) * bonus);
  }
  // Tropas COMPROMETIDAS da aldeia = em casa + a fila de construcao. E o que o
  // teto de producao (limite_tropas_aldeia) mede: CONTAGEM, nao poder. Contar a
  // fila impede furar o teto enfileirando varias tropas num turno so.
  function tropasComprometidas(estado, aldeia) {
    let n = contarTropas(aldeia.tropas);
    n += aldeia.construindo.length;
    return n;
  }
  // Tipo DOMINANTE (matchup do triangulo) = O MAIS NUMEROSO (7.4-B), com
  // desempate fixo na ordem lanceiro, arqueiro, cavaleiro. NAO por poder: com
  // atq/def distintos, um cavaleiro (atq 4) definiria o matchup de 3 lanceiros.
  // Vale para atacante E defensor. null se sem tropas.
  function tipoDominante(estado, tropas) {
    let best = null, bn = 0;
    for (const t of TIPOS) { // TIPOS ja esta na ordem de desempate
      const n = tropas[t] || 0;
      if (n > bn) { bn = n; best = t; }
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
    const Fatk = ataqueDe(tropasAtk, cfg), Fdef = defesaDe(alvo.tropas, cfg);
    const atkType = tipoDominante(estado, tropasAtk);
    const defType = alvo.dono === null ? alvo.tipo : tipoDominante(estado, alvo.tropas);
    return Object.assign({ Fatk, Fdef, atkType, defType },
      preverCombateTipos(estado, Fatk, atkType, Fdef, defType, bonusDefesa(estado, alvo)));
  }

  // Menor numero de tropas do tipo `atkType` que CONQUISTA `alvo`.
  // Usa preverCombateTipos — a MESMA conta do combate, impossivel divergir.
  // null se nem 99 tropas bastam.
  function minimoParaTomar(estado, atkType, alvo) {
    const Fdef = forcaDefesa(estado, alvo);
    const defType = alvo.dono === null ? alvo.tipo : tipoDominante(estado, alvo.tropas);
    const dB = bonusDefesa(estado, alvo);
    const atq = estado.config.tropas[atkType].atq; // v3: n tropas -> ataque = n*atq
    for (let n = 1; n <= 99; n++) {
      const r = preverCombateTipos(estado, n * atq, atkType, Fdef, defType, dB);
      if (r.atacanteVence) return n;
    }
    return null;
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
    const Fatk = ataqueDe(exercito.tropas, cfg); // ATACANTE usa atq
    const Fdef = forcaDefesa(estado, alvo);      // DEFENSOR usa def
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
      rep.sobreviventesForca = contarTropas(alvo.tropas); // contagem de sobreviventes (nao poder)
    } else {
      // defensor segura (rei ou neutra); atacante eliminado; defensor sofre baixas
      aplicarBaixas(estado, alvo.tropas, fracao);
      rep.sobreviventesForca = contarTropas(alvo.tropas);
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

  // ---- PESO DE TRECHO: a unica coisa que o motor conta para medir marcha ----
  // Mapa AUTORAL (Iberia): peso = custo em turnos escrito no arquivo, que ja
  // embute o terreno. Mapa PROCEDURAL (v1/v2): peso = distancia em pixels,
  // como sempre foi. A presenca de `estradas.custo` decide.
  //
  // Por que nao usar pixel no mapa autoral: a razao (dist/pxPorTurno)/custo
  // varia de 0.57 a 1.94 entre as 41 estradas — medir por pixel erraria ate
  // 3.4x de uma estrada para outra e destruiria o espelhamento do mapa.
  function temCustoAutoral(estado) {
    return !!(estado.estradas && estado.estradas.custo);
  }
  function pesoTrecho(estado, aId, bId) {
    if (temCustoAutoral(estado)) {
      const c = estado.estradas.custo[chaveTrecho(aId, bId)];
      if (c != null) return c;
      // trecho fora da rede (estado sintetico / marcha em reta): converte a
      // linha reta para turnos pela escala do mapa, para ficar na mesma unidade
      const a = aldeiaPorId(estado, aId), b = aldeiaPorId(estado, bId);
      if (a && b) return distancia(a, b) / (Iberia.MAPA.pxPorTurno || 1);
      return 0;
    }
    const a = aldeiaPorId(estado, aId), b = aldeiaPorId(estado, bId);
    return (a && b) ? distancia(a, b) : 0;
  }
  function pesoRota(estado, caminho) {
    let p = 0;
    for (let i = 0; i + 1 < caminho.length; i++) p += pesoTrecho(estado, caminho[i], caminho[i + 1]);
    return p;
  }

  // TURNOS de marcha de um caminho.
  // Mapa autoral: turnos = custo_da_rota * (passoRef / passoDaTropa). A escala
  // por tropa e UNIFORME, entao (a) cavaleiro segue chegando antes de lanceiro
  // e (b) o espelho do mapa sobrevive — os dois lados escalam pelo mesmo fator,
  // e o caminho mais curto e o mesmo para toda tropa.
  // Mapa procedural: comportamento antigo, distancia / passo.
  function turnosDeCaminho(estado, caminho, tropas) {
    if (!temCustoAutoral(estado)) return turnosPorDist(estado, distanciaRota(estado, caminho), tropas);
    const cfg = estado.config;
    const ref = (cfg.relatorio && cfg.relatorio.velocidade_referencia) || "media";
    const passoRef = cfg.velocidade_passo[ref];
    const passoTropa = cfg.velocidade_passo[velExercito(estado, tropas)];
    // escalaMarcha (v4): encurta TODAS as rotas pelo mesmo fator. Ausente/1 =
    // comportamento antigo byte-identico. Aplicado ao peso, ANTES do ceil, para
    // o corte ser uniforme e o espelho do mapa sobreviver (os dois lados escalam
    // igual). NAO toca world-iberia.js.
    const escala = cfg.escalaMarcha || 1;
    return Math.max(1, Math.ceil(pesoRota(estado, caminho) * escala * (passoRef / passoTropa)));
  }
  // LINHA RETA entre dois pontos, ignorando a rede. NAO e o tempo de marcha
  // real — quem manda na marcha e turnosDeCaminho(), pela rota. Fica como
  // referencia/diagnostico (e e o que os testes de peca 3 e 6 medem).
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
        // peso do trecho: custo autoral no mapa da Iberia, pixel no procedural
        const w = est.custo ? est.custo[chaveTrecho(u, v)]
                            : Math.hypot(pos[u].x - pos[v].x, pos[u].y - pos[v].y);
        const nd = dist[u] + (w != null ? w : Math.hypot(pos[u].x - pos[v].x, pos[u].y - pos[v].y));
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
    const turnos = turnosDeCaminho(estado, caminho, carga);
    // destinoPedido preserva o alvo PEDIDO (destinoId original): destinoReal pode
    // diferir quando a marcha para na 1a aldeia nao-sua do caminho (L2: o relatorio
    // avisa o modelo do redirecionamento). Nao e rejeicao — a ordem FOI executada.
    const mov = { dono: o.dono, origemId, destinoId: destinoReal, destinoPedido: destinoId, tropas: carga, caminho,
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
    // Progresso medido no MESMO peso que define os turnos (custo autoral na
    // Iberia, pixel no procedural). Se andasse por pixel enquanto o tempo corre
    // por custo, o exercito atravessaria a serra rapido demais na tela — e o
    // combate de estrada, que le esta posicao, decidiria encontro errado.
    const total = pesoRota(estado, cam);
    const frac = mov.turnosTotal ? (mov.turnosTotal - mov.turnosRestantes) / mov.turnosTotal : 1;
    let alvo = Math.max(0, frac) * total;
    for (let i = 0; i + 1 < cam.length; i++) {
      const a = aldeiaPorId(estado, cam[i]), b = aldeiaPorId(estado, cam[i + 1]);
      const seg = pesoTrecho(estado, cam[i], cam[i + 1]);
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
    let atk = m1.dono < m2.dono ? m1 : m2;
    let def = atk === m1 ? m2 : m1;
    // Choque de dois EXERCITOS em marcha (campo aberto): ninguem guarnece
    // terreno, entao os DOIS lados usam ATAQUE (nao def). Decisao 7.4.
    const prever = (a, d) => {
      const Fa = ataqueDe(a.tropas, cfg), Fd = ataqueDe(d.tropas, cfg);
      const ta = tipoDominante(estado, a.tropas), td = tipoDominante(estado, d.tropas);
      return Object.assign({ Fa, Fd }, preverCombateTipos(estado, Fa, ta, Fd, td, 1)); // campo aberto
    };
    let prev = prever(atk, def);
    // LOTE E, E4 (achado A4): no EMPATE de forca efetiva o lado no papel de
    // "atacante" PERDE (empate favorece o defensor). Fixar atk = dono "A" matava o
    // exercito de A em TODO empate de estrada — vies de assento, a mesma classe do
    // vies de id que o chaveRngAlvo ja resolveu para os alvos. Sorteia o papel por
    // hash puro e determinista (sem lado). O empate e simetrico a troca (a forca
    // efetiva do vencedor e a mesma dos dois jeitos), entao so muda QUEM sobrevive;
    // fora do empate, o desfecho nao depende da ordem dos argumentos.
    if (cfg.desempateEstradaRng !== false && prev.FatkEf === prev.FdefEf) {
      const lo = Math.min(m1.origemId, m2.origemId), hi = Math.max(m1.origemId, m2.origemId);
      if (chaveRngAlvo(cfg.seed, estado.turno, lo, hi) < 0.5) { const t = atk; atk = def; def = t; prev = prever(atk, def); }
    }
    const { v, FatkEf, FdefEf, atacanteVence, Fa, Fd } = prev;
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
    if (estado.config.interceptaChegada === false) {
      // caminho antigo (separa primeiro, so `viajando` intercepta), byte a byte.
      const chegaram = [], viajando = [];
      for (const m of estado.movimentos) {
        m.turnosRestantes -= 1;
        (m.turnosRestantes <= 0 ? chegaram : viajando).push(m);
      }
      // #2: quem segue viajando pode se cruzar com inimigo no mesmo trecho
      estado.movimentos = detectarCombatesEstrada(estado, viajando);
      for (const m of chegaram) resolverChegada(estado, m);
      return;
    }
    // LOTE E, E3 (achado A3): um exercito no ULTIMO passo de marcha tambem cruza
    // inimigos no mesmo trecho. No caminho antigo ele ia direto para `chegaram`
    // (que nao passa pelo detectarCombatesEstrada) e atravessava o inimigo sem
    // lutar. Aqui detecta os cruzamentos sobre a lista INTEIRA (posicaoRota clampa
    // o progresso ao fim da rota, mesmo com turnosRestantes negativo) e so entao
    // separa quem chegou de quem segue.
    for (const m of estado.movimentos) m.turnosRestantes -= 1;
    const sobreviventes = detectarCombatesEstrada(estado, estado.movimentos);
    const chegaram = [], viajando = [];
    for (const m of sobreviventes) (m.turnosRestantes <= 0 ? chegaram : viajando).push(m);
    estado.movimentos = viajando;
    for (const m of chegaram) resolverChegada(estado, m);
  }

  // TICK: avanca um turno seguindo a ORDEM da spec.
  function tick(estado) {
    estado.turno += 1;
    produzir(estado);            // 1
    avancarConstrucao(estado);   // 2
    avancarMovimentos(estado);   // 3 MOVIMENTO + 4 COMBATE
    endurecer(estado);           // 5
    // LOTE D, D4: no FIM do tick (producao + combates ja resolvidos), grava a defesa
    // efetiva de TODAS as aldeias (sem nevoa de guerra). Janela curta de 6 -> o relatorio
    // mostra a DERIVADA observada, nao uma projecao (projecao = mais um numero em que o
    // modelo confia cego, o erro que o 'para tomar' ja causou).
    if (estado.config.deltaDefesa !== false) {
      estado.histDefesa = estado.histDefesa || {};
      for (const a of estado.aldeias) {
        const h = (estado.histDefesa[a.id] = estado.histDefesa[a.id] || []);
        h.push({ turno: estado.turno, defEf: defesaEfetivaDe(a.tropas, !!a.capital, estado.config) });
        if (h.length > 6) h.shift();
      }
    }
    // VITORIA POR DOMINANCIA (v4): conta turnos CONSECUTIVOS com >=fracao das
    // aldeias. Fica no TICK (roda 1x/turno) e NAO na checarVitoria — esta e
    // pura e o browser a chama varias vezes por turno; contar la contaria
    // dobrado. checarVitoria so LE estado.dominancia.
    if (estado.config.vitoriaPorDominancia) {
      const alvo = Math.ceil(estado.aldeias.length * (estado.config.vitoriaFracao || 0.75));
      estado.dominancia = estado.dominancia || { A: 0, B: 0 };
      for (const d of ["A", "B"]) {
        estado.dominancia[d] = aldeiasDe(estado, d).length >= alvo ? estado.dominancia[d] + 1 : 0;
      }
    }
    // FOG OF WAR (P4): registra o que cada Rei VE no fim deste turno. Fica no
    // tick pelo mesmo motivo da dominancia: roda exatamente 1x por turno.
    registrarAvistamentos(estado);
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

  // COMPAT (7.4): forcaDe/forcaTropas eram "soma da forca", e forca era 1 p/
  // todos -> sempre foram CONTAGEM DE TROPAS na pratica. Viram aliases de
  // contarTropas para nao partir placar/desfecho/UI/runners que os chamavam com
  // esse sentido. O COMBATE nao os usa: usa ataqueDe/defesaDe explicitos.
  function forcaDe(tropas /*, config */) { return contarTropas(tropas); }
  function forcaTropas(estado, tropas) { return contarTropas(tropas); }

  // VISAO: relatorio (somente leitura) do que aquele jogador conhece.
  // SEM fog of war: tropas reais dos alvos e transito de todos sao visiveis.
  function montarVisao(estado, dono, opcoes) {
    const copiaTropas = (t) => ({ lanceiro: t.lanceiro, arqueiro: t.arqueiro, cavaleiro: t.cavaleiro });
    // HOOK atras de flag: so com opcoes.minimos === true a visao ganha
    // `capital` e `minimos` por alvo. SEM a flag, o objeto e byte-identico
    // ao de sempre (todo o benchmark anterior continua comparavel).
    const comMinimos = !!(opcoes && opcoes.minimos === true);
    // FOG OF WAR (P4): a visao continua a carregar TODOS os alvos (o motor e
    // onisciente; burro e espectador dependem disso), mas cada alvo ganha
    // `visivel` e `visto` (ultima fotografia). Quem esconde e o RELATORIO P4.
    const fog = estado.config.fogOfWar === true;
    const visSet = fog ? visiveisPara(estado, dono) : null;
    const memVisto = fog ? ((estado.visto && estado.visto[dono]) || {}) : null;
    return {
      dono,
      turno: estado.turno,
      config: estado.config,
      minhas: aldeiasDe(estado, dono).map((a) => ({
        id: a.id, x: a.x, y: a.y, nome: a.nome, capital: !!a.capital,
        recursos: { madeira: a.recursos.madeira, ferro: a.recursos.ferro },
        tropas: copiaTropas(a.tropas),
        construindo: a.construindo.map((c) => ({ tipo: c.tipo, turnosRestantes: c.turnosRestantes })),
      })),
      alvos: estado.aldeias.filter((a) => a.dono !== dono).map((a) => {
        const alvo = {
          id: a.id, x: a.x, y: a.y, dono: a.dono, tipo: a.tipo, capital: !!a.capital,
          tropas: copiaTropas(a.tropas),
          forcaDefesa: forcaDefesa(estado, a), // usado pelo jogador burro
        };
        // P4 (incoerencia 12): nome em TODAS as aldeias, nao so nas suas.
        // ATRAS DA FLAG, e nao solto: o relatorio LEGADO ja lia `a.nome` no bloco
        // REDE DE ESTRADAS (era undefined nos alvos, logo omitido). Popular o
        // campo sem gatilho fez a rede legada passar a nomear aldeias inimigas
        // — +179 chars num renderizador cuja funcao e reproduzir byte a byte os
        // logs antigos. Mesmo padrao do `minimos`: campo novo so existe quando o
        // renderizador que o pediu esta ligado.
        if (estado.config.promptP4 === true) alvo.nome = a.nome;
        if (comMinimos) {
          alvo.minimos = {
            lanceiro:  minimoParaTomar(estado, "lanceiro",  a),
            arqueiro:  minimoParaTomar(estado, "arqueiro",  a),
            cavaleiro: minimoParaTomar(estado, "cavaleiro", a),
          };
        }
        // LOTE D, D4: entrada de defesa mais ANTIGA na janela com turno <= atual-2.
        if (estado.config.deltaDefesa !== false && estado.histDefesa && estado.histDefesa[a.id]) {
          const janela = estado.histDefesa[a.id].filter((e) => e.turno <= estado.turno - 2);
          if (janela.length) alvo.defAntes = { defEf: janela[0].defEf, turno: janela[0].turno };
        }
        // LOTE D, D5: minhas tentativas de ataque a este alvo nos ultimos 8 turnos.
        // Nao cria estrutura nova — le estado.log (eventos de combate ja tem tudo).
        if (estado.config.memoriaAlvo !== false && estado.log) {
          const ats = estado.log.filter((ev) => ev.tipo === "combate" && ev.alvoId === a.id && ev.atacante === dono && ev.turno > estado.turno - 8);
          if (ats.length) alvo.tentativas = { n: ats.length, conquistas: ats.filter((ev) => ev.conquista).length, janela: 8 };
        }
        // FOG OF WAR (P4): anotacao de visibilidade + ultima fotografia vista.
        if (fog) {
          alvo.visivel = visSet.has(a.id);
          alvo.visto = memVisto[a.id] || null;
        }
        return alvo;
      }),
      // FOG OF WAR (P4): true quando o relatorio deve esconder o que o Rei nao ve.
      fog,
      // REDE DE ESTRADAS (grafo fixo da partida): so leitura, p/ o relatorio
      // mostrar a topologia ao modelo. null em estados sinteticos sem rede.
      estradas: (estado.estradas && estado.estradas.adj) || null,
      // custo autoral por trecho (mapa da Iberia). Vai junto para o relatorio
      // poder medir a marcha do MESMO jeito que o motor mede — sem isto o
      // relatorio volta a medir por pixel e a lacuna L3 reabre (foi o que o
      // Nemotron flagrou em 26/07, agora pelo mapa novo).
      estradasCusto: (estado.estradas && estado.estradas.custo) || null,
      // todos os exercitos em transito (meus e inimigos). destinoDono = dono atual do destino.
      // destinoPedido preserva a INTENCAO original (antes da interceptacao redirecionar).
      transito: estado.movimentos.map((m) => ({
        dono: m.dono, origemId: m.origemId, destinoId: m.destinoId, destinoPedido: m.destinoPedido,
        tropas: copiaTropas(m.tropas), turnosRestantes: m.turnosRestantes,
        destinoDono: (aldeiaPorId(estado, m.destinoId) || {}).dono,
      })),
      // o que aconteceu NESTE turno (combates/reforcos) — a memoria do Rei
      eventos: estado.log.filter((ev) => ev.turno === estado.turno),
      // ordens que o motor RECUSOU no turno anterior (memoria anti-loop)
      rejeicoesAnteriores: (estado.rejeicoesAnteriores && estado.rejeicoesAnteriores[dono]) || [],
      // ordens EXECUTADAS COM AJUSTE no turno anterior (modo clamp; vazio fora dele)
      avisosAnteriores: (estado.avisosAnteriores && estado.avisosAnteriores[dono]) || [],
      // v5: a nota que ESTE Rei escreveu para si no turno passado (null no turno 1)
      planoAnterior: (estado.planosAnteriores && estado.planosAnteriores[dono]) || null,
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
  // P4 (17/08): dispatch. Com config.promptP4 === true (o ruleset vivo), o
  // relatorio e o P4 em ingles com fog. opcoes.promptP4 === false forca o
  // legado (testes de regressao). O caminho legado abaixo esta INTOCADO.
  function relatorioTexto(visao, opcoes) {
    const usaP4 = (opcoes && opcoes.promptP4 != null) ? !!opcoes.promptP4 : (visao.config.promptP4 === true);
    if (usaP4) return relatorioTextoP4(visao, opcoes);
    return relatorioTextoLegado(visao, opcoes);
  }
  function relatorioTextoLegado(visao, opcoes) {
    const cfg = visao.config;
    const me = visao.dono;
    const inimigo = me === "A" ? "B" : "A";
    const semRejeicoes = !!(opcoes && opcoes.semRejeicoes); // H2: bloco vai p/ o fim do prompt
    const L = [];

    const passoRef = cfg.velocidade_passo[cfg.relatorio.velocidade_referencia];
    // L3 (26/07): a marcha mostrada usa a distancia PELA REDE DE ESTRADAS (a
    // mesma rota que o motor viaja em enviarExercito), nao a linha reta. Antes
    // era Math.hypot -> o numero divergia do que o motor praticava e o modelo
    // se confundia (o Nemotron flagrou "that seems off"). Reusa as funcoes do
    // motor (caminhoEntre + distanciaRota) via um shim SO-LEITURA montado da
    // visao: minhas+alvos trazem id/x/y e visao.estradas e o adj. Sem rede
    // (estados sinteticos), cai na linha reta de antes. passoRef inalterado:
    // o relatorio nao sabe a composicao do exercito, entao segue a velocidade
    // de referencia (mesma aproximacao de sempre) — a correcao e so a DISTANCIA.
    const temRede = !!visao.estradas;
    const shim = temRede ? { config: cfg, estradas: { adj: visao.estradas, custo: visao.estradasCusto || null },
                             aldeias: visao.minhas.concat(visao.alvos) } : null;
    // Turnos de marcha da MINHA aldeia mais proxima ate o alvo, POR ESTRADA.
    // Mapa autoral (Iberia): o peso da rota JA esta em turnos, e a velocidade
    // de referencia e o proprio divisor da formula (fator 1) -> ceil(custo).
    // Mapa procedural: peso em pixels -> ceil(pixels / passoRef), como antes.
    // Nos dois casos o numero mostrado e o que o motor pratica: mesma funcao
    // de peso, mesma rota. Se isto divergir, a lacuna L3 reabre.
    const porCusto = temRede && !!visao.estradasCusto;
    // ISOLACAO (LOTE B, passo 3): o tempo de marcha sai de turnosDeCaminho — a
    // MESMA funcao que o motor usa em enviarExercito. O relatorio NAO reimplementa
    // a conta (invariante i: uma regra, uma implementacao). marchaVel(alvo, tropaRep)
    // devolve os turnos para uma tropa de referencia (velExercito deriva a velocidade
    // da composicao). No mapa autoral (porCusto) rota pelo turnosDeCaminho; sem P3 a
    // tropaRep e a MEDIA (arqueiro) -> fator passoRef/passoRef=1 -> identico ao P2.
    const marchaVel = (alvo, tropaRep) => {
      let best = Infinity, bestCaminho = null;
      for (const m of visao.minhas) {
        let d, cam = null;
        if (temRede) {
          cam = caminhoEntre(shim, m.id, alvo.id);
          d = cam ? pesoRota(shim, cam) : Math.hypot(m.x - alvo.x, m.y - alvo.y);
        } else {
          d = Math.hypot(m.x - alvo.x, m.y - alvo.y);
        }
        if (d < best) { best = d; bestCaminho = cam; }
      }
      if (best === Infinity) return "?";
      if (porCusto && bestCaminho) return turnosDeCaminho(shim, bestCaminho, tropaRep);
      return Math.max(1, Math.ceil(porCusto ? best : best / passoRef));
    };
    const marcha = (alvo) => marchaVel(alvo, { arqueiro: 1 }); // media = comportamento P2
    // LOTE C, E5: a aldeia de origem do menor caminho (a mesma p/ as 3 velocidades,
    // porque a rota mais curta nao depende da composicao). marchaVel descartava qual era.
    const origemMaisProxima = (alvo) => {
      let best = Infinity, bestM = null;
      for (const m of visao.minhas) {
        let d;
        if (temRede) { const cam = caminhoEntre(shim, m.id, alvo.id); d = cam ? pesoRota(shim, cam) : Math.hypot(m.x - alvo.x, m.y - alvo.y); }
        else d = Math.hypot(m.x - alvo.x, m.y - alvo.y);
        if (d < best) { best = d; bestM = m; }
      }
      return bestM;
    };
    // LOTE B (prompt P3): rotula defesa efetiva (B1) e mostra marcha por velocidade (B3).
    // A ordenacao das aldeias segue por 'marcha' media (t), estavel; so o TEXTO muda.
    const p3 = (opcoes && opcoes.promptP3 != null) ? !!opcoes.promptP3 : (cfg.promptP3 !== false);
    const marchaComOrigem = (opcoes && opcoes.marchaComOrigem != null) ? !!opcoes.marchaComOrigem : (cfg.marchaComOrigem !== false); // LOTE C, E5
    const rotulosExpectativa = (opcoes && opcoes.rotulosExpectativa != null) ? !!opcoes.rotulosExpectativa : (cfg.rotulosExpectativa !== false); // LOTE C, E11
    const defLabel = (a) => p3 ? `defesa efetiva (inclui bonus do local): ${defefetiva(a)}` : `defesa: ${defefetiva(a)}`;
    const marchaTexto = (a) => {
      if (!p3) return `${marcha(a)} turnos de marcha`;
      const vs = `${marchaVel(a, { lanceiro: 1 })} lenta / ${marchaVel(a, { arqueiro: 1 })} media / ${marchaVel(a, { cavaleiro: 1 })} rapida`;
      if (!marchaComOrigem) return `marcha: ${vs}`; // E5 off = texto P3 identico ao atual
      const o = origemMaisProxima(a); // E5: nomeia de onde sai a marcha mais curta
      return `marcha desde ${o ? "[" + o.id + "]" + (o.nome ? " " + o.nome : "") : "?"}: ${vs}`;
    };
    const classifica = (dono) => (dono === me ? "SUA" : dono === null ? "NEUTRA" : "INIMIGA");

    // VARIANTE P2: sufixo " | para tomar: N lanc ou N arq ou N cav" — so quando
    // o alvo traz `minimos` (visao montada com {minimos:true}). Sem isso, "" —
    // P0/P1 ficam byte-identicos. Nao recomenda nada: so os tres numeros.
    const minTexto = (a) => {
      if (!a.minimos) return "";
      if (a.capital) return " | CAPITAL: maior bonus de defesa do jogo";
      const m = a.minimos, p = [];
      if (m.lanceiro)  p.push(`${m.lanceiro} lanc`);
      if (m.arqueiro)  p.push(`${m.arqueiro} arq`);
      if (m.cavaleiro) p.push(`${m.cavaleiro} cav`);
      return p.length ? ` | para tomar${rotulosExpectativa ? " AGORA" : ""}: ${p.join(" ou ")}` : ""; // LOTE C, E11
    };

    // cabecalho
    L.push(`TURNO ${visao.turno} - Voce e o Rei ${me}.`);
    // Ataca a CAUSA 1 (ancora na guarnicao inicial): reafirma que os numeros
    // abaixo sao DESTE turno. Custo zero, risco zero.
    L.push(`Estes numeros sao do TURNO ${visao.turno}. Ignore quantidades de turnos anteriores.`);
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
    // 7.5.4 (04/08): DESACOPLADO de semRejeicoes. avisos != rejeicoes — ligar
    // rejeicaoNoFim (que passa semRejeicoes) NAO pode suprimir o aviso de clamp,
    // senao o modelo perde o sinal de que a contabilidade dele foi ajustada.
    if (visao.avisosAnteriores && visao.avisosAnteriores.length) {
      L.push("=== SUAS ORDENS AJUSTADAS NO TURNO ANTERIOR ===");
      L.push("As ordens abaixo FORAM executadas, mas com a quantidade reduzida ao estoque real. Nesta jogada, peca apenas o que voce TEM:");
      for (const a of visao.avisosAnteriores) L.push(`- ${a}`);
      L.push("");
    }

    // SUAS ALDEIAS (relatorio v3, Fase 2 04/08): separa em TRES estados o que
    // o modelo confundia — o que da p/ enviar AGORA, o que ja saiu (em marcha) e
    // o que ainda vai ficar pronto. Ataca as CAUSAS 1 (ancora) e 2 (transito
    // contado como casa). Producao vem da CONFIG, nunca hard-coded.
    const prod = cfg.producao;
    // COMBATE v3 (7.5.2): o relatorio mostra os TOTAIS ja somados — o modelo
    // nunca deve ter de multiplicar atq/def. terreno = bonus de defesa do lugar.
    const terreno = (x) => x.capital ? cfg.combate.bonus_defesa_castelo : cfg.combate.bonus_defesa_aldeia;
    const defefetiva = (x) => Math.round(defesaDe(x.tropas, cfg) * terreno(x));
    // LOTE D, D4/D5: sufixos por alvo (delta de defesa observada + memoria de ataque).
    const deltaDefesa = (opcoes && opcoes.deltaDefesa != null) ? !!opcoes.deltaDefesa : (cfg.deltaDefesa !== false);
    const memoriaAlvo = (opcoes && opcoes.memoriaAlvo != null) ? !!opcoes.memoriaAlvo : (cfg.memoriaAlvo !== false);
    const deltaTexto = (a) => { // D4: "era X ha N" / "estavel ha N" (estabilidade tambem e info: nao sobredimensionar alvo parado).
      if (!deltaDefesa || !a.defAntes) return "";
      const dt = visao.turno - a.defAntes.turno;
      return defefetiva(a) === a.defAntes.defEf ? ` (estavel ha ${dt} turnos)` : ` (era ${a.defAntes.defEf} ha ${dt} turnos)`;
    };
    const memoriaTexto = (a) => // D5: so quando houve tentativa; linha ausente e mais barata que vazia.
      (memoriaAlvo && a.tentativas) ? ` | voce atacou aqui ${a.tentativas.n}x nos ultimos ${a.tentativas.janela} turnos (${a.tentativas.conquistas} conquistas)` : "";
    // ORDENACAO (7.5.3): 'id' (padrao) mantem a ordem por id; 'custo' ordena por
    // custo de marcha desde a MINHA capital (simetrico). Flag desligada por ora.
    let minhasOrd = visao.minhas.slice();
    if (cfg.ordemAldeias === "custo" && temRede) {
      const cap = visao.minhas.find((m) => m.capital) || visao.minhas[0];
      const custoAte = (m) => {
        if (!cap || m.id === cap.id) return 0;
        const cam = caminhoEntre(shim, cap.id, m.id);
        return cam ? pesoRota(shim, cam) : Infinity;
      };
      minhasOrd.sort((p, q) => custoAte(p) - custoAte(q) || p.id - q.id);
    } else {
      minhasOrd.sort((p, q) => p.id - q.id);
    }
    L.push(`=== SUAS ALDEIAS (${visao.minhas.length}) ===`);
    // LOTE C, E10: contagem agregada. NAO e "forca" (abstracao removida em 19/07) —
    // e a soma de numeros que ja estao no prompt. Sem media/percentagem/recomendacao.
    const contagemAgregada = (opcoes && opcoes.contagemAgregada != null) ? !!opcoes.contagemAgregada : (cfg.contagemAgregada !== false);
    if (contagemAgregada) {
      const casa = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
      for (const m of visao.minhas) for (const t of TIPOS) casa[t] += (m.tropas[t] || 0);
      let marchando = 0;
      if (visao.transito) for (const mv of visao.transito) if (mv.dono === me) marchando += contarTropas(mv.tropas);
      const totCasa = casa.lanceiro + casa.arqueiro + casa.cavaleiro;
      L.push(`TOTAL: ${totCasa} soldados em casa (${casa.lanceiro} lanceiros, ${casa.arqueiro} arqueiros, ${casa.cavaleiro} cavaleiros) + ${marchando} em marcha`);
    }
    // LOTE C, E9: FRONTEIRA (tem vizinho direto inimigo na rede) vs INTERIOR. Marcar
    // o interior importa tanto quanto a fronteira: torna acionavel esvaziar uma aldeia
    // segura. Sem rede (estados sinteticos) -> sem tag.
    const marcarFronteira = (opcoes && opcoes.marcarFronteira != null) ? !!opcoes.marcarFronteira : (cfg.marcarFronteira !== false);
    const donoPorId = {};
    if (marcarFronteira && visao.estradas) {
      for (const m of visao.minhas) donoPorId[m.id] = me;
      for (const al of visao.alvos) donoPorId[al.id] = al.dono;
    }
    const fronteiraTag = (a) => {
      if (!marcarFronteira || !visao.estradas) return "";
      const inimigos = (visao.estradas[a.id] || []).filter((v) => donoPorId[v] === inimigo);
      if (!inimigos.length) return " | INTERIOR (sem divisa inimiga)";
      const lista = inimigos.slice(0, 2).map((v) => `[${v}] INIMIGA`).join(", ");
      return ` | FRONTEIRA com ${lista}${inimigos.length > 2 ? ` +${inimigos.length - 2}` : ""}`;
    };
    for (const a of minhasOrd) {
      const nome = a.nome ? ` ${a.nome}` : ""; // mapa autoral traz nome; procedural pode nao ter
      L.push(`[${a.id}]${nome}${fronteiraTag(a)} | madeira ${a.recursos.madeira} (+${prod.madeira}/turno) | ferro ${a.recursos.ferro} (+${prod.ferro}/turno) | ${defLabel(a)}${p3 ? ` | tropas em casa: ${contarTropas(a.tropas)} / ${cfg.limite_tropas_aldeia}` : ""}`);
      // DISPONIVEL PARA ENVIAR AGORA: instrucao (maiusculas), nao descricao.
      // ataque: poder de ATAQUE se enviar TODA a guarnicao de casa (7.5.2).
      L.push(`    DISPONIVEL PARA ENVIAR AGORA: ${a.tropas.lanceiro} lanceiros, ${a.tropas.arqueiro} arqueiros, ${a.tropas.cavaleiro} cavaleiros (ataque se enviar tudo: ${ataqueDe(a.tropas, cfg)})`);
      // saiu daqui, ja em marcha (NAO disponivel): do transito, origem=esta
      // aldeia, dono=me. Se nao houver, OMITE a linha inteira (linha ausente e
      // mais barata que linha vazia).
      const emMarcha = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
      let temMarcha = false;
      if (visao.transito) {
        for (const mv of visao.transito) {
          if (mv.origemId === a.id && mv.dono === me) {
            for (const t of TIPOS) emMarcha[t] += (mv.tropas[t] || 0);
            temMarcha = true;
          }
        }
      }
      if (temMarcha && (emMarcha.lanceiro + emMarcha.arqueiro + emMarcha.cavaleiro) > 0) {
        L.push(`    saiu daqui, ja em marcha (NAO disponivel): ${compTexto(emMarcha)}`);
      }
      // fica pronto: substitui "construindo". Sufixo obrigatorio. Sem construcao,
      // OMITE (nada de "construindo: nada").
      if (a.construindo.length) {
        const cont = {};
        let maxT = 0;
        for (const c of a.construindo) { cont[c.tipo] = (cont[c.tipo] || 0) + 1; maxT = Math.max(maxT, c.turnosRestantes); }
        const desc = TIPOS.filter((t) => cont[t]).map((t) => `${cont[t]} ${t}`).join(", ");
        const quando = maxT > 1 ? `fica pronto em ${maxT} turnos` : `fica pronto no proximo turno`;
        L.push(`    ${quando}: ${desc} (nao pode ser enviado neste turno)`);
      }
    }
    L.push("");

    // FORCA TOTAL removida (19/07, filosofia do Lucas): na partida o Rei ve so
    // TROPA + QUANTIDADE (por aldeia, acima) + CUSTO (nas regras). Sem numero de
    // "forca" — 1 lanceiro e 1 lanceiro. A tabela de calculo fica nas REGRAS.

    // ALDEIAS NEUTRAS (ordenadas por distancia da minha mais proxima)
    const neutras = visao.alvos.filter((a) => a.dono === null)
      .map((a) => ({ a, t: marcha(a) }))
      .sort((p, q) => p.t - q.t || p.a.id - q.a.id);
    L.push(`=== ALDEIAS NEUTRAS (${neutras.length}) - ordenadas por distancia da sua mais proxima ===`);
    for (const { a, t } of neutras) {
      L.push(`[${a.id}] ${compTexto(a.tropas)} | ${defLabel(a)}${deltaTexto(a)} | ${marchaTexto(a)}${minTexto(a)}${memoriaTexto(a)}`);
    }
    L.push("");

    // INIMIGO
    const inimigas = visao.alvos.filter((a) => a.dono === inimigo)
      .map((a) => ({ a, t: marcha(a) }))
      .sort((p, q) => p.t - q.t || p.a.id - q.a.id);
    L.push(`=== INIMIGO (Rei ${inimigo}) - ${inimigas.length} aldeia(s) ===`);
    if (!inimigas.length) L.push("(nenhuma aldeia inimiga)");
    for (const { a, t } of inimigas) {
      L.push(`[${a.id}] ${compTexto(a.tropas)} | ${defLabel(a)}${deltaTexto(a)} | ${marchaTexto(a)}${minTexto(a)}${memoriaTexto(a)}`);
    }
    L.push("");

    // REDE DE ESTRADAS (topologia FIXA da partida): mostra as conexoes diretas de
    // CADA aldeia do mapa. Repeticao simetrica ([0] lista [2] e [2] lista [0]) e
    // intencional — ajuda o modelo a raciocinar "de onde estou, para onde vou".
    // So leitura do grafo (estradas.adj); nao altera nada. Ausente em estados
    // sinteticos sem rede.
    const semRede = !!(opcoes && opcoes.semRede); // validador nao precisa da topologia
    if (visao.estradas && !semRede) {
      // LOTE C, E8: anota o dono de cada aldeia na rede (usa classifica, a MESMA
      // funcao do resto do relatorio). Nao acrescenta info (o dono ja esta noutra
      // seccao); so poupa um join manual de ~41 ligacoes por turno. Flag redeComDono.
      const redeComDono = (opcoes && opcoes.redeComDono != null) ? !!opcoes.redeComDono : (cfg.redeComDono !== false);
      const infoAld = {};
      if (redeComDono) {
        for (const m of visao.minhas) infoAld[m.id] = { dono: me, nome: m.nome };
        for (const a of visao.alvos) infoAld[a.id] = { dono: a.dono, nome: a.nome };
      }
      L.push(`=== REDE DE ESTRADAS (por onde os exercitos marcham) ===`);
      const idsRede = Object.keys(visao.estradas).map(Number).sort((a, b) => a - b);
      for (const id of idsRede) {
        const viz = (visao.estradas[id] || []).slice().sort((a, b) => a - b);
        if (redeComDono) {
          const i = infoAld[id];
          const cab = `Aldeia [${id}]${i && i.nome ? " " + i.nome : ""}${i ? " (" + classifica(i.dono) + ")" : ""}`;
          L.push(`${cab} liga-se a: ${viz.map((v) => `[${v}]${infoAld[v] ? " " + classifica(infoAld[v].dono) : ""}`).join(", ")}`);
        } else {
          L.push(`Aldeia [${id}] liga-se a: ${viz.map((v) => `[${v}]`).join(", ")}`);
        }
      }
      L.push("");
    }

    // EXERCITOS EM TRANSITO
    L.push(`=== EXERCITOS EM TRANSITO ===`);
    const meus = visao.transito.filter((m) => m.dono === me);
    const dele = visao.transito.filter((m) => m.dono !== me);
    const linhaMov = (m) => {
      let s = `- ${compTexto(m.tropas)} (ataque: ${ataqueDe(m.tropas, cfg)}): aldeia [${m.origemId}] -> aldeia [${m.destinoId}] (${classifica(m.destinoDono)}), chega em ${m.turnosRestantes} turnos`;
      // L2: envio redirecionado pela interceptacao. NAO e rejeicao — foi executado.
      if (m.destinoPedido != null && m.destinoPedido !== m.destinoId)
        s += ` [REDIRECIONADO: voce pediu [${m.destinoPedido}], parou na primeira aldeia nao-sua do caminho]`;
      return s;
    };
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
  function exemploAncorado(visao, comResumos) {
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
    const linhas = [
      "{",
      '  "construir": [',
      `    {"aldeiaId": ${origem}, "tipo": "lanceiro"}`,
      "  ],",
      '  "envios": [',
      envios.join(",\n"),
      "  ]",
    ];
    // v5: os dois textos entram no MOLDE, senao o modelo nao sabe onde os por.
    // Vao por ultimo e com reticencias, para nao servirem de conteudo a copiar.
    if (comResumos) {
      linhas[linhas.length - 1] = "  ],";
      linhas.push('  "plano": "...",');
      linhas.push('  "depoimento": "..."');
    }
    linhas.push("}");
    return linhas.join("\n");
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
    const bA = cfg.combate.bonus_defesa_aldeia, bC = cfg.combate.bonus_defesa_castelo;
    const L = [];
    L.push("=== REGRAS DE COMBATE ===");
    L.push("Cada tropa tem ATAQUE e DEFESA proprios (nao valem todas igual):");
    for (const t of TIPOS) {
      const d = cfg.tropas[t];
      L.push(`  ${t}: ataque ${d.atq}, defesa ${d.def}, velocidade ${d.vel} (custa ${d.custo.madeira} madeira + ${d.custo.ferro} ferro).`);
    }
    L.push("Quando voce ATACA, conta o ATAQUE das suas tropas; quem DEFENDE conta a DEFESA das dele.");
    L.push(`Triangulo (BONUS, nao vitoria automatica): ${TIPOS.map((t) => `${t} contra ${cfg.triangulo[t]}`).join("; ")}. Ter o counter multiplica sua forca por ${B}.`);
    L.push("O tipo MAIS NUMEROSO de cada exercito define o matchup do counter (empate no numero desempata na ordem lanceiro, arqueiro, cavaleiro).");
    L.push(`Defender e mais facil: a defesa conta x ${bA} numa aldeia e x ${bC} num castelo (capital). Em campo aberto (na estrada) nao ha bonus.`);
    L.push("Vence o lado com MAIOR forca efetiva. Empate favorece o DEFENSOR.");
    return L.join("\n");
  }

  // VARIANTE P1: regras de combate com a CONTA EXPLICITA da forca efetiva.
  // Numeros TODOS derivados da cfg (nada hard-coded). Nao usa minimos.
  // Ensina o counter como BONUS x1.5 (nao vitoria automatica): 1 tropa com
  // counter certo (1.5) conquista uma neutra de 1 numa aldeia (1.25).
  function regrasCombateTextoP1(cfg) {
    const B = cfg.bonus_forca_triangulo;
    const bA = cfg.combate.bonus_defesa_aldeia;
    const bC = cfg.combate.bonus_defesa_castelo;
    const T = cfg.tropas;
    const L = [];
    L.push("=== REGRAS DE COMBATE ===");
    L.push("Cada tropa tem ATAQUE e DEFESA proprios:");
    for (const t of TIPOS) L.push(`  ${t}: ataque ${T[t].atq}, defesa ${T[t].def} (${T[t].vel}).`);
    L.push(`Triangulo (bonus x${B}): ${TIPOS.map((t) => `${t}>${cfg.triangulo[t]}`).join("; ")}. O tipo MAIS NUMEROSO define o matchup (desempate: lanceiro, arqueiro, cavaleiro).`);
    L.push("");
    L.push("CONTA DA BATALHA:");
    L.push(`  ATACANTE = soma do ATAQUE das suas tropas, x ${B} se voce tem o counter`);
    L.push(`  DEFENSOR = soma da DEFESA das tropas dele, x ${B} se ele tem o counter, x ${bA} se em aldeia (x ${bC} se e capital)`);
    L.push("  Vence quem tiver MAIOR forca efetiva. Empate: o DEFENSOR segura.");
    L.push("");
    L.push("EXEMPLOS COM OS NUMEROS DESTE JOGO:");
    L.push(`  1 cavaleiro ataca aldeia de 1 lanceiro: ${T.cavaleiro.atq} contra ${(T.lanceiro.def * B * bA).toFixed(3)} -> VENCE (o ariete quebra a defesa parada).`);
    L.push(`  1 lanceiro ataca aldeia de 1 cavaleiro: ${(T.lanceiro.atq * B).toFixed(2)} contra ${(T.cavaleiro.def * bA).toFixed(2)} -> empate, o DEFENSOR segura. Leve 2.`);
    L.push(`  1 arqueiro ataca aldeia de 1 lanceiro: ${(T.arqueiro.atq * B).toFixed(2)} contra ${(T.lanceiro.def * bA).toFixed(2)} -> empate, o DEFENSOR segura. Leve 2.`);
    L.push("Antes de enviar, faca a conta — o relatorio ja mostra ATAQUE e DEFESA somados p/ voce nao ter de multiplicar.");
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
    if (cfg.limite_tropas_aldeia)
      L.push(`Teto por aldeia: quando o NUMERO de tropas em casa atinge ${cfg.limite_tropas_aldeia}, ` +
        `a aldeia PARA de construir (mas segue produzindo recursos e pode receber reforcos).`);
    L.push("So ordene construir se a aldeia tem recursos para pagar o custo AGORA.");
    return L.join("\n");
  }

  // REGRAS DE MOVIMENTO em texto (mesmo padrao das outras regras): declara a
  // mecanica de marcha para o modelo poder usa-la. Depende do bloco REDE DE
  // ESTRADAS (no relatorio) para a topologia. cfg fica na assinatura por padrao,
  // ainda que o texto seja estrutural (as regras nao variam com a config hoje).
  function regrasMovimentoTexto(cfg) {
    const L = [];
    L.push("=== REGRAS DE MOVIMENTO ===");
    L.push("Seu exercito marcha pela REDE DE ESTRADAS que liga as aldeias, nao em linha reta. O tempo de viagem e medido ao longo dessa rede: uma aldeia que parece perto no mapa pode estar longe pela estrada. Consulte o bloco REDE DE ESTRADAS para ver as conexoes.");
    L.push("O exercito PARA na primeira aldeia que nao e sua no caminho e luta ali, mesmo que voce tenha ordenado um destino mais distante. Nao da para pular uma aldeia inimiga ou neutra para atacar outra atras dela. Para chegar a um alvo distante, conquiste primeiro as aldeias do caminho.");
    L.push("Tropas enviadas de aldeias DIFERENTES nao somam forcas, mesmo chegando no mesmo turno ao mesmo alvo: cada envio luta sozinho, um de cada vez. Para atacar com forca concentrada, primeiro reuna as tropas numa aldeia sua (enviando-as para la como reforco) e depois ataque a partir dessa aldeia num unico envio.");
    return L.join("\n");
  }

  // ==========================================================
  //  PROMPT P4 (17/08, sessao Fable) — INGLES, sem exemplo, com fog.
  // ----------------------------------------------------------
  //  Principios (ESTUDO_PROMPT_P4.md):
  //   1. toda regra que o motor executa esta dita (vitoria por dominancia,
  //      simultaneidade, endurecimento, reforco);
  //   2. nenhuma frase prescreve jogada (sem "para tomar", sem dica de alvo,
  //      sem exemplo com valores — esquema declarado);
  //   3. o que o texto proibe == o que diagnosticarOrdem recusa;
  //   4. a memoria e do motor (plano, "last seen", "was X N turns ago");
  //   5. tokens do protocolo continuam PT (lanceiro/arqueiro/cavaleiro,
  //      construir/envios) — sao vocabulario do jogo; a prosa e inglesa.
  //      normalizarTipo aceita os nomes ingleses como sinonimos.
  // ==========================================================
  // Composicao em texto para o renderizador P4 (tokens do protocolo + caso vazio
  // em ingles). Fora do relatorioTextoP4 porque o eventoTextoEN tambem precisa.
  function compTextoEN(t) {
    const p = [];
    if (t.lanceiro) p.push(`${t.lanceiro} lanceiro${t.lanceiro > 1 ? "s" : ""}`);
    if (t.arqueiro) p.push(`${t.arqueiro} arqueiro${t.arqueiro > 1 ? "s" : ""}`);
    if (t.cavaleiro) p.push(`${t.cavaleiro} cavaleiro${t.cavaleiro > 1 ? "s" : ""}`);
    return p.length ? p.join(", ") : "empty (no troops)";
  }
  function eventoTextoEN(ev, me) {
    if (ev.tipo === "combate") {
      const euAtaquei = ev.atacante === me;
      const quem = euAtaquei ? "You" : "King " + ev.atacante;
      if (ev.vencedor === "atacante") {
        const baixas = euAtaquei ? ` (your losses: ${ev.baixasForca} troops)` : "";
        return `${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: VICTORY, conquered${baixas}`;
      }
      const perdeu = euAtaquei ? " (your army was lost)" : "";
      return `${quem} attacked [${ev.alvoId}] ${ev.alvoNome}: DEFEAT${perdeu}`;
    }
    if (ev.tipo === "reforco") {
      const quem = ev.dono === me ? "Your reinforcement" : "A reinforcement of King " + ev.dono;
      return `${quem} (${compTextoEN(ev.tropas)}) arrived at [${ev.alvoId}] ${ev.alvoNome}`;
    }
    if (ev.tipo === "cancelado") return `Order ignored: ${ev.motivo || "invalid send"}`;
    if (ev.tipo === "combate_estrada") {
      const euAtaquei = ev.atacante === me;
      const venciMeu = ev.vencedorDono === me;
      return `Armies met ON THE ROAD${euAtaquei || ev.defensor === me ? "" : ""}: ${venciMeu ? "your army won the field" : "your army was beaten in the field"} (no location bonus in the open)`;
    }
    return JSON.stringify(ev);
  }

  function relatorioTextoP4(visao, opcoes) {
    const cfg = visao.config;
    const me = visao.dono;
    const inimigo = me === "A" ? "B" : "A";
    const semRejeicoes = !!(opcoes && opcoes.semRejeicoes);
    const fog = !!visao.fog;
    const L = [];

    // ---- marcha pela rede (mesmas funcoes do motor; ver L3 no legado) ----
    const temRede = !!visao.estradas;
    const shim = temRede ? { config: cfg, estradas: { adj: visao.estradas, custo: visao.estradasCusto || null },
                             aldeias: visao.minhas.concat(visao.alvos) } : null;
    const porCusto = temRede && !!visao.estradasCusto;
    const marchaVel = (alvo, tropaRep) => {
      let best = Infinity, bestCaminho = null;
      for (const m of visao.minhas) {
        let d, cam = null;
        if (temRede) {
          cam = caminhoEntre(shim, m.id, alvo.id);
          d = cam ? pesoRota(shim, cam) : Math.hypot(m.x - alvo.x, m.y - alvo.y);
        } else d = Math.hypot(m.x - alvo.x, m.y - alvo.y);
        if (d < best) { best = d; bestCaminho = cam; }
      }
      if (best === Infinity) return "?";
      if (porCusto && bestCaminho) return turnosDeCaminho(shim, bestCaminho, tropaRep);
      const passoRef = cfg.velocidade_passo[cfg.relatorio.velocidade_referencia];
      return Math.max(1, Math.ceil(porCusto ? best : best / passoRef));
    };
    const origemMaisProxima = (alvo) => {
      let best = Infinity, bestM = null;
      for (const m of visao.minhas) {
        let d;
        if (temRede) { const cam = caminhoEntre(shim, m.id, alvo.id); d = cam ? pesoRota(shim, cam) : Math.hypot(m.x - alvo.x, m.y - alvo.y); }
        else d = Math.hypot(m.x - alvo.x, m.y - alvo.y);
        if (d < best) { best = d; bestM = m; }
      }
      return bestM;
    };
    const marchaTexto = (a) => {
      const vs = `${marchaVel(a, { lanceiro: 1 })} slow / ${marchaVel(a, { arqueiro: 1 })} medium / ${marchaVel(a, { cavaleiro: 1 })} fast`;
      const o = origemMaisProxima(a);
      return `march from ${o ? "[" + o.id + "]" + (o.nome ? " " + o.nome : "") : "?"}: ${vs} turns`;
    };
    const marchaMedia = (a) => { const t = marchaVel(a, { arqueiro: 1 }); return t === "?" ? Infinity : t; };

    const prod = cfg.producao;
    const terreno = (x) => x.capital ? cfg.combate.bonus_defesa_castelo : cfg.combate.bonus_defesa_aldeia;
    const defefetiva = (x) => Math.round(defesaDe(x.tropas, cfg) * terreno(x));
    const deltaDefesa = (opcoes && opcoes.deltaDefesa != null) ? !!opcoes.deltaDefesa : (cfg.deltaDefesa !== false);
    const memoriaAlvo = (opcoes && opcoes.memoriaAlvo != null) ? !!opcoes.memoriaAlvo : (cfg.memoriaAlvo !== false);
    const deltaTexto = (a) => {
      if (!deltaDefesa || !a.defAntes) return "";
      const dt = visao.turno - a.defAntes.turno;
      return defefetiva(a) === a.defAntes.defEf ? ` (stable for ${dt} turns)` : ` (was ${a.defAntes.defEf}, ${dt} turns ago)`;
    };
    const memoriaTexto = (a) =>
      (memoriaAlvo && a.tentativas) ? ` | you attacked here ${a.tentativas.n}x in the last ${a.tentativas.janela} turns (${a.tentativas.conquistas} conquered)` : "";
    const nomeDe = (a) => a.nome ? ` ${a.nome}` : "";
    // Composicao: as QUANTIDADES usam os tokens do protocolo (lanceiro/arqueiro/
    // cavaleiro sao vocabulario do jogo, iguais aos do JSON), mas o caso vazio
    // tem de ser ingles — o compTexto devolve "sem tropas" e isso vazava PT
    // para dentro do relatorio ingles ("garrison: sem tropas").
    const compEN = compTextoEN;

    // ---- cabecalho ----
    L.push(`TURN ${visao.turno} - You are King ${me}.`);
    L.push(`These numbers are from TURN ${visao.turno}. Ignore quantities from earlier turns.`);
    L.push("");

    if (!semRejeicoes && visao.rejeicoesAnteriores && visao.rejeicoesAnteriores.length) {
      L.push("=== WARNING: ORDERS OF YOURS REFUSED LAST TURN ===");
      L.push("The orders below were NOT executed (the engine refused them). Fix the mistake this turn and do NOT repeat the same order:");
      for (const r of visao.rejeicoesAnteriores) L.push(`- ${r}`);
      L.push("");
    }
    if (visao.avisosAnteriores && visao.avisosAnteriores.length) {
      L.push("=== ORDERS OF YOURS ADJUSTED LAST TURN ===");
      L.push("The orders below WERE executed, but reduced to the real stock. This turn, only order what you HAVE:");
      for (const a of visao.avisosAnteriores) L.push(`- ${a}`);
      L.push("");
    }

    // ---- suas aldeias ----
    const minhasOrd = visao.minhas.slice().sort((p, q) => p.id - q.id);
    L.push(`=== YOUR VILLAGES (${visao.minhas.length}) ===`);
    const casa = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
    let marchando = 0;
    for (const m of visao.minhas) for (const t of TIPOS) casa[t] += m.tropas[t];
    if (visao.transito) for (const mv of visao.transito) if (mv.dono === me) marchando += mv.tropas.lanceiro + mv.tropas.arqueiro + mv.tropas.cavaleiro;
    L.push(`TOTAL: ${casa.lanceiro + casa.arqueiro + casa.cavaleiro} soldiers at home (${casa.lanceiro} lanceiros, ${casa.arqueiro} arqueiros, ${casa.cavaleiro} cavaleiros) + ${marchando} marching`);
    const adj = visao.estradas || {};
    const donoDe = {};
    for (const m of visao.minhas) donoDe[m.id] = me;
    for (const a of visao.alvos) donoDe[a.id] = a.dono;
    const fronteiraTag = (a) => {
      const inimigos = (adj[a.id] || []).filter((v) => donoDe[v] === inimigo);
      if (!inimigos.length) return " | INTERIOR (no enemy border)";
      const lista = inimigos.slice(0, 2).map((v) => `[${v}]`).join(", ");
      return ` | BORDER with ${lista}${inimigos.length > 2 ? ` +${inimigos.length - 2}` : ""} (enemy)`;
    };
    for (const a of minhasOrd) {
      const nome = a.nome ? ` ${a.nome}` : "";
      const cap = a.capital ? " - YOUR CAPITAL" : "";
      L.push(`[${a.id}]${nome}${cap}${fronteiraTag(a)} | wood ${a.recursos.madeira} (+${prod.madeira}/turn) | iron ${a.recursos.ferro} (+${prod.ferro}/turn) | effective defense (location bonus included): ${defefetiva(a)} | troops at home: ${contarTropas(a.tropas)} / ${cfg.limite_tropas_aldeia}`);
      L.push(`    AVAILABLE TO SEND NOW: ${a.tropas.lanceiro} lanceiros, ${a.tropas.arqueiro} arqueiros, ${a.tropas.cavaleiro} cavaleiros (attack power if all sent: ${ataqueDe(a.tropas, cfg)})`);
      const emMarcha = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
      let temMarcha = false;
      if (visao.transito) for (const mv of visao.transito) if (mv.origemId === a.id && mv.dono === me) { for (const t of TIPOS) emMarcha[t] += (mv.tropas[t] || 0); temMarcha = true; }
      if (temMarcha && (emMarcha.lanceiro + emMarcha.arqueiro + emMarcha.cavaleiro) > 0)
        L.push(`    already marching out (NOT available): ${compEN(emMarcha)}`);
      if (a.construindo.length) {
        const cont = {}; let maxT = 0;
        for (const c of a.construindo) { cont[c.tipo] = (cont[c.tipo] || 0) + 1; maxT = Math.max(maxT, c.turnosRestantes); }
        const desc = TIPOS.filter((t) => cont[t]).map((t) => `${cont[t]} ${t}`).join(", ");
        L.push(`    ${maxT > 1 ? `ready in ${maxT} turns` : "ready next turn"}: ${desc} (cannot be sent this turn)`);
      }
    }
    L.push("");

    // ---- alvos ----
    const ordenar = (lista) => lista.map((a) => ({ a, t: marchaMedia(a) })).sort((p, q) => p.t - q.t || p.a.id - q.a.id);
    const linhaAlvo = (a) => {
      const donoTag = a.dono === null ? "NEUTRAL" : (a.capital ? `ENEMY CAPITAL (King ${a.dono})` : `ENEMY (King ${a.dono})`);
      return `[${a.id}]${nomeDe(a)} | ${donoTag} | garrison: ${compEN(a.tropas)} | effective defense (location bonus included): ${defefetiva(a)}${deltaTexto(a)} | ${marchaTexto(a)}${memoriaTexto(a)}`;
    };
    if (!fog) {
      const neutras = ordenar(visao.alvos.filter((a) => a.dono === null));
      L.push(`=== NEUTRAL VILLAGES (${neutras.length}) - sorted by march distance from your nearest ===`);
      for (const { a } of neutras) L.push(linhaAlvo(a));
      L.push("");
      const inimigas = ordenar(visao.alvos.filter((a) => a.dono === inimigo));
      L.push(`=== ENEMY (King ${inimigo}) - ${inimigas.length} village(s) ===`);
      if (!inimigas.length) L.push("(no enemy villages)");
      for (const { a } of inimigas) L.push(linhaAlvo(a));
      L.push("");
    } else {
      const visiveis = ordenar(visao.alvos.filter((a) => a.visivel));
      L.push(`=== VILLAGES YOU CAN SEE (${visiveis.length}) - sorted by march distance from your nearest ===`);
      if (!visiveis.length) L.push("(none - your watchmen see no village beyond your own)");
      for (const { a } of visiveis) L.push(linhaAlvo(a));
      L.push("");
      const lembradas = ordenar(visao.alvos.filter((a) => !a.visivel && a.visto));
      if (lembradas.length) {
        L.push(`=== KNOWN FROM BEFORE (${lembradas.length}) - out of sight now, the real state may have changed ===`);
        for (const { a } of lembradas) {
          const v = a.visto;
          const idade = visao.turno - v.turno;
          const donoTag = v.dono === null ? "NEUTRAL" : v.dono === me ? "YOURS" : (v.capital ? `ENEMY CAPITAL (King ${v.dono})` : `ENEMY (King ${v.dono})`);
          L.push(`[${a.id}]${nomeDe(a)} | last seen on turn ${v.turno} (${idade} turn${idade === 1 ? "" : "s"} ago): ${donoTag}, garrison was ${compEN(v.tropas)} | ${marchaTexto(a)}${memoriaTexto(a)}`);
        }
        L.push("");
      }
      const nunca = visao.alvos.filter((a) => !a.visivel && !a.visto).sort((p, q) => p.id - q.id);
      if (nunca.length) {
        L.push(`=== UNEXPLORED (${nunca.length}) - never seen; find them on the ROAD NETWORK below ===`);
        L.push(nunca.map((a) => `[${a.id}]${nomeDe(a)}${a.capital ? " (THE ENEMY CAPITAL - its garrison is unknown to you)" : ""}`).join(", "));
        L.push("");
      }
    }

    // ---- rede de estradas (compacta: uma linha por aldeia, dono so quando sabido) ----
    if (visao.estradas) {
      L.push("=== ROAD NETWORK (armies march along these roads; the geography never changes) ===");
      const conhecidoDe = (id) => {
        if (donoDe[id] === me) return " (yours)";
        const alvo = visao.alvos.find((x) => x.id === id);
        // Capitais sao conhecimento publico (qualquer rei sabe ONDE fica o
        // reino inimigo — o fog esconde o que ha la, nao a geografia politica).
        const capTag = (alvo && alvo.capital) ? " - THE ENEMY CAPITAL" : "";
        if (!fog) return (donoDe[id] === null ? " (neutral)" : " (enemy)") + capTag;
        if (alvo && alvo.visivel) return (alvo.dono === null ? " (neutral)" : " (enemy)") + capTag;
        if (alvo && alvo.visto) return (alvo.visto.dono === null ? " (last seen: neutral)" : (alvo.visto.dono === me ? " (last seen: yours)" : " (last seen: enemy)")) + capTag;
        return capTag;
      };
      const nomePorId = {};
      for (const m of visao.minhas) nomePorId[m.id] = m.nome;
      for (const a of visao.alvos) nomePorId[a.id] = a.nome;
      const ids = Object.keys(adj).map(Number).sort((x, y) => x - y);
      for (const id of ids) {
        const nm = nomePorId[id] ? " " + nomePorId[id] : "";
        L.push(`[${id}]${nm}${conhecidoDe(id)}: ${(adj[id] || []).map((v) => `[${v}]`).join(", ")}`);
      }
      L.push("");
    }

    // ---- exercitos em transito ----
    L.push("=== ARMIES ON THE MARCH ===");
    L.push("YOURS:");
    const meus = (visao.transito || []).filter((m) => m.dono === me);
    if (!meus.length) L.push("- none");
    for (const m of meus) L.push(`- ${compEN(m.tropas)}: [${m.origemId}] -> [${m.destinoId}], arrives in ${m.turnosRestantes} turn${m.turnosRestantes === 1 ? "" : "s"}`);
    const inimigosMv = (visao.transito || []).filter((m) => m.dono !== me)
      .filter((m) => !fog || donoDe[m.destinoId] === me || (visao.alvos.find((x) => x.id === m.destinoId) || {}).visivel);
    L.push(fog ? "ENEMY (only what your watchmen can see):" : "ENEMY:");
    if (!inimigosMv.length) L.push(fog ? "- none sighted" : "- none");
    for (const m of inimigosMv) L.push(`- enemy army marching toward [${m.destinoId}]${nomePorIdSeguro(visao, m.destinoId)}, arrives in ${m.turnosRestantes} turn${m.turnosRestantes === 1 ? "" : "s"}`);
    L.push("");

    // ---- o que aconteceu ----
    L.push("=== WHAT HAPPENED LAST TURN ===");
    let evs = visao.eventos || [];
    if (fog) {
      const visIds = new Set(visao.minhas.map((m) => m.id));
      for (const a of visao.alvos) if (a.visivel) visIds.add(a.id);
      evs = evs.filter((ev) => ev.atacante === me || ev.dono === me || ev.defensor === me || visIds.has(ev.alvoId));
    }
    if (!evs.length) L.push("- nothing you could see");
    for (const ev of evs) L.push("- " + eventoTextoEN(ev, me));

    return L.join("\n");
  }
  function nomePorIdSeguro(visao, id) {
    for (const m of visao.minhas) if (m.id === id) return m.nome ? " " + m.nome : "";
    for (const a of visao.alvos) if (a.id === id) return a.nome ? " " + a.nome : "";
    return "";
  }

  // Regras em INGLES, geradas da CONFIG (mesmo principio de sempre: se o eval
  // varrer um numero, o prompt conta a verdade sozinho).
  function regrasP4Texto(cfg) {
    const B = cfg.bonus_forca_triangulo;
    const bA = cfg.combate.bonus_defesa_aldeia, bC = cfg.combate.bonus_defesa_castelo;
    const contra = { lanceiro: cfg.triangulo.lanceiro, arqueiro: cfg.triangulo.arqueiro, cavaleiro: cfg.triangulo.cavaleiro };
    const velEN = { lenta: "slow", media: "medium", rapida: "fast" };
    const L = [];
    L.push("=== COMBAT RULES ===");
    L.push("Each troop type has its own ATTACK and DEFENSE values (they are not equal):");
    for (const t of TIPOS) {
      const d = cfg.tropas[t];
      L.push(`  ${t}: attack ${d.atq}, defense ${d.def}, speed ${velEN[d.vel] || d.vel} (costs ${d.custo.madeira} wood + ${d.custo.ferro} iron).`);
    }
    L.push("When you ATTACK, your troops count their ATTACK; the DEFENDER counts the DEFENSE of theirs.");
    L.push(`Counter triangle (a BONUS, not an automatic win): ${TIPOS.map((t) => `${t} counters ${contra[t]}`).join("; ")}. Having the counter multiplies your force by ${B}.`);
    L.push("The MOST NUMEROUS type of each army sets the counter matchup (ties in count break in the order lanceiro, arqueiro, cavaleiro).");
    L.push(`Defending is easier: defense counts x${bA} in a village and x${bC} in a castle (capital). In the open field (on a road) there is no bonus.`);
    L.push("The side with the HIGHER effective force wins. A tie favors the DEFENDER.");
    L.push("The winner also takes losses (attrition against the loser's effective force).");
    L.push('The "effective defense" values in the report ALREADY include the location bonus. Use them directly; do not apply the bonus again.');
    L.push("");
    L.push("=== ECONOMY RULES ===");
    for (const t of TIPOS) {
      const d = cfg.tropas[t];
      L.push(`${t}: costs ${d.custo.madeira} wood + ${d.custo.ferro} iron, ready in ${d.turnos} turn${d.turnos > 1 ? "s" : ""}.`);
    }
    L.push(`Each village you hold produces ${cfg.producao.madeira} wood and ${cfg.producao.ferro} iron per turn. Resources belong to EACH village (there is no shared treasury): a village pays for its own builds from its own stock.`);
    if (cfg.limite_tropas_aldeia)
      L.push(`Cap per village: when the NUMBER of troops at home reaches ${cfg.limite_tropas_aldeia}, that village STOPS building (it still produces resources and can still receive reinforcements).`);
    if (cfg.neutra && cfg.neutra.endurecimento)
      L.push(`Neutral villages harden with time: every ${cfg.neutra.endurecimento_intervalo || 1} turns, each neutral village gains +${cfg.neutra.endurecimento} troop of its own type.`);
    L.push("Only order a build the village can pay for NOW.");
    L.push("");
    L.push("=== MOVEMENT RULES ===");
    L.push("Armies march along the ROAD NETWORK that connects the villages, never in a straight line. Travel time is measured along the roads: a village that looks close on the map can be far by road. See the ROAD NETWORK block in the report.");
    L.push("An army STOPS at the first village on its path that is not yours and fights there, even if you ordered a more distant destination. You cannot march past an enemy or neutral village to hit one behind it.");
    L.push("Troops sent from DIFFERENT villages never add up, even when they arrive at the same target on the same turn: each send fights alone, one at a time.");
    L.push("You may also send troops to a village YOU already own: they march the same way and, on arrival, join that village's garrison as reinforcements.");
    L.push(`Each troop type has a speed: lanceiro (slow), arqueiro (medium), cavaleiro (fast). A MIXED army marches at the speed of its SLOWEST troop. The report shows travel time per speed (e.g. "march from [x]: 5 slow / 3 medium / 2 fast turns").`);
    L.push("Marching takes turns, and during those turns the enemy keeps building and moving. The defense you see in the report is TODAY'S defense, not the defense on arrival.");
    return L.join("\n");
  }

  function montarPromptP4(visao, opcoes) {
    const cfg = visao.config;
    const resumos = (opcoes && opcoes.resumosDoRei != null) ? !!opcoes.resumosDoRei : (cfg.resumosDoRei !== false);
    const rejNoFim = !!(opcoes && opcoes.rejeicaoNoFim) &&
      !!(visao.rejeicoesAnteriores && visao.rejeicoesAnteriores.length);
    const fog = !!visao.fog;
    const totalAldeias = visao.minhas.length + visao.alvos.length;
    const L = [];

    L.push(`You are King ${visao.dono}. The villages listed under "YOUR VILLAGES" are yours.`);
    // Incoerencia 2 (a mais grave depois do reforco): a condicao de vitoria REAL,
    // com o progresso ao vivo. O objetivo "conquiste a capital" era mentira util —
    // o Gemini ia ganhar por dominancia a declarar a capital em todos os turnos.
    if (cfg.vitoriaPorDominancia) {
      const alvoDom = Math.ceil(totalAldeias * (cfg.vitoriaFracao || 0.75));
      L.push(`HOW TO WIN: hold at least ${alvoDom} of the map's ${totalAldeias} villages (${Math.round((cfg.vitoriaFracao || 0.75) * 100)}%) for ${cfg.vitoriaTurnos || 2} consecutive turns, or eliminate every enemy village. You currently hold ${visao.minhas.length} of ${totalAldeias}. The enemy capital is the hardest single target on the map; taking it is NOT required to win.`);
    } else {
      L.push("HOW TO WIN: eliminate every enemy village. The enemy capital is the hardest single target on the map.");
    }
    L.push("Each village you hold produces resources every turn, and resources are what build your army.");
    // Incoerencia 7: o LOTE E tornou as ordens simultaneas e o prompt nunca disse.
    if (cfg.ordensSimultaneas !== false) {
      L.push("Orders are SIMULTANEOUS: the enemy writes their orders at the same time as you, over the same snapshot of the map you are reading now. Nothing you order this turn is visible to them before it happens.");
    }
    L.push("");
    L.push(regrasP4Texto(cfg));
    if (fog) {
      L.push("");
      L.push("=== FOG OF WAR ===");
      L.push("You do NOT see the whole map. You see: your own villages, every village directly connected to one of yours by road, and the destination of each army you have on the march. Anything else shows only what you knew the LAST time you saw it (marked \"last seen\"), or nothing at all (marked \"unexplored\"). The road map itself is public knowledge. The enemy is under the same rule: they see you only where their villages and armies reach.");
    }
    L.push("");
    L.push(relatorioTextoP4(visao, Object.assign({}, opcoes, { semRejeicoes: rejNoFim })));
    L.push("");
    if (resumos) {
      L.push("Besides your orders, write two short texts in English:");
      L.push('- "plano": your NOTE TO YOUR NEXT TURN, 2 to 4 lines (anything past 600 characters is cut off). You will read it next turn. Write what you are trying to do, what you must not forget, and what you decided NOT to do. It is a note to yourself: be useful, not eloquent.');
      L.push('- "depoimento": 2 to 4 lines telling the audience what you did THIS turn. It may have emotion. This text never comes back to you.');
      L.push("");
    }
    L.push("Reply with ONE valid JSON object and nothing else - no text before or after it.");
    L.push("");
    // ESQUEMA DECLARADO (fim do exemplo com valores): mostra a FORMA, enumera os
    // tres tipos SEMPRE juntos, e nao contem nenhum numero nem alvo copiavel.
    L.push("Field by field - this describes the SHAPE of the reply; it is not a suggested move, and there is no example to copy:");
    L.push("{");
    L.push('  "construir": [ {"aldeiaId": <id of one of YOUR villages>, "tipo": <"lanceiro" | "arqueiro" | "cavaleiro">, "quantidade": <how many to build, 1 or more>} ],');
    L.push('  "envios": [ {"origemId": <id of one of YOUR villages>, "destinoId": <id of ANY other village - enemy or neutral to attack it, one of YOURS to reinforce it>, "tropas": {"lanceiro": <n>, "arqueiro": <n>, "cavaleiro": <n>}} ]' + (resumos ? "," : ""));
    if (resumos) {
      L.push('  "plano": "<your note to your next turn>",');
      L.push('  "depoimento": "<2-4 lines for the audience>"');
    }
    L.push("}");
    L.push("Use only ids that appear in the report above. Do not send troops a village does not have. Empty lists are valid orders.");
    if (rejNoFim) {
      L.push("");
      L.push("=== WARNING: ORDERS OF YOURS REFUSED LAST TURN ===");
      L.push("The orders below were REFUSED by the engine:");
      for (const r of visao.rejeicoesAnteriores) L.push(`- ${r}`);
      L.push("Do NOT repeat the same order. The troop and resource numbers AVAILABLE are in the report above: use them.");
    }
    if (resumos && visao.planoAnterior) {
      L.push("");
      L.push("=== YOUR NOTE FROM LAST TURN (written by you) ===");
      L.push(String(visao.planoAnterior));
      L.push("Reread it: the map has changed since. Follow it if it still makes sense; change it if it does not.");
    }
    return L.join("\n");
  }

  // opcoes (H2, experimento de POSICAO do feedback — uma variavel):
  //   { rejeicaoNoFim: true } MOVE o bloco de rejeicoes do meio do relatorio
  //   para o FIM ABSOLUTO do prompt (depois do exemplo), com a instrucao
  //   anti-repeticao do handoff. Sem opcoes ou sem rejeicoes: prompt
  //   BYTE-IGUAL ao de sempre — o benchmark antigo segue comparavel.
  // P4 (17/08): dispatch identico ao do relatorioTexto — config.promptP4 === true
  // (o ruleset vivo) manda para o montarPromptP4; opcoes.promptP4 === false
  // forca o legado (regressao). O legado abaixo esta INTOCADO.
  function montarPrompt(visao, opcoes) {
    const usaP4 = (opcoes && opcoes.promptP4 != null) ? !!opcoes.promptP4 : (visao.config.promptP4 === true);
    if (usaP4) return montarPromptP4(visao, opcoes);
    return montarPromptLegado(visao, opcoes);
  }
  function montarPromptLegado(visao, opcoes) {
    // VARIANTE de prompt (experimento de tropas): "P0" (default, inalterado),
    // "P1" (conta explicita no bloco de combate), "P2" (minimo pre-calculado
    // no relatorio — depende da visao trazer `minimos`, ligado pelo caller).
    const variante = (opcoes && opcoes.variante) || "P0";
    const rejNoFim = !!(opcoes && opcoes.rejeicaoNoFim) &&
      !!(visao.rejeicoesAnteriores && visao.rejeicoesAnteriores.length);
    // LOTE B: mesma resolucao da flag promptP3 que o relatorioTexto usa.
    const p3 = (opcoes && opcoes.promptP3 != null) ? !!opcoes.promptP3 : (visao.config.promptP3 !== false);
    // v5: mesma resolucao das outras flags — default LIGADA, byte-identica se off.
    const resumos = (opcoes && opcoes.resumosDoRei != null) ? !!opcoes.resumosDoRei : (visao.config.resumosDoRei !== false);
    const L = [];
    // TOPO: identidade + tarefa (curto)
    L.push('Voce e o Rei. As aldeias listadas em "SUAS ALDEIAS" pertencem a voce.');
    L.push("Seu objetivo e conquistar a CAPITAL inimiga. A capital tem o maior bonus de defesa do jogo: e o alvo mais caro do mapa, e so cai com um exercito grande.");
    // DICA DAS NEUTRAS (flag `dicaNeutras`): a frase tinha duas metades, uma
    // FACTUAL ("cada aldeia produz recursos") e uma PRESCRITIVA ("conquiste
    // neutras primeiro"). A segunda enviesava o benchmark: com 22 neutras
    // contra 2 capitais, o Rei que obedece gasta ~27 turnos a expandir e nunca
    // encontra o inimigo — foi o que aconteceu em 3 partidas seguidas, 20
    // turnos sem um unico combate rei-contra-rei. Desligar a flag remove a
    // PRESCRICAO e mantem o FACTO: o modelo continua a saber que aldeia rende
    // recurso, mas escolhe sozinho a ordem. Default ligada (v3 byte-identico).
    if (visao.config.dicaNeutras !== false) {
      L.push("Conquiste aldeias neutras primeiro: cada aldeia produz recursos por turno, e sao os recursos que constroem esse exercito.");
    } else {
      L.push("Cada aldeia produz recursos por turno, e sao os recursos que constroem esse exercito.");
    }
    L.push("");
    // P1 troca SO o bloco de combate pela conta explicita; P0/P2 usam o padrao.
    L.push(variante === "P1" ? regrasCombateTextoP1(visao.config) : regrasCombateTexto(visao.config));
    if (p3) L.push("O valor de defesa no relatorio (\"defesa efetiva\") JA INCLUI o bonus do local (aldeia x1.25, castelo x1.5). Use-o diretamente; nao aplique o bonus de novo.");
    L.push("");
    L.push(regrasEconomiaTexto(visao.config));
    L.push("");
    L.push(regrasMovimentoTexto(visao.config));
    if (p3) L.push("Cada tropa tem uma velocidade: lanceiro (lenta), arqueiro (media), cavaleiro (rapida). Um exercito MISTO marcha a velocidade da tropa MAIS LENTA. O relatorio ja mostra o tempo por velocidade (ex.: \"marcha: 5 lenta / 3 media / 2 rapida\").");
    // LOTE C, E11: a promessa implicita do "para tomar" estava errada — a defesa vista
    // e a de AGORA, nao a da chegada (2-4 turnos depois). Nao muda o calculo, so o rotulo.
    if ((opcoes && opcoes.rotulosExpectativa != null) ? opcoes.rotulosExpectativa : (visao.config.rotulosExpectativa !== false))
      L.push("A marcha demora turnos, e nesses turnos o inimigo continua a construir e a mover tropas. A defesa que voce ve e a de AGORA, nao a da chegada.");
    L.push("");
    // MEIO: dados do turno (relatorio integral)
    // LOTE B: a flag promptP3 tem de ATRAVESSAR ate o relatorioTexto (senao nao
    // desliga o P3). semRejeicoes:false le igual a undefined no relatorioTexto.
    // P4: promptP4:false explicito — o caminho legado NUNCA pode cair no P4 por
    // re-dispatch (o cfg pode ter promptP4 true com opcoes a forcar o legado).
    L.push(relatorioTexto(visao, { semRejeicoes: rejNoFim, promptP3: opcoes && opcoes.promptP3, promptP4: false }));
    L.push("");
    // FIM: instrucao de formato -> processo -> exemplo (ultimo).
    // A "permissao de vazio" ("Listas vazias sao uma resposta valida... E melhor
    // nao fazer nada do que enviar um ataque ruim...") foi REMOVIDA. Experimento
    // exp-cautela-2x2 (braco B, 4x3x5, 15t, temp0): a frase congelava o
    // llama3:8b em agencia 0.00 envios/turno (5/5 seeds, variancia zero) — ele
    // copiava a linha construir do exemplo e esvaziava os envios. Remove-la
    // destrava (0->1.71 envios/turno, 1->5.2 aldeias) e ajuda tambem os 3B, sem
    // o efeito colateral do nudge factual (que fazia MAL ao llama3.2:3b).
    // ===== RESUMOS DO REI (v5, flag `resumosDoRei`) ======================
    //  DOIS textos com funcoes diferentes, e a diferenca e deliberada:
    //   - `plano`      -> VOLTA no prompt do turno seguinte. E memoria: da ao
    //                     modelo um bloco de notas entre turnos que ele nunca
    //                     teve. Pedido como "nota para o seu proximo turno" e
    //                     nao como "resumo da sua tatica" de proposito — a 1a
    //                     formulacao produz planeamento, a 2a produz retorica.
    //   - `depoimento` -> NAO volta. Vai so para a tela e para o log, e e o
    //                     roteiro de narracao do video.
    //  Os dois sao OPCIONAIS por construcao: parsearOrdem le `construir` e
    //  `envios` e ignora o resto, entao um modelo que os omita nao perde o
    //  turno. Campo cosmetico nunca pode custar uma jogada.
    if (resumos) {
      L.push("Alem das ordens, escreva dois textos curtos, em portugues:");
      L.push('- "plano": a sua NOTA PARA O PROXIMO TURNO, 2 a 4 linhas. Voce vai ler isto no turno seguinte. Escreva o que esta a tentar fazer, o que nao pode esquecer, e o que decidiu NAO fazer. E uma nota para si mesmo: seja util a voce, nao eloquente.');
      L.push('- "depoimento": 2 a 4 linhas contando a jogada DESTE turno a quem esta a assistir. Pode ter emocao. Este texto NAO volta para voce.');
      L.push("");
    }
    L.push("Responda APENAS com um JSON valido no formato abaixo. Nenhum texto antes ou depois do JSON.");
    L.push("");
    // INSTRUCAO DE PROCESSO (curta, logo antes do exemplo): forca o modelo a
    // ancorar nos ids REAIS da visao em vez de copiar numeros do exemplo.
    L.push("Antes de responder: em 'origemId' e em 'aldeiaId' use SOMENTE ids que aparecem na secao SUAS ALDEIAS. Escolha o 'destinoId' entre os ids das secoes ALDEIAS NEUTRAS e INIMIGO. Nao envie tropas que voce nao tem: se uma aldeia esta sem tropas, nao a use em 'envios'. O exemplo abaixo so mostra o FORMATO com ids reais deste turno; nao copie os numeros dele como se fossem sua jogada.");
    L.push("");
    L.push(exemploAncorado(visao, resumos));
    if (rejNoFim) {
      // FIM ABSOLUTO (H2): modelos pequenos pesam mais o rabo do prompt.
      L.push("");
      L.push("=== ATENCAO: SUAS ORDENS RECUSADAS NO TURNO ANTERIOR ===");
      L.push("As ordens abaixo foram RECUSADAS pelo motor:");
      for (const r of visao.rejeicoesAnteriores) L.push(`- ${r}`);
      L.push("NAO repita a mesma ordem. Os numeros de tropas e recursos DISPONIVEIS estao no relatorio acima: use-os.");
    }
    // A NOTA vem no fim, depois das rejeicoes: e o ultimo contexto antes de
    // decidir. Nao e ordem nem regra — e o Rei a falar consigo mesmo.
    if (resumos && visao.planoAnterior) {
      L.push("");
      L.push("=== A SUA NOTA DO TURNO ANTERIOR (escrita por voce) ===");
      L.push(String(visao.planoAnterior));
      L.push("Reveja-a: o mapa mudou desde entao. Siga-a se ainda faz sentido, e mude-a se nao faz.");
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

  // P4 (F6): diagnostico HONESTO de por que nao ha bloco balanceado. A mensagem
  // antiga ("nenhum bloco {...} na resposta") mentia quando o bloco EXISTIA mas
  // estava desbalanceado — foi o que apagou o melhor turno do Nemotron (T10 de
  // 17/08: um '}' a menos). Invariante do projeto: o log descreve o que houve.
  function diagnosticarBloco(texto) {
    if (typeof texto !== "string" || texto.indexOf("{") < 0) return "nenhum bloco {...} na resposta";
    let chaves = 0, colchetes = 0, emString = false, escape = false;
    for (let i = texto.indexOf("{"); i < texto.length; i++) {
      const ch = texto[i];
      if (emString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') emString = false;
        continue;
      }
      if (ch === '"') emString = true;
      else if (ch === "{") chaves++;
      else if (ch === "}") chaves--;
      else if (ch === "[") colchetes++;
      else if (ch === "]") colchetes--;
    }
    const partes = [];
    if (chaves > 0) partes.push(`faltam ${chaves} '}'`);
    if (chaves < 0) partes.push(`sobram ${-chaves} '}'`);
    if (colchetes > 0) partes.push(`faltam ${colchetes} ']'`);
    if (colchetes < 0) partes.push(`sobram ${-colchetes} ']'`);
    if (emString) partes.push("string aberta sem fechar");
    return partes.length ? `bloco JSON desbalanceado: ${partes.join(", ")}` : "nenhum bloco {...} fechado na resposta";
  }

  // P4 (F6): SALVAMENTO PARCIAL. `construir` e `envios` sao listas independentes;
  // um erro de sintaxe numa nao pode matar a outra (politica tudo-ou-nada apagava
  // ordens validas junto com a invalida). Extrai cada array [..] balanceado pelo
  // nome do campo e parseia cada um por si. Devolve null no que nao se salvou.
  function extrairArrayDoCampo(texto, campo) {
    if (typeof texto !== "string") return null;
    const m = new RegExp('"' + campo + '"\\s*:\\s*\\[').exec(texto);
    if (!m) return null;
    const ini = m.index + m[0].length - 1; // aponta para o '['
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
      else if (ch === "[") prof++;
      else if (ch === "]") { prof--; if (prof === 0) {
        try { const arr = JSON.parse(texto.slice(ini, i + 1)); return Array.isArray(arr) ? arr : null; }
        catch (e) { return null; }
      } }
    }
    return null;
  }
  function extrairStringDoCampo(texto, campo) {
    if (typeof texto !== "string") return null;
    const m = new RegExp('"' + campo + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"').exec(texto);
    if (!m) return null;
    try { return JSON.parse('"' + m[1] + '"'); } catch (e) { return null; }
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
    let obj = null, erroBase = null, salvamento = false;
    if (bloco == null) {
      erroBase = diagnosticarBloco(textoCru); // F6: a causa real, nao "nenhum bloco"
    } else {
      try { obj = JSON.parse(bloco); }
      catch (e) { erroBase = "JSON invalido: " + e.message; }
      if (obj && (typeof obj !== "object" || Array.isArray(obj))) {
        return { ok: false, ordem: vazia, erro: "JSON nao e um objeto", bloco, normalizacoes: [] };
      }
    }
    // F6: SALVAMENTO PARCIAL. Se o objeto inteiro nao parseia, tenta cada campo
    // por si — construir e envios sao independentes, e um '}' perdido num nao
    // pode apagar o outro (T10 do Nemotron, 17/08: perdeu 2 construcoes validas
    // junto com 1 envio quebrado). ok fica FALSE (a resposta FOI invalida — a
    // metrica nao mente), mas as ordens recuperaveis executam.
    if (!obj && erroBase) {
      const c = extrairArrayDoCampo(textoCru, "construir");
      const e = extrairArrayDoCampo(textoCru, "envios") || extrairArrayDoCampo(textoCru, "ataques");
      if (c || e) {
        obj = {
          construir: c || [], envios: e || [],
          plano: extrairStringDoCampo(textoCru, "plano"),
          depoimento: extrairStringDoCampo(textoCru, "depoimento"),
        };
        salvamento = true;
      }
    }
    if (!obj) return { ok: false, ordem: vazia, erro: erroBase, bloco, normalizacoes: [] };
    const construirCru = Array.isArray(obj.construir) ? obj.construir : [];
    const envios = Array.isArray(obj.envios) ? obj.envios
      : Array.isArray(obj.ataques) ? obj.ataques : []; // aceita nome antigo
    const normalizacoes = [];
    if (salvamento) {
      normalizacoes.push(`salvamento parcial (${erroBase}): construir ${construirCru.length} item(ns), envios ${envios.length} item(ns) recuperados`);
    }
    // P4 (F6): campo `quantidade` no construir — {"aldeiaId":12,"tipo":"lanceiro",
    // "quantidade":8} vale por 8 ordens de 1. Mata a classe de falha do T7 do
    // Nemotron (loop de 44 objetos identicos ate os 32k tokens) e corta o custo
    // de resposta. Expande AQUI (choke point unico): motor, diagnostico e log
    // continuam a ver ordens unitarias, nada muda rio abaixo. Aceita tambem o
    // alias "count". Sem o campo, vale 1 (compativel com todo o historico).
    const construir = [];
    for (const c of construirCru) {
      if (!c || typeof c !== "object") { construir.push(c); continue; }
      const qCru = (c.quantidade != null) ? c.quantidade : c.count;
      let q = Math.floor(Number(qCru));
      if (qCru == null || !isFinite(q)) q = 1;
      if (q < 1) q = 1;
      const teto = 300; // teto de sanidade (= limite_tropas_aldeia); o motor corta pelo recurso de qualquer forma
      if (q > teto) { normalizacoes.push(`construir [${c.aldeiaId}]: quantidade ${q} limitada a ${teto}`); q = teto; }
      if (q > 1) normalizacoes.push(`construir [${c.aldeiaId}]: quantidade ${q} expandida em ${q} ordens de 1`);
      for (let i = 0; i < q; i++) construir.push({ aldeiaId: c.aldeiaId, tipo: c.tipo });
    }
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
    // v5: os dois resumos saem do MESMO objeto, mas NAO entram na `ordem` —
    // o motor nao os executa. Texto solto e limitado a 600 chars para um modelo
    // verborragico nao inchar o prompt do turno seguinte sem limite.
    const txt = (v) => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t ? t.slice(0, 600) : null;
    };
    return {
      // salvamento: ok=false (a resposta FOI invalida; a metrica de formato nao
      // mente) mas a ordem recuperada executa e o erro diz a causa real.
      ok: !salvamento, ordem: { construir, envios }, erro: salvamento ? erroBase : null,
      bloco, normalizacoes,
      plano: txt(obj.plano), depoimento: txt(obj.depoimento),
    };
  }

  // Guarda a nota do Rei para o proximo turno. Chamada pelo caller (browser ou
  // runner) depois de parsear a resposta — o motor nao fala com a API, entao
  // nao pode buscar isto sozinho. `null`/vazio limpa (o Rei nao deixou nota).
  function guardarPlano(estado, dono, plano) {
    if (!estado) return;
    if (!estado.planosAnteriores) estado.planosAnteriores = { A: null, B: null };
    const t = (typeof plano === "string") ? plano.trim() : "";
    estado.planosAnteriores[dono] = t ? t.slice(0, 600) : null;
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
    const avisos = [];
    const aceitoConstruir = [], aceitoEnvios = [];
    const construir = (ordem && Array.isArray(ordem.construir)) ? ordem.construir : [];
    const envios = (ordem && Array.isArray(ordem.envios)) ? ordem.envios : [];

    // CLAMP (Fase 3): quando ligado, o estoque e simulado por origem e REDUZIDO
    // a cada envio aceite, para que dois envios da mesma aldeia no mesmo turno se
    // resolvam por ordem de chegada — igual ao que executarOrdem vai praticar.
    // Desligado: le o.tropas cru e nao reduz (comportamento antigo, byte a byte).
    const clamp = !!estado.config.clamp_envios;
    const stockSim = {};
    const estoque = (o) => {
      if (!clamp) return o.tropas;
      if (!(o.id in stockSim)) stockSim[o.id] = { lanceiro: o.tropas.lanceiro, arqueiro: o.tropas.arqueiro, cavaleiro: o.tropas.cavaleiro };
      return stockSim[o.id];
    };

    const recSim = {};   // recursos restantes por aldeia (simula o gasto do turno)
    const forcaSim = {}; // forca comprometida por aldeia (simula o teto de producao)
    const limite = estado.config.limite_tropas_aldeia;
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
      if (!(c.aldeiaId in forcaSim)) forcaSim[c.aldeiaId] = tropasComprometidas(estado, a);
      if (limite != null && forcaSim[c.aldeiaId] >= limite) {
        rejeicoes.push(`construir [${c.aldeiaId}]: no teto de tropas (${forcaSim[c.aldeiaId]}/${limite}) - producao parada`);
        continue;
      }
      if (!(c.aldeiaId in recSim)) recSim[c.aldeiaId] = { madeira: a.recursos.madeira, ferro: a.recursos.ferro };
      const r = recSim[c.aldeiaId];
      if (r.madeira < def.custo.madeira || r.ferro < def.custo.ferro) {
        rejeicoes.push(`construir [${c.aldeiaId}]: recurso insuficiente p/ ${c.tipo} (tem ${r.madeira}m/${r.ferro}f, custa ${def.custo.madeira}m/${def.custo.ferro}f)`);
        continue;
      }
      r.madeira -= def.custo.madeira; r.ferro -= def.custo.ferro;
      forcaSim[c.aldeiaId] += 1; // v3: o teto conta UNIDADES, +1 por construcao
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
      const est = estoque(o);
      const faltam = TIPOS.filter((t) => pedido[t] > est[t]);
      if (faltam.length) {
        if (clamp) {
          // CLAMP por tipo ao estoque restante. Zera apos ajuste -> RECUSA (nao
          // e envio fantasma). Senao, envia o que ha e AVISA (nunca silencioso).
          const ajust = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
          let total = 0;
          for (const t of TIPOS) { ajust[t] = Math.min(pedido[t], est[t]); total += ajust[t]; }
          if (total === 0) {
            rejeicoes.push(`envio [${e.origemId}]->[${e.destinoId}]: zero tropas apos ajuste`);
            continue;
          }
          for (const t of TIPOS) est[t] -= ajust[t];
          const cortes = TIPOS.filter((t) => pedido[t] > ajust[t]).map((t) => `pediu ${pedido[t]} ${t}, enviado ${ajust[t]}`);
          avisos.push(`envio [${e.origemId}]->[${e.destinoId}]: FOI executado, com a quantidade reduzida ao estoque real (${cortes.join("; ")})`);
          aceitoEnvios.push({ origemId: e.origemId, destinoId: e.destinoId, tropas: ajust, alvo: d, ajustado: true, pedido });
          continue;
        }
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
      if (clamp) for (const t of TIPOS) est[t] -= pedido[t]; // reduz p/ o proximo envio da mesma origem
      aceitoEnvios.push({ origemId: e.origemId, destinoId: e.destinoId, tropas: pedido, alvo: d });
    }

    return { aceitoConstruir, aceitoEnvios, rejeicoes, avisos };
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

  // Chave pseudo-aleatoria SEMEADA da partida para desempatar alvos (L4/#2,
  // 04/08). Funcao pura de (seed, turno, origem, alvo): deterministica (mesma
  // seed -> mesmo jogo) e SEM LADO — ao contrario do id, que favorecia o Oeste
  // (ids baixos) nos empates, e cujos empates ainda AUMENTAM com custo inteiro.
  function chaveRngAlvo(seed, turno, origemId, alvoId) {
    let h = (seed >>> 0) || 1;
    h = Math.imul(h ^ (turno | 0), 0x9E3779B1);
    h = Math.imul(h ^ (origemId | 0), 0x85EBCA77);
    h = Math.imul(h ^ (alvoId | 0), 0xC2B2AE3D);
    return criarRng(h >>> 0)();
  }

  // melhor alvo: entre os que podemos vencer (defesa*margem < forca), o de MENOR
  // CUSTO DE ROTA (a mesma fonte que o motor marcha, nao pixel — conserta o L4).
  // Desempate: [custoRota, defesa, rng]. O rng semeado substitui o id (o id nao
  // tem lado nenhum a defender; ver chaveRngAlvo). ctx.custoRota(alvoId) vem do
  // caller (rede da visao); sem ctx (estados sinteticos) cai na distancia reta.
  function melhorAlvo(origem, alvos, forca, config, ctx) {
    const margem = config.jogador.margem_ataque;
    let melhor = null, melhorChave = null;
    for (const t of alvos) {
      if (t.forcaDefesa * margem >= forca) continue;
      const d = (ctx && ctx.custoRota) ? ctx.custoRota(t.id) : Math.hypot(origem.x - t.x, origem.y - t.y);
      const r = (ctx && ctx.rngDe) ? ctx.rngDe(t.id) : t.id; // fallback so p/ estados sem rede/seed
      const chave = [d, t.forcaDefesa, r];
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
    // Rede da visao -> custo de rota (mesma que o motor marcha). Sem rede
    // (estados sinteticos) o melhorAlvo cai na distancia reta. L4: NUNCA decidir
    // por pixel quando ha rede.
    const shim = visao.estradas
      ? { config: cfg, estradas: { adj: visao.estradas, custo: visao.estradasCusto || null },
          aldeias: visao.minhas.concat(visao.alvos) }
      : null;
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
      // 2) enviar (unificado: aqui o burro so ataca o alvo de menor custo de rota vencivel)
      const forca = ataqueDe(a.tropas, cfg); // v3: poder de ATAQUE da guarnicao
      if (forca > 0) {
        const ctx = {
          custoRota: shim ? (alvoId) => { const cam = caminhoEntre(shim, a.id, alvoId); return cam ? pesoRota(shim, cam) : Infinity; } : null,
          rngDe: (alvoId) => chaveRngAlvo(cfg.seed, visao.turno, a.id, alvoId),
        };
        const alvo = melhorAlvo(a, visao.alvos, forca, cfg, ctx);
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
    if (!estado.avisosAnteriores) estado.avisosAnteriores = {};
    if (!ordem || typeof ordem !== "object") {
      estado.rejeicoesAnteriores[dono] = []; estado.avisosAnteriores[dono] = []; return;
    }
    // Um so diagnostico e a fonte da verdade: dele saem as rejeicoes e os avisos
    // (para o proximo relatorio) e, no modo clamp, os proprios envios a executar
    // (ja clampados ao estoque). Assim o que se loga e o que se executa nao podem
    // divergir.
    const diag = diagnosticarOrdem(estado, dono, ordem);
    estado.rejeicoesAnteriores[dono] = diag.rejeicoes;
    estado.avisosAnteriores[dono] = diag.avisos || [];
    const construir = Array.isArray(ordem.construir) ? ordem.construir : [];
    for (const c of construir) {
      if (!c || typeof c !== "object") continue;
      const a = aldeiaPorId(estado, c.aldeiaId);
      if (a && a.dono === dono) enfileirarConstrucao(estado, c.aldeiaId, c.tipo);
    }
    if (estado.config.clamp_envios) {
      // CLAMP PADRAO: executa exatamente os envios que o diagnostico resolveu
      // (clampados ao estoque, na ordem, sem os que zeraram).
      for (const e of diag.aceitoEnvios) enviarExercito(estado, e.origemId, e.destinoId, e.tropas);
    } else {
      // Comportamento antigo (rejeita quem pede mais do que tem): INALTERADO.
      const envios = Array.isArray(ordem.envios) ? ordem.envios
        : Array.isArray(ordem.ataques) ? ordem.ataques : []; // aceita nome antigo
      for (const e of envios) {
        if (!e || typeof e !== "object") continue;
        const o = aldeiaPorId(estado, e.origemId);
        if (o && o.dono === dono) enviarExercito(estado, e.origemId, e.destinoId, sanitizarTropas(e.tropas));
      }
    }
  }

  // (6) DECISAO: cada jogador vivo monta visao, decide e executa.
  function decidirEExecutar(estado, decisores) {
    // LOTE E, E1 — ordens simultaneas (achado A1). Com a flag ligada, as DUAS
    // ordens saem da MESMA fotografia do estado (ninguem executou ainda) e so
    // depois se executam em sequencia A->B. Isso tira do Rei B a visao dos envios
    // que A ordenou NESTE turno (no caminho antigo, executarOrdem(A) empurrava os
    // movimentos de A antes de montarVisao(B), e montarVisao inclui `transito`).
    // Seguranca: a execucao segue sequencial e determinista — executarOrdem(A) so
    // muta aldeias/movimentos de A e rejeicoesAnteriores[A]; diagnosticarOrdem(B)
    // le apenas aldeias/estoque/teto de B (verificado). Conquista acontece no tick,
    // nao aqui, entao A nunca remove um destino que B referencie.
    if (estado.config.ordensSimultaneas === false) {
      // caminho antigo (decide-e-executa em sequencia), INALTERADO / byte a byte.
      for (const dono of ["A", "B"]) {
        if (!aldeiasDe(estado, dono).length) continue; // morto nao decide
        const decisor = (decisores && decisores[dono]) || jogadorBurro;
        executarOrdem(estado, dono, decisor(montarVisao(estado, dono)));
      }
      return;
    }
    const vivos = [], ordens = {};
    for (const dono of ["A", "B"]) {
      if (!aldeiasDe(estado, dono).length) continue; // morto nao decide
      const decisor = (decisores && decisores[dono]) || jogadorBurro;
      ordens[dono] = decisor(montarVisao(estado, dono)); // ninguem executou ainda
      vivos.push(dono);
    }
    for (const dono of vivos) executarOrdem(estado, dono, ordens[dono]);
  }

  // jogador vivo = possui >=1 aldeia. Regra literal da spec: perdeu a ULTIMA
  // aldeia, perdeu a partida (exercito em transito sem base nao salva).
  function jogadorVivo(estado, dono) {
    return aldeiasDe(estado, dono).length > 0;
  }

  // (7) VITORIA por dominancia (v4) OU eliminacao. null = partida continua.
  function checarVitoria(estado) {
    // v4: >=vitoriaFracao das aldeias por vitoriaTurnos consecutivos. Leitura
    // pura de estado.dominancia (o contador vive no tick). Ambos nunca passam
    // o limiar juntos (2x75% > 100%), entao no maximo um vence aqui.
    if (estado.config.vitoriaPorDominancia && estado.dominancia) {
      const need = estado.config.vitoriaTurnos || 2;
      if (estado.dominancia.A >= need) return "A";
      if (estado.dominancia.B >= need) return "B";
    }
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
    // Motivo do fim, ANTES de qualquer desempate de teto.
    const needVit = ((config || CONFIG).vitoriaTurnos) || 2;
    let motivo;
    if (vencedor === "empate") motivo = "empate";
    else if (vencedor) motivo = (estado.dominancia && estado.dominancia[vencedor] >= needVit) ? "dominancia" : "eliminacao";
    else motivo = "limite";
    // v4: bateu o teto sem vitoria -> desempata por numero de aldeias, para a
    // partida SEMPRE sair com um vencedor. Regras antigas: mantem "limite".
    if (!vencedor && (config || CONFIG).vitoriaPorDominancia) {
      const na = aldeiasDe(estado, "A").length, nb = aldeiasDe(estado, "B").length;
      vencedor = na > nb ? "A" : nb > na ? "B" : "empate";
      motivo = vencedor === "empate" ? "empate" : "limite_aldeias";
    }
    return {
      vencedor: vencedor || "limite",
      motivo,
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
    const teto = cfg.limite_tropas_aldeia;
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
      L.push(`  T${c.turno}: Rei ${c.atacante} tomou [${c.alvoId}] ${c.alvoNome} (Fatk ${c.Fatk} vs Fdef ${c.Fdef}, ef ${c.FatkEf} vs ${c.FdefEf}, v=${c.vantagem})`);
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
    CONFIG_V3_ARQUIVO,
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
    tropasComprometidas,
    ataqueDe,
    defesaDe,
    contarTropas,
    tipoDominante,
    regrasCombateTexto,
    preverCombateTipos,
    regrasEconomiaTexto,
    regrasMovimentoTexto,
    preverCombate,
    minimoParaTomar,
    vantagem,
    resolverCombate,
    distancia,
    velExercito,
    turnosViagem,
    turnosPorDist,
    construirEstradas,
    caminhoEntre,
    distanciaRota,
    // Iberia (mapa autoral): peso/marcha por custo de estrada
    pesoTrecho,
    pesoRota,
    turnosDeCaminho,
    estradasIberia,
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
    // P4 (17/08): fog of war + prompt ingles + parser tolerante
    visiveisPara,
    registrarAvistamentos,
    relatorioTextoP4,
    montarPromptP4,
    diagnosticarBloco,
    guardarPlano,
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