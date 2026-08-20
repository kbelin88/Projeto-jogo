# RELATÓRIO — SPEC_SITE_V1 (execução 20/08/2026)

Executado por Claude Code (Sonnet) na branch `spec-lote-e-fairness`, seguindo
`SPEC_SITE_V1.md` fase a fase. Suíte verde a cada fase (29 testes de motor + 7 smokes +
`verificarEquilibrio()` = 0), conforme exigido pela spec.

---

## 1. O que cada fase mudou

- **Fase 0** — três correções de registro: o analisador passou a ler os logs do runner
  headless, o cabeçalho do runner passou a descrever a partida que de fato correu, e o
  catálogo parou de mentir que o `lightning` não raciocina.
- **Fase 1** — `site/gerar/gerar.py` reescrito: modelos, placar, construções, rejeições,
  ataques, tokens e latência saem todos de `analisar-log.js --json` e do `.replay.json`;
  o manifesto encolheu para só o que um humano sabe (id/data/seed/fim/caminhos). Preços da
  OpenRouter buscados uma vez e gravados em `site/dados/precos.json`.
- **Fase 2** — a tabela de classificação virou as 17 colunas exatas da spec, agrupadas em
  4 blocos (Resultado/Confiabilidade/Custo/Jogo), com legenda aberta por padrão acima dela,
  coluna do modelo fixa no scroll, composição L/A/C como barra empilhada.
- **Fase 3** — home reduzida a 2 números no topo (partidas, modelos); saiu o segundo
  parágrafo do hero, os dois cartões de destaque e a seção "O que as partidas ensinaram"
  inteira (com a constante `ACHADOS`).
- **Fase 4** — a seção Método virou texto corrido + `site/assets/mapa.svg` (estático, gerado
  em Python a partir de `mapa.json`, sem JavaScript), no lugar dos 4 cartões.
- **Fase 5** — suíte completa, `gerar.py` rodado e conferido contra o §8, site aberto nas
  duas línguas e testado no navegador (replay, log, análise, mobile), fim-de-linha
  conferido (já estava LF — ver §4), este relatório.

---

## 2. Os três bugs da Fase 0

**2.1 — `analisar-log.js` não lia os logs do runner headless.**
Era: só reconhecia o prefixo `tokens:` (formato do browser); o runner escreve
`tokens.contexto:`. Ficou: regex único que aceita os dois prefixos
(`/^tokens(?:\.contexto)?:/`). Confirmado rodando o comando de exemplo da própria spec —
antes `tokens_prompt_total: 0` e `ms_turnos_nao_vazios: null`; depois, valores reais
(`56601`, `{n:16, min:42540, mediana:83212.5, max:151681}`). Teste novo em
`testes/test_analisar_log_tokens.js` (2 casos, um por formato).

**2.2 — cabeçalho do runner era texto fixo e mentia.**
Era: string fixa dizendo "prompt v3 ... regras=v4 (cav def2/1t, madeira 15, dist x2/3)".
Ficou: a linha `condicoes:` é montada lendo `cfg` (o mesmo `Engine.CONFIG` que de fato
roda), igual ao `index.html`. Confirmado rodando uma partida `burro vs burro` real: o
cabeçalho saiu como `... P4 EN ... + FOG OF WAR ... | regras=v4 (counter 1.5, cav def2/1t,
madeira 30, dist x0.2, vitoria 75%/2t)` — os valores certos do ruleset vivo (CLAUDE.md §7),
não mais os do texto fixo antigo. Os `.txt` já gravados não foram reescritos;
`resultados/AVISO_CABECALHO.md` documenta o problema para quem ler os logs antigos.

**2.3 — catálogo dizia que o `lightning` não raciocina.**
Era: `rac: false` com a nota "SEM raciocinio: serve para isolar o efeito do thinking".
Ficou: `rac: true` com nota explicando a medição (mediana ~84% da saída em tokens de
raciocínio, conferida nos logs de 17-19/08) e que a nota antiga estava errada.

---

## 3. A tabela gerada vs. o gabarito do §8

**Todos os 9 modelos batem exatamente** com a tabela do §8.2 (turnos, s/turno, tokens
entrada/saída, % raciocínio, ordens inválidas, ataques, conquistas, % vencidos) e a tabela
de V/D bate 100%. Uma pendência precisou de investigação antes de fechar — descrita abaixo,
como a spec pede ("pare e investigue antes de continuar").

### 3.1 Divergência investigada: uma 15ª partida

O manifesto original (`site/gerar/manifesto.json` antes desta execução) tinha 14 entradas.
Existe um 15º par de arquivos no repo — `resultados/p4-bateria-0819/P5_laguna-s-2.1_vs_
lightning_seed1_30t.txt` + `.replay.json` — que não está no manifesto nem é citado no §8.
Sem `=== FIM ===` no `.txt` (parou no turno 5, mtime 20/08 01:58, processo morto havia horas
quando eu conferi — não está rodando).

Investigação: com as 14 partidas originais, `turnos` somados do `lightning` davam 366 (não
371) e as medianas de tokens saíam 3543.5/21053.5 (não 3529/20931) — perto do gabarito, mas
fora da tolerância de ±1. Incluindo a P5 como 15ª partida, `interrompida` (não tem
`=== FIM ===`, não decide vitória/derrota/saldo — mesma regra das outras interrompidas), os
três números batem **exatamente**: 371 turnos, mediana 3529 tokens de entrada, mediana 20931
de saída. Ataques/conquistas/ordens-inválidas do `laguna-s-2.1` (P1+P5 juntas: 7 ataques, 7
conquistas, 2 ordens inválidas, 12 turnos) também batem exatamente com o gabarito.

**Decisão: incluí a P5 no manifesto** (`0819-P5`, `fim: interrompida`) — os números não
batem sem ela. Efeito colateral: o `lightning` tem **16 lados** medidos (não 15, como o
texto do §2 da spec diz — "jogou os dois lados em dois espelhos") porque há **três**
espelhos `lightning` vs `lightning` no conjunto (02/17, P4/18, P3/19), não dois; e o total
de partidas é **15** com **3** interrompidas (não "14 totais, duas interrompidas", como o
texto ao redor da tabela de V/D também diz). Ambas as frases de prosa da spec ficaram
desatualizadas por essa partida — a tabela numérica do §8.2, que é o gabarito formal, bate
exatamente incluindo a P5. Sinalizo aqui em vez de decidir sozinho se a P5 deveria existir;
se for lixo de uma corrida abandonada, é só remover a entrada `0819-P5` do manifesto e rodar
`gerar.py` de novo.

### 3.2 Uma segunda pendência: definição de "s / turno"

A mediana de `ms` batendo com o gabarito exigiu somar os turnos **vazios e não-vazios** —
não só os não-vazios. Com só os não-vazios, `lightning` dava 164.5s (gabarito: 173s); somando
os dois, 172.6s → 173. Faz sentido: o modelo gastou aquele tempo mesmo quando a resposta não
chegou. Adicionei `ms_turnos_vazios_lista` ao `analisar-log.js` (paralelo ao
`ms_turnos_nao_vazios_lista` que já existia) para poder agrupar os dois.

Nenhuma outra coluna teve esse tipo de ambiguidade — todas bateram de primeira.

---

## 4. O que eu achei que faltava e não implementei

- **Fim-de-linha (§7 item 6):** a instrução manda normalizar CRLF→LF nos arquivos tocados.
  Conferi com `grep -c $'\r'` primeiro — reportou centenas de "linhas CRLF" em todos os
  arquivos, o que seria estranho num repo que a spec diz ser LF. Reconferi em Python lendo
  os bytes crus: **zero** `\r\n` em qualquer arquivo tocado. O `grep -c $'\r'` deste Git Bash
  parece não interpretar a aspas ANSI-C como esperado (a contagem batia exatamente com o
  total de linhas do arquivo, não com linhas CRLF). Não fiz nada porque não havia nada a
  fazer — mas registro a suspeita de que outros scripts do repo que dependam de
  `grep $'\r'` neste shell podem estar com o mesmo falso-positivo.
- **`site/gerar/parselog.py` e `site/analises.js` e `site/partida.html`:** a spec manda
  manter como estão, e mantive — não são citados em nenhuma fase como alvo de mudança.
- **`site/README.md`:** não é citado na spec, mas documentava o schema ANTIGO do manifesto
  (campos `A`/`B`/`cA`/`cB`/`aldA`/`aldB` que a Fase 1 removeu) e a seção "achados" que a
  Fase 3 apagou. Atualizei para não deixar a próxima pessoa seguindo o README quebrar o
  gerador com um manifesto no formato errado — é a mesma pasta `site/` que a spec pediu para
  reformar, e um README desatualizado sobre o próprio pipeline que acabei de mudar parecia
  descuido, não escopo extra.
- **`.claude/launch.json`:** criei para poder testar o site no navegador via `preview_start`
  (não existia antes). Não é conteúdo do site nem pedido pela spec; é conveniência de
  desenvolvimento, deixei fora do commit.
- **Preço do `gemini-2.5-flash` em `precos.json`:** a regra do §4.3.12 é "para um modelo
  `X:free`, procure o slug `X` sem o sufixo" — mas o `gemini-2.5-flash` não roda via
  OpenRouter `:free` neste projeto (cliente Gemini direto, sem sufixo `:free` no nome). Achei
  o mesmo modelo exato listado na OpenRouter como `google/gemini-2.5-flash` (preço real, não
  "parecido") e mapeei a mão, documentando a decisão dentro do próprio `precos.json`. Se
  isso for julgado fora da regra literal, é reverter uma linha (`"gemini-2.5-flash": null`).

Nada além disso: sem coluna nova, sem seção nova, sem dependência nova, sem mexer em
`engine.js`/`world-iberia.js`/ruleset.

---

## 5. `main` vs. `spec-lote-e-fairness`

`main` (`1ee5cc2`, 04/08) está **80 commits atrás** de `spec-lote-e-fairness` (`9a41920`,
18/08) antes desta execução — mais este trabalho ainda por commitar. Não consolidei nem
mexi em `main`, nem em GitHub Pages, como a spec instrui.
