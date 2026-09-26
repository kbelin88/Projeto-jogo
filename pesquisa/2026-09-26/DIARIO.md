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
