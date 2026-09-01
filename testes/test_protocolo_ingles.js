// Aceitacao das chaves inglesas do protocolo (01/09/2026).
const assert = require("assert");
const E = require("../engine.js");
let n = 0;
const t = (nome, f) => { f(); n++; console.log("  ok  " + nome); };

t("chaves EN produzem a MESMA ordem que as PT", () => {
  const en = E.parsearOrdem('{"build":[{"villageId":0,"type":"spearman","quantity":3}],"movements":[{"fromId":0,"toId":1,"troops":{"knight":2,"archer":1}}],"plan":"hold Valencia","statement":"Zaragoza fell."}');
  const pt = E.parsearOrdem('{"construir":[{"aldeiaId":0,"tipo":"lanceiro","quantidade":3}],"envios":[{"origemId":0,"destinoId":1,"tropas":{"cavaleiro":2,"arqueiro":1}}],"plano":"hold Valencia","depoimento":"Zaragoza fell."}');
  assert.ok(en.ok && pt.ok, "as duas parseiam");
  assert.deepStrictEqual(en.ordem, pt.ordem, "ordem identica");
  assert.strictEqual(en.plano, pt.plano);
  assert.strictEqual(en.depoimento, pt.depoimento);
  assert.strictEqual(en.ordem.construir.length, 3, "quantity expandiu em 3");
});

t("usar o nome oficial EN nao conta como normalizacao", () => {
  const r = E.parsearOrdem('{"build":[{"villageId":0,"type":"knight"}],"movements":[]}');
  assert.strictEqual(r.normalizacoes.length, 0, "nao registou desvio: " + JSON.stringify(r.normalizacoes));
});

t("mistura EN+PT no mesmo objeto continua a valer", () => {
  const r = E.parsearOrdem('{"build":[{"aldeiaId":2,"type":"archer"}],"envios":[{"fromId":2,"destinoId":3,"troops":{"spearman":1}}]}');
  assert.ok(r.ok);
  assert.strictEqual(r.ordem.construir[0].aldeiaId, 2);
  assert.strictEqual(r.ordem.construir[0].tipo, "arqueiro");
  assert.strictEqual(r.ordem.envios[0].origemId, 2);
  assert.strictEqual(r.ordem.envios[0].destinoId, 3);
  assert.strictEqual(r.ordem.envios[0].tropas.lanceiro, 1);
});

t("chave PT ganha quando o modelo manda as duas", () => {
  const r = E.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"lanceiro","quantidade":2,"quantity":9}],"envios":[]}');
  assert.strictEqual(r.ordem.construir.length, 2, "valeu quantidade=2, nao quantity=9");
});

t("salvamento parcial funciona com nomes EN", () => {
  const r = E.parsearOrdem('{"build":[{"villageId":0,"type":"spearman"}],"movements":[{"fromId":0,,]}');
  assert.strictEqual(r.ok, false, "a resposta FOI invalida — a metrica nao mente");
  assert.strictEqual(r.ordem.construir.length, 1, "a construcao valida foi recuperada");
});

t("o prompt vivo nao tem uma unica palavra em portugues", () => {
  const cfg = JSON.parse(JSON.stringify(E.CONFIG)); cfg.layout = "iberia"; cfg.seed = 1;
  const e = E.criarEstadoInicial(cfg);
  for (let i = 0; i < 6; i++) E.tick(e);
  for (const dono of ["A", "B"]) {
    const p = E.montarPrompt(E.montarVisao(e, dono), {});
    const achou = p.match(/\b(lanceiro|arqueiro|cavaleiro|construir|envios|aldeiaId|origemId|destinoId|quantidade|tropas|plano|depoimento|madeira|ferro|aldeia|voce|nao|sem tropas)\b/gi);
    assert.ok(!achou, "Rei " + dono + " ainda ve PT: " + (achou || []).join(", "));
  }
});

t("o renderizador LEGADO segue em portugues (nao foi tocado)", () => {
  const cfg = JSON.parse(JSON.stringify(E.CONFIG)); cfg.layout = "iberia"; cfg.seed = 1;
  const e = E.criarEstadoInicial(cfg);
  const p = E.montarPrompt(E.montarVisao(e, "A"), { promptP4: false });
  assert.ok(/Voce e o Rei/.test(p), "o legado tem de continuar a reproduzir os logs antigos");
});

console.log("test_protocolo_ingles: " + n + " testes OK");
