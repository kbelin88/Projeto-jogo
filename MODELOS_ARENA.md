# Tabela da Arena — modelos free da OpenRouter

Gerada por `ferramentas/tabela-modelos.js` a partir de `modelos_free_openrouter.txt` (dump de **2026-08-28T13:49:47.613Z**)
e de `resultados_arena.json` (o que foi medido em partida). **Não edite à mão** — edite o JSON e regenere.

Catálogo: **21 modelos free**, dos quais **17 são aptos** a jogar a Arena.

**Critério de aptidão** (regra, não gosto): produz texto, contexto ≥ 32k, saída máxima ≥ 4k, não é classificador nem router.

## Aptos e já medidos em partida

| modelo | ctx | saída | racioc. | partidas | vit. | atq/unid | counter (inim.) | latência med. | formato | nota |
|---|---|---|---|---|---|---|---|---|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1000k | 66k | opc. | 3 | 2 | 2.46–2.63 | 0.33 (17/08); agregado 0.66 em 18/08 | 324 s em P2 (167–500 s em 17/08) | ok (1 `error` em 28 chamadas) | venceu o Super 120B **16×8** em 30 turnos (4h14) construindo 3% de lanceiro contra 62% do adversário. Forte e caríssimo em relógio |
| `nvidia/nemotron-3.5-lightning:free` | 1000k | 66k | opc. | 9 | 3 | 1.08–1.82 (mediano 1.54) | 0.18–0.61 (17/08) | 128–196 s (máx 600 s) | ok, mas corta: 9 respostas por `length` e 4 `error` nas 60 chamadas de P4 | régua da bateria (9 lados em 4 baterias); tende a lanceiro e perde por isso — **exceto no espelho de 18/08**, onde o lado com 94% de lanceiro venceu 16×8. Derrubou P1 no t7 por erro de rede e horas depois fez 29/30 e 30/30 turnos válidos em P3/P4 | ⚠️ 28/08 a NOITE: a REGUA caiu. Matou tres partidas seguidas — primeiro HTTP 400 'DEGRADED function cannot be invoked', depois HTTP 404, ambos do fornecedor Nvidia. No mesmo instante os outros tres Nemotron (nano-omni, super-120b, ultra-550b) respondiam 200: e o endpoint DESTE modelo, nao o pool da Nvidia. O 400 recuperou em 2 minutos; o 404 durou cerca de uma HORA e depois voltou a responder 200. NAO morreu: ficou INTERMITENTE — e um runner que aborta ao 2o erro consecutivo nao distingue 'endpoint morto' de 'endpoint a piscar'. Para o mes pago: a regua e um ponto unico de falha da comparabilidade — vale ter um 2o eixo de comparacao (o dots, de outro fornecedor, e o candidato natural, com 10 partidas). |
| `dots-studio/dots-3-note-preview:free` | 512k | 461k | opc. | 10 | 2 confirmadas (R1 e R2 de 28/08, dominancia como Rei A) | ? | ? | 95-204 s em partida (a sonda de 1 turno dava 35 s) | ok — raciocínio 2620 tok | Aparece em 10 ficheiros de partida entre 19/08 e 28/08 — a entrada dizia 'partidas: 0', que era o valor de quando foi so sondado e nunca foi atualizado. E o 2o modelo mais rodado da Arena, atras da regua (lightning). Em 28/08 correu 29 e 23 turnos com ZERO erros de rede, 1 resposta cortada em 52. Fornecedor diferente dos Nemotron, o que o torna util quando o pool da Nvidia esta degradado. ⚠️ A sonda de 1 turno subestimou a latencia em 3-6x. |
| `inclusionai/ling-3.0-flash-fin:free` | 262k | 33k | opc. | 1 | 0 | ? | ? | 193 s em partida (86-234 s) | 6 de 15 turnos com alguma ordem; 47% das respostas cortadas por `length` | 1a partida, 28/08: perdeu 4x19 para o 120b em 15 turnos. A falha e PREVISIVEL e monotona, nao aleatoria: a resposta cresce turno a turno (11k, 16k, 30k) e a partir do T5 bate no teto de 32000 quase sempre, devolvendo finish length e ZERO ordens. Mediana de 30282 tokens de resposta = 95% do teto. Levantar o teto NAO resolve: o teto proprio dele e 32768, so 2% acima do nosso — ele e verboso demais para o seu proprio orcamento de saida. O sinal ja estava na sonda de 3 turnos: T1 8953 -> T2 29303. Nao e a latencia que previa a morte, e a TENDENCIA DOS TOKENS DE RESPOSTA contra o teto. |
| `nvidia/nemotron-3-super-120b-a12b:free` | 262k | 236k | opc. | 4 | 2 | 1.68–2.65 | 0.29–0.50 (17/08); agregado 0.48 em 18/08 | ~140–148 s (máx 1371 s) | ok (3 de 30 respostas cortadas por `length` em P2) | **a 1ª vitória por dominância do projeto** (T24, 17/08); venceu dos dois lados do A/B de assento. Em 18/08 perdeu 8×16 para o Ultra 550B com o atq/unid mais baixo que já fez (1.68, 62% de lanceiro) |
| `poolside/laguna-s-2.1:free` | 262k | 33k | opc. | 1 | 0 | 1.28 (7 turnos) | agregado 0.57 (7 turnos) | 181 s em partida (máx 804 s) — a sonda tinha dado 5 s | degenera: 3 de 7 respostas cortadas por `length`, com repetição literal da mesma frase; 3 turnos com `construir: []` | P1 de 18/08 caiu no t7 por erro de rede do **adversário**, mas o pouco que jogou já mostra o degrau 0 (formato) falhando. É o caso que provou que a sonda de 1 turno não prevê latência nem estabilidade |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 256k | 66k | opc. | 1 | 0 | ? | ? | 137 s em partida (max 736 s); a sonda de 1 turno dava 47 s | 10 de 19 turnos com alguma ordem; 4 respostas VAZIAS (resposta crua "", sem erro de rede e sem usage); 1 turno estourado no teto (32768 tok, finish length, 12 min, 0 ordens) | 1a partida, 28/08: perdeu 2x21 para o dots em 19 turnos por dominancia. Fez 12 envios contra 72 do adversario — nao perdeu por estrategia, perdeu por nao AGIR em metade dos turnos. Terceira confirmacao do dia de que sonda curta promete a mais: 47 s numa sonda de 1 turno, 137 s de mediana e um pico de 12 minutos em partida. As respostas vazias sao o modo de falha (d) do CLAUDE.md, aqui na forma mais pura: string vazia, sem erro, sem usage — nada no log a que se possa chamar falha. |
| `z-ai/glm-5.2:free` | 256k | 230k | opc. | 2 | 0 | ? | ? | ~6 s | nunca completou uma partida | 3× HTTP 429 de pool compartilhado (Decart) em 8 chamadas; saiu do catálogo free |

## Sondados (1 turno), ainda sem partida

Passaram — ou falharam — a sonda barata de 1 turno. A sonda mede **disponibilidade e formato**;
não mede latência de partida nem estabilidade ao longo de 30 turnos (ver a legenda).

| modelo | ctx | saída | racioc. | veredito | latência (sonda) | formato | nota |
|---|---|---|---|---|---|---|---|
| `minimax/minimax-m3:free` | 1049k | 944k | opc. | SONDADO — OK | 85-160 s (sonda de 3 turnos) | ok — 2 de 2 turnos validos, com ordens nos dois | RESSUSCITOU: constava MORTO (404 em 18/08) e voltou ao catalogo; re-sondado em 28/08 e responde. O 3o turno caiu com 'terminated' no MESMO segundo que o ling-3.0-flash-fin (fornecedores diferentes) — causa comum de rede, nao do modelo. Raciocinio cresce depressa: 8310 -> 16441 tok entre T1 e T2. |
| `thinkingmachines/inkling-small:free` | 1049k | 262k | opc. | NAO JOGA — 403 restrito | ? | 0 turnos validos: HTTP 403 nas duas tentativas | OpenRouter devolve 403 'only available on agentic harnesses'. Esta no catalogo free e passa TODOS os criterios estaticos (texto->texto, 1049k ctx, 262k saida) — a regra de aptidao nao consegue apanhar isto, porque e gating por app, nao capacidade. Sondado 28/08. |
| `thinkingmachines/inkling:free` | 1049k | 262k | opc. | NAO JOGA — 403 restrito | ? | 0 turnos validos: HTTP 403 nas duas tentativas | OpenRouter devolve 403 'only available on agentic harnesses'. Esta no catalogo free e passa TODOS os criterios estaticos (texto->texto, 1049k ctx, 262k saida) — a regra de aptidao nao consegue apanhar isto, porque e gating por app, nao capacidade. Sondado 28/08. |
| `google/gemma-4-26b-a4b-it:free` | 262k | 33k | opc. | SONDADO — OK (no retry) | 32 s (1 turno) | ok — raciocínio 0 tok (não pensou) | 429 na 1ª sonda (pool compartilhado Google AI Studio → fallback Darkbloom, também 429); passou 10 min depois. Instabilidade de provedor, não de modelo |
| `google/gemma-4-31b-it:free` | 262k | 33k | opc. | BANIDO — pool 429 (3 dias) | 120 s no unico turno que passou | ok quando responde: 1 turno valido, com 3 construcoes e 4 envios | 429 em duas sondas seguidas com 10 min de intervalo, mesmo provedor (Google AI Studio, `upstream_provider_shared_pool`). Vale **uma** re-sonda noutro dia antes de gastar mais cota | 28/08: 429 do pool Google AI Studio PELA 3a VEZ, em 3 dias diferentes (18, 18 e 28/08). 1 turno valido em 3, esse com ordens e 120 s. O problema e o pool partilhado, nao o modelo — mas para a Arena o efeito e o mesmo. |
| `poolside/laguna-xs-2.1:free` | 262k | 33k | opc. | SONDADO — RESPONDE MAS NÃO JOGA | 1200 s (20 min, 1 turno) | `finish: error`, `construir: []`, **sem** erro de rede | gastou os 12401 tokens de resposta inteiros no raciocínio e nunca fechou o JSON. Achado do dia: dá para falhar sem erro nenhum. Não gaste partida |
| `cohere/north-mini-code:free` | 256k | 64k | opc. | SONDADO — LENTO DEMAIS | 353 s (1 turno) | ok — JSON válido, 2 lanceiros, raciocínio 9229 tok | acima do teto de 300 s da spec: 30 turnos custariam ~6 h só do lado dele. Não usar em partida longa |
| `minimax/minimax-m2.7:free` | 197k | 177k | opc. | SONDADO — INSTAVEL | 84-138 s (sonda de 3 turnos) | 1 de 2 turnos validos com ordens; o outro gastou os 12303 tok de resposta INTEIROS no raciocinio e devolveu construir:[] com finish error | Duas falhas distintas numa sonda so: a do laguna-xs-2.1 (pensa ate estourar o teto sem fechar o JSON) e um HTTP 402 'Insufficient balance' do fornecedor GMICloud. Sondado 28/08. |
| `liquid/lfm-2.5-2.6b:free` | 66k | 8k | opc. | SONDADO — OK, mas throttled | 11-13 s (sonda de 3 turnos) | ok — 2 de 2 turnos validos, com ordens nos dois | RESSUSCITOU: constava MORTO (404 em 18/08). O MAIS RAPIDO ja medido na Arena (11-13 s/turno) — candidato a baseline fraco barato em relogio. Cai em 429 do pool partilhado da Liquid (retry_after 60 s). 2.6B: esperar degrau baixo. |

## Aptos, ainda não sondados

| modelo | ctx | saída | racioc. | modalidade | criado | descrição |
|---|---|---|---|---|---|---|
| — | | | | | | _nenhum: os aptos do catálogo já foram todos sondados_ |

## Inaptos e mortos (não gaste cota aqui)

| modelo | por quê |
|---|---|
| `deepseek/deepseek-v4-flash:free` | fora do catalogo free em 2026-08-28 |
| `nvidia/nemotron-3-nano-30b-a3b:free` | fora do catalogo free em 2026-08-28 |
| `nvidia/nemotron-nano-12b-v2-vl:free` | fora do catalogo free em 2026-08-28 |
| `nvidia/nemotron-nano-9b-v2:free` | fora do catalogo free em 2026-08-28 |
| `openai/gpt-oss-20b:free` | fora do catalogo free em 2026-08-28 |
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
