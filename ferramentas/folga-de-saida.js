// folga-de-saida.js — quanto o modelo ESCREVE contra o teto que tem para escrever.
//
// POR QUE EXISTE (28/08): a sonda media latencia, e a latencia enganou tres vezes
// no mesmo dia (dots deu 35 s na sonda e faz 95-204 s; nano-omni deu 47 s e
// estourou 12 minutos num turno). O que PREVIU a morte foi outra coisa: os tokens
// de RESPOSTA a subir turno a turno ate baterem no teto.
//
// O caso limpo e o inclusionai/ling-3.0-flash-fin (28/08): resposta de 11k no T1,
// 16k no T2, 30k no T3 — e a partir do T5 bate no teto quase todo turno, devolve
// `finish length` e ZERO ordens. Perdeu 4x19 sem nunca ter jogado mal: nunca
// chegou a jogar. O sinal ja estava na sonda de 3 turnos (8953 -> 29303) e
// ninguem olhou para ele, porque se estava a olhar para o relogio.
//
// ⚠️ O TETO EFETIVO E O MENOR de dois: o do CLIENTE (default 32000, rei.js:234 e
// index.html:3314; pode ser levantado com MAX_TOKENS_RESPOSTA) e o do MODELO, do
// catalogo. Se quem prende for o cliente, levantar salva; se for o modelo, nao.
//
// O teto do cliente e lido do CABECALHO de cada log, nao assumido: a P6 de 28/08
// correu a 64000 e a 1a versao desta ferramenta reportava "107% do teto" contra
// os 32000 cravados aqui. Um instrumento que assume a sua propria configuracao
// mente exatamente na experiencia que existe para medir.
//
// PROVADO na P5 vs P6 (mesmo confronto, so o teto muda): a 32000 o minimax-m3
// perdia 6x18 no T23 com 36% dos turnos cortados; a 64000 chegou ao limite dos
// 40 turnos em 10x14, com 11% cortados e MAIS TROPAS que o adversario.
// Um modelo pode ser descartado por uma configuracao nossa.
//
// USO:
//   node ferramentas/folga-de-saida.js <log.txt> [<log.txt> ...]
//   node ferramentas/folga-de-saida.js resultados/p4-bateria-0828/*.txt
//
// So leitura. Serve tanto para sonda de 3 turnos como para partida inteira.
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const TETO_NOSSO = 32000; // rei.js:234 / index.html:3314

// teto proprio de cada modelo, do dump do catalogo
const tetoModelo = {};
try {
  const dump = fs.readFileSync(path.join(RAIZ, "modelos_free_openrouter.txt"), "utf8");
  for (const b of dump.split(/^-{80,}$/m)) {
    const id = (/^ID \(usar no jogo\): (.+)$/m.exec(b) || [])[1];
    const mx = (/^Max completion: (\d+)$/m.exec(b) || [])[1];
    if (id) tetoModelo[id.trim()] = mx ? +mx : null;
  }
} catch { /* sem dump: segue so com o teto nosso */ }

const alvos = process.argv.slice(2);
if (!alvos.length) { console.error("uso: node ferramentas/folga-de-saida.js <log.txt> ..."); process.exit(1); }

const porModelo = {};
for (const f of alvos) {
  let mod = null;
  const texto = fs.readFileSync(f, "utf8");
  // O TETO DESTA PARTIDA, do cabecalho — nao o default. Sem isto a ferramenta
  // mente numa partida corrida com MAX_TOKENS_RESPOSTA levantado: a P6 de 28/08
  // correu a 64000 e ela reportava "107% do teto" contra os 32000 cravados aqui.
  // O cabecalho passou a registar o valor exatamente para este caso.
  const tetoDoLog = (/max_tokens_resposta=(\d+)/.exec(texto) || [])[1];
  const tetoCliente = tetoDoLog ? +tetoDoLog : TETO_NOSSO;
  for (const L of texto.split("\n")) {
    const h = /^#+ TURNO \d+ — Rei [AB] \(openrouter:([^)]*)\)/.exec(L);
    if (h) { mod = h[1]; continue; }
    const t = /resposta (\d+) \| raciocinio (\d+) \| finish (\w+)/.exec(L);
    if (t && mod) {
      const d = (porModelo[mod] = porModelo[mod] || { resp: [], cortados: 0, n: 0, tetos: new Set() });
      d.resp.push(+t[1]); d.n++; d.tetos.add(tetoCliente);
      if (t[3] === "length") d.cortados++;
    }
  }
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const linhas = [];
for (const [m, d] of Object.entries(porModelo)) {
  if (!d.n) continue;
  const mdn = med(d.resp);
  // O teto que MANDA e o menor dos dois. Um modelo cujo teto proprio seja MENOR
  // que o nosso parece folgado contra os 32000 e esta na verdade encostado ao
  // limite dele — foi o caso do liquid/lfm-2.5-2.6b (teto 8192, escrevia 8114:
  // 25% do teto nosso, 99% do que realmente tinha). A 1a versao desta ferramenta
  // dizia que ele estava confortavel.
  // Se os logs deste modelo misturam tetos diferentes (ex.: a P5 a 32k e a P6 a
  // 64k), usa o MAIOR e avisa — juntar as duas numa percentagem so nao significa
  // nada. Analisar cada partida a parte e o certo.
  const tetos = [...(d.tetos || [TETO_NOSSO])];
  const tetoCliente = Math.max(...tetos);
  const misturado = tetos.length > 1;
  const tetoEfetivo = Math.min(tetoCliente, tetoModelo[m] || tetoCliente);
  linhas.push({
    m, n: d.n, mdn, max: Math.max(...d.resp), tetoEfetivo, misturado,
    usoTeto: mdn / tetoEfetivo,
    cortados: d.cortados / d.n,
    tetoProprio: tetoModelo[m] || null,
    // sobe? compara a 1a metade com a 2a — a morte do ling foi monotona
    tendencia: d.resp.length >= 4
      ? med(d.resp.slice(Math.ceil(d.resp.length / 2))) / Math.max(1, med(d.resp.slice(0, Math.floor(d.resp.length / 2))))
      : null,
  });
}
linhas.sort((a, b) => b.usoTeto - a.usoTeto);

const pc = (x) => (x == null ? "   -" : (100 * x).toFixed(0) + "%");
console.log(`teto do cliente: lido do cabecalho de CADA log (default ${TETO_NOSSO}; MAX_TOKENS_RESPOSTA levanta-o)\n`);
console.log("modelo".padEnd(48) + "  n  resp.med  teto ef  % teto  cortados  tendencia");
for (const l of linhas) {
  // com n pequeno a mediana e fragil: avisa, mas nao com a mesma forca
  const forte = l.n >= 3;
  const alerta = l.misturado ? "  <<< LOGS COM TETOS DIFERENTES — analise cada partida a parte"
               : l.usoTeto >= 0.75 ? (forte ? "  <<< VAI MORRER NO TETO" : "  <<< encostado ao teto (n baixo)")
               : (l.usoTeto >= 0.5 ? "  <<< margem curta" : "");
  console.log(
    l.m.padEnd(48) + String(l.n).padStart(3) + String(l.mdn).padStart(10) +
    String(l.tetoEfetivo).padStart(9) + pc(l.usoTeto).padStart(8) + pc(l.cortados).padStart(10) +
    (l.tendencia != null ? ("x" + l.tendencia.toFixed(2)).padStart(11) : "          -") + alerta);
}
console.log("\n% teto  = resposta MEDIANA sobre o TETO EFETIVO (o menor dos dois). >=75% e morte anunciada.");
console.log("tendencia = mediana da 2a metade dos turnos sobre a da 1a. >1 e crescimento.");
console.log("Se o teto efetivo for o NOSSO, levantar max_tokens pode salvar o modelo.");
console.log("Se for o DELE, o modelo e verboso demais para o orcamento que tem: nao ha o que fazer.");
