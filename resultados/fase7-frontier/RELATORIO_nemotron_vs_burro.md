# Relatório — nemotron-120b × burro, combate v3

**Data:** 05/08/2026 · **Config:** Ibéria, combate v3 (atq/def separados, counter 1.25),
economia revertida (madeira 10, cavaleiro 30/30), relatório v3, clamp ligado.
**Partida:** seed 1, 40 turnos, temp 0. Rei A = `openrouter:nvidia/nemotron-3-super-120b-a12b:free`,
Rei B = `jogadorBurro` (heurística determinística, L4 já corrigido — decide por custo de rota).
Logs: `nemotron_vs_burro.txt` / `.json`.

> Uma linha: **com um modelo que pensa, o combate v3 finalmente vira estratégia** —
> roster completo (arqueiro + cavaleiro), escolha de counter, e concentração de força
> por *staging*. O burro, na mesma partida, fica preso em lanceiro e goteja. Placar 12×6.

---

## 1. Desfecho

| | nemotron (A) | burro (B) |
|---|--:|--:|
| aldeias finais | **12** | 6 |
| tropas em casa (fim) | **59** | 5 |
| conquistas | **11** | 5 |
| última conquista | **T39** | T20 |

Terminou por limite de turnos (ninguém eliminado), mas o nemotron dominava: 12 aldeias,
59 tropas, e ainda a conquistar no T39 — **sem trava**. O burro parou de conquistar no T20.
As 11 conquistas do nemotron foram aldeias distintas e espalhadas (Santarém, Évora, Coimbra,
Porto, Faro, Badajoz, Vigo, Córdoba, Salamanca, Sevilha, Toledo) — expansão sistemática, não
fixação.

## 2. O ACHADO CENTRAL — roster completo

Construções por tipo:

| | lanceiro | arqueiro | cavaleiro |
|---|--:|--:|--:|
| **nemotron** | 26 | **111** | **6** |
| burro | **105** | 17 | 0 |

- O nemotron usou **os três tipos**, com forte aposta no arqueiro (o meio-termo flexível do
  triângulo) e **6 cavaleiros** — a cavalaria-ariete que a força achatada tinha matado. Já no
  **turno 1** mandou cavaleiros ao ataque; mais tarde construiu cavaleiros em lote.
- O burro fez o oposto: **105 lanceiros, 0 cavaleiros**. É a falha do `escolherTropa` (gastador
  guloso, nunca poupa para tropa cara) a aparecer ao vivo, ao lado de um jogador que a evita.
- Lado a lado, na MESMA partida, a mesma economia: o roster diverso ou pobre é do **jogador**,
  não do tabuleiro nem da economia. Valida a 7.6 (a força achatada matava dois terços do roster).

## 3. Escolha de counter

| | taxa counter (todos ataques) | taxa counter (1º/alvo distinto) | alvos distintos |
|---|--:|--:|--:|
| **nemotron** | **0.53** | **0.55** | 11 |
| burro | 0.03 | 0.13 | 8 |

Uma ordem de grandeza de diferença. O triângulo, invisível na força achatada, agora é jogável —
e o nemotron joga-o metade das vezes (contra 3% do burro, que escolhe tropa por composição fixa,
cego ao matchup). Metade não é perfeito, mas é a primeira vez que a escolha de counter aparece
como sinal forte (o llama3 ficava em 0.1–0.25).

## 4. Concentração por *staging* — a doutrina do jogo em ação

Aqui está a leitura mais importante, e a que a métrica bruta esconde:

| | envios aceites | ataques (COMBATE) | conquistas | **conquista/ataque** | envio médio | monomania |
|---|--:|--:|--:|--:|--:|--:|
| **nemotron** | 91 | 17 | 11 | **65%** | **2.92** | 0.53 ([5]×48) |
| burro | 96 | 78 | 5 | **6%** | 1.79 | 0.52 ([6]×50) |

- O nemotron fez **91 envios mas só 17 ataques** — a maioria foram **reforços à aldeia [5]
  Badajoz** (que ele conquistou cedo e transformou em **base avançada**), juntando força antes
  de atacar. É exatamente o que o prompt ensina: *"reúna as tropas numa aldeia sua e ataque de
  lá num único envio"*. Resultado: **65% de conquista por ataque** (11 de 17).
- O burro, com monomania quase igual (0.52), faz o contrário: **78 ataques dispersos, 6% de
  sucesso** — gotejo puro, bate na mesma porta ([6]×50) sem juntar força.
- **Lição sobre a métrica:** monomania alta pode ser DUAS coisas opostas — *staging* estratégico
  (nemotron: reforçar a base e atacar concentrado) ou fixação patológica (burro: martelar um alvo
  com tropa a menos). A "taxa de conquista por ataque" separa-as: 65% vs 6%. Publicar monomania
  sozinha enganaria; o par (monomania + sucesso) conta a história certa.

## 5. A escada de capacidade (contexto das três corridas)

| jogador | counter (1º-alvo) | envio médio | roster | desfecho |
|---|--:|--:|---|---|
| burro | 0.13 | 1.79 | só lanceiro (0 cav) | perde 6×12 |
| llama3 8B | 0.0–0.5 | 1.3–2.3 | abre uma fresta (1–2 cav) | empata/goteja, 1 seed travou |
| **nemotron 120b** | **0.55** | **2.92** | **111 arq + 6 cav** | **domina, staging, 65% hit** |

Quanto mais forte o modelo, mais o combate v3 rende: da monocultura de lanceiro (burro) à
estratégia completa (nemotron). É a prova de que a mudança de combate era necessária e suficiente
para **destravar** o comportamento — o resto é capacidade do jogador.

## 6. Ressalvas (honestas)

- **n = 1 partida, 1 seed.** Não é um leaderboard. É um retrato, forte mas único.
- **O adversário é o burro** — fraco e determinista. O 12×6 mede sobretudo que o nemotron é muito
  melhor que um burro, o que não surpreende. O sinal que vale é a **qualidade** (roster, counter,
  staging), não o placar.
- **Nemotron jogou de Rei A (primeiro a jogar)** — há vantagem de assento, mas contra um burro
  pesa pouco.
- **Counter 0.53 é "metade"** — bom em relativo (vs 0.03 do burro), medíocre em absoluto. Há
  margem; um modelo ainda mais forte, ou o relatório ordenado por custo (item adiado), pode subir.
- Falta o par que interessa de verdade: **nemotron × gemini** (dois modelos que pensam) e várias
  seeds. A partida gemini×nemotron ficou parcial (T10) por cota; retomar com cota fresca/crédito.

## 7. Próximos passos

1. Completar **gemini × nemotron** (20t) — o par forte-vs-forte, para ver estratégia contra
   estratégia (não contra o burro).
2. Repetir em **3 seeds** para tirar o efeito de assento e de seed.
3. Decidir `bonus_defesa_aldeia` — os dados fortes mostram que a defesa v3 **não** trava um bom
   jogador (nemotron conquistou até T39), então o ajuste do bónus parece **desnecessário** por
   agora. Guardar a decisão para depois do par gemini×nemotron.
4. Fase 6 (harness de lote com checkpoint) antes de gastar mais cota a correr partidas à mão.
