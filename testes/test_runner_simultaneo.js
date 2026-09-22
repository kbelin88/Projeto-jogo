// test_runner_simultaneo.js — o runner headless joga o MESMO jogo que o motor.
//
// Ate 23/09 o `runners/rei_vs_rei.js` executava a ordem do Rei A antes de
// montar o prompt do Rei B: B via as marchas que A acabara de ordenar, embora
// o prompt lhe dissesse que as ordens eram simultaneas. O motor (`rodarTurno`)
// e o browser faziam certo desde o LOTE E; o runner, que e por onde correm as
// baterias, nao.
//
// Com o jogador-base dos dois lados nao ha modelo nenhum no meio, portanto o
// replay que o runner grava tem de ser, turno a turno, o estado do motor.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const E = require("../engine.js");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "runner-"));
const saida = path.join(dir, "p.txt");
execFileSync(process.execPath,
  [path.join(__dirname, "..", "runners", "rei_vs_rei.js"), "burro", "burro", "7", "12", saida],
  { stdio: "ignore" });
const rep = JSON.parse(fs.readFileSync(saida.replace(/\.txt$/, ".replay.json"), "utf8"));

const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 7 }));
assert.ok(rep.frames.length >= 12, "o runner gravou " + rep.frames.length + " quadros");
for (let i = 1; i < rep.frames.length; i++) {
  E.rodarTurno(st, { A: E.jogadorBurro, B: E.jogadorBurro });
  const fr = rep.frames[i];
  assert.strictEqual(fr.turno, st.turno);
  assert.deepStrictEqual(fr.aldeias.map((a) => [a.dono, a.tropas]), st.aldeias.map((a) => [a.dono, a.tropas]),
    "o runner divergiu do motor no turno " + st.turno);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`test_runner_simultaneo: ${rep.frames.length - 1} turnos iguais ao motor`);
