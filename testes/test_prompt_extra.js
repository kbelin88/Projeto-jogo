// test_prompt_extra.js — PROMPT_EXTRA / PROMPT_EXTRA_LADOS do runner (09/10/2026).
// Sem a variavel o prompt e o de sempre; com ela o bloco "INSTRUÇÕES EXTRA DO TREINADOR"
// aparece so no lado pedido, na sessao (mensagem 1) e no P4 (SESSAO_N=0). Cliente falso: sem rede.
"use strict";
const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const Rei = require("../rei.js");
const E = require("../engine.js");

const MARCA = "INSTRUÇÕES EXTRA DO TREINADOR";
const TEXTO = "ZZ-TEXTO-DE-TESTE-ZZ: prefira defender as capitais.";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pextra-"));
const arq = path.join(dir, "extra.txt");
fs.writeFileSync(arq, TEXTO, "utf8");
let n = 0;
const t = (nome, fn) => { fn(); n++; console.log("  ok  " + nome); };

t("blocoExtra vazio = nada; com texto = bloco marcado", () => {
  assert.strictEqual(Rei.blocoExtra(""), "");
  assert.strictEqual(Rei.blocoExtra(undefined), "");
  const b = Rei.blocoExtra(TEXTO);
  assert.ok(b.includes(MARCA) && b.includes(TEXTO));
});

function correr(nome, env) {
  const saida = path.join(dir, nome + ".txt");
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "runners", "rei_vs_rei.js"),
    "falso:gemini", "falso:gemini", "3", "5", saida],
    { env: Object.assign({}, process.env, { PROMPT_EXTRA: "", PROMPT_EXTRA_LADOS: "" }, env), encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  const log = fs.readFileSync(saida, "utf8");
  const sj = saida.replace(/\.txt$/, ".sessao.jsonl");
  const linhas = fs.existsSync(sj) ? fs.readFileSync(sj, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { log, linhas };
}

t("campeao (sessao): sem PROMPT_EXTRA nada aparece e o cabecalho nao menciona", () => {
  const r = correr("c0", {});
  assert.ok(!r.log.includes(TEXTO) && !r.log.includes(MARCA) && !r.log.includes("PROMPT_EXTRA"));
  assert.ok(r.linhas.length > 0 && r.linhas.every((l) => !JSON.stringify(l).includes(MARCA)));
});

t("campeao (sessao): PROMPT_EXTRA so no lado A", () => {
  const r = correr("cA", { PROMPT_EXTRA: arq, PROMPT_EXTRA_LADOS: "A" });
  const ini = r.linhas.filter((l) => l.tipo === "sessao_inicio");
  assert.ok(ini.some((l) => l.lado === "A") && ini.some((l) => l.lado === "B"));
  for (const l of ini) assert.strictEqual(l.system.includes(TEXTO), l.lado === "A", "lado " + l.lado);
  assert.ok(/PROMPT_EXTRA extra\.txt \(\d+ caracteres\) nos lados A\b/.test(r.log), "cabecalho");
});

t("campeao (sessao): padrao AB e lado B", () => {
  for (const [lados, a, b] of [["", true, true], ["B", false, true]]) {
    const r = correr("c" + lados, { PROMPT_EXTRA: arq, PROMPT_EXTRA_LADOS: lados });
    const ini = r.linhas.filter((l) => l.tipo === "sessao_inicio");
    for (const l of ini) assert.strictEqual(l.system.includes(TEXTO), l.lado === "A" ? a : b);
  }
});



(async () => {
  const cfg = JSON.parse(JSON.stringify(E.CONFIG)); cfg.layout = "iberia"; cfg.seed = 3;
  const est = E.criarEstadoInicial(cfg);
  const capta = () => { const c = { gerar: async (p) => { c.prompt = p; return { texto: "{}" }; } }; return c; };
  const c0 = capta(), c1 = capta(), c2 = capta();
  await Rei.decidirRei(est, "A", c0);
  await Rei.decidirRei(est, "A", c1, undefined, "");
  await Rei.decidirRei(est, "A", c2, undefined, TEXTO);
  assert.strictEqual(c1.prompt, c0.prompt, "extra vazio = prompt identico");
  assert.strictEqual(c0.prompt, E.montarPrompt(E.montarVisao(est, "A"), { rejeicaoNoFim: true }));
  assert.ok(c2.prompt.startsWith(c0.prompt) && c2.prompt.includes(MARCA) && c2.prompt.endsWith(Rei.blocoExtra(TEXTO)));
  n++; console.log("  ok  P4 (decidirRei): sem extra identico; com extra o bloco vai no fim");
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`test_prompt_extra: ${n} grupos ok`);
})();
