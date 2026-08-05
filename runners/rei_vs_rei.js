// rei_vs_rei.js — FASE 7.8.4 (05/08): partida LLM vs LLM (mesmo modelo dos dois
// lados), combate v3 + economia revertida. Grava um .txt no MESMO formato dos
// logs de 03/08 (o analisar-log.js le), com checkpoint por turno (o harness com
// fila so chega na Fase 6). Ollama local — sem cota, so tempo.
//
// Uso: node runners/rei_vs_rei.js <modelId> <seed> <maxTurnos> <outfile>
//   ex.: node runners/rei_vs_rei.js ollama:llama3:latest 1 40 resultados/fase7-llama3/seed1.txt
"use strict";
const Engine = require("../engine.js");
const Rei = require("../rei.js");
const fs = require("fs");
const path = require("path");

const modelId = process.argv[2] || "ollama:llama3:latest";
const seed = parseInt(process.argv[3], 10) || 1;
const maxTurnos = parseInt(process.argv[4], 10) || 40;
const outfile = process.argv[5] || path.join(__dirname, "..", "resultados", "fase7-llama3", `seed${seed}.txt`);

const cfg = JSON.parse(JSON.stringify(Engine.CONFIG));
cfg.layout = "iberia"; cfg.seed = seed;
const cliente = { A: Rei.criarCliente(modelId, { temperatura: 0 }), B: Rei.criarCliente(modelId, { temperatura: 0 }) };
const etiqueta = cliente.A.nome;

function compStrG(t) {
  const p = [];
  if (t.lanceiro) p.push(t.lanceiro + "L");
  if (t.arqueiro) p.push(t.arqueiro + "A");
  if (t.cavaleiro) p.push(t.cavaleiro + "C");
  return p.join("+") || "0";
}
const totalTropas = (t) => (t.lanceiro || 0) + (t.arqueiro || 0) + (t.cavaleiro || 0);

const L = [];
const out = (s) => L.push(s);
const gravar = () => fs.writeFileSync(outfile, L.join("\n"));

out(`=== PARTIDA Rei A (${etiqueta}) vs Rei B (${etiqueta}) | seed ${seed} | maxTurnos ${maxTurnos} | ${new Date().toLocaleString()} ===`);
out("condicoes: ambiente=iberia | temp=0 | prompt=relatorio v3 (disponivel-para-enviar) + combate v3 (atq/def, counter 1.25) + clamp | thinking=on");
out("");

function logEventos(estado, turno) {
  const evs = estado.log.filter((x) => x.turno === turno);
  const l2 = [];
  for (const e of evs) {
    if (e.tipo === "combate")
      l2.push(`COMBATE [${e.alvoId}] ${e.alvoNome}: atacante ${e.atacante} Fatk=${e.Fatk} (ef ${e.FatkEf}) Fdef=${e.Fdef} (ef ${e.FdefEf}) vant=${e.vantagem} -> vence ${e.vencedor}${e.conquista ? " (CONQUISTA)" : ""} | baixas~${e.baixasForca}`);
    else if (e.tipo === "reforco")
      l2.push(`REFORCO [${e.alvoId}] ${e.alvoNome} dono ${e.dono}: ${compStrG(e.tropas)}`);
    else if (e.tipo === "combate_estrada")
      l2.push(`COMBATE-ESTRADA atacante ${e.atacante} vs ${e.defensor} Fatk=${e.Fatk} Fdef=${e.Fdef} vant=${e.vantagem} -> vence ${e.vencedorDono}`);
  }
  const f = (d) => Engine.aldeiasDe(estado, d).reduce((s, a) => s + Engine.contarTropas(a.tropas), 0);
  const tr = (d) => estado.movimentos.filter((m) => m.dono === d).length;
  l2.push(`placar: A ${Engine.aldeiasDe(estado, "A").length} ald/tropas ${f("A")} | B ${Engine.aldeiasDe(estado, "B").length} ald/tropas ${f("B")} | neutras ${Engine.aldeiasDe(estado, null).length} | transito ${estado.movimentos.length} (A ${tr("A")} | B ${tr("B")})`);
  l2.push("");
  out(l2.join("\n"));
}

// metricas rapidas p/ o resumo imediato (o analisador faz o resto depois)
const m = { A: { envios: 0, tropas: 0 }, B: { envios: 0, tropas: 0 } };

async function main() {
  try { await cliente.A.gerar("responda apenas: ok"); }
  catch (e) { console.error(`ERRO ollama: ${e.message} — suba o Ollama e garanta 'ollama pull llama3:latest'`); process.exit(2); }

  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  const estado = Engine.criarEstadoInicial(cfg);
  const t0 = Date.now();
  let venc = null;

  while (estado.turno < maxTurnos) {
    Engine.tick(estado);
    const turno = estado.turno;
    for (const dono of ["A", "B"]) {
      if (!Engine.aldeiasDe(estado, dono).length) continue;
      const { registro } = await Rei.decidirRei(estado, dono, cliente[dono]);
      Engine.executarOrdem(estado, dono, registro.ordemParseada); // motor clampa (Fase 3)

      out(`########## TURNO ${turno} — Rei ${dono} (${etiqueta}) ##########`);
      if (registro.erroRede) out(">>> ERRO DE REDE — turno NAO contabilizado (sem resposta do modelo)");
      out("resposta crua: " + JSON.stringify(registro.cru));
      out(registro.raciocinio ? "raciocinio: " + registro.raciocinio : "raciocinio: (nao capturado)");
      out("ordem.construir: " + JSON.stringify(registro.ordemParseada.construir || []));
      out("ordem.envios   : " + JSON.stringify(registro.ordemParseada.envios || []));
      if (!registro.aceito.construir.length && !registro.aceito.envios.length) out("ACEITO: (nada — passou o turno)");
      registro.aceito.construir.forEach((c) => out(`ACEITO construir ${c.tipo} em [${c.aldeiaId}]`));
      registro.aceito.envios.forEach((e) => {
        out(`ACEITO envio [${e.origemId}]->[${e.destinoId}]: ${compStrG(e.tropas)}` + (e.alvo && e.alvo.dono === null ? ` (alvo neutra ${e.alvo.tipo})` : ""));
        m[dono].envios++; m[dono].tropas += totalTropas(e.tropas);
      });
      registro.aceito.envios.filter((e) => e.ajustado).forEach((e) =>
        out(`AJUSTADO envio [${e.origemId}]->[${e.destinoId}]: pediu ${compStrG(e.pedido)}, enviado ${compStrG(e.tropas)} (estoque real)`));
      registro.rejeicoes.forEach((r) => out("REJEITADO: " + r));
      gravar(); // checkpoint por LADO
    }
    logEventos(estado, turno);
    gravar();
    const conq = estado.log.filter((l) => l.tipo === "combate" && l.conquista).length;
    console.error(`  T${turno} | A ${Engine.aldeiasDe(estado, "A").length} B ${Engine.aldeiasDe(estado, "B").length} neutras ${Engine.aldeiasDe(estado, null).length} | conquistas ate agora ${conq} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    venc = Engine.checarVitoria(estado);
    if (venc) break;
  }

  out(`=== FIM === turno ${estado.turno} | resultado: ${venc || "limite"} | A ${Engine.aldeiasDe(estado, "A").length} ald | B ${Engine.aldeiasDe(estado, "B").length} ald | neutras ${Engine.aldeiasDe(estado, null).length}`);
  // RESUMO por Rei
  out("");
  out("================== RESUMO ==================");
  for (const d of ["A", "B"]) {
    const md = (m[d].envios ? (m[d].tropas / m[d].envios) : 0).toFixed(2);
    out(`Rei ${d} (${etiqueta}): ${m[d].envios} envios, ${m[d].tropas} tropas, tamanho medio ${md}`);
  }
  out("============================================");
  gravar();

  const conquistas = estado.log.filter((l) => l.tipo === "combate" && l.conquista);
  const conqA = conquistas.filter((c) => c.atacante === "A").length;
  const conqB = conquistas.filter((c) => c.atacante === "B").length;
  const mdA = (m.A.envios ? m.A.tropas / m.A.envios : 0).toFixed(2);
  const mdB = (m.B.envios ? m.B.tropas / m.B.envios : 0).toFixed(2);
  console.error("\n===== RESUMO 7.8.4 =====");
  console.error(`seed ${seed} | ${estado.turno} turnos | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.error(`CONQUISTAS: total ${conquistas.length} (A ${conqA} | B ${conqB})`);
  console.error(`TAMANHO MEDIO DE ENVIO: A ${mdA} (${m.A.envios} env) | B ${mdB} (${m.B.envios} env)`);
  console.error(`ultima conquista: T${conquistas.length ? Math.max(...conquistas.map((c) => c.turno)) : "-"}`);
  console.error(`log: ${outfile}`);
}

main();
