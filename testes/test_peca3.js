// ============================================================
//  test_peca3.js  —  TESTE DA PECA 3 (MOVIMENTO + COMBATE)
// ------------------------------------------------------------
//  Rodar:  node test_peca3.js
//
//  Cenarios FIXOS conferidos contra calculo a mao. CONFIG:
//    forca: lanceiro 10, arqueiro 15, cavaleiro 30
//    bonus_forca_triangulo 1.5 ; atrito_base 0.5 (TRIANGULO v2: counter decide)
//    triangulo: lanceiro>cavaleiro>arqueiro>lanceiro
//    velocidade_passo: lenta 6, media 9, rapida 14
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;
// FASE MOTOR #3: este teste e a spec do NUCLEO de combate (triangulo+atrito),
// conferida a mao SEM fortificacao. Fixa o bonus de terreno em 1 p/ preservar
// os numeros; o bonus de aldeia/castelo tem teste proprio (test_peca5_defesa).
CONFIG.combate.bonus_defesa_aldeia = 1;
CONFIG.combate.bonus_defesa_castelo = 1;

let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}

// monta um estado minimo e controlado (sem teatro) para conferencia exata
function estadoTeste() {
  return { config: CONFIG, turno: 0, aldeias: [], movimentos: [], log: [], jogadores: { A: {}, B: {} } };
}
function ald(id, x, y, dono, tropas) {
  const tr = Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {});
  let tipo = null;
  if (!dono) { // neutra: tipo dominante = o tipo presente
    const presentes = ["lanceiro", "arqueiro", "cavaleiro"].filter((t) => tr[t] > 0);
    tipo = presentes.length ? presentes[0] : null;
  }
  return {
    id, x, y, nome: "Vila" + id, dono: dono || null, tipo,
    recursos: { madeira: 0, ferro: 0 },
    tropas: tr,
    construindo: [],
  };
}

// ---------------------------------------------------------
//  A) ATACANTE VENCE NEUTRA TIPADA + CONQUISTA  (matchup neutro)
//     neutra = 20 lanceiros (F=200); atacante 100 lanceiros (F=1000)
//     lanceiro vs lanceiro -> m=1 ; baixasForca = 200*0.5*1 = 100 ; frac 0.1
//     -> perde 10 lanceiros, 90 sobrevivem ; conquista ; tipo zera
// ---------------------------------------------------------
console.log("A) Atacante vence neutra tipada + conquista (matchup neutro):");
{
  const e = estadoTeste();
  const alvo = ald(1, 0, 0, null, { lanceiro: 20 }); // F=200, tipo lanceiro
  e.aldeias.push(alvo);
  const rep = Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 100 } }, alvo);
  checa("vencedor = atacante", rep.vencedor === "atacante");
  checa("Fatk=1000 Fdef=200", rep.Fatk === 1000 && rep.Fdef === 200);
  checa("vantagem = 0 (lanceiro vs lanceiro)", rep.vantagem === 0);
  checa("baixasForca = 100", rep.baixasForca === 100, `${rep.baixasForca}`);
  checa("conquista = true", rep.conquista === true);
  checa("aldeia agora e do A", alvo.dono === "A");
  checa("90 lanceiros de guarnicao", alvo.tropas.lanceiro === 90, `L${alvo.tropas.lanceiro}`);
  checa("deixou de ser neutra tipada (tipo = null)", alvo.tipo === null);
}

// ---------------------------------------------------------
//  B) TRIANGULO: mesmo alvo, atacante CERTO vs ERRADO vs NEUTRO
//     Defensor = 20 cavaleiros (F=600). Fatk fixo = 1200.
//       CERTO  : lanceiros (lanceiro>cavaleiro) m=1/1.5  -> 600*0.5*0.6667 = 200
//       NEUTRO : cavaleiros (cav vs cav)         m=1      -> 600*0.5*1      = 300
//       ERRADO : arqueiros (cav>arqueiro)        m=1.5    -> 600*0.5*1.5    = 450
//     Ordenacao esperada: 200 < 300 < 450
// ---------------------------------------------------------
console.log("\nB) Triangulo modula baixas (mesmo Fatk=1200, mesmo Fdef=600):");
function baixasContra(tropasAtk) {
  const e = estadoTeste();
  const def = ald(2, 0, 0, "B", { cavaleiro: 20 }); // F=600
  e.aldeias.push(def);
  const rep = Engine.resolverCombate(e, { dono: "A", tropas: tropasAtk }, def);
  return rep;
}
const certo = baixasContra({ lanceiro: 120 });   // F=1200
const neutro = baixasContra({ cavaleiro: 40 });   // F=1200
const errado = baixasContra({ arqueiro: 80 });    // F=1200
checa("todos vencem (Fatk 1200 > 600)", certo.vencedor === "atacante" && neutro.vencedor === "atacante" && errado.vencedor === "atacante");
checa("CERTO (lanceiro) baixasForca = 200", certo.baixasForca === 200, `${certo.baixasForca}`);
checa("NEUTRO (cavaleiro) baixasForca = 300", neutro.baixasForca === 300, `${neutro.baixasForca}`);
checa("ERRADO (arqueiro) baixasForca = 450", errado.baixasForca === 450, `${errado.baixasForca}`);
checa("ordenacao certo < neutro < errado", certo.baixasForca < neutro.baixasForca && neutro.baixasForca < errado.baixasForca);

// ---------------------------------------------------------
//  C) DEFENSOR SEGURA (numero manda; empate e derrota do atacante)
//     neutra 20 lanceiros (F=200) vs atacante 10 lanceiros (F=100) -> def vence
//     def perde forca = 100*0.5*1 = 50 -> frac 50/200=0.25 -> 5 lanceiros -> 15 (F=150)
//     Empate: 100 lanceiros (1000) vs neutra 100 lanceiros (1000) -> def segura
// ---------------------------------------------------------
console.log("\nC) Defensor segura (numero manda; empate = atacante perde):");
{
  const e = estadoTeste();
  const alvo = ald(3, 0, 0, null, { lanceiro: 20 }); // F=200
  e.aldeias.push(alvo);
  const rep = Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 10 } }, alvo);
  checa("vencedor = defensor", rep.vencedor === "defensor");
  checa("sem conquista", rep.conquista === false);
  checa("aldeia continua neutra", alvo.dono === null);
  checa("defesa 20 -> 15 lanceiros (F 200 -> 150)", alvo.tropas.lanceiro === 15, `L${alvo.tropas.lanceiro}`);
}
{
  const e = estadoTeste();
  const alvo = ald(4, 0, 0, null, { lanceiro: 100 }); // F=1000
  e.aldeias.push(alvo);
  const rep = Engine.resolverCombate(e, { dono: "A", tropas: { lanceiro: 100 } }, alvo);
  checa("empate (1000 vs 1000) -> defensor segura", rep.vencedor === "defensor" && alvo.dono === null);
}

// ---------------------------------------------------------
//  D) MOVIMENTO: tempo de viagem por distancia/velocidade
//     origem (0,0) -> destino (0,20). dist = 20.
//       cavaleiro (rapida, passo 14): ceil(20/14) = 2
//       lanceiro  (lenta,  passo 6):  ceil(20/6)  = 4
//       misto (lance+cav): velocidade da MAIS LENTA -> 4
// ---------------------------------------------------------
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

// ---------------------------------------------------------
//  E) FLUXO COMPLETO via TICK: envia, viaja, chega e conquista
//     origem (0,0) com 100 cavaleiros -> destino (0,28), neutra 30 lanceiros
//     dist 28, cav passo 14 -> 2 turnos de viagem
// ---------------------------------------------------------
console.log("\nE) Fluxo completo (enviar -> ticks -> chegada/combate):");
{
  const e = estadoTeste();
  const o = ald(7, 0, 0, "A", { cavaleiro: 100 });
  const d = ald(8, 0, 28, null, { lanceiro: 30 });
  e.aldeias.push(o, d);
  const mov = Engine.enviarExercito(e, 7, 8, { cavaleiro: 100 });
  checa("exercito enviado (2 turnos)", mov && mov.turnosRestantes === 2, mov ? `${mov.turnosRestantes}` : "null");
  checa("tropas deduzidas da origem", o.tropas.cavaleiro === 0);

  Engine.tick(e); // turno 1: ainda viajando
  checa("apos 1 turno: ainda em transito", e.movimentos.length === 1 && d.dono === null);

  Engine.tick(e); // turno 2: chega e ataca
  checa("apos 2 turnos: chegou (transito vazio)", e.movimentos.length === 0);
  checa("conquistou a neutra", d.dono === "A", `dono ${d.dono}`);
  checa("log registrou o combate", e.log.some((l) => l.tipo === "combate" && l.conquista));
  console.log(`     guarnicao tomada: C${d.tropas.cavaleiro} (sobreviventes)`);
}


// ---------------------------------------------------------
//  F) TRIANGULO v2: o counter DECIDE o vencedor
//     neutra = 30 lanceiros (F=300, tipo lanceiro)
//     F1: 18 arqueiros (F=270, counter CERTO): 270*1.5=405 > 300 -> VENCE
//         baixasEf = 300*0.5 = 150 ; frac = 150/405 ; baixas reais = 100
//     F2: 10 cavaleiros (F=300, IGUAL, counter ERRADO): 300 vs 300*1.5=450 -> PERDE
// ---------------------------------------------------------
console.log("\nF) Triangulo v2 decide o vencedor:");
{
  const e1 = estadoTeste();
  const alvo1 = ald(10, 0, 0, null, { lanceiro: 30 });
  e1.aldeias.push(alvo1);
  const r1 = Engine.resolverCombate(e1, { dono: "A", tropas: { arqueiro: 18 } }, alvo1);
  checa("F1 counter certo VENCE com menos forca (270 vs 300)", r1.vencedor === "atacante");
  checa("F1 FatkEf = 405", r1.FatkEf === 405, `FatkEf ${r1.FatkEf}`);
  checa("F1 baixas reais = 100", Math.round(r1.baixasForca) === 100, `baixas ${Math.round(r1.baixasForca)}`);

  const e2 = estadoTeste();
  const alvo2 = ald(11, 0, 0, null, { lanceiro: 30 });
  e2.aldeias.push(alvo2);
  const r2 = Engine.resolverCombate(e2, { dono: "A", tropas: { cavaleiro: 10 } }, alvo2);
  checa("F2 counter errado PERDE mesmo com forca IGUAL (300 vs 450 ef)", r2.vencedor === "defensor");
  checa("F2 FdefEf = 450", r2.FdefEf === 450, `FdefEf ${r2.FdefEf}`);

  // F3: preverCombate (UI) coincide com o resolverCombate (motor)
  const e3 = estadoTeste();
  const alvo3 = ald(12, 0, 0, null, { lanceiro: 30 });
  e3.aldeias.push(alvo3);
  const prev = Engine.preverCombate(e3, { arqueiro: 18 }, alvo3);
  const real = Engine.resolverCombate(e3, { dono: "A", tropas: { arqueiro: 18 } },
    JSON.parse(JSON.stringify(alvo3)));
  checa("F3 previsao acerta o vencedor", prev.atacanteVence === (real.vencedor === "atacante"));
  checa("F3 previsao acerta as forcas efetivas",
    Math.round(prev.FatkEf) === real.FatkEf && Math.round(prev.FdefEf) === real.FdefEf);
}

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);