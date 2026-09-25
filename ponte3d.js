// ponte3d.js — O QUE O MOTOR MANDA AO MAPA.
//
// ── PORQUE E UM FICHEIRO ───────────────────────────────────────────────────
// Esta e a unica porta entre a partida e o desenho. Tudo o que se ve no mapa
// -- de quem e cada aldeia, quantas tropas tem, onde vai cada exercito, onde
// se lutou -- passa por aqui, e nada mais do jogo fala com o mapa.
//
// Tres regras da casa vivem nestas linhas, e sao a razao de ela ter um nome:
//
//   1. O FOG E O MESMO DO PROMPT. A aldeia que o Rei nao ve chega ao mapa sem
//      dono e sem tropas, ou com a ULTIMA FOTOGRAFIA que ele teve dela. Sai de
//      `Engine.visiveisPara` e de `game.visto`, que sao as mesmas fontes do
//      relatorio. Se divergirem, o mapa esta a mentir ao espectador -- o pior
//      caso, porque a narracao passaria a contar outra partida.
//   2. A MARCHA E A DO MOTOR. A posicao sai de `Engine.posicaoRota`, medida no
//      mesmo peso de rota que conta os turnos, nunca em pixeis. "O numero que o
//      decisor le tem de ser o que o motor executa" ja foi quebrado tres vezes.
//   3. A COMPOSICAO VAI INTEIRA. Achatar o exercito ao tipo dominante fazia o
//      mapa desenhar doze arqueiros para uma coluna que levava lanceiros.
//
// Medida a fronteira antes de mexer: precisa de quatro coisas -- o mapa, o
// estado, os olhos de quem observa e o progresso da marcha -- e devolve duas.
//
// No navegador entra por `<script src>` e fica em `window.Ponte3D`; no Node dos
// smokes entra por `require`, como o `engine.js` e o `marcas.js`.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Ponte3D = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ── QUANTO DURA UMA BATALHA DE ESTRADA, EM TURNOS (23/09) ──────────────────
  // Uma conta, um sitio: o mapa usa-a para a cena, o `progMarcha` do jogo para
  // saber quando o vencedor volta a andar. `s` e o instante do encontro no
  // turno (`sEncontro` do motor, 0 a 1). A cena ocupa 60% do que falta do
  // turno, e nunca menos de um quarto de turno -- um encontro mesmo no fim do
  // turno transborda no maximo 0,25 para o seguinte. Sem `s` (replays de antes
  // de 23/09), meio turno.
  function janelaCena(s) {
    if (s === null || s === undefined || !Number.isFinite(s)) return 0.5;
    return Math.max(0.25, 0.6 * (1 - s));
  }

  // ── O QUE SE VE DE UMA LUTA DE ESTRADA (23/09, a proposta do Lucas) ────────
  // "Ao olhar o jogo de cima, voce ve as caixas azuis e vermelhas a correr pelo
  // mapa; quando duas vem uma em direcao a outra, param uma de frente para a
  // outra, a perdedora some, e a outra continua."
  //
  // Nao ha cena de figuras no jogo -- ela abria noutro sitio do troco e
  // escondia as duas colunas, que no ecra "sumiam". Quem luta sao as colunas.
  //
  // ⚠ O MAPA INTEIRO PAUSA, nao so as duas. Parar so quem luta atrasava a
  // vencedora em relacao ao motor, e nesse atraso outras colunas inimigas
  // passavam por ela sem lutar (321 em 4014 combates do jogador-base, medido
  // com o `medir-cruzamentos.js`). Com uma pausa de TODOS no instante de cada
  // luta ninguem se desencontra do motor. As pausas cabem no turno: o resto do
  // movimento anda um pouco mais depressa para as compensar.
  //
  // `planoDoTurno(eventos)` recebe os combates de estrada do turno (com
  // `sEncontro`) e devolve, para a animacao `r` (0 a 1 entre dois quadros):
  //   f(chave, r)       -> a fracao do turno do MOTOR em que a coluna se desenha
  //   visivel(chave, r) -> se a coluna ainda se ve (a perdedora some)
  // `chave` = dono:origem>destino. Uma conta so: o jogo e o medidor usam esta.
  const FOLGA_LUTA = 0.05;     // param um pouco ANTES do encontro: frente a frente, sem se sobreporem
  const PAUSA_MAX = 0.15;      // uma pausa, em fracao do turno de animacao
  const PAUSAS_TOTAL = 0.45;   // todas as pausas de um turno juntas nunca passam disto
  const JUNTAR = 0.02;         // lutas a menos disto umas das outras partilham a pausa
  // ── A IDENTIDADE DE UMA MARCHA (25/09) ──────────────────────────────────
  // O id que o motor da a cada marcha. Replays de antes de 25/09 nao o tem, e
  // ai volta a chave antiga (dono:origem>destino) -- que colide quando o mesmo
  // Rei manda duas colunas da mesma aldeia ao mesmo destino.
  function chaveMarcha(m) {
    return m.id != null ? "#" + m.id : m.dono + ":" + m.origemId + ">" + m.destinoId;
  }
  // A identidade de CADA coluna no desenho, para uma lista de marchas de um
  // quadro: o id do motor; em replays antigos, a chave antiga + o turno de
  // partida + a ordem entre iguais (o mesmo Rei pode mandar duas colunas da
  // mesma aldeia ao mesmo destino no mesmo turno -- 3 vezes na P1 de 23/09).
  // A ordem da lista de marchas e estavel de um quadro para o seguinte.
  function idsDesenho(movimentos, turno) {
    const vistos = new Map();
    return (movimentos || []).map((m) => {
      if (m.id != null) return "#" + m.id;
      const base = chaveMarcha(m) + "@" + (turno - ((m.turnosTotal || 0) - (m.turnosRestantes || 0)));
      const n = vistos.get(base) || 0;
      vistos.set(base, n + 1);
      return n ? base + "/" + n : base;
    });
  }
  const chaveLuta = (id, dono, de, para) => (id != null ? "#" + id : dono + ":" + de + ">" + para);
  function planoDoTurno(eventos) {
    const lutas = (eventos || []).filter((e) => e.tipo === "combate_estrada" && Number.isFinite(e.sEncontro));
    const inst = [];
    for (const s of lutas.map((e) => e.sEncontro).sort((a, b) => a - b)) {
      if (!inst.length || s - inst[inst.length - 1] > JUNTAR) inst.push(s);
    }
    const H = inst.length ? Math.min(PAUSA_MAX, PAUSAS_TOTAL / inst.length) : 0;
    const anda = 1 - H * inst.length;          // parte da animacao em movimento
    // as pausas no eixo da animacao: entre `a` e `b` o motor esta parado em `s`
    const pausas = [];
    let sAnt = 0, fimAnt = 0;
    for (const s of inst) {
      const a = fimAnt + (s - sAnt) * anda;
      pausas.push({ s, a, b: a + H });
      sAnt = s; fimAnt = a + H;
    }
    function motor(r) {
      let sP = 0, bP = 0;
      for (const p of pausas) {
        if (r < p.a) return sP + (r - bP) / anda;
        if (r <= p.b) return p.s;
        sP = p.s; bP = p.b;
      }
      return Math.min(1, sP + (r - bP) / anda);
    }
    const pausaDe = (s) => {
      let melhor = null;
      for (const p of pausas) if (p.s <= s + 1e-9) melhor = p;
      return melhor;
    };
    const porColuna = new Map();
    for (const e of lutas) {
      for (const [k, dono] of [[chaveLuta(e.atkId, e.atacante, e.atkOrigemId, e.atkDestinoId), e.atacante],
                               [chaveLuta(e.defId, e.defensor, e.defOrigemId, e.defDestinoId), e.defensor]]) {
        if (!porColuna.has(k)) porColuna.set(k, []);
        porColuna.get(k).push({ s: e.sEncontro, venceu: e.vencedorDono === dono });
      }
    }
    for (const l of porColuna.values()) l.sort((a, b) => a.s - b.s);
    // ── A VENCEDORA FECHA A FOLGA DENTRO DA PAUSA (25/09) ──────────────────
    // Recuperar o atraso DEPOIS da luta dava dois defeitos medidos pelo
    // verificar-replay.js: um salto de ~10 px quando a coluna lutava duas vezes
    // no mesmo turno, e uma costura na troca de quadro quando a luta era no
    // ultimo instante. Agora a vencedora avanca ate ao ponto do encontro na
    // segunda metade da pausa -- com o mapa parado -- e quando ele volta a andar
    // ja esta onde o motor a tem. Nao ha atraso para recuperar.
    function f(k, r) {
      const re = motor(r);
      const l = porColuna.get(k);
      if (!l) return re;
      // `piso`: onde a coluna ja chegou numa luta anterior deste turno -- a
      // paragem da seguinte nunca fica atras disso (a coluna recuava 0,014)
      let piso = 0;
      for (const x of l) {
        const p = pausaDe(x.s);
        if (p && r > p.b) { piso = Math.max(piso, p.s); continue; }   // esta luta ja passou
        if (!p) continue;
        const parada = Math.max(piso, x.s - FOLGA_LUTA);
        if (r < p.a) return Math.min(re, parada);        // a caminho dela
        const meio = (p.a + p.b) / 2;
        if (r <= meio || !x.venceu) return parada;       // frente a frente
        return parada + (p.s - parada) * (r - meio) / Math.max(1e-9, p.b - meio);
      }
      return re;
    }
    function visivel(k, r) {
      const l = porColuna.get(k);
      if (!l) return true;
      const perdeu = l.find((x) => !x.venceu);
      if (!perdeu) return true;
      const p = pausaDe(perdeu.s);
      // some a meio da pausa da luta dela
      return p ? r < (p.a + p.b) / 2 : motor(r) < perdeu.s;
    }
    return { f, visivel, motor, pausas };
  }

  function criar(dep) {
    const Engine = dep.Engine;
    // o que vem do jogo; `sincronizar` mantem-nos em dia
    let M3D = null, game = null;
    let reiObservado = function () { return null; };
    let progMarcha = function () { return 1; };
    // o relogio do replay: turno + fracao (null ao vivo, onde nao ha fracao)
    let relogio = function () { return null; };
    // a coluna ainda se ve? (a perdedora de uma luta de estrada some)
    let visivel = function () { return true; };
    // os combates de estrada do quadro SEGUINTE cujo instante ja passou na
    // animacao (so no replay; ao vivo nao ha quadro seguinte)
    let eventosPorVir = function () { return []; };
    function sincronizar(d) {
      if (!d) return;
      if ("M3D" in d) M3D = d.M3D;
      if ("game" in d) game = d.game;
      if (typeof d.reiObservado === "function") reiObservado = d.reiObservado;
      if (typeof d.progMarcha === "function") progMarcha = d.progMarcha;
      if (typeof d.relogio === "function") relogio = d.relogio;
      if (typeof d.visivel === "function") visivel = d.visivel;
      if (typeof d.eventosPorVir === "function") eventosPorVir = d.eventosPorVir;
    }

    function empurrarPara3D() {
      if (!M3D || !game) return;
      // O FOG E O DA CAMARA DO REI, o mesmo seletor que o 2D ja usa. Se o mapa
      // mostrasse tudo enquanto o painel esconde, seriam duas verdades.
      const olhos = reiObservado();     // a MESMA funcao que o fog do 2D usa
      const vis = olhos ? Engine.visiveisPara(game, olhos) : null;
      const lembra = (olhos && game.visto && game.visto[olhos]) || {};
      M3D.atualizar({
        turno: game.turno,
        aldeias: game.aldeias.map((a) => {
          const ve = !vis || vis.has(a.id);
          const lb = lembra[a.id];
          return {
            slug: a.slug,
            dono: ve ? a.dono : (lb ? lb.dono : null),
            tropas: ve ? Engine.contarTropas(a.tropas)
                       : (lb ? Engine.contarTropas(lb.tropas) : null),
            visivel: ve,
            lembrada: ve ? null : (lb ? lb.turno : null),
          };
        }),
        marchas: (function () {
          const todas = game.movimentos || [];
          const ids = idsDesenho(todas, game.turno);
          return todas.map((m, i) => [m, ids[i]]).filter(([m]) => visivel(m));
        })().map(([m, idDesenho]) => {
          // a posicao e a do MOTOR (`posicaoRota` anda pelo peso da rota, nao por
          // pixel), mas com o progresso ja avancado dentro do turno -- entrega-se
          // um `turnosRestantes` fracionario a mesma funcao em vez de reimplementar
          // o passeio pela rota aqui fora
          const prog = progMarcha(m);
          const pos = Engine.posicaoRota(game, m.turnosTotal
            ? Object.assign({}, m, { turnosRestantes: m.turnosTotal * (1 - prog) })
            : m);
          if (!pos) return null;
          const a = Engine.aldeiaPorId(game, pos.aId);
          const b = Engine.aldeiaPorId(game, pos.bId);
          if (!a || !b) return null;
          // se o Rei escolhido nao ve nenhuma das duas pontas, a marcha nao
          // aparece -- e o mesmo criterio do relatorio que ele recebe
          if (vis && !vis.has(a.id) && !vis.has(b.id)) return null;
          return { id: idDesenho, de: a.slug, para: b.slug, t: pos.t, dono: m.dono,
                   // ── A COMPOSICAO INTEIRA, E NAO O TIPO DOMINANTE ──────────
                   // Isto achatava o exercito a UM tipo, e o mapa desenhava doze
                   // arqueiros para um exercito que levava lanceiros la dentro.
                   // Nao era uma decisao de desenho: era informacao do motor
                   // deitada fora no caminho, e a regra da casa e que o ecra tem
                   // de mostrar o que o motor executou.
                   composicao: Object.assign({}, m.tropas),
                   // o dominante fica -- e o que decide o matchup no combate, e
                   // ha sitios (a legenda, o simbolo rigido) que ainda o querem
                   tipo: Engine.tipoDominante(game, m.tropas) || "lanceiro",
                   tropas: Engine.contarTropas(m.tropas) };
        }).filter(Boolean),
        // ── OS COMBATES DE ESTRADA, PARA A CENA ───────────────────────────────
        // O evento do motor traz o sitio em coordenadas do MAPA (x, y do viewBox)
        // e o trecho em ids. O mapa 3D anda em METROS e conhece as estradas pelos
        // slugs, portanto a conversao e aqui: slug + fracao ao longo do trecho.
        // A composicao do VENCEDOR nao vem no evento (o motor so guarda a do
        // perdedor, que sai inteiro); tira-se da marcha dele, que sobreviveu.
        // ⚠ SEM CENA DE FIGURAS NO JOGO (23/09): quem luta sao as proprias
        // colunas (ver `planoDoTurno` acima). O `eventosDeEstrada` continua a existir
        // -- e o que o Smoke8 confronta com o motor, e o que a bancada usa.
        eventos: [],
        relogio: relogio(),
      });
    }

    function eventosDeEstrada() {
      if (!game || !game.log) return [];
      const saida = [];
      // ── A CENA ABRE NO INSTANTE DO ENCONTRO (23/09) ─────────────────────────
      // Os do turno que o quadro mostra, e os do turno SEGUINTE que a animacao
      // ja alcancou. Um combate antecipado tem o mesmo `id` quando o quadro
      // dele chegar, e a cena nao abre duas vezes.
      const lista = [];
      for (const e of game.log)
        if (e.tipo === "combate_estrada" && e.turno === game.turno) lista.push([e, false]);
      for (const e of (eventosPorVir() || [])) lista.push([e, true]);
      for (const [e, antecipado] of lista) {
        const a = Engine.aldeiaPorId(game, e.trechoDeId);
        const b = Engine.aldeiaPorId(game, e.trechoParaId);
        if (!a || !b) continue;
        // a fracao: projecao do ponto do encontro no trecho (as duas pontas e o
        // ponto vem todos do mesmo espaco do mapa 2D)
        const vx = b.x - a.x, vy = b.y - a.y;
        const L2 = Math.max(vx * vx + vy * vy, 1e-6);
        const t = Math.max(0, Math.min(1, ((e.x - a.x) * vx + (e.y - a.y) * vy) / L2));
        const somaT = (o) => ["lanceiro", "arqueiro", "cavaleiro"]
          .reduce((s, k) => s + ((o && o[k]) || 0), 0);
        const dele = (game.movimentos || []).find((m) => m.dono === e.vencedorDono
          && m.origemId === e.vencedorOrigemId && m.destinoId === e.vencedorDestinoId);
        const compVenc = dele ? Object.assign({}, dele.tropas) : { lanceiro: 1 };
        // antecipado, a marcha do vencedor ainda e a de ANTES da luta: as
        // baixas ja estao la dentro e nao se somam outra vez
        const totalVenc = somaT(compVenc) + (antecipado ? 0 : (e.baixasVencedor || 0));
        // ── A JANELA DA CENA NO RELOGIO DO REPLAY ────────────────────────────
        // O encontro deu-se no turno `e.turno`, a fracao `sEncontro` dele: no
        // relogio (turno do quadro + fracao da animacao) isso e e.turno-1+s.
        // Sem relogio (ao vivo) a cena fica em segundos, no mapa.
        const agoraT = relogio();
        let inicioT = null, fimT = null;
        if (Number.isFinite(agoraT)) {
          inicioT = e.sEncontro != null ? e.turno - 1 + e.sEncontro : agoraT;
          fimT = inicioT + janelaCena(e.sEncontro);
        }
        saida.push({
          tipo: "combate_estrada",
          id: e.turno + "|" + e.trechoDeId + ">" + e.trechoParaId + "|"
            + e.vencedorDono + e.perdedorDono + "|" + Math.round(e.x) + "," + Math.round(e.y),
          turno: e.turno, de: a.slug, para: b.slug, t,
          vencedor: e.vencedorDono, perdedor: e.perdedorDono,
          compVenc, compPerd: Object.assign({}, e.perdedorTropas || {}),
          totalVenc, inicioT, fimT,
          baixasVenc: e.baixasVencedor || 0,
        });
      }
      return saida;
    }
    return { sincronizar, empurrarPara3D, eventosDeEstrada };
  }

  return { criar, janelaCena, planoDoTurno, chaveMarcha, idsDesenho };
});
