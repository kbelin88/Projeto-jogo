# PROMPT P4 — rascunho (gabarito para discussão, não código)

Convenções deste documento:

- `{{...}}` = valor dinâmico que o `relatorioTexto`/`montarPrompt` preenche.
- `[TEXTO]` = mudança só de texto sobre o que já existe.
- `[MOTOR]` = exige mudança de código além do texto (parser, visão, config).
- `[FOG]` = bloco que só existe com fog of war; sem fog, omite-se inteiro.
- Blocos sem tag = tradução direta do que já existe hoje.

A ordem dos blocos preserva a arquitetura atual (regras fixas primeiro = prefixo estável
para cache de provedor; dados do turno no meio; formato e memória no fim). O inglês abaixo
é o texto proposto real, não pseudocódigo.

---

```
You are King {{side}}. The villages listed under "YOUR VILLAGES" are yours.

[TEXTO — corrige incoerência 2: a condição de vitória REAL, com progresso ao vivo]
HOW TO WIN: you win by holding at least {{75%}} of the map's villages ({{18}} of {{24}})
for {{2}} consecutive turns, or by eliminating the enemy completely. You currently hold
{{n}} villages; the enemy holds {{m}}. The enemy capital is the hardest single target on
the map, but taking it is NOT required to win.

Every village produces resources each turn, and resources are what build your army.

[TEXTO — corrige incoerência 7: simultaneidade, que o LOTE E pôs no motor e o prompt nunca disse]
Orders are SIMULTANEOUS: the enemy writes their orders at the same time you write yours,
seeing the same snapshot you see. Nothing you order this turn is visible to them until it
happens on the map.

=== COMBAT RULES ===
Each troop type has its own ATTACK and DEFENSE values (they are not equal):
  spearman: attack 1, defense 2, speed slow (costs 15 wood + 0 iron).
  archer:   attack 2, defense 2, speed medium (costs 20 wood + 10 iron).
  knight:   attack 4, defense 2, speed fast (costs 30 wood + 30 iron).
When you ATTACK, your troops count their ATTACK; the DEFENDER counts DEFENSE.
Counter triangle (a BONUS, not an auto-win): spearman counters knight; archer counters
spearman; knight counters archer. Having the counter multiplies your force by {{1.5}}.
The MOST NUMEROUS type on each side sets the matchup (ties break in the order spearman,
archer, knight).
Defending is easier: defense counts x{{1.25}} in a village and x{{1.5}} in a castle
(capital). In the open field (on a road) there is no bonus.
The side with the higher effective force wins. Ties favor the DEFENDER.
The "effective defense" value in the report ALREADY includes the location bonus. Use it
directly; do not apply the bonus again.

=== ECONOMY RULES ===
spearman: costs 15 wood + 0 iron, ready in 1 turn.
archer:   costs 20 wood + 10 iron, ready in 1 turn.
knight:   costs 30 wood + 30 iron, ready in 1 turn.
Each of your villages produces {{30}} wood and {{20}} iron per turn.
Per-village cap: when the NUMBER of troops at home reaches {{300}}, that village stops
building (it keeps producing resources and can still receive reinforcements).
Only order a build if the village can pay the cost NOW.

=== MOVEMENT RULES ===
Your army marches along the ROAD NETWORK that connects villages, not in a straight line.
A village that looks close on the map may be far by road. See the ROAD NETWORK block.
An army STOPS at the first village on its path that is not yours and fights there, even
if you ordered a more distant destination. To reach a far target, take the villages on
the way first.
Troops sent from DIFFERENT villages never combine, even arriving at the same target on
the same turn: each send fights alone, one at a time. To attack with concentrated force,
first gather troops in one of your villages (by sending them there as reinforcements),
then attack from that village in a single send.
Each troop type has a speed: spearman (slow), archer (medium), knight (fast). A MIXED
army marches at the speed of its SLOWEST troop. The report already shows travel time per
speed (e.g. "march: 5 slow / 3 medium / 2 fast").
Marching takes turns, and during those turns the enemy keeps building and moving. The
defense you see is TODAY'S, not the defense on arrival.

[FOG — só com fog of war ligado; substitui a onisciência atual]
=== WHAT YOU CAN SEE ===
You see the full ROAD MAP (every king knows the geography), but you only see WHO HOLDS a
village and WHAT GARRISONS it if the village is yours, adjacent to one of yours, or
currently occupied or being passed by one of your armies.
Villages you saw before show their LAST KNOWN state, marked "last seen on turn N" — the
real state may have changed since. Villages you never saw are marked "unexplored".

------------------------------------------------------------------
TURN {{t}} — You are King {{side}}.
These numbers are from TURN {{t}}. Ignore quantities from earlier turns.

{{se houve rejeições E rejeicaoNoFim=false: bloco de ordens recusadas — inalterado}}

=== YOUR VILLAGES ({{n}}) ===
TOTAL: {{N}} soldiers at home ({{l}} spearmen, {{a}} archers, {{k}} knights) + {{m}} marching
[{{id}}] {{Name}} | {{BORDER with [x] / INTERIOR}} | wood {{w}} (+{{30}}/turn) | iron {{i}}
(+{{20}}/turn) | effective defense (location bonus included): {{d}} | troops at home: {{n}}/{{300}}
    AVAILABLE TO SEND NOW: {{l}} spearmen, {{a}} archers, {{k}} knights (attack if all sent: {{atk}})
    [MOTOR — nova linha, alavanca de custo nº 2 (simétrica ao "to take NOW"):]
    CAN BUILD NOW: {{q}} spearmen or {{q}} archers or {{q}} knights (or combinations; each
    build spends from this village's stock)

[TEXTO — incoerência 12: nomes em TODAS as aldeias, não só nas suas]
=== NEUTRAL VILLAGES ({{n}}) — ordered by distance from your nearest ===
[{{id}}] {{Name}} | {{garrison}} | effective defense (location bonus included): {{d}}
{{(was X, N turns ago / stable for N turns)}} | march from [{{id}}] {{Name}}: {{s}} slow /
{{m}} medium / {{f}} fast | to take NOW: {{n}} spearmen or {{n}} archers or {{n}} knights
{{| you attacked here Nx in the last 8 turns (N conquests)}}

[FOG — aldeias fora de visão, no lugar da linha completa:]
[{{id}}] {{Name}} | last seen on turn {{t}}: {{o que se sabia}} | TODAY: unknown
[{{id}}] {{Name}} | unexplored

=== ENEMY (King {{X}}) — {{n}} village(s) ===
[{{id}}] {{Name}} | {{garrison}} | effective defense (location bonus included): {{d}} | march
from [{{id}}] {{Name}}: ... | CAPITAL — the hardest target on the map
[MOTOR — incoerência 6: a capital passa a ter número como qualquer alvo:]
... | to take NOW: {{n}} spearmen or {{n}} archers or {{n}} knights

=== ROAD NETWORK (armies march along it) ===
[TEXTO — incoerência 11: forma compacta, cada aresta uma vez]
[0]{{Lisboa}}: 1, 2 | [1]{{Santarem}}: 3, 5 | [2]{{Evora}}: 6 | ...
(Ownership of each village is in the sections above. The map never changes.)

=== ARMIES IN TRANSIT ===          (inalterado, traduzido)
=== WHAT HAPPENED LAST TURN ===    (inalterado, traduzido)

------------------------------------------------------------------
Besides your orders, write two short texts:
- "plan": your NOTE TO YOUR NEXT TURN, 2-4 lines (it is cut at {{600}} characters). You
  will read it next turn. Write what you are trying to do, what you must not forget, and
  what you decided NOT to do. It is a note to yourself: be useful, not eloquent.
- "commentary": 2-4 lines telling the audience, {{in English / em portugues — config
  idiomaNarracao}}, what you did THIS turn. It may have emotion. It never comes back to you.

Reply with ONE valid JSON object and nothing else — no text before or after it.

[TEXTO — o COMEÇO da instrução corrige a incoerência 1 (reforço permitido);
 o FIM substitui o exemplo com valores pelo esquema declarado (E6b)]
Your orders, using only ids that appear in this report:
- "build": list of {"villageId": <id of one of YOUR villages>,
                    "type": "spearman" | "archer" | "knight",
                    [MOTOR — alavanca de custo nº 1:] "count": <how many, integer >= 1>}
- "send":  list of {"fromId": <id of one of YOUR villages>,
                    "toId": <id of ANY other village: enemy or neutral to attack it,
                             one of YOURS to reinforce it>,
                    "troops": {"spearman": n, "archer": n, "knight": n}}
Do not send troops a village does not have. Empty lists are valid orders.

{{=== YOUR NOTE FROM LAST TURN (written by you) ===
{{plan anterior}}
Reread it: the map has changed since. Follow it if it still makes sense; change it if not.}}
```

---

## Decisões embutidas neste rascunho (para discutir uma a uma)

1. **"Empty lists are valid orders" voltou.** Foi removida porque congelava o llama3:8b —
   mas aquela frase vinha COLADA a um exemplo copiável ("é melhor não fazer nada do que um
   ataque ruim") e o modelo copiava o molde vazio. Aqui não há molde para copiar; sem a
   permissão explícita, um modelo sem jogada válida inventa uma. Se o E6c mostrar o
   congelamento de novo, ela sai de novo — é a frase mais frágil do rascunho.
2. **O exemplo com valores morreu; o esquema enumera os três tipos sempre juntos.** Nenhum
   tipo aparece sozinho em lugar nenhum do prompt — é isso que o E6a/E6b testam.
3. **`count` no build** entra no mesmo lote do parser tolerante (aceitar os dois formatos
   durante a transição, contar `normalizacoes`).
4. **A capital ganha `to take NOW`.** Se o número assustar (ele é grande), isso é
   informação, não bug — "exército grande" sem escala é adivinhação.
5. **Nada de dica estratégica em lugar nenhum**: não há "prefira X", "considere Y". As
   únicas prescrições são de FORMATO (ids reais, não enviar o que não tem) — e todas têm
   contraparte no `diagnosticarOrdem` (princípio 6 do estudo).
6. **Fog não muda o formato da resposta** — só o relatório. Deliberado: dá para ligar o
   fog sem retreinar nenhum hábito de formato dos modelos.

## O que este rascunho NÃO resolve (fica para os lotes)

- A política tudo-ou-nada do parser e a mensagem de erro mentirosa (achado 4.3 do
  relatório da partida): correção de harness, lote F6.
- O texto do bloco de rejeições (H2 no fim vs topo): a flag existe; decidir com E6b.
- Métricas novas do analisador para os braços E6/E7 (composição vs sorteio do exemplo,
  tokens por idioma): pequenas adições ao `analisar-log.js`.
