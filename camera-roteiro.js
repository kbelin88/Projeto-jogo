// camera-roteiro.js — a camera por ROTEIRO (keyframes), funcoes puras.
//
// UMD como o engine.js: `require` no Node, global `CameraRoteiro` no navegador.
// Nada aqui le o relogio (nem Date.now nem performance.now): a pose e funcao
// SO do roteiro e do tempo `t` que lhe derem -- e e isso que faz duas
// gravacoes darem o mesmo filme.
//
// Roteiro:
//   { "keyframes": [ { "t": 0, "alvo": "lisboa" | [x,y,z], "dist": 900,
//                      "angulo": 45, "elevacao": 41, "easing": "suave" }, ... ] }
//   t        segundos (>= 0, estritamente crescente)
//   alvo     slug/id/nome de aldeia (resolvido por quem chama) OU [x,y,z] em
//            metros do mundo 3D (y = altura; z = -y do mapa)
//   dist     distancia da camera ao alvo, em metros (> 0)
//   angulo   azimute em graus: 0 = camera a sul do alvo (+z), 90 = a este (+x)
//   elevacao opcional, em graus acima do horizonte (por omissao, a do apontar())
//   easing   linear | suave (easeInOutCubic) | segurar; vale para o trecho que
//            CHEGA a este keyframe (o do 1.o nao conta)
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.CameraRoteiro = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // a inclinacao de `M3D.apontar`: camera em (+0,5 d ; +0,62 d ; +0,5 d)
  const ELEVACAO_PADRAO = Math.atan2(0.62, Math.SQRT1_2) * 180 / Math.PI;
  const EASINGS = ["linear", "suave", "segurar"];

  function validarRoteiro(r) {
    if (!r || typeof r !== "object") throw new Error("roteiro invalido: esperava um objeto { keyframes: [...] }");
    const ks = Array.isArray(r) ? r : r.keyframes;
    if (!Array.isArray(ks) || ks.length === 0) throw new Error("roteiro invalido: 'keyframes' tem de ser uma lista com pelo menos 1 keyframe");
    const saida = [];
    ks.forEach((k, i) => {
      const onde = "keyframe " + i;
      if (!k || typeof k !== "object") throw new Error("roteiro invalido: " + onde + " nao e um objeto");
      if (typeof k.t !== "number" || !isFinite(k.t) || k.t < 0)
        throw new Error("roteiro invalido: " + onde + ": 't' tem de ser um numero >= 0 (segundos)");
      if (i > 0 && !(k.t > saida[i - 1].t))
        throw new Error("roteiro invalido: " + onde + ": 't' (" + k.t + ") tem de ser maior que o do keyframe anterior (" + saida[i - 1].t + ")");
      const a = k.alvo;
      if (Array.isArray(a)) {
        if (a.length !== 3 || !a.every((v) => typeof v === "number" && isFinite(v)))
          throw new Error("roteiro invalido: " + onde + ": 'alvo' como lista tem de ser [x,y,z] com 3 numeros");
      } else if (!(typeof a === "string" && a.trim()) && !(typeof a === "number" && isFinite(a))) {
        throw new Error("roteiro invalido: " + onde + ": 'alvo' tem de ser uma aldeia (slug, id ou nome) ou [x,y,z]");
      }
      if (typeof k.dist !== "number" || !isFinite(k.dist) || !(k.dist > 0))
        throw new Error("roteiro invalido: " + onde + ": 'dist' tem de ser um numero > 0 (metros)");
      if (typeof k.angulo !== "number" || !isFinite(k.angulo))
        throw new Error("roteiro invalido: " + onde + ": 'angulo' tem de ser um numero (graus)");
      if (k.elevacao !== undefined && (typeof k.elevacao !== "number" || !isFinite(k.elevacao) || k.elevacao <= 0 || k.elevacao > 90))
        throw new Error("roteiro invalido: " + onde + ": 'elevacao' tem de estar entre 0 e 90 graus");
      const easing = k.easing === undefined ? "suave" : k.easing;
      if (EASINGS.indexOf(easing) < 0)
        throw new Error("roteiro invalido: " + onde + ": 'easing' '" + easing + "' desconhecido (use " + EASINGS.join(" | ") + ")");
      saida.push({ t: k.t, alvo: Array.isArray(a) ? a.slice() : a, dist: k.dist, angulo: k.angulo,
                   elevacao: k.elevacao === undefined ? ELEVACAO_PADRAO : k.elevacao, easing });
    });
    return { keyframes: saida, _validado: true };
  }

  function curva(easing, u) {
    if (easing === "linear") return u;
    if (easing === "segurar") return u < 1 ? 0 : 1;
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;   // easeInOutCubic
  }

  // diferenca de angulo pelo caminho mais curto, em (-180, 180]
  function difAngulo(de, para) {
    let d = ((para - de) % 360 + 360) % 360;
    if (d > 180) d -= 360;
    return d;
  }

  function posicaoDe(alvo, dist, angulo, elevacao) {
    const az = angulo * Math.PI / 180, el = elevacao * Math.PI / 180;
    return [alvo[0] + dist * Math.cos(el) * Math.sin(az),
            alvo[1] + dist * Math.sin(el),
            alvo[2] + dist * Math.cos(el) * Math.cos(az)];
  }

  // `roteiro` ja validado (ou um bruto: valida-se aqui, e e barato).
  // `resolverAlvo(alvo)` -> [x,y,z] para as aldeias; as listas passam direto.
  function poseNoTempo(roteiro, t, resolverAlvo) {
    const ks = (roteiro && roteiro._validado ? roteiro : validarRoteiro(roteiro)).keyframes;
    const res = (a) => {
      if (Array.isArray(a)) return a;
      if (typeof resolverAlvo !== "function") throw new Error("alvo '" + a + "' e uma aldeia mas nao ha resolverAlvo");
      const p = resolverAlvo(a);
      if (!Array.isArray(p) || p.length !== 3) throw new Error("aldeia desconhecida no roteiro: '" + a + "'");
      return p;
    };
    const tt = typeof t === "number" && isFinite(t) ? t : 0;
    let A, B, u = 0, ease = "linear";
    if (tt <= ks[0].t || ks.length === 1) { A = B = ks[0]; }
    else if (tt >= ks[ks.length - 1].t) { A = B = ks[ks.length - 1]; }
    else {
      let i = 1;
      while (ks[i].t < tt) i++;
      A = ks[i - 1]; B = ks[i];
      ease = B.easing;
      u = curva(ease, (tt - A.t) / (B.t - A.t));
    }
    const a = res(A.alvo), b = res(B.alvo);
    const alvo = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    const dist = A.dist + (B.dist - A.dist) * u;
    const angulo = A.angulo + difAngulo(A.angulo, B.angulo) * u;
    const elevacao = A.elevacao + (B.elevacao - A.elevacao) * u;
    return { alvo, posicao: posicaoDe(alvo, dist, angulo, elevacao), dist, angulo, elevacao };
  }

  return { validarRoteiro, poseNoTempo, ELEVACAO_PADRAO, EASINGS };
});
