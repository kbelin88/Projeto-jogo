// varredor-cruzamento-estrada.js — ITEM 1: exercitos que se cruzam sem lutar.
//
// V3. NAO EDITA engine.js. Le world-iberia.js (so leitura, para os custos de
// estrada) e os .replay.json de resultados/. A logica de posicaoRota e
// cruzaramNaEstrada abaixo e uma REIMPLEMENTACAO fiel de engine.js:1194-1380,
// citada linha a linha, para investigacao — nao e usada por nenhum caminho de
// producao.
//
// HISTORICO DE METODO (ver DIARIO.md para os dois becos sem saida completos):
//   V1 — casava o MESMO movimento entre frame N e N+1 por assinatura, so
//        testava sobreviventes. CEGO para o caso mais comum de colisao (dois
//        exercitos que se resolvem no MESMO turno em que se cruzam). Achou
//        1 cruzamento em 760 pares — implausivel, descartado.
//   V2 — projetava 1 tick a frente e testava DISTANCIA (x,y) entre as cordas.
//        Achou 621 "cruzamentos", mas a maioria eram exercitos de lados
//        opostos convergindo na MESMA ALDEIA por ESTRADAS DIFERENTES —
//        correto (cada um briga com a guarnicao via resolverChegada), nao um
//        bug. Falso positivo sistematico: proximidade no mapa != mesmo trecho.
//   V3 (esta) — usa a logica EXATA de cruzaramNaEstrada (que ja exige o MESMO
//        trecho lo/hi), com SUBAMOSTRAGEM dentro do intervalo de 1 tick,
//        interpolando turnosRestantes fracionario. So conta como achado um
//        par que e FALSO no inicio do tick (k=0, ja testado pelo motor real
//        quando processou o turno anterior), FALSO no fim (k=1, sera testado
//        pelo motor no proximo tick), mas VERDADEIRO em algum k estritamente
//        entre os dois. Essa combinacao e a prova precisa de H1: um
//        cruzamento que aconteceu segundo a propria definicao de posicao
//        continua do motor, e que a amostragem discreta (1x por turno) nunca
//        teve a chance de pegar.
//
// USO: node pesquisa/2026-08-28/experimentos/varredor-cruzamento-estrada.js

"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..", "..");
const Iberia = require(path.join(RAIZ, "world-iberia.js"));

const SUBPASSOS = 40; // resolucao da subamostragem dentro de 1 tick

// ---------------------------------------------------------------------------
function acharReplays(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) acharReplays(p, out);
    else if (ent.name.endsWith(".replay.json")) out.push(p);
  }
}
const REPLAYS = [];
acharReplays(path.join(RAIZ, "resultados"), REPLAYS);

// ---------------------------------------------------------------------------
// REIMPLEMENTACAO fiel de engine.js:1194-1380 (so leitura, comentada linha a
// linha onde diverge de engine.js so por precisar de dados externos ao
// `estado` do motor, que aqui vem do replay).
// ---------------------------------------------------------------------------
function chaveTrecho(a, b) { return Math.min(a, b) + "|" + Math.max(a, b); }

function construirCustoPorId(aldeiasFrame) {
  const idPorSlug = {};
  for (const a of aldeiasFrame) idPorSlug[a.slug] = a.id;
  const custo = {};
  for (const e of Iberia.ESTRADAS) {
    const a = idPorSlug[e.de], b = idPorSlug[e.para];
    if (a == null || b == null) continue;
    custo[chaveTrecho(a, b)] = e.custo;
  }
  return custo;
}

// engine.js:1194-1206 (pesoTrecho)
function pesoTrecho(custoPorTrecho, cidadesPorId, aId, bId) {
  const c = custoPorTrecho[chaveTrecho(aId, bId)];
  if (c != null) return c;
  const a = cidadesPorId[aId], b = cidadesPorId[bId];
  if (a && b) return Math.hypot(b.x - a.x, b.y - a.y) / (Iberia.MAPA.pxPorTurno || 1);
  return 0;
}
// engine.js:1207-1210 (pesoRota)
function pesoRota(custoPorTrecho, cidadesPorId, caminho) {
  let p = 0;
  for (let i = 0; i + 1 < caminho.length; i++) {
    p += pesoTrecho(custoPorTrecho, cidadesPorId, caminho[i], caminho[i + 1]);
  }
  return p;
}
// engine.js:1333-1352 (posicaoRota) — identica, aceita turnosRestantes
// FRACIONARIO de proposito (e so aritmetica; o motor real so chama com
// inteiros, mas a formula nao exige isso — e e essa folga que a
// subamostragem usa).
function posicaoRota(custoPorTrecho, cidadesPorId, mov) {
  const cam = mov.caminho;
  if (!cam || cam.length < 2) return null;
  const total = pesoRota(custoPorTrecho, cidadesPorId, cam);
  const frac = mov.turnosTotal ? (mov.turnosTotal - mov.turnosRestantes) / mov.turnosTotal : 1;
  let alvo = Math.max(0, frac) * total;
  for (let i = 0; i + 1 < cam.length; i++) {
    const a = cidadesPorId[cam[i]], b = cidadesPorId[cam[i + 1]];
    const seg = pesoTrecho(custoPorTrecho, cidadesPorId, cam[i], cam[i + 1]);
    if (alvo <= seg || i + 2 === cam.length) {
      const t = seg > 0 ? Math.max(0, Math.min(1, alvo / seg)) : 0;
      return { aId: cam[i], bId: cam[i + 1], t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    alvo -= seg;
  }
  return null;
}
// engine.js:1355-1380 (cruzaramNaEstrada) — copia fiel, sem alteracao de
// logica (so troca `estado.config.cruzamentoMesmoSentido` por parametro).
function cruzaramNaEstrada(custoPorTrecho, cidadesPorId, m1, m2, cruzamentoMesmoSentido) {
  if (m1.dono === m2.dono) return false;
  const p1 = posicaoRota(custoPorTrecho, cidadesPorId, m1);
  const p2 = posicaoRota(custoPorTrecho, cidadesPorId, m2);
  if (!p1 || !p2) return false;
  const lo = Math.min(p1.aId, p1.bId), hi = Math.max(p1.aId, p1.bId);
  if (lo !== Math.min(p2.aId, p2.bId) || hi !== Math.max(p2.aId, p2.bId)) return false;
  const dir1 = p1.aId < p1.bId ? 1 : -1, dir2 = p2.aId < p2.bId ? 1 : -1;
  if (dir1 !== dir2) {
    const a = cidadesPorId[lo], b = cidadesPorId[hi];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const posLo = (p) => (p.aId < p.bId ? p.t : 1 - p.t) * seg;
    const posX = dir1 === 1 ? posLo(p1) : posLo(p2);
    const posY = dir1 === 1 ? posLo(p2) : posLo(p1);
    return posX >= posY;
  }
  if (cruzamentoMesmoSentido === false) return false;
  return true;
}

// mov projetado para um turnosRestantes ARBITRARIO (pode ser fracionario —
// usado so pela subamostragem, nunca pelo motor real)
function projetarPara(mov, turnosRestantes) {
  return Object.assign({}, mov, { turnosRestantes });
}

// ---------------------------------------------------------------------------
function processarReplay(arq) {
  const r = JSON.parse(fs.readFileSync(arq, "utf8"));
  if (!r.frames || r.frames.length < 2) return null;

  const cidadesPorId = {};
  for (const a of r.frames[0].aldeias) cidadesPorId[a.id] = { x: a.x, y: a.y };
  const custoPorTrecho = construirCustoPorId(r.frames[0].aldeias);

  let paresChecados = 0;
  let jaNoInicio = 0;       // cruzaramNaEstrada(k=0) ja true (consistencia: nao deveria acontecer)
  let pegoNoFim = 0;        // cruzaramNaEstrada(k=1) true — sera pego pelo motor no proximo tick, normal
  let perdidoNoMeio = 0;    // falso em k=0 E k=1, verdadeiro em algum k intermediario — O ACHADO
  const achados = [];

  for (let i = 0; i + 1 < r.frames.length; i++) {
    const frN = r.frames[i], frN1 = r.frames[i + 1];
    const movs = frN.movimentos || [];

    for (let a = 0; a < movs.length; a++) {
      for (let b = a + 1; b < movs.length; b++) {
        const m1 = movs[a], m2 = movs[b];
        if (m1.dono === m2.dono) continue;
        paresChecados++;

        const emK = (k) => cruzaramNaEstrada(
          custoPorTrecho, cidadesPorId,
          projetarPara(m1, m1.turnosRestantes - k),
          projetarPara(m2, m2.turnosRestantes - k),
          true // cruzamentoMesmoSentido: testar com a regra vigente (23/08) ligada
        );

        const k0 = emK(0);
        if (k0) { jaNoInicio++; continue; } // ja seria pego no turno anterior; nao e desta transicao

        const k1 = emK(1);
        if (k1) { pegoNoFim++; continue; } // sera pego no proximo tick; comportamento normal

        // nem k=0 nem k=1: sonda o interior do intervalo
        let achouNoMeio = null;
        for (let s = 1; s < SUBPASSOS; s++) {
          const k = s / SUBPASSOS;
          if (emK(k)) { achouNoMeio = k; break; }
        }
        if (achouNoMeio == null) continue; // nunca se cruzaram, dentro da resolucao testada

        perdidoNoMeio++;
        const pos1 = posicaoRota(custoPorTrecho, cidadesPorId, projetarPara(m1, m1.turnosRestantes - achouNoMeio));
        const pos2 = posicaoRota(custoPorTrecho, cidadesPorId, projetarPara(m2, m2.turnosRestantes - achouNoMeio));
        achados.push({
          arquivo: path.basename(arq), turnoDeAte: [frN.turno, frN1.turno],
          fracaoDoTick: Number(achouNoMeio.toFixed(3)),
          reiA: m1.dono, reiB: m2.dono,
          movA: { origemId: m1.origemId, destinoId: m1.destinoId, caminho: m1.caminho, turnosRestantes: m1.turnosRestantes, turnosTotal: m1.turnosTotal },
          movB: { origemId: m2.origemId, destinoId: m2.destinoId, caminho: m2.caminho, turnosRestantes: m2.turnosRestantes, turnosTotal: m2.turnosTotal },
          trechoComum: [Math.min(pos1.aId, pos1.bId), Math.max(pos1.aId, pos1.bId)],
          pontoDoEncontro: { x: Number(pos1.x.toFixed(1)), y: Number(pos1.y.toFixed(1)) },
        });
      }
    }
  }

  return { arquivo: path.basename(arq), turnos: r.frames.length, paresChecados, jaNoInicio, pegoNoFim, perdidoNoMeio, achados };
}

// ---------------------------------------------------------------------------
function principal() {
  console.log(`${REPLAYS.length} replays encontrados, subamostragem em ${SUBPASSOS} passos por tick\n`);

  let totPares = 0, totInicio = 0, totFim = 0, totMeio = 0;
  const todosAchados = [];
  const porArquivo = [];

  for (const arq of REPLAYS) {
    let res;
    try { res = processarReplay(arq); } catch (e) {
      console.log(`  ERRO em ${path.basename(arq)}: ${e.message}\n  ${e.stack.split("\n")[1]}`);
      continue;
    }
    if (!res) continue;
    porArquivo.push(res);
    totPares += res.paresChecados;
    totInicio += res.jaNoInicio;
    totFim += res.pegoNoFim;
    totMeio += res.perdidoNoMeio;
    todosAchados.push(...res.achados);
  }

  console.log("=== RESULTADO ===\n");
  console.log(`replays processados:                         ${porArquivo.length}`);
  console.log(`pares inimigo-inimigo x transicao de turno:   ${totPares}`);
  console.log(`  ja cruzados no INICIO do tick (k=0):        ${totInicio}  (consistencia — devia ser 0 ou perto disso)`);
  console.log(`  vao cruzar no FIM do tick (k=1):             ${totFim}  (normal — o motor pega no proximo turno)`);
  console.log(`  PERDIDOS NO MEIO (falso em k=0 e k=1,`);
  console.log(`  verdadeiro em algum k intermediario):        ${totMeio}  <-- O ACHADO`);

  console.log("\n--- por arquivo (so os com >=1 perdido no meio) ---");
  for (const r of porArquivo) {
    if (r.perdidoNoMeio === 0) continue;
    console.log(`  ${r.arquivo.padEnd(60)} pares=${String(r.paresChecados).padStart(5)}  ` +
      `inicio=${r.jaNoInicio}  fim=${r.pegoNoFim}  MEIO=${r.perdidoNoMeio}`);
  }

  console.log(`\n--- ate 15 casos perdidos no meio, para inspecao manual ---`);
  for (const a of todosAchados.slice(0, 15)) {
    console.log(`  ${a.arquivo} t${a.turnoDeAte[0]}->t${a.turnoDeAte[1]} (fracao ${a.fracaoDoTick}): ` +
      `Rei ${a.reiA} ${JSON.stringify(a.movA.caminho)} (restam ${a.movA.turnosRestantes}/${a.movA.turnosTotal})` +
      `  x  Rei ${a.reiB} ${JSON.stringify(a.movB.caminho)} (restam ${a.movB.turnosRestantes}/${a.movB.turnosTotal})` +
      `  no trecho ${a.trechoComum}`);
  }

  fs.writeFileSync(
    path.join(__dirname, "achados-cruzamento-estrada.json"),
    JSON.stringify({ resumo: { totPares, totInicio, totFim, totMeio }, porArquivo, achados: todosAchados }, null, 1)
  );
  console.log(`\nescrito: achados-cruzamento-estrada.json (${todosAchados.length} achados completos)`);
}

principal();
