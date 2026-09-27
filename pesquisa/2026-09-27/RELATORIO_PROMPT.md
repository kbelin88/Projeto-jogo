# O prompt do Rei: o que testámos, o que mexe e o que não mexe (25–27/09)

> Continuação de `pesquisa/2026-09-25/RELATORIO_PROMPT.md`. O diário completo, com cada
> número na hora em que saiu, está em `pesquisa/2026-09-26/DIARIO.md`. Tudo o que aqui se
> diz tem ficheiro no repo e comando para reproduzir (§9).
>
> Regra de todo o trabalho: **o prompt informa, nunca diz ao Rei o que fazer.** Houve um
> único texto que dizia o que fazer (o braço `conselho`), e esteve lá DE PROPÓSITO, como
> controle positivo, para saber se o texto é sequer uma alavanca. Não é proposta.

---

## 0. Resumo (se só der para ler isto)

1. **Todos os LLMs deixam metade do exército parado no interior, os melhores incluídos.**
   Depois das ordens de cada turno, o Sonnet 5 deixa **51%** do exército em aldeias sem
   vizinho inimigo, o GPT-5.6 Luna **59%**, o Super 120B 50–70%, o dots 13–53%. Uma
   política do motor que leva a produção para a fronteira deixa **4%**; uma feita para
   deixar a retaguarda PARADA deixa 42%. Não é fraqueza de um modelo gratuito: é
   sistemático. A intuição do Lucas ("não é possível que um Sonnet não saiba levar as
   tropas à fronteira") estava certa quanto ao sintoma.

2. **Mas o texto do prompt quase não mexe nisso.** Em sondas de decisão (o mesmo turno
   real pedido com prompts diferentes, intercalados no mesmo momento, avaliados pelo
   motor), nem **dizer explicitamente** "leva a tropa do interior para a fronteira e ataca
   com a guarnição inteira" move a retaguarda com clareza: Super 7%→16% da retaguarda
   levada à fronteira, dots 27%→29%, nenhum significativo. Informação nova (verdades de
   regra, de segurança, de combate) também não.

3. **O porquê está na cabeça do Rei, e vê-se quando se lhe pede para pensar alto.** O
   Super, com um campo `assessment` antes das ordens, escreve aldeia a aldeia *"Tarragona:
   9S home, +2S build. Girona: 9S home, +2S build"* e resume *"other villages will focus
   on building spearmen to reinforce"*. **Para o Rei, reforçar uma aldeia é CONSTRUIR
   nela, não trazer tropa.** Dá ordem de construção a todas as aldeias e de movimento a
   uma. O Sonnet fala em juntar tropas em metade dos planos, mas em trazer o interior para
   a frente em 0–9%: junta na fronteira o que já está na fronteira.

4. **As correções de verdade não fazem mal e ficam.** Nas 8 partidas A/B (o mesmo modelo
   dos dois lados, um Rei com o P4 e o outro com as verdades), o lado com as verdades
   ficou à frente em 4, atrás em 2, empatou 2. Não chega para dizer que ajudam; chega
   para dizer que não pioram, e são verdade. A lista está no §6.

5. **Lição de método que vale mais do que qualquer item:** o `:free` do OpenRouter muda
   de comportamento em horas. O MESMO P4, no mesmo modelo, com temperatura 0, deu 111
   ataques de manhã e 78 três horas depois. Um A/B só vale com os braços **intercalados
   no mesmo momento** (ou dentro da mesma partida). O primeiro isolamento que fiz caiu
   nesta armadilha e só um controle placebo o apanhou (§3).

6. **O que falta para fechar a pergunta do Lucas**: as sondas correram nos modelos
   gratuitos. O Sonnet e o Luna têm o mesmo sintoma nas partidas, mas não foram sondados
   (a chave não tem crédito). A sonda de logística inteira (4 braços × 12 casos × 3
   respostas) custaria ~**$6** no Sonnet. É o próximo passo com mais informação por dólar.

---

## 1. Ler o jogo como um Rei

Antes de medir, li o P4 inteiro como o Super o recebe (11 480 caracteres, turno 14,
retaguarda parada). O que um jogador encontra:

**O que o prompt faz bem.** A regra de vitória com o progresso ao vivo; a simultaneidade;
a rede de estradas pública; cada aldeia própria diz se é INTERIOR ou BORDER; cada aldeia do
interior diz *quanto tempo até à fronteira mais próxima*; cada alvo diz a defesa efetiva,
de quando é a informação e quantas vezes já foi atacado. A logística está toda lá.

**O que o prompt cala** (verdades que o motor executa; conferidas antes de escritas):

| # | o que o motor faz | o que o P4 diz | conferido |
|---|---|---|---|
| regras | o counter multiplica o exército INTEIRO | "multiplies your force" | motor |
| regras | o perdedor é destruído (também o atacante contra aldeia); o vencedor perde metade da força efetiva do perdedor, o mesmo seja qual for o tamanho do vencedor | "attrition against the loser's effective force" | motor |
| regras | quem conquista fica como guarnição | nada | motor |
| combate | por quanto se ganhou ou perdeu um ataque a aldeia | "DEFEAT" | motor |
| intenção | se a coluna inimiga avistada vai para aldeia sua, neutra ou dele | só o destino | motor |
| **alcance** | uma aldeia do interior só é atacável depois de cair uma vizinha | nada | 8 842 ataques do jogador-base: 49 a aldeias interiores, **todos** com a vizinha tomada no mesmo turno |
| **capital** | perder a PRÓPRIA capital não perde o jogo nem tem efeito especial | di-lo só da capital inimiga | motor |
| **vigia** | toda coluna inimiga já em marcha para uma aldeia sua aparece no prompt | "only what your watchmen can see" | 2 041 de 2 041 |

**O que o prompt pode estar a sugerir sem querer** (apresentação, não regra):

- `troops at home: 9 / 300` em CADA aldeia lê-se como uma barra de progresso;
- o esquema pede `build` antes de `movements`;
- a linha `TOTAL: 69 soldiers (52 spearman…)` soma o reino como se fosse um exército;
- `attack power if all sent` em cada aldeia e `march from [x]` em cada alvo enquadram
  tudo como "atacar daqui, agora"; reforçar é uma frase nas regras.

**E a interface**: trazer 9 lanceiros de Tarragona é escrever
`{"fromId":21,"toId":18,"troops":{"spearman":9,"archer":0,"knight":0}}` e acertar a
contagem de cada tipo, em cada aldeia, em cada turno.

Cada uma destas virou um braço de teste.

---

## 2. Como se mede (e porque de três maneiras)

1. **Sonda de decisão** (`sonda_p5.js`). Turnos reais onde um modelo errou (atacou o que
   já perdia, voltou a um alvo depois de falhar, deixou ≥20 tropas atrás e mexeu <10%).
   O mesmo turno é pedido com cada braço, 3 vezes, e cada ordem é avaliada pelo motor:
   ataques que já perdiam na ordem, grupos convergentes, guarnição enviada, retaguarda
   que sai, **retaguarda levada a aldeias próprias de fronteira**, maior ataque, e o turno
   seguinte a sério (a ordem avaliada + a ordem real do inimigo). O avaliador reproduz o
   turno gravado em 19/19 e 12/12 casos (`--seco`). **Braços intercalados e baralhados no
   mesmo run** (ver §3). Comparação **caso a caso** com teste de sinais (`sonda_pareada.js`).
2. **Partidas A/B dentro da mesma partida** (`PROMPT_P5_A` / `PROMPT_P5_B` no runner): o
   mesmo modelo dos dois lados, um Rei com o P4 e o outro com o prompt novo, assentos
   trocados. Os dois braços correm no mesmo momento por construção.
3. **Métricas de logística a partir do replay** (`logistica_replay.js`, `banda_replay.js`),
   com uma régua do motor (`logistica_politicas.js`: as mesmas contas para políticas sem
   LLM, no mesmo momento do frame, depois das ordens).

**Gabaritos escritos antes de cada experimento**, no diário.

---

## 3. A armadilha do relógio

Primeira rodada: P4 contra o P5 completo, 19 casos, dots e Super. Nada significativo.
Segunda: cada grupo do P5 isolado no Super, reaproveitando as respostas P4 da rodada
anterior. **Todos** os grupos, até a linha interior × fronteira (que não fala de
combate), baixaram os ataques, os "já perdiam" e os convergentes. Um efeito que não
depende do conteúdo é suspeito, e o controle mostrou porquê:

| (pareado por caso) | ataques | já perdiam | convergentes |
|---|---|---|---|
| **o mesmo P4, 3 horas depois** | **−11,0** | **−8,7** | −3,7 |
| placebo (uma linha sem informação) − P4 da mesma hora | +3,0 | +0,7 | −0,3 |
| cada grupo do P5 − P4 da mesma hora | ±3 | ±3 | — (p ≥ 0,34 em tudo) |

O Super deu 111 ataques de manhã e 78 depois, com o mesmo texto. **Desde então, todos
os braços correm juntos, baralhados, no mesmo run**, e as partidas A/B põem os dois
prompts na mesma partida. Isto vale para qualquer bateria futura: a base P4 de uma noite
não é controle para uma partida P5 de outro dia.

---

## 4. O sintoma: a tropa que não sai

### 4.1 Todos os modelos, a mesma forma

Fração do exército depois das ordens (média por turno):

| quem | interior | fronteira | em marcha |
|---|---|---|---|
| política REFORÇA (motor) | **4%** | 2% | 94% |
| jogador-base | 6% | 2% | 91% |
| política com a retaguarda **parada de propósito** | 42% | 3% | 56% |
| **Sonnet 5** (P3, 64 turnos) | **51%** | 22% | 26% |
| **Luna** (P3) | **59%** | 17% | 24% |
| Super 120B (12 partidas) | 50–71% | 9–27% | 17–35% |
| dots (12 partidas) | 13–53% | 4–32% | 34–57% |

### 4.2 Não é por construir no sítio errado, é por não mandar

| | produção no interior | aldeias do interior que enviam/turno | tropa do interior que sai/turno |
|---|---|---|---|
| Luna | 57% | 23% | 12% |
| Sonnet | 59% | 19% | 12% |
| Super | 31–70% | 15–29% | 5–23% |
| dots | 41–69% | 21–68% | 14–71% |

Construir no interior está certo: cada aldeia paga a sua produção. O que falha é a ordem
de mover. O Sonnet só dá ordem a 1 em cada 5 aldeias do interior por turno.

### 4.3 O que os Reis dizem

- Sonnet: *"Kept spearmen and knights home to defend Lisboa"*, *"Keep cheap spearmen
  everywhere for defense"*. Defesa/guarnição em 17–41% dos planos; juntar tropas em
  50–55%; **trazer o interior para a frente em 0–9%**.
- DeepSeek: fala do que não vê em 50% dos planos.
- Super (`assessment`): *"other villages will focus on building spearmen to reinforce"*.
  A nota do turno anterior, dele próprio: *"Build spearmen for defense and reinforce
  border villages"*. O plano realimenta o hábito.

A memória não é o gargalo: só 6% dos planos do Sonnet batem no corte de 600 caracteres,
nenhum dos gratuitos.

---

## 5. O que se tentou para mover a tropa (sonda, 12 turnos de retaguarda parada)

`ret→fronteira` = tropa da retaguarda levada a aldeias PRÓPRIAS de fronteira, sobre a
tropa da retaguarda. Sinais = em quantos dos 12 casos o braço ficou acima/abaixo do P4.

| braço | o que é | Super | dots |
|---|---|---|---|
| P4 | controle | 7% | 27% |
| `avaliacao` | campo `assessment` antes das ordens (onde estão as tropas, onde é a frente, o que cada aldeia faz) | 13% (6/4, p=0,75) | 31% (7/4, p=0,55) |
| `semtotal` | sem a linha TOTAL | 7% (4/6) — **maior ataque menor em 9/12, p=0,02** | 18% (4/8) |
| `conselho` | **controle positivo**: diz o que fazer | **16%** (7/3, p=0,34) | **29%** (7/4, p=0,55) |
| `alcance+capital+vigia` | as três verdades de segurança | 9% (5/6) | — |
| + `avaliacao` | | 7% (3/5) | — |
| `semteto` | sem o "/ 300" em cada aldeia | _pendente_ | — |
| `movprimeiro` | `movements` antes de `build` no esquema | _pendente_ | — |
| `atalho` | `"troops": "all"` = tudo o que a aldeia tem disponível | _pendente_ | _pendente_ |

**Pelo gabarito escrito antes**: se nem o `conselho` mexe, o texto não é a alavanca da
logística. Não mexe, nos dois modelos. O Super LÊ o conselho (fala de interior/fronteira
em 18 de 35 respostas, contra 8 no P4) e ainda assim move pouco.

---

## 6. O que vale a pena mudar no prompt (e porquê)

Critério: é verdade que o motor executa, não mexe no fog, não diz o que fazer, e não
piorou nada em nenhuma medida.

**Entram (propostas ao Lucas, atrás de flag como manda o §5.4 do CLAUDE.md):**

1. **`regras`** — counter no exército inteiro; atrito exato; quem conquista fica.
   Correção de verdade. Nenhum efeito medido nas ordens; nenhum dano.
2. **`combate`** — o ataque a aldeia contado como o de estrada ("You attacked [4]
   Badajoz with 1 archer (effective force 3 vs its defense 5): DEFEAT. Your whole army
   was destroyed; the defenders lost 0 troops (2 left)"; e do lado de quem defende).
   Dá à memória o dado que falta ("por quanto perdi"). A sonda de um turno não o pode
   medir; as partidas A/B levaram-no.
3. **`intencao`** — "enemy army marching toward [17] Zaragoza - YOUR village - arrives
   in 1 turn". Só lê o dono do destino, que o Rei já vê. Sem composição, sem origem.
4. **`alcance`**, **`capital`**, **`vigia`** — as três verdades de segurança. Tiram ao
   Rei três razões falsas para guardar tropa. Não o fizeram mover nesta amostra, mas são
   exatas e o Sonnet/Luna (que dão as razões por escrito) não foram testados.

Nas 8 partidas A/B com estas seis juntas: lado com as verdades à frente em 4, atrás em 2,
empate em 2. JSON válido igual ou maior em todas as sondas.

**Não entram:**

- `semtotal` — não mexe na retaguarda e encolhe o maior ataque (p=0,02 no Super).
- `interior` (a linha interior × fronteira do P5-6) — nada em nenhuma medida.
- `conselho` — é recomendação; e nem assim funcionou.
- estoque inimigo e composição da coluna avistada — mexem no fog (decisão do Lucas).

**Por decidir quando as sondas pendentes saírem**: `semteto`, `movprimeiro`, `atalho`,
`avaliacao`. Ver §7.

---

## 7. Resultados pendentes à hora de escrever

_(preenchido quando saírem)_

---

## 8. O que isto diz sobre o benchmark

- **A logística é um sinal, não um defeito a esconder.** Se nem o conselho explícito
  move a tropa, "levar a produção à frente" mede uma capacidade real de agente:
  acompanhar 10–15 unidades de produção ao longo de turnos, sem memória além de 600
  caracteres. É exatamente a "agência" que o `MODELOS_ARENA.md` já apontava como o que
  separa modelos. O dots, que vence, é o que mais tropa do interior tira (até 71%).
- **O prompt não deve compensar isto com conselhos** (a regra do Lucas), e os dados
  dizem que nem compensaria. Deve só **não mentir por omissão** (§6) e **não atrapalhar**
  (a apresentação e a interface do §7).
- **Os modelos fortes jogam melhor mas com a mesma forma.** Sonnet e Luna constroem
  onde devem, planeiam concentração e contam forças, e mesmo assim deixam metade do
  exército no interior. Onde quer que esteja a diferença entre eles e os gratuitos (não
  a medi aqui: as partidas deles não têm `.txt` para os scripts de ataque), não é na
  logística.

---

## 9. Como reproduzir

Tudo em `pesquisa/2026-09-25/experimentos/`. Na nuvem, com a chave injetada pelo proxy:
`NODE_USE_ENV_PROXY=1 OPENROUTER_API_KEY=x` (o `fetch` do Node 22 ignora o `HTTPS_PROXY`).

```bash
# casos: turnos reais onde o Rei errou
node sonda_casos.js casos.json 3 partidas/*.txt
# a sonda, varios bracos intercalados (P4 = o controle)
node sonda_p5.js casos.json openrouter:<modelo> --n 3 --paralelo 4 --saida dir \
  --bracos "P4|avaliacao|conselho|alcance,capital,vigia"
node sonda_pareada.js dir/resultado.json --comparar P4 avaliacao
# partidas A/B: o mesmo modelo, um Rei com o P4, o outro com o prompt novo
PROMPT_P5_A=P4 PROMPT_P5_B=regras,combate,intencao,alcance,capital,vigia \
  node runners/rei_vs_rei.js openrouter:<m> openrouter:<m> 3 30 saida.txt
# logistica a partir de qualquer replay (inclui as do browser)
node logistica_replay.js *.replay.json ; node banda_replay.js *.replay.json
node logistica_politicas.js 40      # a regua do motor
```

Os itens do prompt experimental estão em `p5_prototipo.js` (`ITENS_P5`), cada um com o
porquê e a conferência no motor. `montarP5` com a lista vazia devolve o P4 byte a byte.

**Limites**: 2 modelos gratuitos nas sondas; 12–19 casos por sonda; 8 partidas A/B com
teto de 30 turnos; o Super contra ele próprio nunca acabou uma partida. Sonnet e Luna só
entram pelas partidas que o Lucas trouxe (sem sonda).
