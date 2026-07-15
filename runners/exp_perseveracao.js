// ============================================================
//  exp_perseveracao.js — EXPERIMENTOS H1/H2 (handoff de 03/07)
// ------------------------------------------------------------
//  Contexto: na partida 3B vs 3B de 03/07, o llama3.2 repetiu a MESMA
//  resposta byte a byte por 11 turnos, ignorando 11 rejeicoes identicas
//  (PERSEVERACAO). O llama3 8B teve validade perfeita e agencia ZERO.
//  Este runner mede as duas coisas SEPARADAS, num setup controlado:
//  Rei (modelo) vs burro, mesma seed, UMA variavel por rodada.
//
//  Uso (da RAIZ, precisa do Ollama no ar):
//    node runners/exp_perseveracao.js <modeloId> [opcoes]
//
//  Opcoes:
//    --temp N     temperatura (default 0)          <- variavel do H1
//    --rejfim     rejeicao no FIM do prompt        <- variavel do H2
//    --turnos N   maximo de turnos (default 30)
//    --seed N     seed do mapa (default 1)
//    --tag NOME   sufixo do arquivo de log
//    --composto   turno composto: propor -> validar -> [1 revisao]  <- H4
//    --validador <modeloId>  quem valida (default: o proprio rei; sempre temp 0)
//
//  PROTOCOLO H4 (Fase 12, matriz de 3 condicoes):
//    Baseline: ja medido (3x temp 0, sem flags)
//    C1: --composto                              (a ESTRUTURA ajuda?)
//    C2: --composto --validador <outro modelo>   (o VALIDADOR importa?)
//
//  PROTOCOLO (uma variavel por vez!):
//    H1: --temp 0 | --temp 0.3 | --temp 0.7   (sem --rejfim)
//    H2: --temp 0 | --temp 0 --rejfim         (par minimo)
//    ATENCAO: com temp > 0 a saida do modelo NAO e deterministica;
//    rodar 3x por condicao e comparar as medianas.
//
//  METRICAS:
//    PERSEVERACAO — maior sequencia de respostas cruas IDENTICAS
//      (byte a byte) e total de turnos repetidos.
//    AGENCIA — envios aceitos POR TURNO (separada de validade: o 8B
//      provou que da p/ ter 100% de validade com agencia zero).
//    + validade JSON, rejeicoes, normalizacoes (H3), resultado.
//
//  Log completo por rodada em logs/exp/ (escrita atomica) e uma linha
//  de resumo acumulada em logs/exp/resumo.txt p/ comparar condicoes.
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");
const Rei = require("../rei.js");

// ---------- args ----------
const args = process.argv.slice(2);
const modeloId = args.find((a) => !a.startsWith("--"));
if (!modeloId) {
  console.error("uso: node runners/exp_perseveracao.js <modeloId> [--temp N] [--rejfim] [--turnos N] [--seed N] [--tag NOME]");
  process.exit(2);
}
function opt(nome, def) {
  const i = args.indexOf("--" + nome);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : def;
}
const temp = parseFloat(opt("temp", "0"));
const rejfim = args.includes("--rejfim");
const maxTurnos = parseInt(opt("turnos", "30"), 10);
const seed = parseInt(opt("seed", "1"), 10);
const tag = opt("tag", "");
// Fase 12 / H4 — turno composto: propor -> validar -> [1 revisao] -> motor.
// --composto liga o ciclo; --validador <modeloId> escolhe quem valida
// (default: o proprio rei se valida). Validador roda SEMPRE a temp 0
// (conferir fatos e tarefa deterministica; a temperatura do experimento
// e variavel do PROPOSITOR).
const composto = args.includes("--composto");
const validadorId = opt("validador", null);

const config = Object.assign({}, Engine.CONFIG, { seed });
const cliente = Rei.criarCliente(modeloId, { temperatura: temp });
const clienteValidador = composto ? Rei.criarCliente(validadorId || modeloId, { temperatura: 0 }) : null;
const condicao = `temp=${temp}${rejfim ? " rejfim" : ""}${composto ? ` composto(val=${clienteValidador.nome})` : ""} seed=${seed}`;

// ---------- log por turno ----------
const linhas = [];
function log(s) { linhas.push(s); }

log(`=== EXPERIMENTO PERSEVERACAO/AGENCIA — ${modeloId} | ${condicao} | max ${maxTurnos} turnos ===`);
log(`data: ${new Date().toISOString()}`);
log("");

let cruAnterior = null, seqAtual = 0, seqMax = 0, turnosRepetidos = 0;
// REINCIDENCIA (achado da partida de 04/07, qwen vs llama3.2): perseveracao
// pode ser SEMANTICA — o llama3.2 tentou construir na aldeia [10] (que nao
// e dele) em 19 de 20 turnos, variando o texto. Byte a byte (seqMax) nao ve.
// Assinatura da acao rejeitada: "construir@id" / "envio@origem>destino".
// Reincidir = a MESMA assinatura rejeitada em turnos consecutivos.
let sigsAnteriores = new Set(), reincidencias = 0, reincMax = 0, reincSig = "-";
const streaks = new Map();
// Fase 12: contadores do turno composto (zeros quando --composto desligado)
let vetosInternos = 0, vereditosIlegiveis = 0, chamadasTotais = 0;
function assinaturasRejeitadas(rejeicoes) {
  // Dois formatos no motor: "construir [18]: motivo" E "construir: aldeia [18]
  // nao e sua" (idem envio, com ou sem destino). Regra robusta: prefixo da
  // acao + todos os ids entre colchetes, na ordem.
  const sigs = new Set();
  for (const r of rejeicoes) {
    const ids = [...r.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
    if (!ids.length) continue;
    if (r.startsWith("construir")) sigs.add("construir@" + ids[0]);
    else if (r.startsWith("envio")) sigs.add("envio@" + ids.join(">"));
  }
  return sigs;
}
function onTurno(reg) {
  const repetiu = cruAnterior !== null && reg.cru === cruAnterior && !reg.erroRede;
  if (repetiu) { turnosRepetidos++; seqAtual++; seqMax = Math.max(seqMax, seqAtual); }
  else seqAtual = 0;
  cruAnterior = reg.erroRede ? cruAnterior : reg.cru;

  // reincidencia: mesma acao rejeitada de novo, mesmo com texto diferente
  const sigs = assinaturasRejeitadas(reg.rejeicoes);
  const reincididas = [];
  for (const s of sigs) {
    if (sigsAnteriores.has(s)) {
      reincidencias++;
      const n = (streaks.get(s) || 0) + 1;
      streaks.set(s, n);
      if (n > reincMax) { reincMax = n; reincSig = s; }
      reincididas.push(s);
    } else streaks.set(s, 0);
  }
  for (const s of sigsAnteriores) if (!sigs.has(s)) streaks.delete(s);
  sigsAnteriores = sigs;

  log(`########## TURNO ${reg.turno} — Rei ${reg.dono} (${cliente.nome}) ##########`);
  if (reg.erroRede) log("ERRO DE REDE: " + reg.erroRede);
  log("resposta crua: " + JSON.stringify(reg.cru));
  if (repetiu) log(">>> REPETIDA (identica byte a byte a do turno anterior)");
  reincididas.forEach((s) => log(">>> REINCIDIU: " + s + " rejeitada de novo (streak " + streaks.get(s) + ")"));
  log(`JSON valido: ${reg.jsonValido ? "SIM" : "NAO — " + reg.erroParse}`);
  (reg.normalizacoes || []).forEach((n) => log("NORMALIZADO: " + n));
  if (reg.composto) {
    chamadasTotais += reg.composto.chamadas;
    if (reg.composto.vetou) {
      vetosInternos++;
      log(">>> VALIDADOR VETOU. motivo: " + reg.composto.motivo);
      log("proposta vetada (cru): " + JSON.stringify(reg.composto.cruProposta));
    } else if (reg.composto.veredito === "ilegivel") {
      vereditosIlegiveis++;
      log(">>> VALIDADOR ILEGIVEL (tratado como OK): " + JSON.stringify((reg.composto.cruValidador || "").slice(0, 120)));
    } else if (reg.composto.veredito === "OK") {
      log("validador: OK");
    }
  }
  reg.aceito.construir.forEach((c) => log(`ACEITO construir ${c.tipo} em [${c.aldeiaId}]`));
  reg.aceito.envios.forEach((e) => log(`ACEITO envio [${e.origemId}]->[${e.destinoId}]: ${Engine.compTexto(e.tropas)}`));
  reg.rejeicoes.forEach((m) => log("REJEITADO: " + m));
  if (!reg.aceito.construir.length && !reg.aceito.envios.length) log("(passou o turno)");
  log("");
  process.stdout.write("."); // pulso: 1 ponto por turno do Rei
}

(async function main() {
  try { await cliente.gerar("responda apenas: ok"); }
  catch (e) {
    console.error(`ERRO: backend nao responde (${e.message}). Ollama no ar? OLLAMA_ORIGINS nao importa aqui (Node fala direto).`);
    process.exit(1);
  }

  const t0 = Date.now();
  const res = await Rei.rodarPartidaRei({
    config, cliente, maxTurnos,
    opcoesPrompt: rejfim ? { rejeicaoNoFim: true } : undefined,
    composto: composto ? { validador: clienteValidador } : undefined,
    onTurno,
  });
  console.log(""); // fecha a linha de pulsos
  const segundos = ((Date.now() - t0) / 1000).toFixed(1);

  // ---------- metricas ----------
  const regs = res.registros;
  const n = regs.length || 1;
  const nValido = regs.filter((r) => r.jsonValido).length;
  const enviosAceitos = regs.reduce((s, r) => s + r.aceito.envios.length, 0);
  const constrAceitas = regs.reduce((s, r) => s + r.aceito.construir.length, 0);
  const nRejeicoes = regs.reduce((s, r) => s + r.rejeicoes.length, 0);
  const nNormalizacoes = regs.reduce((s, r) => s + (r.normalizacoes || []).length, 0);
  const nPassou = regs.filter((r) => !r.aceito.construir.length && !r.aceito.envios.length).length;
  const agencia = (enviosAceitos / n).toFixed(2);
  const pct = (x) => ((100 * x) / n).toFixed(0) + "%";

  const R = [];
  R.push("================== RESUMO ==================");
  R.push(`modelo: ${cliente.nome} | ${condicao} | ${segundos}s`);
  R.push(`resultado: ${res.vencedor} (${res.motivo}) em ${res.turnos} turnos | turnos do Rei: ${n}`);
  R.push("");
  R.push(`PERSEVERACAO:`);
  R.push(`  maior sequencia de respostas identicas : ${seqMax}`);
  R.push(`  turnos com resposta repetida           : ${turnosRepetidos} (${pct(turnosRepetidos)})`);
  R.push(`  REINCIDENCIA (mesma acao rejeitada em turnos seguidos, texto livre):`);
  R.push(`    total de reincidencias               : ${reincidencias}`);
  R.push(`    maior streak de uma acao             : ${reincMax} (${reincSig})`);
  R.push(`AGENCIA (separada de validade — licao do 8B):`);
  R.push(`  envios aceitos                         : ${enviosAceitos}  ->  ${agencia} envios/turno`);
  R.push(`  construcoes aceitas                    : ${constrAceitas}`);
  R.push(`  turnos em que passou                   : ${nPassou} (${pct(nPassou)})`);
  R.push(`VALIDADE:`);
  R.push(`  JSON valido                            : ${nValido}/${n} (${pct(nValido)})`);
  R.push(`  rejeicoes totais                       : ${nRejeicoes}`);
  R.push(`  normalizacoes (H3, cru->canonico)      : ${nNormalizacoes}`);
  if (composto) {
    R.push(`TURNO COMPOSTO (propor -> validar -> [1 revisao]):`);
    R.push(`  validador                              : ${clienteValidador.nome}${validadorId ? "" : " (o proprio rei)"}`);
    R.push(`  vetos internos                         : ${vetosInternos}`);
    R.push(`  vereditos ilegiveis (tratados como OK) : ${vereditosIlegiveis}`);
    R.push(`  chamadas LLM por turno (media)         : ${(chamadasTotais / n).toFixed(2)}`);
  }
  R.push("============================================");
  const resumo = R.join("\n");
  console.log(resumo);
  log(resumo);

  // ---------- persistencia (atomica) ----------
  const dir = path.join(process.cwd(), "logs", "exp");
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const nomeMod = cliente.nome.replace(/[^a-z0-9._]/gi, "-");
  const nome = `exp_${nomeMod}_t${temp}${rejfim ? "_rejfim" : ""}${composto ? "_comp" : ""}_s${seed}${tag ? "_" + tag : ""}_${ts}.txt`;
  const alvo = path.join(dir, nome);
  fs.writeFileSync(alvo + ".tmp", linhas.join("\n"));
  fs.renameSync(alvo + ".tmp", alvo);

  // linha unica acumulada p/ comparar condicoes lado a lado
  const linha = [ts, cliente.nome, `temp=${temp}`, rejfim ? "rejfim=1" : "rejfim=0", `seed=${seed}`,
    `turnosRei=${n}`, `seqMax=${seqMax}`, `repetidos=${turnosRepetidos}`,
    `reincid=${reincidencias}`, `reincMax=${reincMax}(${reincSig})`,
    `enviosAceitos=${enviosAceitos}`, `agencia=${agencia}`, `validade=${nValido}/${n}`,
    `rejeicoes=${nRejeicoes}`, `normalizacoes=${nNormalizacoes}`,
    composto ? `composto=1(val=${clienteValidador.nome})` : "composto=0",
    ...(composto ? [`vetos=${vetosInternos}`, `ilegiveis=${vereditosIlegiveis}`, `chamadasPorTurno=${(chamadasTotais / n).toFixed(2)}`] : []),
    `resultado=${res.vencedor}/${res.turnos}t`].join(" | ");
  fs.appendFileSync(path.join(dir, "resumo.txt"), linha + "\n");

  console.log(`\nlog completo: ${alvo}`);
  console.log(`resumo acumulado: ${path.join(dir, "resumo.txt")}`);
})().catch((e) => { console.error("EXPERIMENTO FALHOU:", e.message); process.exit(1); });
