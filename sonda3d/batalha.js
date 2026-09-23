// batalha.js — a cena de um combate de estrada, dentro do mapa do jogo.
//
// ── DE ONDE VEM ─────────────────────────────────────────────────────────────
// A encenação foi feita e aprovada na bancada `encontro.html`: duas hostes em
// formação, flechas, golpes, tombos. Aqui ela deixa de ser uma demonstração e
// passa a correr NO JOGO, com os números do motor.
//
// ⚠ A DIFERENÇA QUE MUDA A CENA: na bancada o perdedor debandava. No motor não
// existe debandada -- `resolverCombateEstrada` tira o perdedor INTEIRO do
// trânsito (campo `aniquilados`) e o vencedor perde uma fração. Portanto aqui
// o perdedor cai até ao último homem, e o vencedor perde a proporção que o
// motor diz. O que se vê tem de ser o que o motor executou.
//
// A cena não decide nada: recebe o resultado e encena-o.
import * as THREE from "./vendor/three.module.js";
import { clone as clonarComOssos } from "./vendor/utils/SkeletonUtils.js";

const PARADO = { lanceiro: /alerted_stand/i, arqueiro: /alerted_stand/i,
                 cavaleiro: /^idle$/i };
const GOLPE = { lanceiro: /hit_spear/i, arqueiro: /hit_spear/i,
                cavaleiro: /hit_sword/i };
const ANDAR = { lanceiro: /idle_walk/i, arqueiro: /idle_walk/i,
                cavaleiro: /^gallop$/i };
// o Rei B tinge a figura (os soldados vêm todos de azul) -- a mesma regra do mapa
const TINTA_B = new THREE.Color(0xe08070);
const POR_LADO = 8;              // figuras por hoste: um símbolo, não um censo
const FOLGA_M = 9.0;             // metros entre as duas frentes
const FILA_M = 4.6;              // entre fileiras
const LARG_M = 3.2;              // entre homens da mesma fileira
// ⚠ QUANTAS AO MESMO TEMPO. Medido numa partida burro x burro (21/09): em 23
// turnos abriram-se 59 combates de estrada. A 16 figuras com esqueleto cada,
// isso sao ~950 bonecos animados -- a placa nao aguenta e nem se veem todos.
// Fica um punhado; as mais velhas fecham para dar lugar as novas.
const MAX_VIVAS = 6;
// ── A BATALHA CABE NO TURNO (23/09) ────────────────────────────────────────
// A cena media-se em SEGUNDOS: no minimo 5 de luta e 12 de rescaldo, com um
// marcador "1x4" por cima. A 1x (2 s por turno) isso sao ~8 turnos com a
// batalha no mapa enquanto o jogo seguia -- as barras acumulavam-se e as
// colunas passavam por elas (o Lucas, 23/09). No motor o combate de estrada
// resolve-se DENTRO do turno; o desenho tem de fazer o mesmo.
//
// Agora a cena mede-se no RELOGIO DO REPLAY (turno + fracao): comeca no
// instante do encontro e acaba em `fimT` (ver `janelaCena` na ponte3d.js),
// no maximo um quarto de turno depois do fim do turno. Pausar o replay pausa
// a batalha; gravar a 0.35x da uma batalha mais lenta. Sem marcador, sem
// rescaldo: os caidos apagam-se no ultimo quarto da cena e, quando ela acaba,
// a estrada esta limpa.
//
// Sem relogio (jogo ao vivo, bancada `encontro.html`) cai no modo antigo, em
// segundos -- mas tambem sem rescaldo.
const APAGAR_DESDE = 0.75;       // fracao da cena em que os caidos comecam a apagar-se

export function criarBatalhas({ cena, fontes, escala = 2.2, formacao = null }) {
  const vivas = [];
  // ⚠ era um Set que nunca esquecia: numa sessao longa fica lixo por cada
  // combate ja fechado. Guarda a HORA e esquece o que ja passou.
  const feitas = new Map();
  const MEMORIA_MS = 10 * 60 * 1000;
  // ── QUEM ESTA A LUTAR NAO ESTA A MARCHAR ──────────────────────────────────
  // O mapa desenhava as duas colunas do motor POR CIMA da cena de batalha: via-se
  // os dois exercitos a atravessarem-se um pelo outro enquanto, ao lado, dezasseis
  // figuras lutavam. Foi o que o Lucas apanhou no replay (22/09). Enquanto a cena
  // corre, estas marchas nao se desenham -- a cena E a marcha delas.
  const emLuta = new Set();
  const chaveLuta = (dono, de, para) => dono + "|" + de + ">" + para;

  // ── AS FLECHAS ────────────────────────────────────────────────────────────
  // Um lote só, partilhado por todas as batalhas: uma salva é um SINAL de que
  // há combate, e não um objeto por seta. Exagerada de propósito -- uma flecha
  // à escala não se vê a trinta metros.
  const N_FLECHAS = 90;
  // ⚠ 1,7 m e nao 2,6: com a haste do tamanho de um homem a salva lia-se como
  // um monte de varas no chao (medido na 1.a gravacao no jogo, 21/09)
  const geoF = new THREE.CylinderGeometry(0.05, 0.075, 1.7, 4);
  const flechas = new THREE.InstancedMesh(
    geoF, new THREE.MeshStandardMaterial({ color: 0x6d5738, roughness: 0.92 }), N_FLECHAS);
  flechas.frustumCulled = false;
  flechas.castShadow = true;
  flechas.count = 0;
  cena.add(flechas);
  const voo = [];
  const GRAV = -30;
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  const _m = new THREE.Matrix4(), _cima = new THREE.Vector3(0, 1, 0);

  function lancar(de, para) {
    // voo curto: a batalha inteira pode durar meio segundo a 1x
    const tv = 0.35 + de.distanceTo(para) / 48;
    const v = para.clone().sub(de).divideScalar(tv);
    v.y -= 0.5 * GRAV * tv;
    voo.push({ o: de.clone(), v, t: 0, tv, cravada: -1 });
    if (voo.length > N_FLECHAS) voo.shift();
  }

  function moverFlechas(dt) {
    for (const f of voo) {
      if (f.cravada >= 0) { f.cravada += dt; continue; }
      f.t += dt;
      if (f.t >= f.tv) { f.t = f.tv; f.cravada = 0; }
    }
    // cravadas saem depressa: nada da batalha fica na estrada para o turno seguinte
    while (voo.length && voo[0].cravada > 0.8) voo.shift();
    let n = 0;
    for (const f of voo) {
      _o.set(f.o.x + f.v.x * f.t, f.o.y + f.v.y * f.t + 0.5 * GRAV * f.t * f.t,
             f.o.z + f.v.z * f.t);
      _d.set(f.v.x, f.v.y + GRAV * f.t, f.v.z).normalize();
      _q.setFromUnitVectors(_cima, _d);
      _m.compose(_o, _q, _s);
      flechas.setMatrixAt(n++, _m);
    }
    flechas.count = n;
    flechas.instanceMatrix.needsUpdate = true;
  }

  // ── QUEM ESTÁ NA FORMAÇÃO ─────────────────────────────────────────────────
  // A mesma repartição do mapa (todo o tipo que existe ganha pelo menos um
  // boneco), com a ordem da batalha de estrada: cavaleiro à frente, lanceiros
  // no meio, arqueiros atrás.
  const ORDEM = ["cavaleiro", "lanceiro", "arqueiro"];
  function reparte(comp) {
    if (formacao && formacao.formacaoDe) {
      return formacao.formacaoDe({ composicao: comp }, ORDEM)
        .map((b) => ({ tipo: b.tipo, n: Math.max(1, Math.round(b.n * POR_LADO / 12)) }));
    }
    const tipos = ORDEM.filter((t) => (comp[t] || 0) > 0);
    const total = tipos.reduce((s, t) => s + comp[t], 0) || 1;
    return tipos.map((t) => ({ tipo: t, n: Math.max(1, Math.round(POR_LADO * comp[t] / total)) }));
  }

  function figura(tipo, dono) {
    const g = fontes[tipo];
    if (!g) return null;
    const raiz = clonarComOssos(g.scene);
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.frustumCulled = false;
      if (o.material && o.material.color) {
        o.material = o.material.clone();
        if (dono === "B") o.material.color.multiply(TINTA_B);
      }
    });
    raiz.scale.setScalar(escala);
    const mix = new THREE.AnimationMixer(raiz);
    const acao = {};
    for (const [nome, padrao] of [["andar", ANDAR[tipo]], ["parar", PARADO[tipo]],
                                  ["bater", GOLPE[tipo]]]) {
      const cl = g.animations.find((a) => padrao.test(a.name))
        || g.animations.find((a) => /walk/i.test(a.name)) || g.animations[0];
      acao[nome] = mix.clipAction(cl);
    }
    acao.bater.setLoop(THREE.LoopOnce, 1);
    acao.bater.clampWhenFinished = true;
    cena.add(raiz);
    return { raiz, mix, acao, tipo, pose: null, caido: null, chao: 0 };
  }

  function pose(h, nome) {
    if (h.pose === nome || !h.acao[nome]) return;
    if (h.acao[h.pose]) h.acao[h.pose].fadeOut(0.2);
    h.acao[nome].reset().fadeIn(0.2).play();
    h.pose = nome;
  }

  function golpear(h) {
    if (h.acao[h.pose]) h.acao[h.pose].fadeOut(0.1);
    h.acao.bater.reset().fadeIn(0.1).play();
    h.pose = "bater";
  }

  function tombar(h) {
    if (h.caido) return false;
    h.caido = { t: 0 };
    for (const a of Object.values(h.acao)) a.fadeOut(0.15);
    return true;
  }

  // ── ABRIR UMA BATALHA ─────────────────────────────────────────────────────
  // `pos` é o sítio do encontro (metros do mundo) e `rumo` a direção da
  // estrada. O vencedor fica do lado de onde vinha; é assim que a cena
  // concorda com a marcha que continua depois.
  function abrir(b) {
    if (feitas.has(b.id)) return null;
    feitas.set(b.id, Date.now());
    const dir = new THREE.Vector3(Math.cos(b.rumo), 0, Math.sin(b.rumo)).normalize();
    const lado = new THREE.Vector3(-dir.z, 0, dir.x);
    const hostes = {};
    for (const quem of ["venc", "perd"]) {
      const sinal = quem === "venc" ? -1 : 1;     // o vencedor vem de "trás"
      const comp = quem === "venc" ? b.compVenc : b.compPerd;
      const dono = quem === "venc" ? b.vencedor : b.perdedor;
      const homens = [];
      let fundo = 0;
      for (const bl of reparte(comp || {})) {
        for (let k = 0; k < bl.n; k++) {
          const f = figura(bl.tipo, dono);
          if (!f) continue;
          const col = k % 3, lin = (k / 3) | 0;
          const atras = fundo + lin * FILA_M;
          const desl = dir.clone().multiplyScalar(sinal * (FOLGA_M / 2 + atras))
            .add(lado.clone().multiplyScalar((col - 1) * LARG_M));
          f.base = b.pos.clone().add(desl);
          f.raiz.position.copy(f.base);
          f.chao = f.base.y;
          // olham um para o outro: a peça olha para +Y no Blender, que a
          // exportação manda para -Z -- daí o quarto de volta a menos
          f.raiz.rotation.set(0, -(b.rumo + (sinal < 0 ? 0 : Math.PI)) - Math.PI / 2, 0);
          pose(f, "parar");
          f.acao.parar.time = Math.random() * 1.5;
          homens.push(f);
        }
        fundo += Math.ceil(bl.n / 3) * FILA_M + 2.4;
      }
      hostes[quem] = { homens, dono, dir: dir.clone().multiplyScalar(-sinal) };
    }
    // quantos do VENCEDOR caem: a proporção que o motor cobrou
    const totalVenc = b.totalVenc || 1;
    const perdeVenc = Math.min(hostes.venc.homens.length - 1,
      Math.round(hostes.venc.homens.length * (b.baixasVenc || 0) / totalVenc));
    const chaves = [];
    for (const dono of [b.vencedor, b.perdedor]) {
      chaves.push(chaveLuta(dono, b.de, b.para), chaveLuta(dono, b.para, b.de));
    }
    for (const c of chaves) emLuta.add(c);
    // a janela no relogio do replay; sem ela, segundos (jogo ao vivo, bancada)
    const noRelogio = Number.isFinite(b.inicioT) && Number.isFinite(b.fimT) && b.fimT > b.inicioT;
    const ba = { chaves, pos: b.pos.clone(), dir, lado, hostes, t: 0, u: 0,
                 inicioT: noRelogio ? b.inicioT : null, fimT: noRelogio ? b.fimT : null,
                 dur: b.segundos || 3.0, perdeVenc, proxTiro: 0, proxGolpe: 0,
                 nasceu: (typeof performance !== "undefined" ? performance.now() : Date.now()),
                 tombados: { venc: 0, perd: 0 } };
    vivas.push(ba);
    // o teto de cenas: a mais velha sai primeiro
    while (vivas.length > MAX_VIVAS) fechar(vivas.shift());
    return ba;
  }

  function fechar(ba) {
    for (const c of (ba.chaves || [])) emLuta.delete(c);
    // uma chave pode ser de DUAS cenas no mesmo troco: so se liberta a marcha
    // quando nenhuma outra viva a segura
    for (const outra of vivas) {
      if (outra !== ba) for (const c of (outra.chaves || [])) emLuta.add(c);
    }
    for (const quem of ["venc", "perd"]) {
      for (const f of ba.hostes[quem].homens) {
        cena.remove(f.raiz);
        f.mix.stopAllAction();
        f.raiz.traverse((o) => {
          if (o.isMesh && o.material && o.material.dispose) o.material.dispose();
        });
      }
    }
  }

  const _mao = new THREE.Vector3();
  function alvoAoAcaso(hoste) {
    const vivos = hoste.homens.filter((h) => !h.caido);
    return vivos.length ? vivos[(Math.random() * vivos.length) | 0] : null;
  }

  // `relogio` = turno + fracao do replay (null ao vivo e na bancada);
  // `msTurno` = quanto dura um turno no ecra agora, para converter o relogio em
  // segundos de animacao
  let relogioAnt = null;
  function passo(dt, relogio, msTurno) {
    const temRelogio = Number.isFinite(relogio);
    // o tempo de ANIMACAO desta chamada: no replay e o que o relogio andou
    // (pausado = zero, e a cena congela com o resto); sem relogio, o do ecra
    let dtAnim = dt;
    if (temRelogio) {
      const d = relogioAnt === null ? 0 : relogio - relogioAnt;
      dtAnim = Math.max(0, Math.min(1, d)) * (msTurno || 2000) / 1000;
    }
    relogioAnt = temRelogio ? relogio : null;
    moverFlechas(dtAnim);
    if (feitas.size > 200) {
      const agora = Date.now();
      for (const [id, quando] of feitas) if (agora - quando > MEMORIA_MS) feitas.delete(id);
    }
    for (let i = vivas.length - 1; i >= 0; i--) {
      const ba = vivas[i];
      ba.t += dtAnim;
      let u, durS;
      if (ba.fimT !== null) {
        // saiu do replay, ou voltou atras no replay: a cena nao pertence a
        // este momento -- fecha
        if (!temRelogio || relogio < ba.inicioT - 0.02) { fechar(ba); vivas.splice(i, 1); continue; }
        u = Math.max(0, Math.min(1, (relogio - ba.inicioT) / (ba.fimT - ba.inicioT)));
        durS = (ba.fimT - ba.inicioT) * (msTurno || 2000) / 1000;
      } else {
        u = Math.min(1, ba.t / ba.dur);
        durS = ba.dur;
      }
      ba.u = u;
      // os golpes e as flechas espalham-se pela cena, seja ela de meio segundo
      // (1x) ou de tres (0.35x)
      const cadTiro = Math.max(0.08, durS / 7), cadGolpe = Math.max(0.1, durS / 5);

      // ── AS FLECHAS ABREM E OS GOLPES FECHAM ───────────────────────────────
      if (ba.t >= ba.proxTiro && u < 0.6) {
        ba.proxTiro = ba.t + cadTiro;
        for (const quem of ["venc", "perd"]) {
          const h = ba.hostes[quem];
          const arq = h.homens.filter((x) => x.tipo === "arqueiro" && !x.caido);
          if (!arq.length) continue;
          const a = arq[(Math.random() * arq.length) | 0];
          const alvo = alvoAoAcaso(ba.hostes[quem === "venc" ? "perd" : "venc"]);
          if (!alvo) continue;
          golpear(a);
          a.raiz.getWorldPosition(_mao);
          _mao.y += 3.2;
          lancar(_mao, alvo.raiz.position.clone().setY(alvo.chao + 1.0));
        }
      }
      if (ba.t >= ba.proxGolpe && u > 0.15 && u < 0.7) {
        ba.proxGolpe = ba.t + cadGolpe;
        for (const quem of ["venc", "perd"]) {
          const h = ba.hostes[quem];
          const lutam = h.homens.filter((x) => x.tipo !== "arqueiro" && !x.caido);
          if (lutam.length) golpear(lutam[(Math.random() * lutam.length) | 0]);
        }
      }

      // ── QUEM CAI, E QUANDO ────────────────────────────────────────────────
      // O perdedor cai TODO (o motor aniquila-o) ate 70% da cena; o vencedor
      // cai so a proporcao que o motor cobrou, ate 60%.
      const devemPerd = Math.round(ba.hostes.perd.homens.length * Math.min(1, u / 0.7));
      while (ba.tombados.perd < devemPerd) {
        const alvo = alvoAoAcaso(ba.hostes.perd);
        if (!alvo || !tombar(alvo)) break;
        ba.tombados.perd++;
      }
      const devemVenc = Math.round(ba.perdeVenc * Math.min(1, u / 0.6));
      while (ba.tombados.venc < devemVenc) {
        const alvo = alvoAoAcaso(ba.hostes.venc);
        if (!alvo || !tombar(alvo)) break;
        ba.tombados.venc++;
      }

      // ── O AVANCO, A QUEDA E O APAGAR ──────────────────────────────────────
      const tQueda = Math.max(0.12, Math.min(0.6, durS * 0.2));
      const apaga = u > APAGAR_DESDE ? (u - APAGAR_DESDE) / (1 - APAGAR_DESDE) : 0;
      for (const quem of ["venc", "perd"]) {
        const h = ba.hostes[quem];
        for (const f of h.homens) {
          if (f.caido) {
            f.caido.t = Math.min(1, f.caido.t + dtAnim / tQueda);
            const q = f.caido.t;
            f.raiz.rotation.x = -(Math.PI / 2) * q * q * (3 - 2 * q);
            f.raiz.position.y = f.chao - 0.4 * q;
            if (apaga > 0) opacidade(f, 1 - apaga);
            continue;
          }
          f.mix.update(dtAnim);
          if (f.pose === "bater" && (f.acao.bater.paused
              || f.acao.bater.time >= f.acao.bater.getClip().duration - 1e-3)) pose(f, "parar");
          // as duas frentes fecham 2,5 m no primeiro terco da cena
          const avanco = Math.min(1, u / 0.3) * 2.5;
          f.raiz.position.copy(f.base).addScaledVector(h.dir, avanco);
        }
      }

      // ── ACABOU: A ESTRADA FICA LIMPA ──────────────────────────────────────
      // Sem rescaldo. Fecha a cena e liberta as marchas: o vencedor volta ao
      // desenho da estrada e segue (no replay, o `progMarcha` fa-lo recuperar
      // o atraso ate ao fim do turno).
      const agora = (typeof performance !== "undefined" ? performance.now() : Date.now());
      // ⚠ sem relogio, tambem pelo relogio do ecra: com a pagina escondida o rAF
      // e estrangulado e o `dt` deixa de correr (acumularam-se 59, 21/09)
      const esquecida = ba.fimT === null && agora - ba.nasceu > ba.dur * 1000 + 15000;
      if (u >= 1 || esquecida) {
        fechar(ba);
        vivas.splice(i, 1);
      }
    }
    return vivas.length;
  }

  // apagar uma figura caida (o material e da figura, clonado em `figura`)
  function opacidade(f, a) {
    f.raiz.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (!o.material.transparent) { o.material.transparent = true; o.material.needsUpdate = true; }
      o.material.opacity = Math.max(0, a);
    });
  }

  return {
    abrir,
    passo,
    get ativas() { return vivas.length; },
    // o mapa pergunta isto antes de desenhar cada marcha
    aLutar(dono, de, para) { return emLuta.has(chaveLuta(dono, de, para)); },
    // onde esta a batalha mais nova a decorrer -- e para la que a camara vai
    ondeEsta() {
      for (let i = vivas.length - 1; i >= 0; i--) {
        if (vivas[i].u < 1) return { pos: vivas[i].pos.clone(), falta: (1 - vivas[i].u) * vivas[i].dur };
      }
      return null;
    },
    // onde estao TODAS, para quem quiser levar a camara a mao
    lista() {
      return vivas.map((b) => ({ pos: b.pos.clone(), u: Math.round(b.u * 100) / 100,
                                 inicioT: b.inicioT, fimT: b.fimT,
                                 figuras: b.hostes.venc.homens.length
                                        + b.hostes.perd.homens.length,
                                 dePe: b.hostes.venc.homens.filter((f) => !f.caido).length
                                     + b.hostes.perd.homens.filter((f) => !f.caido).length }));
    },
    // para conferir de fora sem partida nenhuma
    get diagnostico() {
      return vivas.map((b) => ({ u: Math.round(b.u * 100) / 100, inicioT: b.inicioT, fimT: b.fimT,
        caidos: b.tombados.perd + b.tombados.venc,
        figuras: b.hostes.venc.homens.length + b.hostes.perd.homens.length,
        // as colunas que esta cena esconde (dono|de>para)
        chaves: (b.chaves || []).slice() }));
    },
  };
}
