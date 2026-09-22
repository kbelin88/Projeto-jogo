// acompanhar-partida.js — os Reis estao mesmo a JOGAR? (partida a correr)
//
// Uso:  node ferramentas/acompanhar-partida.js <partida.txt> [ultimos=15]
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Uma partida sem limite de turnos pode correr horas com um lado morto: a
// resposta vem vazia, ou cortada no teto, ou valida mas sem uma ordem -- e o
// runner so aborta no formato, nunca na AGENCIA. O dots ganhou em 22/09 com
// 45% de respostas vazias; o ling perdeu com todas validas e dois tercos da
// partida sem um exercito na estrada. O que separa aqui e agir.
//
// Isto le o .txt que o runner vai escrevendo e mostra, por turno e por Rei:
// se a resposta prestou, quantas ordens passaram, a latencia, e o que houve
// na estrada. No fim, um alarme por Rei: turnos seguidos sem mandar ninguem.
//
// E acompanhamento, nao medida: "o .txt narra, o JSON mede" -- as metricas da
// partida continuam a sair do replay, pelo `analisar-log.js`.
"use strict";
const fs = require("fs");

const arq = process.argv[2];
const ultimos = parseInt(process.argv[3], 10) || 15;
if (!arq) { console.error("uso: node ferramentas/acompanhar-partida.js <partida.txt> [ultimos]"); process.exit(1); }
const txt = fs.readFileSync(arq, "utf8");

// um bloco por lado e turno
const lados = [];
const reBloco = /^########## TURNO (\d+) — Rei ([AB]) \((.*?)\) ##########$/gm;
const marcas = [];
let mm;
while ((mm = reBloco.exec(txt))) marcas.push({ i: mm.index, turno: +mm[1], rei: mm[2], modelo: mm[3] });
for (let k = 0; k < marcas.length; k++) {
  const b = txt.slice(marcas[k].i, k + 1 < marcas.length ? marcas[k + 1].i : txt.length);
  const tk = /tokens\.contexto: prompt (\d+) \| resposta (\d+) \| raciocinio (\d+) \| finish (\S+)(?: \| ms (\d+))?/.exec(b);
  lados.push(Object.assign({}, marcas[k], {
    erroRede: /ERRO DE REDE/.test(b),
    finish: tk ? tk[4] : "?",
    ms: tk && tk[5] ? +tk[5] : null,
    promptTok: tk ? +tk[1] : null,
    vazia: /resposta crua: ""/.test(b),
    envios: (b.match(/^ACEITO envio/gm) || []).length,
    construir: (b.match(/^ACEITO construir/gm) || []).length,
    rejeitadas: (b.match(/^REJEITADO/gm) || []).length,
    estrada: (b.match(/^COMBATE-ESTRADA/gm) || []).length,
    conquistas: (b.match(/\(CONQUISTA\)/gm) || []).length,
    placar: (/^placar: (.*)$/m.exec(b) || [])[1] || null,
  }));
}
if (!lados.length) { console.log("ainda sem turnos em " + arq); process.exit(0); }

const modelo = { A: (lados.find((l) => l.rei === "A") || {}).modelo, B: (lados.find((l) => l.rei === "B") || {}).modelo };
const turnos = [...new Set(lados.map((l) => l.turno))];
const de = (t, r) => lados.find((l) => l.turno === t && l.rei === r);
const cel = (l) => {
  if (!l) return "      --      ";
  const q = l.erroRede ? "REDE" : l.vazia ? "VAZIA" : l.finish === "length" ? "CORTE" : "ok";
  return `${q.padEnd(5)} ${String(l.envios).padStart(2)}e ${String(l.construir).padStart(2)}c ${l.ms != null ? String(Math.round(l.ms / 1000)).padStart(4) + "s" : "   ?s"}`;
};
console.log(`\n${arq}`);
console.log(`A = ${modelo.A}\nB = ${modelo.B}\n`);
console.log("turno | Rei A                | Rei B                | estrada | placar");
for (const t of turnos.slice(-ultimos)) {
  const a = de(t, "A"), b = de(t, "B");
  // os eventos do turno ficam no bloco do ULTIMO lado a jogar
  const ev = b || a;
  console.log(`${String(t).padStart(5)} | ${cel(a)} | ${cel(b)} | ${String(ev.estrada).padStart(7)} | ${(ev.placar || "").replace(/ald\/tropas /g, "")}`);
}

// o alarme: quem esta a jogar e quem so esta a responder
console.log("");
for (const r of ["A", "B"]) {
  const meus = lados.filter((l) => l.rei === r);
  if (!meus.length) continue;
  let semEnvio = 0;
  for (let k = meus.length - 1; k >= 0 && meus[k].envios === 0; k--) semEnvio++;
  const inval = meus.filter((l) => l.erroRede || l.vazia || l.finish === "length").length;
  const ms = meus.map((l) => l.ms).filter((x) => x != null).sort((x, y) => x - y);
  const med = ms.length ? Math.round(ms[(ms.length / 2) | 0] / 1000) : "?";
  const env = meus.reduce((s, l) => s + l.envios, 0);
  const alarme = semEnvio >= 5 ? `  <<< ${semEnvio} turnos seguidos SEM mandar ninguem` : "";
  console.log(`Rei ${r}: ${meus.length} turnos | invalidos ${inval} (${Math.round(100 * inval / meus.length)}%) | envios ${env} | latencia mediana ${med}s${alarme}`);
}
const est = lados.reduce((s, l) => s + l.estrada, 0);
const fim = /=== FIM ===.*$/m.exec(txt);
console.log(`combates de estrada: ${est}${fim ? "\n" + fim[0] : ""}`);
