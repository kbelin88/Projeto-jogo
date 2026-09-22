# Tabela da Arena — modelos free da OpenRouter

Gerada por `ferramentas/tabela-modelos.js` a partir de `modelos_free_openrouter.txt` (dump de **2026-09-22T23:31:35.815Z**)
e de `resultados_arena.json` (o que foi medido em partida). **Não edite à mão** — edite o JSON e regenere.

Catálogo: **24 modelos free**, dos quais **20 são aptos** a jogar a Arena.

**Critério de aptidão** (regra, não gosto): produz texto, contexto ≥ 32k, saída máxima ≥ 4k, não é classificador nem router.

## Aptos e já medidos em partida

| modelo | ctx | saída | racioc. | partidas | vit. | atq/unid | counter (inim.) | latência med. | formato | nota |
|---|---|---|---|---|---|---|---|---|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1000k | 66k | opc. | 3 | 2 | 2.46–2.63 | 0.33 (17/08); agregado 0.66 em 18/08 | 324 s em P2 (167–500 s em 17/08) | ok (1 `error` em 28 chamadas) | venceu o Super 120B **16×8** em 30 turnos (4h14) construindo 3% de lanceiro contra 62% do adversário. Forte e caríssimo em relógio |
| `nvidia/nemotron-3.5-lightning:free` | 1000k | 66k | opc. | 9 | 3 | 1.08–1.82 (mediano 1.54) | 0.18–0.61 (17/08) | 128–196 s (máx 600 s) | ok, mas corta: 9 respostas por `length` e 4 `error` nas 60 chamadas de P4 | régua da bateria (9 lados em 4 baterias); tende a lanceiro e perde por isso — **exceto no espelho de 18/08**, onde o lado com 94% de lanceiro venceu 16×8. Derrubou P1 no t7 por erro de rede e horas depois fez 29/30 e 30/30 turnos válidos em P3/P4 | ⚠️ 28/08 a NOITE: a REGUA caiu. Matou tres partidas seguidas — primeiro HTTP 400 'DEGRADED function cannot be invoked', depois HTTP 404, ambos do fornecedor Nvidia. No mesmo instante os outros tres Nemotron (nano-omni, super-120b, ultra-550b) respondiam 200: e o endpoint DESTE modelo, nao o pool da Nvidia. O 400 recuperou em 2 minutos; o 404 durou cerca de uma HORA e depois voltou a responder 200. NAO morreu: ficou INTERMITENTE — e um runner que aborta ao 2o erro consecutivo nao distingue 'endpoint morto' de 'endpoint a piscar'. Para o mes pago: a regua e um ponto unico de falha da comparabilidade — vale ter um 2o eixo de comparacao (o dots, de outro fornecedor, e o candidato natural, com 10 partidas). |
| `dots-studio/dots-3-note-preview:free` | 512k | 461k | opc. | 15 | 12 (9 como Rei A, 3 como Rei B) — 0 derrotas; 3 sem decisao (limite/interrompida) | ? | ? | 95-204 s em partida em 28/08; 89-91 s em 22/09 (a sonda de 1 turno dava 35 s) | ok em 28/08 (1 resposta cortada em 52); em 22/09 ~45% das respostas vazias, sem matar a partida | INVICTO em 15 partidas contra LLM (19/08 a 22/09), e dos DOIS lados da mesa: 9 vitorias como A e 3 como B -- venceu o Super 120B e o MiniMax M3 sentado em B. Contado dos ficheiros em 22/09; a entrada anterior dizia '2 confirmadas' e depois '4', porque ninguem tinha contado. E o 2o modelo mais rodado da Arena, atras da regua (lightning). Fornecedor diferente dos Nemotron, util quando o pool da Nvidia esta degradado. ⚠️ A sonda de 1 turno subestimou a latencia em 3-6x. Em 22/09 teve quase metade das respostas vazias e ganhou na mesma -- o que separa modelos aqui e AGENCIA, nao validade. Candidato natural a regua nova. |
| `inclusionai/ling-3.0-flash-fin:free` | 262k | 33k | opc. | 5 | 0 | ? | ? | 193 s em partida em 28/08 (86-234 s); 23-78 s na sonda de 21/09 | 28/08: 6 de 15 turnos com ordem, 47% cortadas por `length`; 22/09: 18 e 19 turnos validos | 0 vitorias em 5 partidas contra LLM: 3 derrotas (1 como Rei A, 2 como B) e 2 sem decisao. 28/08, como A: perdeu 4x19 para o 120b em 15 turnos -- a resposta crescia turno a turno e a partir do T5 batia no teto de 32000, devolvendo finish length e ZERO ordens. 22/09, como B, contra o dots (teto novo auto-ajustavel): o formato ja nao e o problema; o problema e AGENCIA -- 12 e 15 envios contra 52 e 72, e dois tercos da partida sem um unico exercito na estrada (exercitos-turno 13 e 15, contra 59 e 85). E a causa medida de as duas partidas darem ZERO combates de estrada. |
| `nvidia/nemotron-3-super-120b-a12b:free` | 262k | 236k | opc. | 4 | 2 | 1.68–2.65 | 0.29–0.50 (17/08); agregado 0.48 em 18/08 | ~140–148 s (máx 1371 s) | ok (3 de 30 respostas cortadas por `length` em P2) | **a 1ª vitória por dominância do projeto** (T24, 17/08); venceu dos dois lados do A/B de assento. Em 18/08 perdeu 8×16 para o Ultra 550B com o atq/unid mais baixo que já fez (1.68, 62% de lanceiro) |
| `poolside/laguna-s-2.1:free` | 262k | 33k | opc. | 1 | 0 | 1.28 (7 turnos) | agregado 0.57 (7 turnos) | 181 s em partida (máx 804 s) — a sonda tinha dado 5 s | degenera: 3 de 7 respostas cortadas por `length`, com repetição literal da mesma frase; 3 turnos com `construir: []` | P1 de 18/08 caiu no t7 por erro de rede do **adversário**, mas o pouco que jogou já mostra o degrau 0 (formato) falhando. É o caso que provou que a sonda de 1 turno não prevê latência nem estabilidade |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 256k | 66k | opc. | 1 | 0 | ? | ? | 137 s em partida (max 736 s); a sonda de 1 turno dava 47 s | 10 de 19 turnos com alguma ordem; 4 respostas VAZIAS (resposta crua "", sem erro de rede e sem usage); 1 turno estourado no teto (32768 tok, finish length, 12 min, 0 ordens) | 1a partida, 28/08: perdeu 2x21 para o dots em 19 turnos por dominancia. Fez 12 envios contra 72 do adversario — nao perdeu por estrategia, perdeu por nao AGIR em metade dos turnos. Terceira confirmacao do dia de que sonda curta promete a mais: 47 s numa sonda de 1 turno, 137 s de mediana e um pico de 12 minutos em partida. As respostas vazias sao o modo de falha (d) do CLAUDE.md, aqui na forma mais pura: string vazia, sem erro, sem usage — nada no log a que se possa chamar falha. |
| `liquid/lfm-2.5-2.6b:free` | 66k | 8k | opc. | 1 | 0 | ? | ? | 55 s em partida (43-116 s); 11-13 s na sonda de 3 turnos | 13 turnos com ordem em 23; a partir do T5, 34 respostas VAZIAS por `finish length` | 22/09, seed 7, teto 100 turnos: a partida CONGELOU no T19 com 0 exercitos em transito dos dois lados, e ficou assim. A causa nao e o teto que pedimos (aprendeu 61579 pelo HTTP 400 dele) -- e o PROVEDOR, que corta a resposta em 8192 tokens. O modelo gasta os 8192 INTEIROS a pensar e devolve string vazia com finish=length. O sinal e a TENDENCIA: na sonda de 3 turnos responde limpo (6 de 6 com envio); em partida o prompt cresce, o raciocinio cresce com ele, e a partir do T5 nunca mais responde. Sonda de 3 turnos NAO preve isto. ⚠ REASONING_MAX_TOKENS NAO SALVA: com orcamento de 1500 o primeiro turno ainda deu 8192 de raciocinio e finish length -- este provedor ignora o pedido de orcamento. Nao e um knob nosso, e um limite deles. Nao voltar a por em partida longa. Como baseline de RELOGIO numa sonda curta continua a valer. |
| `z-ai/glm-5.2:free` | 33k | 29k | opc. | 2 | 0 | ? | ? | ~6 s | nunca completou uma partida | 3× HTTP 429 de pool compartilhado (Decart) em 8 chamadas; saiu do catálogo free |

## Sondados (1 turno), ainda sem partida

Passaram — ou falharam — a sonda barata de 1 turno. A sonda mede **disponibilidade e formato**;
não mede latência de partida nem estabilidade ao longo de 30 turnos (ver a legenda).

| modelo | ctx | saída | racioc. | veredito | latência (sonda) | formato | nota |
|---|---|---|---|---|---|---|---|
| `thinkingmachines/inkling-small:free` | 1049k | 262k | opc. | NAO JOGA — 403 restrito | ? | 0 turnos validos: HTTP 403 nas duas tentativas | OpenRouter devolve 403 'only available on agentic harnesses'. Esta no catalogo free e passa TODOS os criterios estaticos (texto->texto, 1049k ctx, 262k saida) — a regra de aptidao nao consegue apanhar isto, porque e gating por app, nao capacidade. Sondado 28/08. |
| `thinkingmachines/inkling:free` | 1049k | 262k | opc. | NAO JOGA — 403 restrito | ? | 0 turnos validos: HTTP 403 nas duas tentativas | OpenRouter devolve 403 'only available on agentic harnesses'. Esta no catalogo free e passa TODOS os criterios estaticos (texto->texto, 1049k ctx, 262k saida) — a regra de aptidao nao consegue apanhar isto, porque e gating por app, nao capacidade. Sondado 28/08. |
| `google/gemma-4-26b-a4b-it:free` | 262k | 33k | opc. | SONDADO — OK (no retry) | 32 s (1 turno) | ok — raciocínio 0 tok (não pensou) | 429 na 1ª sonda (pool compartilhado Google AI Studio → fallback Darkbloom, também 429); passou 10 min depois. Instabilidade de provedor, não de modelo |
| `google/gemma-4-31b-it:free` | 262k | 33k | opc. | BANIDO — pool 429 (3 dias) | 120 s no unico turno que passou | ok quando responde: 1 turno valido, com 3 construcoes e 4 envios | 429 em duas sondas seguidas com 10 min de intervalo, mesmo provedor (Google AI Studio, `upstream_provider_shared_pool`). Vale **uma** re-sonda noutro dia antes de gastar mais cota | 28/08: 429 do pool Google AI Studio PELA 3a VEZ, em 3 dias diferentes (18, 18 e 28/08). 1 turno valido em 3, esse com ordens e 120 s. O problema e o pool partilhado, nao o modelo — mas para a Arena o efeito e o mesmo. |
| `poolside/laguna-xs-2.1:free` | 262k | 33k | opc. | SONDADO — RESPONDE MAS NÃO JOGA | 1200 s (20 min, 1 turno) | `finish: error`, `construir: []`, **sem** erro de rede | gastou os 12401 tokens de resposta inteiros no raciocínio e nunca fechou o JSON. Achado do dia: dá para falhar sem erro nenhum. Não gaste partida |
| `cohere/north-mini-code:free` | 256k | 64k | opc. | SONDADO — LENTO DEMAIS | 353 s (1 turno) | ok — JSON válido, 2 lanceiros, raciocínio 9229 tok | acima do teto de 300 s da spec: 30 turnos custariam ~6 h só do lado dele. Não usar em partida longa |

## Aptos, ainda não sondados

| modelo | ctx | saída | racioc. | modalidade | criado | descrição |
|---|---|---|---|---|---|---|
| `inclusionai/ling-3.0-flash-sante:free` | 262k | 33k | opc. | text->text | 2026-09-04 | Ling 3.0 Flash Sante is a health and medicine-focused mixture-of-experts model from Inclus |
| `inclusionai/ling-3.0-flash-vl:free` | 262k | 33k | opc. | text+image+video->text | 2026-09-10 | Ling 3.0 Flash VL builds on Ling 3.0 Flash (124B total / 5.5B active MoE from InclusionAI) |
| `nex-agi/nex-n2.5-mini:free` | 262k | 236k | opc. | text+image->text | 2026-09-08 | Nex-N2.5 is an agentic model built to turn goals into working, verified outcomes. Its core |
| `nex-agi/nex-n2.5-pro:free` | 262k | 236k | opc. | text+image->text | 2026-09-08 | Nex-N2.5 is an agentic model built to turn goals into working, verified outcomes. Its core |
| `qwen/qwen3.8-27b:free` | 262k | 236k | opc. | text+image+video->text | 2026-08-14 | Qwen3.8 27B is an open-weight dense vision-language model from Qwen. It is suited for codi |

## Inaptos e mortos (não gaste cota aqui)

| modelo | por quê |
|---|---|
| `deepseek/deepseek-v4-flash:free` | fora do catalogo free em 2026-09-22 |
| `minimax/minimax-m2.7:free` | fora do catalogo free em 2026-09-22 |
| `minimax/minimax-m3:free` | fora do catalogo free em 2026-09-22 |
| `nvidia/nemotron-3-nano-30b-a3b:free` | fora do catalogo free em 2026-09-22 |
| `nvidia/nemotron-nano-12b-v2-vl:free` | fora do catalogo free em 2026-09-22 |
| `nvidia/nemotron-nano-9b-v2:free` | fora do catalogo free em 2026-09-22 |
| `openai/gpt-oss-20b:free` | fora do catalogo free em 2026-09-22 |
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
