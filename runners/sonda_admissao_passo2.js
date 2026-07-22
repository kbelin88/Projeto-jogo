// ============================================================
//  sonda_admissao_passo2.js — PASSO 2: partida curta (10 turnos vs burro)
// ------------------------------------------------------------
//  So rodar se o PASSO 1 devolveu JSON. 10 turnos, seed fixa (default=1),
//  temp 0. Usa rodarPartidaRei/decidirRei INTACTOS (nao altera nada).
//  Registra por turno: parseou (S/N) e valido (S/N).
//    parseou = registro.jsonValido (parser achou objeto JSON)
//    valido  = parseou && registro.rejeicoes.length === 0
//              (ordem legal segundo o motor; "passar" com ordem vazia
//               tambem conta como valido — este teste e de CANAL)
//    uso: node sonda_admissao_passo2.js "ollama:llama3.1:8b"
// ============================================================
"use strict";
const Engine = require("../engine.js");
const Rei = require("../rei.js");

const modeloId = process.argv[2] || "ollama:llama3.1:8b";
const maxTurnos = parseInt(process.argv[3], 10) || 10;
const cliente = Rei.criarCliente(modeloId, { temperatura: 0 });

const linhas = [];
function onTurno(reg) {
  const parseou = !!reg.jsonValido;
  const valido = parseou && reg.rejeicoes.length === 0;
  const nAceito = reg.aceito.construir.length + reg.aceito.envios.length;
  linhas.push({
    turno: reg.turno,
    parseou, valido,
    erroRede: reg.erroRede || null,
    erroParse: reg.erroParse || null,
    nRej: reg.rejeicoes.length,
    nAceito,
  });
  console.log(
    `turno ${String(reg.turno).padStart(2)} | parseou ${parseou ? "S" : "N"} | valido ${valido ? "S" : "N"}` +
    ` | rej ${reg.nRej != null ? reg.nRej : reg.rejeicoes.length} | aceito ${nAceito}` +
    (reg.erroRede ? ` | REDE: ${reg.erroRede}` : "") +
    (!parseou && !reg.erroRede ? ` | PARSE: ${reg.erroParse}` : "")
  );
}

(async function main() {
  try { await cliente.gerar("responda apenas: ok"); }
  catch (e) { console.error("backend fora do ar:", e.message); process.exit(2); }

  console.log(`=== SONDA PASSO 2 === ${cliente.nome} | ${maxTurnos} turnos | seed=${Engine.CONFIG.seed} | temp 0`);
  const t0 = Date.now();
  const res = await Rei.rodarPartidaRei({ cliente, ladoRei: "B", maxTurnos, onTurno });
  const segs = ((Date.now() - t0) / 1000).toFixed(1);

  const n = linhas.length;
  const nParse = linhas.filter((l) => l.parseou).length;
  const nValid = linhas.filter((l) => l.valido).length;
  const nRede = linhas.filter((l) => l.erroRede).length;
  console.log("\n=== RESUMO ===");
  console.log(`turnos do Rei : ${n} | tempo: ${segs}s`);
  console.log(`parseou       : ${nParse}/${n}`);
  console.log(`valido        : ${nValid}/${n}`);
  console.log(`erro de rede  : ${nRede}/${n}`);
  console.log(`CRITERIO ADMISSAO (>=8/10 parseou): ${nParse >= 8 ? "ADMITIDO" : "NAO ADMITIDO"}`);
})();
