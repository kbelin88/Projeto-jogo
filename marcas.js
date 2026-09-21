// marcas.js — O CADERNO DE MARCAS.
//
// ── PORQUE E UM FICHEIRO ───────────────────────────────────────────────────
// Ate 22/09 estas 540 linhas viviam no meio do `index.html`, entre o duelo de
// LLMs e o fog of war. Nao e codigo de jogo: e uma FERRAMENTA de diagnostico,
// com o seu proprio estado, a sua propria tela e a sua propria barra. Medida a
// fronteira, precisa de quatro coisas do jogo -- o mapa 3D, o estado da
// partida, a geometria do viewBox e o `draw` -- e devolve cinco.
//
// Quatro para dentro, cinco para fora: e pouco, e por isso vale a pena estar
// separado. Um defeito aqui nao pode derrubar uma partida.
//
// ── COMO SE LIGA ───────────────────────────────────────────────────────────
// `Marcas.criar()` devolve o caderno; `sincronizar()` entrega-lhe o que mudou
// (o mapa quando carrega, o estado a cada `draw`). Os nomes de dentro sao os
// mesmos de sempre -- `M3D`, `game`, `IB`, `draw` --, o que mantem o corpo
// exatamente como estava e torna o diff desta mudanca legivel.
//
// No navegador entra por `<script src>` e fica em `window.Marcas`; no Node dos
// smokes entra por `require`, como o `engine.js` ja fazia.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Marcas = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function criar() {
    // o que vem do jogo; `sincronizar` mantem-nos em dia
    let M3D = null, game = null, IB = null;
    let draw = function () {};
    function sincronizar(d) {
      if (!d) return;
      if ("M3D" in d) M3D = d.M3D;
      if ("game" in d) game = d.game;
      if ("IB" in d) IB = d.IB;
      if (typeof d.draw === "function") draw = d.draw;
    }

    // ===== CADERNO DE MARCAS =================================================
    // Ligado por ?marcar no endereco, ou pela tecla M.
    //
    // ── POR QUE ISTO EXISTE ────────────────────────────────────────────────
    // Chegou-se ao ponto em que descrever um defeito por escrito custa mais do
    // que o corrigir: "a estrada de Toledo esta mal encaixada do lado direito" e
    // lento, ambiguo, e obriga-me a procurar. Apontar no mapa nao e. Foi a mesma
    // razao que criou o editor de mapa (o botao "editar mapa") — quando a
    // conversa fica mais cara que o trabalho, faz-se uma ferramenta.
    //
    // ── O QUE SAI DAQUI ────────────────────────────────────────────────────
    // Duas coisas, e nenhuma chega sozinha:
    //   * as marcas em COORDENADAS DO MAPA (viewBox), para eu saber a QUE aldeia
    //     ou a que troco de estrada cada uma pertence, seja qual for o zoom;
    //   * uma imagem do ecra com os riscos por cima, para eu VER o que o Lucas viu.
    // Vao as duas para `marcas/marcas-<data>.json` e `.png`.
    const MARC = {
      ligado: false, cor: 0, a_riscar: null, marcas: [],
      // A LEGENDA E EDITAVEL porque o significado de cada cor muda com o que se
      // esta a arrumar. Hoje sao encaixes; amanha podem ser cores de terreno.
      legenda: ["estrada mal encaixada", "arvore em cima da estrada",
                "portao desalinhado", "tamanho errado", "cor errada", "outra coisa"],
    };
    const MARC_COR = ["#e8443a", "#3a7ae8", "#e8c53a", "#4ac96a", "#c463e8", "#f2f2f2"];
    // exposto de proposito: o codigo todo corre dentro de um bloco fechado, e sem
    // isto nao ha como conferir de fora se uma marca ficou registada.
    //
    // NOTA AO PROXIMO QUE ESCREVER UM COMENTARIO AQUI: nao escreva a etiqueta de
    // abertura de um bloco de codigo por extenso. Os smokes do `testes_arena/`
    // extraem este bloco com `lastIndexOf` da etiqueta -- e uma MENCAO a ela num
    // comentario e encontrada em vez da etiqueta a serio, a fatia comeca a meio
    // de uma frase e cinco testes rebentam com um erro de sintaxe que nao aponta
    // para lado nenhum. Aconteceu.
    if (typeof window !== "undefined") window.MARC = MARC;

    // ── O CADERNO POR CIMA DO MAPA 3D ─────────────────────────────────────────
    // O caderno nasceu colado ao 2D: desenhava dentro do `draw` e convertia o
    // rato com o `panX`/`scale` da camara plana. Com o 3D ligado o `draw` sai a
    // cabeca (o canvas plano deixou de pintar) e aquela conta deixou de querer
    // dizer nada -- o lapis funcionava e nao aparecia um risco.
    //
    // O que NAO muda: uma marca continua gravada em coordenadas do MAPA. E por
    // isso que o `oQueEstaAqui`, o `centroDoRisco` e o `ler_marcas.py` continuam
    // a valer sem lhes tocar. Muda so a conversao para o ecra e onde se pinta.
    let telaMarcas = null;
    function telaDasMarcas() {
      if (telaMarcas) return telaMarcas;
      telaMarcas = document.createElement("canvas");
      telaMarcas.id = "telaMarcas";
      telaMarcas.style.cssText = "position:fixed;inset:0;z-index:40;"
        + "pointer-events:none;display:block";
      // ── E E ELA QUE APANHA O RATO ────────────────────────────────────────
      // O `mousedown` do jogo esta no canvas plano, e com o 3D ligado esse canvas
      // fica ESCONDIDO -- e um elemento escondido nao recebe rato nenhum. O lapis
      // ficava ligado, o cursor mudava, e clicar nao fazia nada. Quem esta por
      // cima e esta tela, portanto e ela que tem de ouvir.
      telaMarcas.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || !MARC.ligado) return;
        if (marcarInicio(e)) e.preventDefault();
      });
      document.body.appendChild(telaMarcas);
      return telaMarcas;
    }

    // ── A CONVERSAO E CALIBRADA, NAO COPIADA ──────────────────────────────────
    // O mapa cozido traz as aldeias em METROS; o `world-iberia` traz as mesmas em
    // viewBox. Duas aldeias chegam para tirar a escala e a origem -- e derivar em
    // vez de repetir as constantes do exportador e o que impede as duas contas de
    // divergirem no dia em que uma delas mudar.
    let _cal = null;
    function calibrar3D() {
      if (_cal || !M3D || typeof Iberia === "undefined") return _cal;
      const A = "lisboa", B = "barcelona";
      const va = Iberia.CIDADES.find((c) => c.id === A);
      const vb = Iberia.CIDADES.find((c) => c.id === B);
      const ma = M3D.MAPA.aldeias[A], mb = M3D.MAPA.aldeias[B];
      if (!va || !vb || !ma || !mb) return null;
      const k = (ma.p[0] - mb.p[0]) / (va.x - vb.x);
      _cal = { k, ox: va.x - ma.p[0] / k, oy: va.y + ma.p[1] / k };
      return _cal;
    }
    const vbParaMetros = (vx, vy) => {
      const c = calibrar3D();
      return c ? [(vx - c.ox) * c.k, -(vy - c.oy) * c.k] : null;
    };
    const metrosParaVb = (mx, my) => {
      const c = calibrar3D();
      return c ? [mx / c.k + c.ox, -my / c.k + c.oy] : null;
    };

    function marcarLigar(v) {
      MARC.ligado = v === undefined ? !MARC.ligado : v;
      const b = document.getElementById("barraMarcas");
      if (b) b.style.display = MARC.ligado ? "flex" : "none";
      if (M3D) M3D.rend.domElement.style.cursor = MARC.ligado ? "crosshair" : "";
      if (M3D) {
        const t = telaDasMarcas();
        // so apanha o rato enquanto o lapis esta ligado: de resto tem de deixar
        // passar tudo, senao a camara deixava de girar
        t.style.pointerEvents = MARC.ligado ? "auto" : "none";
        t.style.cursor = MARC.ligado ? "crosshair" : "";
        desenharMarcas3D();
      }
      if (typeof draw === "function") draw();
    }

    // ── ONDE O RATO ESTA, EM COORDENADAS DO MAPA ──────────────────────────
    // Um risco e gravado em viewBox, nao em pixeis: e isso que o faz continuar a
    // apontar o mesmo sitio depois de girar ou afastar a camara.
    //
    // O ponto sai do CHAO debaixo do cursor -- um raio ate ao terreno --, e a
    // altura guarda-se a parte, que e o que permite voltar a projeta-lo quando a
    // camara mexe sem tornar a perguntar ao terreno.
    function marcarPonto(ev) {
      if (!M3D) return null;
      const r = M3D.rend.domElement.getBoundingClientRect();
      const p = M3D.mundoDoEcra(ev.clientX - r.left, ev.clientY - r.top);
      if (!p) return null;
      const vb = metrosParaVb(p.x, -p.z);
      return vb ? [vb[0], vb[1], p.y] : null;
    }

    // CONFERIR SEM O RATO. Leva um ponto do ecra a coordenadas do mapa e traz de
    // volta; se o erro nao for ~0, a marca vai sair longe do ponteiro. Existe
    // porque ha defeitos de conversao que so aparecem em certos ecras -- o do
    // DPR, em 2026-09, so se via com DPR != 1, e o desta maquina e 1: sem esta
    // funcao eu so podia RACIOCINAR sobre o bug, nao medi-lo.
    function marcarConferir(sx, sy) {
      if (!M3D) return null;
      const p = marcarPonto({ clientX: sx, clientY: sy });
      if (!p) return null;
      const V = new M3D.THREE.Vector3();
      const mm = vbParaMetros(p[0], p[1]);
      V.set(mm[0], p[2] || 0, -mm[1]);
      const e = M3D.ecraDoMundo(V);
      return [e.x - sx, e.y - sy];
    }
    if (typeof window !== "undefined") window.MARC.conferir = marcarConferir;

    function marcarInicio(ev) {
      if (!MARC.ligado || !IB) return false;
      const p = marcarPonto(ev);
      if (!p) return false;                 // clicou no ceu: nao ha sitio nenhum
      MARC.a_riscar = { cor: MARC.cor, pts: [p] };
      return true;
    }

    function marcarMover(ev) {
      if (!MARC.a_riscar) return false;
      const p = marcarPonto(ev);
      if (!p) return true;                  // saiu para o ceu: o risco espera
      const u = MARC.a_riscar.pts[MARC.a_riscar.pts.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) > 2) MARC.a_riscar.pts.push(p);
      draw();
      return true;
    }

    // ── UMA FOTOGRAFIA POR MARCA ────────────────────────────────────────
    // O caderno guardava UM print do ecra inteiro. Mas marcar e um trabalho de
    // aproximar: o Lucas fez tres marcas em tres sitios e tres zooms diferentes,
    // e o print so mostrava a ultima — as outras duas chegavam-me como
    // coordenadas cegas. Agora cada risco leva o seu proprio recorte, tirado no
    // momento em que e fechado, com o zoom que ele escolheu para o ver.
    // Mede ~40 KB em vez de 1,5 MB, e vale mais: e a vista que ELE julgou certa
    // para mostrar o defeito.
    function fotoDoRisco(pts) {
      // ── COM O 3D, A FOTO SAI DO WEBGL E LEVA O RISCO POR CIMA ───────────
      // Duas coisas que so se sabem tentando: o `three` nao guarda o buffer de
      // desenho, portanto ha que MANDAR desenhar e recortar no mesmo instante --
      // um recorte tirado mais tarde vem preto. E o risco esta noutra tela, a de
      // cima: a foto compoe as duas, senao mostra o defeito sem mostrar onde eu
      // estava a apontar, que e metade do recado.
      if (M3D) {
        const V = new M3D.THREE.Vector3();
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const q of pts) {
          const mm = vbParaMetros(q[0], q[1]);
          if (!mm) continue;
          V.set(mm[0], q.length > 2 ? q[2] : 0, -mm[1]);
          const e = M3D.ecraDoMundo(V);
          x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y);
          x1 = Math.max(x1, e.x); y1 = Math.max(y1, e.y);
        }
        if (!(x1 > x0 - 1e6)) return "";
        const f = Math.max(90, ((x1 - x0) + (y1 - y0)) * 0.35);
        x0 -= f; y0 -= f; x1 += f; y1 += f;
        const tela = M3D.rend.domElement;
        const rp = tela.getBoundingClientRect();
        const kx = tela.width / rp.width, ky = tela.height / rp.height;
        const sx = Math.max(0, Math.round(x0 * kx)), sy = Math.max(0, Math.round(y0 * ky));
        const sw = Math.min(tela.width - sx, Math.round((x1 - x0) * kx));
        const sh = Math.min(tela.height - sy, Math.round((y1 - y0) * ky));
        if (sw < 8 || sh < 8) return "";
        M3D.rend.render(M3D.cena, M3D.cam);      // desenhar e recortar de seguida
        const k = Math.min(1, 720 / sw);
        const c = document.createElement("canvas");
        c.width = Math.round(sw * k); c.height = Math.round(sh * k);
        const g = c.getContext("2d");
        g.drawImage(tela, sx, sy, sw, sh, 0, 0, c.width, c.height);
        const marcasTela = telaDasMarcas();
        g.drawImage(marcasTela, Math.round(x0 * DPR_TELA), Math.round(y0 * DPR_TELA),
                    Math.round((x1 - x0) * DPR_TELA), Math.round((y1 - y0) * DPR_TELA),
                    0, 0, c.width, c.height);
        return c.toDataURL("image/png");
      }
      return "";                       // sem mapa nao ha fotografia
    }

    // A NOTA E DE CADA RISCO, nao do caderno.
    // Medido no primeiro uso a serio (07/09): as tres marcas sairam todas da
    // mesma cor e cada uma era um problema diferente — "arvore na estrada",
    // "torre de frente para a estrada", outra arvore. A cor da uma GAVETA; o que
    // esta errado ali so a frase diz. Com uma caixa de nota so para o caderno, a
    // terceira frase ficava colada as tres marcas e duas ficavam mal descritas.
    // A caixa NAO se limpa: escreve-se uma vez e risca-se tudo o que for daquilo.
    function marcarFim() {
      if (!MARC.a_riscar) return false;
      const nt = document.getElementById("notaMarcas");
      MARC.a_riscar.nota = nt ? nt.value.trim() : "";
      const m = MARC.a_riscar;
      MARC.marcas.push(m);
      MARC.a_riscar = null;
      draw();                       // primeiro desenhar: a foto tem de LEVAR o risco
      if (M3D) desenharMarcas3D();  // e no 3D o risco vive na tela de cima
      try { m.foto = fotoDoRisco(m.pts); } catch (e) { m.foto = ""; }
      return true;
    }

    // ── PINTAR OS RISCOS ──────────────────────────────────────────────────────
    // Uma so rotina para as duas vistas. O que muda entre elas e apenas COMO um
    // ponto do mapa vira um ponto do ecra -- e isso entra como argumento. Duas
    // copias desta funcao acabariam por divergir num detalhe qualquer, e o risco
    // de uma vista deixaria de ser o mesmo risco da outra.
    function pintarMarcas(g, px, larg, fonte) {
      g.save();
      g.lineCap = "round"; g.lineJoin = "round";
      for (const m of MARC.marcas.concat(MARC.a_riscar ? [MARC.a_riscar] : [])) {
        const pts = m.pts.map(px).filter(Boolean);
        if (!pts.length) continue;
        g.lineWidth = larg * 1.55;
        g.strokeStyle = "rgba(0,0,0,.45)";         // contorno: legivel sobre tudo
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (const q of pts.slice(1)) g.lineTo(q[0], q[1]);
        if (pts.length === 1) g.arc(pts[0][0], pts[0][1], larg * 2.4, 0, 6.284);
        g.stroke();
        g.lineWidth = larg;
        g.strokeStyle = MARC_COR[m.cor];
        g.stroke();
        if (pts.length === 1) {
          g.fillStyle = MARC_COR[m.cor];
          g.beginPath();
          g.arc(pts[0][0], pts[0][1], larg * 1.8, 0, 6.284);
          g.fill();
        }
        // o NUMERO. E o que permite dizer "o 2 esta resolvido" em vez de
        // descrever outra vez o sitio — a mesma razao de existir do caderno.
        const idx = MARC.marcas.indexOf(m);
        if (idx < 0) continue;
        let mx = 0, my = 0;
        for (const q of pts) { mx += q[0]; my += q[1]; }
        mx /= pts.length; my /= pts.length;
        const r = Math.max(...pts.map((q) => Math.hypot(q[0] - mx, q[1] - my)));
        g.font = "700 " + fonte + "px system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.7)";
        g.strokeText(String(idx + 1), mx + r + 12, my - r - 4);
        g.fillStyle = MARC_COR[m.cor];
        g.fillText(String(idx + 1), mx + r + 12, my - r - 4);
      }
      g.restore();
    }

    // a tela por cima do 3D redesenha-se a cada quadro: a camara mexe-se e os
    // riscos tem de mexer-se com ela, senao deixam de apontar o que apontavam
    const _v3m = { x: 0, y: 0, z: 0 };
    // a tela das marcas e um canvas 2D por cima do WebGL: tem de ser desenhada em
    // pixeis de dispositivo para os riscos nao sairem serrilhados. E a unica
    // coisa nesta pagina que ainda precisa do DPR.
    const DPR_TELA = Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2);
    function desenharMarcas3D() {
      if (!M3D) return;
      const t = telaDasMarcas();
      const L = Math.round(window.innerWidth), A = Math.round(window.innerHeight);
      if (t.width !== L * DPR_TELA || t.height !== A * DPR_TELA) {
        t.width = L * DPR_TELA; t.height = A * DPR_TELA;
        t.style.width = L + "px"; t.style.height = A + "px";
      }
      const g = t.getContext("2d");
      g.setTransform(DPR_TELA, 0, 0, DPR_TELA, 0, 0);
      g.clearRect(0, 0, L, A);
      if (!MARC.marcas.length && !MARC.a_riscar) return;
      const V = new M3D.THREE.Vector3();
      pintarMarcas(g, (p) => {
        const mm = vbParaMetros(p[0], p[1]);
        if (!mm) return null;
        V.set(mm[0], p.length > 2 ? p[2] : 0, -mm[1]);
        const e = M3D.ecraDoMundo(V);
        return e.atras ? null : [e.x, e.y];
      }, 4, 16);
    }


    // A QUE PECA PERTENCE UMA MARCA. E isto que transforma "um risco em (812,533)"
    // em "a estrada Madrid-Toledo": sem esta linha eu teria de ir procurar no mapa
    // o que ha naquele ponto, que e exatamente o trabalho que a ferramenta existe
    // para poupar.
    // O CENTRO DE UM RISCO E O CENTROIDE, nao o ponto do meio da lista.
    // O Lucas nao rabisca: CIRCUNDA. Num traco fechado o ponto do meio da lista e
    // o lado OPOSTO ao inicio — fica na borda do circulo, nunca no que ele
    // circundou. Medido: as duas arvores davam 13 e 30 px de distancia a estrada
    // com o ponto do meio, e a marca do centro cai em cima do que interessa.
    function centroDoRisco(pts) {
      let sx = 0, sy = 0;
      for (const q of pts) { sx += q[0]; sy += q[1]; }
      return [sx / pts.length, sy / pts.length];
    }

    // O QUE ESTA DENTRO DO CIRCULO.
    // Antes eu perguntava "qual a peca MAIS PROXIMA do centro" e ficava com uma
    // so. Mas quase todos os defeitos que ele aponta sao um ENCONTRO de duas
    // pecas — uma arvore EM CIMA de uma estrada, uma torre DE FRENTE para uma
    // estrada. Com uma peca so, a mais interessante e justamente a que fica de
    // fora. Por isso o raio do circulo passa a ser usado: devolve-se tudo o que
    // ele apanha — aldeias, estradas e moitas — e o defeito nomeia-se sozinho.
    function oQueEstaAqui(c, raio) {
      if (!game || !IB) return null;
      // AS FOLGAS SAO PEQUENAS DE PROPOSITO. Medido: um circulo de raio 82 em
      // cima de Cordoba apanhava 5 estradas e 6 moitas — verdade, e inutil. O
      // circulo que ele desenha JA DIZ o tamanho do problema; alargar por cima
      // disso so acrescenta ruido. A folga da aldeia e maior porque a peca e
      // grande: o centro fica longe da muralha que ele circundou.
      const r = Math.max(raio, 12);
      const dentro = (d, folga) => d <= r + folga;
      const aldeias = [], estradas = [], moitas = [];

      for (const a of game.aldeias) {
        const d = Math.hypot(c[0] - a.x, c[1] - a.y);
        if (dentro(d, 55)) aldeias.push({ id: a.slug, dist: Math.round(d) });
      }
      for (const e of (Iberia.ESTRADAS || [])) {
        const a = (game.aldeias || []).find((v) => v.slug === e.de);
        const b = (game.aldeias || []).find((v) => v.slug === e.para);
        if (!a || !b) continue;
        const vx = b.x - a.x, vy = b.y - a.y;
        const L2 = Math.max(vx * vx + vy * vy, 1e-6);
        const t = Math.max(0, Math.min(1, ((c[0] - a.x) * vx + (c[1] - a.y) * vy) / L2));
        const d = Math.hypot(c[0] - (a.x + t * vx), c[1] - (a.y + t * vy));
        if (dentro(d, 8)) estradas.push({ id: e.de + "-" + e.para, dist: Math.round(d) });
      }
      // A As MOITAS saiam daqui com o indice do `assets/sprites/mata.json`, que
      // era a mata do mapa plano. Quem nomeia as manchas do mapa que existe e o
      // `oQueEstaAqui3D`, logo abaixo -- e e la que a correcao tem de ser feita.
      const ord = (L) => L.sort((x, y) => x.dist - y.dist).slice(0, 6);
      return { aldeias: ord(aldeias), estradas: ord(estradas), moitas: [] };
    }

    // O RECADO NAO E UM `alert`. Um alert bloqueia a pagina inteira ate alguem
    // carregar em OK — e quem esta a marcar o mapa quer continuar a marcar, nao
    // quer despachar caixas. (Tambem me travava a mim: um alert por abrir deixa o
    // navegador sem responder a mais nada.)
    function marcarRecado(txt) {
      const el = document.getElementById("marcasRecado");
      if (el) { el.textContent = txt; clearTimeout(marcarRecado._t);
                marcarRecado._t = setTimeout(() => { el.textContent = ""; }, 6000); }
    }

    // a vista geral: com o 3D ligado o canvas plano esta escondido e sai em
    // branco -- tira-se do WebGL, com os riscos da tela de cima por cima
    function vistaGeral() {
      if (!M3D) return "";
      try {
        const tela = M3D.rend.domElement;
        M3D.rend.render(M3D.cena, M3D.cam);
        const c = document.createElement("canvas");
        const k = Math.min(1, 1600 / tela.width);
        c.width = Math.round(tela.width * k); c.height = Math.round(tela.height * k);
        const g = c.getContext("2d");
        g.drawImage(tela, 0, 0, c.width, c.height);
        g.drawImage(telaDasMarcas(), 0, 0, c.width, c.height);
        return c.toDataURL("image/png");
      } catch (e) { return ""; }
    }

    // ── O QUE ESTA DENTRO DO CIRCULO, NO 3D (17/09) ────────────────────────
    // O `oQueEstaAqui` responde com as pecas do mapa PLANO: aldeia, estrada e a
    // moita do `mata.json`. Os defeitos do 3D sao outros -- um portao torto, uma
    // casa enterrada, uma arvore na praia -- e sao pecas do `mapa3d.json`. Aqui
    // nomeia-se cada uma pelo seu indice em `copias` e `manchas`, que e a linha
    // exata a corrigir, e em METROS, que e a unidade do forno.
    function oQueEstaAqui3D(pts) {
      if (!M3D) return null;
      const MP = M3D.MAPA;
      const mm = pts.map((q) => vbParaMetros(q[0], q[1])).filter(Boolean);
      if (!mm.length) return null;
      let cx = 0, cy = 0;
      for (const q of mm) { cx += q[0]; cy += q[1]; }
      cx /= mm.length; cy /= mm.length;
      const raio = Math.max(3, ...mm.map((q) => Math.hypot(q[0] - cx, q[1] - cy)));
      const alt = pts.filter((q) => q.length > 2).map((q) => q[2]);
      const r1 = (v) => Math.round(v * 10) / 10;
      const ord = (L, n) => L.sort((a, b) => a.dist - b.dist).slice(0, n);
      const aldeias = [], estradas = [], pecas = [], matas = [];
      for (const [slug, a] of Object.entries(MP.aldeias || {})) {
        const d = Math.hypot(a.p[0] - cx, a.p[1] - cy);
        if (d <= raio + 60) aldeias.push({ id: slug, dist: r1(d) });
      }
      for (const e of (MP.estradas || [])) {
        let melhor = 1e9;
        for (let i = 1; i < e.pts.length; i++) {
          const A = e.pts[i - 1], B = e.pts[i];
          const vx = B[0] - A[0], vy = B[1] - A[1];
          const t = Math.max(0, Math.min(1, ((cx - A[0]) * vx + (cy - A[1]) * vy)
                                            / Math.max(vx * vx + vy * vy, 1e-9)));
          melhor = Math.min(melhor, Math.hypot(cx - A[0] - t * vx, cy - A[1] - t * vy));
        }
        if (melhor <= raio + 6) estradas.push({ id: e.de + "-" + e.para, dist: r1(melhor) });
      }
      (MP.copias || []).forEach((c, i) => {
        const d = Math.hypot(c.p[0] - cx, c.p[1] - cy);
        if (d <= raio + 3) pecas.push({ i, peca: c.peca, aldeia: c._cid || "", dist: r1(d) });
      });
      (MP.manchas || []).forEach((c, i) => {
        const d = Math.hypot(c.p[0] - cx, c.p[1] - cy);
        if (d <= raio + 30) matas.push({ i, dist: r1(d) });
      });
      return {
        centro_m: [r1(cx), r1(cy)], raio_m: r1(raio),
        altura_m: alt.length ? r1(alt.reduce((a, b) => a + b, 0) / alt.length) : null,
        camara: [r1(M3D.cam.position.x), r1(M3D.cam.position.y), r1(M3D.cam.position.z)],
        aldeias: ord(aldeias, 4), estradas: ord(estradas, 4),
        pecas: ord(pecas, 12), manchas: ord(matas, 6),
      };
    }

    async function marcarGuardar() {
      if (!MARC.marcas.length) { marcarRecado("nada marcado ainda"); return; }
      const nota = document.getElementById("notaMarcas");
      // REDE DE SEGURANCA: quem circunda primeiro e escreve depois nao devia
      // perder a frase. Aconteceu logo na primeira ronda a serio — a marca [1]
      // chegou sem nota nenhuma e a [2] com a frase que descrevia as duas. Um
      // risco sem nota fica com o que estiver na caixa na hora de gravar.
      const tardia = nota ? nota.value.trim() : "";
      for (const m of MARC.marcas) if (!m.nota) m.nota = tardia;
      const corpo = {
        quando: new Date().toISOString(),
        nota: nota ? nota.value : "",
        legenda: MARC.legenda,
        marcas: MARC.marcas.map((m, i) => {
          const c = centroDoRisco(m.pts);
          return {
            n: i + 1, cor: m.cor, gaveta: MARC.legenda[m.cor], nota: m.nota || "",
            centro: [Math.round(c[0]), Math.round(c[1])],
            raio: Math.round(Math.max(...m.pts.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])))),
            pts: m.pts.map((q) => [Math.round(q[0]), Math.round(q[1])]),
            aqui: oQueEstaAqui(c, Math.max(...m.pts.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])))),
            aqui3d: oQueEstaAqui3D(m.pts),
            foto: m.foto || "",
          };
        }),
        imagem: vistaGeral(),
      };
      try {
        const r = await fetch("/marcas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        const j = await r.json();
        // O LOTE FECHA-SE AO GRAVAR. Sem isto as marcas acumulavam e cada
        // gravacao reenviava as anteriores: tres gravacoes deram 1, 2 e 3 marcas
        // e so a ultima servia. Um lote por gravacao, um relatorio por lote.
        const n = MARC.marcas.length;
        MARC.marcas = [];
        draw();
        marcarRecado("gravadas " + n + " marca(s) em marcas/" + j.ficheiro + " - a mesa esta limpa");
      } catch (e) {
        marcarRecado("nao consegui gravar - o jogo esta a correr por python servir.py?");
      }
    }


    // ── a barra do caderno de marcas ────────────────────────────────────────
    // ── UMA FERRAMENTA DE DIAGNOSTICO NAO PODE DERRUBAR O JOGO ──────────────
    // Isto corre ao carregar a pagina, e uma excecao aqui mata TUDO o que vem
    // depois no bloco -- o jogo inteiro por causa do caderno de marcas. Foi o que
    // aconteceu nos smokes: o DOM de teste nao tem `Element.after`, e cinco
    // testes morreram com um erro que apontava para o sitio errado.
    // Envolvido, e a usar `insertBefore`, que existe em todo o lado.
    (function montarBarraMarcas() {
     try {
      const b = document.getElementById("barraMarcas");
      if (!b) return;
      const leg = document.getElementById("marcasLegenda");
      MARC.legenda.forEach((txt, i) => {
        const d = document.createElement("div");
        d.className = "cor" + (i === 0 ? " sel" : "");
        d.style.background = MARC_COR[i];
        d.title = txt;
        d.onclick = () => {
          MARC.cor = i;
          b.querySelectorAll(".cor").forEach((x, k) => x.classList.toggle("sel", k === i));
          leg.textContent = txt;
        };
        if (leg.parentNode) leg.parentNode.insertBefore(d, leg.nextSibling);
      });
      leg.textContent = MARC.legenda[0];
      document.getElementById("marcasDesfazer").onclick = () => { MARC.marcas.pop(); draw(); };
      document.getElementById("marcasLimpar").onclick = () => { MARC.marcas = []; draw(); };
      document.getElementById("marcasGuardar").onclick = marcarGuardar;
      document.getElementById("marcasFechar").onclick = () => marcarLigar(false);

      // ── o interruptor da tela limpa ───────────────────────────────────
      function limparTela(v) {
        const on = v === undefined ? !document.body.classList.contains("limpo") : v;
        document.body.classList.toggle("limpo", on);
        const bt = document.getElementById("zlimpo");
        if (bt) {
          bt.classList.toggle("on", on);
          bt.title = on ? "Mostrar tudo outra vez (H)" : "Esconder tudo o resto (H)";
        }
      }
      const zl = document.getElementById("zlimpo");
      if (zl) zl.onclick = () => limparTela();

      window.addEventListener("keydown", (e) => {
        if (document.activeElement && document.activeElement.tagName === "INPUT") return;
        if (e.key === "m" || e.key === "M") marcarLigar();
        if (e.key === "h" || e.key === "H") limparTela();
      });
      if (/(\?|&)marcar(&|=|$)/.test(location.search || "")) marcarLigar(true);
     } catch (e) {
       console.warn("caderno de marcas indisponivel:", e && e.message);
     }
    })();
    return { sincronizar, MARC, desenharMarcas3D, marcarFim, marcarMover,
             vbParaMetros, metrosParaVb, marcarLigar, oQueEstaAqui, oQueEstaAqui3D,
             vistaGeral, telaDasMarcas };
  }

  return { criar };
});
