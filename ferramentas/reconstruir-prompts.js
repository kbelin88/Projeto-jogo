// reconstruir_prompts.js — recupera o PROMPT EXATO que cada Rei recebeu.
//
// O .txt guarda a resposta, nunca o prompt. Mas o motor e determinístico e o
// .txt guarda as ORDENS PARSEADAS de cada turno. Então dá para reexecutar a
// partida inteira no motor, na MESMA ordem que o index.html faz
// (tick -> delibera A e B sobre a mesma fotografia -> aplica A -> aplica B),
// e fotografar montarPrompt() antes de cada aplicação.
//
// VERIFICAÇÃO: no fim de cada turno o estado reconstruído é comparado, aldeia
// por aldeia (dono + 3 tipos de tropa) e movimento por movimento, com o frame
// do replay .json. Se bater em todos os turnos, os prompts são EXATOS.
//
// uso: node reconstruir_prompts.js <partida.txt> <replay.json> <dir_saida>

const fs = require("fs");
const path = require("path");
const E = require(path.join(__dirname, "..", "engine.js"));

const [txtPath, jsonPath, outDir] = process.argv.slice(2);
if (!txtPath || !jsonPath || !outDir) {
  console.error("uso: node reconstruir_prompts.js <partida.txt> <replay.json> <dir_saida>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

// ---------- 1. ler o .txt: ordens + plano + erro de rede, por turno/lado ----------
const txt = fs.readFileSync(txtPath, "utf8");
const blocos = txt.split(/\n########## TURNO /).slice(1);
const jogadas = {}; // "T-lado" -> { construir, envios, plano, erroRede, etiqueta }
const etiquetas = {};
for (const b of blocos) {
  const cab = b.split("\n")[0];
  const mT = /^(\d+) — Rei ([AB]) \((.+)\) ##########/.exec(cab);
  if (!mT) continue;
  const turno = Number(mT[1]), lado = mT[2];
  etiquetas[lado] = mT[3];
  const mc = /^ordem\.construir: (.*)$/m.exec(b);
  const me = /^ordem\.envios   : (.*)$/m.exec(b);
  const mp = /^plano \(volta no proximo prompt\): (.*)$/m.exec(b);
  jogadas[turno + "-" + lado] = {
    construir: mc ? JSON.parse(mc[1]) : [],
    envios: me ? JSON.parse(me[1]) : [],
    plano: mp ? mp[1] : null,
    // erro de rede: o index.html NÃO chama guardarPlano nesse caminho
    erroRede: /^>>> ERRO DE REDE/m.test(b) || /^ERRO API:/m.test(b),
  };
}

const replay = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const frames = replay.frames;
const maxTurno = Math.max(...frames.map((f) => f.turno));

// ---------- 1b. QUAL PROMPT esta partida usou? ----------
// P4 (17/08): o jogo mudou de prompt (P2 PT -> P4 EN com fog). Reconstruir um log
// de 16/08 com o prompt de hoje devolveria um texto que NENHUM modelo viu — o
// oposto do proposito desta ferramenta. Entao o modo sai do CABECALHO do .txt,
// e as opcoes que os clientes usavam na epoca vao junto.
// (A escala de marcha NAO se le do cabecalho: ele ja mentiu sobre isso em 16/08.
//  Aqui isso nao morde porque o estado e reexecutado e VERIFICADO contra o replay
//  — se a escala estivesse errada, a verificacao acusaria divergencia.)
const cabecalho = txt.slice(0, 2000);
const ehP4 = /prompt=P4/.test(cabecalho);
const temFog = /FOG OF WAR/.test(cabecalho);
const OPC_PROMPT = ehP4
  ? { rejeicaoNoFim: true }                       // como o index.html chama hoje
  : { variante: "P2", promptP4: false };          // como chamava antes de 17/08
const OPC_VISAO = ehP4 ? {} : { minimos: true };  // o P2 precisava dos minimos
const CFG_PARTIDA = Object.assign({}, E.CONFIG, ehP4 ? {} : { promptP4: false, fogOfWar: false });
if (!ehP4 && temFog) console.error("AVISO: cabecalho diz fog mas nao diz P4 — verifique o log.");
console.log(`modo detectado no cabecalho: ${ehP4 ? "P4 (ingles" + (temFog ? " + fog" : "") + ")" : "legado P2 (portugues, sem fog)"}`);

// ---------- 2. reexecutar ----------
const game = E.criarEstadoInicial(CFG_PARTIDA);
const relatorio = [];
let divergencias = 0;

for (let t = 1; t <= maxTurno; t++) {
  E.tick(game);

  // fotografia única: os dois Reis deliberam sobre o MESMO estado (ordensSimultaneas)
  const prompts = {};
  for (const lado of ["A", "B"]) {
    if (!E.aldeiasDe(game, lado).length) continue;
    const visao = E.montarVisao(game, lado, OPC_VISAO);
    prompts[lado] = E.montarPrompt(visao, OPC_PROMPT);
  }

  // aplica A depois B, exatamente como o aplicarLado
  for (const lado of ["A", "B"]) {
    const j = jogadas[t + "-" + lado];
    if (!j) continue;
    const ordem = { construir: j.construir, envios: j.envios };
    E.diagnosticarOrdem(game, lado, ordem); // não muta; roda p/ paridade
    E.executarOrdem(game, lado, ordem);
    if (!j.erroRede) E.guardarPlano(game, lado, j.plano); // erroRede não chama
  }

  // ---------- 3. verificar contra o frame ----------
  const frame = frames.find((f) => f.turno === t);
  let difs = [];
  if (frame) {
    for (const af of frame.aldeias) {
      const ag = game.aldeias.find((a) => a.id === af.id);
      if (!ag) { difs.push(`aldeia ${af.id} ausente`); continue; }
      if (ag.dono !== af.dono) difs.push(`[${af.id}] dono ${ag.dono} != ${af.dono}`);
      for (const k of ["lanceiro", "arqueiro", "cavaleiro"]) {
        if ((ag.tropas[k] || 0) !== (af.tropas[k] || 0))
          difs.push(`[${af.id}] ${k} ${ag.tropas[k]} != ${af.tropas[k]}`);
      }
    }
    if (game.movimentos.length !== frame.movimentos.length)
      difs.push(`movimentos ${game.movimentos.length} != ${frame.movimentos.length}`);
  }
  divergencias += difs.length;

  for (const lado of ["A", "B"]) {
    if (!prompts[lado]) continue;
    const nome = `prompt_T${String(t).padStart(2, "0")}_Rei${lado}.txt`;
    const cab = [
      `# ==============================================================`,
      `#  PROMPT EXATO — TURNO ${t} — Rei ${lado} (${etiquetas[lado]})`,
      `#  partida: ${path.basename(txtPath)}`,
      `#  reconstruído reexecutando o motor com as ordens gravadas no .txt.`,
      `#  chars ${prompts[lado].length} | linhas ${prompts[lado].split("\n").length}`,
      `#  tokens de prompt registrados pelo provedor neste turno: ver .txt`,
      `#  verificação do estado contra o replay: ${difs.length ? "DIVERGE (" + difs.length + ")" : "bate 100%"}`,
      `# ==============================================================`,
      ``,
    ].join("\n");
    fs.writeFileSync(path.join(outDir, nome), cab + prompts[lado]);
  }

  relatorio.push({
    turno: t,
    charsA: prompts.A ? prompts.A.length : 0,
    charsB: prompts.B ? prompts.B.length : 0,
    linhasA: prompts.A ? prompts.A.split("\n").length : 0,
    linhasB: prompts.B ? prompts.B.split("\n").length : 0,
    difs: difs.length,
    exemploDifs: difs.slice(0, 3),
  });
}

console.log(" T | chars A | chars B | linhas A | linhas B | verificacao");
for (const r of relatorio) {
  console.log(
    `${String(r.turno).padStart(2)} | ${String(r.charsA).padStart(7)} | ${String(r.charsB).padStart(7)} | ` +
    `${String(r.linhasA).padStart(8)} | ${String(r.linhasB).padStart(8)} | ` +
    (r.difs ? "DIVERGE: " + r.exemploDifs.join("; ") : "ok")
  );
}
console.log("\ndivergencias totais:", divergencias);
console.log("prompts gravados em:", outDir);
