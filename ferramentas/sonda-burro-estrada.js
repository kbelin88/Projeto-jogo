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

function placar(r) { return `${r.aldeiasA}/${r.aldeiasB}/${r.neutras}`; }

// Replica rodarTurno (tick -> decisao -> vitoria) com ORDEM de decisao
// configuravel, para testar vantagem de quem joga primeiro (ver assento-burro).
function rodarComOrdem(cfg, decisores, maxTurnos, ordem) {
  const estado = Engine.criarEstadoInicial(cfg);
  let vencedor = null;
  while (estado.turno < maxTurnos) {
    Engine.tick(estado);
    for (const dono of ordem) {
      if (!Engine.aldeiasDe(estado, dono).length) continue;
      Engine.executarOrdem(estado, dono, decisores[dono](Engine.montarVisao(estado, dono)));
    }
    vencedor = Engine.checarVitoria(estado);
    if (vencedor) break;
  }
  return {
    vencedor: vencedor || "limite", turnos: estado.turno,
    aldeiasA: Engine.aldeiasDe(estado, "A").length,
    aldeiasB: Engine.aldeiasDe(estado, "B").length,
    neutras: Engine.aldeiasDe(estado, null).length,
  };
}

function main() {
  const seeds = [1, 2, 3];
  const turnos = 60;
  const decEstrada = { A: burroPorEstrada, B: burroPorEstrada };
  const w = (s, n) => String(s).padStart(n);

  console.log("=".repeat(78));
  console.log("  SONDA — burro por CUSTO DE ESTRADA (jogadorBurro intacto)");
  console.log("  placar = aldeiasA / aldeiasB / neutras");
  console.log("=".repeat(78));
  console.log("  seed | pixel [A,B] | estrada [A,B] | estrada [B,A] | espelha ordem?");
  console.log("  " + "-".repeat(70));
  const linhas = [];
  for (const seed of seeds) {
    const pixel = rodarComOrdem(cfgPara(seed), { A: Engine.jogadorBurro, B: Engine.jogadorBurro }, turnos, ["A", "B"]);
    const estradaAB = rodarComOrdem(cfgPara(seed), decEstrada, turnos, ["A", "B"]);
    const estradaBA = rodarComOrdem(cfgPara(seed), decEstrada, turnos, ["B", "A"]);
    // "espelha ordem": inverter quem joga 1o troca o vencedor de lado?
    const espelha = estradaAB.aldeiasA === estradaBA.aldeiasB && estradaAB.aldeiasB === estradaBA.aldeiasA;
    linhas.push({ seed, pixel, estradaAB, estradaBA, espelha });
    console.log("  " + w(seed, 4) + " | " + w(placar(pixel), 11) + " | " +
      w(placar(estradaAB), 13) + " | " + w(placar(estradaBA), 13) + " | " + (espelha ? "SIM" : "nao"));
  }
  console.log("=".repeat(78));
  console.log("  Leitura:");
  console.log("  - estrada [A,B] perto do empate (vs pixel) => distorcao era o desempate por pixel.");
  console.log("  - estrada [A,B] -> [B,A]: se o vencedor troca de lado por margem parecida,");
  console.log("    a vantagem e de QUEM JOGA PRIMEIRO, e fica quantificada.");
}

main();
