/* Análise escrita de cada partida. Números conferidos contra o replay (.json), não contra o texto do log. */
window.ANALISES = {
"0831-P1": {
pt:`
<p>A primeira partida paga entre modelos de topo, e a que virou o <b>vídeo de estreia do canal</b>.
O <code>claude-sonnet-5</code> fechou em 19 × 5 no turno 34 — mas esteve <b>perdendo por 9 × 12 no turno 8</b>,
e a partida teve <b>10 turnos empatados</b>.</p>

<h3>O punho de Badajoz</h3>
<p>O momento que decide a leitura da partida está no turno 7. A Luna acabara de tomar Toledo, no centro do mapa.
Em vez de contra-atacar de onde estava, o Sonnet <b>parou de expandir e mandou oito exércitos, de oito aldeias
diferentes</b> — Lisboa, Santarém, Évora, Coimbra, Porto, Faro, Vigo e Sevilha — todos para o mesmo ponto: Badajoz.
No turno seguinte essa massa saiu de Badajoz em cima de Toledo e retomou a cidade num golpe só; Córdoba caiu no
mesmo turno. É o padrão que o resto da partida repete.</p>

<h3>O que separou os dois</h3>
<p>Não foi número de jogadas: a Luna mandou <b>mais</b> envios (140 contra 108). Foi o tamanho de cada um.
O Sonnet moveu <b>648 tropas em envios de 6,0 em média</b>; a Luna moveu 573 em envios de 4,1. Traduzido para o
jogo: quando a Luna atacava, o reforço do Sonnet já estava a caminho; quando o Sonnet atacava, tudo chegava junto.
As aldeias de fronteira da Luna brigavam sozinhas.</p>

<h3>Zero</h3>
<p>Os dois lados fizeram <b>zero turnos inválidos e zero correções de formato</b> em 34 turnos — a primeira vez
que isso acontece no arquivo. Foi a partida em que o benchmark deixou de medir falha de formato e passou a medir
jogo. Mediana de decisão: 57 s do Sonnet contra 37 s da Luna. Custo real: <b>US$ 2,36</b>.</p>
`,
en:`
<p>The first paid duel between frontier models, and the one that became the <b>channel's first video</b>.
<code>claude-sonnet-5</code> closed it out 19 × 5 on turn 34 — but was <b>losing 9 × 12 on turn 8</b>,
and the match spent <b>10 turns tied</b>.</p>

<h3>The fist at Badajoz</h3>
<p>The moment that explains the match is turn 7. Luna had just taken Toledo, in the middle of the map. Instead of
counter-attacking from where it stood, Sonnet <b>stopped expanding and sent eight armies, from eight different
villages</b> — Lisboa, Santarém, Évora, Coimbra, Porto, Faro, Vigo and Sevilha — all to one point: Badajoz. The
next turn that mass rode out of Badajoz onto Toledo and took the city back in a single blow; Cordoba fell the same
turn. The rest of the match repeats that pattern.</p>

<h3>What separated them</h3>
<p>Not the number of moves: Luna made <b>more</b> sends (140 against 108). It was the size of each one. Sonnet
moved <b>648 troops in sends averaging 6.0</b>; Luna moved 573 in sends averaging 4.1. In game terms: when Luna
attacked, Sonnet's reinforcements were already moving; when Sonnet attacked, everything arrived together. Luna's
frontier villages fought alone.</p>

<h3>Zero</h3>
<p>Both sides produced <b>zero invalid turns and zero format corrections</b> across 34 turns — the first time in
the archive. This was the match where the benchmark stopped measuring format failure and started measuring play.
Median decision time: 57 s for Sonnet against 37 s for Luna. Real cost: <b>US$ 2.36</b>.</p>
`},

"0831-P2": {
pt:`
<p><b>A primeira derrota do Sonnet no arquivo</b> — e ela veio com a mesma receita que tinha ganho a partida
anterior. O <code>deepseek-v4-pro</code> fechou 19 × 5 em 22 turnos.</p>

<h3>Três vezes mais jogadas, cinco vezes mais pensamento</h3>
<p>O contraste é o conteúdo da partida. O Sonnet fez <b>74 envios</b>, de 4,5 tropas em média, com mediana de
<b>3.063 tokens de raciocínio</b> e 41 s por turno. O DeepSeek fez <b>204 envios</b>, de 3,1 em média, com mediana
de <b>16.589 tokens de raciocínio</b> e <b>278 s por turno</b> — sozinho, ele respondeu por 87% do relógio da
partida.</p>
<p>Vale dizer o que isso não prova: envio pequeno não virou defeito aqui. Contra um adversário que se move três
vezes mais, a concentração que venceu a partida anterior chegou tarde demais em pontos demais.</p>

<h3>A sonda mentiu</h3>
<p>Antes da partida, uma sonda de 8 turnos deu <b>177 s</b> de mediana para o DeepSeek. Em jogo ele deu 278 s —
<b>57% acima</b>. É o terceiro registro do mesmo achado no projeto: sonda serve para admitir um modelo, não para
dimensionar quanto tempo uma bateria vai levar.</p>
<p>Seis turnos empatados, e nenhum turno inválido dos dois lados. Custo real: <b>US$ 2,01</b>.</p>
`,
en:`
<p><b>Sonnet's first loss in the archive</b> — and it came with the same recipe that had won the previous match.
<code>deepseek-v4-pro</code> closed it 19 × 5 in 22 turns.</p>

<h3>Three times the moves, five times the thinking</h3>
<p>The contrast is the match. Sonnet made <b>74 sends</b>, averaging 4.5 troops, with a median of <b>3,063
reasoning tokens</b> and 41 s per turn. DeepSeek made <b>204 sends</b>, averaging 3.1, with a median of
<b>16,589 reasoning tokens</b> and <b>278 s per turn</b> — on its own it accounted for 87% of the match's wall
clock.</p>
<p>Worth saying what this does not prove: small sends were not the flaw here. Against an opponent moving three
times as often, the concentration that won the previous match arrived too late in too many places.</p>

<h3>The probe lied</h3>
<p>Before the match, an 8-turn probe gave DeepSeek a median of <b>177 s</b>. In play it gave 278 s — <b>57%
higher</b>. It is the third time the project records the same finding: a probe is good for admitting a model, not
for sizing how long a batch will take.</p>
<p>Six tied turns, and no invalid turns on either side. Real cost: <b>US$ 2.01</b>.</p>
`},

"0901-P3": {
pt:`
<p>O <b>espelho exato</b> da partida de 31/08: mesmos dois modelos, mesma seed, lados trocados. O
<code>claude-sonnet-5</code> ganhou de novo, agora como Rei B, 18 × 6 — <b>e com isso venceu dos dois lados do
tabuleiro</b>. É também a partida mais disputada do arquivo: <b>12 turnos empatados e 5 trocas de liderança</b>
em 64 turnos.</p>

<h3>A Luna esteve a seis aldeias de ganhar</h3>
<p>No turno 29 a <code>gpt-5.6-luna</code> abriu <b>15 × 9</b> — faltavam seis aldeias para o limiar de vitória.
Perdeu. No turno 40 estava esmagada, <b>7 × 17</b>, e em seis turnos voltou a <b>13 × 11</b>, virando o jogo outra
vez. Perdeu de novo. Nenhuma outra partida do arquivo tem duas recuperações dessas.</p>

<h3>O asterisco</h3>
<p>Esta partida <b>foi retomada no turno 43</b>, depois de bater num teto de custo com o jogo ainda indeciso. A
retomada recupera o tabuleiro e os planos dos dois reis, mas <b>não</b> recupera a memória de névoa, o histórico de
defesa nem a contagem de dominância — esses recomeçam do zero ali. Para vídeo é invisível; para benchmark, esta
partida carrega asterisco.</p>

<h3>Duas coisas que ela provou</h3>
<p>Primeira: <b>zero turnos em português nos dois lados</b>, em 64 turnos — a mesma Luna que tinha escrito 10 turnos
em português na partida espelho. A correção foi traduzir as chaves do JSON do protocolo, as últimas palavras
portuguesas que o modelo via.</p>
<p>Segunda, em aberto: as <b>6 ordens rejeitadas</b> da Luna contra 1 do Sonnet. Nas outras partidas do dia esse
número era zero dos dois lados. Não se sabe se é fadiga de contexto (esta partida tem quase o dobro de turnos), se é
o lado A, ou se é ruído. Custo real: <b>US$ 4,60</b>.</p>
`,
en:`
<p>The <b>exact mirror</b> of the 31/08 match: same two models, same seed, sides swapped.
<code>claude-sonnet-5</code> won again, this time as King B, 18 × 6 — <b>which means it won from both sides of the
board</b>. It is also the closest match in the archive: <b>12 tied turns and 5 lead changes</b> across 64 turns.</p>

<h3>Luna was six villages from winning</h3>
<p>On turn 29 <code>gpt-5.6-luna</code> opened a <b>15 × 9</b> lead — six villages short of the victory threshold.
It lost. On turn 40 it was crushed, <b>7 × 17</b>, and in six turns climbed back to <b>13 × 11</b>, taking the lead
again. It lost again. No other match in the archive contains two comebacks like that.</p>

<h3>The asterisk</h3>
<p>This match <b>was resumed at turn 43</b>, after hitting a cost ceiling while still undecided. A resume restores
the board and both kings' plans, but <b>not</b> the fog memory, the defence history or the dominance count — those
restart from zero there. For video it is invisible; for the benchmark, this match carries an asterisk.</p>

<h3>Two things it proved</h3>
<p>First: <b>zero turns in Portuguese on either side</b>, across 64 turns — from the same Luna that had written 10
turns in Portuguese in the mirror match. The fix was translating the protocol's JSON keys, the last Portuguese words
the model still saw.</p>
<p>Second, still open: Luna's <b>6 rejected orders</b> against Sonnet's 1. In the day's other matches that number was
zero on both sides. Whether it is context fatigue (this match is nearly twice as long), the A side, or noise, is not
known. Real cost: <b>US$ 4.60</b>.</p>
`},

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
