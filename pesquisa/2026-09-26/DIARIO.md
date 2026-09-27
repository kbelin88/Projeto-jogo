# Diário — testes do prompt P5 (26/09)

Continuação do §12 de `pesquisa/2026-09-25/RELATORIO_PROMPT.md`. Conduz o Claude, na
sessão na nuvem, com a chave do OpenRouter injetada pelo proxy do ambiente (nunca no git).

## Decisões que valem (Lucas, 26/09)

- **O fog não se mexe.** Fora: P5-7 (estoque inimigo) e a composição/origem do P5-5.
- **As tropas mexem-se à mão.** Nada de logística automática.
- **P5-6** (interior × fronteira) só entra se o número o justificar.
- **Tudo no GitHub**, incluindo as partidas desta pesquisa (em `partidas/`), porque as
  de 23/09 ficaram fora do git e perderam-se para esta sessão.

## Mudança de plano

As partidas de 23/09 não existem aqui. A base passa a ser **4 partidas P4 novas**, no
motor de hoje (combate de estrada a 30 unidades, baixas em tropas), com o mesmo desenho:
dots × Super 120B, seeds 3 e 5, cada modelo nos dois assentos. Vantagem: a base e o P5
correm no mesmo motor.

## Ordem

1. ✅ Catálogo (25/09 23:35): 21 `:free`; dots, Super e Ultra vivos.
2. ✅ Base P4: 4 partidas em `partidas/P4_*`. **O dots vence as 4** (18 aldeias, T15–17).
3. Sonda P4 × P5 (`sonda_p5.js`) nos turnos-teste dessas partidas, dots e Super, 3
   respostas por caso, temp 0.
4. Isolar os grupos (`--itens regras` / `combate` / `intencao` / `interior`) no modelo que
   mais mexer.
5. Partidas P5 (`PROMPT_P5=<itens> node runners/rei_vs_rei.js …`) só com o que a sonda
   aprovar, mesmo desenho da base.

## Gabarito (escrito antes de perguntar)

O P5 funciona se, na soma dos casos:

- **"já perdiam na ordem"** cai em `ja_perdia` e `apos_falha`;
- a **fração da guarnição enviada** sobe;
- os **grupos convergentes** do Super caem;
- o **JSON válido** não cai;
- há **mais V do que D no turno seguinte**.

Se nada disto mexer, o problema não é de informação: é de capacidade ou de agência.

## Registo

- 25/09 23:44 — lançadas as 4 partidas de base, em paralelo.
- 26/09 00:37–00:50 — as 4 de base acabaram (17, 15, 17, 16 turnos; 53–67 min cada). O
  container reiniciou depois disso: nada se perdeu.
- 26/09 — `sonda_casos.js` sobre as 4: **19 casos** (dots: ja_perdia 3, apos_falha 3,
  reforco_visivel 1, retaguarda_parada 3; Super: ja_perdia 3, apos_falha 3,
  retaguarda_parada 3). `--seco` reproduz 19/19.
- 26/09 — sonda P4 × P5 (itens todos) lançada: dots e Super em paralelo, 3 respostas por
  caso, temp 0 → 114 chamadas por modelo. A sonda passou a retomar das respostas gravadas.
- 26/09 — o container reiniciou a meio da sonda (dots 59/114, Super 67/114). Havia 17
  respostas vazias, mas só 6 erros de rede no log, e pelos arquivos não dá para as
  separar: **as 17 foram pedidas de novo** (pode favorecer um pouco o JSON válido, igual
  em P4 e P5). Daqui em diante: erro de rede repete até 2 vezes e nunca se grava; resposta
  vazia do modelo grava-se e conta como inválida.

## Resultado 1 — sonda P4 × P5 completo (26/09, 08:54)

19 casos × 3 respostas por prompt, temp 0. Tabelas inteiras: `sonda/*_todos.tabela.txt`;
caso a caso: `node sonda_pareada.js sonda/<r>/resultado.json`.

| critério do gabarito | dots | Super 120B |
|---|---|---|
| "já perdiam" cai em `ja_perdia` e `apos_falha` | 30→29% e 5→20% | **59→38%** e **14→42%** |
| guarnição enviada (mediana) sobe | 100→100% | 50→53% |
| grupos convergentes caem | 6→6 | **17→10** |
| JSON válido não cai | 96→96% | 91→95% |
| mais V do que D no turno seguinte | 50V 25D → 58V 23D | **54V 40D → 42V 48D** |

- **Caso a caso nada é significativo** (teste de sinais; o menor p é 0,27, "já perdiam"
  do Super: P5 abaixo em 9 casos, acima em 4).
- **O ruído é do tamanho do efeito.** Com temp 0, as 3 respostas do Super ao MESMO prompt
  variam de 0 a 6 ataques. A piora do Super em `apos_falha` vem quase toda de 2 respostas
  (caso 2 k2: 6 ataques, os 6 já perdidos; caso 0 k0: 4 de 6).
- Hipótese testada e **não confirmada**: a regra de atrito do P5-2 ("o defensor que segura
  também perde") convidaria a desgastar com ataques pequenos. Envios de 1–2 tropas:
  Super 43%→38%, dots 38%→35%. Planos que falam em desgastar: 1→2 e 2→6 em ~55.
- **Veredito: o P5 inteiro não passa no gabarito.** No dots não mexe nada. No Super mexe
  em direções opostas. Passo 3: isolar cada grupo no Super, reaproveitando as respostas
  P4 (o prompt P4 é idêntico).

## Resultado 2 — cada grupo isolado, no Super (26/09, ~10:00)

Mesmos 19 casos × 3 respostas. O P4 é o MESMO conjunto de respostas do Resultado 1.

| grupo | JSON ok | ataques | já perdiam | convergentes | guarnição | V/D seguinte | sinais (já perdiam / ataques) |
|---|---|---|---|---|---|---|---|
| P4 | 91% | 111 | 41% | 17 | 50% | 54V 40D | — |
| regras (P5-1/2/3) | 91% | 81 | 25% | 7 | 63% | 42V 39D | p=0,39 / **0,05** |
| combate (P5-4) | 86% | 91 | 33% | 5 | 60% | 48V 42D | 0,18 / 0,48 |
| intenção (P5-5) | 91% | 77 | 22% | 3 | 55% | 46V 41D | 0,09 / 0,18 |
| interior (P5-6) | 88% | 94 | 30% | 9 | 60% | 46V 42D | 0,61 / 1,00 |
| os quatro juntos | 95% | 97 | 34% | 10 | 53% | 42V 48D | 0,27 / 0,80 |

**Suspeita: o efeito não depende do conteúdo.** Os quatro grupos, até a linha
interior × fronteira (que não diz nada sobre combate), fazem o mesmo: menos ataques,
menos "já perdiam", menos convergentes. Duas explicações possíveis:

1. **tempo/provedor**: as respostas P4 foram colhidas antes (06:51–08:54, parte sem
   paralelo) e as variantes depois; o provedor gratuito pode ter mudado;
2. **qualquer mudança no prompt** mexe no Super, seja qual for.

Controle lançado: **P4 outra vez + placebo** (o P4 com uma linha sem informação,
"(the list of your villages follows below)", no sítio da linha do P5-6), no mesmo
momento e com o mesmo paralelismo. Se o P4 novo já tiver menos ataques do que o velho, é
(1); se o placebo mexer como os grupos, é (2); se nenhum dos dois, os grupos informam.

## Resultado 3 — o controle (26/09, ~11:05): era o RELÓGIO, não o prompt

P4 pedido outra vez + placebo, no mesmo momento, 19 casos × 3.

| comparação (pareada por caso) | ataques | já perdiam | convergentes | saldo V−D | p (sinais) |
|---|---|---|---|---|---|
| **P4 novo − P4 velho** (o mesmo prompt, horas depois) | **−11,0** | **−8,7** | −3,7 | −5,3 | 0,29–0,42 |
| placebo − P4 novo | +3,0 | +0,7 | −0,3 | +0,7 | ≥0,63 |
| regras − P4 novo | — | 0,0 | — | +1,7 | 1,00 |
| combate − P4 novo | — | +3,3 | — | +2,7 | 0,34–0,79 |
| intenção − P4 novo | — | −1,0 | — | +2,3 | 0,63–1,00 |
| interior − P4 novo | — | +2,7 | — | +2,0 | 0,39–1,00 |

Totais do P4 novo: 78 ataques, 26% já perdiam, 6 convergentes, 39V 41D (o P4 velho:
111, 41%, 17, 54V 40D). **O mesmo prompt, no mesmo modelo, com temp 0, mudou tanto em
três horas quanto qualquer grupo do P5.** Contra o P4 da mesma hora, nenhum grupo mexe.

**Conclusões**

1. **Na decisão de um turno, o P5 não muda o jogo do Super nem do dots.** Pelo gabarito:
   o problema, pelo menos o que a sonda vê, não é de informação.
2. **A lição de método vale mais do que o P5:** o `:free` do OpenRouter não é
   estacionário. Um A/B só vale com os dois braços **intercalados no mesmo momento**
   (a sonda completa do Resultado 1 fazia isso; o isolamento reaproveitou P4 velho e
   enganou-se). Vale também para as partidas: a base P4 da madrugada não serve de
   controle para partidas P5 corridas de dia.
3. **O que a sonda NÃO vê:** efeitos de vários turnos (o P5-4 serve à memória: "voltar
   ao alvo com ≤ força"). Isso só se mede em partidas, P4 e P5 lado a lado.
4. **As correções de verdade (P5-0..3) não pioram nada** (JSON válido igual ou maior,
   nenhuma métrica pior contra o controle). Entrar ou não no jogo é decisão do Lucas: são
   verdade, mas mudam o benchmark.

## Pergunta 2 — o formato do prompt prende as tropas atrás? (26/09, tarde)

O Lucas: *"não acredito que um LLM, com todo o treino que recebeu, não consiga levar as
tropas para a fronteira e acumular. Deve ser algo no nosso prompt."*

**Na base**, o Super tira da retaguarda 9–16% por turno; o dots 14–71%. O P4 já dá o dado
logístico ("from here to your nearest border village [18] Castellon: 2 slow / 1 medium")
e o Super deixa 9 lanceiros parados em Tarragona e Girona ao lado dele.

**Hipóteses de formato:**
1. tudo no P4 empurra para "atacar daqui, agora" ("attack power if all sent" em cada
   aldeia, "march from [x]" em cada alvo); reforçar é uma frase nas regras, e acumular é um
   plano de dois turnos;
2. o modelo responde JSON direto, sem espaço para ver o tabuleiro inteiro antes de dar
   ordens;
3. o `TOTAL` por tipo faz o reino parecer UM exército.

**Braços** (intercalados no mesmo run, `sonda_p5.js --bracos "P4|avaliacao|semtotal|conselho"`):
- `P4` — controle;
- `avaliacao` — o JSON ganha `"assessment"` ANTES das ordens (onde estão as tropas,
  onde é a frente, o que cada aldeia faz); estrutura, não recomenda;
- `semtotal` — sem a linha `TOTAL`;
- `conselho` — **controle positivo**: diz que tropa no interior não luta e que um jogador
  forte a leva à fronteira e ataca com a guarnição inteira. Quebra "o prompt informa, não
  recomenda" de propósito; **só diagnóstico**.

**Casos**: os 12 turnos de `retaguarda_parada` das 4 partidas de base (6 de cada modelo;
≥20 tropas atrás e moveu <10%). `--seco` reproduz 12/12. 3 respostas por braço, temp 0,
dots e Super.

**Métricas novas** (`sonda_comum.js`): `ret->fronteira` = tropa da retaguarda levada a
aldeias PRÓPRIAS de fronteira, sobre a tropa da retaguarda; `maior ataque/exército`.

**Gabarito (antes de perguntar):**
- se o **`conselho`** NÃO subir claramente a retaguarda que sai / levada à fronteira (P5
  acima do P4 na maioria dos 12 casos), **o prompt não é a alavanca** para a logística:
  nem dizendo o que fazer o modelo faz;
- se o `conselho` subir e `avaliacao`/`semtotal` não, a informação está lá e o que falta
  é a RECOMENDAÇÃO: decisão do Lucas ("o prompt informa, não recomenda");
- se `avaliacao` ou `semtotal` subirem (maioria dos casos, JSON válido sem cair), é
  **formato**, e entra sem quebrar a regra.

## As partidas do Lucas (Sonnet 5, Luna, DeepSeek v4, Gemini) — 26/09, noite

Em `partidas_lucas/`: P1 Sonnet × Luna (dossiê, 35 turnos, Sonnet 19×5), P2 Sonnet ×
DeepSeek (dossiê, 23 turnos, DeepSeek 19×5), P3 Luna × Sonnet (replay inteiro, 64
turnos), dois `.txt` antigos com Gemini (16/08 e 30/08, regras de então).

**Onde está o exército depois das ordens** (`logistica_replay.js`; a régua do motor em
`logistica_politicas.js`, 40 seeds, medida no mesmo momento do frame):

| quem | interior | fronteira | em marcha |
|---|---|---|---|
| política REFORÇA (motor) | 4% | 2% | 94% |
| jogador-base | 6% | 2% | 91% |
| política com a retaguarda PARADA de propósito | 42% | 3% | 56% |
| **Sonnet 5** (P3) | **51%** | 22% | 26% |
| **Luna** (P3) | **59%** | 17% | 24% |
| Super 120B (4 partidas) | 50–70% | 12–27% | 17–27% |
| dots (4 partidas) | 23–53% | 4–20% | 36–57% |

**Todos os LLMs, os mais fortes incluídos, deixam no interior mais do que a política
feita para deixar a retaguarda parada.** Não é capacidade de um modelo fraco: é
sistemático. A hipótese do Lucas ("é algo no nosso prompt") fica de pé.

**Porquê — a banda** (`banda_replay.js`):

| | produção no interior | aldeias do interior que enviam/turno | tropa do interior que sai/turno |
|---|---|---|---|
| Luna | 57% | 23% | 12% |
| Sonnet | 59% | 19% | 12% |
| Super | 31–56% | 15–24% | 9–16% |
| dots | 52–69% | 21–65% | 14–71% |

Construir no interior está certo (cada aldeia paga o seu). O que falha é a ordem de
mover: o Sonnet só mexe 1 em cada 5 aldeias do interior por turno. Nos planos, o
Sonnet fala em JUNTAR tropas em 50–55% dos turnos, mas em trazer o interior para a
frente em 0–9%: junta na fronteira o que já está na fronteira.

**Nos planos, o porquê de guardar**: Sonnet "Kept spearmen and knights home to defend
Lisboa", "Keep cheap spearmen everywhere for defense" (defesa/guarnição em 17–41% dos
planos); DeepSeek fala do que não vê em 50%.

**Três verdades de segurança que o P4 cala** (conferidas no motor antes de escritas):

1. `alcance` — o interior só é atacável depois de cair uma vizinha (burro, 200 seeds:
   8 842 ataques, 49 a aldeias interiores, todos com a vizinha tomada no mesmo turno);
2. `capital` — perder a PRÓPRIA capital não perde o jogo nem tem efeito especial (o P4
   di-lo só da capital inimiga);
3. `vigia` — toda coluna inimiga já em marcha para uma aldeia do Rei aparece no
   prompt (2 041 de 2 041); só a ordenada no mesmo turno não.

## Resultado 4 — os braços de formato, no Super (27/09, 00:10)

12 casos de retaguarda parada × 3 respostas × 4 braços, intercalados no mesmo run.

| braço | ret→fronteira | retaguarda que sai | maior ataque/exército | V/D seguinte | sinais (ret→fronteira) |
|---|---|---|---|---|---|
| P4 | 7% | 11% | 7% | 26V 31D | — |
| avaliacao | 13% | 14% | 6% | 22V 26D | 6 acima, 4 abaixo, p=0,75 |
| semtotal | 7% | 10% | 6% | 19V 25D | 4/6, p=0,75; **maior ataque menor em 9 de 12, p=0,02** |
| conselho (controle +) | **16%** | **17%** | 7% | 24V 29D | 7/3, p=0,34 |

**No Super, nem dizer o que fazer move a retaguarda de forma clara.** O controle positivo
dobra a tropa levada à fronteira (7→16%), mas longe dos ~100% que o conselho pede, e sem
significância. Pelo gabarito da Pergunta 2: para o Super, o prompt não é a alavanca
numa decisão de um turno. `semtotal` sai: não mexe na retaguarda e encolhe o maior ataque.

## Resultado 5 — os braços de formato, no dots (27/09, 01:45)

| braço | ret→fronteira | retaguarda que sai | V/D seguinte | sinais (ret→fronteira) |
|---|---|---|---|---|
| P4 | 27% | 33% | 35V 17D | — |
| avaliacao | 31% | 36% | 30V 23D | 7/4, p=0,55 |
| semtotal | 18% | 22% | 33V 17D | 4/8, p=0,39 |
| conselho (controle +) | 29% | 34% | 32V 15D | 7/4, p=0,55 |

**Nos dois modelos, nem o conselho explícito move a retaguarda numa decisão.** O
Super LÊ o conselho (fala de interior/fronteira em 18 de 35 respostas, contra 8 no P4)
e mesmo assim move pouco.

**Onde a intenção e a ação se separam** (Super, braço `avaliacao`, caso 7): a avaliação
escreve, aldeia a aldeia, *"Tarragona (21): 9S home, +2S build. Girona (23): 9S home,
+2S build"*; no caso 9, *"other villages will focus on building spearmen to reinforce"*.
Para o Super, **reforçar uma aldeia é construir nela**. Dá ordem de construção a todas
as aldeias e de movimento a uma. E a nota do turno anterior, dele próprio, diz *"Build
spearmen for defense and reinforce border villages"*: o plano realimenta o hábito.

Dois detalhes de apresentação do P4 que podem empurrar para isto, nenhum é regra:
- `troops at home: 9 / 300` em CADA aldeia lê-se como barra de progresso (encher até 300);
- o esquema pede `build` ANTES de `movements`.

Braços `semteto` e `movprimeiro` lançados no Super (a sonda `apr_super`).

## Resultado 6 — partidas A/B: o mesmo modelo dos dois lados, P4 × VERDADES (27/09, ~02:00)

`pesquisa/2026-09-27/ab/`. V = regras + combate + intenção + alcance + capital + vigia
(só informação). Teto de 30 turnos. Os dois braços correm no mesmo momento por construção.

| partida | resultado (aldeias) | quem ficou à frente | interior P4 / V | tropa do interior que sai/turno P4 / V |
|---|---|---|---|---|
| dots, seed 3, A=P4 B=V | limite 13×11 | P4 | 36% / 23% | 27% / 40% |
| dots, seed 5, A=P4 B=V | **V vence** 3×21 | **V** | 25% / 32% | 42% / 34% |
| dots, seed 3, A=V B=P4 | **P4 vence** 6×18 | **P4** | 46% / 13% | 25% / 63% |
| dots, seed 5, A=V B=P4 | limite 17×7 | V | 32% / 48% | 35% / 23% |
| Super, seed 3, A=P4 B=V | limite 12×12 | empate | 71% / 66% | 5% / 7% |
| Super, seed 5, A=P4 B=V | limite 7×17 | V | 52% / 57% | 20% / 23% |
| Super, seed 3, A=V B=P4 | limite 16×8 | V | 53% / 70% | 12% / 6% |
| Super, seed 5, A=V B=P4 | limite 12×12 | empate | 52% / 56% | 17% / 10% |

- **Placar: V à frente em 4, P4 em 2, 2 empates** (sinais p=0,69). Nada se conclui sobre
  vitória com 8 partidas.
- **A logística não muda com as verdades**: o interior do lado V é menor em 3 de 8 e
  maior em 5. O Super fica em 52–71% no interior dos dois lados; o dots em 13–48%.
- **O Super contra ele próprio não acaba partidas**: as 4 bateram no teto de 30 turnos.
- Leitura honesta: as verdades não fazem mal (o lado V não perdeu mais), mas **não são a
  alavanca da logística**, nem numa decisão (Resultados 4–5) nem numa partida inteira.
