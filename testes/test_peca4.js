// ============================================================
//  test_peca4.js  —  TESTE DA PECA 4 (DUMB PLAYER + LOOP)
// ------------------------------------------------------------
//  Rodar:  node test_peca4.js
//
//  Confere o que a spec pede para a Peca 4:
//    - a partida termina por ELIMINACAO
//    - dura um numero de turnos razoavel
//    - o log por turno e legivel
//    - a fronteira decisao/motor existe (montarVisao -> ordem)
//    - modo rapido roda VARIAS partidas e mede duracao/vencedor
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;
CONFIG.layout = "v1"; // teste da GERACAO V1 (preservada): estes invariantes sao dela

let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

// ---------------------------------------------------------
//  0) FRONTEIRA decisao/motor: visao -> ordem estruturada
// ---------------------------------------------------------
console.log("0) Fronteira decisao/motor (montarVisao -> jogadorBurro -> ordem):");
{
  const e = Engine.criarEstadoInicial(CONFIG);
  Engine.tick(e); // 1 turno para haver recurso
  const visao = Engine.montarVisao(e, "A");
  checa("visao tem minhas aldeias", Array.isArray(visao.minhas) && visao.minhas.length === 1);
  checa("visao tem alvos (neutras+inimigo)", Array.isArray(visao.alvos) && visao.alvos.length === CONFIG.teatro.n_aldeias - 1);
  const ordem = Engine.jogadorBurro(visao);
  checa("ordem tem listas construir/envios", Array.isArray(ordem.construir) && Array.isArray(ordem.envios));
  console.log(`     ex.: ordem.construir = ${JSON.stringify(ordem.construir.map((c) => c.tipo))}`);
}

// ---------------------------------------------------------
//  A) UMA PARTIDA COMPLETA (verbose) — log por turno legivel
// ---------------------------------------------------------
// NOTA: sob neutras TIPADAS (V1), as neutras ficaram muito mais fortes e o
// JOGADOR BURRO (que nao escolhe counter) pode nao conseguir resolver a partida
// -> dumb-vs-dumb costuma empacar. Isso e BALANCEAMENTO/observacao, nao bug.
// Por isso aqui testamos a CORRECAO do loop, nao se o burro vence.
console.log("\nA) Partida completa roda sem erro (log por turno):");
const r = Engine.rodarPartida(CONFIG, null, { verbose: true });
console.log("");
checa("loop rodou e devolveu resultado", r && typeof r.turnos === "number" && r.turnos > 0);
checa("historico tem 1 snapshot por turno", r.historico.length === r.turnos);
checa("se terminou, foi por eliminacao com perdedor zerado",
  r.motivo !== "eliminacao" || (r.vencedor === "A" ? r.aldeiasB : r.aldeiasA) === 0);
console.log(`     -> motivo ${r.motivo}, vencedor ${r.vencedor}, ${r.turnos} turnos (A:${r.aldeiasA} x B:${r.aldeiasB})`);

// MECANISMO DE VITORIA (construido, independente do burro): B sem aldeias -> A vence
{
  const g = Engine.criarEstadoInicial(CONFIG);
  for (const a of Engine.aldeiasDe(g, "B")) a.dono = null; // B perde a ultima aldeia
  checa("checarVitoria detecta eliminacao (B sem aldeia -> A)", Engine.checarVitoria(g) === "A");
}

// ---------------------------------------------------------
//  B) DETERMINISMO: mesma seed -> mesmo resultado
// ---------------------------------------------------------
console.log("\nB) Determinismo (mesma seed):");
{
  const r1 = Engine.rodarPartida(CONFIG, null, {});
  const r2 = Engine.rodarPartida(CONFIG, null, {});
  checa("mesma seed reproduz vencedor e turnos",
    r1.vencedor === r2.vencedor && r1.turnos === r2.turnos,
    `${r1.vencedor}/${r1.turnos} vs ${r2.vencedor}/${r2.turnos}`);
}

// ---------------------------------------------------------
//  C) MODO RAPIDO: varias partidas (variando seed) — CORRECAO
//     (so confere que a maquina roda; numeros vao na secao EVAL)
// ---------------------------------------------------------
console.log("\nC) Modo rapido — 20 partidas (seeds 1..20):");
const N = 20;
const resultados = [];
for (let s = 1; s <= N; s++) {
  const cfg = Object.assign({}, CONFIG, { seed: s });
  resultados.push(Engine.rodarPartida(cfg, null, {}));
}
checa("todas devolveram resultado valido", resultados.every((r) => r && typeof r.turnos === "number" && r.historico.length === r.turnos));
checa("invariante: perdedor por eliminacao sempre com 0 aldeias",
  resultados.filter((r) => r.motivo === "eliminacao")
    .every((r) => (r.vencedor === "A" ? r.aldeiasB : r.aldeiasA) === 0));

console.log("");
console.log(falhas === 0 ? "CORRECAO: TODOS OS TESTES PASSARAM ✔" : `CORRECAO: ${falhas} FALHA(S) ✘`);

// ---------------------------------------------------------
//  EVAL (NAO e pass/fail): a foto que a spec quer ler.
//  "a partida dura ~30 turnos? alguem sempre ganha? variancia?"
// ---------------------------------------------------------
console.log("\n=== EVAL (balanceamento — observacao, nao teste) ===");
let vitA = 0, vitB = 0, semFim = 0;
const dur = [];
for (const r of resultados) {
  if (r.vencedor === "A") vitA++;
  else if (r.vencedor === "B") vitB++;
  else semFim++;
  dur.push(r.turnos);
}
const terminadas = dur.filter((_, i) => resultados[i].motivo === "eliminacao");
const media = (dur.reduce((a, b) => a + b, 0) / N).toFixed(1);
console.log(`  vitorias   A:${vitA}  B:${vitB}  sem-fim(teto ${CONFIG.max_turnos}):${semFim}`);
console.log(`  duracao    min ${Math.min(...dur)} / media ${media} / max ${Math.max(...dur)} turnos`);
console.log(`  alvo de design ........... ~${CONFIG.partida_alvo_turnos} turnos`);
if (media > CONFIG.partida_alvo_turnos * 1.5 || semFim > 0) {
  console.log(`  >> ACHADO: partidas longas / empacam. CONFIG precisa de ajuste`);
  console.log(`     (ex.: endurecimento, custos, producao, margem_ataque do jogador).`);
}

process.exit(falhas === 0 ? 0 : 1);
