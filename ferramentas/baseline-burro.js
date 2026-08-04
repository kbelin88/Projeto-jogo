// baseline-burro.js — FASE 0 do briefing 04/08.
//
// Banco de ensaio da ECONOMIA: joga JOGADOR BURRO vs JOGADOR BURRO no mapa
// da Iberia, deterministico, SEM qualquer chamada a modelo de linguagem.
// Mede o TABULEIRO (a economia), nao o jogador. Custa ZERO em API.
//
// Le a CONFIG viva do engine.js: quando a Fase 4 mudar producao/custos, este
// mesmo script re-mede o "depois" sem tocar aqui. NAO hard-codar economia.
//
// Uso:  node ferramentas/baseline-burro.js [seed1 seed2 ...] [--turnos N]
// Sem args: seeds 1,2,3 / 60 turnos. Grava resultados/baseline/burro-seed<N>.json
// e imprime uma tabela comparavel.
//
// Metricas (briefing 0.3), todas por codigo deterministico:
//   - ferro final por aldeia possuida (min/max/media)
//   - madeira final por aldeia possuida (min/max/media)
//   - total de cada tipo de tropa construido na partida
//   - turnos de aldeia ESTRANGULADA por falta de madeira (nao construiu nada
//     apos a producao, madeira < custo da tropa mais barata, e nao esta no teto)
//   - tamanho medio de envio
//   - turno da ULTIMA conquista
//   - placar final

const fs = require("fs");
const path = require("path");
const Engine = require("../engine.js");

const CHEAPEST_WOOD = Math.min(
  ...Object.values(Engine.CONFIG.tropas).map((t) => t.custo.madeira)
);
const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];

function cfgPara(seed) {
  const c = JSON.parse(JSON.stringify(Engine.CONFIG));
  c.layout = "iberia";
  c.seed = seed;
  return c;
}

// Decisor-espia: envolve o jogadorBurro e coleta as metricas por turno, sem
// alterar a decisao (devolve exatamente a mesma ordem).
function makeSpy(cfg, rec) {
  const teto = cfg.limite_forca_aldeia;
  return function (visao) {
    const ordem = Engine.jogadorBurro(visao);

    // construcoes por tipo e por aldeia neste turno
    const builtByVillage = {};
    for (const c of ordem.construir) {
      rec.built[c.tipo] = (rec.built[c.tipo] || 0) + 1;
      builtByVillage[c.aldeiaId] = (builtByVillage[c.aldeiaId] || 0) + 1;
    }

    // estrangulamento por madeira: aldeia que, apos a producao deste turno,
    // NAO construiu nada, tem madeira abaixo do custo da tropa mais barata, e
    // ainda nao bateu o teto de forca (ou seja: QUERIA construir e nao pode).
    for (const a of visao.minhas) {
      const built = builtByVillage[a.id] || 0;
      const forcaCasa =
        a.tropas.lanceiro + a.tropas.arqueiro + a.tropas.cavaleiro +
        a.construindo.length;
      const noTeto = teto != null && forcaCasa >= teto;
      if (built === 0 && a.recursos.madeira < CHEAPEST_WOOD && !noTeto) {
        rec.strangledWoodTurns++;
      }
    }

    // tamanho de envio (o burro so emite envios validos: origem propria, carga
    // = tropas em casa). Conta cada envio nao-vazio.
    for (const e of ordem.envios) {
      const tot = TIPOS.reduce((s, t) => s + (e.tropas[t] || 0), 0);
      if (tot > 0) {
        rec.sendCount++;
        rec.sendTotal += tot;
      }
    }

    return ordem;
  };
}

function estatistica(valores) {
  if (!valores.length) return { min: 0, max: 0, media: 0 };
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  return { min, max, media: Math.round(media * 100) / 100 };
}

function rodarSeed(seed, turnos) {
  const cfg = cfgPara(seed);
  const rec = {
    built: { lanceiro: 0, arqueiro: 0, cavaleiro: 0 },
    strangledWoodTurns: 0,
    sendCount: 0,
    sendTotal: 0,
  };
  const spy = makeSpy(cfg, rec);
  const res = Engine.rodarPartida(cfg, { A: spy, B: spy }, { maxTurnos: turnos });
  const est = res.estado;

  // ferro/madeira final por aldeia POSSUIDA (dono A ou B)
  const owned = est.aldeias.filter((a) => a.dono === "A" || a.dono === "B");
  const ferro = owned.map((a) => a.recursos.ferro);
  const madeira = owned.map((a) => a.recursos.madeira);

  // turno da ultima conquista (combate com conquista=true)
  const conquistas = est.log.filter((l) => l.tipo === "combate" && l.conquista);
  const ultimaConquista = conquistas.length
    ? Math.max(...conquistas.map((c) => c.turno))
    : null;

  const tamMedioEnvio = rec.sendCount
    ? Math.round((rec.sendTotal / rec.sendCount) * 100) / 100
    : 0;

  return {
    seed,
    turnos_jogados: res.turnos,
    resultado: res.vencedor,
    motivo: res.motivo,
    placar: { A: res.aldeiasA, B: res.aldeiasB, neutras: Engine.aldeiasDe(est, null).length },
    ferro_final: estatistica(ferro),
    madeira_final: estatistica(madeira),
    tropas_construidas: rec.built,
    cavaleiros_construidos: rec.built.cavaleiro,
    turnos_estrangulados_madeira: rec.strangledWoodTurns,
    tamanho_medio_envio: tamMedioEnvio,
    envios_totais: rec.sendCount,
    turno_ultima_conquista: ultimaConquista,
    // procedencia: a economia efetivamente usada, para o "depois" comparar
    economia: {
      producao: cfg.producao,
      custos: { lanceiro: cfg.tropas.lanceiro.custo, arqueiro: cfg.tropas.arqueiro.custo, cavaleiro: cfg.tropas.cavaleiro.custo },
      tropa_mais_barata_madeira: CHEAPEST_WOOD,
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  let turnos = 60;
  const seeds = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--turnos") { turnos = parseInt(args[++i], 10); continue; }
    const n = parseInt(args[i], 10);
    if (!Number.isNaN(n)) seeds.push(n);
  }
  if (!seeds.length) seeds.push(1, 2, 3);

  const outDir = path.join(__dirname, "..", "resultados", "baseline");
  fs.mkdirSync(outDir, { recursive: true });

  const linhas = [];
  for (const seed of seeds) {
    const r = rodarSeed(seed, turnos);
    const arq = path.join(outDir, `burro-seed${seed}.json`);
    fs.writeFileSync(arq, JSON.stringify(r, null, 2));
    linhas.push(r);
    console.log(`\n== SEED ${seed}  (${r.turnos_jogados} turnos, ${r.resultado}/${r.motivo}) -> ${path.relative(path.join(__dirname, ".."), arq)}`);
  }

  // tabela comparavel
  const col = (s, w) => String(s).padEnd(w);
  const num = (s, w) => String(s).padStart(w);
  console.log("\n" + "=".repeat(78));
  console.log("  BASELINE BURRO x BURRO — Iberia — " + turnos + " turnos");
  console.log("=".repeat(78));
  console.log(col("metrica", 34) + linhas.map((l) => num("seed " + l.seed, 12)).join(""));
  const row = (nome, fn) =>
    console.log(col(nome, 34) + linhas.map((l) => num(fn(l), 12)).join(""));
  row("placar A/B/neutras", (l) => `${l.placar.A}/${l.placar.B}/${l.placar.neutras}`);
  row("ferro final medio/aldeia", (l) => l.ferro_final.media);
  row("  ferro min / max", (l) => `${l.ferro_final.min}/${l.ferro_final.max}`);
  row("madeira final medio/aldeia", (l) => l.madeira_final.media);
  row("  madeira min / max", (l) => `${l.madeira_final.min}/${l.madeira_final.max}`);
  row("lanceiros construidos", (l) => l.tropas_construidas.lanceiro);
  row("arqueiros construidos", (l) => l.tropas_construidas.arqueiro);
  row("cavaleiros construidos", (l) => l.tropas_construidas.cavaleiro);
  row("turnos estrangulados (madeira)", (l) => l.turnos_estrangulados_madeira);
  row("tamanho medio de envio", (l) => l.tamanho_medio_envio);
  row("envios totais", (l) => l.envios_totais);
  row("turno da ultima conquista", (l) => l.turno_ultima_conquista);
  console.log("=".repeat(78));
}

main();
