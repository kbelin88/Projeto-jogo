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
  sol.shadow.mapSize.set(4096, 4096);
  cena.add(sol, sol.target);
  cena.add(new THREE.HemisphereLight(0xbcd8ef, 0x5c6340, 1.2));

  const cam = new THREE.PerspectiveCamera(42, 1, 2, LX * 2.2);
  cam.position.set(0, LY * 0.62, LY * 0.78);
  const ctrl = new OrbitControls(cam, tela);
  ctrl.enableDamping = true;
  ctrl.maxPolarAngle = Math.PI * 0.497;
  ctrl.minDistance = 12;
  ctrl.maxDistance = LX * 1.3;

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
  const contaTri = (m) => (m.geometry.index ? m.geometry.index.count
                                            : m.geometry.attributes.position.count) / 3;

  let nTri = 0, nInst = 0;
  for (const nome of ["chao", "estradas"])
    for (const ch of (banco[nome] || [])) {
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
  const TIPOS = MAPA.tropas || [];
  const VEL_DEMO = { lanceiro: 5.5, arqueiro: 7.0, cavaleiro: 11.0 };
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

  const _p = new THREE.Vector3(), _q = new THREE.Quaternion();
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

  function porTropas(t) {
    const conta = {};
    for (const tipo of Object.keys(tropaInst)) conta[tipo] = 0;
    const meter = (tipo, via, metros, rumoExtra, j) => {
      const lista = tropaInst[tipo];
      if (!lista || conta[tipo] >= TETO_TROPA) return;
      const rumo = noCaminho(via, metros, _p) + rumoExtra;
      const lat = ((j % 2) * 2 - 1) * 2.6;
      _p.x += Math.cos(rumo + Math.PI / 2) * lat;
      _p.z += Math.sin(rumo + Math.PI / 2) * lat;
      _p.y += Math.abs(Math.sin(t * 0.006 * 7 + j * 1.7)) * 0.22;
      _e.set(0, -rumo, 0);
      _q.setFromEuler(_e);
      _m.compose(_p, _q, _s);
      for (const im of lista) im.setMatrixAt(conta[tipo], _m);
      conta[tipo]++;
    };

    if (ligadoAoJogo) {
      // ── AS MARCHAS VERDADEIRAS ──────────────────────────────────────────
      // A fracao vem do motor (`posicaoRota`), medida no MESMO peso que conta
      // os turnos. Se aqui se andasse por pixel, o exercito atravessaria a
      // serra depressa demais no ecra e o que se ve deixaria de ser o que o
      // motor executa.
      for (const m of marchas) {
        const via = eixoDe[m.de + ">" + m.para];
        if (!via) continue;
        const bruto = via.inv ? (1 - m.t) * via.comp : m.t * via.comp;
        const rumoExtra = via.inv ? Math.PI : 0;
        // a coluna estica-se ATRAS da cabeca: quem vai a frente chegou primeiro
        const quantos = Math.max(1, Math.min(12, Math.round(Math.sqrt(m.tropas || 1))));
        for (let j = 0; j < quantos; j++) {
          const atras = j * 7.0 * (via.inv ? -1 : 1);
          meter(m.tipo || "lanceiro", via,
                Math.max(0, Math.min(via.comp, bruto - atras)), rumoExtra, j);
        }
      }
    } else {
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
    if (!parado) relogio += Math.min(agora - ultimo, 100);
    ultimo = agora;
    ctrl.update();
    porTropas(relogio);
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
    parar(v) { parado = !!v; },
    redimensionar: tamanho,
    destruir() { vivo = false; rend.dispose(); hospedeiro.removeChild(tela); },

    // ── A UNICA PORTA POR ONDE O JOGO ENTRA ───────────────────────────────
    atualizar(estado) {
      ligadoAoJogo = true;
      marchas = estado.marchas || [];

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
