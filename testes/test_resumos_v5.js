// test_resumos_v5.js — RESUMOS DO REI (v5): `plano` e `depoimento`
//
// Por que existe: sao dois textos com funcoes OPOSTAS e a confusao entre eles
// seria invisivel numa partida e cara num video.
//   `plano`      VOLTA no prompt do turno seguinte  -> e memoria, muda o jogo.
//   `depoimento` NAO volta, nunca                   -> e narracao, so tela/log.
// Se um dia alguem trocar os dois por engano, o benchmark passa a medir um
// modelo que le a propria retorica de espectador como se fosse plano. Este
// arquivo tranca isso.
const assert = require("assert");
const E = require("../engine.js");

let n = 0;
function t(nome, fn) { fn(); n++; console.log("  ok  " + nome); }

const st = (extra) => E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }, extra || {}));
const prompt = (estado, opcoes) => E.montarPrompt(E.montarVisao(estado, "A", {}), opcoes || {});

// --- 1. A flag: ligada por default, byte-identica quando desligada ---------
t("1a default LIGADA: o prompt pede os dois campos", () => {
  const p = prompt(st());
  assert.ok(/"plano"/.test(p), "prompt tem de pedir plano");
  assert.ok(/"depoimento"/.test(p), "prompt tem de pedir depoimento");
  assert.ok(/NOTA PARA O PROXIMO TURNO/.test(p), "o plano e pedido como nota, nao como resumo");
});
t("1b flag OFF por opcoes: nenhum vestigio dos dois campos", () => {
  const p = prompt(st(), { resumosDoRei: false });
  assert.ok(!/plano/i.test(p), "sem 'plano'");
  assert.ok(!/depoimento/i.test(p), "sem 'depoimento'");
});
t("1c flag OFF por config: o prompt bate BYTE A BYTE com o de opcoes off", () => {
  const porConfig = prompt(st({ resumosDoRei: false }));
  const porOpcoes = prompt(st(), { resumosDoRei: false });
  assert.strictEqual(porConfig, porOpcoes);
});
t("1d ligar a flag SO acrescenta — o prompt antigo continua inteiro dentro", () => {
  const off = prompt(st(), { resumosDoRei: false });
  const on = prompt(st(), { resumosDoRei: true });
  // cada linha do prompt desligado tem de continuar existindo no ligado
  for (const linha of off.split("\n")) {
    if (!linha.trim()) continue;
    assert.ok(on.indexOf(linha) !== -1, "linha perdida ao ligar a flag: " + linha.slice(0, 60));
  }
  assert.ok(on.length > off.length, "o prompt ligado tem de ser maior");
});

// --- 2. O parser: tolerante, os campos sao OPCIONAIS -----------------------
t("2a le os dois campos quando existem", () => {
  const r = E.parsearOrdem('{"construir":[],"envios":[],"plano":"segurar Valencia","depoimento":"Zaragoza caiu."}');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.plano, "segurar Valencia");
  assert.strictEqual(r.depoimento, "Zaragoza caiu.");
});
t("2b campo AUSENTE nao invalida o turno (custo cosmetico = zero)", () => {
  const r = E.parsearOrdem('{"construir":[],"envios":[{"origemId":0,"destinoId":1,"tropas":{"lanceiro":1}}]}');
  assert.strictEqual(r.ok, true, "turno continua valido sem os textos");
  assert.strictEqual(r.plano, null);
  assert.strictEqual(r.depoimento, null);
  assert.strictEqual(r.ordem.envios.length, 1, "as ordens seguem intactas");
});
t("2c campo com tipo errado ou vazio vira null, sem lancar", () => {
  for (const cru of ['{"plano":123}', '{"plano":"   "}', '{"plano":null}', '{"plano":{"a":1}}', '{"plano":[]}']) {
    const r = E.parsearOrdem('{"construir":[],"envios":[],' + cru.slice(1));
    assert.strictEqual(r.plano, null, "deveria virar null: " + cru);
  }
});
t("2d texto verborragico e cortado em 600 chars (nao incha o proximo prompt)", () => {
  const gigante = "x".repeat(5000);
  const r = E.parsearOrdem(JSON.stringify({ construir: [], envios: [], plano: gigante }));
  assert.strictEqual(r.plano.length, 600);
});

// --- 3. guardarPlano: a memoria entre turnos ------------------------------
t("3a o plano guardado aparece no prompt do turno seguinte", () => {
  const e = st();
  assert.ok(!/NOTA DO TURNO ANTERIOR/.test(prompt(e)), "turno 1 nao tem nota");
  E.guardarPlano(e, "A", "Toledo e o eixo. Nao dispersar.");
  const p = prompt(e);
  assert.ok(/NOTA DO TURNO ANTERIOR/.test(p), "a nota tem de voltar");
  assert.ok(p.indexOf("Toledo e o eixo. Nao dispersar.") !== -1);
});
t("3b a nota de A NAO vaza para o prompt de B", () => {
  const e = st();
  E.guardarPlano(e, "A", "SEGREDO DO REI A");
  const pB = E.montarPrompt(E.montarVisao(e, "B", {}), {});
  assert.ok(pB.indexOf("SEGREDO DO REI A") === -1, "o plano e privado de cada Rei");
});
t("3c guardar null/vazio limpa a nota", () => {
  const e = st();
  E.guardarPlano(e, "A", "alguma coisa");
  E.guardarPlano(e, "A", null);
  assert.strictEqual(E.montarVisao(e, "A", {}).planoAnterior, null);
  E.guardarPlano(e, "A", "   ");
  assert.strictEqual(E.montarVisao(e, "A", {}).planoAnterior, null);
});
t("3d com a flag OFF, a nota guardada NAO entra no prompt", () => {
  const e = st();
  E.guardarPlano(e, "A", "NOTA QUE NAO PODE APARECER");
  const p = prompt(e, { resumosDoRei: false });
  assert.ok(p.indexOf("NOTA QUE NAO PODE APARECER") === -1);
});

// --- 4. O INVARIANTE: o depoimento nunca volta ----------------------------
t("4 depoimento NAO tem caminho de volta ao contexto do modelo", () => {
  const e = st();
  const marca = "ISTO_E_NARRACAO_NAO_E_MEMORIA";
  const r = E.parsearOrdem(JSON.stringify({
    construir: [], envios: [], plano: "plano normal", depoimento: marca,
  }));
  assert.strictEqual(r.depoimento, marca, "o parser leu o depoimento");
  // o unico canal para o estado e guardarPlano — e ele so aceita o plano
  E.guardarPlano(e, "A", r.plano);
  E.executarOrdem(e, "A", r.ordem);
  const v = E.montarVisao(e, "A", {});
  assert.ok(JSON.stringify(v).indexOf(marca) === -1, "o depoimento entrou na VISAO");
  assert.ok(prompt(e).indexOf(marca) === -1, "o depoimento entrou no PROMPT");
  assert.ok(JSON.stringify(e).indexOf(marca) === -1, "o depoimento entrou no ESTADO");
});

// --- 5. Nao mexeu no que ja existia ---------------------------------------
t("5a o arquivo v3 nao ganhou a flag (segue congelado)", () => {
  assert.strictEqual(E.CONFIG_V3_ARQUIVO.resumosDoRei, undefined);
  assert.strictEqual(E.CONFIG.resumosDoRei, undefined, "default vem da leitura !== false, nao de um valor gravado");
});
t("5b a ordem executada e a MESMA com e sem os textos", () => {
  const comTexto = '{"construir":[{"aldeiaId":0,"tipo":"lanceiro"}],"envios":[{"origemId":0,"destinoId":1,"tropas":{"cavaleiro":1}}],"plano":"p","depoimento":"d"}';
  const semTexto = '{"construir":[{"aldeiaId":0,"tipo":"lanceiro"}],"envios":[{"origemId":0,"destinoId":1,"tropas":{"cavaleiro":1}}]}';
  const a = E.parsearOrdem(comTexto).ordem, b = E.parsearOrdem(semTexto).ordem;
  assert.deepStrictEqual(a, b, "os textos nao podem alterar a jogada");
});

console.log("test_resumos_v5: " + n + " testes OK");
