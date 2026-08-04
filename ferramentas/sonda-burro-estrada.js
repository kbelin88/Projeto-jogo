// sonda-burro-estrada.js — SONDA DE DIAGNOSTICO da Fase 1B (aprovada 04/08).
//
// Hipotese: o desequilibrio do burro vs burro (14/1, 2/17) NAO vem do motor
// nem da equilibragem do mapa (ambos simetricos: verificarEquilibrio()==[], e
// as 24 neutras espelham o par em tipo e guarnicao). Vem de o jogadorBurro
// escolher alvo por Math.hypot(x,y) sobre coordenadas COSMETICAS que NAO sao
// espelhadas (19 das 24 quebram o espelho euclidiano por +30px). O motor marcha
// por CUSTO DE ESTRADA (simetrico); o burro decide por PIXEL (assimetrico).
//
// Teste: um decisor de diagnostico igual ao jogadorBurro em TUDO menos no
// desempate de alvo — usa CUSTO DE ESTRADA em vez de pixel. Se o placar
// colapsar para perto do empate, a hipotese confirma-se.
//
// jogadorBurro fica INTACTO: este decisor vive so aqui. Reusa o `construir` do
// proprio jogadorBurro e so recalcula os `envios`. Zero custo de API.

const Engine = require("../engine.js");

function cfgPara(seed) {
  const c = JSON.parse(JSON.stringify(Engine.CONFIG));
  c.layout = "iberia";
  c.seed = seed;
  return c;
}

// decisor de diagnostico: construir = jogadorBurro; envios por CUSTO DE ESTRADA.
function burroPorEstrada(visao) {
  const cfg = visao.config;
  const base = Engine.jogadorBurro(visao); // reusa a logica de construcao tal e qual
  const envios = [];
  const shim = visao.estradas
    ? { config: cfg, estradas: { adj: visao.estradas, custo: visao.estradasCusto || null },
        aldeias: visao.minhas.concat(visao.alvos) }
    : null;
  const custo = (origem, alvo) => {
    if (!shim) return Math.hypot(origem.x - alvo.x, origem.y - alvo.y);
    const cam = Engine.caminhoEntre(shim, origem.id, alvo.id);
    return cam ? Engine.pesoRota(shim, cam) : Infinity;
  };
  const margem = cfg.jogador.margem_ataque;
  for (const a of visao.minhas) {
    const forca = Engine.forcaDe(a.tropas, cfg);
    if (forca <= 0) continue;
    let melhor = null, chave = null;
    for (const t of visao.alvos) {
      if (t.forcaDefesa * margem >= forca) continue;
      const k = [custo(a, t), t.forcaDefesa, t.id];
      if (!melhor || k[0] < chave[0] ||
          (k[0] === chave[0] && k[1] < chave[1]) ||
          (k[0] === chave[0] && k[1] === chave[1] && k[2] < chave[2])) { melhor = t; chave = k; }
    }
    if (melhor) envios.push({ origemId: a.id, destinoId: melhor.id, tropas: Object.assign({}, a.tropas) });
  }
  return { construir: base.construir, envios };
}

function placar(res, est) {
  return `${res.aldeiasA}/${res.aldeiasB}/${Engine.aldeiasDe(est, null).length}`;
}

function main() {
  const seeds = [1, 2, 3];
  const turnos = 60;
  console.log("=".repeat(72));
  console.log("  SONDA — burro por CUSTO DE ESTRADA (jogadorBurro intacto)");
  console.log("  placar = aldeiasA / aldeiasB / neutras");
  console.log("=".repeat(72));
  console.log("  seed | Fase 0 (por pixel) | sonda (por estrada)");
  console.log("  " + "-".repeat(48));
  const w = (s, n) => String(s).padStart(n);
  for (const seed of seeds) {
    const cfg0 = cfgPara(seed);
    const r0 = Engine.rodarPartida(cfg0, { A: Engine.jogadorBurro, B: Engine.jogadorBurro }, { maxTurnos: turnos });
    const cfg1 = cfgPara(seed);
    const r1 = Engine.rodarPartida(cfg1, { A: burroPorEstrada, B: burroPorEstrada }, { maxTurnos: turnos });
    console.log("  " + w(seed, 4) + " | " + w(placar(r0, r0.estado), 18) + " | " + w(placar(r1, r1.estado), 18));
  }
  console.log("=".repeat(72));
  console.log("  Se a coluna 'por estrada' aproxima do empate, a distorcao era do");
  console.log("  desempate por pixel do burro — nao do motor nem do mapa.");
}

main();
