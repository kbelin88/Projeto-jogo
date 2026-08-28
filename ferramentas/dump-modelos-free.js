// dump-modelos-free.js — gera modelos_free_openrouter.txt a partir do catalogo
// AO VIVO da OpenRouter (/api/v1/models).
//
// Porque existe (28/08): o dump era feito a mao. Resultado: ficou 10 dias parado
// enquanto o catalogo :free rodava por baixo — e 3 dos 8 modelos de 17/08
// morreram (404) em menos de 24 h. Conferir o catalogo e o passo 1 de qualquer
// bateria; um passo manual mais cedo ou mais tarde nao e dado.
//
// Uso:  node ferramentas/dump-modelos-free.js [saida.txt]
// Le OPENROUTER_API_KEY do .env (a rota e publica, mas a chave evita throttle).
//
// A saida alimenta ferramentas/tabela-modelos.js, que decide a coluna "apto" e
// escreve MODELOS_ARENA.md. O FORMATO IMPORTA: o parser la le por rotulo
// ("ID (usar no jogo):", "Context length:", ...) e separa blocos por uma linha
// de 90 tracos. Mudar rotulo aqui quebra a tabela la.
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const saida = process.argv[2] || path.join(RAIZ, "modelos_free_openrouter.txt");

function chave() {
  try {
    const env = fs.readFileSync(path.join(RAIZ, ".env"), "utf8");
    const m = /^OPENROUTER_API_KEY=(.+)$/m.exec(env);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  } catch { return null; }
}

const ehFree = (m) => {
  const p = m.pricing || {};
  return Number(p.prompt) === 0 && Number(p.completion) === 0;
};

// "text+image->text", como o parser da tabela espera (ele testa /->\s*text/).
const modalidade = (m) => {
  const a = (m.architecture || {});
  const ent = (a.input_modalities || []).join("+") || "?";
  const sai = (a.output_modalities || []).join("+") || "?";
  return `${ent}->${sai}`;
};

// O bloco de reasoning e lido por regex na tabela: mandatorio=, ativo-por-padrao=,
// esforcos=..., default=. Manter os nomes.
const reasoning = (m) => {
  const s = m.supported_parameters || [];
  const r = (m.architecture && m.architecture.reasoning_config) || null;
  if (!r && !s.includes("reasoning")) return "nao suportado";
  const esf = r && r.supported_efforts ? r.supported_efforts.join(",") : "?";
  const def = r && r.default_effort ? r.default_effort : "?";
  return `suportado, mandatorio=${!!(r && r.mandatory)}, ativo-por-padrao=${!!(r && r.default_enabled)}, esforcos=${esf}, default=${def}`;
};

(async () => {
  const k = chave();
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: k ? { Authorization: "Bearer " + k } : {},
  });
  if (!res.ok) { console.error(`HTTP ${res.status} ao buscar o catalogo`); process.exit(1); }
  const todos = (await res.json()).data || [];
  const free = todos.filter(ehFree).sort((a, b) => a.id.localeCompare(b.id));

  const L = [];
  L.push("=".repeat(90));
  L.push("MODELOS FREE DISPONIVEIS NA OPENROUTER");
  L.push("Gerado em: " + new Date().toISOString());
  L.push("Fonte: https://openrouter.ai/api/v1/models");
  L.push("Total de modelos no catalogo: " + todos.length);
  L.push("Total de modelos FREE (prompt=0 e completion=0): " + free.length);
  L.push("=".repeat(90));
  for (const m of free) {
    const tp = m.top_provider || {};
    L.push("-".repeat(90));
    L.push("ID (usar no jogo): " + m.id);
    L.push("Nome: " + (m.name || m.id));
    L.push("Criado em: " + (m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : "?"));
    L.push("Context length: " + (m.context_length != null ? m.context_length : (tp.context_length != null ? tp.context_length : "?")));
    L.push("Max completion: " + (tp.max_completion_tokens != null ? tp.max_completion_tokens : "?"));
    L.push("Modalidade: " + modalidade(m));
    L.push("Tokenizer: " + ((m.architecture && m.architecture.tokenizer) || "?"));
    L.push("Reasoning/thinking: " + reasoning(m));
    L.push("Parametros suportados: " + (m.supported_parameters || []).join(", "));
    L.push("Descricao: " + (m.description || "").replace(/\s+/g, " ").slice(0, 400));
  }
  L.push("-".repeat(90));
  fs.writeFileSync(saida, L.join("\n") + "\n", "utf8");
  console.log(`${path.relative(RAIZ, saida)}: ${free.length} modelos free de ${todos.length} no catalogo`);
})();
