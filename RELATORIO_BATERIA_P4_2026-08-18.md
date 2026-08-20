# Bateria P4 — 5 partidas completas, primeira vitória por dominância

Bateria conduzida pelo Sonnet (Claude Code, headless) na noite de 17→18/08, sobre a
`SPEC_TESTES_HEADLESS_P4.md`. **222 requisições, 5 partidas até o fim, zero interrompidas por
rede.** Fonte: `resultados/p4-bateria-0817/`. O `DIARIO.md` do Sonnet é o registro bruto; isto
é a leitura.

Método: o runner headless não grava `replay.json`, então reconstruí a **posse de cada aldeia**
a partir da sequência de conquistas no `.txt` (cada `CONQUISTA` transfere a posse; capitais
conhecidas no T0). Isso permite classificar cada combate como *contra neutra* ou
*rei-contra-rei*, que é a pergunta central.

| # | A | B | turnos | fim | placar |
|---|---|---|---|---|---|
| 01 | Lightning | Super 120B | 25 | limite | 8 × **16** |
| 02 | Lightning | Lightning (espelho) | 25 | limite | **18** × 4 |
| 03 | Super 120B | Lightning | 24 | **VITÓRIA de A** | **18** × 6 |
| 06 | gpt-oss 20B | Lightning | 20 | limite | 8 × 10 |
| 08 | Ultra 550B | Lightning | 15 | limite | **18** × 6 |

---

## 1. A pergunta principal: sob fog, o duelo chega?

**Chega no turno 7-9, e não é escaramuça.**

| partida | 1º duelo rei-x-rei | total de duelos | neutras esgotam |
|---|---|---|---|
| 01 | **T9** | **51** | T12 |
| 02 | **T9** | 28 | não (2 sobraram) |
| 03 | **T9** | 31 | T11 |
| 08 | **T7** | 15 | T15 |
| 06 | T17 | 1 | não (6 sobraram) |

Contexto histórico, para medir o tamanho disto:

| | ruleset antigo (P2) | ruleset novo + P2 | **ruleset novo + P4 + fog** |
|---|---|---|---|
| 1º duelo | **nunca** (25 turnos) | T8 | **T7-T9** |
| duelos totais | **0** | 10 (em 16t) | **15 a 51** |

O medo de que o fog atrasasse o encontro **não se materializou**. O fog esconde *o que há* na
aldeia, nunca *onde ela fica* — a rede de estradas continua pública —, então os Reis marcham
um para o outro na mesma velocidade de antes. E como cada conquista abre a vizinhança, os dois
se encontram exatamente quando as frentes se tocam.

A partida 06 é a exceção que confirma: o gpt-oss-20b **não expandiu** (ficou em 5 aldeias do
T4 ao T15), então nunca chegou perto do inimigo. O duelo não chegou porque um dos Reis não
jogou — não porque o fog o escondeu.

---

## 2. A primeira vitória por dominância da história do projeto

**Partida 03, turno 24: o Super 120B chegou a 18 de 24 aldeias no T23, segurou no T24 e a
partida terminou com vencedor declarado.** É a primeira vez que a regra dos 75%/2 turnos
dispara desde que foi escrita.

Mas o achado mais interessante é o das **outras três**:

| partida | tocou 18 aldeias | o que aconteceu |
|---|---|---|
| 03 | T23 | segurou no T24 → **venceu** |
| 08 | T15 | a partida acabou no T15 (limite) |
| 02 | T25 | a partida acabou no T25 (limite) |
| 01 | T16 (Rei B) | **caiu para 15 no T17 e nunca mais voltou** |

A partida 01 é a que merece atenção. O Rei B subiu 14 → 16 → 17 → **18** entre T12 e T16, e no
T17 desabou para 15. Depois oscilou entre 15 e 17 por **nove turnos** sem nunca reconquistar o
limiar. Não é falta de força — é que aos 75% a frente fica tão longa que o defensor sempre
retoma alguma coisa.

**Leitura:** o limiar de 75% por 2 turnos está *no ponto certo de tensão* — três partidas
chegaram lá e só uma converteu. Se o objetivo é que a partida termine com vencedor dentro de
25 turnos, o número está apertado; se o objetivo é que a vitória custe caro, está perfeito.
Isto é decisão sua, não minha. O que os dados dizem é que **duas das cinco partidas foram
mortas pelo `maxTurnos`, não pelo jogo** — a 08 acabou no exato turno em que A tocou os 75%.
Se rodar de novo, `maxTurnos` 30 em vez de 25 provavelmente converte mais uma.

---

## 3. O achado grande: a composição prediz o vencedor, 5 de 5

O Sonnet apontou que a composição L/A/C varia muito e concluiu que "não há assinatura fixa por
modelo". Ele está certo sobre a variância — e é justamente por isso que o padrão abaixo importa.

| partida | lado | modelo | L/A/C | % lanceiro | ataque/unidade | reforços | aldeias |
|---|---|---|---|---|---|---|---|
| 01 | B | Super 120B | 66/62/111 | 28% | **2.65** | 44 | 16 |
| 08 | A | Ultra 550B | 8/116/63 | 4% | **2.63** | 18 | **18** |
| 03 | A | Super 120B | 0/142/43 | 0% | **2.46** | 22 | **18** |
| 06 | B | Lightning | 13/61/0 | 18% | 1.82 | 1 | 10 |
| 02 | A | Lightning | 40/22/5 | 60% | 1.55 | 4 | **18** |
| 03 | B | Lightning | 60/58/2 | 50% | 1.53 | 4 | 6 |
| 08 | B | Lightning | 59/19/1 | 75% | 1.28 | 2 | 6 |
| 01 | A | Lightning | 174/29/2 | 85% | 1.17 | 2 | 8 |
| 02 | B | Lightning | 73/12/0 | 86% | 1.14 | 1 | 4 |
| 06 | A | gpt-oss 20B | 113/8/0 | 93% | 1.07 | 2 | 8 |

**Em 5 de 5 partidas, venceu o lado que construiu menos lanceiro.**

- correlação (ataque médio por unidade construída, aldeias finais) = **+0.80**
- correlação (% de lanceiro, aldeias finais) = **−0.72**
- correlação (reforços recebidos, aldeias finais) = **+0.64**

O lanceiro custa 15 madeira e 0 ferro — é a escolha economicamente óbvia quando a madeira é o
gargalo, e foi exatamente o raciocínio que o Nemotron verbalizou em 17/08 (*"wood is limiting
[...] we should focus on lanceiros"*). **Essa otimização local perde o jogo.** Ataque 1 contra
ataque 2 e 4: quem enche o exército de lanceiro compra quantidade e vende poder.

**A prova mais limpa é o espelho (partida 02)**: o *mesmo modelo* dos dois lados, mesma seed,
mesmo prompt. Ganhou 18 × 4 o lado com 60% de lanceiro contra o de 86%. Aqui não há "modelo
melhor" para confundir a leitura — só a composição.

Ressalva honesta: são 10 lados de 5 partidas, e dentro de cada partida os dois lados não são
independentes (um ganha por construção). O teste de sinal 5/5 dá ~3% de probabilidade ao acaso,
o que é sugestivo e não é prova. E há confusão parcial entre "modelo mais forte" e "composição
melhor" — Super 120B e Ultra fazem as duas coisas. O espelho é o que quebra essa confusão.

**Consequência para o balanceamento:** o counter 1.5 foi posto para punir monocultura, e pune —
mas quem escolhe a monocultura errada (lanceiro) já perde antes do triângulo entrar, só pelo
ataque baixo. Vale considerar se o lanceiro precisa de algum atrativo além do preço, ou se ele
deve ser assumidamente a tropa "de guarnição" (defesa 2, igual às outras, e ataque 1).

---

## 4. O counter funciona contra neutras e falha contra inimigos

Métrica nova que só apareceu porque reconstruí a posse:

| partida | lado | counter em TODOS os ataques | counter **só contra inimigo** |
|---|---|---|---|
| 01 | A | 0.67 | **0.61** |
| 01 | B | 0.48 | **0.29** |
| 02 | A | 0.36 | **0.29** |
| 02 | B | 0.45 | **0.18** |
| 03 | A | 0.58 | **0.47** |
| 03 | B | 0.58 | **0.50** |
| 08 | A | 0.48 | **0.33** |
| 08 | B | 0.50 | **0.33** |

**Em 7 dos 8 casos a taxa cai quando o alvo é o inimigo**, às vezes pela metade. A explicação é
mecânica: a aldeia neutra tem guarnição de **um tipo só** e o relatório mostra qual — acertar o
counter é trivial. O exército inimigo é **misto**, e o tipo dominante muda a cada turno com os
reforços; acertar exige prever o que estará lá na chegada, e o próprio prompt avisa que *"a
defesa que você vê é a de hoje, não a da chegada"*.

Isto reinterpreta o "counter 1.00" que celebrei na análise das primeiras 4 turnos: aquela
partida só tinha combates contra neutras. **A taxa contra neutras mede leitura de tabela; a
taxa contra inimigo mede estratégia.** São duas métricas diferentes que estavam somadas numa só.

**Proposta concreta:** o `analisar-log.js` deve reportar `taxa counter` separada por tipo de
alvo. É onde está o sinal, e hoje ele está diluído.

---

## 5. O gpt-oss-20B falha num degrau identificável

Não é lentidão — é jogo. A partida 06 tem uma assinatura clara:

- **razão ataque/defesa mediana = 0.64** — ataca sistematicamente com *menos* força do que a
  defesa do alvo. Todos os outros lados da bateria ficaram entre 1.20 e 1.88.
- **conquistas/combates = 0.25** (7 de 28). Os outros: 0.65 a 0.86.
- **taxa de clamp 0.27** — 8 de 30 envios pediram tropa a mais e o motor teve de cortar.
- 8 rejeições contra 0 do adversário.
- resultado: 5 aldeias do T4 ao T15, 6 neutras ainda vivas no T20.

Ele emite JSON válido (degrau 0 ✔), usa ids reais (degrau 1 ✔), mas **erra a conta de força**
(degrau 2/3 ✘). É o primeiro modelo da bateria a falhar num degrau específico e nomeável —
material bom para a escada do benchmark.

---

## 6. O reforço entrou no jogo de vez

Reforços chegados: **44** (01B), **22** (03A), **18** (08A) contra 1-4 nos lados que não o usam.
Correlação com vitória: **+0.64**.

Comparação direta: o Nemotron fazia **1 reforço em 16 turnos** quando a instrução do P2 o
proibia. Agora o mesmo tipo de modelo faz 44 em 25 turnos. A incoerência nº 1 do estudo estava
custando a mecânica central de concentração de força.

---

## 7. Variância: cuidado com conclusões de partida única

O espelho (02) terminou **18 × 4** com o mesmo modelo dos dois lados e a mesma seed. E o
percurso foi ainda mais dramático: B liderava 13 × 8 no T11 e terminou com 4.

Duas implicações práticas:

1. **Nenhuma afirmação comparativa deve sair de uma partida.** O par 01/03 (assentos
   invertidos) foi bem desenhado justamente por isso: Super 120B venceu dos dois lados
   (16 aldeias como B, 18 e vitória como A), o que é uma afirmação bem mais forte.
2. A variância vem da decisão do LLM, não do motor — a seed é a mesma e o motor é determinístico.
   Isso é bom para o benchmark (há sinal a medir) e caro (precisa de repetição).

---

## 8. Infra: o catálogo free roda rápido

**Três dos oito modelos do plantel morreram em menos de 24 horas:**

| modelo | erro |
|---|---|
| `deepseek/deepseek-v4-flash:free` | 404 — "unavailable for free, use the paid slug" |
| `minimax/minimax-m3:free` | 404 — idem |
| `liquid/lfm-2.5-2.6b:free` | 404 — "no endpoints found" (id provavelmente mudou) |

Eu os verifiquei um a um na API em 17/08 e estavam free. Isso não é erro do Sonnet nem meu — é
a natureza do `:free`. **A sonda de 1 turno da spec valeu exatamente para isto**: custou 3
requisições em vez de 3 partidas perdidas.

**Zero throttle em 222 requisições.** O motivo: o cliente do `rei.js` (headless) **já honrava o
`Retry-After` desde que foi escrito** — a correção que fiz ontem trouxe o `index.html` (browser)
ao mesmo nível. A dívida do cliente duplicado, desta vez, escondia uma boa implementação de um
dos lados. Fica a assimetria: o runner tenta 6 vezes, o browser 9.

**Latência continua sendo o custo real:** 2h04 a 2h39 por partida de 25 turnos, e a 06
(gpt-oss-20b) levou **7h53** para 20 turnos, com turnos individuais de até 45 minutos — 5×
acima do que a sonda de 1 turno previu. **A sonda não prevê latência**, só disponibilidade.

---

## 9. O que eu recomendo agora

**Ferramentas (baratas, alto retorno):**

1. `analisar-log.js`: separar `taxa counter` **por tipo de alvo** (neutra vs inimigo). É o §4.
2. `analisar-log.js`: acrescentar **ataque médio por unidade construída** — uma linha, e é a
   métrica com 0.80 de correlação com o resultado (§3).
3. **O runner headless devia gravar `replay.json`.** É o maior buraco de ferramenta: sem ele,
   métricas A3, alucinação espacial e reconstrução de prompt ficam cegas em toda partida
   headless — e headless é como a bateria roda. Tive de reconstruir a posse na mão para
   escrever este relatório.
4. `rei.js`: subir `maxTentativas` de 6 para 9, por paridade com o browser.
5. Marcar os 3 modelos mortos no `CATALOGO_FREE` — **já fiz**, é comentário, não código.

**Próxima bateria:**

- `maxTurnos` **30**, não 25. Duas partidas morreram no limite com alguém nos 75%.
- Repetir o espelho **3 vezes** (Lightning × Lightning, seeds 1/2/3) para medir a variância de
  frente, já que ela é o maior obstáculo a qualquer afirmação comparativa.
- Um par **Super 120B × Ultra 550B** (os dois que constroem exércitos de ataque alto) — nunca
  se enfrentaram, e é o duelo que testa estratégia contra estratégia.
- Evitar gpt-oss-20b em partidas longas até haver um teto de tempo por turno; 7h53 por partida
  inviabiliza a bateria.

**A pergunta que continua aberta:** a monocultura de lanceiro é escolha do modelo ou artefato
do prompt? O P4 não sugere tipo nenhum (os três aparecem sempre juntos no esquema), então a
suspeita do exemplo âncora está descartada. Sobra a hipótese económica: o modelo vê "madeira é
o gargalo, lanceiro é o mais barato" e otimiza o custo em vez do poder. Se quiser testar, a
linha `CAN BUILD NOW: N lanc ou N arq ou N cav` que ficou proposta no estudo (§7 do
`ESTUDO_PROMPT_P4.md`) é o experimento: ela mostra o trade-off lado a lado, sem recomendar nada.
