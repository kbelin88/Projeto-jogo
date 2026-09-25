// sonda_p5.js — a MESMA decisao pedida com o P4 e com o P5, nos turnos-teste
// escolhidos pelo sonda_casos.js, e cada resposta avaliada pelo motor.
//
// Compara ORDENS, nao partidas: minutos de relogio em vez de uma bateria de
// horas. O gabarito ja existe antes de perguntar (o motor sabe que ataque
// perde, que envios convergem, quanta tropa ficou na retaguarda).
//
// uso:
//   node sonda_p5.js <casos.json> <backend:modelo> [--n 3] [--temp 0] [--saida dir] [--itens a,b]
//   node sonda_p5.js <casos.json> --seco
//
// --itens escolhe o que o P5 leva (omissao: todos): regras (P5-1/2/3),
//         combate (P5-4), intencao (P5-5 sem composicao), interior (P5-6).
//         O passo 3 do §12 corre um grupo por vez contra o P4.
//
// --seco  nao chama modelo nenhum: responde com a ORDEM QUE O REI DEU na partida
//         (a mesma para P4 e P5). Serve para validar o avaliador: o turno
//         seguinte reconstruido tem de dar o que o log deu.
// --burro modelo falso: responde, em JSON do protocolo EN, a ordem do
//         jogador-base. Exercita o caminho inteiro (prompt -> texto -> parser ->
//         avaliacao) sem rede nem cota.
//
// Chave: OPENROUTER_API_KEY no .env da raiz (como o runner). Na nuvem, com a
// chave injetada pelo proxy: NODE_USE_ENV_PROXY=1 (o fetch do Node 22 ignora
// o HTTPS_PROXY sem isso, vai direto e leva 401) e qualquer valor na variavel.
"use strict";
const fs = require("fs");
const path = require("path");
const { carregarMotorP5, montarP5, ITENS_P5 } = require("./p5_prototipo.js");
const { carregar, estadoNoTurno, avaliar, somar, RAIZ } = require("./sonda_comum.js");

const args = process.argv.slice(2);
const casosPath = args[0], modelo = args[1];
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
if (!casosPath || !modelo) {
  console.error("uso: node sonda_p5.js <casos.json> <backend:modelo | --seco> [--n 3] [--temp 0] [--saida dir]");
  process.exit(1);
}
const seco = modelo === "--seco";
const burro = modelo === "--burro";
const N = (seco || burro) ? 1 : Number(opt("--n", 3));
const temp = Number(opt("--temp", 0));
const saida = opt("--saida", null);
const itens = opt("--itens", ITENS_P5.join(",")).split(",").filter(Boolean);
if (!seco && !burro && process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY)
  console.error("aviso: HTTPS_PROXY definido sem NODE_USE_ENV_PROXY=1 -- o fetch vai ignorar o proxy");
if (saida) fs.mkdirSync(saida, { recursive: true });

const E = carregarMotorP5();
const casos = JSON.parse(fs.readFileSync(casosPath, "utf8"));
const cacheP = {};
const partida = (c) => (cacheP[c.caminho] = cacheP[c.caminho] || carregar(c.caminho));

// a ordem interna (construir/envios) escrita como um modelo a escreveria
function ordemEmJsonEN(o) {
  const EN = { lanceiro: "spearman", arqueiro: "archer", cavaleiro: "knight" };
  return JSON.stringify({
    build: o.construir.map((c) => ({ villageId: c.aldeiaId, type: EN[c.tipo], quantity: 1 })),
    movements: o.envios.map((e) => ({ fromId: e.origemId, toId: e.destinoId,
      troops: { spearman: e.tropas.lanceiro || 0, archer: e.tropas.arqueiro || 0, knight: e.tropas.cavaleiro || 0 } })),
    plan: "burro", statement: "burro",
  });
}

async function main() {
  let cliente = null;
  if (!seco && !burro) {
    const Rei = require(path.join(RAIZ, "rei.js"));
    cliente = Rei.criarCliente(modelo, { temperatura: temp, silencioso: true });
  }
  const res = [];   // {categoria, prompt, valido, aval}
  let conferidos = 0, batem = 0;
  for (const [i, c] of casos.entries()) {
    const P = partida(c);
    const g = estadoNoTurno(E, P, c.turno);
    const { p4, p5 } = montarP5(E, g, c.lado, itens);
    for (const [nome, prompt] of [["P4", p4], ["P5", p5]]) {
      for (let k = 0; k < N; k++) {
        let ordem = null, valido = false, cru = "";
        if (seco) {
          const j = P.jog[c.turno + c.lado];
          ordem = { construir: j.construir, envios: j.envios }; valido = true;
        } else if (burro) {
          cru = ordemEmJsonEN(E.jogadorBurro(E.montarVisao(g, c.lado)));
          const p = E.parsearOrdem(cru);
          valido = !!p.ok; ordem = p.ordem;
        } else {
          try { cru = (await cliente.gerar(prompt)).texto || ""; } catch (e) { cru = ""; console.error(`  erro de rede: ${e.message}`); }
          const p = E.parsearOrdem(cru);
          valido = !!p.ok; ordem = p.ordem;
        }
        const aval = avaliar(E, P, c.turno, c.lado, ordem);
        res.push({ categoria: c.categoria, modelo: c.modelo, prompt: nome, valido, aval });
        if (saida && !seco) fs.writeFileSync(path.join(saida, `caso${i}_${nome}_${k}.txt`), cru);
        // no seco, o turno seguinte do avaliador tem de bater com o da PARTIDA
        // REAL: reexecutada ate t+1 por outro caminho (todas as ordens do log),
        // e nao com o proprio avaliador
        if (seco && nome === "P4") {
          conferidos++;
          const real = estadoNoTurno(E, P, c.turno + 1).log.filter((x) => x.turno === c.turno + 1 && x.tipo === "combate" && x.atacante === c.lado);
          const rv = real.filter((x) => x.vencedor === "atacante").length, rd = real.length - rv;
          if (rv === aval.venceram && rd === aval.perderam) batem++;
          else console.error(`\n  diverge: ${c.partida} T${c.turno} ${c.lado}: real ${rv}V ${rd}D, avaliador ${aval.venceram}V ${aval.perderam}D`);
        }
      }
    }
    process.stdout.write(`\r${i + 1}/${casos.length} casos`);
  }
  console.log(`\nP5 com: ${itens.join(", ")}\n`);
  if (seco) console.log(`validacao do avaliador (seco): ${batem}/${conferidos} casos reproduzem o turno gravado\n`);

  // tabela: por categoria, P4 contra P5
  const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + "%" : "-");
  const linha = (rot, lista) => {
    const s = somar(lista.map((r) => r.aval));
    const val = lista.filter((r) => r.valido).length;
    return `${rot.padEnd(22)} resp ${String(lista.length).padStart(3)} | JSON ok ${pct(val, lista.length).padStart(4)} | ataques ${String(s.ataques).padStart(3)} | ja perdiam ${pct(s.jaPerdiam, s.ataques).padStart(4)} | contra reforco visivel ${String(s.contraReforcoVisivel).padStart(2)} | grupos convergentes ${String(s.gruposConvergentes).padStart(2)} | guarnicao enviada ${s.fracGuarnicaoMediana == null ? "  -" : (100 * s.fracGuarnicaoMediana).toFixed(0).padStart(3) + "%"} | retaguarda movida ${pct(s.retaguardaMovida, s.retaguardaTropas).padStart(4)} | no turno seguinte: ${s.venceram}V ${s.perderam}D`;
  };
  const cats = [...new Set(res.map((r) => r.categoria))].sort();
  for (const cat of cats.concat(["TODOS"])) {
    console.log(`== ${cat}`);
    for (const pr of ["P4", "P5"]) console.log("  " + linha(pr, res.filter((r) => r.prompt === pr && (cat === "TODOS" || r.categoria === cat))));
  }
  if (saida) fs.writeFileSync(path.join(saida, "resultado.json"), JSON.stringify({ modelo, temp, n: N, itens, res }, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
