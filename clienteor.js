// clienteor.js — UM SÓ CLIENTE DE OPENROUTER.
//
// ── PORQUE ESTE FICHEIRO EXISTE ────────────────────────────────────────────
// Havia dois, e a dívida estava escrita no CLAUDE.md desde agosto: um no
// `index.html` (o browser, onde as partidas do vídeo correm) e outro no
// `rei.js` (o runner headless). Faziam a mesma coisa e sabiam coisas
// diferentes, que é o pior dos dois mundos:
//
//   * em 17/08 três partidas morreram porque o cliente adivinhava a espera de
//     um 429 por backoff exponencial em vez de honrar o `Retry-After` que o
//     provedor mandava. O browser foi corrigido -- "usa-se o MAIOR entre o
//     pedido do provedor e o backoff, com teto de 45 s" -- e o runner NÃO. Um
//     mês depois ainda tinha a regra velha;
//   * o browser insistia 9 vezes, o runner 6;
//   * o browser lia `retry_after_seconds` do corpo, o runner lia `retryDelay`.
//     Cada um cego para metade dos provedores;
//   * o browser contava os throttles recuperados (sem isso, um modelo que
//     precisa de cinco tentativas por turno parece igual a um que responde de
//     primeira) e o runner não contava nada disso.
//
// O que o motor executa tem de ser o que o log diz; a mesma regra vale para o
// que o cliente faz. Uma regra, uma implementação.
//
// ── O QUE FICA DE FORA, DE PROPÓSITO ───────────────────────────────────────
// O RITMO e a INSISTÊNCIA continuam a ser de quem chama, com os valores que
// cada lado sempre teve (browser: 300 ms e 9 tentativas; runner: 3000 ms e 6).
// Mudá-los aqui mudaria o que já foi medido, e isso é uma decisão de bancada,
// não de arrumação.
//
// De fora fica também DE ONDE vem o pedido de raciocínio: no browser são dois
// campos do painel, no runner são duas variáveis de ambiente. Quem chama passa
// o objeto já feito.
//
// No navegador entra por `<script src>` e fica em `window.ClienteOR`; no Node
// entra por `require`, como o `engine.js`.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.ClienteOR = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const URL_PADRAO = "https://openrouter.ai/api/v1/chat/completions";
  // ── O TETO DE RESPOSTA (29/08) ─────────────────────────────────────────
  // Era 32000 fixo. Medido na P5 vs P6 de 28/08: o mesmo modelo, o mesmo
  // adversário e a mesma seed, mudando SÓ o teto -- 32000 perdeu 6x18 no T23;
  // 64000 segurou os 40 turnos em 10x14 e com mais tropas. Um modelo estava a
  // ser descartado por uma configuração NOSSA. Decisão do Lucas: pede-se alto.
  //
  // Alto e FIXO também não serve: 128000 rebenta num modelo de contexto pequeno
  // (o `liquid/lfm-2.5-2.6b` tem 65536 no total e devolve HTTP 400), e os
  // provedores não são consistentes. A saída é que o próprio erro diz o limite
  // -- "maximum context length is 65536 tokens. However, you requested about
  // 128002" --, portanto pede-se alto e, se recusarem, recalcula-se a partir do
  // que ELES disseram. Auto-corrige, sem catálogo nosso para manter.
  const TETO_ALTO = 128000;
  const TETO_ESPERA_MS = 45000;      // nenhuma espera passa disto
  const FOLGA_TETO = 2048;

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  // Quanto o PROVEDOR pediu para esperarmos. Header `Retry-After` (segundos),
  // ou no corpo do erro -- `retry_after_seconds` (OpenRouter) e `retryDelay`
  // (estilo Google). Cada cliente antigo lia só metade destes.
  function pedidoDoProvedor(resp, corpo) {
    const h = resp && resp.headers && resp.headers.get && resp.headers.get("retry-after");
    if (h != null && h !== "") {
      const s = parseFloat(h);
      if (isFinite(s) && s > 0) return Math.ceil(s * 1000);
    }
    const m = /"retry(?:_after_seconds|_after|Delay)"\s*:\s*"?(\d+(?:\.\d+)?)s?"?/.exec(corpo || "");
    return m ? Math.ceil(parseFloat(m[1]) * 1000) : 0;
  }

  function criar(opcoes) {
    const o = opcoes || {};
    const url = o.url || URL_PADRAO;
    // ⚠ A CHAVE E A TEMPERATURA SAO LIDAS A CADA CHAMADA, nao no nascimento
    // do cliente: no browser o utilizador cola a chave depois de a pagina
    // abrir, e mexe na temperatura pelo painel a meio da sessao. Um snapshot
    // aqui deixava o cliente a pedir com a chave vazia para sempre.
    const maxTentativas = o.maxTentativas != null ? o.maxTentativas : 9;
    const minIntervaloMs = o.minIntervaloMs != null ? o.minIntervaloMs : 300;
    const maxTokens = o.maxTokens != null ? o.maxTokens : TETO_ALTO;
    const buscar = o.fetch || (typeof fetch === "function" ? fetch : null);
    const espera = o.espera || dormir;
    const aviso = o.aviso || function () {};
    // o que o modelo aguenta, aprendido com o HTTP 400 dele. Por MODELO, porque
    // um cliente pode servir vários (é o caso do browser).
    const teto = o.tetoPorModelo || {};
    let ultimoEnvio = 0;

    async function respeitarRitmo() {
      const faltam = minIntervaloMs - (Date.now() - ultimoEnvio);
      if (faltam > 0) await espera(faltam);
      ultimoEnvio = Date.now();
    }

    // devolve { texto, raciocinio, tele }
    //   tele: { ms, tokens, finish, finishNativo, erro, modoRac, throttles }
    async function gerar(prompt, modelo, extra) {
      const ex = extra || {};
      const raciocinio = ex.raciocinio || o.raciocinio || { enabled: true };
      const chave = ex.chave != null ? ex.chave : o.chave;
      const temperatura = ex.temperatura != null ? ex.temperatura
                        : (o.temperatura != null ? o.temperatura : 0);
      let throttles = 0;
      for (let tentativa = 1; ; tentativa++) {
        await respeitarRitmo();
        const t0 = Date.now();
        const resp = await buscar(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + chave },
          body: JSON.stringify({
            model: modelo,
            messages: [{ role: "user", content: prompt }],
            temperature: temperatura,
            stream: false,
            reasoning: raciocinio,
            max_tokens: teto[modelo] || maxTokens,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const u = data.usage;
          const det = (u && u.completion_tokens_details) || {};
          const ch = (data.choices && data.choices[0]) || {};
          const msg = ch.message || {};
          // o raciocínio vem em `message.reasoning` (texto) e/ou em
          // `reasoning_details` (estruturado); `content` é a resposta final
          let rac = msg.reasoning || null;
          if (!rac && Array.isArray(msg.reasoning_details))
            rac = msg.reasoning_details
              .map((d) => (d && (d.text || d.summary)) || "").join("\n").trim() || null;
          return {
            texto: msg.content || "",
            raciocinio: rac,
            tele: {
              ms: Date.now() - t0,
              tokens: u ? { prompt: u.prompt_tokens || 0,
                            resposta: u.completion_tokens || 0,
                            raciocinio: det.reasoning_tokens || 0 } : null,
              finish: ch.finish_reason || null,
              finishNativo: ch.native_finish_reason || null,
              erro: (data.error && (data.error.message || JSON.stringify(data.error))) || null,
              // resumo (OpenAI manda `*.summary`) vs cadeia crua vs ausente
              modoRac: !rac ? "ausente"
                : (Array.isArray(msg.reasoning_details)
                   && msg.reasoning_details.some((d) => d && /summary/.test(d.type || "")))
                  ? "resumo" : "completo",
              throttles,
              teto: teto[modelo] || maxTokens,
            },
          };
        }
        const corpo = await resp.text().catch(() => "");
        // ⚠ O PROVEDOR RECUSOU O TETO E DISSE QUAL É O DELE. Aprende-se e
        // repete-se, e isto NÃO gasta tentativa de rede: não houve falha de
        // rede, houve um pedido mal dimensionado nosso.
        const lim = /maximum context length is (\d+)/.exec(corpo);
        if (resp.status === 400 && lim && teto[modelo] == null) {
          const ctx = parseInt(lim[1], 10);
          const ped = /you requested about (\d+)/.exec(corpo);
          const entrada = ped ? Math.max(0, parseInt(ped[1], 10) - maxTokens) : 0;
          teto[modelo] = Math.max(4096, ctx - entrada - FOLGA_TETO);
          aviso("[teto] " + modelo + ": contexto " + ctx
                + "; teto de resposta ajustado para " + teto[modelo]);
          tentativa--;
          continue;
        }
        const recuperavel = resp.status === 429 || resp.status === 503;
        if (!recuperavel || tentativa >= maxTentativas)
          throw new Error("OpenRouter HTTP " + resp.status + ": " + corpo);
        throttles++;
        // ── HONRAR O Retry-After (17/08) ───────────────────────────────────
        // Adivinhar por backoff gastava as tentativas mais depressa do que o
        // pool levava a libertar, e matou três partidas. Usa-se o MAIOR entre o
        // que o provedor pediu e o backoff, com teto por espera -- para não
        // dormir dez minutos só porque alguém o pediu.
        const pedido = pedidoDoProvedor(resp, corpo);
        const backoff = Math.min(1000 * Math.pow(2, tentativa), 40000) + 500;
        await espera(Math.min(Math.max(pedido, backoff), TETO_ESPERA_MS));
      }
    }

    return { gerar, get tetoPorModelo() { return teto; } };
  }

  return { criar, TETO_ALTO, TETO_ESPERA_MS, pedidoDoProvedor, URL_PADRAO };
});
