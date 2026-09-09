// mapa3d.js — o mapa da Iberia em 3D, como MODULO que o jogo carrega.
//
// ── O CONTRATO, E PORQUE E TAO PEQUENO ───────────────────────────────────────
// Este ficheiro nao sabe o que e um turno, uma ordem, um Rei ou uma LLM. Sabe
// desenhar um estado. O jogo chama duas funcoes:
//
//   const mapa = await iniciar(elemento);   // monta a cena, uma vez
//   mapa.atualizar(estado);                 // sempre que o estado muda
//
// e o `estado` e isto, e nada mais:
//
//   {
//     turno: 12,
//     aldeias: [{ slug, dono: "A"|"B"|null, tropas: n, visivel: bool,
//                 lembrada: turno|null }],
//     marchas: [{ de: slug, para: slug, t: 0..1, dono, tipo, tropas: n }],
//   }
//
// E deliberadamente POBRE. Se o mapa precisasse de saber o que o motor sabe,
// qualquer mudanca no motor partiria o mapa -- e a razao de o `engine.js` ter
// sobrevivido a tres reescritas de interface e nunca ter dependido de nenhuma.
// Aqui e a mesma disciplina, do outro lado.
//
// Sem `atualizar`, o mapa corre em MODO DEMONSTRACAO: colunas inventadas a
// andar pelas estradas. E o que a `mapa.html` mostra.
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { OrbitControls } from "./vendor/controls/OrbitControls.js";
import { clone as clonarComOssos } from "./vendor/utils/SkeletonUtils.js";

const BASE = new URL(".", import.meta.url).href;

// As cores dos Reis sao as dos brasoes do jogo: A azul, B vermelho. Se
// divergirem, a bandeira no mapa contradiz o escudo no painel -- e ninguem
// confia num mapa que discorda do painel.
export const COR_REI = { A: 0x2f6fb5, B: 0xc23b2e, null: 0x8a8578 };

export async function iniciar(hospedeiro, opcoes = {}) {
  const tela = document.createElement("canvas");
  tela.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  hospedeiro.appendChild(tela);

  const cfgSol = await (await fetch(BASE + "cena.json")).json();
  const MAPA = await (await fetch(BASE + "mapa3d.json")).json();
  const [LX, LY] = MAPA.mapa_m;

  const rend = new THREE.WebGLRenderer({ canvas: tela, antialias: true,
                                         logarithmicDepthBuffer: true });
  rend.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  rend.shadowMap.enabled = true;
  rend.shadowMap.type = THREE.PCFSoftShadowMap;
  rend.toneMapping = THREE.AgXToneMapping;      // a mesma curva do forno
  rend.toneMappingExposure = 1.05;

  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x7ea3b8);
  cena.fog = new THREE.Fog(0x8fb0c2, LX * 0.95, LX * 2.6);

  // ── o mar ───────────────────────────────────────────────────────────────
  const matMar = new THREE.MeshStandardMaterial({
    color: 0x1d4657, roughness: 0.40, metalness: 0.06 });
  matMar.onBeforeCompile = (sh) => {
    sh.uniforms.tempo = { value: 0 };
    matMar.userData.sh = sh;
    sh.vertexShader = `varying vec3 vMar;
` + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
vMar = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = `uniform float tempo;
varying vec3 vMar;
` + sh.fragmentShader.replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
vec2 mp = vMar.xz;
float o1 = sin(mp.x * 0.055 + mp.y * 0.021 + tempo * 1.10);
float o2 = sin(mp.x * -0.017 + mp.y * 0.049 + tempo * 0.83);
float o3 = sin(mp.x * 0.031 + mp.y * -0.037 + tempo * 1.47);
normal = normalize(normal + vec3(o1 * 0.055 + o3 * 0.03, 0.0, o2 * 0.055 + o3 * 0.024));`);
  };
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(LX * 4, LY * 4), matMar);
  mar.rotation.x = -Math.PI / 2;
  mar.position.y = -11;
  mar.receiveShadow = true;
  cena.add(mar);

  // ── a luz ───────────────────────────────────────────────────────────────
  const sol = new THREE.DirectionalLight(new THREE.Color(...cfgSol.sol.cor), 3.2);
  const dSol = cfgSol.sol.direcao_yup;
  sol.castShadow = true;
  // 2048 e nao 4096: a caixa da sombra acompanha a camara e aperta-se ao que
  // se esta a ver, portanto os 2048 caem sobre uma area pequena e chegam. Os
  // 4096 custavam quatro vezes mais memoria e quatro vezes mais escrita por
  // quadro para a mesma nitidez.
  sol.shadow.mapSize.set(2048, 2048);
  cena.add(sol, sol.target);
  cena.add(new THREE.HemisphereLight(0xbcd8ef, 0x5c6340, 1.2));

  const cam = new THREE.PerspectiveCamera(42, 1, 2, LX * 2.2);
  cam.position.set(0, LY * 0.62, LY * 0.78);
  const ctrl = new OrbitControls(cam, tela);
  ctrl.enableDamping = true;
  ctrl.maxPolarAngle = Math.PI * 0.497;
  ctrl.minDistance = 12;
  ctrl.maxDistance = LX * 1.3;
  // ── APROXIMAR PARA O CURSOR, e nao para o centro do mapa ────────────────
  // Sem isto o alvo da orbita fica cravado no meio da ilha: aproxima-se de uma
  // aldeia no canto, e ao girar a camara descreve um arco de dois quilometros
  // a volta do centro e a aldeia desaparece. Com `zoomToCursor`, o alvo VEM
  // COM a roda -- gira-se a volta do que se esta a olhar, que e o que a mao
  // espera.
  ctrl.zoomToCursor = true;
  ctrl.zoomSpeed = 1.15;
  ctrl.rotateSpeed = 0.62;    // a rotacao era nervosa: meio ecra dava meia volta
  ctrl.panSpeed = 0.9;

  // ── O PIVO DA CAMARA ANDA NO CHAO ───────────────────────────────────────
  // Era este o "gira sempre no zoom afastado". O alvo da orbita e um ponto
  // solto no espaco: arrasta-se o mapa, aproxima-se, e ele fica para tras -- a
  // dois quilometros do que se esta a ver. Girar passa a descrever um arco
  // enorme a volta de nada.
  //
  // Um mapa de estrategia gira a volta do SITIO QUE SE ESTA A OLHAR. Entao,
  // sempre que a mao larga o rato, lanca-se um raio do centro do ecra ate ao
  // chao e o alvo vai para onde ele bate. Custa um raio por gesto, e nao por
  // quadro -- o chao tem 105 mil faces e um raio por quadro seria caro por uma
  // coisa que so muda quando alguem mexe.
  const raio = new THREE.Raycaster();
  const centroEcra = new THREE.Vector2(0, 0);
  function ancorarAlvo() {
    if (!malhaChao) return;
    raio.setFromCamera(centroEcra, cam);
    const bate = raio.intersectObject(malhaChao, false);
    if (!bate.length) return;
    const p = bate[0].point;
    const d = cam.position.distanceTo(p);
    // se o chao ficou longe de mais (a olhar para o horizonte) nao se ancora:
    // puxar o pivo para 3 km daqui seria trocar um problema por outro
    if (d < ctrl.minDistance * 0.9 || d > LX * 0.9) return;
    ctrl.target.copy(p);
  }

  const g = await new Promise((ok, mal) =>
    new GLTFLoader().load(BASE + "pecas.glb", ok, undefined, mal));

  // uma peca pode ser VARIAS malhas: o glTF parte-as por material
  const banco = {};
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const n = (o.parent && o.parent.name && o.parent !== g.scene)
      ? o.parent.name : o.name;
    (banco[n] = banco[n] || []).push(o);
  });
  // ── AS TROPAS DE CARNE ──────────────────────────────────────────────────
  // O resto do mapa e geometria rigida instanciada aos milhares. Estas nao:
  // uma malha com ossos NAO se instancia, cada soldado e uma copia sua com o
  // seu esqueleto e o seu tocador. E isso so se pode pagar por causa de uma
  // decisao anterior -- o corte por pixeis, que limita as figuras a vista a
  // algumas dezenas. O que fizemos para elas se LEREM e o que torna a animacao
  // a serio acessivel.
  //
  // `clonarComOssos` e nao `.clone()`: um clone normal partilha o esqueleto, e
  // a coluna inteira andava em unisono -- que e o aspeto de uma maquina, nao
  // de um exercito.
  // por TIPO. Tres pocos de 48 seriam 144 esqueletos a espera; o corte por
  // pixeis nunca poe tantos no ecra ao mesmo tempo, e cada copia custa
  // memoria mesmo escondida.
  const POCO_ANIM = 28;
  const animados = {};
  // o cavaleiro nao anda: galopa. E o esqueleto dele e o do CAVALO, com o
  // homem congelado em cima, portanto o passo tem outro nome -- por isso a
  // animacao se procura por tropa e nao por um padrao so
  const PASSO = { lanceiro: /idle_walk/i, arqueiro: /idle_walk/i,
                  cavaleiro: /^gallop$/i };
  for (const [tipo, ficheiro] of [["lanceiro", "lanceiro.glb"],
                                  ["arqueiro", "arqueiro.glb"],
                                  ["cavaleiro", "cavaleiro.glb"]]) {
    const ga = await new Promise((ok) =>
      new GLTFLoader().load(BASE + ficheiro, ok, undefined, () => ok(null)));
    if (!ga) continue;
    const passo = ga.animations.find((a) => PASSO[tipo].test(a.name))
      || ga.animations.find((a) => /walk/i.test(a.name))
      || ga.animations[0];
    const lista = [];
    for (let i = 0; i < POCO_ANIM; i++) {
      const raiz = clonarComOssos(ga.scene);
      raiz.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true;
                        o.frustumCulled = false; }
      });
      raiz.visible = false;
      const mix = new THREE.AnimationMixer(raiz);
      const act = mix.clipAction(passo);
      act.play();
      // cada um com a sua fase: sem isto seriam quarenta e oito copias do
      // mesmo instante, todas a pisar ao mesmo tempo
      act.time = (i * 0.37) % passo.duration;
      cena.add(raiz);
      lista.push({ raiz, mix });
    }
    animados[tipo] = lista;
  }

  const contaTri = (m) => (m.geometry.index ? m.geometry.index.count
                                            : m.geometry.attributes.position.count) / 3;

  let nTri = 0, nInst = 0;
  let malhaChao = null;
  for (const nome of ["chao", "estradas"])
    for (const ch of (banco[nome] || [])) {
      if (nome === "chao") malhaChao = ch;
      ch.receiveShadow = true;
      ch.castShadow = false;
      if (nome === "estradas") {
        ch.material.polygonOffset = true;
        ch.material.polygonOffsetFactor = -4;
        ch.material.polygonOffsetUnits = -8;
      }
      cena.add(ch);
      nTri += contaTri(ch);
    }

  const quantas = {};
  const soma = (n) => { quantas[n] = (quantas[n] || 0) + 1; };
  for (const c of MAPA.copias) soma(c.peca);
  for (const m of MAPA.manchas) for (const t of MAPA.arranjos[m.b]) soma(t.peca);

  const inst = {};
  for (const [nome, n] of Object.entries(quantas)) {
    const partes = banco[nome];
    if (!partes || !partes.length) continue;
    const arbusto = /^arbusto/.test(MAPA.pecas[nome] || nome);
    inst[nome] = partes.map((base) => {
      const im = new THREE.InstancedMesh(base.geometry, base.material, n);
      im.castShadow = !arbusto; im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      cena.add(im);
      nTri += contaTri(base) * n;
      return im;
    });
  }

  // so agora: o `ancorarAlvo` precisa do chao, e o chao so existe depois do glTF
  ctrl.addEventListener("end", ancorarAlvo);
  ancorarAlvo();

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  const V = new THREE.Vector3(), E = new THREE.Vector3(), R = new THREE.Euler();
  // Blender e Z-para-cima; o exportador virou a cena para Y-para-cima, mas as
  // COLOCACOES foram gravadas em coordenadas do Blender. (x, y, z) -> (x, z, -y).
  const por = (lista, x, y, z, rz, e) => {
    V.set(x, z, -y);
    R.set(0, rz, 0);
    Q.setFromEuler(R);
    E.set(e, e, e);
    M.compose(V, Q, E);
    for (const im of lista) im.setMatrixAt(im.count++, M);
  };
  for (const c of MAPA.copias) {
    const l = inst[c.peca]; if (!l) continue;
    por(l, c.p[0], c.p[1], c.p[2], c.rz, c.e); nInst++;
  }
  for (const m of MAPA.manchas)
    for (const t of MAPA.arranjos[m.b]) {
      const l = inst[t.peca]; if (!l) continue;
      por(l, m.p[0] + t.p[0] * m.e, m.p[1] + t.p[1] * m.e,
          (m.z || 0) + t.p[2] * m.e, t.rz, t.e * m.e); nInst++;
    }
  for (const l of Object.values(inst))
    for (const im of l) im.instanceMatrix.needsUpdate = true;

  // ── as bandeiras, uma por mastro, com a cor do dono ──────────────────────
  // Um pano por REI, porque a cor vive no material. Uma aldeia que troca de
  // dono nao muda de geometria: muda de LISTA -- a instancia sai do pano de um
  // e entra no do outro. E por isso que a bandeira nunca foi assada.
  const mastros = [];
  for (const [cid, lista] of Object.entries(MAPA.mastros || {}))
    for (const m of lista) mastros.push({ cid, p: m });
  const ALT_MASTRO = 9.0;
  const panoG = new THREE.PlaneGeometry(1, 1, 12, 1);
  panoG.translate(0.5, 0, 0);            // ancorado na tralha
  const panos = {};
  for (const rei of ["A", "B", "null"]) {
    const mat = new THREE.MeshStandardMaterial({
      color: COR_REI[rei], roughness: 0.85, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tempo = { value: 0 };
      mat.userData.sh = sh;
      sh.vertexShader = `uniform float tempo;
` + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
float fase = float(gl_InstanceID) * 1.7;
float onda = sin(transformed.x * 5.0 - tempo * 7.0 + fase);
transformed.z += onda * transformed.x * 0.16;
transformed.y += onda * transformed.x * 0.05;`);
    };
    const im = new THREE.InstancedMesh(panoG, mat, Math.max(1, mastros.length));
    im.castShadow = true; im.frustumCulled = false; im.count = 0;
    cena.add(im);
    panos[rei] = { im, mat };
  }
  {
    const matM = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 });
    const imM = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.26, 1, 6), matM, Math.max(1, mastros.length));
    imM.castShadow = true;
    cena.add(imM);
    const M2 = new THREE.Matrix4(), V2 = new THREE.Vector3();
    const Q2 = new THREE.Quaternion(), S2 = new THREE.Vector3();
    mastros.forEach((m, i) => {
      V2.set(m.p[0], m.p[2] + ALT_MASTRO / 2, -m.p[1]);
      S2.set(1, ALT_MASTRO, 1);
      M2.compose(V2, Q2, S2);
      imM.setMatrixAt(i, M2);
    });
    imM.instanceMatrix.needsUpdate = true;
  }

  // ── as chapas com o nome ────────────────────────────────────────────────
  function placa(texto, sub, tipo, tom) {
    const c = document.createElement("canvas");
    const g0 = c.getContext("2d");
    const F = tipo === "capital" ? 40 : 34;
    g0.font = "700 " + F + "px system-ui, sans-serif";
    const w1 = g0.measureText(texto).width;
    g0.font = "600 " + (F * 0.68) + "px system-ui, sans-serif";
    const w2 = sub ? g0.measureText(sub).width : 0;
    c.width = Math.ceil(Math.max(w1, w2)) + 30;
    c.height = F + (sub ? F * 0.82 : 0) + 22;
    const g2 = c.getContext("2d");
    g2.fillStyle = "rgba(18,13,6,.80)";
    g2.beginPath(); g2.roundRect(0, 0, c.width, c.height, 7); g2.fill();
    g2.strokeStyle = tom || (tipo === "capital" ? "#c9a24a" : "#6b5836");
    g2.lineWidth = 3; g2.stroke();
    g2.textAlign = "center";
    g2.textBaseline = "middle";
    g2.fillStyle = tipo === "capital" ? "#f2dfa8" : "#e8dcc0";
    g2.font = "700 " + F + "px system-ui, sans-serif";
    g2.fillText(texto, c.width / 2, F * 0.62 + 6);
    if (sub) {
      g2.fillStyle = tom || "#cbbd94";
      g2.font = "600 " + (F * 0.68) + "px system-ui, sans-serif";
      g2.fillText(sub, c.width / 2, F + F * 0.45 + 8);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { tex: t, w: c.width, h: c.height };
  }

  const chapas = {};
  const K_PLACA = 0.00042;
  for (const [cid, a] of Object.entries(MAPA.aldeias || {})) {
    const nome = a.nome || (cid.charAt(0).toUpperCase() + cid.slice(1));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      sizeAttenuation: false, depthTest: false, transparent: true,
      toneMapped: false }));
    sp.position.set(a.p[0], a.z + (a.t === "capital" ? 30 : 24), -a.p[1]);
    sp.renderOrder = 999;
    cena.add(sp);
    chapas[cid] = { sp, nome, tipo: a.t, cache: null };
  }
  function pintarChapa(cid, sub, tom) {
    const ch = chapas[cid];
    if (!ch) return;
    const chave = (sub || "") + "|" + (tom || "");
    if (ch.cache === chave) return;      // so redesenha quando MUDA
    ch.cache = chave;
    if (ch.sp.material.map) ch.sp.material.map.dispose();
    const pl = placa(ch.nome, sub, ch.tipo, tom);
    ch.sp.material.map = pl.tex;
    ch.sp.material.needsUpdate = true;
    ch.sp.scale.set(pl.w * K_PLACA, pl.h * K_PLACA, 1);
  }
  for (const cid of Object.keys(chapas)) pintarChapa(cid, null, null);

  // ── o fumo das chamines ─────────────────────────────────────────────────
  const fumoTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const gg = c.getContext("2d");
    const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(236,232,226,.85)");
    grad.addColorStop(0.5, "rgba(214,208,200,.38)");
    grad.addColorStop(1, "rgba(200,196,190,0)");
    gg.fillStyle = grad; gg.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const fogos = [];
  let passo = 0;
  for (const c of MAPA.copias) {
    if (!/^casa2/.test(MAPA.pecas[c.peca] || c.peca)) continue;
    if (passo++ % 3) continue;
    fogos.push({ p: c.p, fase: fogos.length * 0.37 });
  }
  const POR_FOGO = 5;
  const imFumo = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: fumoTex, transparent: true,
                                  depthWrite: false, toneMapped: false,
                                  opacity: 0.55 }),
    Math.max(1, fogos.length * POR_FOGO));
  imFumo.frustumCulled = false;
  cena.add(imFumo);

  // ── as tropas ───────────────────────────────────────────────────────────
  // ── QUE TAMANHO TEM UM SOLDADO ──────────────────────────────────────────
  // A peca nasce com 2,4 m de homem; 2,2x da 5,3 m. E exagero, e e de
  // proposito: um jogo de estrategia aumenta as unidades face aos edificios
  // porque so se comanda o que se ve. Escolhido a olho na `tamanhos.html`,
  // com a muralha de 4,2 m no mesmo quadro.
  const ESCALA_TROPA = 2.2;
  const ALT_FIGURA = 2.4 * ESCALA_TROPA;

  // ── E QUANDO E QUE ELE DEIXA DE SER UM HOMEM ────────────────────────────
  // Abaixo de uns dez pixeis de altura uma figura deixa de se ler: fica um
  // ponto escuro. E o que os jogos de estrategia resolvem ha trinta anos
  // trocando a unidade por um SIMBOLO -- e o simbolo diz mais do que a figura
  // conseguiria dizer a essa distancia: de quem e, quantos sao, de que tipo.
  //
  // O limiar e em PIXEIS APARENTES e nao em metros de camara. "A partir de
  // 400 m" parece natural e e fragil: muda com a resolucao, com o campo de
  // visao, com o monitor de quem abrir o link. Dez pixeis sao dez pixeis em
  // qualquer ecra.
  //
  // E ha uma BANDA DE SOBREPOSICAO: o estandarte acende-se entre os 20 e os 12
  // pixeis, as figuras so se apagam abaixo dos 10. Ha uma faixa em que se veem
  // os dois, e e ela que esconde a troca. Cortar e acender no mesmo instante
  // da um salto que se ve.
  const PX_FIGURA_MORRE = 10;
  const PX_BANDEIRA_CHEIA = 12;
  const PX_BANDEIRA_NASCE = 20;
  const PX_BANDEIRA_MORRE = 34;    // acima disto a figura fala por si
  function pxPorMetro(dist) {
    const h = rend.domElement.clientHeight || 720;
    return (h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))) / Math.max(dist, 1);
  }

  const TIPOS = MAPA.tropas || [];
  const VEL_DEMO = { lanceiro: 5.5, arqueiro: 7.0, cavaleiro: 11.0 };
  let nAnim = 0;                        // figuras de carne no ecra
  const TETO_TROPA = 400;               // instancias reservadas por tipo
  const tropaInst = {};
  for (const tipo of TIPOS) {
    if (!banco[tipo]) continue;
    tropaInst[tipo] = banco[tipo].map((base) => {
      const im = new THREE.InstancedMesh(base.geometry, base.material, TETO_TROPA);
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      im.count = 0;
      cena.add(im);
      return im;
    });
  }
  // o eixo de cada estrada, indexado pelos dois sentidos
  const eixoDe = {};
  for (const e of (MAPA.estradas || [])) {
    const acum = [0], pts = e.pts;
    for (let i = 1; i < pts.length; i++)
      acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0],
                                         pts[i][1] - pts[i - 1][1]));
    eixoDe[e.de + ">" + e.para] = { pts, acum, comp: acum[acum.length - 1], inv: false };
    eixoDe[e.para + ">" + e.de] = { pts, acum, comp: acum[acum.length - 1], inv: true };
  }

  const _p = new THREE.Vector3(), _pAux = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
  const _m = new THREE.Matrix4();
  function noCaminho(via, metros, saida) {
    const d = Math.max(0, Math.min(via.comp - 0.01, metros));
    let i = 1;
    while (i < via.acum.length - 1 && via.acum[i] < d) i++;
    const t = (d - via.acum[i - 1]) / Math.max(via.acum[i] - via.acum[i - 1], 1e-6);
    const a = via.pts[i - 1], b = via.pts[i];
    saida.set(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t,
              -(a[1] + (b[1] - a[1]) * t));
    return Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  }

  // ── modo demonstracao: colunas inventadas ───────────────────────────────
  const colunas = [];
  let semente = 7;
  const sorte = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (const e of (MAPA.estradas || [])) {
    if (sorte() > 0.55) continue;
    const tipo = TIPOS[Math.floor(sorte() * TIPOS.length)];
    if (!tropaInst[tipo]) continue;
    colunas.push({ tipo, via: eixoDe[e.de + ">" + e.para],
                   n: 3 + Math.floor(sorte() * 6), t0: sorte() * 400 });
  }

  let ligadoAoJogo = false;
  let marchas = [];
  let motivo = "ainda nao correu";
  // ── O `t` DO MOTOR E EM DEGRAUS; O DO MAPA E CONTINUO ──────────────────
  // O motor so mexe na marcha uma vez por turno: entre turnos, `t` fica
  // parado. Desenhado tal e qual, um exercito nao ANDA -- salta. E como a
  // maioria das marchas esta a t=0 ou t=1, passa a partida quase toda parada a
  // porta de uma aldeia, onde a muralha a esconde.
  //
  // Aqui guarda-se um `t` proprio que PERSEGUE o do motor. Nao inventa
  // posicao nenhuma -- chega sempre ao mesmo sitio, so demora um segundo a la
  // chegar. O que o motor executa continua a ser a verdade; isto e so a
  // maneira de a mostrar.
  const suave = new Map();
  // ── E O TEMPO E O DO TURNO, e nao um segundo fixo ───────────────────────
  // A primeira versao fechava a distancia em ~1 s e depois PARAVA ate ao turno
  // seguinte: andar-parar-andar-parar. Um turno pode levar cinco segundos com
  // um jogador burro e tres minutos com um raciocinador -- se o movimento nao
  // acompanhar, ou fica aos solavancos ou fica sempre adiantado.
  // Entao mede-se: quanto tempo levou o ultimo turno? E a marcha espalha-se
  // por esse tempo. Ninguem tem de configurar nada.
  let msPorTurno = 4000, turnoAnterior = null, marcadoEm = 0;
  function relogioDoTurno(turno) {
    if (turno === turnoAnterior) return;
    const agora = performance.now();
    if (turnoAnterior !== null && marcadoEm)
      msPorTurno = Math.max(400, Math.min(60000, agora - marcadoEm));
    turnoAnterior = turno;
    marcadoEm = agora;
  }
  function tSuave(chave, alvo, dt) {
    const a = suave.get(chave);
    // um salto grande e uma marcha NOVA, nao um avanco: nao se interpola de
    // uma ponta do mapa para a outra
    if (a === undefined || Math.abs(alvo - a) > 0.6) { suave.set(chave, alvo); return alvo; }
    // 0.02 restante ao fim de um turno: chega la, sem parar pelo caminho
    const k = 1 - Math.pow(0.02, dt / Math.max(msPorTurno * 0.9, 300));
    const n = a + (alvo - a) * k;
    suave.set(chave, n);
    return n;
  }

  let dtQuadro = 16;
  function porTropas(t) {
    const conta = {};
    for (const tipo of Object.keys(tropaInst)) conta[tipo] = 0;
    const vivos = {};
    for (const tipo of Object.keys(animados)) vivos[tipo] = 0;
    const meter = (tipo, via, metros, rumoExtra, j) => {
      const lista = tropaInst[tipo];
      const carne = animados[tipo];
      const cheio = !carne || vivos[tipo] >= carne.length;
      if (cheio && (!lista || conta[tipo] >= TETO_TROPA)) return;
      const rumo = noCaminho(via, metros, _p) + rumoExtra;
      const lat = ((j % 2) * 2 - 1) * 2.6;
      _p.x += Math.cos(rumo + Math.PI / 2) * lat;
      _p.z += Math.sin(rumo + Math.PI / 2) * lat;

      // ── QUEM TEM PERNAS ANDA COM ELAS ──────────────────────────────────
      // Nada de balanco postico: as pernas dele mexem-se. E se o poco acabar,
      // nao se desenha -- misturar homens animados com simbolos rigidos na
      // mesma coluna via-se mais do que faltar um homem.
      // e se o poco acabar, cai-se no simbolo rigido em vez de nao desenhar
      // nada: "nao vejo tropas" e a pior coisa que este mapa pode dizer, e ja
      // custou uma tarde a perceber que a causa era outra
      if (carne && vivos[tipo] < carne.length) {
        const s = carne[vivos[tipo]++];
        s.raiz.visible = true;
        s.raiz.position.copy(_p);
        // a peca olha para +Y no Blender (e para onde aponta a biqueira), e a
        // exportacao com Y para cima manda isso para -Z: um quarto de volta a
        // menos do que a conta obvia, e a coluna desce a estrada de lado
        s.raiz.rotation.set(0, -rumo - Math.PI / 2, 0);
        s.raiz.scale.setScalar(ESCALA_TROPA);
        return;
      }
      // O BALANCO DO PASSO, mais lento. Estava a 6,7 Hz, que nao se le como
      // passo -- le-se como vibracao, e era metade do "andam picando". Um
      // homem a marchar bate o pe duas vezes por segundo.
      _p.y += Math.abs(Math.sin(t * 0.010 + j * 1.7)) * 0.22 * ESCALA_TROPA;
      _e.set(0, -rumo, 0);
      _q.setFromEuler(_e);
      _s.set(ESCALA_TROPA, ESCALA_TROPA, ESCALA_TROPA);
      _m.compose(_p, _q, _s);
      for (const im of lista) im.setMatrixAt(conta[tipo], _m);
      conta[tipo]++;
    };

    if (ligadoAoJogo) {
      motivo = marchas.length ? "" : "sem marchas";
      // ── AS MARCHAS VERDADEIRAS ──────────────────────────────────────────
      // A fracao vem do motor (`posicaoRota`), medida no MESMO peso que conta
      // os turnos. Se aqui se andasse por pixel, o exercito atravessaria a
      // serra depressa demais no ecra e o que se ve deixaria de ser o que o
      // motor executa.
      const vistas = new Set();
      for (const m of marchas) {
        const via = eixoDe[m.de + ">" + m.para];
        if (!via) { motivo = "sem via para " + m.de + ">" + m.para; continue; }
        if (!tropaInst[m.tipo || "lanceiro"]) {
          motivo = "sem malha para o tipo " + m.tipo;
          continue;
        }
        const chave = m.dono + "|" + m.de + ">" + m.para + "|" + (m.tipo || "");
        vistas.add(chave);
        const tt = tSuave(chave, m.t, dtQuadro);
        const bruto = via.inv ? (1 - tt) * via.comp : tt * via.comp;
        const rumoExtra = via.inv ? Math.PI : 0;
        // a coluna estica-se ATRAS da cabeca: quem vai a frente chegou primeiro
        // ── AS FIGURAS SO EXISTEM ENQUANTO SE LEEM ──────────────────────
        // Abaixo dos dez pixeis nao se desenham: nao e economia, e que um
        // ponto escuro de dois pixeis nao informa ninguem -- e o estandarte
        // ja esta aceso por cima. De caminho, na vista de mapa inteiro
        // deixam de se desenhar centenas de figuras, que e onde o quadro
        // estava mais carregado.
        noCaminho(via, bruto, _pAux);
        const px = ALT_FIGURA * pxPorMetro(cam.position.distanceTo(_pAux));
        if (px >= PX_FIGURA_MORRE) {
          const quantos = Math.max(1, Math.min(12, Math.round(Math.sqrt(m.tropas || 1))));
          for (let j = 0; j < quantos; j++) {
            const atras = j * 7.0 * ESCALA_TROPA * (via.inv ? -1 : 1);
            meter(m.tipo || "lanceiro", via,
                  Math.max(0, Math.min(via.comp, bruto - atras)), rumoExtra, j);
          }
        }
      }
      // ── OS ESTANDARTES ─────────────────────────────────────────────────
      // Um por coluna, com tamanho fixo no ecra, e a opacidade a subir a
      // medida que as figuras se tornam ilegiveis. Entre os 20 e os 12 pixeis
      // veem-se os dois; e essa faixa que esconde a troca.
      let nb = 0;
      for (const m of marchas) {
        const via = eixoDe[m.de + ">" + m.para];
        if (!via || nb >= estandartes.length) continue;
        const chave = m.dono + "|" + m.de + ">" + m.para + "|" + (m.tipo || "");
        const tt = suave.has(chave) ? suave.get(chave) : m.t;
        const bruto = via.inv ? (1 - tt) * via.comp : tt * via.comp;
        noCaminho(via, bruto, _p);
        const px = ALT_FIGURA * pxPorMetro(cam.position.distanceTo(_p));
        // ── E DE PERTO O ESTANDARTE SAI DE CENA ─────────────────────────
        // Ele existe para SUBSTITUIR a figura quando ela deixa de se ler. A
        // partir do momento em que se veem os homens, ele deixou de ter
        // trabalho -- e um simbolo de mapa por cima de uma cena que ja se
        // percebe e so uma etiqueta a tapar o que se veio ver.
        // Apaga-se entre os 20 e os 34 pixeis: nessa faixa a coluna ja e
        // legivel e o simbolo ja nao faz falta.
        const op = px <= PX_BANDEIRA_CHEIA ? 1
                 : px >= PX_BANDEIRA_MORRE ? 0
                 : px <= PX_BANDEIRA_NASCE
                   ? 1 - 0.55 * (px - PX_BANDEIRA_CHEIA)
                         / (PX_BANDEIRA_NASCE - PX_BANDEIRA_CHEIA)
                   : 0.45 * (1 - (px - PX_BANDEIRA_NASCE)
                                 / (PX_BANDEIRA_MORRE - PX_BANDEIRA_NASCE));
        if (op <= 0.02) continue;
        const sp = estandartes[nb++];
        sp.visible = true;
        sp.material.map = texturaEstandarte(m.dono, m.tipo || "lanceiro",
                                            m.tropas || 1);
        sp.material.opacity = op;
        sp.material.needsUpdate = true;
        // acima da cabeca da coluna, nunca por cima dela
        _p.y += ALT_FIGURA * 1.25;
        sp.position.copy(_p);
        sp.scale.set(72 * 0.00052, 92 * 0.00052, 1);
      }
      for (let i = nb; i < estandartes.length; i++) estandartes[i].visible = false;

      // marchas que acabaram deixam de ter memoria: senao a proxima com a
      // mesma chave herdava o `t` da anterior e comecava a meio do caminho
      for (const k of [...suave.keys()]) if (!vistas.has(k)) suave.delete(k);
    } else {
      for (const sp of estandartes) sp.visible = false;
      for (const col of colunas) {
        if (!col.via) continue;
        const vel = VEL_DEMO[col.tipo] || 6;
        for (let j = 0; j < col.n; j++) {
          const volta = col.via.comp * 2;
          let d = ((t * 0.001 * vel + col.t0 - j * 7.0) % volta + volta) % volta;
          let sentido = 1;
          if (d > col.via.comp) { d = volta - d; sentido = -1; }
          meter(col.tipo, col.via, d, sentido < 0 ? Math.PI : 0, j);
        }
      }
    }
    for (const [tipo, lista] of Object.entries(tropaInst))
      for (const im of lista) { im.count = conta[tipo]; im.instanceMatrix.needsUpdate = true; }
    for (const [tipo, carne] of Object.entries(animados))
      for (let i = vivos[tipo]; i < carne.length; i++) carne[i].raiz.visible = false;
    nAnim = Object.values(vivos).reduce((a, b) => a + b, 0);
  }

  // ── O ESTANDARTE ────────────────────────────────────────────────────────
  // Desenhado num canvas e guardado em cache por (Rei, tipo, numero): sao
  // poucas combinacoes e cada uma so se desenha uma vez. Um por coluna, com
  // tamanho fixo no ECRA -- e o que faz dele um simbolo de mapa e nao um
  // objeto do mundo.
  const SINAL = { lanceiro: "↑", arqueiro: "›", cavaleiro: "♦" };
  const cacheBand = new Map();
  function texturaEstandarte(rei, tipo, n) {
    const chave = rei + "|" + tipo + "|" + n;
    if (cacheBand.has(chave)) return cacheBand.get(chave);
    const c = document.createElement("canvas");
    c.width = 72; c.height = 92;
    const g = c.getContext("2d");
    const cor = "#" + new THREE.Color(COR_REI[rei] || COR_REI.null).getHexString();
    // o pano: retangulo com a ponta em bico, como um pendao
    g.beginPath();
    g.moveTo(6, 4); g.lineTo(66, 4); g.lineTo(66, 62);
    g.lineTo(36, 78); g.lineTo(6, 62); g.closePath();
    g.fillStyle = cor; g.fill();
    g.lineWidth = 5; g.strokeStyle = "rgba(12,8,3,.85)"; g.stroke();
    g.fillStyle = "#fff6e0";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 34px system-ui, sans-serif";
    g.fillText(String(n), 36, 32);
    g.font = "700 22px system-ui, sans-serif";
    g.fillText(SINAL[tipo] || "", 36, 58);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (cacheBand.size > 240) {                 // nao cresce sem fim
      const velha = cacheBand.keys().next().value;
      cacheBand.get(velha).dispose();
      cacheBand.delete(velha);
    }
    cacheBand.set(chave, t);
    return t;
  }
  // um lote de sprites reaproveitados: 64 chegam e sobram, e criar/destruir
  // sprites a cada quadro seria lixo para o coletor
  const estandartes = [];
  for (let i = 0; i < 64; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      sizeAttenuation: false, depthTest: false, transparent: true,
      toneMapped: false }));
    sp.renderOrder = 950;
    sp.visible = false;
    cena.add(sp);
    estandartes.push(sp);
  }

  const _fp = new THREE.Vector3(), _fs = new THREE.Vector3(), _fm = new THREE.Matrix4();
  function fumegar(t) {
    let i = 0;
    for (const f of fogos)
      for (let k = 0; k < POR_FOGO; k++) {
        const ciclo = ((t * 0.00022 + f.fase + k / POR_FOGO) % 1);
        const tam = 1.6 + ciclo * 7.0;
        _fp.set(f.p[0] + Math.sin(ciclo * 3.1 + f.fase) * ciclo * 3.0,
                f.p[2] + 5.0 + ciclo * 16.0,
                -f.p[1] + Math.cos(ciclo * 2.3 + f.fase) * ciclo * 2.0);
        _fs.set(tam * (1 - ciclo * 0.15), tam * (1 - ciclo * 0.15), 1);
        _fm.compose(_fp, cam.quaternion, _fs);
        imFumo.setMatrixAt(i++, _fm);
      }
    imFumo.instanceMatrix.needsUpdate = true;
  }

  // ── o laco ──────────────────────────────────────────────────────────────
  let relogio = 0, parado = false, ultimo = performance.now();
  let quadros = 0, fps = 0, vivo = true;
  function tamanho() {
    const w = hospedeiro.clientWidth || innerWidth;
    const h = hospedeiro.clientHeight || innerHeight;
    rend.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  addEventListener("resize", tamanho);
  tamanho();

  function laco() {
    if (!vivo) return;
    requestAnimationFrame(laco);
    quadros++;
    const agora = performance.now();
    // teto de 100 ms: com a pagina escondida o navegador estrangula o rAF, e
    // sem isto as tropas teleportavam-se meio mapa ao voltar
    dtQuadro = Math.min(agora - ultimo, 100);
    if (!parado) relogio += dtQuadro;
    ultimo = agora;
    ctrl.update();
    porTropas(relogio);
    // os tocadores so andam para os que estao a vista: um mixer parado nao
    // custa nada, e sao 48 poços por tipo
    const dts = dtQuadro / 1000;
    for (const carne of Object.values(animados))
      for (const s of carne) if (s.raiz.visible) s.mix.update(dts);
    fumegar(relogio);
    if (matMar.userData.sh) matMar.userData.sh.uniforms.tempo.value = relogio * 0.001;
    for (const rei of Object.keys(panos))
      if (panos[rei].mat.userData.sh)
        panos[rei].mat.userData.sh.uniforms.tempo.value = relogio * 0.001;
    // a sombra segue a camara: um mapa unico a cobrir 2,8 km daria menos de um
    // pixel por metro e as sombras sairiam em degraus
    const RS = Math.min(Math.max(ctrl.getDistance() * 0.75, 60), 700);
    sol.target.position.copy(ctrl.target);
    sol.position.copy(ctrl.target).add(
      new THREE.Vector3(-dSol[0], -dSol[1], -dSol[2]).multiplyScalar(RS * 2.2));
    const sc = sol.shadow.camera;
    sc.left = -RS; sc.right = RS; sc.top = RS; sc.bottom = -RS;
    sc.near = 1; sc.far = RS * 5;
    sc.updateProjectionMatrix();
    rend.render(cena, cam);
  }
  setInterval(() => { fps = quadros * 2; quadros = 0; }, 500);
  laco();

  const M3 = new THREE.Matrix4(), V3 = new THREE.Vector3();
  const Q3 = new THREE.Quaternion(), S3 = new THREE.Vector3();

  return {
    cena, cam, ctrl, rend, MAPA, THREE,
    get fps() { return fps; },
    get pecas() { return nInst; },
    get triangulos() { return nTri; },
    // quantas figuras estao de facto no ecra, por tipo. Existe porque "nao vejo
    // tropas" tem duas causas muito diferentes -- nao ha nenhuma, ou ha e estao
    // escondidas -- e sem este numero as duas parecem iguais.
    // o interior, para quando "nao aparece" precisar de virar um numero
    // a BIBLIOTECA de pecas, para quem quiser montar uma cena de comparacao.
    // E o que permite a `tamanhos.html` existir sem duplicar o carregamento do
    // glTF nem a montagem da cena -- a mesma luz, o mesmo chao, as mesmas
    // pecas, que e a unica maneira de uma comparacao valer alguma coisa.
    get banco() { return banco; },
    get diagnostico() {
      return { ligadoAoJogo, marchas: marchas.length, figurasAnimadas: nAnim,
               tiposComMalha: Object.keys(tropaInst),
               viasConhecidas: Object.keys(eixoDe).length,
               ultimoMotivo: motivo };
    },
    get contagemTropas() {
      const r = {};
      for (const [tipo, l] of Object.entries(tropaInst)) r[tipo] = l[0] ? l[0].count : 0;
      return r;
    },
    parar(v) { parado = !!v; },
    redimensionar: tamanho,
    destruir() { vivo = false; rend.dispose(); hospedeiro.removeChild(tela); },

    // ── A UNICA PORTA POR ONDE O JOGO ENTRA ───────────────────────────────
    atualizar(estado) {
      ligadoAoJogo = true;
      marchas = estado.marchas || [];
      relogioDoTurno(estado.turno);

      // as bandeiras: cada aldeia entra na lista do seu dono
      const conta = { A: 0, B: 0, null: 0 };
      const dono = {};
      for (const a of (estado.aldeias || [])) dono[a.slug] = a.dono || "null";
      for (const m of mastros) {
        const rei = dono[m.cid] || "null";
        const alvo = panos[rei];
        if (!alvo || conta[rei] >= alvo.im.instanceMatrix.count) continue;
        const larg = 3.4, alt = 2.2;
        V3.set(m.p[0], m.p[2] + ALT_MASTRO - alt * 0.75, -m.p[1]);
        Q3.setFromEuler(new THREE.Euler(0, (conta[rei] * 2.3) % 6.28, 0));
        S3.set(larg, alt, 1);
        M3.compose(V3, Q3, S3);
        alvo.im.setMatrixAt(conta[rei]++, M3);
      }
      for (const rei of Object.keys(panos)) {
        panos[rei].im.count = conta[rei];
        panos[rei].im.instanceMatrix.needsUpdate = true;
      }

      // as chapas: numero de tropas, ou o que o fog deixa ver
      for (const a of (estado.aldeias || [])) {
        const tom = a.dono === "A" ? "#6f9fd8" : a.dono === "B" ? "#d8756a" : "#8a8578";
        if (a.visivel === false) {
          pintarChapa(a.slug, a.lembrada ? "T" + a.lembrada : "?", "#5d5a52");
        } else {
          pintarChapa(a.slug, String(a.tropas ?? ""), tom);
        }
      }
    },
  };
}
