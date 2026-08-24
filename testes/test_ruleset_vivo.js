// test_ruleset_vivo.js — O JOGO CORRE COM AS REGRAS QUE DIZ CORRER.
//
// POR QUE EXISTE (17/08/2026)
// Durante um dia o jogo teve DOIS rulesets escolhiveis em tempo de execucao:
// o congelado (v3) e o "reboot v4", ligado por um checkbox. O estado da
// partida era criado quando a pagina carregava — antes de o utilizador marcar
// a caixa — mas o cabecalho do log lia a caixa AO VIVO. Resultado: tres
// partidas pagas (~$2.25) correram com as regras antigas e foram gravadas como
// se fossem as novas. O erro nao foi um listener em falta. Foi a EXISTENCIA de
// uma regra que podia nao estar ligada.
//
// Este ficheiro tranca as duas pontas:
//   1. so ha UM ruleset jogavel, e e o que pensamos que e;
//   2. o arquivo v3 nao e alcancavel por nenhum caminho de partida;
//   3. os invariantes do motor valem SOB O RULESET VIVO (os outros testes
//      fixam-nos sob o arquivo, que e imutavel — e isso nao chega).
"use strict";
const assert = require("assert");
const E = require("../engine.js");

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log("  ok  " + nome); };

// --- 1. Ha um ruleset so, e e o do jogo ------------------------------------
t("1a nao existe mais um CONFIG_V4 exportado (a escolha morreu)", () => {
  assert.strictEqual(E.CONFIG_V4, undefined,
    "se isto voltar, voltou a haver dois rulesets escolhiveis");
});
t("1b criarEstadoInicial() SEM config usa o ruleset do jogo", () => {
  // este e o caminho que o browser e o runner usam quando nao passam nada
  const st = E.criarEstadoInicial();
  assert.strictEqual(st.config.producao.madeira, E.CONFIG.producao.madeira);
  assert.strictEqual(st.config.escalaMarcha, E.CONFIG.escalaMarcha);
  assert.strictEqual(st.config.vitoriaPorDominancia, true);
});
t("1c o arquivo v3 e DIFERENTE do jogo em tudo o que importa", () => {
  const a = E.CONFIG_V3_ARQUIVO, v = E.CONFIG;
  assert.notStrictEqual(a.producao.madeira, v.producao.madeira);
  assert.notStrictEqual(a.producao.ferro, v.producao.ferro);
  assert.notStrictEqual(a.bonus_forca_triangulo, v.bonus_forca_triangulo);
  assert.strictEqual(a.escalaMarcha, undefined);
  assert.strictEqual(a.vitoriaPorDominancia, undefined);
});
t("1d mexer no estado de uma partida NAO contamina o ruleset", () => {
  const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 7 }));
  st.config.producao.madeira = 999;
  assert.strictEqual(E.CONFIG.producao.madeira, 30, "o CONFIG global foi mutado por uma partida");
});

// --- 2. O ruleset vivo tem as consequencias que dizemos que tem ------------
const stJogo = (extra) => E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }, extra || {}));

t("2a producao observada = producao declarada (30 madeira / 20 ferro)", () => {
  const st = stJogo();
  const a = st.aldeias.find((x) => x.dono === "A");
  const m0 = a.recursos.madeira, f0 = a.recursos.ferro;
  E.tick(st);
  assert.strictEqual(a.recursos.madeira - m0, 30);
  assert.strictEqual(a.recursos.ferro - f0, 20);
});
t("2b o cavaleiro e comprável: <=1.5 turnos de producao por unidade", () => {
  const u = E.CONFIG.tropas.cavaleiro;
  const turnos = Math.max(u.custo.madeira / E.CONFIG.producao.madeira,
                          u.custo.ferro / E.CONFIG.producao.ferro);
  assert.ok(turnos <= 1.5 + 1e-9,
    "cavaleiro a " + turnos.toFixed(2) + " turnos/unidade — se passar de 1.5 ninguem o constroi");
});
t("2c a marcha executada e a que o RELATORIO promete (o bug que mordeu 3x)", () => {
  const st = stJogo();
  const minhas = E.aldeiasDe(st, "A");
  const origem = minhas[0];
  const alvo = st.aldeias.find((a) => a.dono === null);
  const tropas = { lanceiro: 0, arqueiro: 1, cavaleiro: 0 };
  const caminho = E.caminhoEntre(st, origem.id, alvo.id);
  const prometido = E.turnosDeCaminho(st, caminho, tropas);
  // agora EXECUTA e ve quanto o motor cobra de facto
  origem.tropas.arqueiro = Math.max(1, origem.tropas.arqueiro);
  const mov = E.enviarExercito(st, origem.id, alvo.id, tropas);
  assert.ok(mov, "o envio tem de ser aceite");
  assert.strictEqual(mov.turnosRestantes, prometido,
    "o motor cobrou " + mov.turnosRestantes + " turnos e o relatorio prometeu " + prometido);
});
t("2d a escala de marcha esta MESMO aplicada (nao e so um campo no config)", () => {
  const comEscala = stJogo();
  const semEscala = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1, escalaMarcha: 1 }));
  const par = (st) => {
    const o = E.aldeiasDe(st, "A")[0];
    const d = st.aldeias.find((a) => a.dono === "B");
    return E.turnosDeCaminho(st, E.caminhoEntre(st, o.id, d.id), { lanceiro: 1, arqueiro: 0, cavaleiro: 0 });
  };
  const a = par(comEscala), b = par(semEscala);
  assert.ok(a < b, "capital a capital: com escala " + a + " turnos, sem escala " + b +
    " — se forem iguais, a escala nao esta a ser aplicada");
});
t("2e o prompt do jogo NAO prescreve a ordem de conquista", () => {
  const p = E.montarPrompt(E.montarVisao(stJogo(), "A", {}), {});
  assert.ok(!/Conquiste aldeias neutras primeiro/.test(p));
  // P4 (17/08): o prompt do jogo vivo e em INGLES. O FACTO tem de ficar.
  assert.ok(/produces resources every turn/i.test(p), "o FACTO tem de ficar");
});
// P4 (17/08) — o prompt que o jogo REALMENTE usa e o P4, e nao prescreve jogada.
// Este bloco existe pelo mesmo motivo do resto do ficheiro: provar que a coisa
// ligada e a que pensamos. O bug do toggle nasceu de acreditar sem conferir.
t("2e2 o prompt VIVO e o P4 (ingles); o legado so vem se for pedido", () => {
  assert.strictEqual(E.CONFIG.promptP4, true, "o jogo vivo tem de estar no P4");
  const v = E.montarVisao(stJogo(), "A", {});
  const p = E.montarPrompt(v, {});
  assert.ok(/You are King A/.test(p), "o prompt vivo tem de ser o P4 em ingles");
  assert.ok(!/Voce e o Rei/.test(p), "o prompt vivo nao pode cair no legado PT");
  assert.ok(/Voce e o Rei/.test(E.montarPrompt(v, { promptP4: false })), "o legado tem de continuar alcancavel quando PEDIDO");
});
t("2e3 o P4 nao tem exemplo com valores nem minimo pre-calculado", () => {
  const p = E.montarPrompt(E.montarVisao(stJogo(), "A", { minimos: true }), {});
  assert.ok(!/para tomar|to take/i.test(p), "o minimo pre-calculado saiu do jogo — nao pode voltar");
  assert.ok(!/"destinoId":\s*\d/.test(p), "exemplo com ids concretos nao pode voltar");
  assert.ok(!/"aldeiaId":\s*\d/.test(p), "exemplo com ids concretos nao pode voltar");
  assert.ok(!/"lanceiro":\s*\d/.test(p), "exemplo com quantidades nao pode voltar");
  assert.ok(/"spearman" \| "archer" \| "knight"/.test(p), "o esquema tem de enumerar os TRES tipos juntos");
});
t("2e4 o P4 diz as regras que o motor EXECUTA (vitoria, simultaneidade, reforco, endurecimento)", () => {
  const p = E.montarPrompt(E.montarVisao(stJogo(), "A", {}), {});
  const alvo = Math.ceil(24 * E.CONFIG.vitoriaFracao);
  assert.ok(new RegExp("hold at least " + alvo + " of the map's 24 villages").test(p),
    "a condicao de vitoria tem de estar dita, com o numero certo");
  assert.ok(new RegExp("for " + E.CONFIG.vitoriaTurnos + " consecutive turns").test(p));
  assert.ok(/taking it is NOT required to win/.test(p), "nao pode voltar a dizer que o objetivo E a capital");
  assert.ok(/Orders are SIMULTANEOUS/.test(p), "a simultaneidade (LOTE E) tem de estar dita");
  assert.ok(/send troops to a village YOU already own/.test(p), "o reforco tem de estar dito como mecanica");
  assert.ok(/one of YOURS to reinforce it/.test(p), "o esquema tem de permitir destino proprio");
  assert.ok(/Neutral villages harden with time/.test(p), "o endurecimento das neutras tem de estar dito");
});
t("2f a partida TERMINA: vitoria por dominancia esta ligada", () => {
  assert.strictEqual(E.CONFIG.vitoriaFracao, 0.75);
  assert.strictEqual(E.CONFIG.vitoriaTurnos, 2);
  for (const seed of [1, 2, 3]) {
    const r = E.rodarPartida(Object.assign({}, E.CONFIG, { seed }),
      { A: E.jogadorBurro, B: E.jogadorBurro }, { maxTurnos: 120 });
    assert.notStrictEqual(r.motivo, "limite", "seed " + seed + " bateu no teto sem vencedor");
  }
});

// --- 3. minimoParaTomar continua a bater com o combate, SOB O JOGO ---------
// (test_minimo_para_tomar fixa isto sob o arquivo; o ruleset vivo mudou o
//  counter de 1.25 para 1.5 e a conta tem de continuar a fechar)
t("3 minimoParaTomar == preverCombateTipos sob o ruleset vivo", () => {
  const st = stJogo();
  let checados = 0;
  for (const alvo of st.aldeias) {
    if (alvo.dono === "A") continue;
    for (const atkType of ["lanceiro", "arqueiro", "cavaleiro"]) {
      const min = E.minimoParaTomar(st, atkType, alvo);
      if (min == null) continue;
      const atq = st.config.tropas[atkType].atq;
      // a MESMA conta que o motor faz no combate, com o minimo e com um a menos
      const rec = (n) => E.preverCombate(st, { lanceiro: atkType === "lanceiro" ? n : 0,
                                               arqueiro: atkType === "arqueiro" ? n : 0,
                                               cavaleiro: atkType === "cavaleiro" ? n : 0 }, alvo);
      assert.strictEqual(rec(min).atacanteVence, true,
        `[${alvo.id}] ${min} ${atkType}(s) e o minimo mas NAO toma`);
      if (min > 1) {
        assert.strictEqual(rec(min - 1).atacanteVence, false,
          `[${alvo.id}] ${min - 1} ${atkType}(s) ja tomava — o minimo esta alto`);
      }
      checados++;
    }
  }
  assert.ok(checados >= 20, "esperava >=20 combinacoes checadas, deu " + checados);
});

console.log("test_ruleset_vivo: " + n + " testes OK");
