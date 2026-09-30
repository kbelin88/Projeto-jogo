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

## Resultado 7 — apresentação e interface, no Super (27/09, 04:30)

| braço | ret→fronteira | já perdiam | V/D seguinte | sinais |
|---|---|---|---|---|
| P4 (apr) | 5% | — | 22V 29D | — |
| semteto | 9% | ↓ | **23V 17D** | ret→front 6/3 p=0,51; **já perdiam 1/7 p=0,07** |
| movprimeiro | 8% | ↓ | 18V 23D | ret→front 5/3; já perdiam 1/6 p=0,13 |
| semteto+movprimeiro | 5% | = | 18V 26D | nada |
| P4 (atalho) | 8% | — | 18V 23D | — |
| atalho | 10% | = | 24V 31D | 6/3 p=0,51 |
| **atalho+avaliacao** | **18%** | = | 25V 29D | **10/2, p=0,04** |

**O Super nunca usou o `"all"`** (0 de 232 envios). O efeito do último braço vem da
**avaliação**, não do atalho. A avaliação empurrou na mesma direção em 3 de 4 sondas
(Super 6/4 e 10/2, dots 7/4; com as verdades de segurança, 3/5). Somado: 26 casos acima,
15 abaixo, p≈0,12. **Sugestivo, não provado**, e testaram-se ~12 braços (um p=0,04 isolado
pode ser acaso).

O dots usa o `"all"` em 28–45% dos envios (sonda a acabar).

## Resultado 8 — o atalho no dots (27/09, ~04:50)

| braço | ret→fronteira | JSON ok | sinais |
|---|---|---|---|
| P4 | 20% | 94% | — |
| atalho | 28% | 92% | 6/6 (usa o "all" em 45% dos envios) |
| atalho+avaliacao | 20% | 89% | 7/5 |

O atalho não entra. A avaliação, somada em todas as sondas: 33 casos acima, 20 abaixo
(p≈0,10). Relatório final: `pesquisa/2026-09-27/RELATORIO_PROMPT.md`.

## Pergunta 3 — "se tu jogasses com este prompt, movias as tropas?" (27/09, manhã)

O Claude jogou o caso 7 da sonda de logística (turno 11 do Super, Rei B) com o MESMO P4,
à mão, e passou a ordem pelo mesmo avaliador. **Viés declarado**: sabia a pergunta.

| mesma situação, mesmo P4 | tropa do interior (26) levada à fronteira | turno seguinte |
|---|---|---|
| Claude | **26 de 26** | **2V 0D** |
| Super, 9 respostas (3 sondas) | 0–15 (média ~6) | 0–1V 0–1D |
| Super na partida real | 0 | 1V 1D |

**A informação está no P4.** A diferença é o processo: aldeia a aldeia, "para que serve
esta tropa?". Tarragona tem 9 lanceiros a 1 turno de Zaragoza, que fica vazia porque os
arqueiros dela vão a Madrid; logo vão. O Super responde a "o que ataco agora?", e o
interior não tem nada para atacar.

**Hipótese do Lucas: o prompt faz pensar no turno, não na partida.** Levar tropa à
fronteira é um investimento que só rende dois turnos depois; o P4 enquadra tudo no turno
("These numbers are from TURN 11") e a única memória é "nota ao próximo turno". Dois
braços novos, nenhum diz o que fazer:

- `frente` — um MAPA DA FRENTE em texto (cada aldeia de fronteira com o que enfrenta e a
  defesa que o próprio prompt mostra; cada aldeia do interior com a aldeia de frente mais
  próxima). Só reorganiza o que o P4 já diz espalhado. É a "referência visual" possível
  em texto; a imagem de verdade fica para os modelos com visão (pagos).
- `campanha` — o `plan` passa a ser a CAMPANHA dos próximos turnos (qual frente, onde
  junta tropas, o que toma depois), e volta como "YOUR CAMPAIGN".

Agendado para 28/09 00:05 UTC (cota renovada): `lancar_sonda_partida.sh` (P4 | frente |
campanha | frente+campanha, dots e Super, 288 chamadas) junto das partidas A/B do prompt
candidato (`lancar_ab2.sh`, ~480). **Gabarito**: um braço conta se levar mais retaguarda à
fronteira do que o P4 na maioria dos 12 casos nos dois modelos, sem cair o JSON válido.
A `campanha` só se julga de verdade em partidas (a memória rende turno após turno).

**Reordenado (27/09, a pedido do Lucas: "testa a campanha em partidas inteiras")**, para
caber em 1000 chamadas/dia:
- 28/09 00:05 UTC — `lancar_ab_campanha.sh` (8 partidas A/B: P4 × P4+campanha, a campanha
  ISOLADA) + `lancar_sonda_partida.sh` (frente e campanha na sonda);
- 29/09 00:05 UTC — `lancar_ab2.sh` (o prompt candidato), com a campanha dentro se ela
  mexer.
**Gabarito da campanha em partidas**: o lado com a campanha tem menos exército no
interior (`logistica_replay.js`) e mais tropa do interior a sair por turno
(`banda_replay.js`) na maioria das 8 partidas, sem cair o JSON válido.

## Resultado 9 (parcial, 28/09 02:15) — a CAMPANHA em partidas inteiras

`pesquisa/2026-09-28/ab_campanha/`: o mesmo modelo dos dois lados, P4 × P4+campanha.

| partida | resultado | lado com a campanha |
|---|---|---|
| dots, seed 3, A=P4 B=camp. | **B vence 22×2** (T25) | **vence** |
| dots, seed 5, A=P4 B=camp. | **B vence 18×6** (T14) | **vence** |
| dots, seed 3, A=camp. B=P4 | **A vence 18×6** (T18) | **vence** |
| dots, seed 5, A=camp. B=P4 | **A vence 18×6** (T15) | **vence** |
| Super, seed 5, A=camp. B=P4 | limite T30, **18×6** | à frente |
| Super, 3 restantes | a correr | — |

**5 de 5 até agora** (com as verdades, na mesma montagem, tinha sido 4 à frente, 2 atrás,
2 empates). Nos planos, o lado com a campanha fala em frentes, em "strike forces", em
"major offensive next turn"; o P4 em "next turn, we will assess the battle and decide".

**A métrica de interior não serve aqui**: o lado da campanha tem MAIS exército no interior
em 4 das 5 (41/24, 24/19, 36/18, 67/45; menos em 32/45). Quem vence tem mais aldeias, e
logo mais interior: a medida confunde-se com o placar. A campanha ganha por outro
caminho, que falta medir (ataques que já perdiam, tamanho dos ataques, frentes abertas).

**Por onde ganha** (`retaguarda.js`, por lado): o lado com a campanha **ataca mais por
turno nas 5 partidas** (1,9/1,6; 1,8/1,6; 1,6/1,1; 1,6/1,5; Super 1,8/1,0) e ataca mais
alvos distintos em 4 (1,8/1,5; 1,5/1,3; 1,4/1,1; 1,6/1,1; Super 1,3/1,0). A campanha não
resolve a logística: dá AGÊNCIA — mais frentes abertas ao mesmo tempo, que é o que o
`MODELOS_ARENA.md` já dizia separar os modelos. (O `falhas.js` soma por nome de modelo;
com o mesmo modelo dos dois lados não separa, fica por fazer por lado.)

## Resultado 10 — o mapa da frente e a campanha, na sonda (28/09, ~02:30)

12 casos de retaguarda parada × 3 respostas × 4 braços, intercalados.

| braço | Super ret→front | dots ret→front | dots: sinais (ret→front / retaguarda que sai) |
|---|---|---|---|
| P4 | 6% | 22% | — |
| frente | 6% (6/6) | **34%** | 8/3 p=0,23 / 9/3 p=0,15 |
| campanha | 7% (6/6) | 21% | 5/7 / 6/6 |
| frente+campanha | 10% (5/6) | **30%** | **9/2 p=0,07 / 10/1 p=0,01** |

- **O mapa da frente é o primeiro braço SÓ de informação que mexe na logística do dots.**
  No Super não mexe nada (como nada mexeu).
- A campanha sozinha não muda UMA decisão, como se esperava: o efeito dela é de vários
  turnos, e esse viu-se nas partidas (Resultado 9).

## Resultado 9 (fechado, 28/09 ~03:00) — a campanha em 8 partidas

| partida | resultado | lado com a campanha | ataques/turno camp./P4 |
|---|---|---|---|
| dots s3 (camp.=B) | B vence 22×2 | **vence** | 1,9 / 1,6 |
| dots s5 (camp.=B) | B vence 18×6 | **vence** | 1,8 / 1,6 |
| dots s3 (camp.=A) | A vence 18×6 | **vence** | 1,6 / 1,1 |
| dots s5 (camp.=A) | A vence 18×6 | **vence** | 1,6 / 1,5 |
| Super s3 (camp.=B) | limite 9×15 | à frente | 2,2 / 2,3 |
| Super s5 (camp.=B) | limite 15×9 | atrás | 1,2 / 1,1 |
| Super s3 (camp.=A) | limite 8×16 | atrás | 1,6 / 1,6 |
| Super s5 (camp.=A) | limite 18×6 | à frente | 1,8 / 1,0 |

**Campanha à frente em 6 de 8** (sinais p≈0,29); **no dots 4 de 4, todas vitórias**
(p=0,125); no Super 2–2. Ataca mais por turno em 6 de 8, igual em 1, menos em 1. Das
mudanças testadas é a de maior efeito no placar, e não diz ao Rei o que fazer: só lhe
pede para pensar a guerra dos próximos turnos.

**Réplica lançada já** (sobravam 368 chamadas): dots, seeds 7 e 9, assentos trocados.

**Candidato para 29/09** (`lancar_ab2.sh`): as seis verdades + `campanha` + `frente`. Saem
`avaliacao` e `semteto` (sinais fracos, p≈0,10 e 0,07 numa sonda só). Entram os dois que
mexeram: a campanha nas partidas, o mapa da frente na logística do dots.

## Resultado 9b — a réplica da campanha no dots NÃO confirma o 4-0 (28/09, ~05:00)

| partida | resultado | campanha | ataques/turno camp./P4 |
|---|---|---|---|
| dots s7 (camp.=B) | limite 12×12 | empate | 1,7 / 1,7 |
| dots s7 (camp.=A) | limite 11×13 | atrás | 1,6 / 1,8 |
| dots s9 (camp.=B) | A vence 18×6 | **perde** | 1,5 / 1,3 |
| dots s9 (camp.=A) | A vence 18×6 | **vence** | 1,2 / 0,9 |

- Na seed 9 o assento A ganhou as duas, com e sem campanha: o mapa pesou mais do que o prompt.
- **Somado: dots 5 à frente, 2 atrás, 1 empate; as 12 partidas: 7 / 4 / 1 (sinais p≈0,55).**
  Mais ataques por turno com a campanha em 8 de 12, igual em 2, menos em 2.
- **Leitura honesta**: o 4-0 inicial era em boa parte sorte de amostra pequena. A campanha
  continua a inclinar para o lado certo (placar e agência), mas o efeito é pequeno e não
  está provado. Fica no candidato de 29/09 para medir outra vez junto com o resto.

## A campanha em dois campos (28/09, ideia aprovada pelo Lucas)

O Lucas: *"faz sentido ter dois campos, para o modelo conseguir ter uma continuidade de
estratégia dentro de uma partida"*. Item `campanha2` no protótipo:

- `plan` continua a nota curta de turno a turno;
- `campaign` (novo) é a guerra de longo prazo. O runner GUARDA-a (`estado.campanhas`) e
  ela volta igual todo turno ("YOUR CAMPAIGN (written by you on turn N; kept until you
  change it)") até o Rei a mudar; `""` mantém a anterior. O `.txt` regista cada campanha
  nova e cada turno em que foi mantida.

Na `campanha` (um campo só) a guerra era reescrita todo turno e dividia os 600
caracteres com a nota. **Gabarito**: igual ao da campanha (Resultado 9), mais: o Rei
mantém a mesma campanha por vários turnos (conta-se no `.txt`: "campanha: mantida").

**Agenda até aos modelos pagos (a 01/10, o Lucas põe crédito):**

| quando (UTC) | o quê |
|---|---|
| 29/09 00:05 | `lancar_ab2.sh`: P4 × candidato (verdades + campanha + frente), 8 partidas |
| 30/09 00:05 | `lancar_ab_campanha2.sh`: P4 × P4+campanha2, 8 partidas |
| 01/10 | modelos pagos: a sonda de logística e as melhores versões no Sonnet |

## Resultado 12 — campanha2 + janela, 2 partidas exploratórias (28/09, tarde)

A janela (ideia do Lucas, "jogar dois turnos"): cada prompt traz a resposta inteira do Rei
no turno anterior (sem o statement), além da campanha guardada e da nota. Dots × dots,
seed 3, assentos trocados, teto 25 (cabia nas 147 requisições que sobravam).

| partida | resultado | ataques/turno novo / P4 | tropa do interior que sai/turno novo / P4 | campanha nova / mantida |
|---|---|---|---|---|
| novo = B | **P4 vence 19×5** (T21) | 0,7 / 1,3 | 23% / 20% | 11 / 10 |
| novo = A | P4 à frente 16×8 (limite T25) | 1,3 / 1,6 | **39% / 18%** | 18 / 7 |

- **O P4 ganhou as duas.** O lado novo tirou MAIS tropa do interior (39% contra 18% numa)
  mas **atacou menos nas duas**: o oposto da campanha num campo só (que atacava mais).
- Hipótese: ver a própria resposta anterior faz o Rei **continuar o que estava a fazer**
  (reforçar, mover, preparar) e reagir menos ao mapa novo. Numa das partidas manteve a
  campanha metade dos turnos; na outra reescreveu-a quase sempre, como relato do turno.
- 2 partidas na mesma seed: **indício, não prova**. O lote de 30/09 separa as duas
  coisas: a campanha em dois campos SOZINHA, sem a janela.

## 29/09 00:07 UTC — lançadas 16 partidas A/B de uma vez (a pedido do Lucas)

- `lancar_ab2.sh` → `pesquisa/2026-09-28/ab2/`: P4 × **candidato** (seis verdades + campanha +
  frente), dots e Super, seeds 3 e 5, assentos trocados (Resultado 13);
- `lancar_ab_campanha2.sh` → `pesquisa/2026-09-30/ab_campanha2/`: P4 × **campanha em dois
  campos**, sem janela, o mesmo desenho (Resultado 14; adiantado de 30/09).
- O lembrete de 30/09 passa a: repetir com seeds novas (7 e 9) a versão que se sair melhor.

## Resultado 13 — o CANDIDATO (verdades + campanha + frente) em 8 partidas A/B (29/09)

| partida | resultado | candidato | tropa do interior que sai/turno cand./P4 |
|---|---|---|---|
| dots s3 (cand.=B) | limite 16×8 | atrás | **38% / 15%** |
| dots s5 (cand.=B) | A vence 18×6 | perde | **44% / 11%** |
| dots s3 (cand.=A) | limite 14×10 | à frente | 30% / 29% |
| dots s5 (cand.=A) | A vence 19×5 | **vence** | **47% / 21%** |
| Super s3 (cand.=B) | limite 10×14 | à frente | 5% / 5% |
| Super s5 (cand.=B) | limite 7×17 | à frente | 11% / 13% |
| Super s3 (cand.=A) | limite 16×8 | à frente | 9% / 6% |
| Super s5 (cand.=A) | limite 6×18 | atrás | 8% / 8% |

- **Candidato à frente em 5 de 8** (Super 3–1, dots 2–2; no dots o assento A ganhou as
  duas seeds, com e sem o candidato).
- **A logística do dots melhora EM PARTIDA** pela primeira vez: a tropa do interior que sai
  sobe em 3 das 4 (38/15, 44/11, 47/21) e fica igual na outra. É o mapa da frente (que na
  sonda já tinha mexido no dots). No Super, nada, como sempre.

## Resultado 14 — a CAMPANHA EM DOIS CAMPOS (sem janela) em 8 partidas A/B (29/09)

| partida | resultado | campanha2 | ataques/turno c2/P4 | campanha nova/mantida |
|---|---|---|---|---|
| dots s3 (c2=B) | limite 17×7 | atrás | 1,2 / 1,4 | 20 / 10 |
| dots s5 (c2=B) | **P4 vence** 18×6 | perde | 1,1 / 1,4 | 17 / 8 |
| dots s3 (c2=A) | **P4 vence** 6×18 | perde | 1,2 / 1,6 | 18 / 8 |
| dots s5 (c2=A) | **P4 vence** 6×18 | perde | 1,0 / 1,4 | 13 / 11 |
| Super s3 (c2=B) | **P4 vence** 18×5 | perde | 0,9 / 0,9 | 13 / 15 |
| Super s5 (c2=B) | **P4 vence** 18×6 | perde | 0,6 / 1,1 | 9 / 15 |
| Super s3 (c2=A) | limite 9×15 | atrás | 1,3 / 0,9 | 16 / 14 |
| Super s5 (c2=A) | limite 14×10 | à frente | 2,0 / 1,1 | 17 / 13 |

- **A campanha guardada perde: P4 à frente em 7 de 8, 5 vitórias** (sinais p≈0,07).
  No dots, o lado com ela ataca menos nas 4 partidas.
- Somado com as 2 partidas da janela (Resultado 12, também perdidas): **guardar a
  campanha ou a resposta anterior torna o Rei mais preso ao plano e menos agressivo.**
- **Contraste com a campanha num campo só** (reescrita todo turno): 7 à frente, 4 atrás,
  1 empate. A diferença não é "ter campanha", é **repensá-la todo turno**. Uma estratégia
  guardada vira âncora: o Rei segue um plano que o mapa já desmentiu.

**Decisão da réplica (30/09)**: repete-se o CANDIDATO (a melhor versão) com seeds 7 e 9.
A campanha em dois campos sai.

## 30/09 00:07 UTC — réplica do CANDIDATO lançada (seeds 7 e 9)

`lancar_ab2_replica.sh` → `pesquisa/2026-09-30/ab2_replica/`: o mesmo candidato (seis
verdades + campanha + frente, SEM a melhoria do tempo de marcha, para a réplica ser do
mesmo pacote), dots e Super, assentos trocados, teto 30. Gabarito: o candidato à frente na
maioria, e a tropa do interior que sai sobe no dots como no Resultado 13.
