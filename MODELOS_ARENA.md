# Tabela da Arena — modelos free da OpenRouter

Gerada por `ferramentas/tabela-modelos.js` a partir de `modelos_free_openrouter.txt` (dump de **2026-08-18T12:51:48.643Z**)
e de `resultados_arena.json` (o que foi medido em partida). **Não edite à mão** — edite o JSON e regenere.

Catálogo: **18 modelos free**, dos quais **14 são aptos** a jogar a Arena.

**Critério de aptidão** (regra, não gosto): produz texto, contexto ≥ 32k, saída máxima ≥ 4k, não é classificador nem router.

## Aptos e já medidos em partida

| modelo | ctx | saída | racioc. | partidas | vit. | atq/unid | counter (inim.) | latência med. | formato | nota |
|---|---|---|---|---|---|---|---|---|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1000k | 66k | padrão | 3 | 2 | 2.46–2.63 | 0.33 (17/08); agregado 0.66 em 18/08 | 324 s em P2 (167–500 s em 17/08) | ok (1 `error` em 28 chamadas) | venceu o Super 120B **16×8** em 30 turnos (4h14) construindo 3% de lanceiro contra 62% do adversário. Forte e caríssimo em relógio |
| `nvidia/nemotron-3.5-lightning:free` | 1000k | 66k | opc. | 9 | 3 | 1.08–1.82 (mediano 1.54) | 0.18–0.61 (17/08) | 128–196 s (máx 600 s) | ok, mas corta: 9 respostas por `length` e 4 `error` nas 60 chamadas de P4 | régua da bateria (9 lados em 4 baterias); tende a lanceiro e perde por isso — **exceto no espelho de 18/08**, onde o lado com 94% de lanceiro venceu 16×8. Derrubou P1 no t7 por erro de rede e horas depois fez 29/30 e 30/30 turnos válidos em P3/P4 |
| `nvidia/nemotron-3-super-120b-a12b:free` | 262k | 262k | padrão | 4 | 2 | 1.68–2.65 | 0.29–0.50 (17/08); agregado 0.48 em 18/08 | ~140–148 s (máx 1371 s) | ok (3 de 30 respostas cortadas por `length` em P2) | **a 1ª vitória por dominância do projeto** (T24, 17/08); venceu dos dois lados do A/B de assento. Em 18/08 perdeu 8×16 para o Ultra 550B com o atq/unid mais baixo que já fez (1.68, 62% de lanceiro) |
| `poolside/laguna-s-2.1:free` | 262k | 33k | padrão | 1 | 0 | 1.28 (7 turnos) | agregado 0.57 (7 turnos) | 181 s em partida (máx 804 s) — a sonda tinha dado 5 s | degenera: 3 de 7 respostas cortadas por `length`, com repetição literal da mesma frase; 3 turnos com `construir: []` | P1 de 18/08 caiu no t7 por erro de rede do **adversário**, mas o pouco que jogou já mostra o degrau 0 (formato) falhando. É o caso que provou que a sonda de 1 turno não prevê latência nem estabilidade |
| `openai/gpt-oss-20b:free` | 131k | 33k | obrig. | 1 | 0 | 1.07 | 0.00 (1 duelo) | ~1200 s (até 45 min/turno) | ok, mas clamp 0.27 e 8 rejeições | falha o degrau 2/3: razão atq/def mediana **0.64** — ataca com menos força que a defesa |
| `nvidia/nemotron-nano-12b-v2-vl:free` | 128k | 128k | opc. | 1 | 0 | 3.29 (o maior já medido) | agregado 0.29 | **7 s** em partida — o mais rápido do catálogo por uma ordem de grandeza | instável: só 19/30 turnos com resposta registrada, 11 delas com `construir: []`, 18 rejeições | a sonda de 1 turno deu 5.6 s e ele parecia o candidato ideal; em partida perdeu 6×16 para o Lightning. Constrói pouco (58 unidades contra 132) e é o 1º caso de atq/unid alto **perdendo** |

## Sondados (1 turno), ainda sem partida

Passaram — ou falharam — a sonda barata de 1 turno. A sonda mede **disponibilidade e formato**;
não mede latência de partida nem estabilidade ao longo de 30 turnos (ver a legenda).

| modelo | ctx | saída | racioc. | veredito | latência (sonda) | formato | nota |
|---|---|---|---|---|---|---|---|
| `dots-studio/dots-3-note-preview:free` | 512k | 512k | opc. | SONDADO — OK | 35 s (1 turno) | ok — raciocínio 2620 tok | maior teto de saída do catálogo (512k). Candidato a partida, ainda sem nenhuma |
| `google/gemma-4-26b-a4b-it:free` | 262k | 33k | opc. | SONDADO — OK (no retry) | 32 s (1 turno) | ok — raciocínio 0 tok (não pensou) | 429 na 1ª sonda (pool compartilhado Google AI Studio → fallback Darkbloom, também 429); passou 10 min depois. Instabilidade de provedor, não de modelo |
| `google/gemma-4-31b-it:free` | 262k | 33k | opc. | BANIDO (18/08) | — | não chegou a responder | 429 em duas sondas seguidas com 10 min de intervalo, mesmo provedor (Google AI Studio, `upstream_provider_shared_pool`). Vale **uma** re-sonda noutro dia antes de gastar mais cota |
| `poolside/laguna-xs-2.1:free` | 262k | 33k | padrão | SONDADO — RESPONDE MAS NÃO JOGA | 1200 s (20 min, 1 turno) | `finish: error`, `construir: []`, **sem** erro de rede | gastou os 12401 tokens de resposta inteiros no raciocínio e nunca fechou o JSON. Achado do dia: dá para falhar sem erro nenhum. Não gaste partida |
| `cohere/north-mini-code:free` | 256k | 64k | opc. | SONDADO — LENTO DEMAIS | 353 s (1 turno) | ok — JSON válido, 2 lanceiros, raciocínio 9229 tok | acima do teto de 300 s da spec: 30 turnos custariam ~6 h só do lado dele. Não usar em partida longa |
| `nvidia/nemotron-3-nano-30b-a3b:free` | 256k | ? | opc. | SONDADO — OK | 24 s (1 turno) | ok — raciocínio 5071 tok | nano da família que domina a tabela; candidato natural a partida |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 256k | 66k | padrão | SONDADO — OK | 47 s (1 turno) | ok — raciocínio 8059 tok | raciocínio ligado por padrão; ainda sem partida |
| `nvidia/nemotron-nano-9b-v2:free` | 128k | ? | opc. | SONDADO — OK | 63 s (1 turno) | ok — raciocínio 1445 tok | o menor apto; construiu 5 lanceiros + 2 arqueiros na sonda. Candidato a baseline fraco |

## Aptos, ainda não sondados

| modelo | ctx | saída | racioc. | modalidade | criado | descrição |
|---|---|---|---|---|---|---|
| — | | | | | | _nenhum: os aptos do catálogo já foram todos sondados_ |

## Inaptos e mortos (não gaste cota aqui)

| modelo | por quê |
|---|---|
| `deepseek/deepseek-v4-flash:free` | fora do catalogo free em 2026-08-18 |
| `liquid/lfm-2.5-2.6b:free` | fora do catalogo free em 2026-08-18 |
| `minimax/minimax-m3:free` | fora do catalogo free em 2026-08-18 |
| `z-ai/glm-5.2:free` | fora do catalogo free em 2026-08-18 |
| `google/lyria-3-clip-preview` | saida de audio |
| `google/lyria-3-pro-preview` | saida de audio |
| `openrouter/free` | router: escolhe outro modelo por baixo, nao e sujeito de benchmark |
| `nvidia/nemotron-3.5-content-safety:free` | classificador, nao joga |

---

## Legenda das colunas medidas

- **atq/unid** — ataque médio por unidade construída: `(1·lanceiros + 2·arqueiros + 4·cavaleiros) / total`.
  Correlação +0.80 com aldeias finais em 10 lados de 5 partidas de 17/08; o lado com o valor maior venceu 6 de 6.
  **Em 18/08 a regra falhou 2 vezes em 3**: o Lightning venceu o espelho com 1.08 contra 1.71, e o
  `nano-12b-v2-vl` perdeu com 3.29 contra 1.55. A leitura de 17/08 fica em aberto, não confirmada.
- **counter (inim.)** — taxa de counter **só contra o inimigo**. A taxa contra neutras mede leitura de
  tabela (guarnição de um tipo só); contra o inimigo mede estratégia (exército misto que muda por turno).
- **latência med.** — mediana de segundos por turno. É o custo real em free-tier, não o dólar.
- **formato** — degrau 0/1: emite JSON válido e usa ids reais? `ok` / o modo de falha observado.
- **sonda ≠ partida** — em 18/08 dois modelos passaram a sonda de 1 turno e desmentiram-na em partida:
  `laguna-s-2.1` (5 s na sonda, 181 s de mediana em jogo, com degeneração) e `nemotron-nano-12b-v2-vl`
  (5.6 s na sonda, 19 de 30 turnos válidos). Um veredito de sonda é uma licença para jogar, não uma nota.
