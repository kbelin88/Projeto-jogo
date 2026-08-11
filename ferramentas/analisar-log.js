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
    enviosAjustados: 0,        // clamp (Fase 3): envios que sairam com quantidade reduzida
    tropasMovidas: 0,
    histogramaEnvio: {},        // tamanho -> quantos
    destinos: {},               // destinoId -> quantos envios (monomania)
    construcoesAceitas: { lanceiro: 0, arqueiro: 0, cavaleiro: 0 },
    rejeicoes: {},              // categoria -> contagem
    rejeicoesDetalhe: {},       // linha normalizada -> contagem (transparencia)
    rejeicoesTotal: 0,
    ataques: 0,                 // COMBATE onde este Rei e atacante
    ataquesCounter1: 0,         // desses, com vant=1 (todos os ataques)
    vant0: 0, vantM1: 0,        // A4: distribuicao de counter (vant=0 e vant=-1)
    primeiroAtaqueAlvo: {},     // alvoId -> vant do PRIMEIRO ataque a esse alvo
    enviosLista: [],            // A3: envios EXECUTADOS (ACEITO envio) {turno,destino,tot}
    enviosPedidosLista: [],     // A3: envios PEDIDOS (ordem.envios) — eixo de grounding vs executados
    conquistas: 0,
    turnoUltimaConquista: null,
    infraErros: 0,              // FORA de todos os denominadores
    turnosComRaciocinio: 0,
    turnosSemRaciocinio: 0,
    truncamentos: 0,            // A1: linhas TRUNCADO (so em logs pos-A1)
  };
}

function analisarLog(caminho, replayPath) {
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
  const reAceitoEnvio = /^ACEITO envio \[(\d+)\]->\[(\d+)\]:\s*([0-9LAC+]+)(\s*\(alvo neutra)?/;
  const reAjustado = /^AJUSTADO envio \[(\d+)\]->\[(\d+)\]/; // clamp (Fase 3)
  const reAceitoConstruir = /^ACEITO construir (lanceiro|arqueiro|cavaleiro) em \[(\d+)\]/;
  const reRejeitado = /^REJEITADO:\s*(.+)$/;
  const reCombate = /^COMBATE \[(\d+)\][^:]*:\s*atacante\s+([AB])\b.*?vant=(-?\d+).*?->\s*vence\s+(atacante|defensor)(\s*\(CONQUISTA\))?/;
  // transito por Rei (parenteses) e OPCIONAL: logs antigos (03/08) nao o tem.
  // le "ald/forca" (logs 03/08) E "ald/tropas" (v3, 7.4-C) — o campo virou contagem.
  const rePlacar = /^placar:\s*A\s+(\d+)\s+ald\/(?:forca|tropas)\s+(\d+)\s*\|\s*B\s+(\d+)\s+ald\/(?:forca|tropas)\s+(\d+)\s*\|\s*neutras\s+(\d+)\s*\|\s*transito\s+(\d+)(?:\s*\(A\s+(\d+)\s*\|\s*B\s+(\d+)\))?/;
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

    if (linha.startsWith("TRUNCADO:")) { if (reiAtual) reis[reiAtual].truncamentos++; continue; }

    // A3: envios PEDIDOS (o que o modelo emitiu, antes do clamp/rejeicao do motor)
    if (linha.startsWith("ordem.envios") && reiAtual) {
      try {
        for (const e of JSON.parse(linha.replace(/^ordem\.envios\s*:\s*/, ""))) {
          const t = e.tropas || {};
          reis[reiAtual].enviosPedidosLista.push({
            turno: turnoAtual, destino: e.destinoId,
            tot: (t.lanceiro || 0) + (t.arqueiro || 0) + (t.cavaleiro || 0),
          });
        }
      } catch (_) { /* linha malformada: ignora */ }
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
      r.enviosLista.push({ turno: turnoAtual, destino: parseInt(dest, 10), tot, neutra: !!m[4] });
      continue;
    }

    if ((m = reAjustado.exec(linha)) && reiAtual) {
      reis[reiAtual].enviosAjustados++;
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
      const alvoId = m[1];
      const r = reis[atacante];
      r.ataques++;
      if (vant === 1) r.ataquesCounter1++;
      else if (vant === 0) r.vant0++;
      else if (vant === -1) r.vantM1++;
      // segunda forma da taxa de counter (6.3): so o PRIMEIRO ataque a cada alvo
      // distinto. Descontamina a monomania (martelar o mesmo alvo N vezes).
      if (!(alvoId in r.primeiroAtaqueAlvo)) r.primeiroAtaqueAlvo[alvoId] = vant;
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
        transitoA: m[7] != null ? parseInt(m[7], 10) : null,
        transitoB: m[8] != null ? parseInt(m[8], 10) : null,
      });
      continue;
    }

    if ((m = reFim.exec(linha))) {
      resultadoFinal = { turno: parseInt(m[1], 10), resultado: m[2].trim() };
      continue;
    }
  }

  // --- A3: reforco vs ataque pelo ESTADO DO MOTOR (replay .json), invariante g ---
  // reforco = destino era do PROPRIO rei no INICIO do turno do envio (frame do turno
  // anterior). Sem replay, os campos A3 saem como indisponivel.
  let framesByTurno = null;
  if (replayPath) {
    try {
      const rep = JSON.parse(fs.readFileSync(replayPath, "utf8"));
      framesByTurno = {};
      for (const f of (rep.frames || [])) {
        const mm = {};
        for (const a of (f.aldeias || [])) mm[a.id] = a.dono;
        framesByTurno[f.turno] = mm;
      }
    } catch (e) { framesByTurno = null; }
  }
  const _mediana = (arr) => {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  };
  const _r2 = (x) => Math.round(x * 100) / 100;
  const _soma = (a) => a.reduce((x, y) => x + y, 0);
  const a3De = (r, lado) => {
    if (!framesByTurno) return "indisponivel: sem replay .json (passe-o como 2o argumento ou --replay)";
    const donoNoInicio = (T, d) => {
      const fr = framesByTurno[T - 1] || framesByTurno[T] || framesByTurno[1];
      return fr ? fr[d] : undefined;
    };
    // classifica reforco (destino do PROPRIO rei no inicio do turno) vs ataque.
    const classifica = (lista) => {
      const ref = [], atk = [];
      for (const e of lista) (donoNoInicio(e.turno, e.destino) === lado ? ref : atk).push(e);
      return { ref, atk };
    };
    const exec = classifica(r.enviosLista);        // EXECUTADOS (ACEITO = o motor aceitou)
    const ped = classifica(r.enviosPedidosLista);  // PEDIDOS (ordem.envios = o que o modelo pediu)
    const reforco = exec.ref, ataque = exec.atk;   // metricas de tropa vem do EXECUTADO (invariante g)
    const totsAtq = ataque.map((e) => e.tot);
    const destRef = {}; for (const e of reforco) destRef[e.destino] = (destRef[e.destino] || 0) + 1;
    const maxRef = Object.values(destRef).reduce((a, b) => Math.max(a, b), 0);
    const destAtqSet = new Set(ataque.map((e) => e.destino));
    const faixas = {};
    for (const e of ataque) { const f = Math.floor((e.turno - 1) / 10); (faixas[f] = faixas[f] || []).push(e.tot); }
    const serieFaixa = Object.keys(faixas).sort((a, b) => a - b).map((f) => ({
      turnos: (f * 10 + 1) + "-" + (f * 10 + 10), media: _r2(_soma(faixas[f]) / faixas[f].length), n: faixas[f].length,
    }));
    return {
      // EIXO DE GROUNDING (decisao Lucas 11/08): PEDIDOS (ordem.envios, o que o modelo
      // pediu) vs EXECUTADOS (ACEITO/replay, o que o motor aceitou). A diferenca sao os
      // envios clampados a zero / rejeitados = a MESMA taxa de grounding, medida por outra
      // via. NAO COLAPSAR num numero so: "quantas ordens o modelo emitiu" e "quantas o
      // mundo aceitou" sao os dois lados do grounding. Dois numeros parecidos AQUI NAO sao
      // duplicacao — nao "consertar" unificando.
      envios_reforco_pedidos: ped.ref.length,
      envios_reforco_executados: reforco.length,
      envios_ataque_pedidos: ped.atk.length,
      envios_ataque_executados: ataque.length,
      // tropas/medias abaixo vem do EXECUTADO (o que de facto se moveu no mundo):
      tropas_por_reforco: reforco.length ? _r2(_soma(reforco.map((e) => e.tot)) / reforco.length) : null,
      tropas_por_ataque_media: ataque.length ? _r2(_soma(totsAtq) / ataque.length) : null,
      tropas_por_ataque_mediana: _mediana(totsAtq),
      share_ataques_de_1_tropa: ataque.length ? _r2(ataque.filter((e) => e.tot === 1).length / ataque.length) : null,
      alvos_distintos_atacados: destAtqSet.size,
      reincidencia: ataque.length ? _r2((ataque.length - destAtqSet.size) / ataque.length) : null,
      concentracao_logistica: reforco.length ? _r2(maxRef / reforco.length) : null,
      tropas_por_ataque_por_faixa_de_10t: serieFaixa,
      _nota: "reforco/ataque classificado pelo dono NO INICIO do turno (replay). taxa_ataque_viavel (em derivarRei) e conquistas/COMBATES, nao /envios.",
    };
  };
  const a3 = { A: a3De(reis.A, "A"), B: a3De(reis.B, "B") };

  // --- derivadas por Rei ---
  const derivarRei = (r) => {
    const maxDest = Object.values(r.destinos).reduce((a, b) => Math.max(a, b), 0);
    return {
      envios_aceites: r.enviosAceitos,
      tropas_movidas: r.tropasMovidas,
      tamanho_medio_envio: r.enviosAceitos ? Math.round((r.tropasMovidas / r.enviosAceitos) * 100) / 100 : 0,
      // clamp (Fase 3): envios que sairam reduzidos ao estoque. Denominador ao
      // lado (envios_aceites) — a taxa sozinha nao se le.
      envios_ajustados: r.enviosAjustados,
      taxa_de_clamp: r.enviosAceitos ? Math.round((r.enviosAjustados / r.enviosAceitos) * 100) / 100 : null,
      envios_de_1: r.histogramaEnvio[1] || 0,
      histograma_envio: r.histogramaEnvio,
      construcoes_aceites: r.construcoesAceitas,
      construcoes_total: r.construcoesAceitas.lanceiro + r.construcoesAceitas.arqueiro + r.construcoesAceitas.cavaleiro,
      rejeicoes_total: r.rejeicoesTotal,
      rejeicoes_por_categoria: r.rejeicoes,
      rejeicoes_detalhe_normalizado: r.rejeicoesDetalhe,
      ataques: r.ataques,
      ataques_counter1: r.ataquesCounter1,
      // forma 1: sobre TODOS os ataques (inflada/deflacionada pela monomania)
      taxa_counter_correto: r.ataques ? Math.round((r.ataquesCounter1 / r.ataques) * 100) / 100 : null,
      // forma 2 (6.3): so o PRIMEIRO ataque a cada alvo distinto
      alvos_distintos_atacados: Object.keys(r.primeiroAtaqueAlvo).length,
      taxa_counter_correto_primeiro: Object.keys(r.primeiroAtaqueAlvo).length
        ? Math.round((Object.values(r.primeiroAtaqueAlvo).filter((v) => v === 1).length /
            Object.keys(r.primeiroAtaqueAlvo).length) * 100) / 100
        : null,
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
      truncamentos: r.truncamentos,
      // A4: distribuicao de counter do ATACANTE, contagens absolutas + total
      counter_dist: { vant_mais1: r.ataquesCounter1, vant_0: r.vant0, vant_menos1: r.vantM1, total: r.ataques },
      // denominador correto (A3 nota): conquistas / COMBATES como atacante, NUNCA /envios
      taxa_ataque_viavel: r.ataques ? Math.round((r.conquistas / r.ataques) * 100) / 100 : null,
      // A2 guarda: qualquer metrica derivada de raciocinio so vale com cobertura 100%
      raciocinio_cobertura: (r.turnosComRaciocinio + "/" + (r.turnosComRaciocinio + r.turnosSemRaciocinio)),
      raciocinio_metricas: r.turnosSemRaciocinio > 0
        ? ("indisponivel: cobertura " + r.turnosComRaciocinio + "/" + (r.turnosComRaciocinio + r.turnosSemRaciocinio))
        : "disponivel (cobertura 100%)",
    };
  };

  // --- EXERCITOS EM TRANSITO, media dos turnos ---
  // Decisao 04/08 (briefing 6.3): o campo 'transito' conta EXERCITOS em marcha
  // (movimentos.length), nao tropas. Por isso NAO se reporta "indice de estrada"
  // nos logs historicos — seria unidade trocada (o 0.41 antigo, 17 exercitos a
  // dividir por 25 tropas, esta RETIRADO). Reporta-se a media de exercitos em
  // transito, com o nome certo. O indice de estrada por TROPAS so existe no
  // harness da Fase 6, calculado de estado.movimentos (tropas_em_marcha).
  const media = (getter) => {
    let s = 0, n = 0;
    for (const p of placarSerie) { const v = getter(p); if (v != null) { s += v; n++; } }
    return n ? Math.round((s / n) * 100) / 100 : null;
  };
  const exercitosTransitoMedio = media((p) => p.transito);
  const exercitosTransitoMedioA = media((p) => p.transitoA);
  const exercitosTransitoMedioB = media((p) => p.transitoB);

  return {
    meta,
    reis: {
      A: Object.assign(derivarRei(reis.A), { reforco_vs_ataque: a3.A }),
      B: Object.assign(derivarRei(reis.B), { reforco_vs_ataque: a3.B }),
    },
    partida: {
      turnos_registados: placarSerie.length,
      exercitos_em_transito_medio: exercitosTransitoMedio,
      exercitos_em_transito_medio_A: exercitosTransitoMedioA,
      exercitos_em_transito_medio_B: exercitosTransitoMedioB,
      turno_ultima_conquista_global: ultimaConquistaGlobal,
      placar_final: placarSerie.length ? placarSerie[placarSerie.length - 1] : null,
      resultado_final: resultadoFinal,
    },
    _nota_estrada: "'transito' conta EXERCITOS em marcha (movimentos.length), nao tropas. Por isso reporta-se exercitos_em_transito_medio, NAO 'indice de estrada' (o 0.41 antigo era unidade trocada e esta retirado). O indice por tropas (tropas_em_marcha) so existe no harness da Fase 6, de estado.movimentos. Os logs de 03/08 nao tem transito por Rei (medio_A/B = null).",
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
  let jsonOut = null, replay = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--json") jsonOut = args[++i];
    else if (args[i] === "--replay") replay = args[++i];
    else if (/\.json$/i.test(args[i]) && !replay) replay = args[i]; // 2o positional .json = replay
  }

  const r = analisarLog(arquivo, replay);
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
  linha("envios ajustados (clamp)", A.envios_ajustados, B.envios_ajustados);
  linha("taxa de clamp (ajust/aceites)", A.taxa_de_clamp, B.taxa_de_clamp);
  linha("rejeicoes total", A.rejeicoes_total, B.rejeicoes_total);
  linha("ataques (COMBATE)", A.ataques, B.ataques);
  linha("taxa counter (todos ataques)", A.taxa_counter_correto, B.taxa_counter_correto);
  linha("taxa counter (1o/alvo distinto)", A.taxa_counter_correto_primeiro, B.taxa_counter_correto_primeiro);
  linha("  alvos distintos atacados", A.alvos_distintos_atacados, B.alvos_distintos_atacados);
  linha("indice monomania", A.indice_monomania, B.indice_monomania);
  linha("alvo mais repetido", A.alvo_mais_repetido ? `[${A.alvo_mais_repetido.destinoId}]x${A.alvo_mais_repetido.envios}` : "-",
    B.alvo_mais_repetido ? `[${B.alvo_mais_repetido.destinoId}]x${B.alvo_mais_repetido.envios}` : "-");
  linha("turno ultima conquista", A.turno_ultima_conquista, B.turno_ultima_conquista);
  linha("infra erros (fora)", A.infra_erros, B.infra_erros);
  linha("counter vant +1/0/-1",
    `${A.counter_dist.vant_mais1}/${A.counter_dist.vant_0}/${A.counter_dist.vant_menos1}`,
    `${B.counter_dist.vant_mais1}/${B.counter_dist.vant_0}/${B.counter_dist.vant_menos1}`);
  linha("conquistas/combates (viavel)", `${A.conquistas}/${A.ataques} (${A.taxa_ataque_viavel})`, `${B.conquistas}/${B.ataques} (${B.taxa_ataque_viavel})`);
  linha("raciocinio cobertura", A.raciocinio_cobertura, B.raciocinio_cobertura);
  const RA = A.reforco_vs_ataque, RB = B.reforco_vs_ataque;
  if (RA && typeof RA === "object") {
    console.log("   --- A3 reforco vs ataque (replay, dono no inicio do turno) ---");
    linha("reforco ped/exec (m.trp)", `${RA.envios_reforco_pedidos}/${RA.envios_reforco_executados} (${RA.tropas_por_reforco})`, `${RB.envios_reforco_pedidos}/${RB.envios_reforco_executados} (${RB.tropas_por_reforco})`);
    linha("ataque ped/exec (med/medi)", `${RA.envios_ataque_pedidos}/${RA.envios_ataque_executados} (${RA.tropas_por_ataque_media}/${RA.tropas_por_ataque_mediana})`, `${RB.envios_ataque_pedidos}/${RB.envios_ataque_executados} (${RB.tropas_por_ataque_media}/${RB.tropas_por_ataque_mediana})`);
    linha("share ataques de 1 tropa", RA.share_ataques_de_1_tropa, RB.share_ataques_de_1_tropa);
    linha("alvos distintos atacados (A3)", RA.alvos_distintos_atacados, RB.alvos_distintos_atacados);
    linha("reincidencia", RA.reincidencia, RB.reincidencia);
    linha("concentracao logistica", RA.concentracao_logistica, RB.concentracao_logistica);
    console.log("   tropas/ataque por faixa 10t (A): " + RA.tropas_por_ataque_por_faixa_de_10t.map((x) => x.turnos + ":" + x.media).join("  "));
  } else {
    console.log("   A3 reforco vs ataque: " + RA);
  }
  console.log("   exercitos em transito (media/turno, GLOBAL): " + r.partida.exercitos_em_transito_medio);
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
