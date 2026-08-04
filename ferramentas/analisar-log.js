// analisar-log.js — FASE 1 do briefing 04/08.
//
// Entrada: um ficheiro partida_*.txt (narrativo, ja gravado em disco).
// Saida: um objeto JSON com metricas POR REI, TUDO por codigo deterministico.
// NENHUM LLM, NENHUMA partida corrida. So le linhas.
//
// Uso:
//   node ferramentas/analisar-log.js <ficheiro.txt> [--json saida.json]
//   const { analisarLog } = require("./analisar-log.js");  // reuso (Fase 6)
//
// Metricas (briefing 1.2), por Rei:
//   - envios aceites, tropas totais movidas, tamanho medio de envio
//   - histograma dos tamanhos de envio
//   - construcoes aceites, por tipo
//   - rejeicoes agrupadas por CATEGORIA (ids/numeros normalizados) + detalhe
//   - taxa de counter correto (vant=1 / total de ataques do Rei)
//   - indice de monomania (% de envios ao alvo mais repetido)
//   - turno da ultima conquista do Rei
//   - erros de infra, contados SEPARADAMENTE e FORA dos denominadores
// Metricas de partida (transito e por-Rei nao e possivel na linha placar):
//   - indice de estrada GLOBAL (transito / forca total), media dos turnos
//   - turno da ultima conquista global
//   - placar/resultado final

const fs = require("fs");
const path = require("path");

const SIGLA = { L: "lanceiro", A: "arqueiro", C: "cavaleiro" };

// --- classificador de rejeicao: normaliza a CAUSA (nao o texto cru) ---
// Recebe o texto depois de "REJEITADO: ". Devolve uma categoria estavel.
// Se aparecer uma causa nova nao prevista, cai num rotulo generico com o
// texto normalizado, para nunca engolir em silencio uma categoria nova.
function categoriaRejeicao(txt) {
  const t = txt.toLowerCase();
  if (t.startsWith("envio")) {
    if (t.includes("tropa que nao tem")) return "envio: tropa que nao tem (estado)";
    if (t.includes("zero tropas")) return "envio: zero tropas (vazio/apos ajuste)";
    if (t.includes("origem") || t.includes("destino")) return "envio: origem/destino invalido";
    return "envio: outro";
  }
  if (t.startsWith("construir")) {
    if (t.includes("recurso insuficiente")) return "construir: recurso insuficiente";
    if (t.includes('campo "tipo"') || t.includes("faltou o campo") || t.includes("tipo"))
      return "construir: formato (faltou/invalido tipo)";
    if (t.includes("teto")) return "construir: teto de forca";
    return "construir: outro";
  }
  return "outro";
}

// normaliza uma linha REJEITADO (para o detalhe transparente): [id]->[N], num->#
function normalizarRejeicao(txt) {
  return txt.replace(/\[[0-9]+\]/g, "[N]").replace(/[0-9]+/g, "#");
}

// soma de tropas numa composicao tipo "2L", "1C", "1L+2A"
function somarComposicao(comp) {
  let tot = 0;
  const re = /(\d+)\s*([LAC])/g;
  let m;
  while ((m = re.exec(comp))) tot += parseInt(m[1], 10);
  return tot;
}

function novoRei() {
  return {
    enviosAceitos: 0,
    tropasMovidas: 0,
    histogramaEnvio: {},        // tamanho -> quantos
    destinos: {},               // destinoId -> quantos envios (monomania)
    construcoesAceitas: { lanceiro: 0, arqueiro: 0, cavaleiro: 0 },
    rejeicoes: {},              // categoria -> contagem
    rejeicoesDetalhe: {},       // linha normalizada -> contagem (transparencia)
    rejeicoesTotal: 0,
    ataques: 0,                 // COMBATE onde este Rei e atacante
    ataquesCounter1: 0,         // desses, com vant=1
    conquistas: 0,
    turnoUltimaConquista: null,
    infraErros: 0,              // FORA de todos os denominadores
    turnosComRaciocinio: 0,
    turnosSemRaciocinio: 0,
  };
}

function analisarLog(caminho) {
  const linhas = fs.readFileSync(caminho, "utf8").split(/\r?\n/);

  const meta = { arquivo: path.basename(caminho), modelos: {}, seed: null, maxTurnos: null, condicoes: null };
  const reis = { A: novoRei(), B: novoRei() };
  const placarSerie = [];
  let resultadoFinal = null;
  let ultimaConquistaGlobal = null;

  let turnoAtual = 0;
  let reiAtual = null;

  const reHeaderTurno = /^#+\s*TURNO\s+(\d+)\s+.*Rei\s+([AB])\s+\((.+)\)\s+#+/;
  const rePartida = /^===\s*PARTIDA\s+Rei\s+A\s+\((.+?)\)\s+vs\s+Rei\s+B\s+\((.+?)\)\s*\|\s*seed\s+(\d+)\s*\|\s*maxTurnos\s+(\d+)/;
  const reAceitoEnvio = /^ACEITO envio \[(\d+)\]->\[(\d+)\]:\s*([0-9LAC+]+)/;
  const reAceitoConstruir = /^ACEITO construir (lanceiro|arqueiro|cavaleiro) em \[(\d+)\]/;
  const reRejeitado = /^REJEITADO:\s*(.+)$/;
  const reCombate = /^COMBATE \[(\d+)\][^:]*:\s*atacante\s+([AB])\b.*?vant=(-?\d+).*?->\s*vence\s+(atacante|defensor)(\s*\(CONQUISTA\))?/;
  const rePlacar = /^placar:\s*A\s+(\d+)\s+ald\/forca\s+(\d+)\s*\|\s*B\s+(\d+)\s+ald\/forca\s+(\d+)\s*\|\s*neutras\s+(\d+)\s*\|\s*transito\s+(\d+)/;
  const reFim = /^===\s*FIM\s*===\s*turno\s+(\d+)\s*\|\s*resultado:\s*(.+)$/;

  for (const linha of linhas) {
    let m;

    if ((m = rePartida.exec(linha))) {
      meta.modelos.A = m[1]; meta.modelos.B = m[2];
      meta.seed = parseInt(m[3], 10); meta.maxTurnos = parseInt(m[4], 10);
      continue;
    }
    if (linha.startsWith("condicoes:")) { meta.condicoes = linha.slice("condicoes:".length).trim(); continue; }

    if ((m = reHeaderTurno.exec(linha))) {
      turnoAtual = parseInt(m[1], 10);
      reiAtual = m[2];
      meta.modelos[reiAtual] = m[3];
      continue;
    }

    // ERRO DE INFRA: conta a parte, FORA de tudo. O turno nao entra em metrica.
    if (linha.startsWith(">>> ERRO DE REDE")) {
      if (reiAtual) reis[reiAtual].infraErros++;
      continue;
    }

    if (linha.startsWith("raciocinio:")) {
      if (reiAtual) {
        if (linha.includes("(nao capturado)")) reis[reiAtual].turnosSemRaciocinio++;
        else reis[reiAtual].turnosComRaciocinio++;
      }
      continue;
    }

    if ((m = reAceitoEnvio.exec(linha)) && reiAtual) {
      const r = reis[reiAtual];
      const dest = m[2];
      const tot = somarComposicao(m[3]);
      r.enviosAceitos++;
      r.tropasMovidas += tot;
      r.histogramaEnvio[tot] = (r.histogramaEnvio[tot] || 0) + 1;
      r.destinos[dest] = (r.destinos[dest] || 0) + 1;
      continue;
    }

    if ((m = reAceitoConstruir.exec(linha)) && reiAtual) {
      reis[reiAtual].construcoesAceitas[m[1]]++;
      continue;
    }

    if ((m = reRejeitado.exec(linha)) && reiAtual) {
      const r = reis[reiAtual];
      const cat = categoriaRejeicao(m[1]);
      const norm = normalizarRejeicao(m[1]);
      r.rejeicoes[cat] = (r.rejeicoes[cat] || 0) + 1;
      r.rejeicoesDetalhe[norm] = (r.rejeicoesDetalhe[norm] || 0) + 1;
      r.rejeicoesTotal++;
      continue;
    }

    if ((m = reCombate.exec(linha))) {
      const atacante = m[2];
      const vant = parseInt(m[3], 10);
      const conquista = !!m[5];
      const r = reis[atacante];
      r.ataques++;
      if (vant === 1) r.ataquesCounter1++;
      if (conquista) {
        r.conquistas++;
        r.turnoUltimaConquista = turnoAtual;
        ultimaConquistaGlobal = turnoAtual;
      }
      continue;
    }

    if ((m = rePlacar.exec(linha))) {
      placarSerie.push({
        turno: turnoAtual,
        aldeiasA: parseInt(m[1], 10), forcaA: parseInt(m[2], 10),
        aldeiasB: parseInt(m[3], 10), forcaB: parseInt(m[4], 10),
        neutras: parseInt(m[5], 10), transito: parseInt(m[6], 10),
      });
      continue;
    }

    if ((m = reFim.exec(linha))) {
      resultadoFinal = { turno: parseInt(m[1], 10), resultado: m[2].trim() };
      continue;
    }
  }

  // --- derivadas por Rei ---
  const derivarRei = (r) => {
    const maxDest = Object.values(r.destinos).reduce((a, b) => Math.max(a, b), 0);
    return {
      envios_aceites: r.enviosAceitos,
      tropas_movidas: r.tropasMovidas,
      tamanho_medio_envio: r.enviosAceitos ? Math.round((r.tropasMovidas / r.enviosAceitos) * 100) / 100 : 0,
      envios_de_1: r.histogramaEnvio[1] || 0,
      histograma_envio: r.histogramaEnvio,
      construcoes_aceites: r.construcoesAceitas,
      construcoes_total: r.construcoesAceitas.lanceiro + r.construcoesAceitas.arqueiro + r.construcoesAceitas.cavaleiro,
      rejeicoes_total: r.rejeicoesTotal,
      rejeicoes_por_categoria: r.rejeicoes,
      rejeicoes_detalhe_normalizado: r.rejeicoesDetalhe,
      ataques: r.ataques,
      ataques_counter1: r.ataquesCounter1,
      taxa_counter_correto: r.ataques ? Math.round((r.ataquesCounter1 / r.ataques) * 100) / 100 : null,
      conquistas: r.conquistas,
      turno_ultima_conquista: r.turnoUltimaConquista,
      indice_monomania: r.enviosAceitos ? Math.round((maxDest / r.enviosAceitos) * 100) / 100 : null,
      alvo_mais_repetido: (() => {
        let melhor = null, n = -1;
        for (const [d, c] of Object.entries(r.destinos)) if (c > n) { n = c; melhor = d; }
        return melhor === null ? null : { destinoId: parseInt(melhor, 10), envios: n };
      })(),
      infra_erros: r.infraErros,
      turnos_com_raciocinio: r.turnosComRaciocinio,
      turnos_sem_raciocinio: r.turnosSemRaciocinio,
    };
  };

  // --- indice de estrada GLOBAL (a linha placar nao separa transito por Rei) ---
  let somaFrac = 0, nFrac = 0;
  for (const p of placarSerie) {
    const denom = p.forcaA + p.forcaB + p.transito;
    if (denom > 0) { somaFrac += p.transito / denom; nFrac++; }
  }
  const indiceEstradaGlobal = nFrac ? Math.round((somaFrac / nFrac) * 1000) / 1000 : null;

  return {
    meta,
    reis: { A: derivarRei(reis.A), B: derivarRei(reis.B) },
    partida: {
      turnos_registados: placarSerie.length,
      indice_estrada_global: indiceEstradaGlobal,
      turno_ultima_conquista_global: ultimaConquistaGlobal,
      placar_final: placarSerie.length ? placarSerie[placarSerie.length - 1] : null,
      resultado_final: resultadoFinal,
    },
    _nota_estrada: "indice_estrada e GLOBAL: a linha 'placar:' traz transito somado dos dois reis, nao separado por Rei.",
  };
}

// --------- CLI ---------
function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("uso: node ferramentas/analisar-log.js <ficheiro.txt> [--json saida.json]");
    process.exit(2);
  }
  const arquivo = args[0];
  let jsonOut = null;
  for (let i = 1; i < args.length; i++) if (args[i] === "--json") jsonOut = args[++i];

  const r = analisarLog(arquivo);
  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(r, null, 2));
    console.log("gravado: " + jsonOut);
  }

  // resumo legivel
  const A = r.reis.A, B = r.reis.B;
  console.log("\n== " + r.meta.arquivo);
  console.log(`   A=${r.meta.modelos.A}  |  B=${r.meta.modelos.B}  |  seed ${r.meta.seed} maxTurnos ${r.meta.maxTurnos}`);
  const linha = (nome, fa, fb) => console.log("   " + String(nome).padEnd(30) + String(fa).padStart(14) + String(fb).padStart(14));
  linha("", "REI A", "REI B");
  linha("envios aceites", A.envios_aceites, B.envios_aceites);
  linha("tropas movidas", A.tropas_movidas, B.tropas_movidas);
  linha("tamanho medio de envio", A.tamanho_medio_envio, B.tamanho_medio_envio);
  linha("envios de 1 tropa", A.envios_de_1, B.envios_de_1);
  linha("construcoes (L/A/C)",
    `${A.construcoes_aceites.lanceiro}/${A.construcoes_aceites.arqueiro}/${A.construcoes_aceites.cavaleiro}`,
    `${B.construcoes_aceites.lanceiro}/${B.construcoes_aceites.arqueiro}/${B.construcoes_aceites.cavaleiro}`);
  linha("rejeicoes total", A.rejeicoes_total, B.rejeicoes_total);
  linha("ataques (COMBATE)", A.ataques, B.ataques);
  linha("taxa counter correto", A.taxa_counter_correto, B.taxa_counter_correto);
  linha("indice monomania", A.indice_monomania, B.indice_monomania);
  linha("alvo mais repetido", A.alvo_mais_repetido ? `[${A.alvo_mais_repetido.destinoId}]x${A.alvo_mais_repetido.envios}` : "-",
    B.alvo_mais_repetido ? `[${B.alvo_mais_repetido.destinoId}]x${B.alvo_mais_repetido.envios}` : "-");
  linha("turno ultima conquista", A.turno_ultima_conquista, B.turno_ultima_conquista);
  linha("infra erros (fora)", A.infra_erros, B.infra_erros);
  console.log("   indice estrada (GLOBAL): " + r.partida.indice_estrada_global);
  console.log("   ultima conquista (global): T" + r.partida.turno_ultima_conquista_global);
  console.log("   REJEICOES POR CATEGORIA:");
  for (const rei of ["A", "B"]) {
    console.log("     Rei " + rei + ":");
    const cats = r.reis[rei].rejeicoes_por_categoria;
    const keys = Object.keys(cats).sort((x, y) => cats[y] - cats[x]);
    if (!keys.length) console.log("       (nenhuma)");
    for (const k of keys) console.log("       " + String(cats[k]).padStart(3) + "  " + k);
  }
}

if (require.main === module) main();
module.exports = { analisarLog, categoriaRejeicao, somarComposicao };
