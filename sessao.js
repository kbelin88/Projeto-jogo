// sessao.js - O REI JOGA N TURNOS SEGUIDOS NA MESMA CONVERSA.
// (29/09/2026, SPEC_TESTE_SESSAO_0929)
//
// Hoje cada turno e uma chamada nova: o modelo acorda sem memoria, com o prompt
// inteiro (P4) e um bilhete de 600 caracteres. Aqui a conversa continua durante
// N turnos - as respostas dele ficam la em cima e cada turno chega como uma
// mensagem nova, em formato compacto - e no fim volta a mensagem 1 mais uma
// memoria que ELE escreveu no ultimo turno (campo "memory", sem chamada extra).
//
// O que esta peca NAO faz, de proposito:
//   - nao repete a resposta (um JSON invalido, vazio ou cortado passa o turno E
//     sai do contexto: o Rei nao chegou a "jogar" aquele turno);
//   - nao manda o raciocinio de volta, nem o "statement" (so tela);
//   - nao corrige formato (a correcao gastaria um pedido: o Gemini gratis tem 20);
//   - nao decide nada pelo Rei: a memoria e texto dele, e o que ele nao escreve
//     esquece-se.
//
// O `decidirReiSessao` devolve o MESMO {ordem, registro} do `decidirRei`, mais um
// bloco `registro.sessao`, para o runner, o log e o replay serem os de sempre.
"use strict";
const Engine = require("./engine.js");

// tokens por caracter, calibrado no turno 1 das P1-P3 (3169 tokens reais para
// 8002 caracteres). So serve ao cliente falso e as estimativas de "sombra".
const TOK_POR_CHAR = 0.396;
const estTok = (chars) => Math.round(chars * TOK_POR_CHAR);

function criarSessao(opc) {
  return { N: (opc && opc.N) || 4, numero: 0, turnosNaSessao: 0, sistema: null, msgs: [], memoria: null, memorias: [] };
}

// motivo pelo qual a resposta nao conta como turno jogado (ou null se conta)
function motivoInvalido(cliente, erroRede, cru, p) {
  if (erroRede) return "erro de rede";
  if (!String(cru || "").trim()) return "resposta vazia";
  if (cliente.ultimoFinish === "length") return "cortada no teto";
  if (!p.ok) return "JSON invalido";
  return null;
}

async function decidirReiSessao(estado, dono, sessao, cliente, opcoes) {
  opcoes = opcoes || {};
  const Rei = require("./rei.js"); // classificarIds/avaliarCounter (carrega aqui: o rei.js pode carregar o clienteFalso deste ficheiro)
  const log = opcoes.log || function () {};
  const visao = Engine.montarVisao(estado, dono);
  const N = sessao.N;

  const inicio = sessao.turnosNaSessao === 0;
  if (inicio) {
    sessao.numero++;
    sessao.sistema = Engine.montarPromptSessao(visao, { N });
    sessao.msgs = [];
    log({ tipo: "sessao_inicio", lado: dono, sessao: sessao.numero, turno: estado.turno,
      system: sessao.sistema, memoria: sessao.memoria });
  }
  // no ultimo turno da PARTIDA nao se pede memoria: ninguem a leria (gastaria saida a toa)
  const ultimo = sessao.turnosNaSessao === N - 1 && !(opcoes.maxTurnos && estado.turno >= opcoes.maxTurnos);
  const user = Engine.montarMensagemTurno(visao, {
    memoria: inicio ? sessao.memoria : null, inexplorado: inicio, ultimoDaSessao: ultimo,
  });
  const envio = { system: sessao.sistema, mensagens: sessao.msgs.concat([{ role: "user", content: user }]) };
  const ctxChars = sessao.sistema.length + envio.mensagens.reduce((s, m) => s + m.content.length, 0);
  // CONTRAFACTUAL: o prompt de "um turno por vez" para o MESMO estado. Nao e enviado.
  const sombraChars = Engine.montarPrompt(visao, { rejeicaoNoFim: true }).length;

  if (typeof cliente.preparar === "function") cliente.preparar({ estado, dono, visao, sessao, ultimo, inicio }); // so o falso
  let cru = "", raciocinio = null, erroRede = null;
  try { const r = await cliente.gerar(envio); cru = r.texto; raciocinio = r.raciocinio; }
  catch (e) { erroRede = e.message; }
  const p = Engine.parsearOrdem(cru);
  const motivo = motivoInvalido(cliente, erroRede, cru, p);

  let turnoNaSessao = sessao.turnosNaSessao + 1;
  if (!motivo) {
    // o historico guarda a resposta SEM o statement e SEM a memoria
    let guardada = null;
    try { guardada = JSON.parse(p.bloco); } catch (e) { guardada = null; }
    if (guardada) for (const k of ["statement", "depoimento", "memory", "memoria"]) delete guardada[k];
    sessao.msgs.push({ role: "user", content: user },
      { role: "assistant", content: guardada ? JSON.stringify(guardada) : String(cru) });
    sessao.turnosNaSessao++;
    if (ultimo) {
      sessao.memoria = { turno: estado.turno, texto: p.memoria || null };
      sessao.memorias.push({ sessao: sessao.numero, turno: estado.turno, texto: p.memoria || null });
      sessao.turnosNaSessao = 0; // a proxima chamada abre a sessao seguinte
    }
  } else {
    turnoNaSessao = null; // este turno nao entrou no contexto; a sessao continua onde estava
  }

  const diag = Engine.diagnosticarOrdem(estado, dono, p.ordem);
  const tk = cliente.ultimosTokens || null;
  log({ tipo: "turno", lado: dono, turno: estado.turno, sessao: sessao.numero, turnoNaSessao, ultimo,
    user, resposta: cru, raciocinio, usage: erroRede ? null : tk, ctxChars, sombraChars,
    foraDoContexto: motivo, memoria: p.memoria || null });
  return {
    ordem: p.ordem,
    registro: {
      turno: estado.turno, dono, prompt: user, cru, raciocinio, erroRede,
      jsonValido: p.ok, erroParse: p.erro, correcaoFormato: false,
      normalizacoes: p.normalizacoes || [],
      ordemParseada: p.ordem,
      plano: p.plano || null, depoimento: p.depoimento || null,
      ids: Rei.classificarIds(estado, p.ordem),
      aceito: { construir: diag.aceitoConstruir, envios: diag.aceitoEnvios },
      rejeicoes: diag.rejeicoes,
      counter: Rei.avaliarCounter(estado, diag.aceitoEnvios),
      sessao: { numero: sessao.numero, turnoNaSessao, inicio, ultimo, N,
        memoria: p.memoria || null, foraDoContexto: motivo,
        ctxChars, userChars: user.length, sistemaChars: sessao.sistema.length, sombraChars },
    },
  };
}

// ---- CLIENTE FALSO (ensaio a seco) -------------------------------------------
// Responde pelo jogador-base sobre o MESMO estado que o Rei veria, no protocolo
// em ingles, e conta tokens e cache como o provedor contaria (estimativa por
// caracteres). Nao toca a rede. Serve para correr a partida inteira, medir os
// tamanhos REAIS do compacto e afinar o gabarito ANTES de gastar um centimo.
//   "falso:sonnet"  -> precos do Sonnet 5.5 (US$2/US$10; cache le 0,20 e escreve 2,50 por M)
//   "falso:gemini"  -> gratis
const TIPO_EN = { lanceiro: "spearman", arqueiro: "archer", cavaleiro: "knight" };
const PERFIS = {
  sonnet: { racTok: 4500, in: 2.0, out: 10.0, lido: 0.2, escrito: 2.5, cache: true },
  // o cache que nao chega: serve para provar o corte automatico do runner
  sonnetsemcache: { racTok: 4500, in: 2.0, out: 10.0, lido: 0.2, escrito: 2.5, cache: false, exige: true },
  gemini: { racTok: 2500, in: 0, out: 0, lido: 0, escrito: 0, cache: false },
};
function clienteFalso(opcoes) {
  const perfil = (opcoes && opcoes.modelo) || "sonnet";
  const cfg = PERFIS[perfil] || PERFIS.sonnet;
  let ctx = null;
  let ultimoPromptTok = 0, jaViuSistema = false;
  return {
    nome: "falso:" + perfil,
    exigeCache: !!(cfg.cache || cfg.exige),
    ultimosTokens: null, ultimoFinish: null, ultimosThrottles: 0,
    preparar(info) { ctx = info; },
    async gerar(prompt) {
      if (!ctx) throw new Error("clienteFalso: sem estado (chame preparar antes)");
      const ordem = Engine.jogadorBurro(ctx.visao);
      const build = [];
      for (const c of ordem.construir || []) {
        const ant = build.find((b) => b.villageId === c.aldeiaId && b.type === TIPO_EN[c.tipo]);
        if (ant) ant.quantity++; else build.push({ villageId: c.aldeiaId, type: TIPO_EN[c.tipo], quantity: 1 });
      }
      const movements = (ordem.envios || []).map((e) => ({ fromId: e.origemId, toId: e.destinoId,
        troops: { spearman: e.tropas.lanceiro || 0, archer: e.tropas.arqueiro || 0, knight: e.tropas.cavaleiro || 0 } }));
      const resp = { build, movements,
        plan: "Ensaio a seco: as ordens vem do jogador-base. Nota fixa de 200 caracteres para medir o tamanho da resposta guardada no historico da sessao.",
        statement: "Ensaio a seco. Texto so para a tela: nao volta ao Rei." };
      if (ctx.ultimo) resp.memory = ("H1 (T" + ctx.estado.turno + ", ensaio): hipoteses e licoes fingidas para medir o tamanho da memoria. ").repeat(9).slice(0, 900);
      const texto = JSON.stringify(resp);

      const sessao = prompt !== null && typeof prompt === "object";
      const chars = sessao ? prompt.system.length + prompt.mensagens.reduce((s, m) => s + m.content.length, 0) : String(prompt).length;
      const promptTok = estTok(chars);
      let lido = 0;
      if (cfg.cache && sessao) {
        if (prompt.mensagens.length === 1) lido = jaViuSistema ? estTok(prompt.system.length) : 0; // sessao nova: so o prefixo estavel
        else lido = Math.min(ultimoPromptTok, promptTok);                                          // sessao a meio: tudo o que ja foi enviado
      }
      jaViuSistema = true; ultimoPromptTok = promptTok;
      const escrito = cfg.cache && sessao ? promptTok - lido : 0;
      const visivelTok = estTok(texto.length);
      const resposta = cfg.racTok + visivelTok;
      const custo = ((promptTok - lido - escrito) * cfg.in + lido * cfg.lido + escrito * cfg.escrito + resposta * cfg.out) / 1e6;
      this.ultimosTokens = { prompt: promptTok, resposta, raciocinio: cfg.racTok, ms: 1,
        cacheLido: lido, cacheEscrito: escrito, custo };
      this.ultimoFinish = "stop";
      return { texto, raciocinio: "(ensaio a seco: sem raciocinio)" };
    },
  };
}

module.exports = { criarSessao, decidirReiSessao, clienteFalso, estTok, TOK_POR_CHAR, motivoInvalido };
