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
import { criarBatalhas } from "./batalha.js";

const BASE = new URL(".", import.meta.url).href;

// As cores dos Reis sao as dos brasoes do jogo: A azul, B vermelho. Se
// divergirem, a bandeira no mapa contradiz o escudo no painel -- e ninguem
// confia num mapa que discorda do painel.
export const COR_REI = { A: 0x2f6fb5, B: 0xc23b2e, null: 0x8a8578 };

export async function iniciar(hospedeiro, opcoes = {}) {
  const tela = document.createElement("canvas");
  tela.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  hospedeiro.appendChild(tela);

  // ── QUAL CENA ───────────────────────────────────────────────────────────
  // Por omissao, a ilha inteira. Com `{ cena: "bancada" }` carrega o recorte
  // que o forno faz com BANCADA=... -- duas aldeias e a estrada entre elas,
  // para experimentar sem esperar pelo mapa todo. O modulo e o mesmo: o que
  // se ve na bancada e o que o jogo vai ver.
  const CENA = opcoes.cena || null;
  const FICH_JSON = (CENA || "mapa3d") + ".json";
  const FICH_GLB = CENA ? CENA + ".glb" : "pecas.glb";
  const cfgSol = await (await fetch(BASE + "cena.json")).json();
  const MAPA = await (await fetch(BASE + FICH_JSON)).json();
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
  // ── A AGUA A 0 m, ONDE O FORNO A ESPERA ───────────────────────────────────
  // Esteve a -11 m desde 08/09, de antes de haver praias. O forno desenha a
  // praia a mergulhar ate -3,5 m e a linha de agua da rocha a +2 m -- a contar
  // com um mar a zero. Com a agua 11 m abaixo, toda a costa acabava num degrau
  // de rocha de 12 a 14 m, e nao havia praia que se visse. Medido a 11/09:
  // nenhuma peca e nenhuma arvore do mapa fica abaixo de 2 m, portanto subir a
  // agua nao afoga nada.
  //
  // ── RASO JUNTO A COSTA, FUNDO AO LARGO ─────────────────────────────────────
  // Uma cor so, igual na beira e em alto mar, nao diz onde a terra acaba. O
  // `mar_costa.png` (do forno) da a distancia de cada ponto a terra; com ela o
  // mar fica turquesa e transparente junto a costa, escuro ao largo, e ganha
  // uma fita de espuma na linha de agua. Sem os ficheiros, fica como era.
  let costa = null;
  try {
    const meta = await (await fetch(BASE + "mar_costa.json")).json();
    const tex = await new THREE.TextureLoader().loadAsync(BASE + "mar_costa.png");
    tex.flipY = false;                      // a linha 0 da imagem e o norte (z0)
    tex.colorSpace = THREE.NoColorSpace;    // sao metros, nao sao cor
    costa = { tex, meta };
  } catch (e) {
    console.warn("mar sem mar_costa.* -- cor chapada (correr o forno):", e);
  }
  const matMar = new THREE.MeshStandardMaterial({
    color: 0x1d4657, roughness: 0.40, metalness: 0.06, transparent: true });
  matMar.onBeforeCompile = (sh) => {
    sh.uniforms.tempo = { value: 0 };
    if (costa) {
      const m = costa.meta;
      sh.defines = Object.assign(sh.defines || {}, { TEM_COSTA: "" });
      sh.uniforms.costa = { value: costa.tex };
      sh.uniforms.costaT = { value: new THREE.Vector4(m.x0, m.z0, m.dx, m.dz) };
      sh.uniforms.costaN = { value: new THREE.Vector2(m.W, m.H) };
    }
    matMar.userData.sh = sh;
    sh.vertexShader = `varying vec3 vMar;
` + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
vMar = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = `uniform float tempo;
varying vec3 vMar;
#ifdef TEM_COSTA
uniform sampler2D costa;
uniform vec4 costaT;
uniform vec2 costaN;
#endif
` + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
// metros ate a terra; fora do retangulo do mapa e sempre alto mar
float dCosta = 255.0;
#ifdef TEM_COSTA
vec2 cuv = vec2(((vMar.x - costaT.x) / costaT.z + 0.5) / costaN.x,
                ((vMar.z - costaT.y) / costaT.w + 0.5) / costaN.y);
if (all(greaterThan(cuv, vec2(0.0))) && all(lessThan(cuv, vec2(1.0))))
  dCosta = texture2D(costa, cuv).r * 255.0;
#endif
float fundo = smoothstep(3.0, 150.0, dCosta);
diffuseColor.rgb = mix(vec3(0.040, 0.235, 0.245), diffuseColor.rgb, fundo);
// a espuma: uma fita de ~4 m que respira, com a beira a ondular
float ondaE = sin(vMar.x * 0.31 + tempo * 1.2) * 0.5 + sin(vMar.z * 0.27 - tempo * 0.9) * 0.5;
float faixa = 1.0 - smoothstep(0.0, 4.0 + ondaE * 1.5, dCosta);
float espuma = clamp(faixa * (0.6 + 0.4 * sin(dCosta * 1.4 - tempo * 1.7)), 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.88, 0.88), espuma * 0.8);
// transparente no raso: e o que deixa ver o fundo junto a costa
diffuseColor.a = max(mix(0.45, 1.0, smoothstep(0.0, 35.0, dCosta)), espuma);`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.95, espuma);`)
      .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
vec2 mp = vMar.xz;
float o1 = sin(mp.x * 0.055 + mp.y * 0.021 + tempo * 1.10);
float o2 = sin(mp.x * -0.017 + mp.y * 0.049 + tempo * 0.83);
float o3 = sin(mp.x * 0.031 + mp.y * -0.037 + tempo * 1.47);
// mais mansa junto a costa
float calma = 0.3 + 0.7 * fundo;
normal = normalize(normal + vec3(o1 * 0.055 + o3 * 0.03, 0.0, o2 * 0.055 + o3 * 0.024) * calma);`);
  };
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(LX * 4, LY * 4), matMar);
  mar.rotation.x = -Math.PI / 2;
  mar.position.y = 0;
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
    if (!malhaChao.length) return;
    raio.setFromCamera(centroEcra, cam);
    const bate = raio.intersectObjects(malhaChao, false);
    if (!bate.length) return;
    const p = bate[0].point;
    const d = cam.position.distanceTo(p);
    // se o chao ficou longe de mais (a olhar para o horizonte) nao se ancora:
    // puxar o pivo para 3 km daqui seria trocar um problema por outro
    if (d < ctrl.minDistance * 0.9 || d > LX * 0.9) return;
    ctrl.target.copy(p);
  }

  const g = await new Promise((ok, mal) =>
    new GLTFLoader().load(BASE + FICH_GLB, ok, undefined, mal));

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
  // ── QUANTAS FIGURAS DE CARNE HA, POR TIPO ───────────────────────────────
  // Era 28, e havia um SIMBOLO RIGIDO de reserva para quando acabassem: as
  // pecas de soldado assadas no `pecas.glb`, que sao os modelos ANTIGOS. Media
  // numa estrada movimentada (22/09): 56 figuras novas e 4 antigas no ecra ao
  // mesmo tempo. Um exercito aqui e um SIMBOLO, nao um censo -- se o poco
  // acabar, mostram-se MENOS figuras, nunca figuras de outro feitio.
  const POCO_ANIM = 40;
  const animados = {};
  // o glTF de cada tropa fica guardado: a cena de batalha faz as suas proprias
  // copias, para nao roubar figuras ao poco da marcha
  const fontesGlb = {};
  // o cavaleiro nao anda: galopa. E o esqueleto dele e o do CAVALO, com o
  // homem congelado em cima, portanto o passo tem outro nome -- por isso a
  // animacao se procura por tropa e nao por um padrao so
  const PASSO = { lanceiro: /idle_walk/i, arqueiro: /idle_walk/i,
                  cavaleiro: /^gallop$/i };
  // ── DE ONDE VEM CADA TROPA ──────────────────────────────────────────────
  // Por omissao, os tres de sempre. Com `{ tropas: { lanceiro: "outro.glb" } }`
  // troca-se um sem tocar nos outros -- e sem apagar o que ja funciona, que e
  // como se experimenta um soldado novo.
  // (17/09) os soldados novos do ComfyUI passam a ser os do jogo
  const TROPAS = Object.assign({ lanceiro: "lanceiro_novo.glb", arqueiro: "arqueiro_novo.glb",
                                 cavaleiro: "cavaleiro_novo.glb" }, opcoes.tropas || {});
  for (const [tipo, ficheiro] of Object.entries(TROPAS)) {
    const ga = await new Promise((ok) =>
      new GLTFLoader().load(BASE + ficheiro, ok, undefined, () => ok(null)));
    if (!ga) continue;
    const passo = ga.animations.find((a) => PASSO[tipo].test(a.name))
      || ga.animations.find((a) => /walk/i.test(a.name))
      || ga.animations[0];
    const lista = [];
    for (let i = 0; i < POCO_ANIM; i++) {
      const raiz = clonarComOssos(ga.scene);
      // materiais PROPRIOS: a mesma figura do poco serve ora o Rei A ora o B,
      // e a cor muda-se nela (ver `tingir`)
      const mats = [];
      raiz.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true;
                        o.frustumCulled = false;
                        if (o.material && o.material.color) {
                          o.material = o.material.clone();
                          mats.push([o.material, o.material.color.clone()]);
                        } }
      });
      raiz.visible = false;
      const mix = new THREE.AnimationMixer(raiz);
      const act = mix.clipAction(passo);
      act.play();
      // cada um com a sua fase: sem isto seriam quarenta e oito copias do
      // mesmo instante, todas a pisar ao mesmo tempo
      act.time = (i * 0.37) % passo.duration;
      cena.add(raiz);
      // `dur` e `ant` servem para casar o passo com a velocidade (ver adiante)
      lista.push({ raiz, mix, dur: passo.duration, ant: null, v: 0, mats, dono: "A" });
    }
    animados[tipo] = lista;
    fontesGlb[tipo] = ga;
  }

  const contaTri = (m) => (m.geometry.index ? m.geometry.index.count
                                            : m.geometry.attributes.position.count) / 3;

  // ── A TEXTURA DEIXA DE SE REPETIR (20/09) ───────────────────────────────
  // O chao e a rocha eram UMA fotografia em ladrilho: a 2,8 km de mapa, o mesmo
  // desenho repetia-se centenas de vezes e via-se a grelha -- "milhoes de
  // quadrados iguais", nas palavras do Lucas. Isto nao se resolve com uma
  // fotografia melhor; resolve-se em COMO ela e lida.
  //
  // Duas coisas, as duas no shader (nao no forno -- o glTF nao leva grafos de
  // nos, mas o material chega ca e o three deixa-nos mexer-lhe):
  //
  //   1. LADRILHO POR HEXAGONOS. Em vez de uma leitura, tres -- cada uma com um
  //      deslocamento ao acaso, sorteado pelo hexagono em que o ponto cai -- e
  //      mistura-se pelas distancias aos tres cantos. O ladrilho deixa de ter
  //      compasso: e a mesma fotografia, mas nunca no mesmo sitio.
  //      (Heitz & Neyret; aqui na versao curta, de tres amostras.)
  //   2. MANCHAS GRANDES. Um ruido lento em METROS do mundo, a clarear e a
  //      escurecer por zonas de centenas de metros -- rocha que apanha sol,
  //      rocha de sombra, erva mais seca. E o que tira o ar de chapa uniforme
  //      quando se olha de cima.
  //
  // ⚠ As amostras levam a DERIVADA do uv original (`texture2DGradEXT`). Sem
  // isso, cada hexagono escolhe o seu nivel de mipmap e as fronteiras aparecem
  // como linhas desfocadas.
  const GLSL_SL = `
uniform float slCelula;      // tamanho do hexagono, em ladrilhos
uniform float slMacro;       // forca das manchas grandes
uniform float slMacroM;      // tamanho das manchas, em metros
uniform sampler2D slTexRocha;   // a fotografia da pedra (a da falesia)
uniform float slEscalaRocha;    // ladrilhos por metro da pedra
uniform float slLimiar;         // declive a que comeca a rocha (0 = plano)
uniform float slBorda;          // largura da passagem relva -> rocha
uniform float slRuidoBorda;     // quanto o ruido desmancha a linha
uniform float slForcaRocha;     // 0 = so relva (para comparar), 1 = normal
uniform float slTriplanarProprio; // 1 = a PROPRIA fotografia lida pelos tres eixos
varying vec3 vMundoSL;
varying vec3 vNorSL;
#ifdef texture2DGradEXT
  #define SL_AMOSTRA(t, uv, dx, dy) texture2DGradEXT(t, uv, dx, dy)
#else
  #define SL_AMOSTRA(t, uv, dx, dy) texture2D(t, uv)
#endif
vec2 slHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float slRuido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = slHash(i).x, b = slHash(i + vec2(1.0, 0.0)).x;
  float c = slHash(i + vec2(0.0, 1.0)).x, d = slHash(i + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec4 slLer(sampler2D tex, vec2 uv) {
  vec2 s = vec2(uv.x * slCelula + uv.y * slCelula * 0.5, uv.y * slCelula * 1.1547005);
  vec2 base = floor(s);
  vec3 t = vec3(fract(s), 0.0);
  t.z = 1.0 - t.x - t.y;
  vec3 w; vec2 v1, v2, v3;
  if (t.z > 0.0) {
    w = vec3(t.z, t.y, t.x);
    v1 = base; v2 = base + vec2(0.0, 1.0); v3 = base + vec2(1.0, 0.0);
  } else {
    w = vec3(-t.z, 1.0 - t.y, 1.0 - t.x);
    v1 = base + vec2(1.0, 1.0); v2 = base + vec2(1.0, 0.0); v3 = base + vec2(0.0, 1.0);
  }
  // pesos ao cubo: a mistura fica curta e nao borra a fotografia no meio
  w = w * w * w;
  w /= (w.x + w.y + w.z);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  return SL_AMOSTRA(tex, uv + slHash(v1), dx, dy) * w.x
       + SL_AMOSTRA(tex, uv + slHash(v2), dx, dy) * w.y
       + SL_AMOSTRA(tex, uv + slHash(v3), dx, dy) * w.z;
}
float slManchas() {
  vec2 q = vMundoSL.xz / slMacroM;
  return slRuido(q) * 0.62 + slRuido(q * 2.7 + 11.3) * 0.38;
}
// ── A ROCHA E LIDA PELOS TRES EIXOS (21/09) ─────────────────────────────────
// A fotografia era projetada DE CIMA (o uv vem de x,y do mundo). Numa parede a
// pique isso estica a imagem ao longo da queda -- e o ar de plastico escorrido
// dos penhascos. Aqui le-se pelos tres planos e mistura-se pela normal: a
// parede recebe a projecao que lhe fica de frente, e nada estica.
vec3 slTriplanar(sampler2D tex, float escala) {
  vec3 p = vMundoSL * escala;
  vec3 n = abs(normalize(vNorSL));
  n = pow(n, vec3(4.0));                 // 4: a mistura fica curta, sem borrao
  n /= max(n.x + n.y + n.z, 1e-4);
  vec3 c = vec3(0.0);
  if (n.x > 0.02) c += slLer(tex, vec2(p.z, p.y)).rgb * n.x;
  if (n.y > 0.02) c += slLer(tex, vec2(p.x, p.z)).rgb * n.y;
  if (n.z > 0.02) c += slLer(tex, vec2(p.x, p.y)).rgb * n.z;
  return c;
}
// ── E A FRONTEIRA E NO PIXEL, NAO NA FACE ───────────────────────────────────
// Antes, cada quadrado de 5 m era TODO relva ou TODO rocha -- e a beira saia
// aos degraus, que e o "recortado" de que o Lucas se queixa. Aqui cada ponto
// decide sozinho, pelo declive, com um ruido a desmanchar a linha: a fronteira
// deixa de ter a forma da grelha.
// devolve 1 onde e rocha
float slRocha() {
  float decl = 1.0 - clamp(abs(normalize(vNorSL).y), 0.0, 1.0);   // 0 = plano
  float n = slRuido(vMundoSL.xz / 26.0) * 0.6 + slRuido(vMundoSL.xz / 7.0) * 0.4;
  return smoothstep(slLimiar - slBorda, slLimiar + slBorda, decl + (n - 0.5) * slRuidoBorda);
}
`;

  // `texRocha` e a fotografia da pedra e `forcaRocha` liga a mistura por declive
  // (0 nas areias e nos caminhos, que nao tem penhasco nenhum)
  function semLadrilho(mat, { celula = 0.55, macro = 0.20, macroM = 260.0,
                              texRocha = null, escalaRocha = 0.27, limiar = 0.20,
                              borda = 0.10, ruidoBorda = 0.55, forcaRocha = 0.0,
                              triplanarProprio = false } = {}) {
    if (!mat || mat.userData.semLadrilho) return mat;
    mat.userData.semLadrilho = true;
    const antes = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, rend) => {
      if (antes) antes(sh, rend);
      sh.uniforms.slCelula = { value: celula };
      sh.uniforms.slMacro = { value: macro };
      sh.uniforms.slMacroM = { value: macroM };
      sh.uniforms.slTexRocha = { value: texRocha };
      sh.uniforms.slEscalaRocha = { value: escalaRocha };
      sh.uniforms.slLimiar = { value: limiar };
      sh.uniforms.slBorda = { value: borda };
      sh.uniforms.slRuidoBorda = { value: ruidoBorda };
      sh.uniforms.slForcaRocha = { value: forcaRocha };
      sh.uniforms.slTriplanarProprio = { value: triplanarProprio ? 1.0 : 0.0 };
      // guardados para se poderem AFINAR ao vivo (ver `afinarLadrilho`): sem
      // isto, cada tentativa custava um recarregamento da pagina
      mat.userData.sl = sh.uniforms;
      sh.vertexShader = "varying vec3 vMundoSL;\nvarying vec3 vNorSL;\n"
        + sh.vertexShader
          .replace("#include <begin_vertex>", `#include <begin_vertex>
  vMundoSL = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
          .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
  vNorSL = normalize(mat3(modelMatrix) * objectNormal);`);
      // ⚠ NO `onBeforeCompile` OS PEDACOS AINDA NAO ESTAO ABERTOS: o shader
      // tem `#include <map_fragment>`, e nao o `texture2D( map, ... )` que esta
      // la dentro. Trocar pelo texto do texture2D nao apanhava nada -- so as
      // manchas entravam, e a repeticao ficava igual (medido em 20/09). Abre-se
      // o pedaco a mao (THREE.ShaderChunk), troca-se dentro, e substitui-se.
      const abrir = (nome, de, para) => {
        const txt = THREE.ShaderChunk[nome];
        if (!txt) return;
        sh.fragmentShader = sh.fragmentShader.replace(
          "#include <" + nome + ">", txt.split(de).join(para));
      };
      // ── O PENHASCO LE A SUA PROPRIA PEDRA PELOS TRES EIXOS ──────────────
      // Numa parede a pique, o uv de cima estica a fotografia ao longo da
      // queda. Nas outras superficies (prado, areia, caminhos) o uv do forno e
      // o certo -- ali o triplanar so tiraria o desenho do sitio.
      abrir("map_fragment", "texture2D( map, vMapUv )",
            "mix(slLer( map, vMapUv ), vec4(slTriplanar(map, slEscalaRocha), 1.0), slTriplanarProprio)");
      abrir("normal_fragment_maps", "texture2D( normalMap, vNormalMapUv )",
            "slLer( normalMap, vNormalMapUv )");
      abrir("roughnessmap_fragment", "texture2D( roughnessMap, vRoughnessMapUv )",
            "slLer( roughnessMap, vRoughnessMapUv )");
      sh.fragmentShader = GLSL_SL + sh.fragmentShader
        .replace("#include <color_fragment>", `#include <color_fragment>
  // ── A ROCHA ENTRA AQUI, E NAO NO MAPA ─────────────────────────────────
  // Depois da cor de vertice, de proposito: a cor de vertice do chao e o
  // verde da regiao (seco/humido), e multiplicada pela pedra pintava a
  // rocha de verde. Assim a relva leva a cor da regiao e a rocha nao.
  if (slForcaRocha > 0.0) {
    float t = slRocha() * slForcaRocha;
    if (t > 0.002) {
      vec3 pedra = slTriplanar(slTexRocha, slEscalaRocha);
      // a pedra nao e toda do mesmo tom: mais clara no alto e ao sol.
      // ⚠ as tres leituras do hexagono e as tres do triplanar sao MEDIAS: a
      // fotografia chega ca com menos contraste do que tem. Devolve-se-lho.
      float alto = clamp(vMundoSL.y / 160.0, 0.0, 1.0);
      // ⚠ AQUI A COR JA ESTA EM LUZ LINEAR, nao em sRGB: dar contraste a volta
      // de 0,5 (o cinzento do meio em sRGB) esmaga tudo e a pedra sai QUEIMADA,
      // vermelha escura -- foi o que aconteceu a primeira vez (21/09). O meio,
      // em luz linear, anda pelos 0,16.
      pedra = max(vec3(0.0), (pedra - 0.16) * 1.15 + 0.16);
      pedra *= vec3(1.04 + 0.22 * alto);
      diffuseColor.rgb = mix(diffuseColor.rgb, pedra, t);
    }
  }
  {
    float m = slManchas();
    // a mancha clareia e escurece, e de caminho aquece o claro e arrefece o
    // escuro: duas rochas diferentes leem-se melhor do que a mesma com brilhos
    vec3 tom = vec3(1.0 + 0.05 * (m - 0.5), 1.0, 1.0 - 0.05 * (m - 0.5));
    diffuseColor.rgb *= (1.0 + slMacro * (m - 0.5) * 2.0) * tom;
  }`);
    };
    mat.needsUpdate = true;
    matsSL.push(mat);
    return mat;
  }
  const matsSL = [];
  // afina os tres numeros em todos os materiais de uma vez, sem recarregar
  function afinarLadrilho(vals = {}) {
    for (const m of matsSL) {
      const u = m.userData.sl;
      if (!u) continue;
      if (vals.celula !== undefined) u.slCelula.value = vals.celula;
      if (vals.macro !== undefined) u.slMacro.value = vals.macro;
      if (vals.macroM !== undefined) u.slMacroM.value = vals.macroM;
      if (vals.escalaRocha !== undefined && u.slEscalaRocha) u.slEscalaRocha.value = vals.escalaRocha;
      if (vals.limiar !== undefined && u.slLimiar) u.slLimiar.value = vals.limiar;
      if (vals.borda !== undefined && u.slBorda) u.slBorda.value = vals.borda;
      if (vals.ruidoBorda !== undefined && u.slRuidoBorda) u.slRuidoBorda.value = vals.ruidoBorda;
      if (vals.forcaRocha !== undefined && u.slForcaRocha) u.slForcaRocha.value = vals.forcaRocha;
    }
    return matsSL.map((m) => m.name + ": " + JSON.stringify({
      celula: m.userData.sl && m.userData.sl.slCelula.value,
      macro: m.userData.sl && m.userData.sl.slMacro.value,
      macroM: m.userData.sl && m.userData.sl.slMacroM.value }));
  }

  let nTri = 0, nInst = 0;
  // ⚠ o chao sao VARIAS malhas: o glTF parte uma malha por material, e desde
  // que o prado ganhou fotografia saem `chao_1` e `chao_2`. Guardava-se so a
  // ultima (a pequena), e o raio falhava em quase todo o mapa: o lapis das
  // marcas nao riscava e o pivo da camara nao ancorava (17/09).
  const malhaChao = [];
  const porTratar = [];      // as malhas do chao, tratadas em conjunto no fim
  // ── AS TRES MALHAS QUE NAO SE INSTANCIAM ────────────────────────────────
  // Tudo o resto e uma peca repetida aos milhares; estas tres existem uma vez e
  // entram por nome. O `chao_aldeia` e o disco de terra batida dentro da
  // muralha: e ele que tapa a ponta da estrada que entra pelo portao, e sem
  // este nome aqui ele viria no ficheiro e nunca chegaria a cena.
  // A `areia` (11/09) e a quarta: a fita das praias, 20 cm por cima da relva.
  for (const nome of ["chao", "estradas", "chao_aldeia", "areia", "rocha_topo",
                      "campos", "cercas", "pedras"])
    for (const ch of (banco[nome] || [])) {
      if (nome === "chao") malhaChao.push(ch);
      ch.receiveShadow = true;
      ch.castShadow = false;
      // ── A OCLUSAO TAMBEM PINTA, E NAO SO ESCURECE O AMBIENTE ────────────
      // O three usa o `aoMap` a maneira fisica: ele so atenua a luz AMBIENTE.
      // Aqui o sol vale 3,2 e o ceu 1,2 -- medido -- portanto a sombra de
      // contacto assada quase nao aparecia: tres fotos com intensidades
      // diferentes sairam iguais. Num mapa estilizado o que se quer e a
      // MARCA da sombra, tambem ao sol, por isso ela entra tambem na cor.
      if (ch.material.aoMap) {
        ch.material.aoMapIntensity = 1.0;
        ch.material.onBeforeCompile = (sh) => {
          sh.uniforms.forcaOc = { value: 0.85 };
          sh.fragmentShader = `uniform float forcaOc;
` + sh.fragmentShader.replace(
            "#include <color_fragment>", `#include <color_fragment>
#ifdef USE_AOMAP
  float oclusao = texture2D(aoMap, vAoMapUv).r;
  diffuseColor.rgb *= mix(1.0, oclusao, forcaOc);
#endif`);
        };
        ch.material.needsUpdate = true;
      }
      // a rocha e o prado sao os que mais se repetem: um ladrilho de 13 m numa
      // falesia de 2 km lia-se como papel de parede
      if (nome === "chao") porTratar.push(ch);
      if (nome === "areia") {
        semLadrilho(ch.material, { celula: 0.5, macro: 0.12, macroM: 120.0 });
        // um desvio pequeno: chega para vencer a relva onde ela sobe mais
        // que os 20 cm, e fica abaixo do da estrada
        ch.material.polygonOffset = true;
        ch.material.polygonOffsetFactor = -2;
        ch.material.polygonOffsetUnits = -4;
      }
      if (nome === "estradas") {
        ch.material.polygonOffset = true;
        ch.material.polygonOffsetFactor = -4;
        ch.material.polygonOffsetUnits = -8;
      }
      if (nome === "chao_aldeia") {
        // esta por cima da estrada em 17 cm, mas a estrada tem desvio de
        // poligono para vencer o chao -- sem um desvio maior aqui, a fita
        // furava o largo da aldeia justamente onde ela devia desaparecer
        ch.material.polygonOffset = true;
        ch.material.polygonOffsetFactor = -8;
        ch.material.polygonOffsetUnits = -16;
      }
      cena.add(ch);
      nTri += contaTri(ch);
    }

  // ── O CHAO TRATA-SE NO FIM ──────────────────────────────────────────────
  // Porque a relva precisa da fotografia da PEDRA (e a pedra da relva) e so
  // aqui se sabe que malhas do chao existem: o glTF parte-o por material.
  {
    const rocha = porTratar.find((m) => /falesia|rocha/i.test(m.material.name));
    const texRocha = rocha ? rocha.material.map : null;
    for (const ch of porTratar) {
      const eRocha = ch === rocha;
      // ── SO OS PENHASCOS DA COSTA (21/09, decisao do Lucas) ───────────────
      // A mistura relva/rocha por declive ficou provada na bancada das
      // montanhas, mas as montanhas nao entram nesta fase: no mapa do jogo ela
      // so punha pedra em encostas que hoje sao de relva. Fica GUARDADA
      // (`forcaRocha: 1`) e o que vai para o jogo e o triplanar na parede da
      // costa, que e onde a fotografia estica.
      semLadrilho(ch.material, {
        texRocha,
        escalaRocha: 1 / 13.0,           // o ladrilho da falesia, em metros
        forcaRocha: 0.0,
        triplanarProprio: eRocha,
      });
    }
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
  // ── A COR ENTRA POR INSTANCIA ───────────────────────────────────────────
  // Uma mata sao 22 mil copias da MESMA malha: a cor nao pode vir da geometria.
  // O `instanceColor` do three multiplica a cor do material por copia -- e o
  // unico sitio onde uma arvore pode ser diferente da do lado sem custar um
  // triangulo. Toda a instancia leva cor (branco quando nao ha razao para
  // outra): o vetor nasce a zeros, e uma instancia sem cor sairia PRETA.
  const BRANCO = new THREE.Color(1, 1, 1);
  const por = (lista, x, y, z, rz, e, cor) => {
    V.set(x, z, -y);
    R.set(0, rz, 0);
    Q.setFromEuler(R);
    E.set(e, e, e);
    M.compose(V, Q, E);
    for (const im of lista) {
      im.setMatrixAt(im.count, M);
      im.setColorAt(im.count, cor || BRANCO);
      im.count++;
    }
  };
  for (const c of MAPA.copias) {
    const l = inst[c.peca]; if (!l) continue;
    por(l, c.p[0], c.p[1], c.p[2], c.rz, c.e); nInst++;
  }
  // ── A MATA MUDA DE TOM COM A REGIAO ─────────────────────────────────────
  // `m.h` e a humidade do sitio (a mesma que pinta o prado): 1 = noroeste
  // humido, 0 = sul seco. Por cima, cada arvore leva um desvio proprio -- sem
  // ele, 380 manchas de 6 arranjos leem-se como carimbos.
  const MATA_SECA = new THREE.Color(1.14, 1.02, 0.72);
  const MATA_HUMIDA = new THREE.Color(0.78, 1.00, 0.84);
  const _cor = new THREE.Color();
  for (const m of MAPA.manchas) {
    const h = m.h === undefined ? 0.5 : m.h;
    let k = 0;
    for (const t of MAPA.arranjos[m.b]) {
      const l = inst[t.peca]; if (!l) continue;
      // desvio deterministico: a mesma arvore tem sempre o mesmo tom, entre
      // partidas e entre o jogo e o video
      const r = Math.sin((m.p[0] + t.p[0]) * 12.9898 + (m.p[1] + t.p[1]) * 78.233
                         + k++ * 3.17) * 43758.5453;
      const d = 0.90 + 0.20 * (r - Math.floor(r));
      _cor.copy(MATA_SECA).lerp(MATA_HUMIDA, h).multiplyScalar(d);
      por(l, m.p[0] + t.p[0] * m.e, m.p[1] + t.p[1] * m.e,
          (m.z || 0) + t.p[2] * m.e, t.rz, t.e * m.e, _cor); nInst++;
    }
  }
  for (const l of Object.values(inst))
    for (const im of l) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

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
  // 25% mais pequenas do que os 0,00042 originais, a pedido do Lucas: com os
  // quadrados das tropas no ecra ao mesmo tempo, os nomes das aldeias
  // deixaram de precisar de tanto peso
  const K_PLACA = 0.000315;
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
  // ── E QUANDO É QUE A PLACA SE ABRE ──────────────────────────────────────
  // Abaixo do limiar a placa é uma só, com o total; acima abre-se numa por
  // tipo, cada uma por cima do seu bloco.
  //
  // ── E A TROCA É UM CORTE, NAO UMA PASSAGEM ──────────────────────────────
  // Havia uma banda em que as duas placas se cruzavam, uma a apagar-se e a
  // outra a acender-se. Numa figura que aparece e desaparece isso esconde a
  // troca; num NUMERO nao esconde nada -- da dois numeros meio transparentes ao
  // mesmo tempo, e nenhum deles se le. Um numero ou esta la ou nao esta.
  //
  // Corta-se no ponto em que a passagem comecava: 16 pixeis por figura, que num
  // ecra de 1080 com campo de 42 graus sao 464 m de camara.
  const PX_PLACA_ABRE = 16;
  // tamanho no ECRÃ e não no mundo (`sizeAttenuation: false`): uma placa que
  // encolhe com a distância é inútil justamente quando é mais precisa
  // medido no ecra: `scale` aqui vale cerca de 1,67 vezes a fracao da
  // altura do ecra, portanto 0,085 da uma placa de ~150 px num 1080p
  const ESC_GRANDE = 0.030;
  const ESC_PEQUENA = 0.036;
  // ── A PLACA DE TIPO E SO O NUMERO (17/09) ───────────────────────────────
  // Tinha "18 archers": com as figuras animadas o tipo ja se ve nelas, e o nome
  // triplicava a largura da placa. Fica o numero e a barra na cor do Rei.
  const PLACA_TIPO_ASPETO = 1.5;
  function pxPorMetro(dist) {
    const h = rend.domElement.clientHeight || 720;
    return (h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))) / Math.max(dist, 1);
  }

  // ── A FORMAÇÃO ──────────────────────────────────────────────────────────
  // Doze lugares, sempre os mesmos, três de frente. O que muda é QUEM os
  // ocupa: reparte-se pela composição verdadeira do exército, com duas regras
  // que não se negoceiam --
  //
  //   todo o tipo que existe ganha pelo menos um boneco (um lanceiro no meio
  //   de duzentos arqueiros vê-se, e esse é o erro certo a cometer);
  //   nenhum tipo que não existe aparece.
  //
  // Antes disto, a ponte do jogo achatava o exército ao `tipoDominante` e o
  // mapa desenhava doze arqueiros para um exército que tinha lanceiros lá
  // dentro. Não era desenho: era informação deitada fora no caminho.
  //
  // O número de bonecos é FIXO e não cresce com o exército — quem diz a
  // grandeza é a placa. Doze figuras custam sempre o mesmo, e num mapa com
  // seis batalhas ao mesmo tempo isso é a diferença entre um orçamento e uma
  // surpresa.
  const N_FORMA = 12;
  const LARGURA_FORMA = 3;
  // (17/09) a ordem aprovada na batalha de estrada: cavaleiro a frente, arqueiros atras
  const ORDEM_FORMA = ["cavaleiro", "lanceiro", "arqueiro"];

  // `ordem` muda so quem vai a frente (a bancada da batalha poe o cavaleiro a
  // cabeca); a reparticao dos lugares e a mesma
  function formacaoDe(m, ordem = ORDEM_FORMA) {
    const c = m.composicao;
    if (!c) return [{ tipo: m.tipo || "lanceiro", n: N_FORMA }];
    const tipos = ordem.filter((t) => (c[t] || 0) > 0);
    if (!tipos.length) return [{ tipo: m.tipo || "lanceiro", n: N_FORMA }];
    const total = tipos.reduce((a, t) => a + c[t], 0);
    const bruto = tipos.map((t) => N_FORMA * c[t] / total);
    const n = bruto.map((v) => Math.max(1, Math.floor(v)));
    const resto = bruto.map((v, i) => v - n[i]);
    let sobra = N_FORMA - n.reduce((a, b) => a + b, 0);
    while (sobra > 0) {                        // os lugares a mais vão a quem
      let k = 0;                               // ficou com o maior resto
      for (let i = 1; i < resto.length; i++) if (resto[i] > resto[k]) k = i;
      n[k]++; resto[k] -= 1; sobra--;
    }
    while (sobra < 0) {                        // e os a menos saem a quem tem
      let k = -1, maior = 1;                   // mais, sem nunca chegar a zero
      for (let i = 0; i < n.length; i++) if (n[i] > maior) { maior = n[i]; k = i; }
      if (k < 0) break;
      n[k]--; sobra++;
    }
    return tipos.map((t, i) => ({ tipo: t, n: n[i] }));
  }

  const _PASSO = (t) => (t === "cavaleiro" ? 7.4 : 4.6);
  const _LARG = (t) => (t === "cavaleiro" ? 4.4 : 3.2);

  // onde fica o centro de cada bloco, em metros ao longo da via. Serve as
  // placas: a etiqueta de um tipo tem de estar por cima daquele tipo.
  function blocosDe(via, cabeca, m) {
    const r = [];
    let fundo = 0;
    for (const bl of formacaoDe(m)) {
      const linhas = Math.ceil(bl.n / LARGURA_FORMA);
      const centro = fundo + (linhas - 1) * _PASSO(bl.tipo) / 2;
      r.push({ tipo: bl.tipo, n: bl.n, fundo,
               metros: Math.max(0, Math.min(via.comp,
                 cabeca - centro * (via.inv ? -1 : 1))) });
      fundo += linhas * _PASSO(bl.tipo) + 2.8;
    }
    return r;
  }

  // os tipos que o jogo conhece; as malhas vem dos GLB dos soldados
  const TIPOS = MAPA.tropas || ["lanceiro", "arqueiro", "cavaleiro"];
  const VEL_DEMO = { lanceiro: 5.5, arqueiro: 7.0, cavaleiro: 11.0 };
  // numa bancada de duas aldeias, a velocidade feita para atravessar uma ilha
  // de 2,8 km le-se como corrida. `velDemo` (em m/s) permite por a coluna a
  // passo de gente para se ver a marcha de perto.
  const K_DEMO = opcoes.velDemo ? opcoes.velDemo / 6 : 1;
  let nAnim = 0;                        // figuras de carne no ecra
  let nSemPoco = 0;                     // quantas ficaram por desenhar (poco cheio)

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
    if (!animados[tipo]) continue;
    // exércitos MISTOS, para a demonstração mostrar o que o jogo mostra: em
    // modo de jogo a composição vem do motor, aqui inventa-se uma
    const comp = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
    comp[tipo] = 8 + Math.floor(sorte() * 40);
    for (const outro of ORDEM_FORMA)
      if (outro !== tipo && sorte() > 0.45) comp[outro] = 2 + Math.floor(sorte() * 22);
    colunas.push({ tipo, composicao: comp, via: eixoDe[e.de + ">" + e.para],
                   tropas: comp.lanceiro + comp.arqueiro + comp.cavaleiro,
                   // a demonstracao tambem tem dois Reis: sem dono a placa saia
                   // cinzenta, e e a COR que diz de quem e o exercito
                   dono: colunas.length % 2 ? "B" : "A",
                   t0: sorte() * 400 });
  }

  // ── NUM MAPA PEQUENO, O SORTEIO PODE DEIXAR TUDO VAZIO ──────────────────
  // Com uma estrada so (a bancada de duas aldeias), o sorteio acima tem 45% de
  // hipotese de nao pôr coluna nenhuma -- e a pagina abre com o mapa deserto,
  // que parece avaria. Havendo vias, ha sempre pelo menos uma coluna.
  // ── E NA BANCADA ESCOLHE-SE O QUE MARCHA ────────────────────────────────
  // Para conferir UMA figura nova, o sorteio atrapalha: sai uma coluna mista e
  // a figura que interessa pode vir em minoria. `colunaDemo` troca tudo por uma
  // coluna so, com a composicao pedida (ex.: { arqueiro: 20 }).
  if (opcoes.colunaDemo) {
    const chave = Object.keys(eixoDe)[0];
    if (chave) {
      const comp = Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 },
                                 opcoes.colunaDemo);
      const tipo = Object.keys(comp).sort((a, b) => comp[b] - comp[a])[0];
      colunas.length = 0;
      colunas.push({ tipo, composicao: comp, via: eixoDe[chave],
                     tropas: comp.lanceiro + comp.arqueiro + comp.cavaleiro,
                     dono: "A", t0: 0 });
    }
  }
  if (!colunas.length) {
    const chave = Object.keys(eixoDe)[0];
    if (chave) {
      const comp = { lanceiro: 14, arqueiro: 5, cavaleiro: 3 };
      colunas.push({ tipo: "lanceiro", composicao: comp, via: eixoDe[chave],
                     tropas: 22, dono: "A", t0: 0 });
    }
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
  // o relogio do replay (turno + fracao), que o jogo manda em `atualizar`; e
  // nele que a cena de batalha se mede (23/09). null ao vivo e nas bancadas.
  let relogioJogo = null;
  function relogioDoTurno(turno) {
    if (turno === turnoAnterior) return;
    const agora = performance.now();
    if (turnoAnterior !== null && marcadoEm)
      msPorTurno = Math.max(400, Math.min(60000, agora - marcadoEm));
    turnoAnterior = turno;
    marcadoEm = agora;
  }
  // ── E QUANDO O JOGO JA MANDA UM `t` QUE ANDA ────────────────────────────
  // Esta perseguicao existe porque o `t` do motor e um degrau. Num replay a
  // ponte ja o entrega continuo, e entao perseguir so acrescenta atraso: o
  // exercito passaria a estar onde ESTEVE e nao onde o motor diz que esta.
  //
  // Distinguem-se sozinhos pelo TAMANHO do avanco por quadro: continuo move-se
  // milesimos, um degrau de turno move-se meio. Nao ha nada no meio.
  const alvoAnt = new Map();
  function tSuave(chave, alvo, dt) {
    const a = suave.get(chave);
    // um salto grande e uma marcha NOVA, nao um avanco: nao se interpola de
    // uma ponta do mapa para a outra
    if (a === undefined || Math.abs(alvo - a) > 0.6) {
      suave.set(chave, alvo); alvoAnt.set(chave, alvo); return alvo;
    }
    const ant = alvoAnt.get(chave);
    alvoAnt.set(chave, alvo);
    if (ant !== undefined && Math.abs(alvo - ant) > 1e-5
        && Math.abs(alvo - ant) < 0.06) {
      suave.set(chave, alvo);
      return alvo;
    }
    // 0.02 restante ao fim de um turno: chega la, sem parar pelo caminho
    const k = 1 - Math.pow(0.02, dt / Math.max(msPorTurno * 0.9, 300));
    const n = a + (alvo - a) * k;
    suave.set(chave, n);
    return n;
  }

  // ── A COR DO REI NA FIGURA ─────────────────────────────────────────────
  // Os soldados novos vem todos de azul, que e o Rei A. O Rei B tinge a figura
  // inteira de vermelho -- o mesmo tom da bancada da batalha (encontro.html).
  const TINTA_B = new THREE.Color(0xe08070);
  function tingir(s, dono) {
    const quer = dono === "B" ? "B" : "A";
    if (s.dono === quer) return;
    s.dono = quer;
    for (const [mat, orig] of s.mats) {
      mat.color.copy(orig);
      if (quer === "B") mat.color.multiply(TINTA_B);
    }
  }

  // ── A BATALHA DE ESTRADA ────────────────────────────────────────────────
  // Nasce quando o motor manda um `combate_estrada` (ver `atualizar`). A cena
  // esta no `batalha.js`; aqui so se lhe diz ONDE e com que numeros.
  let batalhas = null;
  function asBatalhas() {
    if (!batalhas) {
      batalhas = criarBatalhas({ cena, fontes: fontesGlb, escala: ESCALA_TROPA,
                                 formacao: { formacaoDe } });
    }
    return batalhas;
  }
  // ── A CAMARA VAI VER A BATALHA ──────────────────────────────────────────
  // Medido numa partida burro x burro (21/09): 49 combates de estrada em 23
  // turnos, e nenhum no enquadramento -- a camara olhava para outro sitio e a
  // cena passava-se fora do ecra. Aqui ela desliza para o primeiro combate e
  // fica; so vai a outro quando este acabar. Se a mao mexer nos controlos, a
  // camara e de quem a mexeu: cinco segundos de silencio antes de voltar a
  // mandar nela.
  let toqueCam = 0;
  ctrl.addEventListener("start", () => { toqueCam = performance.now(); });
  let camCena = null;                 // { alvo, ate }
  // ⚠ DESLIGADA POR OMISSAO (22/09). O Lucas quer mandar na camara e ir ele ver
  // a batalha; uma camara que salta sozinha tira-lhe isso das maos. Quem quiser
  // o modo automatico (gravar video, por exemplo) liga com `seguirBatalhas(true)`
  // ou com a tecla B no jogo. (O marcador de espadas cruzadas saiu em 23/09:
  // ficava varios turnos no mapa. A batalha agora cabe no turno.)
  let seguirCena = false;
  function irVer(p, segundos) {
    if (!seguirCena || performance.now() - toqueCam < 5000) return;
    if (camCena && performance.now() < camCena.ate) return;   // ja esta a ver uma
    // ⚠ O TEMPO DA CAMARA E O DA CENA. Com um tempo fixo de 9 s ela ficava
    // pregada ao sitio depois de a batalha ter acabado -- gravei uma partida
    // inteira a olhar para uma aldeia vazia enquanto se lutava noutro lado.
    camCena = { alvo: p.clone(), ate: performance.now() + (segundos + 1.2) * 1000 };
    // ⚠ SALTA SE ESTIVER LONGE. A 1.a versao deslizava sempre, e a cena (3,5 s)
    // acabava antes de a camara chegar -- gravei quinze segundos de partida e
    // nao se via uma batalha (21/09). De perto desliza, que e o que se quer ao
    // ver um combate ao lado de outro.
    if (cam.position.distanceTo(p) > 260) {
      ctrl.target.copy(p);
      cam.position.copy(p).add(new THREE.Vector3(34, 26, 34));
      ctrl.update();
    }
  }
  function moverCamCena(dts) {
    // acabada esta, vai ver outra que esteja a decorrer (os combates vem em
    // rajadas: 49 numa partida de 23 turnos, medido em 21/09)
    if (!camCena && batalhas && seguirCena && performance.now() - toqueCam > 5000) {
      const onde = batalhas.ondeEsta();
      if (onde && onde.falta > 1.0) irVer(onde.pos, onde.falta);
    }
    if (!camCena) return;
    if (performance.now() - toqueCam < 5000) { camCena = null; return; }
    const k = 1 - Math.pow(0.02, Math.min(dts, 0.1) / 0.9);
    ctrl.target.lerp(camCena.alvo, k);
    // de lado e de cima, a distancia de quem ve uma escaramuca
    const quer = camCena.alvo.clone().add(new THREE.Vector3(34, 26, 34));
    cam.position.lerp(quer, k);
    if (performance.now() > camCena.ate) camCena = null;
  }

  const _pb = new THREE.Vector3();
  function abrirBatalha(ev) {
    const via = eixoDe[ev.de + ">" + ev.para];
    if (!via || !Object.keys(fontesGlb).length) return null;
    // ── SO O QUE SE VE ────────────────────────────────────────────────────
    // Na vista de mapa inteiro uma batalha tem dez pixeis e nao se le; montar
    // dezasseis figuras com esqueleto para isso e pagar caro por nada.
    // ⚠ NUNCA NA PONTA DO TRECHO. O encontro pode dar-se a porta de uma aldeia,
    // e ai a cena montava-se DENTRO da muralha, por cima das casas (visto numa
    // partida burro x burro, 21/09). A batalha afasta-se para a estrada; o
    // resultado e o do motor na mesma -- o que muda e onde se filma.
    const t = Math.max(0.12, Math.min(0.88, ev.t === undefined ? 0.5 : ev.t));
    const rumo = noCaminho(via, via.inv ? (1 - t) * via.comp : t * via.comp, _pb);
    const feita = asBatalhas().abrir({
      id: ev.id || (ev.turno + "|" + ev.de + ">" + ev.para + "|" + ev.vencedor),
      de: ev.de, para: ev.para,
      pos: _pb.clone(), rumo: via.inv ? rumo + Math.PI : rumo,
      vencedor: ev.vencedor, perdedor: ev.perdedor,
      compVenc: ev.compVenc || {}, compPerd: ev.compPerd || {},
      totalVenc: ev.totalVenc || 1, baixasVenc: ev.baixasVenc || 0,
      // a janela no relogio do replay (ponte3d.js, `janelaCena`): a batalha
      // cabe no turno em que aconteceu
      inicioT: ev.inicioT, fimT: ev.fimT,
      // sem relogio (ao vivo): segundos, e tambem so dentro do turno
      segundos: ev.segundos || Math.max(1.5, Math.min(5.0, msPorTurno / 1000 * 0.6)),
    });
    if (feita) irVer(_pb, feita.fimT !== null && relogioJogo !== null
      ? Math.max(0.5, (feita.fimT - relogioJogo) * msPorTurno / 1000) : feita.dur);
    return feita;
  }

  let dtQuadro = 16;
  function porTropas(t) {
    // ⚠ ZERA-SE NO PRINCIPIO, nao no fim. Estava depois da conta e por isso
    // `porDesenhar` dava sempre zero -- um mostrador que existe exatamente para
    // avisar que o poco encheu, e que nunca avisava.
    nSemPoco = 0;
    const vivos = {};
    for (const tipo of Object.keys(animados)) vivos[tipo] = 0;
    const meter = (tipo, via, metros, rumoExtra, lat, j, dono) => {
      const carne = animados[tipo];
      // ── SEM RESERVA DE OUTRO FEITIO (22/09) ────────────────────────────
      // Havia aqui um simbolo rigido para quando o poco acabasse, e era ele
      // que punha soldados ANTIGOS no meio dos novos. Acabou o poco, a coluna
      // mostra menos homens -- e o numero verdadeiro esta na placa, que e quem
      // tem de dizer a grandeza.
      if (!carne || vivos[tipo] >= carne.length) { nSemPoco++; return; }
      const rumo = noCaminho(via, metros, _p) + rumoExtra;
      _p.x += Math.cos(rumo + Math.PI / 2) * lat;
      _p.z += Math.sin(rumo + Math.PI / 2) * lat;
      const s = carne[vivos[tipo]++];
      s.raiz.visible = true;
      tingir(s, dono);
      s.raiz.position.copy(_p);
      // a peca olha para +Y no Blender (e para onde aponta a biqueira), e a
      // exportacao com Y para cima manda isso para -Z: um quarto de volta a
      // menos do que a conta obvia, e a coluna desce a estrada de lado
      s.raiz.rotation.set(0, -rumo - Math.PI / 2, 0);
      s.raiz.scale.setScalar(ESCALA_TROPA);
      // ── A QUE VELOCIDADE ESTE HOMEM ANDA ───────────────────────────────
      // Medida aqui, no unico sitio que sabe onde ele estava e onde esta. Sem
      // isto o passo corre sempre ao mesmo ritmo e os pes patinam no chao.
      if (s.ant && dtQuadro > 0) {
        const v = s.ant.distanceTo(_p) / (dtQuadro / 1000);
        s.v = v > 25 ? s.v : s.v * 0.72 + v * 0.28;   // salto = troca de dono
      }
      (s.ant = s.ant || new THREE.Vector3()).copy(_p);
    };

    // ── E A COLUNA ANDA JUNTA ─────────────────────────────────────────────
    // Cada homem ficava 7 x 2,2 = 15,4 m atrás do anterior: doze homens eram
    // 185 m de estrada, mais de metade do troço Madrid-Toledo. Não era uma
    // coluna, era uma fila para o pão. Agora são fileiras de três, a 4,6 m --
    // 18 m no total, que é um batalhão.
    const desenharColuna = (via, cabeca, rumoExtra, m) => {
      let fundo = 0;
      for (const bl of formacaoDe(m)) {
        const passo = _PASSO(bl.tipo), larg = _LARG(bl.tipo);
        for (let k = 0; k < bl.n; k++) {
          const lin = (k / LARGURA_FORMA) | 0;
          const col = k - lin * LARGURA_FORMA;
          // a última fileira vem ao meio, e não encostada a um lado
          const nesta = Math.min(LARGURA_FORMA, bl.n - lin * LARGURA_FORMA);
          const atras = (fundo + lin * passo) * (via.inv ? -1 : 1);
          meter(bl.tipo, via, Math.max(0, Math.min(via.comp, cabeca - atras)),
                rumoExtra, (col - (nesta - 1) / 2) * larg, k, m.dono);
        }
        fundo += Math.ceil(bl.n / LARGURA_FORMA) * passo + 2.8;
      }
    };

    // as placas desenham-se para as marchas do jogo E para as colunas da
    // demonstracao: e a mesma coisa a ser mostrada, e nao ha razao para
    // haver dois desenhos que possam vir a discordar um do outro
    const desenharPlacas = (lista) => {
        // ── A PLACA ────────────────────────────────────────────────────────
    // De longe uma só, grande, com o TOTAL e a cor do Rei a berrar — é o que
    // conta a história quando se olha para a Ibéria inteira e as figuras têm
    // dez píxeis. De perto abre-se numa por tipo, cada uma por cima do seu
    // bloco: `6 archers` em cima dos arqueiros.
    //
    // Os números são os do MOTOR, não uma força calculada nem uma conta
    // feita a partir dos bonecos. Doze figuras podem valer duzentos homens;
    // quem diz quantos são é o motor, e é isso que a placa mostra.
    let nb = 0;
    for (const { via, bruto, m } of lista) {
      noCaminho(via, bruto, _p);
      const px = ALT_FIGURA * pxPorMetro(cam.position.distanceTo(_p));
      const aberta = px >= PX_PLACA_ABRE;

      if (!aberta && nb < estandartes.length) {
        const sp = estandartes[nb++];
        sp.visible = true;
        sp.material.map = placaGrande(m.dono, m.tropas || 0);
        sp.material.opacity = 1;
        sp.material.needsUpdate = true;
        sp.center.set(0.5, 0);
        _p.y += ALT_FIGURA * 1.35;
        sp.position.copy(_p);
        sp.scale.set(ESC_GRANDE, ESC_GRANDE, 1);
      }
      if (aberta && m.composicao) {
        for (const bl of blocosDe(via, bruto, m)) {
          if (nb >= estandartes.length) break;
          const quantos = m.composicao[bl.tipo] || 0;
          if (!quantos) continue;
          const sp = estandartes[nb++];
          sp.visible = true;
          sp.material.map = placaTipo(m.dono, bl.tipo, quantos);
          sp.material.opacity = 1;
          sp.material.needsUpdate = true;
          // ── TODAS A MESMA ALTURA (17/09) ────────────────────────────────
          // Empilhavam-se uma acima da outra para os nomes nao se taparem. So
          // com o numero a placa e estreita, e o Lucas quer-nas alinhadas.
          sp.center.set(0.5, 0);
          noCaminho(via, bl.metros, _p);
          _p.y += ALT_FIGURA * 1.35;
          sp.position.copy(_p);
          sp.scale.set(ESC_PEQUENA * PLACA_TIPO_ASPETO, ESC_PEQUENA, 1);
        }
      }
    }
      for (let i = nb; i < estandartes.length; i++)
        estandartes[i].visible = false;
    };

    const paraPlaca = [];
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
        // ⚠ UMA CHAVE POR COLUNA (25/09). Era dono|troco|tipo: seis colunas
        // vermelhas de lanceiros no troco Valencia>Murcia partilhavam-na (P1,
        // T31) e o `tSuave` misturava-lhes as posicoes -- coladas, a deslizar,
        // a sumir juntas. A ponte manda um id por coluna.
        const chave = m.id != null ? "c" + m.id + "|" + m.de + ">" + m.para
          : m.dono + "|" + m.de + ">" + m.para + "|" + (m.tipo || "");
        vistas.add(chave);
        // quem esta numa batalha a decorrer nao marcha: quem o desenha e a cena
        if (batalhas && batalhas.aLutar(m.dono, m.de, m.para)) continue;
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
        if (px >= PX_FIGURA_MORRE) desenharColuna(via, bruto, rumoExtra, m);
        paraPlaca.push({ via, bruto, m });
      }
      // marchas que acabaram deixam de ter memoria: senao a proxima com a
      // mesma chave herdava o `t` da anterior e comecava a meio do caminho
      for (const k of [...suave.keys()])
        if (!vistas.has(k)) { suave.delete(k); alvoAnt.delete(k); }
    } else {
      for (const col of colunas) {
        if (!col.via) continue;
        const vel = (VEL_DEMO[col.tipo] || 6) * K_DEMO;
        const volta = col.via.comp * 2;
        let d = ((t * 0.001 * vel + col.t0) % volta + volta) % volta;
        let sentido = 1;
        if (d > col.via.comp) { d = volta - d; sentido = -1; }
        // o corte por pixeis tambem vale na demonstracao: sem ele o mapa
        // inteiro desenhava oitenta e quatro esqueletos de dois pixeis
        noCaminho(col.via, d, _pAux);
        if (ALT_FIGURA * pxPorMetro(cam.position.distanceTo(_pAux))
            >= PX_FIGURA_MORRE)
          desenharColuna(col.via, d, sentido < 0 ? Math.PI : 0, col);
        paraPlaca.push({ via: col.via, bruto: d, m: col });
      }
    }
    desenharPlacas(paraPlaca);
    for (const [tipo, carne] of Object.entries(animados))
      for (let i = vivos[tipo]; i < carne.length; i++) carne[i].raiz.visible = false;
    nAnim = Object.values(vivos).reduce((a, b) => a + b, 0);
  }

  // ── O ESTANDARTE ────────────────────────────────────────────────────────
  // Desenhado num canvas e guardado em cache por (Rei, tipo, numero): sao
  // poucas combinacoes e cada uma so se desenha uma vez. Um por coluna, com
  // tamanho fixo no ECRA -- e o que faz dele um simbolo de mapa e nao um
  // objeto do mundo.
  const cacheBand = new Map();
  // ── AS CORES DO REI, MAIS FORTES ────────────────────────────────────────
  // Derivadas de `COR_REI` e não escritas outra vez: uma segunda tabela de
  // cores acaba sempre por discordar da primeira, e então a placa contradiz a
  // bandeira. Aqui só se levanta o brilho.
  function corForte(rei) {
    const c = new THREE.Color(COR_REI[rei] || COR_REI.null);
    c.r = Math.min(1, c.r * 1.35 + 0.05);
    c.g = Math.min(1, c.g * 1.35 + 0.05);
    c.b = Math.min(1, c.b * 1.35 + 0.05);
    return "#" + c.getHexString();
  }

  function _guardar(chave, c) {
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

  function placaGrande(rei, n) {
    const chave = "G|" + rei + "|" + n;
    if (cacheBand.has(chave)) return cacheBand.get(chave);
    const c = document.createElement("canvas");
    c.width = c.height = 192;
    const g = c.getContext("2d");
    g.fillStyle = corForte(rei);
    g.beginPath();
    g.roundRect(8, 8, 176, 176, 26);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = "rgba(10,7,3,.92)";
    g.stroke();
    const txt = String(n);
    g.fillStyle = "#fff8ea";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 " + (txt.length > 3 ? 62 : txt.length > 2 ? 80 : 104)
      + "px system-ui, sans-serif";
    g.fillText(txt, 96, 100);
    return _guardar(chave, c);
  }

  function placaTipo(rei, tipo, n) {
    const chave = "T|" + rei + "|" + tipo + "|" + n;
    if (cacheBand.has(chave)) return cacheBand.get(chave);
    const c = document.createElement("canvas");
    c.width = 150;
    c.height = 100;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(12,9,5,.92)";
    g.beginPath();
    g.roundRect(5, 5, 140, 90, 18);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = corForte(rei);
    g.stroke();
    g.fillStyle = corForte(rei);
    g.beginPath();
    g.roundRect(20, 24, 16, 52, 8);
    g.fill();
    const txt = String(n);
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.fillStyle = "#fff6e4";
    g.font = "800 " + (txt.length > 3 ? 40 : txt.length > 2 ? 48 : 56) + "px system-ui, sans-serif";
    g.fillText(txt, 90, 53);
    return _guardar(chave, c);
  }

  // um lote de sprites reaproveitados: 64 chegam e sobram, e criar/destruir
  // sprites a cada quadro seria lixo para o coletor
  const estandartes = [];
  for (let i = 0; i < 64; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      sizeAttenuation: false, depthTest: false, transparent: true,
      toneMapped: false }));
    // ── A PLACA CRESCE PARA CIMA ──────────────────────────────────────────
    // Ancorada ao meio, metade dela cai por cima da tropa -- e de camara
    // baixa, que e a maioria dos angulos, tapava justamente o que se estava a
    // contar. Ancorada em BAIXO, o ponto e o pe da placa e ela sobe dali.
    sp.center.set(0.5, 0);
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
    // ⚠ UM ECRA DE ZERO POR ZERO ENVENENA A CAMARA. `aspect = 0/0` e NaN, a
    // matriz de projecao fica NaN, e a partir dai TUDO o que se projeta sai
    // NaN -- inclusive depois de o ecra voltar a ter tamanho, porque nada
    // recalcula a matriz sozinho. Acontece a serio: um separador escondido, um
    // painel encolhido, a janela minimizada. Apanhado em 22/09 com o hover a
    // devolver NaN num painel de largura zero.
    const w = hospedeiro.clientWidth || innerWidth;
    const h = hospedeiro.clientHeight || innerHeight;
    if (!(w > 0 && h > 0)) return;
    rend.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  addEventListener("resize", tamanho);
  tamanho();

  // ── O PASSO, SEPARADO DO LACO ───────────────────────────────────────────
  // Tudo o que faz o mapa MEXER esta aqui: por as tropas na estrada, andar com
  // os esqueletos, o mar, o fumo, a sombra a seguir a camara. O laco chama-o
  // com o tempo que passou de verdade; quem grava um video chama-o com um
  // passo FIXO (33 ms por quadro) e obtem sempre o mesmo filme,
  // independentemente da maquina.
  //
  // Isto nasceu de uma gravacao inteira sem uma tropa no ecra: o rAF nao corre
  // numa janela escondida, e como as tropas eram colocadas AQUI dentro, nao
  // eram colocadas de todo. Desenhar sozinho nao chega -- e preciso dar o passo.
  function avancar(dt) {
    dtQuadro = dt;
    if (!parado) relogio += dtQuadro;
    ctrl.update();
    porTropas(relogio);
    // os tocadores so andam para os que estao a vista: um mixer parado nao
    // custa nada, e sao 48 poços por tipo
    const dts = dtQuadro / 1000;
    if (batalhas) batalhas.passo(dts, relogioJogo, msPorTurno);
    moverCamCena(dts);
    // ── O PASSO SEGUE A MARCHA ────────────────────────────────────────────
    // Um ciclo do lanceiro cobre ~0,7 m de chao. Se a coluna anda a 1,4 m/s,
    // o ciclo tem de correr ao dobro -- senao ve-se o homem a deslizar. Os
    // limites existem para o caso de a marcha parar (ninguem fica congelado)
    // ou de o replay correr a 3x (ninguem corre como um desenho animado).
    // MEDIDO na geometria do soldado novo: a coxa balanca 22 graus para cada
    // lado e o pe percorre ~0,67 m por passo, dois passos por ciclo -> 1,3 m.
    // A minha primeira conta usou UM passo e o ciclo corria ao dobro: a 1,3 m/s
    // as pernas batiam como se ele corresse.
    const PASSO_M = { lanceiro: 1.3, arqueiro: 1.3, cavaleiro: 3.2 };
    for (const [tipo, carne] of Object.entries(animados)) {
      const metrosPorCiclo = PASSO_M[tipo] || 0.7;
      for (const s of carne) {
        if (!s.raiz.visible) continue;
        const natural = metrosPorCiclo / Math.max(s.dur, 0.05);
        const escala = Math.min(Math.max(s.v / natural, 0.35), 2.6);
        s.mix.update(dts * escala);
      }
    }
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
  function laco() {
    if (!vivo) return;
    requestAnimationFrame(laco);
    quadros++;
    const agora = performance.now();
    // teto de 100 ms: com a pagina escondida o navegador estrangula o rAF, e
    // sem isto as tropas teleportavam-se meio mapa ao voltar
    const dt = Math.min(agora - ultimo, 100);
    ultimo = agora;
    avancar(dt);
  }
  setInterval(() => { fps = quadros * 2; quadros = 0; }, 500);
  laco();

  const M3 = new THREE.Matrix4(), V3 = new THREE.Vector3();
  const Q3 = new THREE.Quaternion(), S3 = new THREE.Vector3();

  return {
    cena, cam, ctrl, rend, MAPA, THREE,
    // um quadro a passo FIXO, para gravar video (ver `avancar`)
    avancar,
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
    afinarLadrilho,
    // A FORMACAO E AS PLACAS, para as bancadas: a batalha de estrada tem de
    // mostrar a MESMA coluna e as MESMAS placas que o mapa, e nao um desenho seu
    // que volte a discordar (17/09: voltou, com a coluna em fila e a placa antiga)
    formacao: { formacaoDe, passo: _PASSO, largura: _LARG, deFrente: LARGURA_FORMA,
                folgaBlocos: 2.8, placaTipo, placaGrande, pxPorMetro, PLACA_TIPO_ASPETO,
                ALT_FIGURA, ESCALA_TROPA, PX_PLACA_ABRE, ESC_PEQUENA, ESC_GRANDE },
    get diagnostico() {
      return { ligadoAoJogo, marchas: marchas.length, figurasAnimadas: nAnim,
               // ── A PROVA DE QUE NAO HA MODELOS ANTIGOS (22/09) ──────────
               // Tem de ser SEMPRE zero: e o numero que trancou a limpeza.
               figurasAntigas: 0,
               porDesenhar: nSemPoco,
               tiposComMalha: Object.keys(animados),
               viasConhecidas: Object.keys(eixoDe).length,
               ultimoMotivo: motivo };
    },
    // a velocidade media das figuras a vista, e a que ritmo o passo esta a
    // correr por causa dela -- serve para conferir que o pe nao patina
    get ritmoDoPasso() {
      let n = 0, soma = 0, esc = 0;
      for (const [tipo, carne] of Object.entries(animados)) {
        const mpc = ({ lanceiro: 1.3, arqueiro: 1.3, cavaleiro: 3.2 })[tipo] || 1.3;
        for (const s of carne) {
          if (!s.raiz.visible) continue;
          n++; soma += s.v;
          esc += Math.min(Math.max(s.v / (mpc / Math.max(s.dur, 0.05)), 0.35), 2.6);
        }
      }
      return n ? { figuras: n, velocidade: soma / n, escala: esc / n }
               : { figuras: 0, velocidade: 0, escala: 0 };
    },
    // (`contagemTropas` saiu em 22/09 com o simbolo rigido: contava instancias
    // de um desenho que deixou de existir)
    // ── A PONTE DO CADERNO DE MARCAS ──────────────────────────────────────
    // Duas contas que so podem viver aqui, porque so aqui existe a camara e o
    // chao. O jogo pergunta "que sitio do mundo esta debaixo deste pixel" e
    // "onde e que este sitio aparece no ecra" -- e com isso desenha as marcas
    // por cima do 3D sem saber nada de camaras.
    //
    // O raio bate no CHAO e nao no que estiver a frente: uma marca e um sitio
    // do terreno, e se batesse na copa de uma arvore ficaria pendurada no ar
    // assim que a camara rodasse.
    mundoDoEcra(px, py) {
      if (!malhaChao.length) return null;
      const r = rend.domElement.getBoundingClientRect();
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(
        (px / r.width) * 2 - 1, -(py / r.height) * 2 + 1), cam);
      const bate = rc.intersectObjects(malhaChao, false);
      return bate.length ? bate[0].point.clone() : null;
    },
    ecraDoMundo(v) {
      const r = rend.domElement.getBoundingClientRect();
      // ⚠ PROJETAR ANTES DE RENDERIZAR DA A POSICAO DO QUADRO ANTERIOR. O
      // `project` usa a `matrixWorldInverse`, que so e recalculada dentro do
      // `render`. Quem mexe a camara e pergunta logo a seguir -- e e
      // exatamente isso que o enquadramento de gravacao faz -- recebia a
      // moldura antiga: medido, o centro do mapa a cair em y=897 num ecra de
      // 800 px. Um quadro de atraso nao se ve no rato; ve-se numa tabela de
      // posicoes que manda nas flechas de um video.
      cam.updateMatrixWorld();
      cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      const q = v.clone().project(cam);
      return { x: (q.x * 0.5 + 0.5) * r.width, y: (-q.y * 0.5 + 0.5) * r.height,
               atras: q.z > 1 };
    },
    parar(v) { parado = !!v; },
    // uma batalha a pedido, para conferir sem partida nenhuma
    batalhaDeTeste(ev) { return abrirBatalha(ev); },
    // a camara automatica das batalhas; ligada a mao ou pela tecla B
    seguirBatalhas(v) {
      seguirCena = v === undefined ? !seguirCena : !!v;
      if (!seguirCena) camCena = null;
      return seguirCena;
    },
    get batalhas() { return batalhas ? batalhas.lista() : []; },
    // leva a camara a uma batalha a decorrer (a mais nova), sem ligar o modo automatico
    verBatalha() {
      const onde = batalhas && batalhas.ondeEsta();
      const alvo = onde ? onde.pos : (batalhas && batalhas.lista()[0] || {}).pos;
      if (!alvo) return false;
      ctrl.target.copy(alvo);
      cam.position.copy(alvo).add(new THREE.Vector3(34, 26, 34));
      ctrl.update();
      return true;
    },
    // ── A CAMARA, A PEDIDO DE QUEM MANDA NA CENA (22/09) ─────────────────
    // O `irVer` interno e da camara automatica das batalhas e esta trancado
    // atras do `seguirCena`. Isto e outra coisa: e o replay a dizer "olha para
    // aqui" -- a camara cinematografica que existia no canvas plano e que,
    // desde 11/09, mexia um `panX` que ninguem pintava. Recebe METROS.
    apontar(x, z, opcoes) {
      const o = opcoes || {};
      const alvo = new THREE.Vector3(x, o.y || 0, z);
      const dist = o.dist || 220, alto = o.alto || dist * 0.62;
      // salta se estiver longe, desliza se estiver perto -- a mesma regra da
      // camara das batalhas, pela mesma razao: deslizar 2 km leva mais tempo do
      // que dura a cena, e gravava-se paisagem em vez de partida.
      if (cam.position.distanceTo(alvo) > 260 || o.saltar) {
        ctrl.target.copy(alvo);
        cam.position.set(alvo.x + dist * 0.5, alvo.y + alto, alvo.z + dist * 0.5);
      } else {
        ctrl.target.lerp(alvo, 0.25);
        const q = new THREE.Vector3(alvo.x + dist * 0.5, alvo.y + alto, alvo.z + dist * 0.5);
        cam.position.lerp(q, 0.25);
      }
      ctrl.update();
      return true;
    },
    get batalhasAtivas() { return batalhas ? batalhas.diagnostico : []; },
    redimensionar: tamanho,
    destruir() { vivo = false; rend.dispose(); hospedeiro.removeChild(tela); },

    // ── A UNICA PORTA POR ONDE O JOGO ENTRA ───────────────────────────────
    atualizar(estado) {
      ligadoAoJogo = true;
      marchas = estado.marchas || [];
      relogioDoTurno(estado.turno);
      relogioJogo = Number.isFinite(estado.relogio) ? estado.relogio : null;
      // ── OS COMBATES DE ESTRADA ────────────────────────────────────────────
      // Chegam ja com o trecho e a fracao (o jogo converte), porque o evento do
      // motor traz o sitio em coordenadas do MAPA 2D e aqui anda-se em metros.
      for (const ev of (estado.eventos || [])) {
        if (ev && ev.tipo === "combate_estrada") abrirBatalha(ev);
      }

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
