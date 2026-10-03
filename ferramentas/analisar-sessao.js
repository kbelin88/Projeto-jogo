// analisar-sessao.js - LE UMA PARTIDA EM SESSAO E DIZ O QUE ELA CUSTOU DE VERDADE.
// (29/09/2026, SPEC_TESTE_SESSAO_0929)
//
//   node ferramentas/analisar-sessao.js <partida.txt> [--preco-in 2] [--preco-out 10] [--lado A]
//
// Le o `<partida>.sessao.jsonl` (cada mensagem enviada e recebida, com o usage) e
// o `.txt` (ordens recusadas), e escreve:
//   1. uma linha por turno e por lado LLM;
//   2. os totais: entrada, cache, saida, custo REAL (o do provedor) e o
//      CONTRAFACTUAL de "um turno por vez" (o prompt P4 desse mesmo estado
//      contado com os tokens por caracter medidos neste jogo, e a MESMA saida);
//   3. o gabarito da spec (§5), linha a linha, com o veredito.
// Nao gasta nada e nao escreve nada: e so leitura.
"use strict";
const fs = require("fs");

const args = process.argv.slice(2);
const txtPath = args.find((a) => !a.startsWith("--"));
const opt = (nome, def) => { const i = args.indexOf("--" + nome); return i >= 0 ? args[i + 1] : def; };
if (!txtPath) { console.error("uso: node ferramentas/analisar-sessao.js <partida.txt> [--preco-in 2] [--preco-out 10] [--lado A]"); process.exit(1); }
const PRECO_IN = parseFloat(opt("preco-in", "2")), PRECO_OUT = parseFloat(opt("preco-out", "10"));
const LADO_PAGO = opt("lado", "A");
const jsonl = txtPath.replace(/\.txt$/i, "") + ".sessao.jsonl";
if (!fs.existsSync(jsonl)) { console.error("nao existe " + jsonl + " (a partida nao correu com SESSAO_N)"); process.exit(1); }
const linhas = fs.readFileSync(jsonl, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const turnos = linhas.filter((l) => l.tipo === "turno");
const sessoes = linhas.filter((l) => l.tipo === "sessao_inicio");
const txt = fs.readFileSync(txtPath, "utf8");

const soma = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);
const f = (x, d = 4) => "$" + x.toFixed(d);
const pct = (x) => (100 * x).toFixed(0) + "%";
const veredito = (ok) => (ok ? "PASSA" : "FALHA");

// ordens recusadas por lado (o .txt tem um bloco por turno e lado)
const recusadas = { A: 0, B: 0 };
for (const b of txt.split(/\r?\n(?=########## TURNO )/)) {
  const m = /^########## TURNO \d+ . Rei ([AB]) /.exec(b);
  if (m) recusadas[m[1]] += (b.match(/^REJEITADO:/gm) || []).length;
}

console.log("=== " + txtPath + " ===");
const lados = ["A", "B"].filter((d) => turnos.some((t) => t.lado === d));
const resumo = {};
for (const d of lados) {
  const ts = turnos.filter((t) => t.lado === d);
  const validos = ts.filter((t) => !t.foraDoContexto && t.usage);
  // tokens por caracter medidos NESTE jogo: o primeiro pedido de cada sessao tem
  // so o contexto enviado e o prompt real que o provedor contou
  const primeiro = validos[0];
  const tpc = primeiro ? primeiro.usage.prompt / primeiro.ctxChars : 0.396;
  console.log("\n--- Rei " + d + " (" + ts.length + " turnos, " + validos.length + " com resposta valida) | tokens por caracter medidos no 1o pedido: " + tpc.toFixed(3));
  console.log("turno sess/tn | msg turno | ctx enviado | P4 sombra || prompt tok | cache lido | escrito | saida | racioc. | custo");
  for (const t of ts) {
    const u = t.usage || {};
    console.log(
      String(t.turno).padStart(5) + " " + (t.sessao + "/" + (t.turnoNaSessao || "fora")).padStart(6) + " | " +
      String(Math.round(t.user.length * tpc)).padStart(8) + " | " + String(Math.round(t.ctxChars * tpc)).padStart(10) + " | " +
      String(Math.round(t.sombraChars * tpc)).padStart(9) + " || " + String(u.prompt != null ? u.prompt : "-").padStart(9) + " | " +
      String(u.cacheLido != null ? u.cacheLido : "-").padStart(9) + " | " + String(u.cacheEscrito != null ? u.cacheEscrito : "-").padStart(7) + " | " +
      String(u.resposta != null ? u.resposta : "-").padStart(5) + " | " + String(u.raciocinio != null ? u.raciocinio : "-").padStart(7) + " | " +
      (u.custo != null ? f(u.custo) : "-") + (t.foraDoContexto ? "  <" + t.foraDoContexto + ">" : ""));
  }
  const entrada = soma(validos.map((t) => t.usage), "prompt"), lido = soma(validos.map((t) => t.usage), "cacheLido");
  const saida = soma(validos.map((t) => t.usage), "resposta");
  const temCusto = validos.length && validos.every((t) => t.usage.custo != null);
  const custo = temCusto ? soma(validos.map((t) => t.usage), "custo") : null;
  // do 2o turno de cada sessao em diante: a fracao do prompt lida do cache
  const seguintes = validos.filter((t) => t.turnoNaSessao > 1);
  const cacheSeg = seguintes.length ? soma(seguintes.map((t) => t.usage), "cacheLido") / soma(seguintes.map((t) => t.usage), "prompt") : null;
  // contrafactual: um turno por vez = o P4 de cada estado (sombra) na entrada, a MESMA saida
  const sombraTok = validos.reduce((s, t) => s + t.sombraChars * tpc, 0);
  const contra = sombraTok * PRECO_IN / 1e6 + saida * PRECO_OUT / 1e6;
  const msgTok = validos.map((t) => t.user.length * tpc);
  const ctx4 = validos.filter((t) => t.turnoNaSessao === 4).map((t) => t.ctxChars * tpc);
  resumo[d] = { validos: validos.length, entrada, lido, saida, custo, cacheSeg, sombraTok, contra, mediaMsg: soma(msgTok.map((x) => ({ x })), "x") / Math.max(1, msgTok.length),
    ctxMax: ctx4.length ? Math.max(...ctx4) : null, foraDoContexto: ts.length - validos.length };
  console.log("\ntotais Rei " + d + ": entrada " + entrada + " tok (cache lido " + lido + " = " + pct(entrada ? lido / entrada : 0) + ") | saida " + saida +
    " tok | custo real " + (custo != null ? f(custo) : "(o provedor nao informou)"));
  console.log("  um turno por vez, mesmo estado e mesma saida (P4 de hoje a US$" + PRECO_IN + "/" + PRECO_OUT + " por M): entrada " + Math.round(sombraTok) + " tok, " + f(contra) +
    (custo != null ? "  ->  a sessao custou " + (custo >= contra ? "+" : "") + pct(custo / contra - 1) + " contra isso" : ""));
}

// ---- o gabarito da spec (§5) -----------------------------------------------
const r = resumo[LADO_PAGO];
console.log("\n=== GABARITO (SPEC_TESTE_SESSAO_0929 §5), Rei " + LADO_PAGO + " ===");
if (!r) { console.log("(sem turnos do Rei " + LADO_PAGO + ")"); process.exit(0); }
const linha = (nome, medido, previsto, ok) => console.log(veredito(ok).padEnd(6) + " | " + nome.padEnd(58) + " | medido " + String(medido).padEnd(22) + " | previsto " + previsto);
linha("mensagem de turno (tokens, media)", Math.round(r.mediaMsg), "1200-2000 (ensaio a seco: ~1560)", r.mediaMsg > 1200 && r.mediaMsg < 2000);
linha("contexto no 4o turno da sessao (tokens, maximo)", r.ctxMax != null ? Math.round(r.ctxMax) : "-", "10000-16000 (ensaio a seco: ~14000)", r.ctxMax != null && r.ctxMax > 10000 && r.ctxMax < 16000);
linha("cache lido, do 2o turno da sessao em diante", r.cacheSeg != null ? pct(r.cacheSeg) : "-", ">= 70% (ensaio a seco: 78%; < 50% = o cache nao funciona)", r.cacheSeg != null && r.cacheSeg >= 0.7);
linha("custo real do Rei " + LADO_PAGO, r.custo != null ? f(r.custo) : "-", "US$1,0 a 1,25 em 20 turnos (> 1,40 = modelo subestima)", r.custo != null && r.custo <= 1.4);
linha("ordens recusadas / turnos fora do contexto", recusadas[LADO_PAGO] + " / " + r.foraDoContexto, "0 / 0", recusadas[LADO_PAGO] === 0 && r.foraDoContexto === 0);
const esperadas = [4, 8, 12, 16].filter((x) => turnos.some((t) => t.lado === LADO_PAGO && t.turno >= x));
const escritas = turnos.filter((t) => t.lado === LADO_PAGO && t.memoria).map((t) => t.turno);
linha("memoria escrita nos turnos 4, 8, 12 e 16", escritas.join(",") || "nenhuma", esperadas.join(","), esperadas.every((x) => escritas.includes(x)));
console.log("\nsessoes abertas: " + sessoes.filter((s) => s.lado === LADO_PAGO).length + " | memorias: " + escritas.length);
