# Relatório-mestre — Fase 7: Combate v3 (ataque/defesa separados)

**Período:** 04–06/08/2026 · **Branch:** `econ-relatorio-0408`
**Config final:** Ibéria, combate v3 (atq/def separados, counter 1.25), economia
revertida (madeira 10, cavaleiro 30/30), relatório v3, clamp ligado, burro L4-corrigido.

Este documento junta as quatro corridas da Fase 7 numa leitura única. Detalhe por
corrida em: `fase7-combatev3/` (burro), `fase7-llama3/RELATORIO.md`,
`fase7-frontier/RELATORIO_nemotron_vs_burro.md`, `fase7-frontier/gemini_vs_nemotron*`.

---

## 1. Porque a Fase 7 existiu

A Fase 5A mostrou que a economia (Fase 4) falhou e revelou a causa real: com **força
achatada** (força 1 para todas as tropas), o tipo de tropa só entrava no combate pelo
multiplicador do triângulo. O arqueiro custava mais e valia o mesmo → **economicamente
dominado**; o cavaleiro idem. Como eram os únicos consumidores de ferro, o ferro morria
com eles. Medido: **95% de monocultura de lanceiro** já na economia velha. Conclusão:
P1 (ferro sem sumidouro) e P2 (escada dominada) eram o **mesmo problema**.

## 2. O que mudou (combate v3)

Cada tropa passou a ter **ATAQUE e DEFESA próprios** (nunca trocados): lanceiro 1/2,
arqueiro 2/2, cavaleiro **4/1**. O atacante conta `atq`, o defensor conta `def`. O counter
baixou de 1.5 → **1.25** (modula, não decide). O relatório passa a mostrar os totais já
somados (defesa/ataque), o tipo dominante = mais numeroso, e o clamp entrou como padrão.
17 testes autoritativos (`test_combate_v3.js`) fixam os 9 casos + empate/atrito/sobrevive.

## 3. A ESCADA DE CAPACIDADE (o achado central)

Quanto mais forte o jogador, mais o combate v3 rende. A mesma mecânica, do burro ao frontier:

| jogador | counter (1º-alvo) | envio médio | roster construído | cavaleiros | desfecho |
|---|--:|--:|---|--:|---|
| **burro** (v3, 3 seeds) | ~0.13 | 1.4–1.8 | só lanceiro (arq 5–12%) | **0** | trava; monocultura |
| **llama3 8B** (3 seeds) | 0.17–0.50 | 1.3–2.3 | abre (arq 0–50%) | **0–2** | goteja; 1 seed travou T7 |
| **nemotron 120b** (×burro) | **0.55** | **2.92** | 26L/**111A/6C** (78% arq) | **6** | **domina 12×6**, staging |
| **gemini / nemotron** (frontier, T12) | g 0.17 / **n 0.50** | g 2.0 / **n 2.7** | g **23A/0L** / n 15A/6L | 0 (cedo) | **equilíbrio 5–5** |

A leitura é limpa: da **monocultura de lanceiro** (burro, 0 cavaleiros sempre) à
**estratégia completa** (nemotron: roster diverso + counter + concentração). O burro e o
llama3 não conseguiam mostrar nada disto; os modelos fortes mostram tudo.

## 4. Os três eixos que o combate v3 destravou

**(a) Roster.** O cavaleiro-ariete (atq 4) voltou a valer o investimento: **0 (burro/5A) →
6 (nemotron)**. O arqueiro (meio-termo flexível) virou a tropa de eleição dos fortes — o
gemini construiu **23 arqueiros e 0 lanceiros**. Isto valida a 7.6: a força achatada
matava dois terços do roster; o combate v3 ressuscita-o. É do JOGADOR, não do tabuleiro
(o burro, na mesma economia, continua em 0 cavaleiros — ver decisão em aberto #2).

**(b) Counter.** Invisível na força achatada, agora jogável: **burro 0.13 → nemotron 0.55**.
Uma ordem de grandeza. O nemotron escolhe o triângulo metade das vezes; o burro (composição
fixa) é cego a ele.

**(c) Concentração por *staging*.** O sinal mais fino. O nemotron fez **91 envios mas só 17
ataques**, reforçando uma base ([5] Badajoz) e atacando concentrado de lá — a doutrina que
o prompt ensina — com **65% de conquista por ataque** (vs 6% do burro, que dispersa 78
ataques). Envio médio 2.92 vs 1.79.

## 5. Lição de método — monomania não é uma coisa só

O nemotron e o burro tiveram monomania quase igual (0.53 vs 0.52), mas opostas:
- nemotron: **staging estratégico** (reforçar a base, atacar concentrado) → 65% de sucesso.
- burro: **fixação patológica** (martelar [6] 50× com tropa a menos) → 6% de sucesso.

Só o **par (monomania + taxa de conquista por ataque)** as separa. Publicar monomania
sozinha enganaria — é uma nota de método para o leaderboard futuro.

## 6. O que ficou PROVADO e o que fica em aberto

**Provado:** o combate v3 é mecanicamente correto e **destrava o comportamento** — roster,
counter e concentração aparecem assim que o jogador tem capacidade. A mudança de combate era
necessária (e, pelos dados, suficiente para o destravamento; o resto é capacidade do modelo).

**Em aberto (precisa de frontier completo, várias seeds):** um modelo que pensa concentra
força e escolhe counter de forma CONSISTENTE? O parcial gemini×nemotron (5–5, ativo) diz que
sim, mas morreu no T12 por throttle do free tier. É a pergunta da próxima sessão.

## 7. Decisões pendentes (para o Lucas)

1. **`bonus_defesa_aldeia` — provavelmente NÃO mexer.** O receio era a defesa v3 travar o
   jogo. Os dados fortes desmentem: o nemotron conquistou até **T39**, o gemini×nemotron
   estava 5–5 e ativo no T12. O stall só apareceu nos fracos (burro/llama3 seed 1). A defesa
   v3 não trava um bom jogador. Confirmar com o frontier completo antes de decidir.
2. **`escolherTropa` guloso (burro 0 cavaleiros).** Tarefa registada. O burro gasta o que cabe
   AGORA e nunca poupa para tropa cara → monocultura. Sessão própria (re-baseline). Enquanto
   não fechar, o burro é surdo à economia do roster — usar só como banco de tabuleiro.
3. **Ordenação das aldeias por custo de marcha.** Item adiado, isolado, com teste próprio.
   Os dados mostram viés de posição: [14]/[5]/[3] atraem quase todos. Ordenar por custo (a
   única coisa provadamente simétrica) tira esse viés. Candidato a próxima sessão zero-custo.
4. **Fase 6 — harness de lote com checkpoint.** A peça que falta. Resolve exatamente a morte
   de hoje (gemini×nemotron morreu no T12): checkpoint **retoma** em vez de re-gastar cota.
   Mais teto de gasto, backoff, procedência, saída txt+json, modo ensaio. Zero-custo de
   construir/testar; de-risca todo o frontier pago.
5. **Crédito (10 USD).** Amanhã. Tira o throttle do free tier (1000/dia), que foi o que matou
   o gemini×nemotron a meio.

## 8. Estado técnico

- Branch `econ-relatorio-0408`, tudo commitado. Suite **23 testes verdes + 5 smokes da arena**
  (consertados nesta fase) + `verificarEquilibrio()` zero + `test_index_carrega` ok.
- Runner `rei_vs_rei.js`: dois modelos distintos ou lado burro, checkpoint por turno, sem
  sanity-ping. Fragilidade conhecida: não apanha o erro de topo (morreu em silêncio no T12) —
  fix pequeno pendente.
- Análise por script (`analisar-log.js`): números vêm de código, nunca de LLM. Valida contra
  os apuramentos à mão de 03/08.

## 9. Ressalvas honestas

- **n pequeno:** burro/llama3 = 3 seeds; frontier = 1 partida (e o gemini×nemotron é parcial).
  São retratos, não leaderboard.
- **Adversário fraco:** o 12×6 do nemotron é contra o BURRO. Mede que o nemotron é muito
  melhor que um burro — o que vale é a QUALIDADE (roster, counter, staging), não o placar.
- **Assento:** nemotron/gemini jogaram de Rei A (primeiro a jogar); há vantagem de assento
  (Fase 1B), a controlar correndo os dois assentos (Fase 6.8).
- **Counter 0.55 é "metade":** bom em relativo, medíocre em absoluto. Há margem.
- **Comparabilidade:** a Fase 7 zerou de propósito a comparabilidade com tudo antes (força
  achatada). O baseline novo é este.
