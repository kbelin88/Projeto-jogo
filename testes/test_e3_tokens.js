// test_e3_tokens.js — E3/1b: o canal lateral ultimosTokens captura o que o
// backend reporta, e vira null quando o backend nao reporta (nunca estimar).
// Roda sem rede: fetch e simulado.
const { clienteOllama } = require("../rei.js");

const casos = [];
function caso(nome, fn) { casos.push({ nome, fn }); }

// fetch falso: devolve o corpo que o caso mandar
function fetchFalso(corpo) {
  return async () => ({ ok: true, json: async () => corpo });
}

caso("ollama reporta -> ultimosTokens preenchido", async () => {
  global.fetch = fetchFalso({ response: "OI", prompt_eval_count: 123, eval_count: 45 });
  const c = clienteOllama({ modelo: "fake" });
  const txt = await c.gerar("prompt qualquer");
  if (txt !== "OI") throw new Error("gerar() mudou de contrato: " + txt);
  if (!c.ultimosTokens) throw new Error("ultimosTokens vazio com backend reportando");
  if (c.ultimosTokens.prompt !== 123 || c.ultimosTokens.resposta !== 45)
    throw new Error("tokens errados: " + JSON.stringify(c.ultimosTokens));
});

caso("ollama NAO reporta -> ultimosTokens null (nunca estimar)", async () => {
  global.fetch = fetchFalso({ response: "OI" });
  const c = clienteOllama({ modelo: "fake" });
  await c.gerar("prompt");
  if (c.ultimosTokens !== null) throw new Error("deveria ser null, veio: " + JSON.stringify(c.ultimosTokens));
});

caso("chamada nova sobrescreve a anterior", async () => {
  const c = clienteOllama({ modelo: "fake" });
  global.fetch = fetchFalso({ response: "1", prompt_eval_count: 10, eval_count: 1 });
  await c.gerar("a");
  global.fetch = fetchFalso({ response: "2" });
  await c.gerar("b");
  if (c.ultimosTokens !== null) throw new Error("token velho vazou para a chamada nova");
});

(async () => {
  for (const c of casos) {
    await c.fn();
    console.log("ok:", c.nome);
  }
  console.log("TEST E3 TOKENS OK (" + casos.length + " casos)");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
