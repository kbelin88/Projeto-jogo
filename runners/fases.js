// ============================================================
//  fases.js — PROMPTS DE DUAS FASES (experimento decomposicao)
// ------------------------------------------------------------
//  Builders PUROS (sem rede) para o experimento exp-duas-fases.
//  Duas chamadas por turno: CONSTRUIR (fase 1) e ENVIAR (fase 2).
//  Cada fase e um prompt proprio, com schema de UMA so chave.
//
//  As duas fases sao INDEPENDENTES: a fase 2 nao ve o que a fase 1
//  decidiu (decisao de design do brief — sem encadeamento). Ambas
//  leem o MESMO estado do turno (a tropa construida so fica pronta
//  no turno seguinte, entao o envio nao depende dela).
//
//  BRACOS (so a fase de CONSTRUCAO varia; ENVIO e identica nos tres):
//    F1 INTEGRAL  — relatorio completo (combate full, neutras lista,
//                   inimigo, transito) — mesmo contexto do P2 monolitico.
//    F2 RESUMIDO  — triangulo (2 linhas), neutras resumidas por tipo,
//                   sem inimigo, sem transito.
//    F3 MINIMO    — triangulo (2 linhas), SEM neutras.
//
//  Reutiliza os helpers PUROS do engine (compTexto, eventoTexto,
//  regrasCombateTexto, regrasEconomiaTexto). A visao DEVE ser montada
//  com {minimos:true} (a fase de envio mostra a coluna "para tomar").
// ============================================================
"use strict";
const Engine = require("../engine.js");

const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];

const IDENT = [
  'Voce e o Rei. As aldeias listadas em "SUAS ALDEIAS" pertencem a voce.',
  "Seu objetivo e conquistar a CAPITAL inimiga. A capital tem o maior bonus de defesa do jogo: e o alvo mais caro do mapa, e so cai com um exercito grande.",
  "Conquiste aldeias neutras primeiro: cada aldeia produz recursos por turno, e sao os recursos que constroem esse exercito.",
].join("\n");

// turnos de marcha da MINHA aldeia mais proxima ate (x,y) — igual ao engine
function fazMarcha(visao) {
  const cfg = visao.config;
  const passoRef = cfg.velocidade_passo[cfg.relatorio.velocidade_referencia];
  return (x, y) => {
    let best = Infinity;
    for (const m of visao.minhas) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < best) best = d;
    }
    return best === Infinity ? "?" : Math.max(1, Math.ceil(best / passoRef));
  };
}

// sufixo "para tomar" (coluna P2) — identico ao minTexto do engine
function minTexto(a) {
  if (!a.minimos) return "";
  if (a.capital) return " | CAPITAL: maior bonus de defesa do jogo";
  const m = a.minimos, p = [];
  if (m.lanceiro) p.push(`${m.lanceiro} lanc`);
  if (m.arqueiro) p.push(`${m.arqueiro} arq`);
  if (m.cavaleiro) p.push(`${m.cavaleiro} cav`);
  return p.length ? ` | para tomar: ${p.join(" ou ")}` : "";
}

// TRIANGULO SO (2 linhas) — recorte do regrasCombateTexto p/ F2/F3
function trianguloSo(cfg) {
  const L = [];
  L.push("=== TRIANGULO (counters) ===");
  L.push(`Triangulo de counters (BONUS, nao vitoria automatica): ${TIPOS.map((t) => `${t} tem bonus contra ${cfg.triangulo[t]}`).join("; ")}.`);
  L.push(`Ter o counter multiplica suas tropas por ${cfg.bonus_forca_triangulo} — mas o NUMERO de tropas continua a decidir.`);
  return L.join("\n");
}

// SUAS ALDEIAS com recursos + tropas + construindo (fase CONSTRUCAO)
function aldeiasRecTropas(visao) {
  const L = [`=== SUAS ALDEIAS (${visao.minhas.length}) ===`];
  for (const a of visao.minhas) {
    L.push(`[${a.id}] | recursos: ${a.recursos.madeira} madeira, ${a.recursos.ferro} ferro`);
    L.push(`       tropas em casa: ${a.tropas.lanceiro} lanceiros, ${a.tropas.arqueiro} arqueiros, ${a.tropas.cavaleiro} cavaleiros`);
    if (a.construindo.length) {
      const cont = {}; let maxT = 0;
      for (const c of a.construindo) { cont[c.tipo] = (cont[c.tipo] || 0) + 1; maxT = Math.max(maxT, c.turnosRestantes); }
      const desc = TIPOS.filter((t) => cont[t]).map((t) => `${cont[t]} ${t}`).join(", ");
      L.push(`       construindo: ${desc} (pronto em ${maxT} turno(s))`);
    } else {
      L.push(`       construindo: nada`);
    }
  }
  return L.join("\n");
}

// SUAS ALDEIAS so com tropas em casa (fase ENVIO — recursos nao servem p/ enviar)
function aldeiasTropasSo(visao) {
  const L = [`=== SUAS ALDEIAS (${visao.minhas.length}) — tropas em casa (o que pode ENVIAR) ===`];
  for (const a of visao.minhas) {
    L.push(`[${a.id}] tropas em casa: ${a.tropas.lanceiro} lanceiros, ${a.tropas.arqueiro} arqueiros, ${a.tropas.cavaleiro} cavaleiros`);
  }
  return L.join("\n");
}

// NEUTRAS — lista completa (ordenada por marcha). comMin liga a coluna "para tomar".
function neutrasLista(visao, comMin) {
  const marcha = fazMarcha(visao);
  const neutras = visao.alvos.filter((a) => a.dono === null)
    .map((a) => ({ a, t: marcha(a.x, a.y) }))
    .sort((p, q) => p.t - q.t || p.a.id - q.a.id);
  const L = [`=== ALDEIAS NEUTRAS (${neutras.length}) - ordenadas por distancia da sua mais proxima ===`];
  for (const { a, t } of neutras) {
    L.push(`[${a.id}] ${Engine.compTexto(a.tropas)} | ${t} turnos de marcha${comMin ? minTexto(a) : ""}`);
  }
  return L.join("\n");
}

// NEUTRAS — contagem por tipo (F2): um so numero por tipo, sem ids/distancias
function neutrasContagem(visao) {
  const neutras = visao.alvos.filter((a) => a.dono === null);
  const cont = { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
  for (const a of neutras) if (cont[a.tipo] != null) cont[a.tipo]++;
  return `=== ALDEIAS NEUTRAS: ${neutras.length} no total — ${cont.lanceiro} de lanceiro, ${cont.arqueiro} de arqueiro, ${cont.cavaleiro} de cavaleiro ===`;
}

// INIMIGO — lista (ordenada por marcha). comMin liga a coluna "para tomar".
function inimigoLista(visao, comMin) {
  const me = visao.dono, inimigo = me === "A" ? "B" : "A";
  const marcha = fazMarcha(visao);
  const ini = visao.alvos.filter((a) => a.dono === inimigo)
    .map((a) => ({ a, t: marcha(a.x, a.y) }))
    .sort((p, q) => p.t - q.t || p.a.id - q.a.id);
  const L = [`=== INIMIGO (Rei ${inimigo}) - ${ini.length} aldeia(s) ===`];
  if (!ini.length) L.push("(nenhuma aldeia inimiga)");
  for (const { a, t } of ini) {
    L.push(`[${a.id}] ${Engine.compTexto(a.tropas)} | ${t} turnos de marcha${comMin ? minTexto(a) : ""}`);
  }
  return L.join("\n");
}

// EXERCITOS EM TRANSITO — igual ao engine
function transitoBloco(visao) {
  const me = visao.dono;
  const classifica = (dono) => (dono === me ? "SUA" : dono === null ? "NEUTRA" : "INIMIGA");
  const L = ["=== EXERCITOS EM TRANSITO ==="];
  const meus = visao.transito.filter((m) => m.dono === me);
  const dele = visao.transito.filter((m) => m.dono !== me);
  const linhaMov = (m) => `- ${Engine.compTexto(m.tropas)}: aldeia [${m.origemId}] -> aldeia [${m.destinoId}] (${classifica(m.destinoDono)}), chega em ${m.turnosRestantes} turnos`;
  L.push("SEUS:");
  if (!meus.length) L.push("- nenhum"); else meus.forEach((m) => L.push(linhaMov(m)));
  L.push("INIMIGOS:");
  if (!dele.length) L.push("- nenhum"); else dele.forEach((m) => L.push(linhaMov(m)));
  return L.join("\n");
}

// O QUE ACONTECEU NO ULTIMO TURNO — igual ao engine
function eventosBloco(visao) {
  const me = visao.dono;
  const L = ["=== O QUE ACONTECEU NO ULTIMO TURNO ==="];
  if (!visao.eventos.length) L.push("- nada de relevante");
  else visao.eventos.forEach((ev) => L.push("- " + Engine.eventoTexto(ev, me)));
  return L.join("\n");
}

// REJEICOES ANTERIORES, SEPARADAS por fase. O motor guarda todas as
// rejeicoes da ordem MERGE (construir + envio) em estado.rejeicoesAnteriores;
// aqui filtramos pelo prefixo p/ dar a cada fase so o seu canal de correcao.
function rejeicoesBloco(visao, fase) {
  const all = visao.rejeicoesAnteriores || [];
  const casa = fase === "construir" ? /^construir/ : /^envio/;
  const rej = all.filter((r) => casa.test(r));
  if (!rej.length) return "";
  const L = ["=== ATENCAO: SUAS ORDENS RECUSADAS NO TURNO ANTERIOR ==="];
  L.push("As ordens abaixo NAO foram executadas (foram recusadas pelo motor). Corrija estes erros nesta jogada e NAO repita a mesma ordem:");
  for (const r of rej) L.push(`- ${r}`);
  return L.join("\n");
}

// EXEMPLO ancorado — fase CONSTRUCAO (so a chave "construir")
function exemploConstruir(visao) {
  const a0 = (visao.minhas || [])[0];
  const origem = a0 ? a0.id : 0;
  return ["{", '  "construir": [', `    {"aldeiaId": ${origem}, "tipo": "lanceiro"}`, "  ]", "}"].join("\n");
}

// EXEMPLO ancorado — fase ENVIO (so a chave "envios"). Mesma logica de
// quantidades do exemploAncorado do engine: metade das tropas reais da 1a
// aldeia (copia-cola sai valido e ainda sobra guarnicao).
function exemploEnvio(visao) {
  const minhas = visao.minhas || [], alvos = visao.alvos || [];
  const a0 = minhas.length ? minhas[0] : null;
  const origem = a0 ? a0.id : 0;
  const neutras = alvos.filter((a) => a.dono === null);
  const pool = neutras.length ? neutras : alvos;
  const alvoAtk = pool.length ? pool[0].id : origem;
  const tropas = (l, a, c) => `{"lanceiro": ${l}, "arqueiro": ${a}, "cavaleiro": ${c}}`;
  const tr = a0 ? a0.tropas : { lanceiro: 0, arqueiro: 0, cavaleiro: 0 };
  let hl = Math.floor((tr.lanceiro || 0) / 2), ha = Math.floor((tr.arqueiro || 0) / 2), hc = Math.floor((tr.cavaleiro || 0) / 2);
  if (hl + ha + hc === 0) {
    if ((tr.lanceiro || 0) > 0) hl = 1; else if ((tr.arqueiro || 0) > 0) ha = 1; else if ((tr.cavaleiro || 0) > 0) hc = 1;
  }
  const envios = [`    {"origemId": ${origem}, "destinoId": ${alvoAtk}, "tropas": ${tropas(hl, ha, hc)}}`];
  const seg = pool.length >= 2 ? pool[1].id : (minhas.length >= 2 ? minhas[1].id : null);
  if (seg != null && hl + ha + hc > 0) {
    envios.push(`    {"origemId": ${origem}, "destinoId": ${seg}, "tropas": ${tropas(hl, ha, hc)}}`);
  }
  return ["{", '  "envios": [', envios.join(",\n"), "  ]", "}"].join("\n");
}

// ----------------------------------------------------------
//  FASE 1 — CONSTRUCAO. Varia por braco (F1/F2/F3).
// ----------------------------------------------------------
function montarPromptConstrucao(visao, braco) {
  const cfg = visao.config;
  const L = [];
  L.push(IDENT); L.push("");
  L.push(braco === "F1" ? Engine.regrasCombateTexto(cfg) : trianguloSo(cfg)); L.push("");
  L.push(Engine.regrasEconomiaTexto(cfg)); L.push("");
  const rej = rejeicoesBloco(visao, "construir");
  if (rej) { L.push(rej); L.push(""); }
  L.push(aldeiasRecTropas(visao)); L.push("");
  if (braco === "F1") {
    L.push(neutrasLista(visao, false)); L.push("");
    L.push(inimigoLista(visao, false)); L.push("");
    L.push(transitoBloco(visao)); L.push("");
  } else if (braco === "F2") {
    L.push(neutrasContagem(visao)); L.push("");
  } // F3: sem neutras
  L.push(eventosBloco(visao)); L.push("");
  L.push("Responda APENAS com um JSON valido no formato abaixo. Nenhum texto antes ou depois do JSON.");
  L.push("");
  L.push("Antes de responder: em 'aldeiaId' use SOMENTE ids que aparecem na secao SUAS ALDEIAS. So ordene construir se a aldeia tem recursos para pagar o custo AGORA. O exemplo abaixo so mostra o FORMATO; nao copie o tipo como se fosse sua jogada.");
  L.push("");
  L.push(exemploConstruir(visao));
  return L.join("\n");
}

// ----------------------------------------------------------
//  FASE 2 — ENVIO. IDENTICA em F1, F2, F3.
// ----------------------------------------------------------
function montarPromptEnvio(visao) {
  const cfg = visao.config;
  const L = [];
  L.push(IDENT); L.push("");
  L.push(Engine.regrasCombateTexto(cfg)); L.push("");
  const rej = rejeicoesBloco(visao, "envio");
  if (rej) { L.push(rej); L.push(""); }
  L.push(aldeiasTropasSo(visao)); L.push("");
  L.push(neutrasLista(visao, true)); L.push("");
  L.push(inimigoLista(visao, true)); L.push("");
  L.push(transitoBloco(visao)); L.push("");
  L.push(eventosBloco(visao)); L.push("");
  L.push("Responda APENAS com um JSON valido no formato abaixo. Nenhum texto antes ou depois do JSON.");
  L.push("");
  L.push("Antes de responder: em 'origemId' use SOMENTE ids de SUAS ALDEIAS; escolha 'destinoId' entre os ids de ALDEIAS NEUTRAS e INIMIGO. Nao envie tropas que voce nao tem: se uma aldeia esta sem tropas, nao a use. O exemplo abaixo so mostra o FORMATO com ids reais deste turno; nao copie os numeros dele.");
  L.push("");
  L.push(exemploEnvio(visao));
  return L.join("\n");
}

module.exports = { montarPromptConstrucao, montarPromptEnvio };
