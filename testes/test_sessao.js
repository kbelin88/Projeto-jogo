// test_sessao.js - A SESSAO FAZ O QUE A SPEC DIZ, SEM TOCAR A REDE.
//
// POR QUE EXISTE (29/09/2026, SPEC_TESTE_SESSAO_0929)
// O teste vivo tem uma corrida so (US$1,38 de saldo, 20 pedidos gratis do
// Gemini). O que se pode errar ANTES de gastar tem de estar trancado aqui, com
// clientes de mentira e `fetch` de mentira:
//   1. as fronteiras de sessao (N turnos, memoria que passa, mensagem 1 igual);
//   2. o que fica e o que sai do historico (sem statement, sem memoria; um turno
//      invalido nao entra no contexto);
//   3. o corpo dos pedidos ao OpenRouter (cache) e ao Gemini (multi-turno) e a
//      leitura do cache e do custo real;
//   4. o modo de um turno por vez continua a mandar EXATAMENTE o que mandava.
"use strict";
const assert = require("assert");
const E = require("../engine.js");
const Sessao = require("../sessao.js");
const ClienteOR = require("../clienteor.js");
const Rei = require("../rei.js");

let n = 0;
const t = async (nome, fn) => { await fn(); n++; console.log("  ok  " + nome); };

function novoEstado(seed) {
  const cfg = JSON.parse(JSON.stringify(E.CONFIG)); cfg.layout = "iberia"; cfg.seed = seed || 1;
  return E.criarEstadoInicial(cfg);
}
// cliente roteirizado: cada chamada devolve o proximo item (string) ou lanca (Error)
function roteiro(itens) {
  const c = {
    nome: "roteiro", ultimosTokens: { prompt: 1000, resposta: 500, raciocinio: 400, ms: 1 }, ultimoFinish: "stop",
    pedidos: [], i: 0,
    async gerar(prompt) {
      c.pedidos.push(JSON.parse(JSON.stringify(prompt)));
      const it = itens[c.i++ % itens.length];
      if (it instanceof Error) throw it;
      if (it && it.finish) c.ultimoFinish = it.finish; else c.ultimoFinish = "stop";
      return { texto: typeof it === "string" ? it : it.texto, raciocinio: "r" };
    },
  };
  return c;
}
const R = (extra) => JSON.stringify(Object.assign({ build: [], movements: [], plan: "meu plano", statement: "para a tela" }, extra || {}));

(async () => {
  // ---- 1. fronteiras de sessao --------------------------------------------
  await t("1 N=2: a memoria escrita no ultimo turno abre a sessao seguinte; a mensagem 1 nao muda", async () => {
    const est = novoEstado(1);
    const s = Sessao.criarSessao({ N: 2 });
    const cli = roteiro([R(), R({ memory: "H1: ele so ataca Toledo com menos de 4 tropas." }), R(), R({ memory: "H2: segundo lote." })]);
    const regs = [];
    for (let i = 0; i < 4; i++) { E.tick(est); regs.push((await Sessao.decidirReiSessao(est, "A", s, cli)).registro); }
    // pedidos: 1 e 2 na sessao 1; 3 e 4 na sessao 2
    assert.deepStrictEqual(cli.pedidos.map((p) => p.mensagens.length), [1, 3, 1, 3], "o historico cresce e recomeca");
    assert.strictEqual(cli.pedidos[0].system, cli.pedidos[2].system, "a mensagem 1 tem de ser igual entre sessoes (cache)");
    assert.ok(!/=== YOUR MEMORY/.test(cli.pedidos[0].mensagens[0].content), "a 1a sessao nao tem memoria");
    assert.ok(/=== YOUR MEMORY FROM THE LAST SESSION \(written by you on turn 2\) ===\nH1: ele so ataca Toledo/.test(cli.pedidos[2].mensagens[0].content), "a 2a sessao abre com a memoria do turno 2");
    assert.ok(!/=== YOUR MEMORY/.test(cli.pedidos[3].mensagens[2].content), "a memoria vem so no 1o turno da sessao");
    assert.deepStrictEqual(regs.map((r) => r.sessao.numero), [1, 1, 2, 2]);
    assert.deepStrictEqual(regs.map((r) => r.sessao.turnoNaSessao), [1, 2, 1, 2]);
    assert.deepStrictEqual(regs.map((r) => r.sessao.ultimo), [false, true, false, true]);
    assert.deepStrictEqual(s.memorias.map((m) => m.turno), [2, 4]);
  });

  await t("2 so o ultimo turno pede a memoria; so o 1o turno da sessao leva o inexplorado", async () => {
    const est = novoEstado(1);
    const s = Sessao.criarSessao({ N: 3 });
    const cli = roteiro([R(), R(), R({ memory: "m" })]);
    for (let i = 0; i < 3; i++) { E.tick(est); await Sessao.decidirReiSessao(est, "A", s, cli); }
    const ult = (i) => cli.pedidos[i].mensagens[cli.pedidos[i].mensagens.length - 1].content;
    assert.deepStrictEqual([0, 1, 2].map((i) => /"memory" field/.test(ult(i))), [false, false, true]);
    assert.deepStrictEqual([0, 1, 2].map((i) => /UNEXPLORED/.test(ult(i))), [true, false, false]);
  });

  await t("2b no ultimo turno da PARTIDA nao se pede memoria (ninguem a leria)", async () => {
    const est = novoEstado(1);
    const s = Sessao.criarSessao({ N: 2 });
    const cli = roteiro([R(), R()]);
    for (let i = 0; i < 2; i++) { E.tick(est); await Sessao.decidirReiSessao(est, "A", s, cli, { maxTurnos: 2 }); }
    const ult = cli.pedidos[1].mensagens[cli.pedidos[1].mensagens.length - 1].content;
    assert.ok(!/"memory" field/.test(ult), "o turno 2 e o ultimo do jogo: sem pedido de memoria");
  });

  // ---- 2. o que fica no historico ---------------------------------------------
  await t("3 o historico guarda build, movements e plan; nunca o statement nem a memoria", async () => {
    const est = novoEstado(1);
    const s = Sessao.criarSessao({ N: 2 });
    const cli = roteiro([R({ memory: "so no fim" }), R()]);
    E.tick(est); await Sessao.decidirReiSessao(est, "A", s, cli);
    E.tick(est); await Sessao.decidirReiSessao(est, "A", s, cli);
    const guardada = JSON.parse(cli.pedidos[1].mensagens[1].content);
    assert.deepStrictEqual(Object.keys(guardada).sort(), ["build", "movements", "plan"]);
    assert.strictEqual(guardada.plan, "meu plano");
    assert.ok(!/para a tela/.test(JSON.stringify(cli.pedidos[1])), "o statement nao pode voltar ao Rei");
    const papeis = cli.pedidos[1].mensagens.map((m) => m.role);
    assert.deepStrictEqual(papeis, ["user", "assistant", "user"], "papeis alternados (o Gemini exige)");
  });

  await t("4 JSON invalido, resposta vazia, corte no teto e erro de rede: o turno passa E sai do contexto", async () => {
    const est = novoEstado(1);
    const s = Sessao.criarSessao({ N: 2 });
    const cli = roteiro([R(), "isto nao e JSON", "", { texto: R(), finish: "length" }, new Error("HTTP 429"), R({ memory: "ok" })]);
    const regs = [];
    for (let i = 0; i < 6; i++) { E.tick(est); regs.push((await Sessao.decidirReiSessao(est, "A", s, cli)).registro); }
    assert.deepStrictEqual(regs.map((r) => r.sessao.foraDoContexto),
      [null, "JSON invalido", "resposta vazia", "cortada no teto", "erro de rede", null]);
    // o historico so tem os turnos validos: 1o e 6o; o 6o e o ultimo da sessao 1 (N=2)
    assert.deepStrictEqual(cli.pedidos.map((p) => p.mensagens.length), [1, 3, 3, 3, 3, 3], "as falhas nao entram no contexto");
    assert.strictEqual(regs[5].sessao.ultimo, true);
    assert.strictEqual(s.memoria.texto, "ok");
    assert.strictEqual(regs[1].correcaoFormato, false, "sem segunda chance de formato (gastaria um pedido)");
    assert.strictEqual(cli.pedidos.length, 6, "uma chamada por turno, nunca uma segunda");
  });

  await t("5 se o Rei nao escreve a memoria, a sessao seguinte abre sem ela (o que nao escreve esquece-se)", async () => {
    const est = novoEstado(1);
    const s = Sessao.criarSessao({ N: 1 });
    const cli = roteiro([R(), R()]);
    E.tick(est); await Sessao.decidirReiSessao(est, "A", s, cli);
    E.tick(est); await Sessao.decidirReiSessao(est, "A", s, cli);
    assert.strictEqual(s.memoria.texto, null);
    assert.ok(!/YOUR MEMORY/.test(cli.pedidos[1].mensagens[0].content));
  });

  await t("6 os dois lados tem sessoes independentes", async () => {
    const est = novoEstado(1);
    const sA = Sessao.criarSessao({ N: 2 }), sB = Sessao.criarSessao({ N: 2 });
    const cA = roteiro([R(), R({ memory: "de A" })]), cB = roteiro([R(), R({ memory: "de B" })]);
    for (let i = 0; i < 3; i++) {
      E.tick(est);
      await Promise.all([Sessao.decidirReiSessao(est, "A", sA, cA), Sessao.decidirReiSessao(est, "B", sB, cB)]);
    }
    assert.ok(/YOUR MEMORY[^\n]*\nde A/.test(cA.pedidos[2].mensagens[0].content));
    assert.ok(/YOUR MEMORY[^\n]*\nde B/.test(cB.pedidos[2].mensagens[0].content));
    assert.ok(/You are King A/.test(cA.pedidos[0].system) && /You are King B/.test(cB.pedidos[0].system));
  });

  // ---- 3. os pedidos aos provedores ------------------------------------------
  const corpoOR = async (prompt, resposta) => {
    let corpo = null;
    const cli = ClienteOR.criar({ chave: "k", minIntervaloMs: 0, espera: async () => {},
      fetch: async (url, init) => { corpo = JSON.parse(init.body); return { ok: true, json: async () => resposta }; } });
    const r = await cli.gerar(prompt, "anthropic/claude-sonnet-5.5");
    return { corpo, r };
  };
  const respostaOR = { choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 5000, completion_tokens: 900, completion_tokens_details: { reasoning_tokens: 700 },
      prompt_tokens_details: { cached_tokens: 3900, cache_write_tokens: 1000 }, cost: 0.0123 } };

  await t("7 OpenRouter: um pedido de sessao leva cache no system e na ultima mensagem, e pede o custo", async () => {
    const { corpo, r } = await corpoOR({ system: "REGRAS", mensagens: [{ role: "user", content: "u1" }, { role: "assistant", content: "a1" }, { role: "user", content: "u2" }] }, respostaOR);
    assert.strictEqual(corpo.messages[0].role, "system");
    assert.deepStrictEqual(corpo.messages[0].content, [{ type: "text", text: "REGRAS", cache_control: { type: "ephemeral" } }]);
    assert.strictEqual(corpo.messages[1].content, "u1", "as do meio ficam simples");
    assert.strictEqual(corpo.messages[2].content, "a1");
    assert.deepStrictEqual(corpo.messages[3].content, [{ type: "text", text: "u2", cache_control: { type: "ephemeral" } }]);
    assert.deepStrictEqual(corpo.usage, { include: true });
    assert.deepStrictEqual(r.tele.tokens, { prompt: 5000, resposta: 900, raciocinio: 700, cacheLido: 3900, cacheEscrito: 1000, custo: 0.0123 });
    const count = (o) => JSON.stringify(o).split("cache_control").length - 1;
    assert.ok(count(corpo) <= 4, "a Anthropic permite 4 pontos de cache");
  });

  await t("8 OpenRouter: um prompt-string continua a ser o pedido de sempre (sem usage, sem cache)", async () => {
    const { corpo, r } = await corpoOR("O PROMPT INTEIRO", { choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 100, completion_tokens: 10, completion_tokens_details: { reasoning_tokens: 5 } } });
    assert.deepStrictEqual(corpo.messages, [{ role: "user", content: "O PROMPT INTEIRO" }]);
    assert.ok(!("usage" in corpo));
    assert.deepStrictEqual(r.tele.tokens, { prompt: 100, resposta: 10, raciocinio: 5 }, "sem campos novos quando o provedor nao os manda");
  });

  const corposGemini = [];
  const fetchOriginal = global.fetch;
  global.fetch = async (url, init) => {
    corposGemini.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "pensando", thought: true }, { text: "{}" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 4000, candidatesTokenCount: 300, thoughtsTokenCount: 2100, cachedContentTokenCount: 3000 } }) };
  };
  await t("9 Gemini: pedido de sessao vira systemInstruction + contents com papeis, e le pensamento e cache", async () => {
    const g = Rei.clienteGemini({ apiKey: "k", minIntervaloMs: 0, maxTentativas: 1 });
    const r = await g.gerar({ system: "REGRAS", mensagens: [{ role: "user", content: "u1" }, { role: "assistant", content: "a1" }, { role: "user", content: "u2" }] });
    const c = corposGemini[0];
    assert.deepStrictEqual(c.systemInstruction, { parts: [{ text: "REGRAS" }] });
    assert.deepStrictEqual(c.contents.map((x) => x.role), ["user", "model", "user"]);
    assert.strictEqual(c.contents[1].parts[0].text, "a1");
    assert.strictEqual(r.texto, "{}");
    assert.strictEqual(r.raciocinio, "pensando");
    assert.deepStrictEqual({ p: g.ultimosTokens.prompt, r: g.ultimosTokens.resposta, rac: g.ultimosTokens.raciocinio, c: g.ultimosTokens.cacheLido }, { p: 4000, r: 2400, rac: 2100, c: 3000 });
    assert.strictEqual(g.ultimoFinish, "stop");
  });
  await t("10 Gemini: um prompt-string continua a ser o pedido de sempre", async () => {
    const g = Rei.clienteGemini({ apiKey: "k", minIntervaloMs: 0, maxTentativas: 1 });
    await g.gerar("O PROMPT");
    const c = corposGemini[corposGemini.length - 1];
    assert.deepStrictEqual(c.contents, [{ parts: [{ text: "O PROMPT" }] }]);
    assert.ok(!("systemInstruction" in c));
    assert.deepStrictEqual(Object.keys(g.ultimosTokens).sort(), ["ms", "prompt", "resposta"], "o modo de um turno por vez nao ganha campos");
  });
  await t("11 Gemini: 429 com MAX_TENTATIVAS=1 nao reenvia (cada pedido e um dos 20 do dia)", async () => {
    let chamadas = 0;
    global.fetch = async () => { chamadas++; return { ok: false, status: 429, text: async () => '{"retryDelay":"1s"}' }; };
    const g = Rei.clienteGemini({ apiKey: "k", minIntervaloMs: 0, maxTentativas: 1 });
    await assert.rejects(() => g.gerar({ system: "S", mensagens: [{ role: "user", content: "u" }] }), /429/);
    assert.strictEqual(chamadas, 1);
  });
  global.fetch = fetchOriginal;

  // ---- 4. o cliente falso (ensaio a seco) ------------------------------------
  await t("12 clienteFalso: a partida inteira em sessao corre, com cache e custo coerentes", async () => {
    const est = novoEstado(1);
    const s = Sessao.criarSessao({ N: 4 });
    const cli = Sessao.clienteFalso({ modelo: "sonnet" });
    let cacheTotal = 0, promptTotal = 0;
    for (let i = 0; i < 8; i++) {
      E.tick(est);
      const { ordem, registro } = await Sessao.decidirReiSessao(est, "A", s, cli);
      E.executarOrdem(est, "A", ordem);
      assert.strictEqual(registro.jsonValido, true, "o falso responde no protocolo em ingles");
      if (i > 0) { cacheTotal += cli.ultimosTokens.cacheLido; promptTotal += cli.ultimosTokens.prompt; }
    }
    assert.ok(cacheTotal / promptTotal > 0.6, "o cache simulado nao esta a ler: " + (cacheTotal / promptTotal));
    assert.strictEqual(s.memorias.length, 2);
    assert.ok(s.memorias.every((m) => m.texto && m.texto.length > 200));
  });

  await t("13 o runner CORTA a partida no turno 2 se o cache nao le nada (o teste nao cabe no saldo sem ele)", async () => {
    const { spawnSync } = require("child_process");
    const fs = require("fs"), os = require("os"), path = require("path");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sessao-"));
    const saida = path.join(dir, "corte.txt");
    const r = spawnSync(process.execPath, [path.join(__dirname, "..", "runners", "rei_vs_rei.js"), "falso:sonnetsemcache", "falso:gemini", "1", "20", saida],
      { env: Object.assign({}, process.env, { SESSAO_N: "4" }), encoding: "utf8", timeout: 120000 });
    const log = fs.readFileSync(saida, "utf8");
    assert.ok(/INTERROMPIDO: o cache nao le nada no 2o turno/.test(log), "o log tem de dizer porque parou:\n" + (r.stderr || "").slice(-400));
    assert.ok(!/TURNO 3 /.test(log), "nao pode ter jogado o turno 3");
    const boa = path.join(dir, "boa.txt");
    spawnSync(process.execPath, [path.join(__dirname, "..", "runners", "rei_vs_rei.js"), "falso:sonnet", "falso:gemini", "1", "6", boa],
      { env: Object.assign({}, process.env, { SESSAO_N: "4" }), encoding: "utf8", timeout: 120000 });
    assert.ok(!/INTERROMPIDO/.test(fs.readFileSync(boa, "utf8")), "com cache a partida nao pode ser cortada");
    assert.ok(fs.existsSync(boa.replace(/\.txt$/, ".sessao.jsonl")), "a sessao grava o .sessao.jsonl");
  });

  console.log(`\ntest_sessao: ${n} provas ok`);
})().catch((e) => { console.error(e); process.exit(1); });
