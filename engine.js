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

    // TROPAS: custo / forca / velocidade / turnos para construir.
    // A forca e quase proporcional ao custo de proposito: o
    // cavaleiro paga a mais por velocidade, nao por forca bruta.
    tropas: {
      lanceiro:  { custo: { madeira: 15, ferro: 0  }, forca: 10, vel: "lenta",  turnos: 1 },
      arqueiro:  { custo: { madeira: 20, ferro: 10 }, forca: 15, vel: "media",  turnos: 1 },
      cavaleiro: { custo: { madeira: 30, ferro: 30 }, forca: 30, vel: "rapida", turnos: 2 },
    },

    // TRIANGULO pedra-papel-tesoura: cada tropa VENCE a indicada.
    //   lanceiro > cavaleiro > arqueiro > lanceiro
    // bonus_triangulo: eficiencia da tropa com vantagem (1.5x).
    // (O numero ainda decide o vencedor; o triangulo modula baixas.)
    bonus_triangulo: 1.5,
    triangulo: { lanceiro: "cavaleiro", cavaleiro: "arqueiro", arqueiro: "lanceiro" },

    // COMBATE: atrito_base = fracao da forca do PERDEDOR que o vencedor
    // perde, antes do triangulo. Vencedor sempre sobrevive (com base*m < 1).
    // PROVISORIO.
    combate: { atrito_base: 0.5 },

    // MOVIMENTO (usado na PECA 3): turnos de viagem = ceil(distancia / passo).
    // Cavaleiro rapido, lanceiro lento. Numeros PROVISORIOS, a calibrar.
    // Exercito misto viaja na velocidade da tropa MAIS LENTA.
    velocidade_passo: { lenta: 6, media: 9, rapida: 14 },

    // NEUTRAS (V1): cada neutra e uma FORTALEZA DE UM TIPO SO, sorteado pela
    // seed. Produz/endurece so aquele tipo -> fraqueza permanente pelo triangulo.
    //   tipos_sorteaveis : pool de onde sai o tipo dominante de cada neutra.
    //   forca_min/max    : quantidade inicial (em UNIDADES do tipo sorteado).
    //   endurecimento    : unidades do tipo dominante ganhas por turno.
    neutra: {
      tipos_sorteaveis: ["lanceiro", "arqueiro", "cavaleiro"],
      forca_min: 20, forca_max: 40, endurecimento: 1,
    },

    // TEATRO: regiao contida do mapa 200x200 onde rola a partida.
    // n_aldeias = total (2 reis + neutras). Reis comecam em lados opostos.
    // ESCALA DE TESTE DO 1o REI (V1): 20 aldeias (18 neutras + 2 reis) para o
    // relatorio caber num modelo pequeno. O jogo "de verdade" e ~50; reversivel.
    teatro: { x0: 80, y0: 80, w: 40, h: 40, n_aldeias: 20, min_dist: 3 },

    // JOGADOR BURRO (V0, sem IA): parametros da decisao simples.
    //   composicao_alvo : proporcao desejada do exercito (puxa o mix).
    //   max_construir_por_turno : teto de tropas enfileiradas por aldeia/turno.
    //   margem_ataque : so ataca alvo cuja defesa*margem < nossa forca.
    jogador: {
      composicao_alvo: { lanceiro: 3, arqueiro: 2, cavaleiro: 1 },
      max_construir_por_turno: 6,
      margem_ataque: 1.2,
    },

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
      }
      return ald;
    });

    return {
      config,
      turno: 0,
      aldeias,
      movimentos: [],   // exercitos em transito (PECA 3)
      jogadores: {
        A: { id: "A", nome: "Rei A" },
        B: { id: "B", nome: "Rei B" },
      },
      log: [],
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

  // (5) ENDURECIMENTO: cada neutra ganha +inc unidades do SEU tipo por turno.
  function endurecer(estado) {
    const inc = estado.config.neutra.endurecimento;
    for (const a of estado.aldeias) {
      if (a.dono === null && a.tipo) a.tropas[a.tipo] += inc;
    }
  }

  // ==========================================================
  //  PECA 3  —  MOVIMENTO + COMBATE + CONQUISTA
  // ==========================================================

  const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];

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
  // Tipo que mais contribui em forca (matchup do triangulo). null se sem tipo.
  function tipoDominante(estado, tropas) {
    let best = null, bf = 0;
    for (const t of TIPOS) {
      const f = (tropas[t] || 0) * estado.config.tropas[t].forca;
      if (f > bf) { bf = f; best = t; }
    }
    return best;
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

    // numero decide: atacante so vence se SUPERA (empate -> defensor segura)
    const atacanteVence = Fatk > Fdef;
    const Fwin = atacanteVence ? Fatk : Fdef;
    const Flose = atacanteVence ? Fdef : Fatk;

    // vantagem do VENCEDOR sobre o perdedor -> multiplicador de baixas
    const vWin = atacanteVence
      ? vantagem(estado, atkType, defType)
      : vantagem(estado, defType, atkType);
    const m = vWin > 0 ? 1 / cfg.bonus_triangulo : vWin < 0 ? cfg.bonus_triangulo : 1;

    let baixasForca = Flose * cfg.combate.atrito_base * m;
    baixasForca = Math.min(baixasForca, Fwin); // nunca mais do que o vencedor tem
    const fracao = Fwin > 0 ? baixasForca / Fwin : 0;

    const rep = {
      tipo: "combate",
      turno: estado.turno,
      alvoId: alvo.id, alvoNome: alvo.nome,
      atacante: exercito.dono,
      Fatk, Fdef, m,
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
  function turnosViagem(estado, origem, destino, tropas) {
    const d = distancia(origem, destino);
    const passo = estado.config.velocidade_passo[velExercito(estado, tropas)];
    return Math.max(1, Math.ceil(d / passo));
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
    const turnos = turnosViagem(estado, o, d, carga);
    const mov = { dono: o.dono, origemId, destinoId, tropas: carga, turnosRestantes: turnos, turnosTotal: turnos };
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

  // (3+4) MOVIMENTO + COMBATE: avanca transitos; os que chegam resolvem.
  function avancarMovimentos(estado) {
    const chegaram = [], viajando = [];
    for (const m of estado.movimentos) {
      m.turnosRestantes -= 1;
      (m.turnosRestantes <= 0 ? chegaram : viajando).push(m);
    }
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
        const baixas = euAtaquei ? ` (suas baixas: ${ev.baixasForca} de forca)` : "";
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
  function relatorioTexto(visao) {
    const cfg = visao.config;
    const me = visao.dono;
    const inimigo = me === "A" ? "B" : "A";
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

    // FORCA TOTAL
    const forcaCasa = visao.minhas.reduce((s, a) => s + forcaDe(a.tropas, cfg), 0);
    const forcaTransito = visao.transito.filter((m) => m.dono === me).reduce((s, m) => s + forcaDe(m.tropas, cfg), 0);
    L.push(`=== FORCA TOTAL ===`);
    L.push(`Sua forca em casa: ${forcaCasa}   |   Sua forca em transito: ${forcaTransito}`);
    L.push("");

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
    const origem = minhas.length ? minhas[0].id : 0;       // id real de uma aldeia minha
    const alvoAtk = alvos.length ? alvos[0].id : origem;   // id real de um alvo (neutra/inimigo)
    const tropas = (l, a, c) => `{"lanceiro": ${l}, "arqueiro": ${a}, "cavaleiro": ${c}}`;

    const envios = [
      `    {"origemId": ${origem}, "destinoId": ${alvoAtk}, "tropas": ${tropas(10, 0, 0)}}`,
    ];
    // 2a linha mostra o molde com os 3 tipos preenchidos; destino = outro id real.
    const segundoDestino = minhas.length >= 2 ? minhas[1].id : (alvos.length >= 2 ? alvos[1].id : null);
    if (segundoDestino != null) {
      envios.push(`    {"origemId": ${origem}, "destinoId": ${segundoDestino}, "tropas": ${tropas(0, 5, 0)}}`);
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
  function montarPrompt(visao) {
    const L = [];
    // TOPO: identidade + tarefa (curto)
    L.push('Voce e o Rei. As aldeias listadas em "SUAS ALDEIAS" pertencem a voce.');
    L.push("Seu objetivo e vencer eliminando o inimigo.");
    L.push("");
    // MEIO: dados do turno (relatorio integral)
    L.push(relatorioTexto(visao));
    L.push("");
    // FIM: instrucao de formato -> permissao de vazio -> processo -> exemplo (ultimo)
    L.push("Responda APENAS com um JSON valido no formato abaixo. Nenhum texto antes ou depois do JSON.");
    L.push("");
    L.push("Listas vazias sao uma resposta valida. Se uma aldeia nao deve atacar nem construir neste turno, simplesmente nao a inclua. E melhor nao fazer nada do que enviar um ataque ruim ou construir sem motivo.");
    L.push("");
    // INSTRUCAO DE PROCESSO (curta, logo antes do exemplo): forca o modelo a
    // ancorar nos ids REAIS da visao em vez de copiar numeros do exemplo.
    L.push("Antes de responder: em 'origemId' e em 'aldeiaId' use SOMENTE ids que aparecem na secao SUAS ALDEIAS. Escolha o 'destinoId' entre os ids das secoes ALDEIAS NEUTRAS e INIMIGO. Nao envie tropas que voce nao tem: se uma aldeia esta sem tropas, nao a use em 'envios'. O exemplo abaixo so mostra o FORMATO com ids reais deste turno; nao copie os numeros dele como se fossem sua jogada.");
    L.push("");
    L.push(exemploAncorado(visao));
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

  // parsearOrdem(textoCru) -> { ok, ordem, erro, bloco }.
  // SEM RETRY (decisao de design: medir a taxa CRUA de falha do qwen).
  // Qualquer falha -> ORDEM VAZIA (o Rei "passa" o turno) + erro p/ o log.
  // NUNCA lanca.
  function parsearOrdem(textoCru) {
    const vazia = { construir: [], envios: [] };
    const bloco = extrairBlocoJSON(textoCru);
    if (bloco == null) return { ok: false, ordem: vazia, erro: "nenhum bloco {...} na resposta", bloco: null };
    let obj;
    try { obj = JSON.parse(bloco); }
    catch (e) { return { ok: false, ordem: vazia, erro: "JSON invalido: " + e.message, bloco }; }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return { ok: false, ordem: vazia, erro: "JSON nao e um objeto", bloco };
    }
    const construir = Array.isArray(obj.construir) ? obj.construir : [];
    const envios = Array.isArray(obj.envios) ? obj.envios
      : Array.isArray(obj.ataques) ? obj.ataques : []; // aceita nome antigo
    return { ok: true, ordem: { construir, envios }, erro: null, bloco };
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

    const recSim = {}; // recursos restantes por aldeia (simula o gasto do turno)
    for (const c of construir) {
      if (!c || typeof c !== "object") { rejeicoes.push("construir: item nao e objeto"); continue; }
      const a = aldeiaPorId(estado, c.aldeiaId);
      if (!a) { rejeicoes.push(`construir: aldeia [${c.aldeiaId}] nao existe`); continue; }
      if (a.dono !== dono) { rejeicoes.push(`construir: aldeia [${c.aldeiaId}] nao e sua`); continue; }
      const def = estado.config.tropas[c.tipo];
      if (!def) { rejeicoes.push(`construir [${c.aldeiaId}]: tipo invalido "${c.tipo}"`); continue; }
      if (!(c.aldeiaId in recSim)) recSim[c.aldeiaId] = { madeira: a.recursos.madeira, ferro: a.recursos.ferro };
      const r = recSim[c.aldeiaId];
      if (r.madeira < def.custo.madeira || r.ferro < def.custo.ferro) {
        rejeicoes.push(`construir [${c.aldeiaId}]: recurso insuficiente p/ ${c.tipo} (tem ${r.madeira}m/${r.ferro}f, custa ${def.custo.madeira}m/${def.custo.ferro}f)`);
        continue;
      }
      r.madeira -= def.custo.madeira; r.ferro -= def.custo.ferro;
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
      const faltam = TIPOS.filter((t) => pedido[t] > o.tropas[t]);
      if (faltam.length) {
        rejeicoes.push(`envio [${e.origemId}]->[${e.destinoId}]: tropa que nao tem (${faltam.map((t) => `pediu ${pedido[t]} ${t}, tem ${o.tropas[t]}`).join("; ")})`);
        continue;
      }
      if (TIPOS.reduce((s, t) => s + pedido[t], 0) === 0) {
        rejeicoes.push(`envio [${e.origemId}]->[${e.destinoId}]: zero tropas`);
        continue;
      }
      aceitoEnvios.push({ origemId: e.origemId, destinoId: e.destinoId, tropas: pedido, alvo: d });
    }

    return { aceitoConstruir, aceitoEnvios, rejeicoes };
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
    if (!ordem || typeof ordem !== "object") return;
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

  return {
    CONFIG,
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
    tipoDominante,
    vantagem,
    resolverCombate,
    distancia,
    velExercito,
    turnosViagem,
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
    sanitizarTropas,
    // V1 Peca 2 (Rei IA): partes puras (prompt + parsing)
    montarPrompt,
    exemploAncorado,
    extrairBlocoJSON,
    parsearOrdem,
    diagnosticarOrdem,
    decidirEExecutar,
    checarVitoria,
    resumoTurno,
    rodarTurno,
    rodarPartida,
  };
});
