// ============================================================
//  Smoke7replay.js — o RUNNER HEADLESS grava replay (18/08)
// ------------------------------------------------------------
//  Rodar:  node testes_arena/Smoke7replay.js   (burro x burro: zero API)
//
//  Porque existe: as baterias correm headless, e ate 18/08 so o browser
//  gravava replay. Sem replay ficam cegas TODAS as metricas que leem o estado
//  do motor em vez de reparsear texto — A3 (reforco vs ataque pelo dono no
//  inicio do turno), deteccao da escala de marcha, alucinacao espacial e
//  reconstrucao de prompt. Na analise da bateria de 17/08 foi preciso
//  reconstruir a posse das aldeias a mao, que e exatamente o que o invariante
//  do projeto proibe: "o .txt narra, o JSON mede".
//
//  Este smoke prova que o replay do headless e INTERCAMBIAVEL com o do
//  browser: as tres ferramentas o consomem sem saber de onde veio.
// ============================================================
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");
const RAIZ = path.join(__dirname, "..");
let falhas = 0;
const ok = (n, c, d) => { if (!c) falhas++; console.log(`  [${c ? "OK " : "XX "}] ${n}${d ? "  -> " + d : ""}`); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke7-"));
const txt = path.join(dir, "p.txt"), rep = path.join(dir, "p.replay.json");
const TURNOS = 8;
execFileSync(process.execPath, [path.join(RAIZ, "runners", "rei_vs_rei.js"), "burro", "burro", "1", String(TURNOS), txt],
  { cwd: RAIZ, stdio: "ignore" });

console.log("\n=== (A) o ficheiro existe e tem a forma do browser ===");
ok("o runner gravou o .replay.json ao lado do .txt", fs.existsSync(rep));
const r = JSON.parse(fs.readFileSync(rep, "utf8"));
ok("um frame por turno", r.frames.length === TURNOS, `${r.frames.length} de ${TURNOS}`);
ok("cabecalho v/versaoDiag como no browser", r.v === 1 && r.versaoDiag === 1);
const f = r.frames[r.frames.length - 1];
for (const k of ["turno", "etiqueta", "etiquetaA", "etiquetaB", "aldeias", "movimentos", "eventos", "diag"])
  ok(`frame tem '${k}'`, k in f);
ok("24 aldeias com dono/tropas/recursos", f.aldeias.length === 24 && f.aldeias.every((a) => "dono" in a && a.tropas && a.recursos));
ok("diag por Rei com recursos do fim do turno", !!(f.diag.A && f.diag.A.recursos) && !!(f.diag.B && f.diag.B.recursos));
ok("diag traz propostas/executadas/rejeicoes", typeof f.diag.A.propostas === "number" && Array.isArray(f.diag.A.rejeicoes));

console.log("\n=== (B) as ferramentas consomem sem saber a origem ===");
const roda = (tool, args) => execFileSync(process.execPath, [path.join(RAIZ, "ferramentas", tool), ...args],
  { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const saidaA = roda("analisar-log.js", [txt, rep]);
ok("analisar-log: bloco A3 sai com dados (nao 'indisponivel')",
  /A3 reforco vs ataque \(replay/.test(saidaA) && !/A3 reforco vs ataque: indisponivel/.test(saidaA));
ok("analisar-log: ataques ped/exec preenchido", /ataque ped\/exec[^\n]*\d+\/\d+/.test(saidaA));
const saidaE = roda("alucinacao-espacial.js", [txt, rep]);
ok("alucinacao-espacial: deduz a escala DO REPLAY (nao assume do CONFIG)",
  /escala de marcha do gabarito: [\d.]+ \(deduzida do replay/.test(saidaE),
  (saidaE.match(/escala de marcha[^\n]*/) || [""])[0].trim());
const saidaR = roda("reconstruir-prompts.js", [txt, rep, path.join(dir, "pr")]);
ok("reconstruir-prompts: verifica o estado e da 0 divergencias", /divergencias totais: 0/.test(saidaR));

console.log(falhas ? `\nSMOKE 7 FALHOU: ${falhas} checagem(ns)` : "\nSmoke7replay: todos ok");
process.exit(falhas ? 1 : 0);
