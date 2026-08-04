// ============================================================
//  test_peca3.js  —  PECA 3 (MOVIMENTO + fluxo de combate)
// ------------------------------------------------------------
//  A ARITMETICA EXATA do combate v3 vive em test_combate_v3.js. Aqui ficam as
//  MECANICAS ao redor: conquista, defensor segura no empate, UI==motor, tempo
//  de viagem, e o fluxo completo enviar->tick->chegada. Combate v3 (atq/def).
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;

let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

function estadoTeste() {
  return { config: CONFIG, turno: 0, aldeias: [], movimentos: [], log: [] };
}
function ald(id, x, y, dono, tropas) {
  const tr = Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {});
  const tipo = dono ? null : Engine.tipoDominante({ config: CONFIG }, tr);
  return { id, x, y, nome: "Vila" + id, dono: dono || null, capital: false, tipo,
    recursos: { madeira: 0, ferro: 0 }, tropas: tr, construindo: [] };
}

console.log("A) Atacante forte conquista a neutra (v3):");
{
  const e = estadoTeste();
  const alvo = ald(1, 0, 0, null, { lanceiro: 5 });
  e.aldeias.push(alvo);
  const rep = Engine.resolverCombate(e, { dono: "A", tropas: { cavaleiro: 20 } }, alvo);
  checa("vencedor = atacante", rep.vencedor === "atacante");
  checa("Fatk = ataque do atacante (atq)", rep.Fatk === Engine.ataqueDe({ cavaleiro: 20 }, CONFIG));
  checa("Fdef = defesa do defensor (def)", rep.Fdef === Engine.defesaDe({ lanceiro: 5 }, CONFIG));
  checa("conquista = true", rep.conquista === true);
  checa("aldeia agora e do A", alvo.dono === "A");
  checa("deixou de ser neutra tipada", alvo.tipo === null);
  checa("vencedor sobreviveu com tropas", Engine.contarTropas(alvo.tropas) >= 1);
}

console.log("\nC) Defensor segura (numero insuficiente; empate = atacante perde):");
{
  const e = estadoTeste();
  const alvo = ald(3, 0, 0, null, { lanceiro: 20 });
  e.aldeias.push(alvo);
  const rep = Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 1 } }, alvo);
  checa("vencedor = defensor", rep.vencedor === "defensor");
  checa("sem conquista", rep.conquista === false);
  checa("aldeia continua neutra", alvo.dono === null);
}
{
  // empate exato (1 lanceiro ataca aldeia de 1 cavaleiro: 1.25 vs 1.25) -> defensor
  const e = estadoTeste();
  const alvo = ald(4, 0, 0, null, { cavaleiro: 1 });
  e.aldeias.push(alvo);
  const rep = Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 1 } }, alvo);
  checa("empate favorece o defensor", rep.vencedor === "defensor" && alvo.dono === null);
}

console.log("\nD) Movimento: tempo de viagem (dist 20):");
{
  const e = estadoTeste();
  const o = ald(5, 0, 0, "A", { lanceiro: 50, cavaleiro: 50 });
  const d = ald(6, 0, 20, null, { lanceiro: 30 });
  e.aldeias.push(o, d);
  checa("cavaleiro sozinho = 2 turnos", Engine.turnosViagem(e, o, d, { cavaleiro: 50 }) === 2);
  checa("lanceiro sozinho = 4 turnos", Engine.turnosViagem(e, o, d, { lanceiro: 50 }) === 4);
  checa("misto = 4 turnos (mais lento)", Engine.turnosViagem(e, o, d, { lanceiro: 1, cavaleiro: 1 }) === 4);
}

console.log("\nE) Fluxo completo (enviar -> ticks -> chegada/combate):");
{
  const e = estadoTeste();
  const o = ald(7, 0, 0, "A", { cavaleiro: 100 });
  const d = ald(8, 0, 28, null, { lanceiro: 30 });
  e.aldeias.push(o, d);
  const mov = Engine.enviarExercito(e, 7, 8, { cavaleiro: 100 });
  checa("exercito enviado (2 turnos)", mov && mov.turnosRestantes === 2, mov ? `${mov.turnosRestantes}` : "null");
  checa("tropas deduzidas da origem", o.tropas.cavaleiro === 0);
  Engine.tick(e);
  checa("apos 1 turno: ainda em transito", e.movimentos.length === 1 && d.dono === null);
  Engine.tick(e);
  checa("apos 2 turnos: chegou (transito vazio)", e.movimentos.length === 0);
  checa("conquistou a neutra", d.dono === "A", `dono ${d.dono}`);
  checa("log registrou o combate", e.log.some((l) => l.tipo === "combate" && l.conquista));
}

console.log("\nF) UI (preverCombate) == MOTOR (resolverCombate):");
{
  const e = estadoTeste();
  const alvo = ald(10, 0, 0, null, { lanceiro: 3 });
  e.aldeias.push(alvo);
  const prev = Engine.preverCombate(e, { arqueiro: 2 }, alvo);
  const real = Engine.resolverCombate(e, { dono: "A", tropas: { arqueiro: 2 } },
    JSON.parse(JSON.stringify(alvo)));
  checa("previsao acerta o vencedor", prev.atacanteVence === (real.vencedor === "atacante"));
  checa("previsao acerta as forcas efetivas",
    Math.round(prev.FatkEf) === real.FatkEf && Math.round(prev.FdefEf) === real.FdefEf);
}

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
