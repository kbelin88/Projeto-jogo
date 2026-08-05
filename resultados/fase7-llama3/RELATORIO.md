# Relatório — 7.8.4: llama3:latest × llama3:latest, combate v3

**Data:** 05/08/2026 · **Config:** Ibéria, combate v3 (atq/def separados, counter 1.25),
economia revertida (madeira 10, cavaleiro 30/30), relatório v3, clamp ligado.
**Corridas:** 3 seeds, 40 turnos cada, temp 0, ollama local. Logs: `seed{1,2,3}.txt` / `.json`.

> Leitura de uma linha: **o combate v3 abriu o roster** — pela primeira vez desde
> a força achatada, um jogador construiu arqueiros E cavaleiros. Mas o llama3 é
> fraco demais para transformar isso em estratégia consistente: gotejo, monomania
> e ordens vazias continuam, e uma seed (a 1) travou cedo.

---

## 1. Placar e ritmo

| seed | placar A/B/neutras | conquistas (A/B) | última conquista | trânsito médio |
|--:|--:|--:|--:|--:|
| 1 | 4 / 4 / 16 | 6 (3/3) | **T7** (travou) | 3.4 |
| 2 | 7 / 4 / 13 | 9 (6/3) | T27 | 4.0 |
| 3 | 5 / 5 / 14 | 8 (4/4) | T24 | 4.0 |

Todas terminaram por limite de turnos (ninguém eliminado). Seed 1 é a outlier: as 6
conquistas foram todas até o T7, depois 33 turnos parados. Seeds 2 e 3 seguiram a
conquistar até o T24–27 — **o jogo não trava por construção; travou numa seed por
comportamento do modelo**.

## 2. O ACHADO CENTRAL — o roster abriu

Construções por tipo (o que a força achatada tinha matado):

| seed | Rei A (L/A/C) | Rei B (L/A/C) | % arqueiro | % cavaleiro |
|--:|--:|--:|--:|--:|
| 1 | 26 / 0 / 0 | 24 / 1 / 0 | ~2% | 0% |
| 2 | 18 / **11** / **2** | 11 / **11** / 0 | **42%** | 4% |
| 3 | 15 / **2** / **2** | 16 / **6** / 0 | 20% | 4% |

- **Cavaleiros construídos: 0 (5A/burro) → 2 por seed 2 e 3.** É a **primeira cavalaria
  que qualquer jogador compra** desde 19/07 (força achatada). O cavaleiro-ariete (atq 4)
  passou a valer o investimento.
- **Arqueiros: ~0% (burro) → 20–42%** nas seeds 2 e 3. Contra o gabarito 7.7 (arqueiros
  ≥ 15% das construções): **seed 2 e 3 PASSAM**; seed 1 não. O burro falhava as três.
- Ressalva: são poucas tropas (~40/partida em 40 turnos) e n=3. Não é um leaderboard;
  é sinal de direção. Mas é o sinal que o burro **não conseguia** dar (escolherTropa é
  gastador guloso, nunca poupa — ver tarefa registada).

## 3. Concentração (o gotejo continua, mas mistura)

Tamanho médio de envio (referência histórica 03/08: llama3 = 2.17):

| seed | A | B |
|--:|--:|--:|
| 1 | **1.31** | 1.80 |
| 2 | 2.03 | 2.25 |
| 3 | 2.33 | 1.62 |

Metade dos lados concentra (2.0–2.3, na linha ou acima do histórico), metade goteja
(1.3–1.6). **Não há melhora limpa de concentração** — a hipótese "atacar exige ~2× a
defesa, logo o modelo concentra" só se confirma em parte. Envios de 1 tropa ainda são
a maioria em vários lados (seed 1 A: 29 de 36).

## 4. Monomania e counter

| seed | mono A | alvo A | mono B | alvo B | counter A (i/ii) | counter B (i/ii) |
|--:|--:|--:|--:|--:|--:|--:|
| 1 | **0.67** | [4]×24 | 0.40 | [14]×4 | 0.10 / 0.17 | 0.25 / 0 |
| 2 | 0.38 | [5]×13 | 0.50 | [14]×4 | 0.16 / 0.25 | 0.14 / 0.25 |
| 3 | 0.38 | [2]×8 | 0.52 | [14]×11 | 0.25 / 0.50 | 0.19 / 0.20 |

- Seed 1 A: monomania 0.67 — martelou [4] **24 vezes** com tropa 1 e counter errado, e
  nunca tomou. É o mesmo padrão nemotron de 03/08, agora contra defesa mais forte (v3).
- Counter certo baixo em toda a linha (0.10–0.25 bruto). O llama3 **não escolhe o
  triângulo de forma fiável** — a tabela atq/def no relatório não bastou para um 8B.
- Curiosidade: o alvo [14] (capital B / vizinha) atrai os dois lados em quase todas as
  seeds — possível viés de posição/id no relatório (a ordenação por custo, item fora
  desta sessão, existe para atacar isto).

## 5. Rejeições — um padrão novo

A rejeição dominante deixou de ser "tropa que não tem" e passou a ser
**"envio: zero tropas (vazio/após ajuste)"** (17, 35 / 18, 36 / 20, 20 por seed·lado).
Ou seja: com o clamp ligado, o pedido excessivo não vira "tropa que não tem" — vira
envio que **clampa a zero** (a aldeia estava vazia, tropas em trânsito). Os lados B
(que fazem poucos envios: 10, 8, 21) geram 35–36 destes — estão a ordenar de aldeias
vazias. É a CAUSA 2 (trânsito contado como casa) a persistir num modelo fraco, apesar
do relatório v3 separar "DISPONÍVEL AGORA" de "em marcha". Construção: "recurso
insuficiente" segue presente (4–18), como esperado.

## 6. Leitura e próximos passos

**O que a fase provou:** o combate v3 é mecanicamente correto (17 testes) e, com um
jogador que decide de verdade, **destrava o roster** — arqueiro e cavaleiro voltam ao
jogo. Isso valida a hipótese da 7.6 (a força achatada matava dois terços das tropas).

**O que continua em aberto:** concentração e counter não melhoram de forma limpa no
llama3 — mas isso é esperado de um 8B. A pergunta "um modelo que pensa concentra força
e escolhe o counter?" precisa de um modelo mais forte (é o gemini/nemotron 120b da
próxima corrida). A seed 1 (trava no T7) mostra que a defesa v3 pode ser dura demais
para um gotejador; se o padrão se repetir com modelos fortes, o candidato a ajuste é
`bonus_defesa_aldeia` (decisão adiada, à espera destes dados).

**Não confundir instrumentos:** o burro (0 cavaleiros sempre) é surdo à economia do
roster — a tarefa registada (escolherTropa guloso) explica porquê. O llama3 já mostra
a fresta; os modelos fortes vão dizer se vira estratégia.
