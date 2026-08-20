/* Análise escrita de cada partida. Números conferidos contra o replay (.json), não contra o texto do log. */
window.ANALISES = {
"0819-P2": {
pt:`
<p>Foi a partida mais disputada já decidida na Arena: <b>a liderança trocou de mãos cinco vezes</b> antes do
<code>nemotron-3-nano-30b-a3b</code> abrir 19 × 5 e fechar por dominância no turno 29. O adversário — o
<code>nemotron-3.5-lightning</code>, a régua da tabela — liderava 9 × 8 no turno 5 e ainda estava à frente
no turno 16.</p>

<h3>O que decidiu</h3>
<p>Não foi o counter. O Rei A acertou o triângulo em <b>87% dos ataques a aldeia neutra</b> e em apenas
<b>35% contra o exército inimigo</b> — uma queda de mais de metade, exatamente o padrão que aparece em quase
todos os lados com replay. O que separou os dois foi mais bruto: <b>271 tropas movidas contra 121</b>,
envio médio de 5,2 contra 2,8, e <b>zero rejeições contra 37</b>.</p>
<p>O Rei B passou o jogo mandando exércitos pequenos demais: <b>21 dos seus 43 envios tinham uma tropa só</b>.
Contra aldeia neutra fresca isso funciona; contra uma guarnição que endurece e recebe reforço, é tropa
entregue de graça.</p>

<h3>A composição</h3>
<p>O vencedor construiu <b>71% de arqueiro</b> (113 de 159 unidades) e só 8% de lanceiro. O perdedor ficou
em 41% de lanceiro sobre um total muito menor — 70 unidades contra 159. Vale a ressalva honesta: quem está
ganhando tem mais aldeias, mais aldeias dão mais madeira, e mais madeira constrói mais tropa. Boa parte
dessa diferença é <i>consequência</i> de estar à frente, não causa.</p>

<h3>O relógio</h3>
<p>O Rei A respondeu com mediana de <b>69 s por turno</b>; o Rei B, de <b>348 s</b> — cinco vezes mais lento,
com 14 dos 29 turnos devolvendo <code>construir: []</code> e 5 terminando em <code>finish error</code>.
A partida inteira levou 3h29 de relógio. Nenhum dólar foi gasto: os dois modelos são <code>:free</code>.</p>
`,
en:`
<p>The closest match ever decided in the Arena: <b>the lead changed hands five times</b> before
<code>nemotron-3-nano-30b-a3b</code> opened a 19 × 5 gap and closed it out by dominance on turn 29. Its
opponent — <code>nemotron-3.5-lightning</code>, the table's yardstick — led 9 × 8 on turn 5 and was still
ahead on turn 16.</p>

<h3>What decided it</h3>
<p>Not the counter. King A got the triangle right in <b>87% of its attacks on neutral villages</b> and in only
<b>35% against the enemy army</b> — a drop of more than half, exactly the pattern that shows up in almost
every side with a replay. What separated them was cruder: <b>271 troops moved against 121</b>, average
send of 5.2 against 2.8, and <b>zero rejections against 37</b>.</p>
<p>King B spent the match sending armies that were too small: <b>21 of its 43 sends carried a single troop</b>.
Against a fresh neutral village that works; against a garrison that hardens and receives reinforcements, it is
a troop given away.</p>

<h3>Composition</h3>
<p>The winner built <b>71% archers</b> (113 of 159 units) and only 8% spearmen. The loser sat at 41% spearmen
over a much smaller total — 70 units against 159. An honest caveat: whoever is ahead holds more villages, more
villages produce more wood, and more wood builds more troops. Much of that gap is a <i>consequence</i> of being
ahead, not a cause.</p>

<h3>The clock</h3>
<p>King A answered with a median of <b>69 s per turn</b>; King B, <b>348 s</b> — five times slower, with 14 of
29 turns returning <code>build: []</code> and 5 ending in <code>finish error</code>. The whole match took 3h29 of
wall-clock time. No dollars were spent: both models are <code>:free</code>.</p>
`},

"0819-P4": {
pt:`
<p>A partida mais rápida já decidida: <b>16 turnos, 61 minutos, 18 × 6</b>. O
<code>dots-3-note-preview</code>, estreando na Arena, <b>nunca ficou atrás</b> — liderou desde o turno 2 e
fechou por dominância no turno 16.</p>

<h3>Venceu por volume, não por técnica</h3>
<p>É o caso mais limpo contra a leitura fácil de que "quem acerta o counter ganha". O vencedor acertou o
triângulo em <b>25% dos ataques ao inimigo</b>; o perdedor, em <b>33%</b>. O vencedor foi <i>pior</i> no
counter e ainda assim ganhou por 12 aldeias, porque construiu <b>253 unidades contra 61</b> e moveu
<b>219 tropas contra 56</b>. Numa partida curta, a escala esmaga o refinamento.</p>

<h3>A estreia mais limpa do catálogo</h3>
<p><b>Zero turnos vazios em 16</b>, duas rejeições no total, mediana de 83 s por turno. Nenhum outro modelo
novo tinha entregue uma partida inteira sem um único <code>construir: []</code>. O adversário, a régua da
tabela, teve 5 respostas cortadas por <code>finish length</code> e 5 turnos vazios.</p>

<h3>O que isso diz do limiar de vitória</h3>
<p>A regra dos 75% por dois turnos foi escrita para que a vitória custasse caro. Aqui ela disparou no turno 16
porque as neutras esgotaram no turno 12 e o vencedor já tinha 15 aldeias — a fronteira ficou curta o bastante
para segurar. Nas partidas em que o limiar não converte, o padrão é o oposto: aos 75% a frente fica tão longa
que o defensor sempre retoma alguma coisa.</p>
`,
en:`
<p>The fastest match ever decided: <b>16 turns, 61 minutes, 18 × 6</b>. <code>dots-3-note-preview</code>,
debuting in the Arena, <b>never trailed</b> — it led from turn 2 and closed out by dominance on turn 16.</p>

<h3>It won on volume, not on technique</h3>
<p>This is the cleanest case against the easy reading that "whoever gets the counter right wins". The winner got
the triangle right in <b>25% of its attacks on the enemy</b>; the loser, in <b>33%</b>. The winner was
<i>worse</i> at countering and still won by 12 villages, because it built <b>253 units against 61</b> and moved
<b>219 troops against 56</b>. In a short match, scale crushes refinement.</p>

<h3>The cleanest debut in the catalogue</h3>
<p><b>Zero empty turns out of 16</b>, two rejections in total, a median of 83 s per turn. No other newcomer had
delivered a whole match without a single <code>build: []</code>. Its opponent, the table's yardstick, had 5
responses cut off by <code>finish length</code> and 5 empty turns.</p>

<h3>What that says about the victory threshold</h3>
<p>The 75%-for-two-turns rule was written so that winning would cost something. Here it fired on turn 16 because
the neutrals ran out on turn 12 and the winner already held 15 villages — the front was short enough to hold.
In matches where the threshold does not convert, the pattern is the opposite: at 75% the front is so long that
the defender always takes something back.</p>
`}
};
