// ============================================================
//  test_peca2.js  —  TESTE DA PECA 2 (TICK)
// ------------------------------------------------------------
//  Rodar:  node test_peca2.js
//
//  Confere o que a spec pede para a Peca 2 (sem movimento/combate):
//    - recursos sobem na taxa certa (producao_madeira/ferro por turno)
//    - neutras NAO acumulam recurso
//    - neutras endurecem +endurecimento por turno
//    - tropas sao construidas e entram apos os turnos certos
//      (lanceiro/arqueiro = 1 turno, cavaleiro = 2 turnos)
//    - o custo e debitado ao enfileirar; sem recurso, nao constroi
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

// ---------------------------------------------------------
//  A) PRODUCAO + ENDURECIMENTO  (3 ticks limpos)
// ---------------------------------------------------------
console.log("A) Producao e endurecimento (3 turnos sem gastar):");
const e1 = Engine.criarEstadoInicial(CONFIG);
const A = Engine.aldeiasDe(e1, "A")[0];
const B = Engine.aldeiasDe(e1, "B")[0];
// guarnição inicial = unidades do tipo dominante de cada neutra
const guarnIni = new Map(Engine.aldeiasDe(e1, null).map((a) => [a.id, a.tropas[a.tipo]]));

const N = 3;
for (let i = 0; i < N; i++) Engine.tick(e1);

checa(`turno = ${N}`, e1.turno === N, `turno ${e1.turno}`);
checa(`Rei A madeira = ${CONFIG.producao.madeira * N}`, A.recursos.madeira === CONFIG.producao.madeira * N, `mad ${A.recursos.madeira}`);
checa(`Rei A ferro = ${CONFIG.producao.ferro * N}`, A.recursos.ferro === CONFIG.producao.ferro * N, `fer ${A.recursos.ferro}`);
checa("Rei B mesma producao", B.recursos.madeira === CONFIG.producao.madeira * N && B.recursos.ferro === CONFIG.producao.ferro * N);

const neutras = Engine.aldeiasDe(e1, null);
const recursoNeutra = neutras.some((a) => a.recursos.madeira !== 0 || a.recursos.ferro !== 0);
checa("neutras NAO acumulam recurso", !recursoNeutra);

const inc = CONFIG.neutra.endurecimento;
const intervalo = CONFIG.neutra.endurecimento_intervalo || 1;
const teto = CONFIG.neutra.teto_forca;
const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];
// GABARITO: endurece +inc do SEU tipo a cada `intervalo` turnos, parando no teto.
function esperadoNeutra(unidades, forcaUnit) {
  let u = unidades;
  for (let turno = 1; turno <= N; turno++) {
    if (turno % intervalo !== 0) continue;
    if (teto != null && u * forcaUnit >= teto) break;
    u += inc;
  }
  return u;
}
// endurece no ritmo certo, do SEU tipo, e SO daquele tipo (os outros ficam em 0)
const endurOk = neutras.every((a) =>
  a.tropas[a.tipo] === esperadoNeutra(guarnIni.get(a.id), CONFIG.tropas[a.tipo].forca) &&
  TIPOS.filter((t) => t !== a.tipo).every((t) => a.tropas[t] === 0));
checa(`neutras endurecem +${inc} a cada ${intervalo} turnos do SEU tipo (parando no teto ${teto})`, endurOk);
const exNeutra = neutras[0];
console.log(`     ex.: neutra #${exNeutra.id} ${guarnIni.get(exNeutra.id)} -> ${exNeutra.tropas[exNeutra.tipo]} ${exNeutra.tipo}(s)`);

// ---------------------------------------------------------
//  B) CONSTRUCAO  (timing e custo)
// ---------------------------------------------------------
console.log("\nB) Construcao de tropas (timing e custo):");
const e2 = Engine.criarEstadoInicial(CONFIG);
const a = Engine.aldeiasDe(e2, "A")[0];
// linha de base: o rei nasce com a guarnicao inicial (CONFIG.rei.tropas_iniciais);
// os checks abaixo medem o INCREMENTO da construcao, nao a contagem absoluta.
const baseL = a.tropas.lanceiro, baseC = a.tropas.cavaleiro;
a.recursos.madeira = 100;
a.recursos.ferro = 100;

const okL = Engine.enfileirarConstrucao(e2, a.id, "lanceiro");   // 15 mad / 0 fer, 1 turno
const okC = Engine.enfileirarConstrucao(e2, a.id, "cavaleiro");  // 30 mad / 30 fer, 2 turnos
checa("enfileirou lanceiro e cavaleiro", okL && okC);
checa("custo debitado ao enfileirar (madeira 100-15-30=55)", a.recursos.madeira === 55, `mad ${a.recursos.madeira}`);
checa("custo debitado ao enfileirar (ferro 100-0-30=70)", a.recursos.ferro === 70, `fer ${a.recursos.ferro}`);
checa("2 itens na fila", a.construindo.length === 2);

// tick 1: lanceiro (1 turno) completa; cavaleiro (2 turnos) ainda nao
Engine.tick(e2);
checa("apos 1 turno: lanceiro pronto", a.tropas.lanceiro === baseL + 1, `L${a.tropas.lanceiro}`);
checa("apos 1 turno: cavaleiro AINDA nao", a.tropas.cavaleiro === baseC, `C${a.tropas.cavaleiro}`);
checa("apos 1 turno: 1 item na fila", a.construindo.length === 1);

// tick 2: cavaleiro completa
Engine.tick(e2);
checa("apos 2 turnos: cavaleiro pronto", a.tropas.cavaleiro === baseC + 1, `C${a.tropas.cavaleiro}`);
checa("apos 2 turnos: fila vazia", a.construindo.length === 0);

// ---------------------------------------------------------
//  C) SEM RECURSO NAO CONSTROI
// ---------------------------------------------------------
console.log("\nC) Sem recurso nao constroi:");
const e3 = Engine.criarEstadoInicial(CONFIG);
const c = Engine.aldeiasDe(e3, "A")[0];
c.recursos.madeira = 5; c.recursos.ferro = 0; // insuficiente para qualquer tropa
const okPobre = Engine.enfileirarConstrucao(e3, c.id, "lanceiro");
checa("nao enfileira sem recurso (retorna false)", okPobre === false);
checa("recursos intactos", c.recursos.madeira === 5 && c.recursos.ferro === 0);
checa("fila continua vazia", c.construindo.length === 0);

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
