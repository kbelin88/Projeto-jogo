# Tabela da Arena — modelos free da OpenRouter

Gerada por `ferramentas/tabela-modelos.js` a partir de `modelos_free_openrouter.txt` (dump de **2026-08-18T12:51:48.643Z**)
e de `resultados_arena.json` (o que foi medido em partida). **Não edite à mão** — edite o JSON e regenere.

Catálogo: **18 modelos free**, dos quais **14 são aptos** a jogar a Arena.

**Critério de aptidão** (regra, não gosto): produz texto, contexto ≥ 32k, saída máxima ≥ 4k, não é classificador nem router.

## Aptos e já medidos na Arena

| modelo | ctx | saída | racioc. | partidas | vit. | atq/unid | counter (inim.) | latência med. | formato | nota |
|---|---|---|---|---|---|---|---|---|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1000k | 66k | padrão | 2 | 1 | 2.63 | 0.33 | 167–500 s | ok | forte e caríssimo em relógio: 15 turnos = 2h08 |
| `nvidia/nemotron-3.5-lightning:free` | 1000k | 66k | opc. | 6 | 1 | 1.07–1.82 (mediano 1.4) | 0.18–0.61 | ~150 s | ok (1 truncamento + 1 degeneração em 15 turnos, 18/08) | cavalo de batalha da bateria; tende a lanceiro e perde por isso |
| `nvidia/nemotron-3-super-120b-a12b:free` | 262k | 262k | padrão | 3 | 2 | 2.46–2.65 | 0.29–0.50 | ~140 s | ok | **a 1ª vitória por dominância do projeto** (T24). Venceu dos dois lados do A/B de assento |
| `openai/gpt-oss-20b:free` | 131k | 33k | obrig. | 1 | 0 | 1.07 | 0.00 (1 duelo) | ~1200 s (até 45 min/turno) | ok, mas clamp 0.27 e 8 rejeições | falha o degrau 2/3: razão atq/def mediana **0.64** — ataca com menos força que a defesa |

## Aptos, ainda não testados

| modelo | ctx | saída | racioc. | modalidade | criado | descrição |
|---|---|---|---|---|---|---|
| `dots-studio/dots-3-note-preview:free` | 512k | 512k | opc. | text+image->text | 2026-08-14 | Dots3-Note Preview is an open-weight mixture-of-experts model from Dots Studio, with 16B a |
| `google/gemma-4-26b-a4b-it:free` | 262k | 33k | opc. | text+image+video->text | 2026-04-03 | Gemma 4 26B A4B IT is an instruction-tuned Mixture-of-Experts (MoE) model from Google Deep |
| `google/gemma-4-31b-it:free` | 262k | 33k | opc. | text+image+video->text | 2026-04-02 | Gemma 4 31B Instruct is Google DeepMind's 30.7B dense multimodal model supporting text and |
| `poolside/laguna-s-2.1:free` | 262k | 33k | padrão | text->text | 2026-07-21 | Laguna S 2.1 is the latest coding agent model from [Poolside](<https://poolside.ai/>). Lag |
| `poolside/laguna-xs-2.1:free` | 262k | 33k | padrão | text->text | 2026-07-02 | Laguna XS 2.1 is the latest coding agent model in the 33B-A3B category from [Poolside](htt |
| `cohere/north-mini-code:free` | 256k | 64k | opc. | text->text | 2026-06-17 | North Mini Code is Cohere's first agentic coding model and the debut of its North family.  |
| `nvidia/nemotron-3-nano-30b-a3b:free` | 256k | ? | opc. | text->text | 2025-12-14 | NVIDIA Nemotron 3 Nano 30B A3B is a small language MoE model with highest compute efficien |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 256k | 66k | padrão | text+image+audio+video->text | 2026-04-28 | NVIDIA Nemotron™ 3 Nano Omni is a 30B-A3B open multimodal model designed to function as a  |
| `nvidia/nemotron-nano-12b-v2-vl:free` | 128k | 128k | opc. | text+image+video->text | 2025-10-28 | NVIDIA Nemotron Nano 2 VL is a 12-billion-parameter open multimodal reasoning model design |
| `nvidia/nemotron-nano-9b-v2:free` | 128k | ? | opc. | text->text | 2025-09-05 | NVIDIA-Nemotron-Nano-9B-v2 is a large language model (LLM) trained from scratch by NVIDIA, |

## Inaptos e mortos (não gaste cota aqui)

| modelo | por quê |
|---|---|
| `_nota` | fora do catalogo free em 2026-08-18 |
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
  Correlação +0.80 com aldeias finais em 10 lados de 5 partidas; o lado com o valor maior venceu 6 de 6.
- **counter (inim.)** — taxa de counter **só contra o inimigo**. A taxa contra neutras mede leitura de
  tabela (guarnição de um tipo só); contra o inimigo mede estratégia (exército misto que muda por turno).
- **latência med.** — mediana de segundos por turno. É o custo real em free-tier, não o dólar.
- **formato** — degrau 0/1: emite JSON válido e usa ids reais? `ok` / o modo de falha observado.
