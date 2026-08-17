// P4 (17/08): este ficheiro guarda o renderizador LEGADO (PT, P2/P3). O jogo
// vivo usa o P4 (ingles, fog) — coberto por testes/test_prompt_p4.js. Aqui as
// chamadas pedem o legado EXPLICITAMENTE (promptP4:false): o mesmo padrao que
// test_minimo_para_tomar usa ao apontar para CONFIG_V3_ARQUIVO. Sem isto, o
// dispatch levaria estes asserts para o texto ingles e a regressao morreria.
// test_relatorio_v3_disponivel.js — FASE 2 (04/08): bloco de aldeia do relatorio.
//
// Protege o redesenho que ataca as CAUSAS 1 e 2:
//   - as TRES linhas (disponivel AGORA / ja em marcha / fica pronto) aparecem
//     com os numeros CERTOS e SEPARADOS (transito != casa);
//   - uma aldeia SEM transito NAO tem a linha "saiu daqui";
//   - producao ("+N/turno") vem da CONFIG, nao hard-coded;
//   - o cabecalho reafirma "Estes numeros sao do TURNO n".
"use strict";
const assert = require("assert");
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;
const prod = CONFIG.producao;

function aldeia(id, nome, dono, tipo, tropas, recursos, construindo) {
  return {
    id, x: 100 + id, y: 100, nome, dono, tipo: tipo || null,
    recursos: recursos || { madeira: 0, ferro: 0 },
    tropas: Object.assign({ lanceiro: 0, arqueiro: 0, cavaleiro: 0 }, tropas || {}),
    construindo: construindo || [],
  };
}

let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("  ok  " + nome); };

// ---- Cenario 1: aldeia [5] com tropas em casa E um envio em marcha da propria [5]
const estado1 = {
  config: CONFIG,
  turno: 8,
  aldeias: [
    aldeia(5, "Badajoz", "A", null, { lanceiro: 3, arqueiro: 25, cavaleiro: 0 },
      { madeira: 10, ferro: 40 }, [{ tipo: "arqueiro", turnosRestantes: 1 }]),
    aldeia(1, "Santarem", null, "arqueiro", { arqueiro: 1 }),
  ],
  movimentos: [
    // 2 arqueiros que SAIRAM de [5]: NAO estao disponiveis em casa
    { dono: "A", origemId: 5, destinoId: 1, tropas: { lanceiro: 0, arqueiro: 2, cavaleiro: 0 }, turnosRestantes: 1, turnosTotal: 2 },
  ],
  log: [],
};
const rel1 = Engine.relatorioTexto(Engine.montarVisao(estado1, "A"), { promptP4: false });

t("cabecalho reafirma o turno atual", () => {
  assert.ok(rel1.includes("Estes numeros sao do TURNO 8. Ignore quantidades de turnos anteriores."), rel1);
});
t("linha de recursos com nome e producao vinda da CONFIG", () => {
  assert.ok(rel1.includes(`[5] Badajoz | madeira 10 (+${prod.madeira}/turno) | ferro 40 (+${prod.ferro}/turno)`), rel1);
});
t("DISPONIVEL mostra o que esta EM CASA (25 arqueiros), nao 27", () => {
  assert.ok(rel1.includes("DISPONIVEL PARA ENVIAR AGORA: 3 lanceiros, 25 arqueiros, 0 cavaleiros"), rel1);
});
t("linha de marcha SEPARADA, com os 2 que sairam", () => {
  assert.ok(rel1.includes("saiu daqui, ja em marcha (NAO disponivel): 2 arqueiros"), rel1);
});
t("as duas quantidades de arqueiro NAO estao na mesma linha", () => {
  const linhas = rel1.split("\n");
  const casa = linhas.find((l) => l.includes("DISPONIVEL PARA ENVIAR AGORA"));
  const marcha = linhas.find((l) => l.includes("saiu daqui"));
  assert.ok(casa && marcha && casa !== marcha, "linhas distintas");
  assert.ok(casa.includes("25 arqueiros") && !casa.includes("2 arqueiros"), "casa isolada");
  assert.ok(marcha.includes("2 arqueiros") && !marcha.includes("25"), "marcha isolada");
});
t("fica pronto no proximo turno, com o sufixo obrigatorio", () => {
  assert.ok(rel1.includes("fica pronto no proximo turno: 1 arqueiro (nao pode ser enviado neste turno)"), rel1);
});

// ---- Cenario 2: aldeia SEM transito -> a linha "saiu daqui" NAO aparece
const estado2 = {
  config: CONFIG,
  turno: 3,
  aldeias: [
    aldeia(6, "Faro", "A", null, { lanceiro: 5, arqueiro: 0, cavaleiro: 2 }, { madeira: 20, ferro: 10 }, []),
    aldeia(1, "Santarem", null, "arqueiro", { arqueiro: 1 }),
  ],
  movimentos: [], // nenhum em marcha
  log: [],
};
const rel2 = Engine.relatorioTexto(Engine.montarVisao(estado2, "A"), { promptP4: false });

t("aldeia sem transito NAO tem linha 'saiu daqui'", () => {
  assert.ok(!rel2.includes("saiu daqui"), rel2);
});
t("aldeia sem construcao NAO tem linha 'fica pronto'", () => {
  assert.ok(!rel2.includes("fica pronto"), rel2);
});
t("DISPONIVEL aparece mesmo sem transito", () => {
  assert.ok(rel2.includes("DISPONIVEL PARA ENVIAR AGORA: 5 lanceiros, 0 arqueiros, 2 cavaleiros"), rel2);
});

// ---- fallback procedural: sem nome, cai no formato so com id
const estado3 = {
  config: CONFIG, turno: 1,
  aldeias: [
    (() => { const a = aldeia(0, "SEM", "A", null, { lanceiro: 1 }, { madeira: 5, ferro: 0 }, []); a.nome = null; return a; })(),
    aldeia(1, "Santarem", null, "arqueiro", { arqueiro: 1 }),
  ],
  movimentos: [], log: [],
};
const rel3 = Engine.relatorioTexto(Engine.montarVisao(estado3, "A"), { promptP4: false });
t("sem nome -> linha comeca por '[0] | madeira'", () => {
  assert.ok(rel3.includes("[0] | madeira 5 "), rel3);
});

// ---- Cenario 4 (INVARIANTE, pedido do Lucas): a soma das linhas "saiu daqui"
// de TODAS as minhas aldeias tem de igualar o total do MEU transito, sem
// duplicacao. Blinda o filtro origemId===id && dono===me: transito inimigo NAO
// entra, reforco a caminho da minha aldeia so conta na ORIGEM (uma vez).
// O caso planta uma isca: exercito INIMIGO com composicao 5/4/3 (a guarnicao
// inicial do Rei) — se o filtro de dono falhar, ele aparece indevidamente.
const estado4 = {
  config: CONFIG,
  turno: 6,
  aldeias: [
    aldeia(0, "Lisboa", "A", null, { lanceiro: 1, arqueiro: 0, cavaleiro: 0 }, { madeira: 5, ferro: 0 }, []),
    aldeia(2, "Evora", "A", null, { arqueiro: 3 }, { madeira: 10, ferro: 6 }, []),
    aldeia(9, "Inimiga", "B", null, { lanceiro: 20 }),
    aldeia(1, "Santarem", null, "arqueiro", { arqueiro: 1 }),
  ],
  movimentos: [
    { dono: "A", origemId: 0, destinoId: 1, tropas: { lanceiro: 2, arqueiro: 1, cavaleiro: 0 }, turnosRestantes: 1, turnosTotal: 2 },
    { dono: "A", origemId: 2, destinoId: 0, tropas: { lanceiro: 0, arqueiro: 0, cavaleiro: 2 }, turnosRestantes: 1, turnosTotal: 2 }, // reforco p/ MINHA [0]
    { dono: "B", origemId: 9, destinoId: 0, tropas: { lanceiro: 5, arqueiro: 4, cavaleiro: 3 }, turnosRestantes: 2, turnosTotal: 3 }, // ISCA: composicao = guarnicao inicial
  ],
  log: [],
};
const rel4 = Engine.relatorioTexto(Engine.montarVisao(estado4, "A"), { promptP4: false });

t("soma das linhas 'saiu daqui' == meu transito total (sem duplicacao, sem inimigo)", () => {
  // esperado calculado do estado: so os movimentos dono A
  const esperado = estado4.movimentos
    .filter((m) => m.dono === "A")
    .reduce((s, m) => s + m.tropas.lanceiro + m.tropas.arqueiro + m.tropas.cavaleiro, 0);
  // soma o que o relatorio imprimiu nas linhas "saiu daqui"
  let doRelatorio = 0;
  for (const l of rel4.split("\n")) {
    if (!l.includes("saiu daqui")) continue;
    const re = /(\d+)\s+(?:lanceiro|arqueiro|cavaleiro)/g;
    let m;
    while ((m = re.exec(l))) doRelatorio += parseInt(m[1], 10);
  }
  assert.strictEqual(doRelatorio, esperado, `relatorio=${doRelatorio} esperado=${esperado}`);
  assert.strictEqual(esperado, 5, "sanidade: 3 (de [0]) + 2 (de [2]) = 5");
});
t("isca inimiga 5/4/3 NAO aparece em nenhuma linha 'saiu daqui'", () => {
  for (const l of rel4.split("\n")) {
    if (l.includes("saiu daqui")) {
      assert.ok(!(l.includes("5 lanceiros") && l.includes("4 arqueiros") && l.includes("3 cavaleiros")),
        "transito inimigo vazou: " + l);
    }
  }
});

console.log(`\n${ok} testes ok`);
