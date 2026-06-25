// ============================================================
//  partida_local_log.js  —  LOG DETALHADO da partida local
// ------------------------------------------------------------
//  Rodar:  node partida_local_log.js [maxTurnos]   (default 50)
//
//  Roda burro (Rei A) vs burro (Rei B) — SEM rede, deterministico pela
//  seed — e grava um LOG POR TURNO no mesmo espirito do .txt do Gemini,
//  mas com OS DOIS LADOS: para cada Rei, a ordem decidida, o que o motor
//  aceitou/rejeitou, os combates resolvidos no turno e o placar.
//
//  ATENCAO: "jogadorBurro" NAO e um modelo de IA — e a heuristica
//  deterministica do engine.js. Este log mostra a MECANICA disputando
//  consigo mesma (FASE A), nao dois LLMs.
//
//  Saida: imprime no terminal E grava em partida_local_log.txt.
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const E = require("../engine.js");

const maxTurnos = parseInt(process.argv[2], 10) || 50;
const config = E.CONFIG;

// ---- formatacao ----
function compStr(t) {
  const p = [];
  if (t.lanceiro) p.push(t.lanceiro + "L");
  if (t.arqueiro) p.push(t.arqueiro + "A");
  if (t.cavaleiro) p.push(t.cavaleiro + "C");
  return p.join("+") || "0";
}

const L = [];
const out = (s) => L.push(s);

out(`=== PARTIDA LOCAL: Rei A (jogadorBurro) vs Rei B (jogadorBurro) | seed ${config.seed} | maxTurnos ${maxTurnos} | ${new Date().toLocaleString()} ===`);
out("(jogadorBurro = heuristica deterministica do engine.js, NAO um modelo de IA)");
out("");

const estado = E.criarEstadoInicial(config);
const historico = [];

function placar() {
  const f = (d) => E.aldeiasDe(estado, d).reduce((s, a) => s + E.forcaDe(a.tropas, config), 0);
  return `placar: A ${E.aldeiasDe(estado, "A").length} ald/forca ${f("A")} | ` +
    `B ${E.aldeiasDe(estado, "B").length} ald/forca ${f("B")} | ` +
    `neutras ${E.aldeiasDe(estado, null).length} | transito ${estado.movimentos.length}`;
}

function logDecisao(dono, ordem, diag) {
  out(`--- Rei ${dono} decide ---`);
  out("  ordem.construir: " + JSON.stringify(ordem.construir || []));
  out("  ordem.envios   : " + JSON.stringify(ordem.envios || []));
  if (!diag.aceitoConstruir.length && !diag.aceitoEnvios.length) out("  ACEITO: (nada — passou o turno)");
  diag.aceitoConstruir.forEach((c) => out(`  ACEITO construir ${c.tipo} em [${c.aldeiaId}]`));
  diag.aceitoEnvios.forEach((e) => {
    const alvo = e.alvo;
    const rotulo = !alvo ? "" :
      alvo.dono === dono ? " (reforco)" :
      alvo.dono === null ? ` (ataque a neutra ${alvo.tipo})` :
      ` (ataque ao Rei ${alvo.dono})`;
    out(`  ACEITO envio [${e.origemId}]->[${e.destinoId}]: ${compStr(e.tropas)}${rotulo}`);
  });
  diag.rejeicoes.forEach((m) => out("  REJEITADO: " + m));
}

function logEventos(turno) {
  const evs = estado.log.filter((x) => x.turno === turno);
  if (!evs.length) return;
  out("--- eventos resolvidos neste turno (chegadas de envios anteriores) ---");
  for (const e of evs) {
    if (e.tipo === "combate") {
      out(`  COMBATE [${e.alvoId}] ${e.alvoNome}: atacante ${e.atacante} ` +
        `Fatk=${e.Fatk} Fdef=${e.Fdef} m=${e.m.toFixed(2)} -> vence ${e.vencedor}` +
        `${e.conquista ? " (CONQUISTA)" : ""} | baixas~${e.baixasForca}`);
    } else if (e.tipo === "reforco") {
      out(`  REFORCO [${e.alvoId}] ${e.alvoNome} dono ${e.dono}: ${compStr(e.tropas)}`);
    }
  }
}

// Loop manual (espelha rodarTurno) p/ capturar a ordem+diagnostico de CADA lado.
let venc = null;
while (estado.turno < maxTurnos) {
  E.tick(estado);                       // 1-5: producao..combate..endurece
  const turno = estado.turno;
  out(`########## TURNO ${turno} ##########`);
  for (const dono of ["A", "B"]) {       // 6: decisao de cada lado vivo
    if (!E.aldeiasDe(estado, dono).length) continue;
    const visao = E.montarVisao(estado, dono);
    const ordem = E.jogadorBurro(visao);
    const diag = E.diagnosticarOrdem(estado, dono, ordem); // ANTES de executar
    E.executarOrdem(estado, dono, ordem);
    logDecisao(dono, ordem, diag);
  }
  logEventos(turno);
  out(placar());
  out("");
  historico.push(E.resumoTurno(estado));
  venc = E.checarVitoria(estado);        // 7: vitoria
  if (venc) break;
}

const res = {
  vencedor: venc || "limite",
  motivo: venc ? (venc === "empate" ? "empate" : "eliminacao") : "limite",
  turnos: estado.turno,
  historico,
  estado,
};

out(`=== FIM === turno ${estado.turno} | resultado: ${venc ? "vitoria " + venc : "limite de turnos"} | ` +
  `A ${E.aldeiasDe(estado, "A").length} ald | B ${E.aldeiasDe(estado, "B").length} ald | neutras ${E.aldeiasDe(estado, null).length}`);
out("");
out(E.relatorioDesfecho(res));

const texto = L.join("\n");
const arq = path.join(__dirname, "..", "logs", "partida_local_log.txt");
fs.writeFileSync(arq, texto, "utf8");

console.log(texto);
console.log("\n[log gravado em " + arq + "]");
