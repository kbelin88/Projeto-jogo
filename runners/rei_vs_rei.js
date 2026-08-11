// rei_vs_rei.js — FASE 7.8.4 (05/08): partida LLM vs LLM (mesmo modelo dos dois
// lados), combate v3 + economia revertida. Grava um .txt no MESMO formato dos
// logs de 03/08 (o analisar-log.js le), com checkpoint por turno (o harness com
// fila so chega na Fase 6). Ollama local — sem cota, so tempo.
//
// Uso: node runners/rei_vs_rei.js <modelA> <modelB> <seed> <maxTurnos> <outfile>
//   modelA/modelB = "backend:modelo" OU "burro" (jogadorBurro, zero API).
//   ex.: node runners/rei_vs_rei.js gemini:gemini-2.5-flash openrouter:nvidia/nemotron-3-super-120b-a12b:free 1 20 out.txt
//        node runners/rei_vs_rei.js openrouter:nvidia/nemotron-3-super-120b-a12b:free burro 1 30 out.txt
// SEM sanity-ping (economiza cota): se o backend estiver fora, o 1o turno falha
// como erroRede e o log mostra. Modelos REMOTOS gastam — invocacao deliberada.
"use strict";
const Engine = require("../engine.js");
const Rei = require("../rei.js");
const fs = require("fs");
const path = require("path");

const modelA = process.argv[2] || "ollama:llama3:latest";
const modelB = process.argv[3] || "ollama:llama3:latest";
const seed = parseInt(process.argv[4], 10) || 1;
const maxTurnos = parseInt(process.argv[5], 10) || 40;
const outfile = process.argv[6] || path.join(__dirname, "..", "resultados", "fase7-llama3", `seed${seed}.txt`);

const cfg = JSON.parse(JSON.stringify(Engine.CONFIG));
cfg.layout = "iberia"; cfg.seed = seed;
const ehBurro = (spec) => spec.toLowerCase() === "burro";
const cliente = {
  A: ehBurro(modelA) ? null : Rei.criarCliente(modelA, { temperatura: 0 }),
  B: ehBurro(modelB) ? null : Rei.criarCliente(modelB, { temperatura: 0 }),
};
const etiquetaDe = { A: cliente.A ? cliente.A.nome : "burro", B: cliente.B ? cliente.B.nome : "burro" };
const etiqueta = etiquetaDe.A + " vs " + etiquetaDe.B;

// decisor de um lado: LLM (async, com registro) ou burro (sync). Devolve o
// mesmo formato de registro para o log sair igual dos dois lados.
async function decidirLado(estado, dono) {
  if (cliente[dono]) return (await Rei.decidirRei(estado, dono, cliente[dono])).registro;
  const visao = Engine.montarVisao(estado, dono);
  const ordem = Engine.jogadorBurro(visao);
  const diag = Engine.diagnosticarOrdem(estado, dono, ordem);
  return {
    cru: "(burro)", raciocinio: null, erroRede: null, ordemParseada: ordem,
    aceito: { construir: diag.aceitoConstruir, envios: diag.aceitoEnvios }, rejeicoes: diag.rejeicoes,
  };
}

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

out(`=== PARTIDA Rei A (${etiquetaDe.A}) vs Rei B (${etiquetaDe.B}) | seed ${seed} | maxTurnos ${maxTurnos} | ${new Date().toLocaleString()} ===`);
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

// SERIE DE TOKENS DE CONTEXTO (07/08): tokens de PROMPT (input real reportado
// pela API) por turno de cada lado LLM — mede quanto contexto vai ao modelo a
// cada jogada e como CRESCE ao longo do jogo. So lados LLM (burro nao tem prompt).
// Cada item: { turno, prompt, resposta }. Emitido no bloco TOKENS do finalizar.
const serieTokens = { A: [], B: [] };
function resumoTokens(serie) {
  if (!serie.length) return null;
  const ps = serie.map((x) => x.prompt);
  const soma = ps.reduce((a, b) => a + b, 0);
  const media = soma / ps.length;
  // crescimento: media do 1o terco vs media do ultimo terco (robusto a ruido)
  const n = ps.length, k = Math.max(1, Math.floor(n / 3));
  const ini = ps.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const fim = ps.slice(n - k).reduce((a, b) => a + b, 0) / k;
  return { n, media, min: Math.min(...ps), max: Math.max(...ps), primeiro: ps[0], ultimo: ps[n - 1], iniTerco: ini, fimTerco: fim };
}

// BLINDAGEM (07/08): endurecimento contra a "morte silenciosa" do T12.
// decidirRei ENGOLE o erro de rede num catch interno (rei.js) e devolve
// erroRede preenchido -> o turno "passa". Num throttle sustentado (teto diario
// do free tier), o loop giraria turnos vazios fazendo 6 retries+backoff cada.
// Aqui contamos erros de rede CONSECUTIVOS por lado; ao bater o limite, abortamos
// LIMPO com marcador, em vez de girar horas. LIM_ERRO_REDE=2 porque erroRede so
// aparece DEPOIS de 6 retries internos (ja e sinal forte); 2 seguidos = throttle
// ou queda real, nao fluke. Modelos locais (burro/ollama) nunca disparam isto.
const LIM_ERRO_REDE = 2;
const erroRedeSeguido = { A: 0, B: 0 };
let jaFinalizou = false;
// escreve FIM + RESUMO uma unica vez (chamado do fim normal E dos caminhos de
// erro). motivo != null vira uma linha de marcador antes do bloco FIM.
function finalizar(estado, venc, motivo) {
  if (jaFinalizou) return;
  jaFinalizou = true;
  if (motivo) out(`>>> INTERROMPIDO: ${motivo} (turno ${estado ? estado.turno : "?"})`);
  const t = estado ? estado.turno : "?";
  const na = (d) => (estado ? Engine.aldeiasDe(estado, d).length : "?");
  const nn = estado ? Engine.aldeiasDe(estado, null).length : "?";
  out(`=== FIM === turno ${t} | resultado: ${venc || (motivo ? "interrompido" : "limite")} | A ${na("A")} ald | B ${na("B")} ald | neutras ${nn}`);
  out("");
  out("================== RESUMO ==================");
  for (const d of ["A", "B"]) {
    const md = (m[d].envios ? (m[d].tropas / m[d].envios) : 0).toFixed(2);
    out(`Rei ${d} (${etiquetaDe[d]}): ${m[d].envios} envios, ${m[d].tropas} tropas, tamanho medio ${md}`);
  }
  if (motivo) out(`NOTA: partida interrompida antes do fim natural — ${motivo}.`);
  out("============================================");
  // BLOCO TOKENS DE CONTEXTO — media por turno + crescimento (so lados LLM).
  out("");
  out("============== TOKENS DE CONTEXTO (prompt/input por turno) ==============");
  for (const d of ["A", "B"]) {
    const r = resumoTokens(serieTokens[d]);
    if (!r) { out(`Rei ${d} (${etiquetaDe[d]}): sem tokens (lado nao-LLM ou sem turno valido)`); continue; }
    out(`Rei ${d} (${etiquetaDe[d]}): turnos validos ${r.n} | media ${r.media.toFixed(0)} tok | min ${r.min} | max ${r.max}`);
    out(`  crescimento: 1o turno ${r.primeiro} -> ultimo ${r.ultimo} tok | 1o terco media ${r.iniTerco.toFixed(0)} -> ultimo terco media ${r.fimTerco.toFixed(0)} (${r.iniTerco ? ((r.fimTerco / r.iniTerco - 1) * 100).toFixed(0) : "?"}%)`);
    out(`  serie (turno:prompt): ${serieTokens[d].map((x) => x.turno + ":" + x.prompt).join("  ")}`);
  }
  out("========================================================================");
  gravar();
}

async function main() {
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  const estado = Engine.criarEstadoInicial(cfg);
  const t0 = Date.now();
  let venc = null;
  let motivoAbort = null;

  try {
  while (estado.turno < maxTurnos) {
    Engine.tick(estado);
    const turno = estado.turno;
    for (const dono of ["A", "B"]) {
      if (!Engine.aldeiasDe(estado, dono).length) continue;
      const registro = await decidirLado(estado, dono);
      Engine.executarOrdem(estado, dono, registro.ordemParseada); // motor clampa (Fase 3)

      out(`########## TURNO ${turno} — Rei ${dono} (${etiquetaDe[dono]}) ##########`);
      if (registro.erroRede) {
        out(">>> ERRO DE REDE — turno NAO contabilizado (sem resposta do modelo)");
        out(">>> detalhe: " + registro.erroRede);
        erroRedeSeguido[dono]++;
      } else {
        erroRedeSeguido[dono] = 0;
      }
      // TOKENS DE CONTEXTO deste turno (so lado LLM, so em turno bem-sucedido —
      // em erroRede o ultimosTokens do cliente fica velho, entao ignoramos).
      const tk = (!registro.erroRede && cliente[dono] && cliente[dono].ultimosTokens) ? cliente[dono].ultimosTokens : null;
      if (tk) {
        serieTokens[dono].push({ turno, prompt: tk.prompt || 0, resposta: tk.resposta || 0 });
        out(`tokens.contexto: prompt ${tk.prompt} | resposta ${tk.resposta}`);
      }
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
    // ABORT por throttle sustentado: um lado acumulou erros de rede consecutivos.
    if (erroRedeSeguido.A >= LIM_ERRO_REDE || erroRedeSeguido.B >= LIM_ERRO_REDE) {
      const lado = erroRedeSeguido.A >= LIM_ERRO_REDE ? "A" : "B";
      motivoAbort = `${LIM_ERRO_REDE}+ erros de rede consecutivos do Rei ${lado} (${etiquetaDe[lado]}) — provavel teto diario/throttle do free tier`;
      console.error("\n!!! ABORTANDO: " + motivoAbort);
      break;
    }
  }
  } catch (e) {
    // erro de TOPO (fora do catch interno de decidirRei): antes morria em
    // silencio (o T12). Agora vira marcador + FIM + RESUMO parcial no log.
    motivoAbort = motivoAbort || ("erro inesperado: " + (e && e.stack ? e.stack.split("\n")[0] : String(e)));
    console.error("\n!!! EXCECAO NO LOOP:", e && e.stack ? e.stack : e);
  }

  finalizar(estado, venc, motivoAbort);

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
  return motivoAbort;
}

// FLUSH DE EMERGENCIA: ultima rede se um erro escapar ATE de main() (ex.: falha
// antes do try, ou rejeicao/excecao a nivel de processo). Garante que o log
// nunca fica "mudo" sobre por que parou — a licao do T12.
function flushEmergencia(rotulo, err) {
  try {
    if (!jaFinalizou) {
      out(`>>> ${rotulo}: ${err && err.stack ? err.stack.split("\n")[0] : String(err)}`);
      gravar();
    }
  } catch (_) { /* nunca deixar o handler estourar */ }
}
process.on("unhandledRejection", (e) => { flushEmergencia("UNHANDLED REJECTION", e); process.exitCode = 1; });
process.on("uncaughtException",  (e) => { flushEmergencia("UNCAUGHT EXCEPTION", e); process.exitCode = 1; });

main()
  .then((motivoAbort) => { if (motivoAbort) process.exitCode = 2; }) // 2 = interrompida (log tem o marcador)
  .catch((e) => { flushEmergencia("FALHA FATAL EM main()", e); process.exitCode = 1; });
