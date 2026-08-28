# Análise consolidada — 14 partidas, 28 lados, 4 dias

Leitura das baterias de **17, 18 e 19/08** mais a partida avulsa de **20/08** (Ultra 550B × Gemini).
Fontes: `resultados/p4-bateria-08{17,18,19}/`, `RELATORIO_BATERIA_P4_2026-08-18.md`, e os `.replay.json`
de 10 partidas. Toda métrica nova aqui foi calculada **do estado do motor gravado no replay**, não de
reparsear o `.txt`.

| | |
|---|---|
| partidas | 14 (12 decididas, 10 com replay) |
| lados jogados | 28 |
| modelos que jogaram partida | 9 |
| requisições | ≈ 700 |
| relógio | ≈ 42 h |
| custo em dólar | $0.00 (tudo `:free` desde o 403 de 17/08) |

---

## 1. O counter é fácil contra neutra e difícil contra o inimigo — agora está medido

**Isto fecha o item aberto (h) do `CLAUDE.md`.** O `analisar-log.js` ainda reporta a taxa agregada;
separei os alvos por dono no início do turno, direto do replay.

Em **16 lados** com pelo menos 3 ataques de cada tipo:

| | contra aldeia **neutra** | contra o **inimigo** |
|---|---|---|
| média por lado | **0,574** | **0,335** |
| agregado | 151/257 = **0,588** | 91/271 = **0,336** |
| lados que pioram | — | **14 de 16** (teste de sinal, p = 0,002) |

A queda média é de **0,24** — a taxa cai quase pela metade quando o alvo deixa de ser uma aldeia neutra
e passa a ser um Rei.

A explicação é mecânica e vale a pena escrever inteira, porque muda o que a métrica significa: a aldeia
neutra tem guarnição de **um tipo só** e o relatório mostra qual. Acertar o triângulo ali é **leitura de
tabela**. O exército inimigo é **misto**, e o tipo dominante muda a cada turno com os reforços que chegam;
acertar exige **prever o que estará lá na chegada** — e o próprio prompt avisa que a defesa que o Rei vê é
a de hoje, não a da chegada.

**Consequência:** as duas taxas medem habilidades diferentes e não devem ser somadas. A taxa contra neutra
é degrau 1 (grounding). A taxa contra inimigo é degrau 3 (estratégia). Os números de counter publicados até
aqui na `MODELOS_ARENA.md` para 18/08 estão agregados e **não são comparáveis** com os de 17/08.

As duas exceções são interessantes: `ultra-550b` como Rei B em 18/08 (0,47 neutra → **0,87** inimigo) e o
`gemini-2.5-flash` de hoje (0,15 neutra → 0,32 inimigo). Nos dois casos o lado ignorou o triângulo contra
neutra — onde não precisava dele para vencer — e passou a usá-lo quando o alvo passou a resistir.

---

## 2. "Quem constrói menos lanceiro ganha" não sobreviveu ao N maior

A regra de 17/08 valia 5 de 5. Com as **13 partidas que têm composição completa** (fora a P1 de 18/08, cortada no turno 7):

| regra | acertos | p (sinal) | nas 10 partidas decididas por ≥3 aldeias |
|---|---|---|---|
| **ataque total construído** (1·L + 2·A + 4·C somado na partida) | **11 / 13** | 0,011 | **10 / 10** |
| atq por unidade (composição pura) | 10 / 13 | 0,046 | 7 / 10 |
| menos % de lanceiro | 10 / 13 | 0,046 | 7 / 10 |

Correlação com aldeias finais, nesses 26 lados: ataque total **+0,46**; unidades construídas +0,39;
atq/unidade **+0,26**; % lanceiro **−0,34**. O +0,80 de 17/08 para atq/unidade **não se manteve** — era
uma amostra de 10 lados, com Super 120B e Ultra fazendo composição boa *e* volume alto ao mesmo tempo.

**A ressalva que desmonta metade do achado:** o ataque total é em boa parte **consequência**, não causa.
Quem está à frente tem mais aldeias, mais aldeias produzem mais madeira, mais madeira constrói mais tropa.
Testei cortando a mesma soma nos **10 primeiros turnos**, antes de a bola de neve econômica abrir:

- corte em T10: **5 de 8** partidas com replay previstas certo (5 de 6 nas decididas por ≥3).
- corte em T5: 4 de 8.

Ou seja: o sinal forte do jogo inteiro é largamente retrospectivo. **O que fica de pé** é a versão fraca —
composição de ataque baixo (lanceiro puro) aparece consistentemente do lado perdedor —, e **o que cai** é
a afirmação de que dá para prever o vencedor pela composição no começo.

Os dois erros do "ataque total" são justamente as duas partidas mais apertadas: o espelho de 19/08
(11 × 10) e a Ultra × Gemini de hoje (11 × 13). Onde o jogo é decidido por uma ou duas aldeias, nenhuma
métrica de construção prevê nada.

---

## 3. Taxonomia dos modos de falha (quatro, e só um é de rede)

O catálogo `:free` gerou uma coleção que vale mais do que a classificação:

| modo | assinatura no log | quem fez |
|---|---|---|
| **erro de rede / throttle** | HTTP 429 ou 503, `>>> detalhe:`, `RETENTATIVA DE TURNO` | glm-5.2 (17/08), lightning em P1 de 18/08, gemini hoje |
| **corte no teto** (`finish length`) | resposta truncada no meio do JSON | lightning (9 de 60 chamadas em P4/18), dots-3 como adversário |
| **pensou e não jogou** | `finish error`, `construir: []`, raciocínio = teto inteiro de saída, **zero erro de rede** | laguna-xs-2.1 (12401 tok, 20 min), gemma-4-26b (32000 tok, **43 min num turno**), laguna-s-2.1 |
| **silencioso** | `resposta crua: ""`, sem `finish`, sem linha de `tokens.contexto`, tempos em múltiplos exatos de 300 s | nemotron-3-nano-omni-30b-a3b-reasoning (19/08) |

O terceiro é o achado que mais muda como se testa: **dá para falhar sem um único erro de HTTP**. Um monitor
que conta requisições bem-sucedidas dá 100% de saúde num modelo que não jogou um turno. O contador certo é
**turno válido**, não requisição.

O quarto ainda não foi investigado. Os incrementos exatos de ~300 s / 601 s / 901 s cheiram a timeout do
lado do cliente, não a falha do modelo — vale um teste com `fetch` falso antes de gastar cota.

---

## 4. O custo real é relógio, e a dispersão é de duas ordens de grandeza

Medianas por turno, medidas em partida (não em sonda):

| modelo | mediana | pior turno |
|---|---|---|
| `nemotron-nano-12b-v2-vl` | **7 s** | 65 s |
| `gemini-2.5-flash` | 25 s | 65 s |
| `nemotron-3-nano-30b-a3b` | 69 s | 257 s |
| `dots-3-note-preview` | 83 s | 152 s |
| `nemotron-3-super-120b-a12b` | ~144 s | 1371 s |
| `nemotron-3.5-lightning` | 128–356 s (varia por dia) | 600 s |
| `nemotron-3-ultra-550b-a55b` | 167–500 s | 620 s |
| `poolside/laguna-s-2.1` | 181–382 s | 804 s |
| `openai/gpt-oss-20b` | ~1200 s | 45 min |

Partidas de 30 turnos custaram de **61 min a 4h14**. A bateria de 18/08 levou 11h40 para 4 partidas;
a de 19/08, ~13 h para 5 sondas e 5 partidas. **É a latência, não o preço, que dimensiona uma bateria** —
e é por isso que a regra de aborto por projeção de tempo (>5 h corta) provou o valor dela em 19/08.

---

## 5. A régua mudou de comportamento entre os dias — e isso quebra comparação entre baterias

`nemotron-3.5-lightning` é a régua: 15 lados em 4 baterias. Nas de 17 e 18/08 tinha mediana de 128–196 s e
completou 29/30 e 30/30 turnos válidos. Em 19/08, nas mesmas partidas, apareceu com **medianas de 136 a
356 s**, 14 a 17 turnos de `construir: []` por partida, e **perdeu os quatro confrontos do dia**.

Mesmo modelo, mesmo slug, mesmo prompt, mesmo motor. A variável que mudou está do lado do provedor.

**Consequência metodológica:** não se pode comparar um número de 17/08 com um de 19/08 sem repetir a régua
no mesmo dia. Toda bateria daqui pra frente devia rodar **pelo menos um lado de régua** para calibrar o dia —
que é exatamente o papel que o `jogadorBurro` teria, e ele é determinístico e de graça.

---

## 6. A névoa não atrasou o encontro (confirmado com 10 replays)

| partida | 1º duelo rei-x-rei | duelos | neutras esgotam |
|---|---|---|---|
| 18/08 P2 (super × ultra) | T8 | 43 | T9 |
| 18/08 P3 | T10 | 34 | não |
| 18/08 P4 (espelho) | T14 | 40 | T17 |
| 19/08 P1 | T10 | 34 | não |
| 19/08 P2 | **T7** | 37 | T23 |
| 19/08 P3 (espelho) | T14 | 30 | não |
| 19/08 P4 | **T7** | 11 | T12 |
| 20/08 Ultra × Gemini | T8 | **41** | T13 |

Antes do ruleset novo, com P2 e sem névoa, o primeiro duelo **nunca chegava** em 25 turnos. Agora chega
entre T7 e T14 em todas as partidas em que os dois lados jogaram. A topologia é pública — a névoa esconde
*o que há* na aldeia, nunca *onde ela fica* —, então as frentes se tocam na mesma hora de antes.

Padrão lateral: **os espelhos demoram mais a duelar** (T14 nos dois), porque os dois lados jogam a mesma
abertura e expandem simetricamente até as frentes se tocarem no centro.

---

## 7. O limiar de 75% por 2 turnos: 3 disparos em 13 partidas

| | |
|---|---|
| partidas que **tocaram** 18 aldeias | 7 |
| partidas que **converteram** em vitória | **3** (17/08 P03 no T24; 19/08 P2 no T29; 19/08 P4 no T16) |

O `maxTurnos` 30 (subiu de 25 depois de 17/08) foi o que permitiu as duas conversões de 19/08 — a P2
fechou no T29. Mais um turno de folga e provavelmente a P3 (11 × 10) também teria decidido.

O padrão das que não convertem continua o de 17/08: **aos 75% a frente fica tão longa que o defensor
sempre retoma alguma coisa**. A exceção é a P4 de 19/08, que fechou no T16 justamente porque as neutras
esgotaram cedo (T12) e a frente ficou curta.

---

## 8. A partida de hoje: Ultra 550B × Gemini 2.5 Flash

A primeira com um modelo **fora da família Nemotron** do outro lado, e a **mais disputada de todas**:

- 23 turnos, **11 × 13**. Do T9 em diante o placar oscilou em torno do empate: a maior vantagem foi de 5 aldeias (9 × 14 no T12) e sumiu em dois turnos.
- **41 duelos rei-contra-rei** — o terceiro maior já medido (atrás de 51 e 43), numa partida 7 turnos mais curta que as duas à frente.
- No T23 **Burgos trocou de dono duas vezes no mesmo turno**: B conquistou, A reconquistou, e um segundo ataque de B falhou contra a nova guarnição.
- Composição: A 20% de lanceiro e atq/unid 2,44; B **4,5%** de lanceiro e atq/unid **2,61** — os dois no topo da tabela, e o Gemini com o segundo melhor atq/unid já medido.
- Counter: A 0,81 contra neutra e 0,45 contra inimigo; B **0,15** contra neutra e 0,32 contra inimigo — o Gemini ignorou o triângulo enquanto ele era barato e passou a acertá-lo quando passou a doer.
- Latência: A **198 s** de mediana contra **25 s** do Gemini — 8× mais rápido, com raciocínio capturado em 22 de 22 turnos.

**Terminou por cota do Gemini**, não por jogo: HTTP 429, `generate_content_free_tier_requests, limit: 20,
model: gemini-2.5-flash`. O próprio log marca `NAO use esta partida como dado de benchmark` porque o mapa
correu um turno sem as ordens do Rei B. Correto, e é por isso que ela **não entra na classificação** —
mas é o melhor material de vídeo que o projeto já produziu.

---

## 9. Um bug: o cabeçalho do runner headless mente

`runners/rei_vs_rei.js`, linha 120, escreve a linha `condicoes:` **com texto fixo**:

```
prompt=relatorio v3 (disponivel-para-enviar) ... regras=v4 (cav def2/1t, madeira 15, dist x2/3, vitoria 75%/2t)
```

Todas as partidas de 17, 18 e 19/08 correram com **P4 + fog, madeira 30 e escala de marcha 0,2** — o
`DIARIO` de 19/08 confirma isso no preflight. O `index.html` já lê de `game.config` (LOTE E, E6); o runner
não. **Todo log headless da Arena carrega um cabeçalho falso.**

Isto é exatamente a regressão que o `CLAUDE.md` §6 diz que já mordeu uma vez ("texto fixo 'dist x2/3'
depois da escala mudar") — voltou pelo outro cliente. Os dados não estão errados (os replays gravam o
estado real), mas quem abrir um `.txt` da bateria vai ler regras que não correram.

Correção: uma linha, lendo de `cfg` como o browser faz. Vale antes da próxima bateria, e vale reescrever
os cabeçalhos dos logs já gravados ou pôr um aviso ao lado deles.

---

## 10. O que eu faria a seguir

1. **Portar a separação de counter por tipo de alvo para o `analisar-log.js`** — o cálculo está feito e
   validado (§1); é a recomendação nº 1 do relatório de 18/08, ainda em aberto, e agora tem código de
   referência.
2. **Corrigir o cabeçalho do runner** (§9). Uma linha.
3. **Um lado de régua determinístico por bateria** (`jogadorBurro`), para calibrar o dia (§5). Custo zero
   de cota.
4. **Repetir a Ultra × Gemini** com cota paga do lado do Gemini, ou com o Gemini como Rei A. É a única
   partida da história do projeto que estava genuinamente indecisa no turno 23 (§8).
5. **Parar de reportar atq/unid como preditor** até haver um teste prospectivo. O que sobreviveu ao N=13
   é fraco e retrospectivo (§2); publicar como regra seria vender uma leitura que os próprios dados novos
   já desmentiram em parte.
