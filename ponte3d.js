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

  function criar(dep) {
    const Engine = dep.Engine;
    // o que vem do jogo; `sincronizar` mantem-nos em dia
    let M3D = null, game = null;
    let reiObservado = function () { return null; };
    let progMarcha = function () { return 1; };
    function sincronizar(d) {
      if (!d) return;
      if ("M3D" in d) M3D = d.M3D;
      if ("game" in d) game = d.game;
      if (typeof d.reiObservado === "function") reiObservado = d.reiObservado;
      if (typeof d.progMarcha === "function") progMarcha = d.progMarcha;
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
        marchas: (game.movimentos || []).map((m) => {
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
          return { de: a.slug, para: b.slug, t: pos.t, dono: m.dono,
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
        eventos: eventosDeEstrada(),
      });
    }

    function eventosDeEstrada() {
      if (!game || !game.log) return [];
      const saida = [];
      for (const e of game.log) {
        if (e.tipo !== "combate_estrada" || e.turno !== game.turno) continue;
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
        saida.push({
          tipo: "combate_estrada",
          id: e.turno + "|" + e.trechoDeId + ">" + e.trechoParaId + "|"
            + e.vencedorDono + e.perdedorDono + "|" + Math.round(e.x) + "," + Math.round(e.y),
          turno: e.turno, de: a.slug, para: b.slug, t,
          vencedor: e.vencedorDono, perdedor: e.perdedorDono,
          compVenc, compPerd: Object.assign({}, e.perdedorTropas || {}),
          totalVenc: somaT(compVenc) + (e.baixasVencedor || 0),
          baixasVenc: e.baixasVencedor || 0,
        });
      }
      return saida;
    }
    return { sincronizar, empurrarPara3D, eventosDeEstrada };
  }

  return { criar };
});
