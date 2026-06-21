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

// ---- BACKEND: cliente Ollama (trocavel por um cliente de API depois) ----
function clienteOllama(opcoes) {
  opcoes = opcoes || {};
  const url = opcoes.url || "http://localhost:11434/api/generate";
  const modelo = opcoes.modelo || "qwen2.5:3b";
  const temperatura = opcoes.temperatura != null ? opcoes.temperatura : 0;
  return {
    nome: `ollama:${modelo}`,
    async gerar(prompt) {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, prompt, stream: false, options: { temperature: temperatura } }),
      });
      if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
      const data = await resp.json();
      return data.response || "";
    },
  };
}

// criarReiIA(cliente) -> decisor ASSINCRONO reiIA(visao) -> Promise<ordem>.
// Assinatura da spec: reiIA(visao). Faz montarPrompt -> gerar -> parsearOrdem.
// (O loop usa decidirRei, que tambem diagnostica contra o estado p/ o eval.)
function criarReiIA(cliente) {
  return async function reiIA(visao) {
    const prompt = Engine.montarPrompt(visao);
    const cru = await cliente.gerar(prompt);
    return Engine.parsearOrdem(cru).ordem;
  };
}

// Decisao do Rei num turno + REGISTRO completo p/ o eval (o entregavel):
// prompt -> resposta crua -> ordem parseada -> aceito/rejeitado.
async function decidirRei(estado, dono, cliente) {
  const visao = Engine.montarVisao(estado, dono);
  const prompt = Engine.montarPrompt(visao);
  let cru = "", erroRede = null;
  try { cru = await cliente.gerar(prompt); }
  catch (e) { erroRede = e.message; }
  const p = Engine.parsearOrdem(cru);
  const diag = Engine.diagnosticarOrdem(estado, dono, p.ordem);
  return {
    ordem: p.ordem,
    registro: {
      turno: estado.turno, dono, prompt, cru,
      erroRede,
      jsonValido: p.ok, erroParse: p.erro,
      ordemParseada: p.ordem,
      ids: classificarIds(estado, p.ordem), // ancoragem: ids reais x inexistentes
      aceito: { construir: diag.aceitoConstruir, envios: diag.aceitoEnvios },
      rejeicoes: diag.rejeicoes,
      counter: avaliarCounter(estado, diag.aceitoEnvios), // ANTES de executar (alvo ainda neutra)
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

  const estado = Engine.criarEstadoInicial(config);
  const registros = [];
  let vencedor = null;

  while (estado.turno < maxTurnos) {
    Engine.tick(estado);
    for (const dono of ["A", "B"]) {
      if (!Engine.aldeiasDe(estado, dono).length) continue; // morto nao decide
      if (dono === ladoRei) {
        const { ordem, registro } = await decidirRei(estado, dono, cliente);
        Engine.executarOrdem(estado, dono, ordem);
        registros.push(registro);
        onTurno(registro, estado);
      } else {
        Engine.executarOrdem(estado, dono, Engine.jogadorBurro(Engine.montarVisao(estado, dono)));
      }
    }
    vencedor = Engine.checarVitoria(estado);
    if (vencedor) break;
  }

  return {
    vencedor: vencedor || "limite",
    motivo: vencedor ? (vencedor === "empate" ? "empate" : "eliminacao") : "limite",
    turnos: estado.turno,
    ladoRei,
    registros,
    estado,
    cliente: cliente.nome,
  };
}

module.exports = { clienteOllama, criarReiIA, decidirRei, avaliarCounter, rodarPartidaRei };
