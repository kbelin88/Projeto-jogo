// ============================================================
//  rei.js  —  V1 PECA 2: O REI (IA) movido por um LLM
// ------------------------------------------------------------
//  Orquestracao + chamada ao modelo. O que e PURO (montarPrompt,
//  parsearOrdem, diagnosticarOrdem) mora em engine.js e e testado
//  SEM rede. Aqui mora o que toca a rede e o tempo (async).
//
//  BACKEND ISOLADO (regra de ouro): a chamada ao modelo fica atras de
//  um "cliente" com UMA funcao -> gerar(prompt): Promise<string cru>.
//  Hoje = Ollama local; trocar por API depois = passar outro cliente.
//  Prompt, parsing, loop e eval NAO mudam.
//
//  SEM RETRY de proposito: resposta invalida e caso NORMAL -> o Rei
//  "passa" o turno (ordem vazia). Primeiro MEDIR a taxa crua de falha
//  do qwen; so depois decidir se retry vale a pena.
// ============================================================
"use strict";
const Engine = require("./engine.js");

// ---- .env: carregador minimo (sem dependencia) — popula process.env ----
// A chave NUNCA e hardcoded; mora no .env (protegido pelo .gitignore).
// So define o que ainda nao existe no ambiente (ambiente real tem prioridade).
function carregarEnv(caminho) {
  caminho = caminho || require("path").join(__dirname, ".env");
  try {
    const txt = require("fs").readFileSync(caminho, "utf8");
    for (let linha of txt.split(/\r?\n/)) {
      linha = linha.replace(/^﻿/, "").trim();
      if (!linha || linha.startsWith("#")) continue;
      const i = linha.indexOf("=");
      if (i < 0) continue;
      const k = linha.slice(0, i).trim();
      let v = linha.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch (_) { /* sem .env: segue; quem precisar de chave reclama na hora */ }
  return process.env;
}

// ---- CONTRATO DE RETORNO (thinking sempre-ligado): todo gerar() devolve
// { texto, raciocinio }. texto = resposta final (o que alimenta parsearOrdem,
// SEM raciocinio); raciocinio = string do pensamento, ou null se o backend
// nao suporta. Quem so quer a ordem le .texto; quem loga guarda .raciocinio.
// separarThink: modelos Ollama estilo qwen3 emitem <think>...</think> inline
// no data.response — extrai p/ raciocinio e limpa o texto. Sem bloco = null.
function separarThink(s) {
  s = s || "";
  const blocos = [];
  const re = /<think>([\s\S]*?)<\/think>/gi;
  let m;
  while ((m = re.exec(s))) blocos.push(m[1].trim());
  if (!blocos.length) return { texto: s, raciocinio: null };
  const texto = s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const raciocinio = blocos.join("\n").trim();
  return { texto, raciocinio: raciocinio || null };
}

// JANELA DE CONTEXTO EXPLICITA (achado de 27/07/2026, ver
// docs/ACHADO_2026-07-27_truncamento_ollama.txt). Sem num_ctx o Ollama usa 4096
// e, quando o prompt passa disso, DESCARTA METADE DA JANELA em silencio — e a
// metade descartada e o COMECO (identidade + tarefa + parte do relatorio),
// porque a politica de corte foi desenhada p/ chat, onde o fim e o que importa.
// O prompt do jogo cruza 4096 por volta do T15: dali em diante o modelo jogava
// vendo ~2050 de ~4700 tokens, sem erro nenhum — formato perfeito, jogo nenhum.
// 8192 cobre o pior prompt medido (4755) com folga e custa ~0.1 GB de VRAM nos
// 3B (segue 100% na GPU). 16384 derrama p/ CPU na 3050 Ti — nao subir sem medir.
// Guarda de regressao: node runners/medir_contexto.js --ctx 8192
const OLLAMA_NUM_CTX = 8192;

// ---- BACKEND: cliente Ollama (trocavel por um cliente de API depois) ----
function clienteOllama(opcoes) {
  opcoes = opcoes || {};
  const url = opcoes.url || "http://localhost:11434/api/generate";
  const modelo = opcoes.modelo || "qwen2.5:3b";
  const temperatura = opcoes.temperatura != null ? opcoes.temperatura : 0;
  const numCtx = opcoes.numCtx != null ? opcoes.numCtx : OLLAMA_NUM_CTX;
  return {
    nome: `ollama:${modelo}`,
    // E3/1b — canal LATERAL de tokens: gerar() segue devolvendo so a string
    // (nenhum consumidor muda); quem quiser tokens le cliente.ultimosTokens
    // apos a chamada. null = backend nao reportou (nunca estimar em silencio).
    ultimosTokens: null,
    async gerar(prompt) {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, prompt, stream: false, options: { temperature: temperatura, num_ctx: numCtx } }),
      });
      if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
      const data = await resp.json();
      this.ultimosTokens = (data.prompt_eval_count != null || data.eval_count != null)
        ? { prompt: data.prompt_eval_count || 0, resposta: data.eval_count || 0 }
        : null;
      return separarThink(data.response || ""); // { texto, raciocinio }
    },
  };
}

// ---- BACKEND: cliente Gemini (API) — MESMA interface do clienteOllama ----
// Mesma assinatura: { nome, gerar(prompt) -> Promise<string crua> }.
// Trocar de backend = trocar o objeto cliente; prompt/parsing/loop/eval NAO mudam.
function clienteGemini(opcoes) {
  opcoes = opcoes || {};
  const modelo = opcoes.modelo || "gemini-2.5-flash";
  const temperatura = opcoes.temperatura != null ? opcoes.temperatura : 0;
  carregarEnv();
  const apiKey = opcoes.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente (defina no .env desta pasta)");
  const url =
    opcoes.url ||
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
  // Backoff SO p/ throttle de transporte (429/503): o modelo nunca respondeu,
  // entao esperar e repetir nao "esconde" decisao ruim — diferente de retry em
  // resposta invalida (esse a gente NAO faz: o Rei passa o turno). Free tier =
  // 5 req/min; respeitamos o retryDelay que a propria API devolve.
  const maxTentativas = opcoes.maxTentativas != null ? opcoes.maxTentativas : 6;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  function delayServidor(corpo) {
    const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(corpo || "");
    return m ? Math.ceil(parseFloat(m[1]) * 1000) : null;
  }
  // PACING: piso de intervalo entre chamadas p/ caber na janela do free tier
  // (5 req/min -> >=12s). Evita o 429 ANTES de bater nele, deixando o eval
  // limpo (turno "passa" = decisao do modelo, nao throttle). 0 desliga.
  const minIntervaloMs = opcoes.minIntervaloMs != null ? opcoes.minIntervaloMs : 13000;
  let ultimoEnvio = 0;
  async function respeitarPiso() {
    const faltam = minIntervaloMs - (Date.now() - ultimoEnvio);
    if (faltam > 0) await espera(faltam);
    ultimoEnvio = Date.now();
  }
  return {
    nome: `gemini:${modelo}`,
    ultimosTokens: null, // E3/1b — mesmo canal lateral do clienteOllama
    async gerar(prompt) {
      for (let tentativa = 1; ; tentativa++) {
        await respeitarPiso();
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // thinking sempre-ligado: pede os thought parts de volta (senao o
            // texto do raciocinio nunca chega — so o thoughtsTokenCount).
            generationConfig: { temperature: temperatura, thinkingConfig: { includeThoughts: true }, maxOutputTokens: (opcoes.maxTokens != null ? opcoes.maxTokens : 32000) }, // LOTE C, E1
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const um = data.usageMetadata;
          this.ultimosTokens = um
            ? { prompt: um.promptTokenCount || 0, resposta: (um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0) }
            : null;
          const cand = data.candidates && data.candidates[0];
          const parts = (cand && cand.content && cand.content.parts) || [];
          // CRITICO: separar por p.thought. Sem isso o raciocinio entra em
          // texto e quebra o parsearOrdem (texto tem que ser SO o JSON).
          let texto = "", raciocinio = "";
          for (const p of parts) {
            if (p.thought === true) raciocinio += p.text || "";
            else texto += p.text || "";
          }
          return { texto, raciocinio: raciocinio || null };
        }
        const corpo = await resp.text().catch(() => "");
        const recuperavel = resp.status === 429 || resp.status === 503;
        if (!recuperavel || tentativa >= maxTentativas) {
          throw new Error(`Gemini HTTP ${resp.status}: ${corpo}`);
        }
        const ms = delayServidor(corpo) || Math.min(1000 * 2 ** tentativa, 40000);
        await espera(ms + 500); // folga p/ a janela de quota virar
      }
    },
  };
}

// ---- BACKEND: cliente OpenRouter (API OpenAI-compativel) — MESMA interface,
// mesma disciplina do clienteGemini. Traz os modelos :free do OpenRouter p/ os
// runners de linha de comando (antes so existia no index.html/browser).
function clienteOpenRouter(opcoes) {
  opcoes = opcoes || {};
  const modelo = opcoes.modelo || "nvidia/nemotron-3-super-120b-a12b:free";
  const temperatura = opcoes.temperatura != null ? opcoes.temperatura : 0;
  carregarEnv();
  const apiKey = opcoes.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY ausente (defina no .env desta pasta)");
  const url = opcoes.url || "https://openrouter.ai/api/v1/chat/completions";
  // Backoff SO p/ throttle de transporte (429/503) — mesma regra do Gemini:
  // o modelo nunca respondeu, entao repetir nao "esconde" decisao ruim. NUNCA
  // retry em resposta invalida (essa o Rei "passa" o turno).
  const maxTentativas = opcoes.maxTentativas != null ? opcoes.maxTentativas : 6;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  // OpenRouter sinaliza throttle via header Retry-After (segundos); as vezes um
  // retryDelay/retry_after no corpo do erro. Respeitamos o que vier (como o Gemini).
  function delayServidor(resp, corpo) {
    const h = resp && resp.headers && resp.headers.get && resp.headers.get("retry-after");
    if (h) { const s = parseFloat(h); if (isFinite(s)) return Math.ceil(s * 1000); }
    const m = /"retry(?:_after|Delay)"\s*:\s*"?(\d+(?:\.\d+)?)s?"?/.exec(corpo || "");
    return m ? Math.ceil(parseFloat(m[1]) * 1000) : null;
  }
  // PACING: piso entre chamadas. O free tier do OpenRouter tem janela PROPRIA
  // (cota diaria por conta + rate por minuto), diferente dos 5 req/min do Gemini
  // — por isso NAO herda o 13s do Gemini. Default folgado; suba via
  // opcoes.minIntervaloMs se tomar 429. 0 desliga.
  const minIntervaloMs = opcoes.minIntervaloMs != null ? opcoes.minIntervaloMs : 3000;
  let ultimoEnvio = 0;
  async function respeitarPiso() {
    const faltam = minIntervaloMs - (Date.now() - ultimoEnvio);
    if (faltam > 0) await espera(faltam);
    ultimoEnvio = Date.now();
  }
  return {
    nome: `openrouter:${modelo}`,
    ultimosTokens: null, // E3/1b — mesmo canal lateral dos outros clientes
    ultimoFinish: null,  // A1: finish_reason ("length" = truncou no teto de tokens)
    async gerar(prompt) {
      for (let tentativa = 1; ; tentativa++) {
        await respeitarPiso();
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
          body: JSON.stringify({
            model: modelo,
            messages: [{ role: "user", content: prompt }],
            temperature: temperatura,
            stream: false,
            reasoning: { enabled: true }, // thinking sempre-ligado
            // LOTE C, E1: teto explicito e IGUAL p/ os dois lados. Nao e p/ cortar o
            // raciocinio (32000 > max observado 27764), e p/ tornar o corte visivel.
            max_tokens: (opcoes.maxTokens != null ? opcoes.maxTokens : 32000),
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const u = data.usage;
          const det = (u && u.completion_tokens_details) || {}; // LOTE C, E2
          this.ultimosTokens = u ? { prompt: u.prompt_tokens || 0, resposta: u.completion_tokens || 0, raciocinio: det.reasoning_tokens || 0 } : null;
          const ch = (data.choices && data.choices[0]) || {};
          this.ultimoFinish = ch.finish_reason || null; // A1
          const msg = ch.message || {};
          // raciocinio em message.reasoning (texto) e/ou reasoning_details
          // (estruturado); content = resposta final (SO o JSON de ordens).
          let raciocinio = msg.reasoning || null;
          if (!raciocinio && Array.isArray(msg.reasoning_details))
            raciocinio = msg.reasoning_details.map((d) => (d && (d.text || d.summary)) || "").join("\n").trim() || null;
          return { texto: msg.content || "", raciocinio };
        }
        const corpo = await resp.text().catch(() => "");
        const recuperavel = resp.status === 429 || resp.status === 503;
        if (!recuperavel || tentativa >= maxTentativas) {
          throw new Error(`OpenRouter HTTP ${resp.status}: ${corpo}`);
        }
        const ms = delayServidor(resp, corpo) || Math.min(1000 * 2 ** tentativa, 40000);
        await espera(ms + 500); // folga p/ a janela de quota virar
      }
    },
  };
}

// criarCliente(id) — ponto unico p/ trocar qual modelo roda.
// id = "backend:modelo" (ex.: "ollama:qwen2.5:3b", "ollama:llama3.2:3b",
// "gemini:gemini-2.5-flash", "openrouter:nvidia/nemotron-3-super-120b-a12b:free").
// Split no PRIMEIRO ":" so: o backend e o
// prefixo, o RESTO e o nome do modelo (que tambem tem ":" — qwen2.5:3b).
// Sem o ":" o id inteiro vale como backend (cai no modelo default do cliente).
// Sem argumento = "ollama:qwen2.5:3b" (comportamento de hoje).
function criarCliente(id, opcoes) {
  id = id || "ollama:qwen2.5:3b";
  opcoes = opcoes || {};
  const i = id.indexOf(":");
  const backend = (i < 0 ? id : id.slice(0, i)).toLowerCase();
  const modelo = i < 0 ? "" : id.slice(i + 1).trim();
  // modelo do id tem prioridade; vazio => cliente usa o seu proprio default.
  const opc = modelo ? Object.assign({}, opcoes, { modelo }) : opcoes;
  if (backend === "gemini") return clienteGemini(opc);
  if (backend === "ollama") return clienteOllama(opc);
  if (backend === "openrouter") return clienteOpenRouter(opc);
  throw new Error(`backend desconhecido: "${backend}" (use "ollama", "gemini" ou "openrouter")`);
}

// criarReiIA(cliente) -> decisor ASSINCRONO reiIA(visao) -> Promise<ordem>.
// Assinatura da spec: reiIA(visao). Faz montarPrompt -> gerar -> parsearOrdem.
// (O loop usa decidirRei, que tambem diagnostica contra o estado p/ o eval.)
function criarReiIA(cliente) {
  return async function reiIA(visao) {
    const prompt = Engine.montarPrompt(visao);
    const { texto } = await cliente.gerar(prompt); // so a ordem interessa aqui
    return Engine.parsearOrdem(texto).ordem;
  };
}

// Decisao do Rei num turno + REGISTRO completo p/ o eval (o entregavel):
// prompt -> resposta crua -> ordem parseada -> aceito/rejeitado.
async function decidirRei(estado, dono, cliente, opcoesPrompt) {
  const visao = Engine.montarVisao(estado, dono);
  const prompt = Engine.montarPrompt(visao, opcoesPrompt); // H2: variante opcional
  let cru = "", raciocinio = null, erroRede = null;
  try { const r = await cliente.gerar(prompt); cru = r.texto; raciocinio = r.raciocinio; }
  catch (e) { erroRede = e.message; }
  const p = Engine.parsearOrdem(cru);
  const diag = Engine.diagnosticarOrdem(estado, dono, p.ordem);
  return {
    ordem: p.ordem,
    registro: {
      turno: estado.turno, dono, prompt, cru, raciocinio,
      erroRede,
      jsonValido: p.ok, erroParse: p.erro,
      normalizacoes: p.normalizacoes || [], // H3: cru -> canonico, p/ o log contar o desvio
      ordemParseada: p.ordem,
      ids: classificarIds(estado, p.ordem), // ancoragem: ids reais x inexistentes
      aceito: { construir: diag.aceitoConstruir, envios: diag.aceitoEnvios },
      rejeicoes: diag.rejeicoes,
      counter: avaliarCounter(estado, diag.aceitoEnvios), // ANTES de executar (alvo ainda neutra)
    },
  };
}

// ---- TURNO COMPOSTO (Fase 12 / H4): propor -> validar -> [revisar] --------
// Decisoes de design (13/07, registradas na sessao):
//   1. O validador ve APENAS regras + relatorio do turno + ordem proposta.
//      Sem papel de rei, sem historico, sem rejeicoes passadas (contexto
//      limpo — licao do Critico do Modulo 1).
//   2. Veto -> UMA revisao pelo propositor, com o motivo NO FIM (H2).
//      O que vier da revisao vai ao motor SEM segunda validacao.
//      O validador NUNCA corrige a ordem; so veta com motivo.
//   3. Motor continua sendo a rede final (ordem ilegal que escapar e
//      rejeitada como sempre). Veredito ilegivel -> tratado como OK.
function montarPromptValidador(visao, ordem) {
  const L = [];
  L.push("Voce e um VALIDADOR de ordens de um jogo de estrategia. Voce NAO e um jogador e NAO propoe jogadas.");
  L.push("Sua unica tarefa: conferir se a ORDEM PROPOSTA abaixo e LEGAL segundo o relatorio. Estrategia boa ou ruim NAO e problema seu.");
  L.push("");
  L.push(Engine.regrasCombateTexto(visao.config));
  L.push("");
  L.push(Engine.regrasEconomiaTexto(visao.config));
  L.push("");
  // O relatorio do motor fala com o leitor como rei ("Voce e o Rei X") —
  // vazamento de papel que confunde validador 3B. Neutraliza SO AQUI
  // (o relatorioTexto do motor alimenta o prompt v2 do benchmark e fica
  // congelado; uma variavel por vez).
  L.push(Engine.relatorioTexto(visao, { semRejeicoes: true, semRede: true })
    .replace(/Voce e o Rei (\w+)\./, "Relatorio do Rei $1 (o jogador cuja ordem voce confere)."));
  L.push("");
  L.push("ORDEM PROPOSTA (confira item por item):");
  L.push(JSON.stringify(ordem));
  L.push("");
  L.push("Confira APENAS legalidade:");
  L.push("- construir: a aldeiaId esta na secao SUAS ALDEIAS? os recursos atuais cobrem o custo do tipo?");
  L.push("- envios: a origemId esta em SUAS ALDEIAS? a origem TEM as tropas pedidas (tipo E quantidade)? o destinoId existe no relatorio?");
  L.push("");
  L.push("Responda na PRIMEIRA linha exatamente 'VALIDACAO: OK' ou 'VALIDACAO: VETO'.");
  L.push("Se VETO, escreva o motivo em UMA linha curta na segunda linha. Nao escreva mais nada.");
  return L.join("\n");
}

async function decidirReiComposto(estado, dono, cliente, opcoesPrompt, composto) {
  const validador = (composto && composto.validador) || cliente;
  const visao = Engine.montarVisao(estado, dono);
  const prompt = Engine.montarPrompt(visao, opcoesPrompt);

  let cru = "", raciocinio = null, erroRede = null;
  try { const r = await cliente.gerar(prompt); cru = r.texto; raciocinio = r.raciocinio; }
  catch (e) { erroRede = e.message; }
  let p = Engine.parsearOrdem(cru);

  const info = { chamadas: 1, veredito: "-", vetou: false, motivo: "", cruProposta: "", cruValidador: "", raciocinioValidador: null };

  // So valida proposta parseavel COM conteudo: JSON invalido ou ordem vazia
  // nao tem o que conferir — segue direto (o motor e a rede final).
  const temConteudo = p.ok &&
    (((p.ordem.construir || []).length + (p.ordem.envios || []).length) > 0);
  if (!erroRede && temConteudo) {
    let cruVal = "";
    // O raciocinio do validador NAO e descartado: vai p/ info.raciocinioValidador
    // (auditavel — por que ele vetou/aprovou), separado do texto do veredito.
    try { const rv = await validador.gerar(montarPromptValidador(visao, p.ordem)); cruVal = rv.texto; info.raciocinioValidador = rv.raciocinio; info.chamadas++; }
    catch (e) { cruVal = ""; } // validador fora do ar -> segue sem validar
    info.cruValidador = cruVal;
    const linha1 = (cruVal || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
    const m = /^VALIDACAO\s*:\s*(OK|VETO)/i.exec(linha1);
    info.veredito = m ? m[1].toUpperCase() : "ilegivel"; // ilegivel -> OK (default seguro)

    if (info.veredito === "VETO") {
      info.vetou = true;
      const resto = (cruVal || "").split("\n").map((s) => s.trim()).filter(Boolean).slice(1).join(" ");
      info.motivo = (resto || linha1.replace(/^VALIDACAO\s*:\s*VETO\s*[-—:.]*\s*/i, "")).slice(0, 300);
      info.cruProposta = cru;
      // UMA revisao, motivo no FIM do prompt (H2: modelos pequenos pesam o rabo).
      const promptRev = prompt + "\n\n=== REVISAO (veto do validador interno) ===\n" +
        "Sua ordem foi VETADA antes de chegar ao jogo.\n" +
        "ORDEM VETADA: " + JSON.stringify(p.ordem) + "\n" +
        "MOTIVO DO VETO: " + (info.motivo || "nao informado") + "\n" +
        "Corrija o problema e responda novamente APENAS com o JSON da ordem, no mesmo formato.";
      // revisao e a decisao FINAL: seu raciocinio sobrescreve o da proposta.
      try { const rr = await cliente.gerar(promptRev); cru = rr.texto; raciocinio = rr.raciocinio; info.chamadas++; }
      catch (e) { erroRede = e.message; }
      p = Engine.parsearOrdem(cru);
    }
  }

  const diag = Engine.diagnosticarOrdem(estado, dono, p.ordem);
  return {
    ordem: p.ordem,
    registro: {
      turno: estado.turno, dono, prompt, cru, raciocinio,
      erroRede,
      jsonValido: p.ok, erroParse: p.erro,
      normalizacoes: p.normalizacoes || [],
      ordemParseada: p.ordem,
      ids: classificarIds(estado, p.ordem),
      aceito: { construir: diag.aceitoConstruir, envios: diag.aceitoEnvios },
      rejeicoes: diag.rejeicoes,
      counter: avaliarCounter(estado, diag.aceitoEnvios),
      composto: info, // metricas do ciclo interno (vetos, chamadas, veredito)
    },
  };
}

// INSTRUMENTACAO DA ANCORAGEM (achado): o Rei emite ids que EXISTEM na visao
// dele, ou copia ids do exemplo/inexistentes? Coleta todos os ids citados na
// ordem (aldeiaId, origemId, destinoId) e separa os que nao existem no estado.
function classificarIds(estado, ordem) {
  const ids = [];
  ((ordem && ordem.construir) || []).forEach((c) => { if (c && c.aldeiaId != null) ids.push(c.aldeiaId); });
  ((ordem && ordem.envios) || []).forEach((e) => {
    if (!e) return;
    if (e.origemId != null) ids.push(e.origemId);
    if (e.destinoId != null) ids.push(e.destinoId);
  });
  const inexistentes = ids.filter((id) => Engine.aldeiaPorId(estado, id) == null);
  return { emitidos: ids, inexistentes, todosExistem: ids.length > 0 && inexistentes.length === 0 };
}

// INSTRUMENTACAO DO ACHADO (spec): o Rei le o tipo da neutra e manda o
// COUNTER do triangulo? Para cada envio ACEITO contra uma NEUTRA tipada,
// compara o tipo dominante enviado com o counter ideal do tipo da neutra.
// triangulo[X] = tipo que X vence -> counter de N = o T com triangulo[T] === N.
function avaliarCounter(estado, enviosAceitos) {
  const tri = estado.config.triangulo;
  const out = [];
  for (const e of enviosAceitos) {
    const alvo = e.alvo;
    if (!alvo || alvo.dono !== null || !alvo.tipo) continue; // so neutras tipadas
    const dom = Engine.tipoDominante(estado, e.tropas);
    const counterIdeal = Object.keys(tri).find((t) => tri[t] === alvo.tipo) || null;
    out.push({
      destinoId: alvo.id, tipoNeutra: alvo.tipo,
      tipoEnviado: dom, counterIdeal, ehCounter: dom === counterIdeal,
    });
  }
  return out;
}

// ---- LOOP: partida Rei(LLM) vs jogadorBurro -----------------------------
// Espelha rodarTurno do motor (tick -> decisao A,B -> vitoria), mas com a
// decisao do Rei ASSINCRONA. opcoes: { config, cliente, ladoRei, maxTurnos,
// onTurno(registro, estado) }. Devolve { vencedor, turnos, registros, estado }.
async function rodarPartidaRei(opcoes) {
  opcoes = opcoes || {};
  const config = opcoes.config || Engine.CONFIG;
  const cliente = opcoes.cliente || clienteOllama(opcoes);
  const ladoRei = opcoes.ladoRei || "B"; // fronteira da spec: A=burro, B=rei
  const maxTurnos = opcoes.maxTurnos || config.max_turnos || 500;
  const onTurno = opcoes.onTurno || function () {};
  const opcoesPrompt = opcoes.opcoesPrompt || undefined; // H2: { rejeicaoNoFim: true }
  // ABORT DE INFRA: N erros de rede SEGUIDOS -> partida abortada (nao vira
  // derrota falsa por turnos vazios). Zera a cada turno que o modelo responde.
  const maxFalhasInfra = opcoes.maxFalhasInfra != null ? opcoes.maxFalhasInfra : 5;
  let falhasInfraSeguidas = 0, abortadoInfra = null;

  const estado = Engine.criarEstadoInicial(config);
  const registros = [];
  let vencedor = null;

  while (estado.turno < maxTurnos) {
    Engine.tick(estado);
    for (const dono of ["A", "B"]) {
      if (!Engine.aldeiasDe(estado, dono).length) continue; // morto nao decide
      if (dono === ladoRei) {
        const { ordem, registro } = opcoes.composto
          ? await decidirReiComposto(estado, dono, cliente, opcoesPrompt, opcoes.composto)
          : await decidirRei(estado, dono, cliente, opcoesPrompt);
        // CLAMP (afford do motor): executa a ordem AJUSTADA, mas o registro
        // cru (rejeicoes da proposta original) fica intacto — a reincidencia
        // segue medida sobre o que o modelo PEDIU, comparavel 1:1 c/ baseline.
        let ordemExec = ordem;
        if (opcoes.clamp) {
          const c = Engine.clampearEnvios(estado, dono, ordem);
          const diagReal = Engine.diagnosticarOrdem(estado, dono, c.ordem);
          registro.clamp = {
            avisos: c.avisos,
            aceito: { construir: diagReal.aceitoConstruir, envios: diagReal.aceitoEnvios },
            rejeicoes: diagReal.rejeicoes,
          };
          ordemExec = c.ordem;
        }
        Engine.executarOrdem(estado, dono, ordemExec);
        if (opcoes.clamp) {
          if (!estado.avisosAnteriores) estado.avisosAnteriores = {};
          estado.avisosAnteriores[dono] = registro.clamp.avisos; // canal proprio, reset por turno
        }
        registros.push(registro);
        onTurno(registro, estado);
        // contador de infra: erro de rede seguido -> aborta; sucesso zera.
        if (registro.erroRede) {
          falhasInfraSeguidas++;
          if (falhasInfraSeguidas >= maxFalhasInfra) {
            abortadoInfra = { turno: estado.turno, falhasSeguidas: falhasInfraSeguidas };
            console.error(`\n[ABORT-INFRA] ${falhasInfraSeguidas} erros de rede seguidos ate o turno ${estado.turno} -> partida abortada (nao contabilizada como derrota).`);
            break; // sai do for(dono)
          }
        } else {
          falhasInfraSeguidas = 0;
        }
      } else {
        Engine.executarOrdem(estado, dono, Engine.jogadorBurro(Engine.montarVisao(estado, dono)));
      }
    }
    if (abortadoInfra) break; // sai do while
    vencedor = Engine.checarVitoria(estado);
    if (vencedor) break;
  }

  return {
    vencedor: abortadoInfra ? "abortada-infra" : (vencedor || "limite"),
    motivo: abortadoInfra
      ? `abortada-infra (${abortadoInfra.falhasSeguidas} erros de rede seguidos @turno ${abortadoInfra.turno})`
      : (vencedor ? (vencedor === "empate" ? "empate" : "eliminacao") : "limite"),
    abortadoInfra, // null se a partida terminou normalmente
    turnos: estado.turno,
    ladoRei,
    registros,
    estado,
    cliente: cliente.nome,
  };
}

module.exports = { clienteOllama, clienteGemini, clienteOpenRouter, criarCliente, carregarEnv, criarReiIA, decidirRei, decidirReiComposto, montarPromptValidador, avaliarCounter, rodarPartidaRei };
