// alucinacao-espacial.js — E9 do ESTUDO_PROMPT_P4.
//
// Mede COMPREENSAO DE MAPA sem gastar um token de API: varre os RACIOCINIOS
// gravados no .txt de uma partida, extrai afirmacoes espaciais VERIFICAVEIS e
// confere cada uma contra o estado real do motor (replay .json + a rede de
// estradas do mapa autoral).
//
// A pergunta que responde: quando um modelo diz "[8] e vizinha de [11]" ou "a
// rota de [12] a [17] leva 3 turnos", ele esta a ler o mapa ou a inventar?
//
// Uso:
//   node ferramentas/alucinacao-espacial.js <partida.txt> [replay.json] [--json saida.json]
//
// SEM replay funciona (a topologia da Iberia e fixa e vem do world-iberia.js);
// o replay serve para as afirmacoes de DONO e de GUARNICAO, que mudam por turno.
//
// PRINCIPIO (o mesmo do analisar-log.js): a metrica vem do ESTADO DO MOTOR. O
// .txt narra, o motor mede. Aqui o .txt so fornece as FRASES; quem julga e o
// engine.js — a mesma funcao de rota que o jogo executa (caminhoEntre +
// turnosDeCaminho), nunca uma reimplementacao.
//
// HONESTIDADE DA MEDIDA: isto conta apenas o que da para verificar por regex
// sobre ids entre [colchetes]. Um modelo que raciocine espacialmente em prosa
// sem citar ids nao aparece aqui — a metrica e um PISO de alucinacao, nao um
// retrato completo. O denominador (afirmacoes extraidas) sai sempre no relatorio
// para o numerador nunca ser lido sozinho.

"use strict";
const fs = require("fs");
const path = require("path");
const Engine = require(path.join(__dirname, "..", "engine.js"));

// ---------- extracao dos raciocinios do .txt, por turno e por Rei ----------
function lerRaciocinios(caminho) {
  const txt = fs.readFileSync(caminho, "utf8");
  const blocos = txt.split(/\n########## TURNO /).slice(1);
  const out = [];
  for (const b of blocos) {
    const cab = b.split("\n")[0];
    const m = /^(\d+) — Rei ([AB]) \((.+)\) ##########/.exec(cab);
    if (!m) continue;
    // o raciocinio vai de "raciocinio: " ate a proxima linha de estrutura
    const mr = /\nraciocinio: ([\s\S]*?)(?=\nordem\.construir:|\nplano \(|\ndepoimento |\nACEITO|\nREJEITADO|\nCOMBATE|\nREFORCO|\nplacar:|$)/.exec(b);
    out.push({ turno: Number(m[1]), lado: m[2], modelo: m[3], raciocinio: mr ? mr[1] : "" });
  }
  return out;
}

// ---------- DEDUZIR a escala de marcha do REPLAY (nao do cabecalho) ----------
// Porque isto existe: a metrica de rota depende de `escalaMarcha`, e o cabecalho
// do .txt JA MENTIU sobre isso — as 3 partidas de 16/08 dizem "dist x0.2" e
// correram com 1.0 (bug do toggle; o caso esta por extenso no CLAUDE.md secao 6). Julgar a rota de um
// modelo com a escala errada seria contar como alucinacao do modelo um erro
// NOSSO. Entao a escala sai do estado do motor: para cada movimento gravado,
// turnosTotal == ceil(pesoRota * escala * fatorVel), e resolve-se para escala.
function deduzirEscala(replayPath, est) {
  if (!replayPath || !fs.existsSync(replayPath)) return { escala: null, amostras: 0, motivo: "sem replay" };
  const rep = JSON.parse(fs.readFileSync(replayPath, "utf8"));
  const cfg = est.config;
  const ref = (cfg.relatorio && cfg.relatorio.velocidade_referencia) || "media";
  const passoRef = cfg.velocidade_passo[ref];
  const candidatas = [1, 2 / 3, 0.5, 0.3, 0.2, 0.1];
  const acertos = {}; for (const c of candidatas) acertos[c] = 0;
  let amostras = 0;
  const vistos = new Set();
  for (const f of rep.frames) {
    for (const m of f.movimentos || []) {
      if (!m.caminho || m.caminho.length < 2 || !m.turnosTotal) continue;
      const chave = m.dono + ":" + m.caminho.join(">") + ":" + JSON.stringify(m.tropas) + ":" + m.turnosTotal;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const peso = Engine.pesoRota(est, m.caminho);
      if (!isFinite(peso) || peso <= 0) continue;
      const passoTropa = cfg.velocidade_passo[Engine.velExercito(est, m.tropas)];
      amostras++;
      for (const c of candidatas) {
        if (Math.max(1, Math.ceil(peso * c * (passoRef / passoTropa))) === m.turnosTotal) acertos[c]++;
      }
    }
  }
  if (!amostras) return { escala: null, amostras: 0, motivo: "replay sem movimentos com caminho" };
  let melhor = null, melhorN = -1;
  for (const c of candidatas) if (acertos[c] > melhorN) { melhorN = acertos[c]; melhor = Number(c); }
  return { escala: melhor, amostras, concordancia: +(melhorN / amostras).toFixed(3),
           motivo: melhorN === amostras ? "todas as marchas batem" : `${melhorN}/${amostras} marchas batem` };
}

// ---------- o gabarito: topologia e rotas, pelas funcoes DO MOTOR ----------
function montarGabarito(replayPath, escalaForcada) {
  // Primeiro um estado com o ruleset vivo, so para deduzir a escala do replay...
  const sonda = Engine.criarEstadoInicial(Engine.CONFIG);
  const det = deduzirEscala(replayPath, sonda);
  const escala = (escalaForcada != null) ? Number(escalaForcada)
               : (det.escala != null ? det.escala : (Engine.CONFIG.escalaMarcha || 1));
  // ...e agora o gabarito definitivo, com a escala que a partida REALMENTE usou.
  const est = Engine.criarEstadoInicial(Object.assign({}, Engine.CONFIG, { escalaMarcha: escala }));
  const adj = est.estradas.adj;
  const vizinhos = (a, b) => (adj[a] || []).includes(Number(b));
  const rotaTurnos = (a, b, tropa) => {
    const cam = Engine.caminhoEntre(est, Number(a), Number(b));
    if (!cam) return null;
    return Engine.turnosDeCaminho(est, cam, tropa || { arqueiro: 1 });
  };
  // dono por turno (do replay): frames[t].aldeias[].dono
  let donoPorTurno = null;
  if (replayPath && fs.existsSync(replayPath)) {
    const rep = JSON.parse(fs.readFileSync(replayPath, "utf8"));
    donoPorTurno = {};
    for (const f of rep.frames) {
      donoPorTurno[f.turno] = {};
      for (const a of f.aldeias) donoPorTurno[f.turno][a.id] = a.dono;
    }
  }
  const nomes = {};
  for (const a of est.aldeias) nomes[a.id] = a.nome;
  return { est, adj, vizinhos, rotaTurnos, donoPorTurno, nomes, nAldeias: est.aldeias.length,
           escala, escalaDetectada: det, escalaForcada: escalaForcada != null };
}

// ---------- os padroes de afirmacao verificavel ----------
// Cada padrao devolve { tipo, ids, afirmado } e sabe julgar-se contra o gabarito.
// Deliberadamente CONSERVADORES: preferimos extrair menos e julgar certo do que
// extrair muito e contar falso positivo (uma metrica que exagera nao serve).
function extrairAfirmacoes(texto) {
  const achados = [];
  if (!texto) return achados;

  // (1) ADJACENCIA: "[8] is adjacent to [11]", "[8] connects to [11]",
  //     "[8] e vizinha de [11]", "[8] liga-se a [11]"
  // A janela entre os dois ids NAO pode conter . ; : ( ) nem outro [id]: sem isso
  // o regex cruza fronteiras de frase e inventa afirmacoes que o modelo nao fez
  // (visto na 1a versao: "[18]; Castellon connects to ... [16]" virava um erro).
  const reAdj = /\[(\d+)\]([^.;:()\[\]\n]{0,40}?)(?:is adjacent to|adjacent to|connects to|connected to|borders|neighbou?rs?|e vizinha de|liga-se a|ligada a)[^.;:()\[\]\n]{0,20}?\[(\d+)\]/gi;
  let m;
  while ((m = reAdj.exec(texto))) {
    if (+m[1] === +m[3]) continue; // "[23] ... connects to [23]": o sujeito real e outro id, fora da janela
    // NEGACAO: "is NOT directly connected to" afirma o CONTRARIO. Sem isto a
    // ferramenta contava como alucinacao um modelo que acertou ao negar — foi o
    // que aconteceu na 1a versao com o DeepSeek ("[1] is not connected to [7]",
    // verdade). Uma metrica que pune o acerto e pior do que nenhuma metrica.
    const nega = /\b(not|nao|não|isn't|is n't|no)\b/i.test(m[2]);
    achados.push({ tipo: "adjacencia", a: +m[1], b: +m[3], nega, trecho: m[0].trim() });
  }

  // (2) ROTA EM TURNOS: "from [12] to [17] takes 3 turns", "[12] -> [17]: 2 turns",
  //     "de [12] para [17] leva 3 turnos"
  const reRota = /(?:from\s*)?\[(\d+)\][^.;()\n]{0,30}?(?:to|->|até|ate|para)\s*\[(\d+)\][^.;()\n]{0,30}?(\d+)\s*(?:turn|turno)/gi;
  while ((m = reRota.exec(texto))) {
    if (+m[1] === +m[2]) continue;
    achados.push({ tipo: "rota", a: +m[1], b: +m[2], turnos: +m[3], trecho: m[0].trim() });
  }

  // (3) ID INEXISTENTE: qualquer [N] com N fora do mapa (alucinacao dura)
  const reId = /\[(\d+)\]/g;
  const idsCitados = new Set();
  while ((m = reId.exec(texto))) idsCitados.add(+m[1]);
  for (const id of idsCitados) achados.push({ tipo: "id_citado", a: id });

  return achados;
}

function julgar(afirmacoes, G, turno) {
  const res = { adjacencia: { n: 0, erradas: 0, exemplos: [] },
                rota: { n: 0, erradas: 0, exemplos: [] },
                id_inexistente: { n: 0, exemplos: [] } };
  for (const af of afirmacoes) {
    if (af.tipo === "adjacencia") {
      if (!G.adj[af.a] || !G.adj[af.b]) continue; // id invalido: conta no outro balde
      res.adjacencia.n++;
      const real = G.vizinhos(af.a, af.b);
      const afirmado = !af.nega; // "not connected" afirma a NAO-adjacencia
      if (real !== afirmado) {
        res.adjacencia.erradas++;
        if (res.adjacencia.exemplos.length < 5)
          res.adjacencia.exemplos.push(`T${turno}: "${af.trecho}" — [${af.a}] liga-se a ${JSON.stringify(G.adj[af.a])}`);
      }
    } else if (af.tipo === "rota") {
      const real = G.rotaTurnos(af.a, af.b);
      if (real == null) continue;
      res.rota.n++;
      // tolerancia de 1 turno: o relatorio mostra 3 velocidades e o modelo pode
      // citar qualquer uma delas. Erro = fora da faixa lenta..rapida +-1.
      const lenta = G.rotaTurnos(af.a, af.b, { lanceiro: 1 });
      const rapida = G.rotaTurnos(af.a, af.b, { cavaleiro: 1 });
      const min = Math.min(lenta, rapida) - 1, max = Math.max(lenta, rapida) + 1;
      if (af.turnos < min || af.turnos > max) {
        res.rota.erradas++;
        if (res.rota.exemplos.length < 5)
          res.rota.exemplos.push(`T${turno}: "${af.trecho}" — real ${lenta} lenta / ${rapida} rapida`);
      }
    } else if (af.tipo === "id_citado") {
      if (af.a >= G.nAldeias) {
        res.id_inexistente.n++;
        if (res.id_inexistente.exemplos.length < 5) res.id_inexistente.exemplos.push(`T${turno}: citou [${af.a}] (mapa tem 0..${G.nAldeias - 1})`);
      }
    }
  }
  return res;
}

function analisar(txtPath, replayPath, escalaForcada) {
  const G = montarGabarito(replayPath, escalaForcada);
  const turnos = lerRaciocinios(txtPath);
  const porLado = {};
  for (const t of turnos) {
    const L = (porLado[t.lado] = porLado[t.lado] || {
      modelo: t.modelo, turnos: 0, comRaciocinio: 0,
      adjacencia: { n: 0, erradas: 0, exemplos: [] },
      rota: { n: 0, erradas: 0, exemplos: [] },
      id_inexistente: { n: 0, exemplos: [] },
    });
    L.turnos++;
    if (!t.raciocinio || !t.raciocinio.trim()) continue;
    L.comRaciocinio++;
    const r = julgar(extrairAfirmacoes(t.raciocinio), G, t.turno);
    for (const k of ["adjacencia", "rota"]) {
      L[k].n += r[k].n; L[k].erradas += r[k].erradas;
      for (const e of r[k].exemplos) if (L[k].exemplos.length < 5) L[k].exemplos.push(e);
    }
    L.id_inexistente.n += r.id_inexistente.n;
    for (const e of r.id_inexistente.exemplos) if (L.id_inexistente.exemplos.length < 5) L.id_inexistente.exemplos.push(e);
  }
  for (const lado of Object.keys(porLado)) {
    const L = porLado[lado];
    L.taxa_adjacencia = L.adjacencia.n ? +(L.adjacencia.erradas / L.adjacencia.n).toFixed(3) : null;
    L.taxa_rota = L.rota.n ? +(L.rota.erradas / L.rota.n).toFixed(3) : null;
    L.afirmacoes_totais = L.adjacencia.n + L.rota.n;
  }
  return { arquivo: path.basename(txtPath), replay: replayPath ? path.basename(replayPath) : null, porLado,
           escala: { usada: G.escala, forcada: G.escalaForcada, deteccao: G.escalaDetectada },
           _nota: "Piso de alucinacao: conta so afirmacoes com ids entre [colchetes]; negacoes sao tratadas. A escala de marcha sai do REPLAY, nao do cabecalho (o cabecalho ja mentiu sobre ela em 16/08). Ler a taxa junto com o denominador." };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("uso: node ferramentas/alucinacao-espacial.js <partida.txt> [replay.json] [--json saida.json]");
    process.exit(1);
  }
  let txtPath = null, replayPath = null, jsonOut = null, escala = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json") jsonOut = args[++i];
    else if (args[i] === "--escala") escala = args[++i];
    else if (/\.json$/i.test(args[i])) replayPath = args[i];
    else txtPath = args[i];
  }
  const r = analisar(txtPath, replayPath, escala);
  if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(r, null, 2)); console.log("gravado: " + jsonOut); }
  console.log("\n== ALUCINACAO ESPACIAL == " + r.arquivo);
  const ee = r.escala;
  console.log("  escala de marcha do gabarito: " + ee.usada + (ee.forcada ? " (FORCADA por --escala)"
    : ee.deteccao.escala != null ? " (deduzida do replay: " + ee.deteccao.motivo + ")"
    : " (SEM replay - assumida do CONFIG vivo; a taxa de ROTA pode estar a julgar com a escala errada)"));
  for (const lado of Object.keys(r.porLado).sort()) {
    const L = r.porLado[lado];
    console.log(`\n  Rei ${lado} (${L.modelo})`);
    console.log(`    turnos com raciocinio: ${L.comRaciocinio}/${L.turnos}`);
    console.log(`    adjacencia: ${L.adjacencia.erradas}/${L.adjacencia.n} erradas` + (L.taxa_adjacencia != null ? ` (taxa ${L.taxa_adjacencia})` : " (sem amostra)"));
    for (const e of L.adjacencia.exemplos) console.log(`        - ${e}`);
    console.log(`    rota em turnos: ${L.rota.erradas}/${L.rota.n} erradas` + (L.taxa_rota != null ? ` (taxa ${L.taxa_rota})` : " (sem amostra)"));
    for (const e of L.rota.exemplos) console.log(`        - ${e}`);
    console.log(`    ids inexistentes citados: ${L.id_inexistente.n}`);
    for (const e of L.id_inexistente.exemplos) console.log(`        - ${e}`);
  }
  console.log("\n  " + r._nota);
}

module.exports = { analisar, extrairAfirmacoes, lerRaciocinios, montarGabarito };
