// LOTE C, E12.1 — captura/compara 3 outputs de referencia do relatorioTexto.
// Uso: node _capturar.js gravar   (grava a baseline)
//      node _capturar.js conferir [flags-json]  (compara; flags passadas a relatorioTexto)
const E = require("../../engine.js");
const fs = require("fs");
const path = require("path");
const DIR = __dirname;

function estadoNoTurno(n) {
  const cfg = JSON.parse(JSON.stringify(E.CONFIG));
  cfg.layout = "iberia"; cfg.seed = 1;
  // LOTE E: gera o ESTADO com as flags de comportamento do motor off, para a
  // baseline de texto (capturada no motor pre-E) continuar valendo (regra 2).
  cfg.ordensSimultaneas = false; cfg.interceptaChegada = false; cfg.desempateEstradaRng = false;
  const e = E.criarEstadoInicial(cfg);
  const dec = { A: (v) => E.jogadorBurro(v), B: (v) => E.jogadorBurro(v) };
  for (let i = 0; i < n; i++) E.rodarTurno(e, dec);
  return e;
}
const ESTADOS = [["s1_inicio", 1], ["s2_meio", 20], ["s3_avancado", 45]];

function texto(n, opcoes) {
  const e = estadoNoTurno(n);
  const visao = E.montarVisao(e, "A", { minimos: true });
  return E.relatorioTexto(visao, opcoes);
}

const modo = process.argv[2] || "conferir";
const opcoes = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;

if (modo === "gravar") {
  for (const [nome, n] of ESTADOS) fs.writeFileSync(path.join(DIR, nome + ".txt"), texto(n, opcoes));
  console.log("baseline gravada:", ESTADOS.map((x) => x[0]).join(", "));
} else {
  let ok = true;
  for (const [nome, n] of ESTADOS) {
    const ref = fs.readFileSync(path.join(DIR, nome + ".txt"), "utf8");
    const atual = texto(n, opcoes);
    if (ref === atual) console.log("  IDENTICO " + nome);
    else {
      ok = false;
      console.log("  DIFERENTE " + nome);
      const ra = ref.split("\n"), aa = atual.split("\n");
      for (let i = 0; i < Math.max(ra.length, aa.length); i++)
        if (ra[i] !== aa[i]) { console.log("    L" + i + " ref: " + JSON.stringify(ra[i])); console.log("    L" + i + " atu: " + JSON.stringify(aa[i])); if (i > 3) break; }
    }
  }
  process.exit(ok ? 0 : 1);
}
