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

  if (reg.raciocinio) {
    console.log(`\n----- RACIOCINIO DO MODELO -----`);
    console.log(reg.raciocinio);
  } else {
    console.log(`\n----- RACIOCINIO: (nao capturado) -----`);
  }

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

  console.log(`Partida: Rei ${ladoRei} (${cliente.nome}) vs jogadorBurro | maxTurnos=${maxTurnos} | thinking=on`);
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
  // TRES CATEGORIAS de turno (handoff pend.1): (a) respondido, (b) invalido por
  // falha do MODELO — conta contra validade, (c) invalido por falha de INFRA
  // (erroRede) — NAO entra no denominador de agencia nem de validade. Metricas
  // do modelo rodam SO sobre os turnos respondidos.
  const nInfra = regs.filter((r) => r.erroRede).length;         // falha de rede (429/timeout)
  const respondidos = regs.filter((r) => !r.erroRede);          // o modelo respondeu
  const nValidos = respondidos.length;                          // denominador de agencia/validade
  const nValido = respondidos.filter((r) => r.jsonValido).length;
  const enviosAceitos = respondidos.reduce((s, r) => s + r.aceito.envios.length, 0);
  const agencia = nValidos ? (enviosAceitos / nValidos).toFixed(2) : "n/a";
  const nPassou = respondidos.filter((r) => !r.aceito.construir.length && !r.aceito.envios.length).length;
  const nComRejeicao = respondidos.filter((r) => r.rejeicoes.length).length;
  const nAceitouAlgo = respondidos.filter((r) => r.aceito.construir.length || r.aceito.envios.length).length;

  // METRICA-CHAVE da iteracao: ids reais da visao x ids inexistentes (copiados)
  const nEmitiuIds = respondidos.filter((r) => r.ids.emitidos.length).length;
  const nSoIdsReais = respondidos.filter((r) => r.ids.todosExistem).length;
  const nComIdInexistente = respondidos.filter((r) => r.ids.inexistentes.length).length;

  const counters = regs.flatMap((r) => r.counter);
  const nCounterCerto = counters.filter((c) => c.ehCounter).length;

  // achado do triangulo: combates do Rei vs neutra (numero decide; m modula baixas)
  const combatesRei = res.estado.log.filter((l) => l.tipo === "combate" && l.atacante === ladoRei);
  const vitoriasRei = combatesRei.filter((l) => l.vencedor === "atacante");
  const mComVantagem = combatesRei.filter((l) => l.vantagem > 0).length; // counter a favor
  const mNeutro = combatesRei.filter((l) => l.vantagem === 0).length;
  const mDesvantagem = combatesRei.filter((l) => l.vantagem < 0).length;

  const pct = (n, d) => (d ? ((100 * n) / d).toFixed(0) + "%" : "—");

  console.log("\n\n================== METRICAS DO EVAL ==================");
  console.log(`Vencedor: ${res.vencedor} (${res.motivo}) | duracao: ${res.turnos} turnos | tempo real: ${segundos}s`);
  console.log(`Aldeias finais — A(burro): ${Engine.aldeiasDe(res.estado, "A").length} | B(rei): ${Engine.aldeiasDe(res.estado, "B").length}`);
  console.log("");
  console.log(`Turnos do Rei: ${nTurnos} (respondidos: ${nValidos} | infra-falhas: ${nInfra})`);
  console.log(`  AGENCIA                : ${enviosAceitos} envios -> ${agencia} envios/turno (sobre ${nValidos} validos)`);
  console.log(`  JSON valido            : ${nValido}/${nValidos} (${pct(nValido, nValidos)})`);
  console.log(`  infra-falhas (erroRede): ${nInfra} (fora de agencia e validade)`);
  console.log(`  turnos em que "passou" : ${nPassou} (${pct(nPassou, nValidos)})`);
  console.log(`  turnos com >=1 rejeicao: ${nComRejeicao} (${pct(nComRejeicao, nValidos)})`);
  console.log("");
  console.log(`ANCORAGEM (metrica-chave da iteracao — sobre turnos respondidos):`);
  console.log(`  turnos que emitiram algum id     : ${nEmitiuIds} (${pct(nEmitiuIds, nValidos)})`);
  console.log(`  turnos SO com ids reais da visao : ${nSoIdsReais} (${pct(nSoIdsReais, nValidos)})`);
  console.log(`  turnos com >=1 id INEXISTENTE    : ${nComIdInexistente} (${pct(nComIdInexistente, nValidos)})`);
  console.log(`  turnos com >=1 ordem ACEITA      : ${nAceitouAlgo} (${pct(nAceitouAlgo, nValidos)})`);
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