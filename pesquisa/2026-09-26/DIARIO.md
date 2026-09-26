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
