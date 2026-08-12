// assento-burro.js — FASE 1B do briefing 04/08. VANTAGEM DE ASSENTO.
//
// Pergunta: o 14/1 e 2/17 da Fase 0 (burro vs burro, mapa espelhado, jogador
// deterministico) vem de VANTAGEM DE ASSENTO ou de assimetria do mapa/motor?
//
// METODO. Os dois jogadores sao o MESMO jogadorBurro. Trocar o DECISOR entre
// A e B seria um no-op (funcoes identicas -> transcript identico). A unica
// variavel de assento que o motor distingue com jogadores identicos e a ORDEM
// DE JOGADA: decidirEExecutar decide sempre A antes de B. Este script corre a
// partida com a ordem NORMAL (A joga primeiro) e com a ordem TROCADA (B joga
// primeiro), tudo o resto igual, e verifica se o resultado ESPELHA.
//   - ESPELHA (14/1 -> 1/14): a vantagem e de quem joga primeiro. Medivel,
//     tratavel jogando sempre os dois assentos (Fase 6.8).
//   - NAO ESPELHA (14/1 -> 9/6 ou fica 14/1): a vitoria segue o LADO fisico do
//     mapa, nao o assento trocavel -> assimetria a serio. PARA e reporta.
//
// Zero custo de API. Reusa so funcoes do engine (sem tocar no engine).

const Engine = require("../engine.js");

function cfgPara(seed) {
  const c = JSON.parse(JSON.stringify(Engine.CONFIG));
  c.layout = "iberia";
  c.seed = seed;
  return c;
}

// Replica rodarTurno (tick -> decisao -> vitoria) com a ORDEM de decisao
// configuravel. Com ordem ["A","B"] tem de reproduzir rodarPartida byte a byte
// (mesma sequencia de chamadas) — e isso que se valida contra a Fase 0.
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
    vencedor: vencedor || "limite",
    turnos: estado.turno,
    aldeiasA: Engine.aldeiasDe(estado, "A").length,
    aldeiasB: Engine.aldeiasDe(estado, "B").length,
    neutras: Engine.aldeiasDe(estado, null).length,
  };
}

function placar(r) { return `${r.aldeiasA}/${r.aldeiasB}/${r.neutras}`; }

// Espelha? Normal A/B deve virar Trocado B/A (a vitoria segue o primeiro a jogar).
function espelha(normal, trocado) {
  return normal.aldeiasA === trocado.aldeiasB && normal.aldeiasB === trocado.aldeiasA;
}

function main() {
  const seeds = [1, 2, 3];
  const turnos = 60;
  const dec = { A: Engine.jogadorBurro, B: Engine.jogadorBurro };

  const linhas = [];
  for (const seed of seeds) {
    const cfg = cfgPara(seed);
    const normal = rodarComOrdem(cfg, dec, turnos, ["A", "B"]); // A joga primeiro
    const trocado = rodarComOrdem(cfg, dec, turnos, ["B", "A"]); // B joga primeiro
    linhas.push({ seed, normal, trocado, espelha: espelha(normal, trocado) });
  }

  const w = (s, n) => String(s).padStart(n);
  console.log("=".repeat(72));
  console.log("  FASE 1B — VANTAGEM DE ASSENTO (burro vs burro, Iberia, 60 turnos)");
  console.log("  placar = aldeiasA / aldeiasB / neutras");
  console.log("=".repeat(72));
  console.log("  seed | A joga 1o (Fase 0) | B joga 1o (trocado) | espelha?");
  console.log("  " + "-".repeat(64));
  for (const l of linhas) {
    console.log(
      "  " + w(l.seed, 4) + " | " + w(placar(l.normal), 18) + " | " +
      w(placar(l.trocado), 19) + " | " + (l.espelha ? "SIM" : "NAO"));
  }
  console.log("=".repeat(72));
  const todasEspelham = linhas.every((l) => l.espelha);
  if (todasEspelham) {
    console.log("  VEREDITO: espelha nos 3 seeds -> a vantagem e de QUEM JOGA PRIMEIRO.");
    console.log("  Consequencia: benchmark pago tem de correr os DOIS assentos (Fase 6.8).");
  } else {
    console.log("  VEREDITO: NAO espelha em pelo menos um seed -> a vitoria segue o LADO");
    console.log("  fisico, nao o assento trocavel. Assimetria de mapa/motor. REPORTAR.");
  }
}

main();
