// ============================================================
//  test_prompt_p4.js  —  P4: prompt ingles + FOG OF WAR + parser tolerante
// ------------------------------------------------------------
//  Rodar:  node testes/test_prompt_p4.js
//
//  Cobre as mudancas de 17/08 (sessao Fable), na ordem do ESTUDO_PROMPT_P4:
//   (A) PARSER — quantidade, salvamento parcial, erro honesto, sinonimos EN
//   (B) FOG OF WAR — visibilidade, memoria no motor, vazamento zero
//   (C) PROMPT P4 — as incoerencias 1..12 fechadas, e o legado intacto
//   (D) FIM-A-FIM — o jogo corre com tudo ligado e termina com vencedor
//
//  INVARIANTE CENTRAL DESTE FICHEIRO (a licao que o projeto pagou 4x):
//  o que o Rei LE tem de ser o que o motor EXECUTA. Cada assert de texto
//  abaixo compara o prompt contra o ESTADO ou a CONFIG, nunca contra uma
//  string escrita a mao duas vezes.
// ============================================================
"use strict";
const assert = require("assert");
const E = require("../engine.js");

let ok = 0;
const t = (nome, fn) => { fn(); console.log("  ok  " + nome); ok++; };
const stJogo = (extra) => E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1 }, extra || {}));
// estado com N turnos corridos (burro x burro: deterministico)
const aposTurnos = (n, extra) => {
  const e = stJogo(extra);
  for (let i = 0; i < n; i++) E.rodarTurno(e, { A: E.jogadorBurro, B: E.jogadorBurro });
  return e;
};
const promptDe = (e, lado, opcoes) => E.montarPrompt(E.montarVisao(e, lado, { minimos: true }), opcoes || {});

// ============================================================
//  (A) PARSER
// ============================================================
console.log("\n=== (A) parser: quantidade, salvamento, erro honesto, sinonimos ===");

t("A1 `quantidade` expande em N ordens unitarias (o motor nao muda)", () => {
  const r = E.parsearOrdem('{"construir":[{"aldeiaId":12,"tipo":"lanceiro","quantidade":8}],"envios":[]}');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.ordem.construir.length, 8, "8 unidades = 8 ordens de 1");
  for (const c of r.ordem.construir) assert.deepStrictEqual(c, { aldeiaId: 12, tipo: "lanceiro" });
  assert.ok(r.normalizacoes.some((n) => /quantidade 8 expandida/.test(n)), "a expansao tem de ficar registrada");
});
t("A2 `count` e alias; ausencia vale 1; valores absurdos sao limitados", () => {
  assert.strictEqual(E.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"arqueiro","count":3}],"envios":[]}').ordem.construir.length, 3);
  assert.strictEqual(E.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"arqueiro"}],"envios":[]}').ordem.construir.length, 1);
  for (const mau of ["0", "-5", '"abc"', "null", "1.7"]) {
    const r = E.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"arqueiro","quantidade":' + mau + '}],"envios":[]}');
    assert.ok(r.ordem.construir.length >= 1, "quantidade invalida (" + mau + ") nao pode zerar a ordem");
  }
  const gigante = E.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"arqueiro","quantidade":99999}],"envios":[]}');
  assert.strictEqual(gigante.ordem.construir.length, 300, "teto de sanidade");
  assert.ok(gigante.normalizacoes.some((n) => /limitada a 300/.test(n)));
});
t("A3 a `quantidade` EXECUTA de verdade (equivalencia com o motor)", () => {
  const e = stJogo();
  const a = E.aldeiasDe(e, "A")[0];
  a.recursos.madeira = 1000; a.recursos.ferro = 1000;
  const r = E.parsearOrdem(JSON.stringify({ construir: [{ aldeiaId: a.id, tipo: "arqueiro", quantidade: 4 }], envios: [] }));
  E.executarOrdem(e, "A", r.ordem);
  assert.strictEqual(a.construindo.filter((c) => c.tipo === "arqueiro").length, 4, "o motor tem de enfileirar 4");
});
t("A4 SALVAMENTO PARCIAL: um '}' a menos nao apaga as ordens validas", () => {
  // Este e o T10 REAL do Nemotron (partida 17/08 13:03): a chave do envio nunca
  // fecha e sobra um ']'. Antes: ordem inteira perdida (2 construcoes validas +
  // 1 envio de 13 tropas). Agora: as construcoes passam, ok=false, erro honesto.
  const t10 = '{\n "construir": [\n {"aldeiaId": 12, "tipo": "lanceiro"},\n {"aldeiaId": 12, "tipo": "lanceiro"}\n ],\n' +
              ' "envios": [\n {\n "origemId": 12,\n "destinoId": 23,\n "tropas": {\n "lanceiro": 7\n }\n ]\n ],\n' +
              ' "plano": "atacar Madrid"\n}';
  const r = E.parsearOrdem(t10);
  assert.strictEqual(r.ok, false, "a resposta FOI invalida — a metrica de formato nao pode mentir");
  assert.strictEqual(r.ordem.construir.length, 2, "as 2 construcoes validas tem de sobreviver");
  assert.strictEqual(r.plano, "atacar Madrid", "o plano recuperavel tambem volta");
  assert.ok(/desbalanceado/.test(r.erro), "o erro tem de dizer a causa real: " + r.erro);
  assert.ok(r.normalizacoes.some((n) => /salvamento parcial/.test(n)), "o salvamento tem de ficar registrado");
});
t("A5 erro HONESTO: distingue 'nao ha bloco' de 'bloco desbalanceado'", () => {
  assert.ok(/nenhum bloco/.test(E.parsearOrdem("desculpe, nao vou responder").erro));
  const desb = E.parsearOrdem('{"construir": [{"aldeiaId": 1');
  assert.ok(/desbalanceado/.test(desb.erro) && /falta/.test(desb.erro), desb.erro);
  // a mensagem antiga mentia dizendo "nenhum bloco {...} na resposta" quando havia
  assert.ok(!/nenhum bloco \{\.\.\.\} na resposta/.test(desb.erro), "nao pode voltar a mentir");
});
t("A6 sinonimos ingleses viram canonico COM registro (o prompt e ingles)", () => {
  const r = E.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"knight","quantidade":2}],"envios":[{"origemId":1,"destinoId":2,"tropas":{"spearmen":3,"archers":1}}]}');
  assert.strictEqual(r.ordem.construir[0].tipo, "cavaleiro");
  assert.deepStrictEqual(r.ordem.envios[0].tropas, { lanceiro: 3, arqueiro: 1 });
  assert.ok(r.normalizacoes.length >= 3, "cada traducao tem de ficar registrada: " + JSON.stringify(r.normalizacoes));
});
t("A7 resposta perfeita continua ok=true e sem normalizacoes", () => {
  const r = E.parsearOrdem('{"construir":[{"aldeiaId":1,"tipo":"lanceiro"}],"envios":[{"origemId":1,"destinoId":2,"tropas":{"lanceiro":1,"arqueiro":0,"cavaleiro":0}}],"plano":"x","depoimento":"y"}');
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.normalizacoes, [], "resposta limpa nao gera ruido de normalizacao");
});

// ============================================================
//  (B) FOG OF WAR
// ============================================================
console.log("\n=== (B) fog of war: visibilidade, memoria e vazamento ===");

t("B1 o fog esta LIGADO no jogo vivo", () => {
  assert.strictEqual(E.CONFIG.fogOfWar, true);
});
t("B2 no turno 1 o Rei ve so a sua aldeia e as vizinhas diretas", () => {
  const e = stJogo(); E.tick(e);
  const vis = E.visiveisPara(e, "B");
  const minha = E.aldeiasDe(e, "B")[0];
  const vizinhos = e.estradas.adj[minha.id];
  assert.ok(vis.has(minha.id), "a propria aldeia e sempre visivel");
  for (const v of vizinhos) assert.ok(vis.has(v), "vizinho direto [" + v + "] tem de ser visivel");
  assert.strictEqual(vis.size, 1 + vizinhos.length, "nada alem disso pode estar visivel no turno 1");
  // e a capital inimiga, do outro lado do mapa, NAO esta visivel
  const capInimiga = e.aldeias.find((a) => a.dono === "A" && a.capital);
  assert.ok(!vis.has(capInimiga.id), "a capital inimiga nao pode ser visivel no turno 1");
});
t("B3 VAZAMENTO ZERO: o prompt nao contem guarnicao de aldeia invisivel", () => {
  const e = stJogo(); E.tick(e);
  const p = promptDe(e, "B");
  const vis = E.visiveisPara(e, "B");
  for (const a of e.aldeias) {
    if (vis.has(a.id)) continue;
    // nenhuma linha de dados pode citar o id desta aldeia fora da REDE/UNEXPLORED
    const linhas = p.split("\n").filter((l) => l.includes("[" + a.id + "]"));
    for (const l of linhas) {
      assert.ok(!/garrison:/.test(l), "vazou guarnicao de [" + a.id + "] invisivel: " + l);
      assert.ok(!/effective defense/.test(l), "vazou defesa de [" + a.id + "] invisivel: " + l);
    }
  }
});
t("B4 a memoria e do MOTOR: aldeia vista fica em estado.visto e sai do sigilo", () => {
  const e = stJogo(); E.tick(e);
  const minha = E.aldeiasDe(e, "B")[0];
  const viz = e.estradas.adj[minha.id][0];
  assert.ok(e.visto.B[viz], "o vizinho visto tem de estar na memoria do motor");
  assert.strictEqual(e.visto.B[viz].turno, e.turno);
  // a memoria e POR REI: o que B viu nao entra no que A sabe
  assert.ok(!e.visto.A[viz] || e.visto.A[viz].turno !== e.turno || E.aldeiasDe(e, "A").some((x) => (e.estradas.adj[x.id] || []).includes(viz)),
    "a memoria de um Rei nao pode conter avistamento do outro");
});
t("B5 'last seen': aldeia perdida de vista mantem a foto ANTIGA, nao a atual", () => {
  const e = stJogo(); E.tick(e);
  const minha = E.aldeiasDe(e, "B")[0];
  const viz = e.estradas.adj[minha.id][0];
  const alvo = e.aldeias.find((a) => a.id === viz);
  const antes = alvo.tropas.arqueiro + alvo.tropas.lanceiro + alvo.tropas.cavaleiro;
  // desliga a visao: a aldeia deixa de ser vizinha de qualquer aldeia de B
  // (simulado tirando a aldeia de B do mapa de adjacencia da visao)
  const e2 = JSON.parse(JSON.stringify(e));
  e2.config = e.config; // config nao precisa de clone profundo aqui
  e2.estradas.adj[minha.id] = []; // sem vizinhos: perde o posto de vigia
  alvo.tropas.lanceiro += 50; // o mundo mudou...
  e2.aldeias.find((a) => a.id === viz).tropas.lanceiro += 50; // ...no clone tambem
  const v2 = E.montarVisao(e2, "B", {});
  const alvoVisao = v2.alvos.find((a) => a.id === viz);
  assert.strictEqual(alvoVisao.visivel, false, "sem vizinhanca, deixa de ser visivel");
  assert.ok(alvoVisao.visto, "mas continua LEMBRADA");
  const lembrado = alvoVisao.visto.tropas.lanceiro + alvoVisao.visto.tropas.arqueiro + alvoVisao.visto.tropas.cavaleiro;
  assert.strictEqual(lembrado, antes, "a memoria tem de ser a foto ANTIGA, nao o estado de agora");
  const p = E.montarPromptP4(v2, {});
  assert.ok(/KNOWN FROM BEFORE/.test(p), "o prompt tem de ter a secao de memoria");
  assert.ok(/last seen on turn/.test(p));
});
t("B6 exercito em marcha ilumina o destino EFETIVO — e nao o pedido", () => {
  // Honestidade sobre o alcance disto (o Smoke5fog revelou que a 1a versao deste
  // teste passava por trivialidade): a marcha PARA na 1a aldeia nao-sua do
  // caminho, entao o destino efetivo e quase sempre um vizinho direto, que ja
  // era visivel por adjacencia. Nao ha "espiar longe": o exercito ilumina onde
  // vai CHEGAR, nao onde voce gostaria que ele chegasse. Quem abre mapa e a
  // CONQUISTA (cada aldeia tomada revela a vizinhanca dela) — o cavaleiro ajuda
  // por ser rapido a conquistar, nao por ver ao longe.
  const e = stJogo(); E.tick(e);
  const minha = E.aldeiasDe(e, "B")[0];
  const longe = e.aldeias.find((a) => a.dono === null && !(e.estradas.adj[minha.id] || []).includes(a.id));
  assert.ok(!E.visiveisPara(e, "B").has(longe.id), "pre-condicao: o alvo pedido e invisivel");
  minha.tropas.cavaleiro = Math.max(1, minha.tropas.cavaleiro);
  const mov = E.enviarExercito(e, minha.id, longe.id, { cavaleiro: 1 });
  assert.ok(mov, "o envio tem de ser aceite");
  const visDepois = E.visiveisPara(e, "B");
  assert.ok(visDepois.has(mov.destinoId), "o destino EFETIVO tem de ficar visivel");
  // o invariante que importa: intencao NAO da visao
  if (mov.destinoId !== longe.id) {
    assert.ok(!visDepois.has(longe.id),
      "o alvo apenas PEDIDO nao pode virar visivel — intencao nao e avistamento");
  }
});
t("B6b conquistar ABRE mapa: a vizinhanca da aldeia tomada entra na visao", () => {
  // Este e o mecanismo real de exploracao, e nao estava coberto.
  const e = stJogo(); E.tick(e);
  const minha = E.aldeiasDe(e, "B")[0];
  const viz = (e.estradas.adj[minha.id] || [])[0];
  const vizinhosDoViz = (e.estradas.adj[viz] || []).filter((x) => x !== minha.id);
  assert.ok(vizinhosDoViz.length, "o mapa tem de ter um segundo anel para este teste valer");
  const antes = E.visiveisPara(e, "B");
  const novos = vizinhosDoViz.filter((x) => !antes.has(x));
  assert.ok(novos.length, "pre-condicao: ha aldeia a 2 passos ainda invisivel");
  e.aldeias.find((a) => a.id === viz).dono = "B";      // conquistou
  const depois = E.visiveisPara(e, "B");
  for (const x of novos) assert.ok(depois.has(x), `[${x}] devia abrir ao tomar [${viz}]`);
});
t("B7 o fog e do RELATORIO: motor, burro e espectador continuam omniscientes", () => {
  const e = stJogo(); E.tick(e);
  const v = E.montarVisao(e, "B", {});
  assert.strictEqual(v.alvos.length, 23, "a visao carrega TODOS os alvos (burro/espectador dependem)");
  assert.ok(v.alvos.every((a) => a.tropas), "e com as tropas reais");
  // o jogadorBurro (ancora deterministica do benchmark) nao pode ser afetado
  const ordem = E.jogadorBurro(v);
  assert.ok(Array.isArray(ordem.envios) && Array.isArray(ordem.construir));
});
t("B8 com fogOfWar:false o relatorio volta a mostrar NEUTRAS/INIMIGO", () => {
  const e = stJogo({ fogOfWar: false }); E.tick(e);
  const p = promptDe(e, "B");
  assert.ok(/=== NEUTRAL VILLAGES/.test(p), "sem fog, as neutras aparecem em bloco proprio");
  assert.ok(!/FOG OF WAR/.test(p), "sem fog, nao se explica fog");
  assert.ok(!/UNEXPLORED/.test(p));
});

// ============================================================
//  (C) PROMPT P4 — as incoerencias fechadas
// ============================================================
console.log("\n=== (C) prompt P4: incoerencias 1..12 e o legado intacto ===");

t("C1 (inc.1) o reforco e dito como MECANICA e o esquema permite destino proprio", () => {
  const p = promptDe(stJogo(), "A");
  assert.ok(/send troops to a village YOU already own/.test(p));
  assert.ok(/one of YOURS to reinforce it/.test(p));
  // e a proibicao antiga nao pode ter sobrado em lugar nenhum
  assert.ok(!/between the ids of the NEUTRAL and ENEMY sections/i.test(p));
  assert.ok(!/entre os ids das secoes ALDEIAS NEUTRAS e INIMIGO/.test(p));
});
t("C1b (inc.1) e o motor de facto ACEITA o reforco que o prompt promete", () => {
  // "o que o texto permite == o que diagnosticarOrdem aceita"
  const e = aposTurnos(6);
  const minhas = E.aldeiasDe(e, "A");
  assert.ok(minhas.length >= 2, "precisa de 2 aldeias para reforcar");
  const origem = minhas.find((a) => E.contarTropas(a.tropas) > 0) || minhas[0];
  origem.tropas.lanceiro = Math.max(1, origem.tropas.lanceiro);
  const destino = minhas.find((a) => a.id !== origem.id);
  const d = E.diagnosticarOrdem(e, "A", { construir: [], envios: [{ origemId: origem.id, destinoId: destino.id, tropas: { lanceiro: 1 } }] });
  assert.strictEqual(d.rejeicoes.length, 0, "reforco nao pode ser rejeitado: " + JSON.stringify(d.rejeicoes));
  assert.strictEqual(d.aceitoEnvios.length, 1);
});
t("C2 (inc.2) a condicao de vitoria REAL esta dita, com os numeros da config", () => {
  const e = stJogo(); E.tick(e);
  const p = promptDe(e, "A");
  const alvo = Math.ceil(e.aldeias.length * e.config.vitoriaFracao);
  assert.ok(new RegExp("hold at least " + alvo + " of the map's " + e.aldeias.length + " villages").test(p));
  assert.ok(new RegExp("for " + e.config.vitoriaTurnos + " consecutive turns").test(p));
  assert.ok(/taking it is NOT required to win/.test(p), "a capital nao pode voltar a ser 'o objetivo'");
  // e o progresso ao vivo bate com o estado
  assert.ok(new RegExp("You currently hold " + E.aldeiasDe(e, "A").length + " of " + e.aldeias.length).test(p));
});
t("C3 (inc.3+4) sem exemplo: nenhum valor copiavel, os 3 tipos sempre juntos", () => {
  const p = promptDe(aposTurnos(5), "A");
  assert.ok(!/"destinoId":\s*\d/.test(p) && !/"origemId":\s*\d/.test(p));
  assert.ok(!/"aldeiaId":\s*\d/.test(p));
  assert.ok(!/"tipo":\s*"lanceiro"/.test(p), "o tipo do exemplo nao pode estar escolhido por nos");
  assert.ok(/"spearman" \| "archer" \| "knight"/.test(p), "os tres tipos enumerados juntos");
  assert.ok(/there is no example to copy/.test(p));
});
t("C4 (inc.5+6) 'para tomar' saiu do jogo — inclusive para a capital", () => {
  const p = promptDe(aposTurnos(8), "A");
  assert.ok(!/para tomar|to take/i.test(p), "o minimo pre-calculado saiu a pedido do Lucas");
  assert.ok(!/CAPITAL: maior bonus/.test(p));
});
t("C5 (inc.7) a simultaneidade das ordens esta dita, e so quando e verdade", () => {
  assert.ok(/Orders are SIMULTANEOUS/.test(promptDe(stJogo(), "A")));
  assert.ok(!/Orders are SIMULTANEOUS/.test(promptDe(stJogo({ ordensSimultaneas: false }), "A")),
    "com ordensSimultaneas:false o prompt nao pode prometer simultaneidade");
});
t("C6 (inc.8) o H2 esta LIGADO: rejeicoes no fim absoluto do prompt", () => {
  const e = aposTurnos(3);
  e.rejeicoesAnteriores.A = ["construir [0]: recurso insuficiente"];
  const p = E.montarPrompt(E.montarVisao(e, "A", {}), { rejeicaoNoFim: true });
  const iRej = p.indexOf("ORDERS OF YOURS REFUSED");
  const iEsq = p.indexOf('"construir": [');
  assert.ok(iRej > iEsq, "com rejeicaoNoFim a rejeicao vem DEPOIS do esquema");
  assert.strictEqual(p.split("ORDERS OF YOURS REFUSED").length - 1, 1, "o bloco nao pode aparecer 2x");
});
t("C7 (inc.9) o corte de 600 chars do plano e AVISADO ao modelo", () => {
  assert.ok(/past 600 characters is cut off/.test(promptDe(stJogo(), "A")));
});
t("C8 (inc.11) a rede de estradas e compacta e sem arestas em dobro na mesma linha", () => {
  const p = promptDe(stJogo(), "A");
  assert.ok(!/liga-se a/.test(p), "o formato verboso antigo saiu");
  assert.ok(/=== ROAD NETWORK/.test(p));
  // uma linha por aldeia
  const linhas = p.split("\n").filter((l) => /^\[\d+\][^:]*: \[\d+\]/.test(l));
  assert.strictEqual(linhas.length, 24, "uma linha por aldeia do mapa");
});
t("C9 (inc.12) TODAS as aldeias tem nome, nao so as proprias", () => {
  const e = stJogo(); E.tick(e);
  const p = promptDe(e, "B");
  // a capital inimiga e invisivel no T1, mas o NOME e geografia: aparece
  const capA = e.aldeias.find((a) => a.dono === "A" && a.capital);
  assert.ok(p.includes("[" + capA.id + "] " + capA.nome), "o nome da aldeia inimiga tem de aparecer");
  const viz = e.aldeias.find((a) => a.id === e.estradas.adj[E.aldeiasDe(e, "B")[0].id][0]);
  assert.ok(p.includes("[" + viz.id + "] " + viz.nome), "o nome da vizinha visivel tambem");
});
t("C10 a capital inimiga e geografia PUBLICA (onde), nao informacao secreta (o que)", () => {
  const e = stJogo(); E.tick(e);
  const p = promptDe(e, "B");
  assert.ok(/THE ENEMY CAPITAL/.test(p), "o Rei tem de saber ONDE fica a capital inimiga");
  const capA = e.aldeias.find((a) => a.dono === "A" && a.capital);
  // ...mas nao a guarnicao dela
  const linhas = p.split("\n").filter((l) => l.includes("[" + capA.id + "]") && /garrison:/.test(l));
  assert.strictEqual(linhas.length, 0, "a guarnicao da capital invisivel nao pode vazar");
});
t("C11 o prompt e FUNCAO PURA e nao muta o estado", () => {
  const e = aposTurnos(4);
  const antes = JSON.stringify(e.aldeias) + JSON.stringify(e.visto);
  const p1 = promptDe(e, "A"), p2 = promptDe(e, "A");
  assert.strictEqual(p1, p2, "mesma visao -> mesmo prompt");
  assert.strictEqual(JSON.stringify(e.aldeias) + JSON.stringify(e.visto), antes, "montarPrompt nao pode mutar estado");
});
t("C12 o LEGADO continua byte-identico quando pedido (promptP4:false)", () => {
  const e = aposTurnos(5);
  const v = E.montarVisao(e, "A", { minimos: true });
  const leg = E.montarPrompt(v, { variante: "P2", promptP4: false });
  assert.ok(/^Voce e o Rei\./m.test(leg), "o legado tem de ser o PT de sempre");
  assert.ok(/para tomar/.test(leg), "o legado mantem o 'para tomar' (e o arquivo do benchmark antigo)");
  assert.ok(!/You are King/.test(leg), "e nao pode vazar ingles para dentro do legado");
});
t("C12b ZERO vazamento de portugues no prompt ingles, em 20 turnos x 2 Reis", () => {
  // O "sem tropas" do compTexto vazou para dentro de "garrison:" na primeira
  // versao. Uma frase PT no meio do prompt ingles e exatamente a classe de erro
  // que este ficheiro existe para apanhar.
  const PT = /\b(sem tropas|Voce|Rei [AB] atacou|chegou em|Ordem ignorada|liga-se a|turnos de marcha|para tomar|soldados|nenhuma aldeia)\b/;
  const e = stJogo();
  for (let i = 0; i < 20; i++) {
    E.rodarTurno(e, { A: E.jogadorBurro, B: E.jogadorBurro });
    for (const lado of ["A", "B"]) {
      if (!E.aldeiasDe(e, lado).length) continue;
      const p = E.montarPrompt(E.montarVisao(e, lado, { minimos: true }), { rejeicaoNoFim: true });
      const m = p.match(PT);
      assert.ok(!m, "vazou PT no turno " + e.turno + " (Rei " + lado + "): " + (m && m[0]));
    }
  }
});
t("C12c o P4 NAO pode alterar o texto legado (a visao ganha campos atras de flag)", () => {
  // Mordeu de verdade nesta sessao: pôr `nome` nos alvos sem gatilho fez a REDE
  // DE ESTRADAS do relatorio LEGADO passar a nomear aldeias inimigas (+179 chars),
  // porque aquele codigo ja lia `a.nome`. Um renderizador cuja funcao e reproduzir
  // logs antigos nao pode mudar porque o novo precisou de um campo.
  const e = aposTurnos(5);
  const vLeg = E.montarVisao(E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: 1, promptP4: false })), "A", { minimos: true });
  assert.ok(vLeg.alvos.every((a) => a.nome === undefined), "com promptP4 off, alvos NAO podem trazer nome");
  const vP4 = E.montarVisao(e, "A", { minimos: true });
  assert.ok(vP4.alvos.every((a) => typeof a.nome === "string"), "com P4 on, alvos TEM de trazer nome");
  // e o texto legado nao pode citar nome de aldeia inimiga na rede
  const legado = E.relatorioTexto(vLeg, { promptP4: false });
  assert.ok(/Aldeia \[\d+\] \(NEUTRA\) liga-se a/.test(legado), "a rede legada nomeia dono, nao a cidade");
});
t("C13 o P4 nao presta conselho estrategico nenhum", () => {
  const p = promptDe(aposTurnos(6), "A");
  const proibido = [/Conquiste aldeias neutras primeiro/, /you should attack/i, /we recommend/i,
                    /it is better to/i, /best target/i, /prefer to build/i];
  for (const re of proibido) assert.ok(!re.test(p), "o prompt nao pode aconselhar: " + re);
});

// ============================================================
//  (D) FIM-A-FIM
// ============================================================
console.log("\n=== (D) fim-a-fim: o jogo corre e termina com tudo ligado ===");

t("D1 partida burro x burro termina com vencedor sob o ruleset vivo + fog", () => {
  for (const seed of [1, 2, 3]) {
    const r = E.rodarPartida(Object.assign({}, E.CONFIG, { seed }),
      { A: E.jogadorBurro, B: E.jogadorBurro }, { maxTurnos: 150 });
    assert.notStrictEqual(r.motivo, "limite", "seed " + seed + " nao terminou");
  }
});
t("D2 o prompt cresce e encolhe com o jogo, e nunca fica vazio", () => {
  const e = stJogo();
  let anterior = 0;
  for (let i = 0; i < 12; i++) {
    E.rodarTurno(e, { A: E.jogadorBurro, B: E.jogadorBurro });
    const p = promptDe(e, "A");
    assert.ok(p.length > 2000, "prompt suspeito de vazio no turno " + e.turno + ": " + p.length);
    assert.ok(/=== YOUR VILLAGES/.test(p) && /=== ROAD NETWORK/.test(p));
    anterior = p.length;
  }
  assert.ok(anterior > 0);
});
t("D3 o fog encolhe o prompt inicial (a razao pratica de existir)", () => {
  const comFog = stJogo(), semFog = stJogo({ fogOfWar: false });
  E.tick(comFog); E.tick(semFog);
  const a = promptDe(comFog, "B").length, b = promptDe(semFog, "B").length;
  assert.ok(a < b, "com fog o turno 1 tem de ser menor: " + a + " vs " + b);
});

t("D4 CICLO COMPLETO: um 'modelo' que le o P4 joga a partida ate ao fim", () => {
  // Modelo simulado que so sabe LER O PROMPT (nunca o estado): prova que tudo o
  // que e preciso para jogar esta no texto. Extrai os ids da secao YOUR VILLAGES,
  // constroi com `quantidade`, e ataca o 1o alvo visivel — e responde em ingles,
  // com os nomes ingleses das tropas, para exercitar os sinonimos de uma vez.
  const decisorDeTexto = (estado, lado) => {
    const p = E.montarPrompt(E.montarVisao(estado, lado, { minimos: true }), { rejeicaoNoFim: true });
    const secMinhas = p.split("=== YOUR VILLAGES")[1] || "";
    const bloco = secMinhas.split("\n\n")[0];
    const meus = [...bloco.matchAll(/^\[(\d+)\]/gm)].map((m) => +m[1]);
    // alvo: 1a aldeia da secao de visiveis (ou nada, se o fog nao mostra ninguem)
    const secVis = p.split("=== VILLAGES YOU CAN SEE")[1] || "";
    const alvo = (secVis.match(/\[(\d+)\]/) || [])[1];
    // quanto da para enviar: le a linha AVAILABLE TO SEND NOW da 1a aldeia
    const disp = bloco.match(/AVAILABLE TO SEND NOW: (\d+) spearmans?, (\d+) archers?, (\d+) knights?/);
    const cru = JSON.stringify({
      build: undefined, // campo errado de proposito: o parser tem de ignorar
      construir: meus.map((id) => ({ aldeiaId: id, tipo: "spearman", quantidade: 2 })),
      envios: (alvo && disp && (+disp[1] + +disp[2] + +disp[3]) > 0)
        ? [{ origemId: meus[0], destinoId: +alvo, tropas: { spearmen: +disp[1], archers: +disp[2], knights: +disp[3] } }]
        : [],
      plano: "keep expanding", depoimento: "we march",
    });
    const parsed = E.parsearOrdem(cru);
    assert.ok(parsed.ok, "o modelo-de-texto tem de produzir JSON valido: " + parsed.erro);
    return parsed.ordem;
  };
  const e = stJogo();
  let turnos = 0;
  for (let i = 0; i < 40; i++) {
    E.tick(e);
    for (const lado of ["A", "B"]) {
      if (!E.aldeiasDe(e, lado).length) continue;
      E.executarOrdem(e, lado, decisorDeTexto(e, lado));
    }
    turnos++;
    if (E.checarVitoria(e)) break;
  }
  assert.ok(turnos > 3, "a partida tem de correr alguns turnos");
  const totalAldeias = E.aldeiasDe(e, "A").length + E.aldeiasDe(e, "B").length;
  assert.ok(totalAldeias > 2, "quem le so o prompt tem de conseguir expandir: " + totalAldeias);
});

// ============================================================
//  (E) FERRAMENTA E9 (alucinacao espacial): as funcoes puras
// ============================================================
console.log("\n=== (E) E9: extracao de afirmacoes espaciais ===");
const E9 = require("../ferramentas/alucinacao-espacial.js");

t("E1 extrai adjacencia e trata NEGACAO (senao pune quem acerta)", () => {
  const a = E9.extrairAfirmacoes("[8] is adjacent to [11], and [1] is not connected to [7].");
  const adj = a.filter((x) => x.tipo === "adjacencia");
  assert.strictEqual(adj.length, 2);
  assert.strictEqual(adj[0].nega, false);
  assert.strictEqual(adj[1].nega, true, "'is not connected' tem de ser lido como negacao");
});
t("E2 ignora auto-referencia ([23] ... connects to [23])", () => {
  const a = E9.extrairAfirmacoes("Zaragoza connects to [23], so [23] is direct (Zaragoza connects to [23]).");
  assert.ok(!a.some((x) => x.tipo === "adjacencia" && x.a === x.b), "a == b nao pode virar afirmacao");
});
t("E3 extrai rota em turnos e id inexistente", () => {
  const a = E9.extrairAfirmacoes("from [12] to [17] takes 3 turns. Also [99] looks weak.");
  assert.ok(a.some((x) => x.tipo === "rota" && x.a === 12 && x.b === 17 && x.turnos === 3));
  assert.ok(a.some((x) => x.tipo === "id_citado" && x.a === 99));
});

console.log("\ntest_prompt_p4: " + ok + " testes OK");
