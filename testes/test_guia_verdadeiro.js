// test_guia_verdadeiro.js — O CLAUDE.md DESCREVE O JOGO QUE EXISTE.
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// O CLAUDE.md é a primeira coisa que qualquer modelo lê ao chegar. Em 22/09
// tinha dez afirmações falsas: "counter ×1.25" (era 1.5 há um mês), "vitória:
// conquistar TODAS as aldeias" (era 75% durante 2 turnos), "o cliente de
// OpenRouter está duplicado, não unificar" (tinha sido unificado nessa manhã),
// "as chaves do protocolo continuam em português" (inglês desde 01/09)… Um
// modelo que confiasse nele escrevia um guião de vídeo com as regras erradas.
//
// É a regra "o log descreve a partida que correu" aplicada ao guia: os números
// que o CLAUDE.md afirma são confrontados com o CONFIG e com as pastas. Mudou
// uma regra? Muda-se o guia na mesma altura, ou isto fica vermelho.
//
// Corre no CI, num clone limpo: não pode depender de ficheiros fora do git.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const E = require(path.join(RAIZ, "engine.js"));
const I = require(path.join(RAIZ, "world-iberia.js"));
const guia = fs.readFileSync(path.join(RAIZ, "CLAUDE.md"), "utf8");
const C = E.CONFIG;

let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };
// o primeiro grupo de `re` no guia, ou falha a dizer o que procurava
const guiaUmaLinha = guia.replace(/\s+/g, " ");   // o Markdown quebra frases a meio
const achar = (re, oque) => {
  const m = guiaUmaLinha.match(re);
  assert.ok(m, "o CLAUDE.md deixou de dizer " + oque + " (procurei " + re + ")");
  return m;
};

t("o counter do triangulo", () => {
  const m = achar(/counter multiplica a força por \*\*([\d.]+)\*\*/, "o valor do counter");
  assert.strictEqual(Number(m[1]), C.bonus_forca_triangulo);
});

t("os bonus de defesa da aldeia e da capital", () => {
  const m = achar(/aldeia \*\*×([\d.]+)\*\*, capital \*\*×([\d.]+)\*\*/, "os bonus de defesa");
  assert.strictEqual(Number(m[1]), C.combate.bonus_defesa_aldeia);
  assert.strictEqual(Number(m[2]), C.combate.bonus_defesa_castelo);
});

t("o atrito do vencedor", () => {
  const m = achar(/atrito (\d+)% da força efetiva/, "o atrito");
  assert.strictEqual(Number(m[1]) / 100, C.combate.atrito_base);
});

t("ataque e defesa de cada tropa", () => {
  const m = achar(/lanceiro (\d+)\/(\d+), arqueiro (\d+)\/(\d+),\s+cavaleiro (\d+)\/(\d+)/, "atq/def das tropas");
  assert.deepStrictEqual(m.slice(1).map(Number), [
    C.tropas.lanceiro.atq, C.tropas.lanceiro.def,
    C.tropas.arqueiro.atq, C.tropas.arqueiro.def,
    C.tropas.cavaleiro.atq, C.tropas.cavaleiro.def]);
});

t("a regra de vitoria", () => {
  const m = achar(/≥ (\d+)% das aldeias \((\d+) de (\d+)\) durante (\d+) turnos/, "a regra de vitoria");
  const n = E.criarEstadoInicial(C).aldeias.length;
  assert.strictEqual(C.vitoriaPorDominancia, true, "o guia fala de dominio e o jogo nao o tem");
  assert.strictEqual(Number(m[1]) / 100, C.vitoriaFracao);
  assert.strictEqual(Number(m[2]), Math.ceil(n * C.vitoriaFracao));
  assert.strictEqual(Number(m[3]), n);
  assert.strictEqual(Number(m[4]), C.vitoriaTurnos);
});

t("a producao, o teto e o endurecimento", () => {
  const p = achar(/\*\*(\d+) madeira e\s+(\d+) ferro\*\*/, "a producao");
  assert.deepStrictEqual([Number(p[1]), Number(p[2])], [C.producao.madeira, C.producao.ferro]);
  const teto = achar(/Teto de (\d+) tropas em casa/, "o teto por aldeia");
  assert.strictEqual(Number(teto[1]), C.limite_tropas_aldeia);
  const nd = achar(/\+(\d+) tropa do seu tipo a cada (\d+) turnos/, "o endurecimento das neutras");
  assert.deepStrictEqual([Number(nd[1]), Number(nd[2])], [C.neutra.endurecimento, C.neutra.endurecimento_intervalo]);
});

t("a escala de marcha e o prompt vivo", () => {
  // `\d+(\.\d+)?` e nao `[\d.]+`: a frase acaba em ponto final, e "0.2." e NaN
  const m = achar(/`escalaMarcha` (\d+(?:\.\d+)?)/, "a escala de marcha");
  assert.strictEqual(Number(m[1]), C.escalaMarcha);
  assert.strictEqual(C.promptP4, true, "o guia diz que o jogo usa o P4");
  assert.strictEqual(C.fogOfWar, true, "o guia diz que ha fog of war");
});

t("a rede de estradas", () => {
  const m = achar(/(\d+) cidades, (\d+) estradas, Lisboa→Barcelona custa (\d+)/, "a rede V2");
  assert.strictEqual(Number(m[1]), I.CIDADES.length);
  assert.strictEqual(Number(m[2]), I.ESTRADAS.length);
  assert.strictEqual(Number(m[3]), I.rota("lisboa", "barcelona").custo);
});

t("o protocolo JSON e em ingles, e o parser aceita as duas linguas", () => {
  achar(/protocolo JSON é em inglês/, "a lingua do protocolo");
  const en = E.parsearOrdem(JSON.stringify({ build: [{ villageId: 0, type: "knight" }], movements: [] }));
  const pt = E.parsearOrdem(JSON.stringify({ construir: [{ aldeiaId: 0, tipo: "cavaleiro" }], envios: [] }));
  assert.deepStrictEqual((en.ordem || en).construir, (pt.ordem || pt).construir);
});

t("o numero de testes e de smokes", () => {
  const n = achar(/\*\*(\d+) ficheiros de teste\*\* em `testes\/` e \*\*(\d+) smokes\*\*/, "quantos testes ha");
  const nt = fs.readdirSync(path.join(RAIZ, "testes")).filter((f) => /\.js$/.test(f)).length;
  const ns = fs.readdirSync(path.join(RAIZ, "testes_arena")).filter((f) => /\.js$/.test(f)).length;
  assert.strictEqual(Number(n[1]), nt, "testes/ tem " + nt + " ficheiros .js");
  assert.strictEqual(Number(n[2]), ns, "testes_arena/ tem " + ns + " ficheiros .js");
});

// ── os ficheiros que o guia nomeia existem ─────────────────────────────────
// Contra o que o GIT tem (e nao o disco desta maquina): no CI o disco e o git,
// e um nome que so existe aqui passava localmente e rebentava la.
t("os ficheiros que o guia nomeia existem no git", () => {
  let versionados;
  try {
    versionados = execSync("git ls-files", { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").filter(Boolean);
  } catch (e) {
    console.log("      (sem git nesta maquina: conferencia de ficheiros saltada)");
    return;
  }
  const porNome = new Set(versionados.map((f) => path.basename(f)));
  const inteiros = new Set(versionados);
  const faltam = [];
  for (const m of guia.matchAll(/`([^`\s]+\.(?:js|html|py|md))`/g)) {
    const nome = m[1];
    if (/[<>*{}]/.test(nome) || nome.includes("://")) continue;   // padroes e URLs, nao ficheiros
    const ok = nome.includes("/") ? inteiros.has(nome) : porNome.has(nome);
    if (!ok) faltam.push(nome);
  }
  assert.deepStrictEqual([...new Set(faltam)], [], "o CLAUDE.md nomeia ficheiros que o git nao tem");
});

console.log(`\ntest_guia_verdadeiro: ${ok} testes ok`);
