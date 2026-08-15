# Briefing de revisão — Fable 5 (revisão de código + ideias de futuro)

> Cole ISTO como a primeira mensagem no chat do Fable 5, e anexe os arquivos listados
> em §2. Este documento diz o que revisar, o que NÃO sugerir, e o que quero de volta.

---

## 1. Seu papel

Você é um revisor de código sênior. Vou te dar um projeto — um jogo de estratégia por
turnos onde LLMs jogam como Reis, usado como **benchmark** para medir quão bem um modelo
joga estratégia. Quero **duas coisas**:

1. **Revisão de código** de `engine.js` (o motor) e `index.html` (o jogo no browser):
   bugs, riscos de correção, dívida técnica, pontos frágeis, inconsistências.
2. **Ideias de futuro**: direção de arquitetura, do benchmark e do produto.

Leia o CLAUDE.md PRIMEIRO — ele tem o contexto completo (mecânica, convenções,
invariantes). Não repita de volta o que já está lá; assuma que eu conheço meu projeto.

## 2. O que ler, e em que ordem

1. **`CLAUDE.md`** — contexto, arquitetura, mecânica, convenções e invariantes. Base.
2. **`engine.js`** — o motor puro/determinístico. O coração testável.
3. **`index.html`** — o jogo no browser (~2900 linhas de JS inline num `<script>`):
   render, loop de partida, clientes de API, log/resumo, replay, painel do espectador.
4. **`HANDOFF_2026-08-15.md`** — estado atual e threads abertas.
5. **`RELATORIO_LOTE_C.md`** e **`RELATORIO_LOTE_D.md`** — as últimas mudanças e porquês.

> A branch viva é `spec-lote-d-memoria` (a `main` está velha, ~49 commits atrás — ignore
> a `main`). Os testes estão verdes: 23 do motor + 5 smokes + `test_lote_c.js` 7/7.

## 3. Restrições — NÃO sugira mexer nisto (são decisões deliberadas)

- **Valores de combate / triângulo / custos de unidade:** congelados de propósito, para
  as partidas continuarem comparáveis entre modelos. Não proponha rebalanceamento.
- **Topologia e custos do mapa (`world-iberia.js`), e o encaixe da imagem** (escala
  1.17613): fixos.
- **O padrão de flags default-on / byte-idêntico-quando-off:** é como garantimos que uma
  mudança de prompt não invalida o lote de logs de controlo. Não sugira remover as flags.
- **`index.html` ser um arquivo único** foi uma escolha (abre com `python servir.py`, sem
  build). Pode apontar o custo disso, mas assuma que "quebrar em módulos com um bundler"
  tem um preço que talvez eu não queira pagar — priorize melhorias que NÃO exijam build.
- **Commits sem rodapé de sessão** (repo público). Não é sobre código, mas não sugira o
  contrário.

## 4. O que eu QUERO que você olhe com atenção (perguntas específicas)

1. **Correção do motor:** `resolverCombate`, `minimoParaTomar`/`preverCombateTipos` (têm
   de dar a MESMA conta — é invariante), `turnosDeCaminho` (marcha por custo de rota),
   `tick` (ordem produção→construção→movimento→endurecimento). Algum caso de borda que
   quebra? Alguma divergência entre o número que o Rei LÊ no prompt e o que o motor
   EXECUTA? (essa classe de bug já nos mordeu 3x).
2. **O monolito `index.html`:** onde está a complexidade perigosa? O que dá para extrair
   com baixo risco e SEM build (ex.: mover funções puras para um `.js` incluído por
   `<script>`)? Onde há duplicação com `engine.js`/`rei.js`?
3. **Cliente OpenRouter duplicado:** existe um em `index.html` (`gerarOpenRouter`) e outro
   em `rei.js` (`clienteOpenRouter`). Vale unificar? Como, sem build e sem quebrar o
   caminho do browser?
4. **Mistério aberto:** numa partida real (14/08) tivemos **23 respostas vazias** do
   modelo, causa desconhecida (não era truncamento). Já instrumentamos o browser (D1:
   `finish`/`native_finish_reason`/`error`). Olhando o código dos clientes de API, você
   vê uma causa provável (parsing, retry, pacing, streaming, content vazio vs erro)?
5. **Validade do benchmark:** o `montarVisao`/`relatorioTexto` (o prompt) e o
   `ferramentas/analisar-log.js` (as métricas). As métricas medem o que dizem medir?
   O prompt tem vieses que favorecem um estilo de jogo (ex.: a monocultura de arqueiro
   que observamos)? Como tornar a comparação entre modelos mais rigorosa?
6. **Ideias de futuro (produto):** dado que isto é um benchmark que quer virar produto,
   quais são os 3-5 movimentos de maior alavancagem? (não uma lista de 30 — priorize).

## 5. Formato da resposta que eu quero

- **Priorizado por severidade/alavancagem**, não por ordem de leitura do arquivo.
- Cada achado: **onde** (arquivo + função/linha), **o quê**, **por que importa**, e uma
  **correção concreta** (idealmente um diff ou pseudo-diff pequeno).
- Separe claramente: (A) bugs/correção, (B) dívida técnica/arquitetura, (C) ideias de
  futuro. Comece por (A).
- Se algo estiver bom, diga que está bom e siga — não encha de elogios.
- Se precisar de um arquivo que eu não anexei, peça pelo nome antes de supor.
