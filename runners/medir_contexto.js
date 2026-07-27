// ============================================================
//  medir_contexto.js — QUANTO DO PROMPT O MODELO REALMENTE VE
// ------------------------------------------------------------
//  Contexto: em 27/07/2026 descobrimos que o Ollama TRUNCA o prompt
//  em silencio quando ele passa de num_ctx (default 4096), e que o
//  pedaco descartado e o COMECO. O prompt do jogo cruza 4096 por
//  volta do T12-T15 -> do meio da partida em diante todo modelo
//  local jogava vendo menos da metade do relatorio, sem erro nenhum.
//  Detalhes em docs/ACHADO_2026-07-27_truncamento_ollama.txt.
//
//  Esta bancada e a testemunha permanente: compara o tamanho REAL do
//  prompt com o que o Ollama diz ter avaliado (prompt_eval_count).
//  Se os dois divergem, houve corte.
//
//  Uso (da RAIZ, precisa do Ollama no ar):
//    node runners/medir_contexto.js
//    node runners/medir_contexto.js --modelo llama3.2:3b --ctx 8192
//    node runners/medir_contexto.js --turnos 40 --seed 3
//
//  Opcoes:
//    --modelo ID   modelo do Ollama (default qwen2.5:3b)
//    --ctx N       num_ctx a testar (default: o default do Ollama)
//    --turnos N    ate que turno avancar (default 30)
//    --seed N      seed do mapa (default 1)
//
//  COMO LER: "real" e o prompt medido com a janela folgada (16384);
//  "visto" e o mesmo prompt com a janela sob teste. real == visto ->
//  o modelo recebeu tudo. visto < real -> o modelo jogou cego.
//
//  O estado avanca com burro vs burro so p/ CRESCER O MAPA de forma
//  deterministica: o que interessa e o tamanho do relatorio por turno,
//  nao quem ganha.
// ============================================================
"use strict";
const path = require("path");
const Engine = require(path.join(__dirname, "..", "engine.js"));

const argv = process.argv.slice(2);
function opt(nome, padrao) {
  const i = argv.indexOf(nome);
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : padrao;
}
const modelo = opt("--modelo", "qwen2.5:3b");
const ctxTeste = argv.indexOf("--ctx") >= 0 ? Number(opt("--ctx")) : null;
const maxTurnos = Number(opt("--turnos", 30));
const seed = Number(opt("--seed", 1));
const CTX_FOLGADO = 16384; // janela grande o bastante p/ nunca cortar aqui

const URL = "http://localhost:11434/api/generate";

// Pede 1 token so: o que interessa e prompt_eval_count, nao a resposta.
async function tokensVistos(prompt, opcoes) {
  const resp = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo, prompt, stream: false,
      options: Object.assign({ temperature: 0, num_predict: 1 }, opcoes),
    }),
  });
  if (!resp.ok) throw new Error("Ollama HTTP " + resp.status);
  const d = await resp.json();
  if (d.prompt_eval_count == null) throw new Error("Ollama nao reportou prompt_eval_count");
  return d.prompt_eval_count;
}

(async () => {
  const config = Object.assign({}, Engine.CONFIG, { seed });
  const estado = Engine.criarEstadoInicial(config);

  // Marcos: T1 e de 5 em 5 ate o teto.
  const marcos = new Set([1]);
  for (let t = 5; t <= maxTurnos; t += 5) marcos.add(t);

  const prompts = {};
  while (estado.turno < maxTurnos) {
    Engine.rodarTurno(estado, {}); // {} = burro dos dois lados
    if (marcos.has(estado.turno)) {
      prompts[estado.turno] = Engine.montarPrompt(Engine.montarVisao(estado, "B"));
    }
  }

  console.log(`modelo ${modelo} | seed ${seed} | janela sob teste: ` +
    (ctxTeste ? String(ctxTeste) : "default do Ollama"));
  console.log("turno | chars | real | visto | veredito");

  let houveCorte = false;
  for (const t of Object.keys(prompts).map(Number).sort((a, b) => a - b)) {
    const p = prompts[t];
    const real = await tokensVistos(p, { num_ctx: CTX_FOLGADO });
    const visto = await tokensVistos(p, ctxTeste ? { num_ctx: ctxTeste } : {});
    const cortou = visto < real;
    if (cortou) houveCorte = true;
    console.log(
      `T${String(t).padStart(4)} | ${String(p.length).padStart(5)} | ` +
      `${String(real).padStart(4)} | ${String(visto).padStart(5)} | ` +
      (cortou ? `CORTOU -${real - visto} tok (${Math.round(100 * (1 - visto / real))}% perdido)` : "ok")
    );
  }

  console.log(houveCorte
    ? "\nVEREDITO: houve truncamento. Qualquer eval nessa janela mede o corte, nao o modelo."
    : "\nVEREDITO: nenhum corte nos marcos medidos.");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
