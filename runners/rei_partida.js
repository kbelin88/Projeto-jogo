// ============================================================
//  rei_partida.js  —  V1 PECA 2: PEDACO 2 + TESTE FINAL (com Ollama)
// ------------------------------------------------------------
//  Rodar:  node rei_partida.js [maxTurnos]   (precisa do Ollama no ar)
//
//  Roda uma partida Rei(qwen2.5:3b) vs jogadorBurro ate o fim e imprime
//  O LOG CRU POR TURNO (esse log E o eval, entregavel principal):
//    prompt (so no 1o turno) -> RESPOSTA CRUA do qwen -> ordem parseada
//    -> aceito/rejeitado -> counter vs neutra.
//  No fim, as METRICAS da spec:
//    - % de turnos com JSON valido
//    - frequencia de counter certo contra neutra (achado em aberto)
//    - se o triangulo muda o resultado (distribuicao do multiplicador m)
//    - quem vence, duracao da partida
// ============================================================
"use strict";
const Engine = require("../engine.js");
const Rei = require("../rei.js");

// uso: node rei_partida.js [maxTurnos] [modeloId]
//   modeloId = "backend:modelo" — ex.: ollama:qwen2.5:3b (default),
//   ollama:llama3.2:3b, gemini:gemini-2.5-flash
const maxTurnos = parseInt(process.argv[2], 10) || 120;
const modeloId = process.argv[3] || "ollama:qwen2.5:3b";
const backend = modeloId.split(":")[0].toLowerCase(); // so p/ as msgs de erro
const cliente = Rei.criarCliente(modeloId, { temperatura: 0 });
const etiqueta = cliente.nome; // p/ os rotulos do log ficarem honestos
const ladoRei = "B";

function compTxt(t) {
  return Engine.compTexto(t);
}

let primeiroTurnoRei = true;

function imprimirTurno(reg) {
  console.log("\n############################################################");
  console.log(`#  TURNO ${reg.turno}  —  REI ${reg.dono} (${etiqueta})`);
  console.log("############################################################");

  if (primeiroTurnoRei) {
    primeiroTurnoRei = false;
    console.log("\n----- PROMPT ENVIADO (so neste 1o turno, p/ referencia) -----");
    console.log(reg.prompt);
  }

  console.log(`\n----- RESPOSTA CRUA DO MODELO (${etiqueta}, com a sujeira que vier) -----`);
  console.log(reg.erroRede ? "[ERRO DE REDE] " + reg.erroRede : JSON.stringify(reg.cru));

  console.log(`\n----- JSON valido? ${reg.jsonValido ? "SIM" : "NAO — " + reg.erroParse} -----`);

  console.log("----- ORDEM PARSEADA -----");
  console.log("  construir:", JSON.stringify(reg.ordemParseada.construir));
  console.log("  envios   :", JSON.stringify(reg.ordemParseada.envios));

  console.log(`----- IDS (ancoragem) ----- emitidos: [${reg.ids.emitidos.join(",")}] | inexistentes: [${reg.ids.inexistentes.join(",")}]`);

  console.log("----- ACEITO PELO MOTOR -----");
  if (!reg.aceito.construir.length && !reg.aceito.envios.length) console.log("  (nada — o Rei passou o turno)");
  reg.aceito.construir.forEach((c) => console.log(`  + construir ${c.tipo} em [${c.aldeiaId}]`));
  reg.aceito.envios.forEach((e) => console.log(`  + envio [${e.origemId}]->[${e.destinoId}]: ${compTxt(e.tropas)}`));

  if (reg.rejeicoes.length) {
    console.log("----- REJEITADO (logado p/ o eval) -----");
    reg.rejeicoes.forEach((m) => console.log("  - " + m));
  }

  if (reg.counter.length) {
    console.log("----- COUNTER vs NEUTRA (achado) -----");
    reg.counter.forEach((c) =>
      console.log(`  [${c.destinoId}] neutra ${c.tipoNeutra} <- enviei ${c.tipoEnviado} (counter ideal: ${c.counterIdeal}) => ${c.ehCounter ? "COUNTER CERTO" : "nao-counter"}`));
  }
}

(async function main() {
  // sanity check: o backend responde?
  try {
    await cliente.gerar("responda apenas: ok");
  } catch (e) {
    console.error(`ERRO: nao consegui falar com o backend "${backend}" (` + e.message + ").");
    if (backend === "ollama") console.error("Suba o Ollama e garanta o modelo: `ollama pull qwen2.5:3b`. Depois rode de novo.");
    else console.error("Confira a GEMINI_API_KEY no .env e a conexao. Depois rode de novo.");
    process.exit(2);
  }

  console.log(`Partida: Rei ${ladoRei} (${cliente.nome}) vs jogadorBurro | maxTurnos=${maxTurnos}`);
  console.log("(o log por turno abaixo E o eval — leitura crua de como o Rei joga)\n");

  const t0 = Date.now();
  const res = await Rei.rodarPartidaRei({
    cliente, ladoRei, maxTurnos,
    onTurno: imprimirTurno,
  });
  const segundos = ((Date.now() - t0) / 1000).toFixed(1);

  // ----------------- METRICAS (spec) -----------------
  const regs = res.registros;
  const nTurnos = regs.length;
  const nValido = regs.filter((r) => r.jsonValido).length;
  const nErroRede = regs.filter((r) => r.erroRede).length;
  const nPassou = regs.filter((r) => !r.aceito.construir.length && !r.aceito.envios.length).length;
  const nComRejeicao = regs.filter((r) => r.rejeicoes.length).length;
  const nAceitouAlgo = regs.filter((r) => r.aceito.construir.length || r.aceito.envios.length).length;

  // METRICA-CHAVE da iteracao: ids reais da visao x ids inexistentes (copiados)
  const nEmitiuIds = regs.filter((r) => r.ids.emitidos.length).length;
  const nSoIdsReais = regs.filter((r) => r.ids.todosExistem).length;
  const nComIdInexistente = regs.filter((r) => r.ids.inexistentes.length).length;

  const counters = regs.flatMap((r) => r.counter);
  const nCounterCerto = counters.filter((c) => c.ehCounter).length;

  // achado do triangulo: combates do Rei vs neutra (numero decide; m modula baixas)
  const combatesRei = res.estado.log.filter((l) => l.tipo === "combate" && l.atacante === ladoRei);
  const vitoriasRei = combatesRei.filter((l) => l.vencedor === "atacante");
  const mComVantagem = combatesRei.filter((l) => l.m < 1).length; // baixas mais baratas (triangulo a favor)
  const mNeutro = combatesRei.filter((l) => l.m === 1).length;
  const mDesvantagem = combatesRei.filter((l) => l.m > 1).length;

  const pct = (n, d) => (d ? ((100 * n) / d).toFixed(0) + "%" : "—");

  console.log("\n\n================== METRICAS DO EVAL ==================");
  console.log(`Vencedor: ${res.vencedor} (${res.motivo}) | duracao: ${res.turnos} turnos | tempo real: ${segundos}s`);
  console.log(`Aldeias finais — A(burro): ${Engine.aldeiasDe(res.estado, "A").length} | B(rei): ${Engine.aldeiasDe(res.estado, "B").length}`);
  console.log("");
  console.log(`Turnos do Rei: ${nTurnos}`);
  console.log(`  JSON valido            : ${nValido}/${nTurnos} (${pct(nValido, nTurnos)})`);
  console.log(`  erro de rede           : ${nErroRede}`);
  console.log(`  turnos em que "passou" : ${nPassou} (${pct(nPassou, nTurnos)})`);
  console.log(`  turnos com >=1 rejeicao: ${nComRejeicao} (${pct(nComRejeicao, nTurnos)})`);
  console.log("");
  console.log(`ANCORAGEM (metrica-chave da iteracao):`);
  console.log(`  turnos que emitiram algum id     : ${nEmitiuIds} (${pct(nEmitiuIds, nTurnos)})`);
  console.log(`  turnos SO com ids reais da visao : ${nSoIdsReais} (${pct(nSoIdsReais, nTurnos)})`);
  console.log(`  turnos com >=1 id INEXISTENTE    : ${nComIdInexistente} (${pct(nComIdInexistente, nTurnos)})`);
  console.log(`  turnos com >=1 ordem ACEITA      : ${nAceitouAlgo} (${pct(nAceitouAlgo, nTurnos)})`);
  console.log("");
  console.log(`Counter vs neutra (achado):`);
  console.log(`  envios aceitos contra neutra : ${counters.length}`);
  console.log(`  com counter CERTO            : ${nCounterCerto} (${pct(nCounterCerto, counters.length)})`);
  console.log("");
  console.log(`Triangulo muda o resultado? (combates do Rei: ${combatesRei.length})`);
  console.log(`  vitorias do Rei            : ${vitoriasRei.length} (${pct(vitoriasRei.length, combatesRei.length)})`);
  console.log(`  baixas baratas (m<1, vantagem): ${mComVantagem}`);
  console.log(`  baixas neutras (m=1)          : ${mNeutro}`);
  console.log(`  baixas caras (m>1, desvantagem): ${mDesvantagem}`);
  console.log("  (lembrete de design: NUMERO decide o vencedor; o triangulo so mexe em 'm'.");
  console.log("   se vitorias nao mudam com m, o triangulo so barateia — dado p/ o Lucas decidir.)");
  console.log("=====================================================");

  // RELATORIO DE DESFECHO (mesma funcao da partida local): resumo do final.
  console.log("\n" + Engine.relatorioDesfecho(res));
})();
