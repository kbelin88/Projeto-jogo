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
`},
"E1005-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> dominou desde o início e fechou em 19 × 5 no turno 17, mantendo a liderança incondicional do começo ao fim. A partida foi decidida pela composição de tropas: enquanto o <code>nemotron-3-super-120b-a12b</code> construiu 155 lanceiros, o Ultra investiu 124 cavaleiros contra apenas 13 do adversário.</p>

<h3>Estratégia de cavaleiros</h3>
<p>O turno 2 começou equilibrado, cada lado pegando 2 aldeias. Mas a partir do turno 3, o Ultra explorou sua superioridade com Castellón, Zaragoza e Huesca. Nos turnos 6 a 8, completou o controle do centro-norte com Valencia, Toledo, Murcia, Madrid e Córdoba — cinco cidades em três turnos. O Super tentou resistência com defesa em Coimbra, mas construção exclusiva de lanceiros nunca contra-atacaria cavaleiros eficientemente.</p>

<h3>O colapso</h3>
<p>No turno 11, o Super caiu para 10 aldeias. No turno 17, o Ultra consolidava 19 cidades contra apenas 5. No último turno, o Ultra prometia reforços em Badajoz e afirmava que o último ataque do inimigo "quebraria nas muralhas", enquanto o Super declarava defesa em Coimbra — uma partida que nunca foi competitiva.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> dominated from the start and closed at 19 × 5 on turn 17, holding unconditional leadership throughout. The match was decided by troop composition: while <code>nemotron-3-super-120b-a12b</code> built 155 spearmen, Ultra invested 124 knights against only 13 of its opponent.</p>

<h3>Knight strategy</h3>
<p>Turn 2 started balanced, each side capturing 2 villages. But from turn 3 onward, Ultra exploited its superiority with Castellón, Zaragoza, and Huesca. In turns 6 to 8, it completed north-center control with Valencia, Toledo, Murcia, Madrid, and Córdoba — five cities in three turns. The Super attempted resistance with defense at Coimbra, but exclusive spearmen construction could never counter-attack knights efficiently.</p>

<h3>The collapse</h3>
<p>On turn 11, Super fell to 10 villages. On turn 17, Ultra consolidated 19 cities against only 5. On the final turn, Ultra promised reinforcements at Badajoz and claimed the enemy's last attack would "break on its walls," while Super declared defense at Coimbra — a match that was never competitive.</p>
`},
"E1005-02": {
pt:`
<p>O <code>qwen3.8-27b</code> virou 18 × 4 no turno 16 contra o <code>nemotron-3.5-lightning</code>, que sofreu colapso total. A partida foi dominada pela diferença de construção: o Lightning construiu 38 lanceiros, 0 arqueiros e 2 cavaleiros — praticamente sem contra-ataque. O Qwen construiu 109 lanceiros, 45 arqueiros e 48 cavaleiros.</p>

<h3>Bloqueio Nordeste</h3>
<p>O turno 2 marcou o fim. Enquanto o Qwen pegava Tarragona e Girona no Nordeste, o Lightning ficava com 1 aldeia e nunca mais cresceu. Nos turnos 3 a 7, o Qwen dominou o mapa inteiro: Huesca, Zaragoza, Pamplona, Castellón, Valencia, Madrid, Burgos, Salamanca. O Lightning capturou apenas Santarem no turno 11 e Coimbra no turno 14, ambas de volta ao Qwen.</p>

<h3>Falhas críticas</h3>
<p>O Lightning teve 11 ordens rejeitadas contra 0 do Qwen — instrumento impreciso ou estratégia inviável. Com quase só lanceiros e sem arcos ou cavaleiros, nunca conseguiria resistir. O Qwen alcançou 18 aldeias no turno 16, com margem de vitória absoluta. Uma partida de 79 minutos sem resistência real.</p>
`,
en:`
<p><code>qwen3.8-27b</code> turned 18 × 4 on turn 16 against <code>nemotron-3.5-lightning</code>, which suffered complete collapse. The match was dominated by construction difference: Lightning built 38 spearmen, 0 archers, and 2 knights — practically no counter-attack. Qwen built 109 spearmen, 45 archers, and 48 knights.</p>

<h3>Northeast blockade</h3>
<p>Turn 2 marked the end. While Qwen captured Tarragona and Girona in the Northeast, Lightning stayed at 1 village and never grew again. In turns 3 to 7, Qwen dominated the entire map: Huesca, Zaragoza, Pamplona, Castellón, Valencia, Madrid, Burgos, Salamanca. Lightning captured only Santarem on turn 11 and Coimbra on turn 14, both returning to Qwen.</p>

<h3>Critical failures</h3>
<p>Lightning had 11 rejected orders against 0 for Qwen — imprecise instrument or unviable strategy. With almost only spearmen and no archers or knights, it could never resist. Qwen reached 18 villages on turn 16, with absolute victory margin. A 79-minute match without real resistance.</p>
`},
"E1005-03": {
pt:`
<p>O <code>dots-3-note-preview</code> virou a partida no turno 9 e fechou 19 × 5 no turno 23, depois de estar perdendo por 9 × 12 no turno 8. A batalha durou 23 turnos — uma das mais longas do Estádio — e foi decidida pela composição de tropas: o Dots construiu 109 cavaleiros contra apenas 14 do <code>nemotron-3-super-120b-a12b</code>.</p>

<h3>A virada no turno 9</h3>
<p>No turno 9, o Dots capturou Vigo e virou o placar de 9 × 12 para 10 × 9 — o ponto crítico. Sua estratégia era dividir o exército em três frentes: Toledo marcharia para esmagar Córdoba, Faro para quebrar Sevilha, Badajoz para forjar um martelo de cavaleiros em direção a Madrid. O Super tentou reagir ordenando arcos em todas as aldeias, mas era tarde demais.</p>

<h3>Colapso do Super</h3>
<p>De turno 9 em diante, o Dots nunca mais cedeu. Pegou Córdoba no turno 10, consolidou o controle e avançou enquanto o Super despencava. No turno 15, o Dots tinha 16 aldeias. No turno 23, consolidava 19 aldeias contra apenas 5. O Super teve 5 turnos inválidos na partida (o Dots teve zero), sugerindo dificuldade na formulação de estratégia contra cavalaria pesada.</p>
`,
en:`
<p><code>dots-3-note-preview</code> turned the match on turn 9 and closed 19 × 5 on turn 23, after being down 9 × 12 on turn 8. The battle lasted 23 turns — one of the longest at the Stadium — and was decided by troop composition: Dots built 109 knights against only 14 of <code>nemotron-3-super-120b-a12b</code>.</p>

<h3>The turnaround on turn 9</h3>
<p>On turn 9, Dots captured Vigo and flipped the scoreboard from 9 × 12 to 10 × 9 — the critical point. Its strategy was to divide the army into three fronts: Toledo would march to crush Córdoba, Faro to break Sevilha, Badajoz to forge a knight hammer toward Madrid. The Super tried to react by ordering archers at all villages, but it was too late.</p>

<h3>The Super's collapse</h3>
<p>From turn 9 onward, Dots never ceded again. It captured Cordoba on turn 10, consolidated control, and advanced while Super collapsed. On turn 15, Dots had 16 villages. On turn 23, it held 19 villages against only 5. The Super had 5 invalid turns in the match (Dots had zero), suggesting difficulty formulating strategy against heavy cavalry.</p>
`},
"E1005-04": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> venceu dominantemente 21 × 3 no turno 14, com liderança que virou duas vezes — no turno 5 para o <code>nemotron-3.5-lightning</code> e no turno 8 de volta para o Ultra. A decisão veio de construção: o Ultra fez 98 cavaleiros, 22 arqueiros e 59 lanceiros; o Lightning fez 35 lanceiros, 0 arqueiros e 0 cavaleiros.</p>

<h3>O pico do Lightning</h3>
<p>No turno 5, o Lightning liderava 7 × 6 — seu único momento de vantagem em 14 turnos. Capturara Valencia, Huesca, Girona, Zaragoza e Castellón enquanto o Ultra apenas iniciava sua expansão. Mas sem arcos ou cavaleiros, o Lightning não conseguia sustentar contra-ataques. Teve 27 ordens rejeitadas — o dobro do Ultra — enquanto o Ultra operava com apenas 2 rejeições.</p>

<h3>O esmagamento</h3>
<p>No turno 8, o Ultra virou com 10 × 9. De lá em diante, devastou o Lightning: turno 10 (12 × 9), turno 11 (15 × 8), turno 12 (17 × 7), turno 14 (21 × 3). No turno 14, o Ultra declarava: "Temos 22 aldeias; o inimigo tem 2; vitória é nossa no próximo turno". O Lightning, reduzido a 3 cidades no turno final, apenas constrói mais lanceiros.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> won dominantly 21 × 3 on turn 14, with leadership that switched twice — on turn 5 to <code>nemotron-3.5-lightning</code> and on turn 8 back to Ultra. The decision came from construction: Ultra made 98 knights, 22 archers, and 59 spearmen; Lightning made 35 spearmen, 0 archers, and 0 knights.</p>

<h3>Lightning's peak</h3>
<p>On turn 5, Lightning led 7 × 6 — its only moment of advantage in 14 turns. It had captured Valencia, Huesca, Girona, Zaragoza, and Castellón while Ultra was just starting expansion. But without archers or knights, Lightning couldn't sustain counter-attacks. It had 27 rejected orders — double Ultra's — while Ultra operated with only 2 rejections.</p>

<h3>The crushing</h3>
<p>On turn 8, Ultra turned it 10 × 9. From there onward, it devastated Lightning: turn 10 (12 × 9), turn 11 (15 × 8), turn 12 (17 × 7), turn 14 (21 × 3). On turn 14, Ultra declared: "We have twenty-two villages; the enemy has two; victory is ours next turn." Lightning, reduced to 3 cities in the final turn, merely builds more spearmen.</p>
`},
"E1005-05": {
pt:`
<p>O <code>dots-3-note-preview</code> virou a partida no turno 9 e fechou 19 × 5 no turno 14. O <code>qwen3.8-27b</code> começou na frente (11 × 10 no turno 8) mas despencou quando o Dots coordenou um ataque em quatro frentes. Nenhum dos dois teve turnos inválidos — primeira vez entre esses dois modelos.</p>

<h3>A virada no turno 9</h3>
<p>No turno 9, o Qwen tinha 9 aldeias e o Dots tinha 12 — queda brutal de um turno anterior. O Dots coordenava ataque quádruplo: Valencia em Murcia, Madrid em Burgos e Salamanca, Salamanca em Coimbra. Enquanto isso, o Qwen tentava contraataque pelos neutros (Vigo, Murcia) mas sua construção de 28 lanceiros não resistia ao arsenal do Dots: 136 arqueiros.</p>

<h3>O colapso do Qwen</h3>
<p>Após o turno 9, o Qwen nunca mais recuperou. No turno 14, caiu para 5 aldeias contra 19 do Dots. O Qwen declarava "reforçando Santarem até o último arqueiro, construindo cavaleiros", mas era tarde. O Dots consolidava seu controle com arcos massivos, pegando Coimbra no turno 10 e Santarem no turno 14. No turno 14, o Dots prometia reinforços em Sevilha e strikes em duas frentes.</p>
`,
en:`
<p><code>dots-3-note-preview</code> flipped the match on turn 9 and closed 19 × 5 on turn 14. <code>qwen3.8-27b</code> started ahead (11 × 10 on turn 8) but crashed when Dots coordinated a four-front attack. Neither had invalid turns — first time between these two models.</p>

<h3>The turnaround on turn 9</h3>
<p>On turn 9, Qwen had 9 villages and Dots had 12 — brutal drop from previous turn. Dots coordinated quadruple attack: Valencia on Murcia, Madrid on Burgos and Salamanca, Salamanca on Coimbra. Meanwhile, Qwen tried counter-attack through neutrals (Vigo, Murcia) but its construction of 28 spearmen couldn't resist Dots's arsenal: 136 archers.</p>

<h3>Qwen's collapse</h3>
<p>After turn 9, Qwen never recovered. On turn 14, it fell to 5 villages against 19 of Dots. Qwen declared "reinforcing Santarem to the last archer, building knights," but too late. Dots consolidated control with massive archers, taking Coimbra on turn 10 and Santarem on turn 14. On turn 14, Dots promised reinforcements at Sevilha and strikes on two fronts.</p>
`},
"E1006-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> conquistou 22 × 2 no turno 16 contra o <code>dots-3-note-preview</code>, numa partida onde a liderança virou decisivamente no turno 8. O mapa se dividiu cedo: A controlava Oeste e Sul, B controlava Nordeste, mas no turno 8 o Ultra inverteu tudo de forma irreversível.</p>

<h3>O turno 8 decisivo</h3>
<p>No turno 8, ambos capturavam Toledo simultaneamente — mas foi o Ultra que converteu isso em vantagem irreversível. O Ultra reuniu cavaleiros em Salamanca para um strike decisivo em Madrid, enquanto o Dots tentava dois ataques: Valencia em Murcia, Madrid em Salamanca. Após o turno 8, o Ultra tinha 12 aldeias, o Dots apenas 10 — diferença que nunca mais se fechou.</p>

<h3>A marcha final</h3>
<p>Nos turnos 9 a 16, o Ultra consolidou domínio absoluto. No turno 16, o Ultra afirmava ter 22 aldeias e prometia que suas legiões convergiriam em Huesca e Tarragona como uma maré. O Dots, reduzido a 2 aldeias (Girona e Barcelona, com um único arqueiro cada), declarava foco em reconstrução — mas era irreversível. Vitória de estratégia e execução.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> conquered 22 × 2 on turn 16 against <code>dots-3-note-preview</code>, in a match where leadership turned decisively on turn 8. The map split early: A controlled West and South, B controlled Northeast, but on turn 8 Ultra inverted everything irreversibly.</p>

<h3>The decisive turn 8</h3>
<p>On turn 8, both captured Toledo simultaneously — but Ultra converted this into an irreversible advantage. Ultra rallied knights at Salamanca for a decisive strike on Madrid, while Dots attempted two attacks: Valencia on Murcia, Madrid on Salamanca. After turn 8, Ultra had 12 villages, Dots only 10 — a difference that never closed again.</p>

<h3>The final march</h3>
<p>From turns 9 to 16, Ultra consolidated absolute dominance. On turn 16, Ultra affirmed it held 22 villages and promised its legions would converge on Huesca and Tarragona like a tide. Dots, reduced to 2 villages (Girona and Barcelona, with a single archer each), declared focus on rebuilding — but it was irreversible. Victory of strategy and execution.</p>
`},
"E1007-01": {
pt:`
<p><code>ling-3.1-flash</code> caiu de 9 aldeias no turno 6 para 5 no turno 15, derrotado pelo <code>nemotron-3-super-120b-a12b</code> com placar final de 19 × 5. A diferença estava na disciplina: Flash sofreu <b>13 turnos inválidos</b> enquanto Super manteve 0, e esse ruído custou expansão.</p>

<h3>A aposta errada em arqueiros</h3>
<p>Flash construiu <b>64 arqueiros contra 27 lanceiros</b>; Super fez o inverso, com <b>171 lanceiros contra 36 arqueiros</b>. Flash esperava vencer por atrito, mas seus turnos inválidos quebraram o ritmo de consolidação. No turno 6 os dois estavam 7 × 7; Super aproveitou para avançar enquanto Flash perdia coesão, caindo para 5 × 12 no turno 10.</p>

<h3>O colapso tardio</h3>
<p>Flash resistiu até o turno 10 (10 × 12), mas o investimento pesado em arcos não se traduziu em defesa de fronteira. Super conquistou Madrid, Teruel e Pamplona todas no turno 8, consolidando o centro do mapa. No turno 13 Flash perdeu 3 aldeias de uma vez (9 × 16). Flash tentou recuperar com 9 arqueiros em cada aldeia no turno 15, declarando que arcos eram "a resposta", mas chegava tarde.</p>
`,
en:`
<p><code>ling-3.1-flash</code> fell from 9 villages on turn 6 to 5 on turn 15, defeated by <code>nemotron-3-super-120b-a12b</code> with a final score of 19 × 5. The difference was discipline: Flash suffered <b>13 invalid turns</b> while Super held 0, and that noise cost expansion momentum.</p>

<h3>The wrong bet on archers</h3>
<p>Flash built <b>64 archers against 27 spearmen</b>; Super did the reverse, with <b>171 spearmen against 36 archers</b>. Flash expected to win by attrition, but its invalid turns broke the consolidation rhythm. On turn 6 both stood 7 × 7; Super capitalized to advance while Flash lost cohesion, dropping to 5 × 12 by turn 10.</p>

<h3>The late collapse</h3>
<p>Flash held on until turn 10 (10 × 12), but the heavy investment in bows did not translate into frontier defense. Super conquered Madrid, Teruel, and Pamplona all on turn 8, consolidating the center of the map. By turn 13 Flash lost 3 villages at once (9 × 16). Flash tried recovery with 9 archers in each village on turn 15, declaring archers were "the answer", but arrived too late.</p>
`},
"E1007-02": {
pt:`
<p><code>ling-3.1-flash</code> conquistou Santarem e Évora cedo (turno 3, placar 3 × 5), mas <code>nemotron-3-ultra-550b-a55b</code> respondeu com uma campanha de <b>0 turnos inválidos</b> que acelerou a dominância. Resultado final: 20 × 4 em 13 turnos, a vitória mais rápida desta noite.</p>

<h3>O start ofensivo que não durou</h3>
<p>Flash saiu na frente com <b>23 cavaleiros contra 62 do Ultra</b>, mas desperdiçou a vantagem. Construiu 6 lanceiros e 17 arqueiros — numeros que sugerem improviso. Flash ficou 7 × 7 entre os turnos 5 e 8, período em que Ultra conquistava calmamente: Castellon, Huesca, Zaragoza, Valência. Quando Flash tomou Salamanca no turno 8, Ultra recapturou no mesmo turno e avançou para Toledo no turno 9.</p>

<h3>Colapso acelerado</h3>
<p>No turno 9 Flash caiu de 7 para 13 aldeias do Ultra. Ultra construiu <b>65 arqueiros e 62 cavaleiros</b>, um equilíbrio que Flash não conseguiu contra-atacar. Flash sofreu <b>13 turnos inválidos e 5 ordens rejeitadas</b> no mesmo arquivo onde Ultra marcou <b>zero de tudo</b>. O contraste de qualidade de comando era demais: Ultra consolidou a Península em 13 turnos.</p>
`,
en:`
<p><code>ling-3.1-flash</code> conquered Santarem and Évora early (turn 3, score 3 × 5), but <code>nemotron-3-ultra-550b-a55b</code> answered with a campaign of <b>0 invalid turns</b> that accelerated dominance. Final result: 20 × 4 in 13 turns, the fastest victory of tonight.</p>

<h3>The offensive start that didn't last</h3>
<p>Flash went ahead with <b>23 knights against 62 of Ultra</b>, but wasted the edge. Built 6 spearmen and 17 archers — numbers suggesting improvisation. Flash held 7 × 7 between turns 5 and 8, the period when Ultra calmly conquered: Castellon, Huesca, Zaragoza, Valencia. When Flash took Salamanca on turn 8, Ultra recaptured on the same turn and advanced to Toledo on turn 9.</p>

<h3>Accelerated collapse</h3>
<p>On turn 9 Flash fell from 7 to 13 villages for Ultra. Ultra built <b>65 archers and 62 knights</b>, a balance Flash couldn't counter-attack. Flash suffered <b>13 invalid turns and 5 rejected orders</b> in the same match where Ultra scored <b>zero of everything</b>. The contrast in command quality was overwhelming: Ultra consolidated the Peninsula in 13 turns.</p>
`},
"E1007-03": {
pt:`
<p>Flash começou agressivo e liderou 13 × 9 no turno 10, mas <code>dots-3-note-preview</code> guardou <b>103 cavaleiros</b> para o ataque final: no turno 16, quatro exércitos simultâneos tomaram Coimbra, Faro, Sevilha e Lisboa numa única jogada, destruindo a resistência de Flash que caiu de 6 aldeias para o isolamento em Évora. Resultado: 19 × 5.</p>

<h3>A armadilha dos cavaleiros</h3>
<p>Flash construiu 16 cavaleiros; Dots construiu 103. Dots também investiu pesado em lanceiros (79), criando um arsenal que Flash não viu vindo. No turno 7, Dots ainda tinha apenas 7 aldeias contra 9 de Flash. Mas Dots estava acumulando: nos turnos 8 a 14, conquistou Madrid e Pamplona enquanto Flash se expandia localmente e sentia-se seguro.</p>

<h3>A queda de um turno</h3>
<p>No turno 15 a primeira brecha: Dots conquistou uma aldeia e Flash perdeu uma, score 6 × 18. No turno 16, o golpe: os <b>103 cavaleiros e 79 lanceiros de Dots</b> convergiram de quatro frentes simultâneas (Coimbra, Faro, Sevilha, Lisboa). Flash caiu para a única aldeia restante, Évora. Flash sofreu <b>16 turnos inválidos</b> e Dots apenas 2, e esse ruído impediu Flash de perceber a acumulação.</p>
`,
en:`
<p>Flash started aggressive and led 13 × 9 on turn 10, but <code>dots-3-note-preview</code> kept <b>103 knights</b> for the final assault: on turn 16, four simultaneous armies took Coimbra, Faro, Sevilha and Lisboa in a single move, destroying Flash's resistance as it fell from 6 villages to isolation in Évora. Result: 19 × 5.</p>

<h3>The knight trap</h3>
<p>Flash built 16 knights; Dots built 103. Dots also invested heavily in spearmen (79), creating an arsenal Flash didn't see coming. On turn 7, Dots still had only 7 villages against 9 for Flash. But Dots was accumulating: between turns 8 and 14, it conquered Madrid and Pamplona while Flash expanded locally and felt secure.</p>

<h3>The one-turn collapse</h3>
<p>On turn 15 the first crack: Dots conquered one village and Flash lost one, score 6 × 18. On turn 16, the strike: Dots' <b>103 knights and 79 spearmen</b> converged from four simultaneous fronts (Coimbra, Faro, Sevilha, Lisboa). Flash fell to the only remaining village, Évora. Flash suffered <b>16 invalid turns</b> and Dots only 2, and that noise prevented Flash from noticing the buildup.</p>
`},
"E1007-05": {
pt:`
<p>Repetição: <code>ling-3.1-flash</code> contra <code>nemotron-3-super-120b-a12b</code> novamente (era a partida E1007-01). Super vence 20 × 4 em 18 turnos, um comando mais longo mas com o mesmo desfecho. Flash começou bem (5 × 3 no turno 3) mas a liderança virou 3 vezes e Flash desabou de 13 aldeias no turno 10-11 para 4 no turno 18.</p>

<h3>O começo esperançoso</h3>
<p>Flash conquistou Santarem, Évora e Coimbra nos primeiros turnos, enquanto Super partia de Tarragona. Flash abriu vantagem 6 × 4 (turno 4), mas Super respondeu. A liderança virou nos turnos 4, 6 (Flash na frente 9 × 7) e turno 13. Flash construiu <b>78 lanceiros e 23 cavaleiros</b>; Super contrabalanceou com <b>101 arqueiros e 98 cavaleiros</b>, quase dois terços cavalaria.</p>

<h3>A resistência que não segurou</h3>
<p>Flash chegou ao pico de 13 aldeias no turno 10-11, mas aí começou o colapso. Super conquistou Córdoba (turno 10) e começou o cerco. No turno 13 a liderança virou para Super novamente (11 × 12). Flash ainda mandou no turno 18 uma declaração sobre fortalecer as garitas (35 lanceiros em Coimbra, 28 em Porto), mas já estava em apenas 4 aldeias. Super construiu cavaleiros e arqueiros em número que Flash, com seus 15 turnos inválidos no arquivo, nunca conseguiu contabilizar.</p>
`,
en:`
<p>Repeat: <code>ling-3.1-flash</code> versus <code>nemotron-3-super-120b-a12b</code> again (it was match E1007-01). Super wins 20 × 4 in 18 turns, a longer match but the same outcome. Flash started well (5 × 3 on turn 3) but leadership switched 3 times and Flash collapsed from 13 villages on turns 10-11 to 4 on turn 18.</p>

<h3>The hopeful start</h3>
<p>Flash conquered Santarem, Évora and Coimbra in the first turns, while Super departed from Tarragona. Flash opened a 6 × 4 lead (turn 4), but Super responded. Leadership switched on turns 4, 6 (Flash ahead 9 × 7) and turn 13. Flash built <b>78 spearmen and 23 knights</b>; Super balanced with <b>101 archers and 98 knights</b>, almost two-thirds cavalry.</p>

<h3>The resistance that didn't hold</h3>
<p>Flash peaked at 13 villages on turns 10-11, but then collapse began. Super conquered Córdoba (turn 10) and started the siege. On turn 13 leadership switched to Super again (11 × 12). Flash still sent on turn 18 a declaration about fortifying the garrisons (35 spearmen in Coimbra, 28 in Porto), but stood in only 4 villages. Super built knights and archers in numbers that Flash, with its 15 invalid turns in the record, never managed to account for.</p>
`},
"E1007-04": {
pt:`
<p>Única vitória do Flash em cinco noites: <code>ling-3.1-flash</code> venceu <code>nemotron-3.5-lightning</code> com 18 × 2 em 18 turnos. Mas esta não é uma história de competência — é um retrato de colapso de Lightning, que sofreu <b>82 ordens rejeitadas</b> e construiu apenas 4 lanceiros, 4 arqueiros, 0 cavaleiros em toda a partida.</p>

<h3>O adversário que não atacou</h3>
<p>Lightning conquistou apenas Tarragona, Castellon, Valencia e Teruel; nunca evoluiu a estratégia além dessa tríade de aldeias. Flash, por sua vez, sofreu 16 turnos inválidos (padrão da noite) mas construiu <b>85 lanceiros, 49 arqueiros, 35 cavaleiros</b>. No turno 4, Flash já tinha 6 aldeias contra 4 de Lightning. Lightning nunca respondeu — ficou preso em seus 4 vilarejos.</p>

<h3>Quando a máquina não funciona</h3>
<p>Lightning gerou <b>82 ordens rejeitadas</b> em 18 turnos. Isso sugere tentativas de comando que o sistema não entendia ou recusava. Flash consolidou a Península enquanto Lightning tropecia em suas próprias instruções. É uma vitória ruidosa — Flash não ganhou por ser melhor, mas porque seu adversário literalmente não conseguiu atacar.</p>
`,
en:`
<p>Flash's only victory in five nights: <code>ling-3.1-flash</code> defeated <code>nemotron-3.5-lightning</code> 18 × 2 in 18 turns. But this is not a story of competence — it is a portrait of Lightning's collapse, which suffered <b>82 rejected orders</b> and built only 4 spearmen, 4 archers, 0 knights across the entire match.</p>

<h3>The opponent that didn't attack</h3>
<p>Lightning conquered only Tarragona, Castellon, Valencia and Teruel; never evolved strategy beyond that trio of villages. Flash, in turn, suffered 16 invalid turns (the night's pattern) but built <b>85 spearmen, 49 archers, 35 knights</b>. By turn 4, Flash already held 6 villages against 4 for Lightning. Lightning never responded — stuck in its 4 hamlets.</p>

<h3>When the machine doesn't work</h3>
<p>Lightning generated <b>82 rejected orders</b> in 18 turns. This suggests command attempts that the system didn't understand or refused. Flash consolidated the Peninsula while Lightning stumbled over its own instructions. It's a noisy victory — Flash didn't win by being better, but because its opponent literally couldn't attack.</p>
`},
"E1008-01": {
pt:`
<p>A vitória do <code>ultra</code> sobre o <code>flash</code> mostra como a quantidade de turnos inválidos pode prejudicar a estratégia. O Ultra fechou em 19 × 5 no turno 15 — após dominar completamente a segunda metade da partida, mas enfrentou <b>um Flash que quase virou com um pico agressivo no turno 5</b>.</p>

<h3>O pico e a queda</h3>
<p>No turno 5, o Flash disparou: saiu de 6 aldeias para 8, com Girona, Valencia, Huesca e Madrid caindo em sequência. Ultra permanecia em 7. Mas no turno 8, com Toledo e Sevilha conquistadas, Ultra virou a mesa. Flash ainda cresceu para 11 aldeias no turno 9, alcançando seu pico máximo, mas a diferença de construção era letal: Ultra produziu 58 lanceiros, 41 arqueiros e 77 cavaleiros, contra apenas 16 lanceiros, 37 arqueiros e 19 cavaleiros do Flash.</p>

<h3>A diferença que decidiu</h3>
<p>Flash enfrentou 11 turnos inválidos durante a partida contra apenas 2 do Ultra. Isso custou reações rápidas em momentos decisivos. Do turno 11 em diante, Ultra cresceu de forma imparável: 12, 13, 16 e finalmente 19 aldeias, enquanto Flash desabou para 5. A superioridade numérica de tropas, somada à confiabilidade de turnos válidos, transformou um momento de risco em dominância incontestável.</p>
`,
en:`
<p>The victory of <code>ultra</code> over <code>flash</code> shows how invalid turns can damage strategy. Ultra finished 19 × 5 on turn 15 — after completely dominating the second half, but faced <b>a Flash that almost turned the game with an aggressive spike on turn 5</b>.</p>

<h3>The spike and the fall</h3>
<p>On turn 5, Flash surged: from 6 villages to 8, with Girona, Valencia, Huesca, and Madrid falling in sequence. Ultra remained at 7. But on turn 8, with Toledo and Sevilha conquered, Ultra turned the tables. Flash even grew to 11 villages on turn 9, reaching its peak, but the construction gap was lethal: Ultra produced 58 spearmen, 41 archers, and 77 knights, against only 16 spearmen, 37 archers, and 19 knights for Flash.</p>

<h3>The difference that decided</h3>
<p>Flash faced 11 invalid turns during the match versus only 2 for Ultra. This cost quick reactions at crucial moments. From turn 11 onwards, Ultra grew unstoppably: 12, 13, 16, and finally 19 villages, while Flash collapsed to 5. The numerical superiority in troops, combined with reliable valid turns, transformed a moment of risk into undeniable dominance.</p>
`},
"E1008-02": {
pt:`
<p>A vitória do <code>dots</code> sobre o <code>lightning</code> é quase sem suspense: Dots liderou desde o turno 2 e nunca olhou para trás, encerrando em 19 × 4 no turno 13. O <b>choque é a assimetria de construção</b>: Dots produziu 61 lanceiros, 77 arqueiros e 69 cavaleiros, enquanto Lightning construiu apenas 21 lanceiros, 12 arqueiros e 4 cavaleiros — e ainda teve 16 ordens rejeitadas.</p>

<h3>Liderança precoce</h3>
<p>Desde o turno 2, Dots já tinha 3 aldeias contra 2 do Lightning. Turno 3: 5 × 2. Turno 4: 7 × 4. Turno 5: 9 × 6. O padrão é claro e consistente: Dots toma duas aldeias a cada turno enquanto Lightning fica para trás. Dots conquistou Santarém, Évora, Coimbra, Faro, Badajoz, Porto, Sevilha, Vigo, Salamanca, Córdoba, Madrid, Toledo e Burgos — uma rota praticamente ininterrupta pelo mapa.</p>

<h3>A diferença nas unidades</h3>
<p>Lightning construiu apenas 21 lanceiros, 12 arqueiros e 4 cavaleiros em 13 turnos. Dots foi para 61 lanceiros, 77 arqueiros e 69 cavaleiros. Além disso, Lightning sofreu 16 rejeições de ordem, sugerindo problemas na execução das estratégias. Com tal desequilíbrio, a partida foi apenas um exercício de expansão contínua de Dots até a vitória previsível.</p>
`,
en:`
<p>The victory of <code>dots</code> over <code>lightning</code> is almost without suspense: Dots led from turn 2 and never looked back, ending 19 × 4 on turn 13. The <b>shock is the construction asymmetry</b>: Dots produced 61 spearmen, 77 archers, and 69 knights, while Lightning built only 21 spearmen, 12 archers, and 4 knights — and still suffered 16 rejected orders.</p>

<h3>Early leadership</h3>
<p>From turn 2, Dots already had 3 villages against 2 for Lightning. Turn 3: 5 × 2. Turn 4: 7 × 4. Turn 5: 9 × 6. The pattern is clear and consistent: Dots takes two villages each turn while Lightning falls behind. Dots conquered Santarém, Évora, Coimbra, Faro, Badajoz, Porto, Sevilha, Vigo, Salamanca, Córdoba, Madrid, Toledo, and Burgos — an almost uninterrupted path across the map.</p>

<h3>The difference in units</h3>
<p>Lightning built only 21 spearmen, 12 archers, and 4 knights in 13 turns. Dots reached 61 spearmen, 77 archers, and 69 knights. Furthermore, Lightning suffered 16 order rejections, suggesting problems in strategy execution. With such imbalance, the match was merely an exercise in Dots' continuous expansion toward predictable victory.</p>
`},
"E1008-03": {
pt:`
<p>A vitória do <code>ultra</code> sobre o <code>super</code> é dominante: 18 × 6 no turno 13, com zero turnos inválidos em ambos os lados — a execução foi limpa, mas o resultado não foi competitivo. Ultra liderou desde o turno 2 e jamais foi ameaçado, apesar de <b>ambos terem construído majoritariamente arqueiros</b>.</p>

<h3>A aposta nos arqueiros</h3>
<p>Super investiu em arqueiros: 82 do total de suas unidades, com apenas 6 lanceiros e 6 cavaleiros. Ultra também apostou em arqueiros: 146 do total, mas mantendo 20 lanceiros para suporte — uma escolha que deixou Ultra com mais opções de ataque em diferentes fronteiras durante a partida.</p>

<h3>O domínio sem contestação</h3>
<p>Ultra conquistou 2 aldeias no turno 2 (Tarragona, Girona) e 3 no turno 3 (Zaragoza, Castellón, Huesca), alcançando 6 aldeias enquanto Super tinha apenas 2. De lá em diante, a diferença só cresceu. Com construção tão superior em quantidade — 20 lanceiros vs 6, 146 arqueiros vs 82, 1 cavaleiro vs 6 — Ultra garantiu controle de qualquer confronto. Super jamais liderou, jamais ameaçou, e a partida foi mais um teste de capacidades do que uma disputa.</p>
`,
en:`
<p>The victory of <code>ultra</code> over <code>super</code> is dominant: 18 × 6 on turn 13, with zero invalid turns on both sides — execution was clean, but the result wasn't competitive. Ultra led from turn 2 and was never threatened, despite <b>both building primarily archers</b>.</p>

<h3>The bet on archers</h3>
<p>Super invested in archers: 82 of its units, with only 6 spearmen and 6 knights. Ultra also bet on archers: 146 of its total, but maintaining 20 spearmen for support — a choice that left Ultra with more attack options across different frontiers during the match.</p>

<h3>Uncontested dominance</h3>
<p>Ultra conquered 2 villages on turn 2 (Tarragona, Girona) and 3 on turn 3 (Zaragoza, Castellón, Huesca), reaching 6 villages while Super had only 2. From there, the gap only grew. With such superior construction in quantity — 20 spearmen vs 6, 146 archers vs 82, 1 knight vs 6 — Ultra ensured control of any engagement. Super never led, never threatened, and the match was more a test of capabilities than a real competition.</p>
`},
"E1008-05": {
pt:`
<p>A vitória do <code>dots</code> sobre o <code>flash</code> é uma maratona de 26 turnos onde <b>Flash enfrentou 22 turnos inválidos</b> — quase exclusivamente prejudicado — enquanto Dots produzia 364 lanceiros, 3 arqueiros e 122 cavaleiros. O placar final foi 18 × 6, mas os dois chegaram a empate raro de 12 × 12 no turno 21.</p>

<h3>A batalha do meio</h3>
<p>Nos turnos 4 a 10, a partida foi decisivamente competitiva. Flash tomou Madrid, Girona e Valencia no turno 4, abrindo para 7 × 7 no turno 5. Flash cresceu para 9 aldeias (turnos 6-7), enquanto Dots permanecia em 8. Mas no turno 8, Dots atacou: Salamanca caiu de volta, virando para 9 × 8. No turno 10, Madrid e Toledo também caíram para Dots, abrindo para 13 × 7. Foi o ponto de virada definitivo.</p>

<h3>A construção massiva vs os turnos inválidos</h3>
<p>Dots produziu 364 lanceiros, 3 arqueiros e 122 cavaleiros — uma estratégia de carne de lança massiva. Flash produziu 6 lanceiros, 147 arqueiros e 27 cavaleiros. Mas Flash sofreu 22 turnos inválidos, paralisando sua execução enquanto Dots agia. Mesmo com Dots sofrendo 5 turnos inválidos e 27 ordens rejeitadas, a quantidade de ações válidas foi incomparável. No turno 21 chegaram a 12 aldeias cada — empate raro — mas Dots recuperou no turno 22 com 13 e nunca mais deixou Flash voltar.</p>
`,
en:`
<p>The victory of <code>dots</code> over <code>flash</code> is a 26-turn marathon where <b>Flash faced 22 invalid turns</b> — almost exclusively hampered — while Dots produced 364 spearmen, 3 archers, and 122 knights. The final score was 18 × 6, but both reached a rare 12 × 12 tie on turn 21.</p>

<h3>The mid-game battle</h3>
<p>In turns 4 to 10, the match was decisively competitive. Flash took Madrid, Girona, and Valencia on turn 4, opening to 7 × 7 on turn 5. Flash grew to 9 villages (turns 6-7), while Dots remained at 8. But on turn 8, Dots attacked: Salamanca fell back, turning to 9 × 8. On turn 10, Madrid and Toledo also fell to Dots, opening to 13 × 7. It was the definitive turning point.</p>

<h3>Massive construction vs invalid turns</h3>
<p>Dots produced 364 spearmen, 3 archers, and 122 knights — a strategy of massive cannon fodder. Flash produced 6 spearmen, 147 archers, and 27 knights. But Flash suffered 22 invalid turns, paralyzing its execution while Dots acted. Even with Dots suffering 5 invalid turns and 27 rejected orders, the volume of valid actions executed was incomparable. On turn 21 both reached 12 villages each — a rare tie — but Dots recovered on turn 22 with 13 and never let Flash return.</p>
`},
"E1009-01": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu o <code>nemotron-3-ultra-550b-a55b</code> com placar final de <b>19 × 5 em 19 turnos</b>. 
A partida começou desfavorável para dots-3 — no turno 11 estavam empatados 12 × 12 — mas a liderança virou no turno 12, quando dots-3 avançou para 13 aldeias enquanto ultra caiu para 11.</p>

<h3>Arqueiros contra lanceiros puros</h3>
<p>A diferença decisiva está na composição de tropas. O ultra construiu <b>176 lanceiros e zero arqueiros</b>, apostando tudo em uma unidade. 
O dots-3 construiu <b>181 arqueiros</b> junto com 66 lanceiros, criando uma força balanceada. Contra lanceiros puros, arqueiros ganham a troca — e cada ataque de dots-3 
chegava com mais eficiência. Após tomar a frente no turno 12, dots-3 abriu 2 aldeias de vantagem e não soltou mais.</p>

<h3>O colapso dos dados</h3>
<p>Dots-3 teve 1 turno inválido e 2 ordens rejeitadas; ultra teve 2 turnos inválidos. Ultra também cometeu mais erros de formato, 
enquanto dots-3 manteve controle. A partida levou 118 minutos, com dots-3 liderando de forma clara após a virada do turno 12.</p>
`,
en:`
<p><code>dots-3-note-preview</code> defeated <code>nemotron-3-ultra-550b-a55b</code> with a final score of <b>19 × 5 in 19 turns</b>. 
The match began unfavorably for dots-3 — tied 12 × 12 at turn 11 — but the lead shifted at turn 12, when dots-3 advanced to 13 villages while ultra dropped to 11.</p>

<h3>Archers versus pure spearmen</h3>
<p>The decisive difference lies in troop composition. Ultra built <b>176 spearmen and zero archers</b>, betting everything on a single unit. 
Dots-3 built <b>181 archers</b> alongside 66 spearmen, creating a balanced force. Against pure spearmen, archers win the trade — and each dots-3 attack 
landed with greater efficiency. After taking the lead at turn 12, dots-3 opened a 2-village advantage and never let go.</p>

<h3>The collapse of the data</h3>
<p>Dots-3 had 1 invalid turn and 2 rejected orders; ultra had 2 invalid turns. Ultra also committed more format errors, 
while dots-3 maintained control. The match lasted 118 minutes, with dots-3 leading decisively after the turn 12 shift.</p>
`},
"E1009-02": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> dominou o <code>nemotron-3.5-lightning</code> em uma vitória por <b>18 × 6 em 15 turnos</b>. 
Lightning nunca liderou — ultra começou 3 × 1 no turno 2 e consolidou uma vantagem que só cresceu.</p>

<h3>Lanceiros contra tudo</h3>
<p>Lightning cometeu um erro fundamental: construiu <b>121 lanceiros e zero arqueiros ou cavaleiros</b>. 
Ultra, por sua vez, diversificou com <b>61 lanceiros, 31 arqueiros e 87 cavaleiros</b>, criando uma força versátil que contra-atacava em vantagem. 
Contra uma força unidimensional, essa mistura dominava.</p>

<h3>Erros demais</h3>
<p>Lightning teve 3 turnos inválidos e <b>10 ordens rejeitadas</b> — o dobro de ultra (2 rejeitadas). A falta de precisão nas ordens combinada 
com uma estratégia de tropas inadequada tornou a partida um passeio: ultra cresceu para 15 aldeias já no turno 10 e fechou em 18 no turno 14. 
Partida levou 186 minutos, mas o resultado foi claro desde cedo.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> dominated <code>nemotron-3.5-lightning</code> in a victory of <b>18 × 6 in 15 turns</b>. 
Lightning never led — ultra started 3 × 1 at turn 2 and consolidated an advantage that only grew.</p>

<h3>Spearmen against everything</h3>
<p>Lightning made a fundamental mistake: it built <b>121 spearmen and zero archers or knights</b>. 
Ultra, meanwhile, diversified with <b>61 spearmen, 31 archers, and 87 knights</b>, creating a versatile force that counter-attacked at advantage. 
Against a one-dimensional force, this mix dominated.</p>

<h3>Too many errors</h3>
<p>Lightning had 3 invalid turns and <b>10 rejected orders</b> — double ultra's 2 rejections. The lack of precision in orders combined 
with an inadequate troop strategy made the match a walkover: ultra grew to 15 villages by turn 10 and closed at 18 by turn 14. 
The match took 186 minutes, but the result was clear from the start.</p>
`},
"E1009-03": {
pt:`
<p>O <code>nemotron-3-super-120b-a12b</code> venceu o <code>nemotron-3.5-lightning</code> com placar de <b>18 × 5 em 19 turnos</b>. 
Lightning saiu na frente com 9 aldeias no turno 9, mas super virou no turno 11 com 9 × 8 e nunca mais perdeu a liderança.</p>

<h3>A fábrica de arqueiros</h3>
<p>Super construiu um número impressionante: <b>269 arqueiros</b> contra apenas 11 lanceiros. 
Lightning, por sua vez, investiu em lanceiros (69) mas quase nenhum arqueiro (3). Quando super chegou ao turno 11 com sua infantaria de arqueiros consolidada, 
Lightning não tinha como responder — os lanceiros sofrem contra arqueiros na relação de troca.</p>

<h3>O colapso de Lightning</h3>
<p>Lightning teve 4 turnos inválidos; super teve 0. Essa diferença de confiabilidade foi determinante. 
Após tomar a frente no turno 11, super consolidou: turno 14 já tinha 11 aldeias, turno 15 tinha 14. Lightning caiu para 5 aldeias no turno 19. 
A partida levou 237 minutos, mas a estratégia de super — archers em massa — venceu a desordem de Lightning.</p>
`,
en:`
<p><code>nemotron-3-super-120b-a12b</code> defeated <code>nemotron-3.5-lightning</code> with a score of <b>18 × 5 in 19 turns</b>. 
Lightning started ahead with 9 villages at turn 9, but super reversed at turn 11 with 9 × 8 and never lost the lead again.</p>

<h3>The archer factory</h3>
<p>Super built an impressive number: <b>269 archers</b> against only 11 spearmen. 
Lightning, meanwhile, invested in spearmen (69) but almost no archers (3). When super arrived at turn 11 with its consolidated archer infantry, 
Lightning had no way to respond — spearmen suffer against archers in trade ratio.</p>

<h3>Lightning's collapse</h3>
<p>Lightning had 4 invalid turns; super had 0. This difference in reliability was decisive. 
After taking the lead at turn 11, super consolidated: by turn 14 it had 11 villages, turn 15 had 14. Lightning fell to 5 villages at turn 19. 
The match took 237 minutes, but super's strategy — archers in mass — defeated Lightning's disorder.</p>
`},
"E1009-04": {
pt:`
<p>O <code>nemotron-3-super-120b-a12b</code> venceu o <code>ling-3.1-flash</code> em uma <b>vitória de 18 × 6 em 22 turnos</b> com uma das partidas mais instáveis do dia: 
<b>3 viradas de liderança</b> (turnos 10, 11 e 17).</p>

<h3>Lanceiros em massa versus força mínima</h3>
<p>Super construiu <b>307 lanceiros</b> — o maior número de qualquer rei no dia — junto com 42 cavaleiros e 13 arqueiros. 
Flash, por seu lado, construiu apenas <b>24 lanceiros, 41 arqueiros e 37 cavaleiros</b>, uma força bem menor. 
Super começou devagar (3 × 5 no turno 3) mas no turno 10 explodia: 12 × 10. Flash ainda retrucou para 13 × 12 no turno 11, mas super consolidou depois.</p>

<h3>Os turnos inválidos de Flash</h3>
<p>Flash teve <b>14 turnos inválidos</b> em 22 turnos — uma taxa de erro devastadora. Isso interrompeu qualquer chance de Flash manter a pressão. 
Super aproveitou para crescer de forma consistente: turno 15 tinha 10 aldeias, turno 20 tinha 17, turno 21 fechou em 18. 
A partida levou 208 minutos e mostrou como erros de formato podem custar uma vitória.</p>
`,
en:`
<p><code>nemotron-3-super-120b-a12b</code> defeated <code>ling-3.1-flash</code> in a <b>victory of 18 × 6 in 22 turns</b> with one of the day's most unstable matches: 
<b>3 lead reversals</b> (turns 10, 11, and 17).</p>

<h3>Spearmen in mass versus minimum force</h3>
<p>Super built <b>307 spearmen</b> — the highest number of any king on the day — along with 42 knights and 13 archers. 
Flash, for its part, built only <b>24 spearmen, 41 archers, and 37 knights</b>, a much smaller force. 
Super started slow (3 × 5 at turn 3) but exploded at turn 10: 12 × 10. Flash even struck back to 13 × 12 at turn 11, but super consolidated after.</p>

<h3>Flash's invalid turns</h3>
<p>Flash had <b>14 invalid turns</b> in 22 turns — a devastating error rate. This interrupted any chance Flash had of maintaining pressure. 
Super took advantage to grow consistently: turn 15 had 10 villages, turn 20 had 17, turn 21 closed at 18. 
The match took 208 minutes and showed how format errors can cost a victory.</p>
`},
"E1009-06": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu o <code>nemotron-3-super-120b-a12b</code> em uma partida de <b>28 turnos com placar final 19 × 5</b> — 
a mais longa do dia. Dots-3 liderou desde o turno 2 (3 × 2) e nunca perdeu a vantagem.</p>

<h3>Lanceiros em escala versus arqueiros sem resposta</h3>
<p>Dots-3 construiu <b>512 lanceiros</b>, o maior número de qualquer unidade neste dia. Super respondeu com <b>200 arqueiros</b> — contra lanceiros puros, 
isso deveria ser efetivo, mas a escala de dots-3 era avassaladora. Dots-3 também construiu 73 cavaleiros, dando versatilidade que super não tinha 
(apenas 9 cavaleiros e 116 lanceiros).</p>

<h3>Super não conseguiu virar</h3>
<p>Super começou fraco (2 aldeias no turno 2) e tentou se recuperar, mas dots-3 manteve liderança consistente. 
Super teve 0 turnos inválidos, um desempenho limpo, mas 13 ordens rejeitadas mostraram dificuldade em execução. 
Dots-3 teve 4 turnos inválidos mas nenhuma ordem rejeitada. A partida levou 213 minutos, lenta mas constante — dots-3 consolidou e esprimiu a vitória até o turno 28, 
quando chegou a 19 aldeias.</p>
`,
en:`
<p><code>dots-3-note-preview</code> defeated <code>nemotron-3-super-120b-a12b</code> in a match of <b>28 turns with final score 19 × 5</b> — 
the longest of the day. Dots-3 led from turn 2 (3 × 2) and never lost the advantage.</p>

<h3>Spearmen at scale versus archers without an answer</h3>
<p>Dots-3 built <b>512 spearmen</b>, the largest unit count of any kind this day. Super responded with <b>200 archers</b> — against pure spearmen, 
this should be effective, but dots-3's scale was overwhelming. Dots-3 also built 73 knights, giving versatility that super didn't have 
(only 9 knights and 116 spearmen).</p>

<h3>Super couldn't reverse</h3>
<p>Super started weak (2 villages at turn 2) and tried to recover, but dots-3 maintained consistent leadership. 
Super had 0 invalid turns, a clean performance, but 13 rejected orders showed difficulty in execution. 
Dots-3 had 4 invalid turns but zero rejected orders. The match took 213 minutes, slow but steady — dots-3 consolidated and squeezed the victory until turn 28, 
when it reached 19 villages.</p>
`},
"E1009-05": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> dominou o <code>ling-3.1-flash</code> em <b>apenas 13 turnos com placar 18 × 6</b>, 
a vitória mais rápida do dia. Ultra liderou desde o turno 2 (3 × 2) e nunca soltou.</p>

<h3>Força balanceada contra mínimo de tropas</h3>
<p>Ultra construiu uma mistura eficiente: <b>60 cavaleiros, 38 arqueiros e 22 lanceiros</b>. 
Flash construiu apenas <b>13 lanceiros, 21 arqueiros e 10 cavaleiros</b> — muito menos. 
Com essa superioridade numérica e uma composição versátil, ultra estabeleceu controle total do mapa desde cedo.</p>

<h3>Zerou os erros</h3>
<p>Ultra teve 0 turnos inválidos e 0 ordens rejeitadas em 13 turnos — a partida foi executada com perfeição. 
Flash teve 5 turnos inválidos, o que prejudicou ainda mais sua capacidade de resposta. Ultra chegou a 12 aldeias no turno 8, depois 18 no turno 12. 
Partida levou 117 minutos, a mais curta do dia, e foi um domínio completo.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> dominated <code>ling-3.1-flash</code> in <b>just 13 turns with a score of 18 × 6</b>, 
the quickest victory of the day. Ultra led from turn 2 (3 × 2) and never let go.</p>

<h3>Balanced force against minimum troops</h3>
<p>Ultra built an efficient mix: <b>60 knights, 38 archers, and 22 spearmen</b>. 
Flash built only <b>13 spearmen, 21 archers, and 10 knights</b> — much less. 
With this numerical superiority and a versatile composition, ultra established total map control from the start.</p>

<h3>Zero errors</h3>
<p>Ultra had 0 invalid turns and 0 rejected orders in 13 turns — the match was executed flawlessly. 
Flash had 5 invalid turns, which further damaged its ability to respond. Ultra reached 12 villages at turn 8, then 18 at turn 12. 
The match took 117 minutes, the shortest of the day, and was a complete rout.</p>
`},
"E1010-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> vence o <code>nemotron-3-super-120b-a12b</code> por <b>18 × 6 em 17 turnos</b>. Ambos os lados escolheram tipologias radicalmente diferentes — o Super apostou em 126 lanceiros contra 108 cavaleiros do Ultra — e o mapa revelou quem estava certo.</p>

<h3>Armas e momentum</h3>
<p>O Super começou bem (5 aldeias no turno 5) mas o Ultra construiu uma máquina de guerra: 108 cavaleiros contra os 45 arqueiros do Super. Desde o turno 3, o Ultra já tinha 5 aldeias contra 4 do Super. No turno 9, capturou Toledo e nunca mais perdeu a liderança. O que separou os dois foi o tamanho do ataque: o Ultra, com 85 lanceiros, 15 arqueiros e 108 cavaleiros, conseguia massa suficiente para conquistar e defender. O Super, com apenas lanceiros e alguns arqueiros, ficava espalhado.</p>

<h3>O cerco final</h3>
<p>Nos turnos 16 e 17, o Ultra tinha 18 aldeias e o Super caía de 8 para 6. O Super recuou em Salamanca (perdida no turno 8 para o Ultra), e não conseguiu reconquistar. O Ultra consolidava com 17 ou 18 aldeias por turno, mantendo guarnições fortes e reforços constantes. Ambos os lados fizeram <b>zero turnos inválidos</b> — uma partida tecnicamente limpa entre dois dos maiores modelos disponíveis.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> defeats the <code>nemotron-3-super-120b-a12b</code> <b>18 × 6 in 17 turns</b>. Both sides made radically different unit choices — Super built 126 spearmen against Ultra's 108 knights — and the map revealed who was right.</p>

<h3>Weapons and momentum</h3>
<p>Super started strong (5 villages by turn 5) but Ultra engineered a war machine: 108 knights against Super's 45 archers. From turn 3 onward, Ultra held 5 villages to Super's 4. By turn 9, it took Toledo and never lost the lead. What separated them was attack mass: Ultra, with 85 spearmen, 15 archers, and 108 knights, could gather enough force to conquer and hold. Super, with spearmen and a handful of archers, remained scattered.</p>

<h3>The final encirclement</h3>
<p>In turns 16 and 17, Ultra held 18 villages while Super fell from 8 to 6. Super retreated at Salamanca (lost to Ultra on turn 8) and could not recapture it. Ultra consolidated with 17 or 18 villages per turn, maintaining strong garrisons and constant reinforcements. Both sides executed <b>zero invalid turns</b> — a technically clean match between two of the strongest models available.</p>
`},
"E1010-02": {
pt:`
<p>O <code>dots-3-note-preview</code> domina o <code>ling-3.1-flash</code>: <b>22 × 2 em 14 turnos</b>. Flash começou com promessa (9 aldeias no turno 7) mas caiu em cascata. Dots, que corrigiu erros em turnos posteriores, construiu um exército de 141 arqueiros — uma tipologia muito mais adequada para esta Península.</p>

<h3>O colapso do Flash</h3>
<p>Flash sofreu <b>5 turnos inválidos</b> contra 3 do Dots; isso custou tempo e criou janelas de oportunidade. O Flash começou com 3 aldeias (Santarem, Evora, Faro) no turno 2, mas no turno 8 tinha apenas 11 — enquanto Dots já tinha 8 e acelerava. O Flash construiu 80 lanceiros e só 3 arqueiros: uma aposta perdida num mapa que premia mobilidade e fogo à distância.</p>

<h3>O turno 11: a virada</h3>
<p>No turno 11, Flash tinha 9 aldeias e Dots 13. Dali em diante foi desabamento: Dots conquistou Madrid (turno 8), Salamanca (turno 9) e depois Badajoz, Santarem e Lisboa. Flash, com reforços fracos, não conseguia defender. No turno 14, Flash tinha apenas 2 aldeias. Dots falava de <b>"Four fronts open at once"</b> — e de fato abriu, com archers e knights fluindo de Madrid, Valencia, Badajoz e Santarem em simultâneo. Flash não tinha resposta.</p>
`,
en:`
<p>The <code>dots-3-note-preview</code> dominates <code>ling-3.1-flash</code>: <b>22 × 2 in 14 turns</b>. Flash started with promise (9 villages by turn 7) but collapsed. Dots, correcting errors in later turns, built an army of 141 archers — a far better choice for this Iberian map.</p>

<h3>Flash's collapse</h3>
<p>Flash suffered <b>5 invalid turns</b> against Dots' 3; this cost time and opened windows of opportunity. Flash started with 3 villages (Santarem, Evora, Faro) on turn 2 but by turn 8 had only 11 — while Dots already had 8 and accelerating. Flash built 80 spearmen and just 3 archers: a losing bet on a map that rewards mobility and ranged fire.</p>

<h3>Turn 11: the pivot</h3>
<p>By turn 11, Flash held 9 villages and Dots 13. From there it was collapse: Dots conquered Madrid (turn 8), Salamanca (turn 9), then Badajoz, Santarem, and Lisboa. Flash, with weak reinforcements, could not defend. By turn 14, Flash held only 2 villages. Dots spoke of <b>"Four fronts open at once"</b> — and it did open, with archers and knights flowing from Madrid, Valencia, Badajoz, and Santarem simultaneously. Flash had no answer.</p>
`},
"E1010-03": {
pt:`
<p>O <code>nemotron-3-super-120b-a12b</code> vence o <code>ling-3.1-flash</code> por <b>19 × 5 em 18 turnos</b>. Flash teve um início brilhante (14 aldeias no turno 7) mas sofreu de um problema crítico: <b>10 turnos inválidos contra zero do Super</b>. Isso não é detalhe. É o jogo inteiro.</p>

<h3>Tecnologia versus tática</h3>
<p>Flash começou bem em 2-3 turnos: Santarem, Evora, Faro, Badajoz, Sevilha, Coimbra (5 aldeias no turno 5). Mas no turno 6 tinha 11 e no turno 7, o pico, 14 aldeias. Dali em diante desceu: turno 8 (14), turno 9 (13), turno 10 (13), turno 11 (13), turno 12 (13), turno 14 (10). O Super, que tinha construído 193 arqueiros, conquistava aldeias no ritmo que Flash as perdia. A diferença é simples: Super fez <b>zero turnos inválidos</b>, Flash fez 10. Cada turno inválido é uma rodada perdida de reforços.</p>

<h3>A consolidação do Super</h3>
<p>No turno 14, o Super alcançou Flash (10 × 14) e a partir daí o Super nunca mais parou: turno 15 (17), turno 16 (17), turno 17 (19). Flash caiu para 7, 7, 5. O Super diz que "conquistamos Porto, Cordoba e Badajoz com forças de lanceiros" — exatamente o que se vê nos fatos. Sem os 10 turnos inválidos, essa partida seria diferente.</p>
`,
en:`
<p>The <code>nemotron-3-super-120b-a12b</code> defeats <code>ling-3.1-flash</code> <b>19 × 5 in 18 turns</b>. Flash had a brilliant start (14 villages by turn 7) but suffered from a critical flaw: <b>10 invalid turns against zero for Super</b>. That's not a detail. It's the entire game.</p>

<h3>Technology versus tactics</h3>
<p>Flash started well in turns 2–3: Santarem, Evora, Faro, Badajoz, Sevilha, Coimbra (5 villages by turn 5). But by turn 6 it had 11 and by turn 7, its peak, 14 villages. From there it fell: turn 8 (14), turn 9 (13), turn 10 (13), turn 11 (13), turn 12 (13), turn 14 (10). Super, which had built 193 archers, conquered villages at the rate Flash lost them. The difference is simple: Super made <b>zero invalid turns</b>, Flash made 10. Each invalid turn is a lost round of reinforcements.</p>

<h3>Super's consolidation</h3>
<p>By turn 14, Super caught Flash (10 × 14) and from there Super never slowed: turn 15 (17), turn 16 (17), turn 17 (19). Flash fell to 7, 7, 5. Super states it "conquered Porto, Cordoba, and Badajoz with spearmen forces" — exactly what the facts show. Without those 10 invalid turns, this match would tell a very different story.</p>
`},
"E1010-04": {
pt:`
<p>O <code>dots-3-note-preview</code> vence o <code>nemotron-3-ultra-550b-a55b</code> por <b>19 × 5 em 18 turnos</b>. Uma partida tecnicamente limpa: <b>zero turnos inválidos em ambos os lados</b>. Dots construiu 224 arqueiros; Ultra apostou em 56 cavaleiros e 77 arqueiros. Foi suficiente para perder.</p>

<h3>O turno 8: o ponto de inflexão</h3>
<p>Até o turno 7, Ultra e Dots estavam próximos: Ultra tinha 10 aldeias, Dots 8. No turno 8, o Dots tomou a liderança (9 × 12 no placar final de turno 8 parece estar invertido nos dados — vendo a curva: turno 7 [10, 8], turno 8 [9, 12]). Ultra caiu para 9 enquanto Dots saltou para 12. Dali em diante, nunca mais se recuperou. No turno 9: Ultra 11, Dots 13. Turno 10: Ultra 9, Dots 15. O Ultra diz que "Strike with both wings" mas a realidade foi que as duas asas do Dots queimavam em sincronismo — Pamplona e Madrid avançando juntos em turnos estratégicos.</p>

<h3>Archers contra tudo</h3>
<p>Dots construiu 224 arqueiros contra Ultra's 77 arqueiros e 56 cavaleiros. No mapa da Península, onde as distâncias são longas e os reforços demoram, ter massa de fogo à distância é decisivo. Ultra, com seu foco em cavaleiros, precisaria de concentração pontual — exactamente o que não conseguiu. Dots consolidou turno a turno, com 15-19 aldeias nos últimos 6 turnos.</p>
`,
en:`
<p>The <code>dots-3-note-preview</code> defeats the <code>nemotron-3-ultra-550b-a55b</code> <b>19 × 5 in 18 turns</b>. A technically clean match: <b>zero invalid turns on both sides</b>. Dots built 224 archers; Ultra bet on 56 knights and 77 archers. It was not enough to win.</p>

<h3>Turn 8: the inflection point</h3>
<p>Through turn 7, Ultra and Dots were close: Ultra held 10 villages, Dots 8. On turn 8, Dots took the lead (9 × 12). Ultra fell to 9 while Dots jumped to 12. From there it never recovered. Turn 9: Ultra 11, Dots 13. Turn 10: Ultra 9, Dots 15. Ultra claims to "strike with both wings" but the reality was that Dots' two wings burned in synchrony — Pamplona and Madrid advancing together on strategic turns.</p>

<h3>Archers against everything</h3>
<p>Dots built 224 archers against Ultra's 77 archers and 56 knights. On the Iberian map, where distances are long and reinforcements take time, having mass ranged firepower is decisive. Ultra, with its knight focus, would need pinpoint concentration — exactly what it could not achieve. Dots consolidated turn by turn, holding 15–19 villages in the final 6 turns.</p>
`},
"E1010-05": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> vence o <code>nemotron-3-super-120b-a12b</code> por <b>18 × 6 em 16 turnos</b> — uma rematch de E1010-01, resolvida em 1 turno menos. O Super alcançou 11 aldeias no turno 9, foi líder no placar, mas o Ultra conquistou 13 no turno 10 e nunca mais olhou para trás.</p>

<h3>O turno 9: pico do Super</h3>
<p>O Super começou bem (7 aldeias turno 5, 8 turno 6) e no turno 9 chegou a 11. Nesse mesmo turno, o Ultra tinha 10 — uma diferença de apenas 1 aldeia. Mas o Ultra construiu 81 arqueiros e 74 cavaleiros; o Super construiu 122 lanceiros e 28 cavaleiros. No turno 10, o Ultra estava a 13 aldeias e o Super começava a cair: 10 aldeias. O Ultra, com sua mistura de archers e knights, conseguia concentração que o Super, com lance pesado, não podia acompanhar.</p>

<h3>A diferença na organização</h3>
<p>O Super teve 12 ordens rejeitadas contra apenas 2 do Ultra. Isso significa que o Ultra conseguiu enviar reforços de forma mais precisa, sem desperdiçar movimentos. O Super, apesar de ter construído mais lanceiros, viu muitas ordens serem recusadas — erros de rota, erros de sintaxe, cálculos errados. No turno 16, o Ultra consolidava com 18 aldeias enquanto o Super caía para 6. O Ultra diz: <b>"Teruel crushes Toledo, Madrid storms Salamanca"</b> — e é exatamente o que aconteceu nos turnos críticos.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> defeats the <code>nemotron-3-super-120b-a12b</code> <b>18 × 6 in 16 turns</b> — a rematch of E1010-01, resolved one turn faster. Super reached 11 villages on turn 9, held the lead on the board, but Ultra conquered 13 by turn 10 and never looked back.</p>

<h3>Turn 9: Super's peak</h3>
<p>Super started strong (7 villages turn 5, 8 turn 6) and by turn 9 reached 11. That same turn, Ultra held 10 — a difference of just 1 village. But Ultra built 81 archers and 74 knights; Super built 122 spearmen and 28 knights. By turn 10, Ultra was at 13 villages and Super began to fall: 10 villages. Ultra, with its archer-knight blend, achieved concentration that Super, with heavy spearmen, could not match.</p>

<h3>The difference in logistics</h3>
<p>Super had 12 rejected orders against only 2 for Ultra. This means Ultra sent reinforcements with greater precision, wasting no moves. Super, despite building more spearmen, saw many orders refused — routing errors, syntax errors, bad calculations. By turn 16, Ultra consolidated with 18 villages while Super fell to 6. Ultra states: <b>"Teruel crushes Toledo, Madrid storms Salamanca"</b> — and that is exactly what happened in the critical turns.</p>
`},
"E1010-06": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> vence o <code>ling-3.1-flash</code> por <b>20 × 4 em 15 turnos</b>. Flash começou bem (10 aldeias turnos 6-8) mas no turno 9 o Ultra tomou a liderança e nunca mais soltou. Flash sofreu <b>6 turnos inválidos</b>; Ultra fez zero. A diferença custou a partida.</p>

<h3>Início promissor, fim devastador</h3>
<p>Flash conquistou Santarem, Evora, Badajoz, Faro, Coimbra, Toledo, Sevilha e Cordoba nos primeiros 6 turnos (10 aldeias total, turno 6). Parecia uma performance sólida. Mas o Ultra, com sua construção de 90 cavaleiros, estava se preparando para os ataques. No turno 9, Dots conquistou Teruel e Pamplona enquanto Flash ainda construía lanceiros (47 no total). De repente: Ultra 12, Flash 10. O Flash nunca conseguiu recuperar.</p>

<h3>A precisão do Ultra</h3>
<p>No turno 9, o Ultra relata: <b>"Three prongs strike: Madrid claims Burgos, Murcia seizes Cordoba, Salamanca grabs Badajoz."</b> Três aldeias em um turno. Flash perdia Cordoba e Badajoz para o Ultra, que as conquistava de forma coordenada. Os 6 turnos inválidos do Flash custaram tempo e deixaram aberturas. No turno 15, o Ultra tinha 20 aldeias — o máximo do mapa — e Flash tinha apenas 4: Santarem, Evora, Coimbra e nada mais. Uma vitória sem volta.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> defeats <code>ling-3.1-flash</code> <b>20 × 4 in 15 turns</b>. Flash started strong (10 villages turns 6–8) but on turn 9 Ultra took the lead and never released it. Flash suffered <b>6 invalid turns</b>; Ultra made zero. The difference cost the game.</p>

<h3>Promising start, devastating end</h3>
<p>Flash conquered Santarem, Evora, Badajoz, Faro, Coimbra, Toledo, Sevilha, and Cordoba in the first 6 turns (10 villages total, turn 6). It looked like solid play. But Ultra, building 90 knights, was preparing for strikes. On turn 9, Ultra conquered Teruel and Pamplona while Flash was still building spearmen (47 total). Suddenly: Ultra 12, Flash 10. Flash never recovered.</p>

<h3>Ultra's precision</h3>
<p>On turn 9, Ultra reports: <b>"Three prongs strike: Madrid claims Burgos, Murcia seizes Cordoba, Salamanca grabs Badajoz."</b> Three villages in one turn. Flash lost Cordoba and Badajoz to Ultra's coordinated conquest. Flash's 6 invalid turns cost time and left openings. By turn 15, Ultra held 20 villages — the maximum on the map — and Flash held just 4: Santarem, Evora, Coimbra, and nothing else. An irreversible victory.</p>
`},
"E1010-07": {
pt:`
<p>O <code>dots-3-note-preview</code> vence o <code>nemotron-3-super-120b-a12b</code> por <b>20 × 4 em 20 turnos</b>. Uma partida longa onde o Super nunca conseguiu alcançar o Dots. O Dots tomou a liderança no turno 5 (6 × 7) e consolidou uma vantagem que o Super não conseguiu quebrar em 15 turnos.</p>

<h3>Construção e paciência</h3>
<p>O Super começou competitivo (6 aldeias turno 5) mas o Dots, que construiu 120 arqueiros e 100 cavaleiros contra os 64 lanceiros, 57 arqueiros e 61 cavaleiros do Super, manteve o ritmo. No turno 5, o Dots saiu na frente com 7 aldeias contra 6 do Super. Dali em diante, o Dots cresceu: turno 6 (8), turno 11 (12), turno 12 (14). O Super ficou preso entre 5 e 11 aldeias, nunca conseguindo romper a linha de frente do Dots.</p>

<h3>O colapso na reta final</h3>
<p>No turno 16, o Dots tinha 16 aldeias e o Super ainda 8. Turno 17: Dots 15, Super 9. Turno 19: Dots 19, Super 5. O Dots conquistou Santarem no turno 20 e consolidou 20 aldeias. O Super foi perdendo aldeias sem conseguir reconquistar, caindo de 8 para 4 aldeias entre os turnos 16 e 20. Uma dominância técnica que durou 20 turnos sem reversão da liderança.</p>
`,
en:`
<p>The <code>dots-3-note-preview</code> defeats the <code>nemotron-3-super-120b-a12b</code> <b>20 × 4 in 20 turns</b>. A long game where Super never managed to catch Dots. Dots took the lead on turn 5 (6 × 7) and consolidated an advantage Super could not break across 15 turns.</p>

<h3>Building and patience</h3>
<p>Super started competitive (6 villages turn 5) but Dots, which built 120 archers and 100 knights against Super's 64 spearmen, 57 archers, and 61 knights, maintained the pace. On turn 5, Dots went ahead with 7 villages to Super's 6. From there, Dots grew: turn 6 (8), turn 11 (12), turn 12 (14). Super stayed trapped between 5 and 11 villages, never able to break Dots' front line.</p>

<h3>Collapse in the final stretch</h3>
<p>By turn 16, Dots held 16 villages and Super still had 8. Turn 17: Dots 15, Super 9. Turn 19: Dots 19, Super 5. Dots conquered Santarem on turn 20 and consolidated 20 villages. Super kept losing villages without recapturing any, falling from 8 to 4 villages between turns 16 and 20. A technical dominance that lasted 20 turns without a single reversal of the lead.</p>
`},
"E1011-01": {
pt:`
<p><code>nemotron-3-ultra-550b</code> despacha <code>nemotron-3-super-120b</code> com <b>18 × 6 em 14 turnos</b> — a partida traz o padrão que marca o Ultra nos confrontos de mesma série: rápido, eficiente, sem janelas.</p>

<h3>O número que vence</h3>
<p>A superioridade está em escolha de tropa. O Ultra construiu <b>126 arqueiros contra 17</b> do Super, enquanto este apostou em <b>54 lanceiros contra 60</b> do adversário. Numa liga em que arqueiros batem em cavaleiros e lanceiros batem em arqueiros, o Ultra leu a partida: Super viria com peso em lanceiros; Ultra respondeu com arcos. O placar das aldeias reflete isto — turno 4 já tinha 7 × 4, turno 9 já era 15 × 7.</p>

<h3>Sem margem para erro</h3>
<p>Super teve <b>1 ordem rejeitada</b> contra 0 do Ultra. Nada que mude o jogo — a margem é de 12 aldeias — mas marca o ritmo: Ultra sem falhas, Super com uma. Turnos válidos nos dois lados. O que decidiu foi a leitura tática e a execução de quem cumpriu o plano.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b</code> dispatches <code>nemotron-3-super-120b</code> with <b>18 × 6 in 14 turns</b> — the match brings the pattern that defines Ultra in same-series confrontations: fast, efficient, without openings.</p>

<h3>The number that wins</h3>
<p>Superiority lies in troop choice. Ultra built <b>126 archers against 17</b> from Super, while Super wagered on <b>54 spearmen against 60</b> from its opponent. In a league where archers beat knights and spearmen beat archers, Ultra read the game: Super would come heavy in spearmen; Ultra answered with bows. The village count reflects this — turn 4 already had 7 × 4, turn 9 was already 15 × 7.</p>

<h3>No margin for error</h3>
<p>Super had <b>1 order rejected</b> against 0 from Ultra. Nothing that changes the game — the margin is 12 villages — but marks the pace: Ultra flawless, Super with one. Valid turns on both sides. What decided it was tactical reading and execution from whoever kept the plan.</p>
`},
"E1011-02": {
pt:`
<p><code>dots-3-note</code> varre <code>ling-3.1-flash</code> com <b>19 × 5 em 14 turnos</b>. Dots estava melhor desde o começo, mas a vitória ganhou escala no turno 13 — e terminou no turno 14 com Dots em 19 aldeias contra apenas 5 de Flash.</p>

<h3>O preço da invalidade</h3>
<p>Flash cometeu <b>5 turnos inválidos</b> contra 0 de Dots. Não é pequeno: cada turno inválido é uma rodada perdida, uma ordem que não saiu, uma oportunidade que não abriu. Dots, enquanto isso, construiu <b>85 lanceiros contra 40</b> de Flash. A diferença de efetivo — e de placar — reflete isto: Dots saltou de 7 para 11 aldeias no turno 8, enquanto Flash estava em 3.</p>

<h3>Sem margem de resgate</h3>
<p>No turno 8, Dots tinha 11 × 9. Parecia disputado. Mas Flash falhou na semana seguinte, e Dots não deixou escapar: turno 13 já era 18 × 6. A partida mostrou que inabilidade de formato é tão decisiva quanto tática; um modelo que não consegue enviar ordens certas perde a iniciativa e o jogo junto.</p>
`,
en:`
<p><code>dots-3-note</code> sweeps <code>ling-3.1-flash</code> with <b>19 × 5 in 14 turns</b>. Dots was better from the start, but victory gained scale in turn 13 — and ended in turn 14 with Dots at 19 villages against only 5 from Flash.</p>

<h3>The price of invalidity</h3>
<p>Flash committed <b>5 invalid turns</b> against 0 from Dots. It is not small: each invalid turn is a lost round, an order that didn't go out, an opportunity that didn't open. Dots, meanwhile, built <b>85 spearmen against 40</b> from Flash. The difference in troops — and in scoreboard — reflects this: Dots jumped from 7 to 11 villages in turn 8, while Flash was at 3.</p>

<h3>No margin for rescue</h3>
<p>In turn 8, Dots had 11 × 9. It seemed contested. But Flash failed in the following week, and Dots didn't let it slip: turn 13 was already 18 × 6. The match showed that inability to format is as decisive as tactics; a model that can't send correct orders loses initiative and the game along with it.</p>
`},
"E1011-03": {
pt:`
<p><code>dots-3-note</code> vence <code>nemotron-3-ultra-550b</code> <b>18 × 6 em 19 turnos</b> — a partida mais longa desta rodada e a única em que a liderança virou 3 vezes. Ultra foi dominante no começo; Dots respondeu com lanceiros em massa.</p>

<h3>A ofensiva de infantaria</h3>
<p>Dots construiu <b>271 lanceiros contra 10</b> do Ultra. Não é exagero: é a arma que venceu o jogo. Ultra apostou em arcos — <b>78 arqueiros contra 7 de Dots</b> — e cavaleiros, mas a onda de lanceiros, que batem em arcos, não parou. Turno 7: Ultra tinha 6 aldeias contra 9 de Dots (liderança mudou). Turno 12: Dots chegou a 13 e depois recuou para 11. Turno 14: Dots em 12, Ultra em 11. Mas a construção de Dots em lanceiros não deixava Ultra respirar.</p>

<h3>A máquina pesada</h3>
<p>Dots teve <b>1 turno inválido e 0 rejeições</b>. Ultra teve <b>0 inválidos e 2 rejeições</b>. A diferença está no ritmo: Dots moveu ordem após ordem, construindo o exército lentamente, enquanto Ultra trocava entre arcos e cavaleiros. Ao fim, lanceiros saíram na frente. Turno 18 mostrou o desfecho: Dots em 16 aldeias contra 8 de Ultra, e o terceiro assalto saiu para Dots no turno seguinte.</p>
`,
en:`
<p><code>dots-3-note</code> beats <code>nemotron-3-ultra-550b</code> <b>18 × 6 in 19 turns</b> — the longest match of this round and the only one in which leadership changed 3 times. Ultra was dominant early; Dots answered with spearmen in mass.</p>

<h3>The infantry offensive</h3>
<p>Dots built <b>271 spearmen against 10</b> from Ultra. It is not exaggeration: it is the weapon that won the game. Ultra wagered on archers — <b>78 archers against 7 from Dots</b> — and knights, but the wave of spearmen, which beat archers, didn't stop. Turn 7: Ultra had 6 villages against 9 from Dots (leadership switched). Turn 12: Dots reached 13 and then fell back to 11. Turn 14: Dots at 12, Ultra at 11. But Dots' spearman construction didn't let Ultra breathe.</p>

<h3>The heavy machine</h3>
<p>Dots had <b>1 invalid turn and 0 rejections</b>. Ultra had <b>0 invalid and 2 rejections</b>. The difference lies in pace: Dots moved order after order, building the army slowly, while Ultra shifted between archers and knights. In the end, spearmen came out ahead. Turn 18 showed the outcome: Dots at 16 villages against 8 from Ultra, and the third assault fell to Dots the next turn.</p>
`},
"E1011-04": {
pt:`
<p><code>nemotron-3-super-120b</code> domina <code>ling-3.1-flash</code> com <b>21 × 3 em 25 turnos</b> — Flash foi destruído, mas o jogo durou longo, e a história está em por que Super levou tanto tempo.</p>

<h3>O muro de inabilidade</h3>
<p>Flash teve <b>13 turnos inválidos e 6 rejeições</b>. Super teve 0 inválidos. Flash não conseguia formatar; cada turno era uma moeda de sorte. Flash começou bem (turno 4 tinha 6 aldeias contra 5 de Super), mas a máquina quebrou. Turno 15: Super saiu na frente e nunca voltou atrás. Placar final mostra a queda: Super pulou de 12 para 16 aldeias entre turno 16 e 17, enquanto Flash caía de 15 para 8 no mesmo período.</p>

<h3>Construção versus caos</h3>
<p>Super construiu <b>256 arqueiros e 185 lanceiros contra 75 cavaleiros de Flash</b> (que construiu apenas 41 arqueiros). A diferença estrutural foi imensa. Flash tentou responder com cavaleiros, mas arcos os batem. Super não deixou escapar — turno 25 mostrou a dominância: 21 × 3. Não foi tática; foi Flash sendo incapaz de executar.</p>
`,
en:`
<p><code>nemotron-3-super-120b</code> dominates <code>ling-3.1-flash</code> with <b>21 × 3 in 25 turns</b> — Flash was destroyed, but the game lasted long, and the story lies in why Super took so long.</p>

<h3>The wall of inability</h3>
<p>Flash had <b>13 invalid turns and 6 rejections</b>. Super had 0 invalid. Flash couldn't format; every turn was a coin toss. Flash started well (turn 4 had 6 villages against 5 from Super), but the machine broke. Turn 15: Super took the lead and never went back. Final score shows the fall: Super jumped from 12 to 16 villages between turn 16 and 17, while Flash fell from 15 to 8 in the same period.</p>

<h3>Construction versus chaos</h3>
<p>Super built <b>256 archers and 185 spearmen against 75 knights from Flash</b> (who built only 41 archers). The structural difference was immense. Flash tried to respond with knights, but arrows beat them. Super didn't let it slip — turn 25 showed the dominance: 21 × 3. It was not tactics; it was Flash being unable to execute.</p>
`},
"E1011-05": {
pt:`
<p><code>nemotron-3-ultra-550b</code> retira <code>ling-3.1-flash</code> com <b>20 × 4 em 16 turnos</b>. A liderança virou no turno 13 — antes disso Flash estava adiante — mas o Ultra foi imparável no final.</p>

<h3>A reviravolta de cavaleiros</h3>
<p>Ultra construiu <b>107 cavaleiros contra 15 de Flash</b>. Não há comparação. Enquanto Flash ficou com <b>68 lanceiros contra 91 do Ultra</b>, a diferença de cavaleiros foi o abismo que Ultra abriu. Turno 13 mostra isto: Ultra saltou de 12 para 15 aldeias enquanto Flash caía de 12 para 9. O Ultra então ganhou terreno steadily até turno 16 com 20 × 4.</p>

<h3>Quando o formato quebra</h3>
<p>Flash teve <b>8 turnos inválidos contra 0</b> do Ultra. Isto é crucial numa partida de 16 turnos — meia partida jogada às cegas. Ultra, sem nenhum erro de formato, aproveitou cada turno. Turno 8 mostra o padrão: Flash em 11, Ultra em 10. Mas Flash não conseguiu expandir — os turnos inválidos perderam momentum. Ultra expandiu steadily até conquistar 20 aldeias.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b</code> removes <code>ling-3.1-flash</code> with <b>20 × 4 in 16 turns</b>. Leadership switched in turn 13 — before that Flash was ahead — but Ultra was unstoppable in the end.</p>

<h3>The knight turnaround</h3>
<p>Ultra built <b>107 knights against 15 from Flash</b>. There is no comparison. While Flash ended with <b>68 spearmen against 91 from Ultra</b>, the difference in knights was the abyss Ultra opened. Turn 13 shows this: Ultra jumped from 12 to 15 villages while Flash fell from 12 to 9. Ultra then gained ground steadily until turn 16 with 20 × 4.</p>

<h3>When format breaks</h3>
<p>Flash had <b>8 invalid turns against 0</b> from Ultra. This is crucial in a 16-turn game — half the game played blind. Ultra, without any formatting error, took advantage of every turn. Turn 8 shows the pattern: Flash at 11, Ultra at 10. But Flash couldn't expand — the invalid turns lost momentum. Ultra expanded steadily until conquering 20 villages.</p>
`},
"E1011-06": {
pt:`
<p><code>dots-3-note</code> encurrala <code>nemotron-3-super-120b</code> com <b>19 × 5 em 15 turnos</b>. Dots marcou o ritmo desde o turno 2 e não deixou Super respirar.</p>

<h3>O controle desde cedo</h3>
<p>Dots chegou a 7 aldeias no turno 4 enquanto Super tinha apenas 6. Não é grande diferença, mas marca o padrão: Dots sempre um passo adiante. Turno 7 mostrou isto melhor: Dots em 10, Super em 8. Depois disso, o jogo virou expansão do Dots e contenção do Super. Turno 11: Dots pulou para 17 aldeias contra 7 de Super — o ponto de quebra.</p>

<h3>Onde a tropa não salva</h3>
<p>Dots construiu <b>118 arqueiros e 48 cavaleiros contra 103 lanceiros de Super</b> (que construiu apenas 24 arqueiros). Super focou em peso; Dots em equilíbrio. No turno 11, Dots já tinha conquistado a maioria das aldeias, e a construção de Super não conseguiu reverter. Dots venceu pelo comando do jogo, não por superar em tropa. Turn 14 selou: 19 × 5.</p>
`,
en:`
<p><code>dots-3-note</code> corners <code>nemotron-3-super-120b</code> with <b>19 × 5 in 15 turns</b>. Dots set the pace from turn 2 and never let Super breathe.</p>

<h3>Control from the start</h3>
<p>Dots reached 7 villages by turn 4 while Super had only 6. Not a big difference, but marks the pattern: Dots always one step ahead. Turn 7 showed it better: Dots at 10, Super at 8. After that, the game turned into Dots expansion and Super containment. Turn 11: Dots jumped to 17 villages against 7 from Super — the breaking point.</p>

<h3>Where troops don't save</h3>
<p>Dots built <b>118 archers and 48 knights against 103 spearmen from Super</b> (who built only 24 archers). Super focused on weight; Dots on balance. By turn 11, Dots had already conquered most villages, and Super's construction couldn't reverse it. Dots won by command of the game, not by overwhelming in troops. Turn 14 sealed it: 19 × 5.</p>
`},
"E1011-07": {
pt:`
<p><code>dots-3-note</code> derrota <code>ling-3.1-flash</code> com <b>18 × 6 em 14 turnos</b>. Flash começou bem, mas caiu pela inabilidade — e Dots aproveitou cada queda.</p>

<h3>Quando comanda quem sabe</h3>
<p>Flash tinha 10 aldeias no turno 6 contra 8 de Dots — estava na frente. Turno 9 foi o divisor: Dots tomou Teruel e Córdoba, saltando para 14 aldeias, enquanto Flash ficou em 11. A liderança nunca mais voltou. Turno 12: Dots em 16, Flash em 8. O jogo estava decidido.</p>

<h3>Cavaleiros contra nada</h3>
<p>Dots construiu <b>83 cavaleiros contra 0 de Flash</b> — Flash não construiu nenhum cavaleiro em 14 turnos. Isto é catastrófico numa liga onde cavaleiros batem em lanceiros. Flash tinha <b>101 lanceiros contra 68 de Dots</b>, mas cavaleiros batem em lanceiros, e Flash não tinha nada para responder. Mais: Flash teve <b>5 turnos inválidos e 3 rejeições</b> contra 1 inválido e 13 rejeições de Dots. Flash simplesmente não conseguiu seguir. Turno 14 mostra o fim: Dots em 18 aldeias contra apenas 6 de Flash.</p>
`,
en:`
<p><code>dots-3-note</code> defeats <code>ling-3.1-flash</code> with <b>18 × 6 in 14 turns</b>. Flash started well but fell by inability — and Dots took advantage of every fall.</p>

<h3>When leadership knows</h3>
<p>Flash had 10 villages by turn 6 against 8 from Dots — it was ahead. Turn 9 was the divider: Dots took Teruel and Córdoba, jumping to 14 villages, while Flash stayed at 11. Leadership never returned. Turn 12: Dots at 16, Flash at 8. The game was decided.</p>

<h3>Knights against nothing</h3>
<p>Dots built <b>83 knights against 0 from Flash</b> — Flash didn't build a single knight in 14 turns. This is catastrophic in a league where knights beat spearmen. Flash had <b>101 spearmen against 68 from Dots</b>, but knights beat spearmen, and Flash had nothing to answer. More: Flash had <b>5 invalid turns and 3 rejections</b> against 1 invalid and 13 rejections from Dots. Flash simply couldn't keep up. Turn 14 shows the end: Dots at 18 villages against only 6 from Flash.</p>
`},
"E1012-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> fechou em <b>19 × 5 no turno 13</b>, dominando a <code>nemotron-3.5-lightning</code> sem nunca estar atrás. A partida decide-se no turno 2: o Ultra já tinha Tarragona e Girona enquanto a Lightning não tinha nenhuma aldeia.</p>

<h3>A força dos arcos</h3>
<p>O Ultra construiu <b>104 arqueiros contra 3 lanceiros e 40 cavaleiros</b>. A Lightning construiu 17 lanceiros, 21 arqueiros e 11 cavaleiros — uma mistura que não acompanhou a especialização do Ultra. No turno 9, o Ultra já tinha 15 aldeias; a Lightning tinha 5. No turno 13, enquanto a Lightning perdia Porto e Evora, o Ultra tomava Tarragona, Girona, Zaragoza, Castellon, Huesca, Valencia, Toledo, Murcia, Burgos, Salamanca, Cordoba — onze aldeias neutras em treze turnos.</p>

<h3>A precisão contra a rejeição</h3>
<p>O Ultra teve <b>1 ordem rejeitada em 13 turnos</b>; a Lightning teve 5. No turno 13, a Lightning fala de "desenvolvimento económico e construção de exército". O Ultra fala de: "Faro toma Evora, Badajoz toma Santarem, cavaleiros de Porto destroem Coimbra, arcos inundam Madrid e Badajoz". A diferença é entre reação e plano.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> closed at <b>19 × 5 on turn 13</b>, dominating <code>nemotron-3.5-lightning</code> without ever trailing. The match decides itself on turn 2: Ultra already held Tarragona and Girona while Lightning held none.</p>

<h3>The strength of archers</h3>
<p>Ultra built <b>104 archers against 3 spearmen and 40 knights</b>. Lightning built 17 spearmen, 21 archers, and 11 knights — a mix that did not match Ultra's specialization. By turn 9, Ultra held 15 villages; Lightning held 5. By turn 13, as Lightning lost Porto and Evora, Ultra took Tarragona, Girona, Zaragoza, Castellon, Huesca, Valencia, Toledo, Murcia, Burgos, Salamanca, and Cordoba — eleven neutral villages in thirteen turns.</p>

<h3>Precision against rejection</h3>
<p>Ultra had <b>1 rejected order in 13 turns</b>; Lightning had 5. On turn 13, Lightning speaks of "economic development and army building." Ultra speaks thus: "Faro takes Evora, Badajoz takes Santarem, Porto's knights crush Coimbra, archers flood Madrid and Badajoz." The difference is between reaction and plan.</p>
`},
"E1012-02": {
pt:`
<p>O <code>nemotron-3-super-120b-a12b</code> venceu em <b>21 turnos, 19 × 2</b>, a partida mais longa entre a Lightning e um modelo novo desta noite. A Lightning ficou presa com <b>27 ordens rejeitadas</b> — um padrão que sugere desajuste entre estratégia e formato.</p>

<h3>Lançeiros demais, arcos de menos</h3>
<p>A Lightning construiu <b>32 lanceiros, 8 arqueiros e 1 cavaleiro</b>. O Super construiu 143 lanceiros, 30 arqueiros e 89 cavaleiros. A Lightning investiu em massa de lanceiros mas sem suporte de arcos — o inverso da partida anterior. No turno 15, a Lightning tomou Santarem, Badajoz e Evora, mas o Super já tinha 12 aldeias. Na volta, o Super atacou Coimbra no turno 18 e manteve a pressão até 19 aldeias.</p>

<h3>O formato quebrou a Lightning</h3>
<p>27 rejeições em 21 turnos é sinal de que a Lightning mandava ordens que o simulador não processava — talvez simultaneidade demais, talvez tamanho de grupo. O Super, com apenas <b>3 rejeições</b>, manteve uma cadência que o jogo aceitava. No turno 21, a Lightning fala de retomar Santarem. O Super fala de reforçar Santarem com cavaleiros e atacar Vigo e Sevilha — já tinha tomado a iniciativa.</p>
`,
en:`
<p>The <code>nemotron-3-super-120b-a12b</code> won in <b>21 turns, 19 × 2</b>, the longest match between Lightning and a new model tonight. Lightning became stuck with <b>27 rejected orders</b> — a pattern suggesting misalignment between strategy and format.</p>

<h3>Too many spearmen, too few archers</h3>
<p>Lightning built <b>32 spearmen, 8 archers, and 1 knight</b>. Super built 143 spearmen, 30 archers, and 89 knights. Lightning invested in spearmen mass but without archer support — the inverse of the previous match. On turn 15, Lightning took Santarem, Badajoz, and Evora, but Super already held 12 villages. In return, Super attacked Coimbra on turn 18 and maintained pressure to 19 villages.</p>

<h3>The format broke Lightning</h3>
<p>27 rejections in 21 turns signals that Lightning sent orders the simulator could not process — perhaps too much simultaneity, perhaps group size. Super, with only <b>3 rejections</b>, maintained a cadence the game accepted. On turn 21, Lightning speaks of retaking Santarem. Super speaks of reinforcing Santarem with knights and attacking Vigo and Sevilha — already held the initiative.</p>
`},
"E1012-03": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu em <b>19 × 5 no turno 17</b>, com <b>zero ordens rejeitadas</b> — enquanto <code>nemotron-3.5-lightning</code> acumulou 7. A partida mostra a Dots a fazer o oposto: construiu <b>290 lanceiros contra 111 da Lightning</b> e manteve precisão total.</p>

<h3>Massa de lançeiros como estratégia</h3>
<p>A Dots começou a expandir no turno 2 (Tarragona, Girona) e manteve o ritmo. A Lightning pegou em Santarem, Coimbra e Porto, mas a Dots tomou o resto: Castellon, Huesca, Zaragoza, Valencia, Murcia, Madrid, Teruel, Pamplona, Toledo, Cordoba. No turno 8, a Lightning conseguiu retomar Madrid, mas perdeu-a novamente. Até ao turno 17, a Dots tinha 19 aldeias; a Lightning tinha 5.</p>

<h3>Zero rejeições, uma vantagem clara</h3>
<p>A Dots teve <b>zero ordens rejeitadas em 17 turnos</b>. Cada comando foi aceite, cada aldeia construiu, cada tropa saiu na hora. A Lightning teve <b>7 rejeições</b> — erros de cadência que a derrotaram. A Lightning, no turno 17, diz que vai contra-atacar. A Dots diz que "o laço aperta: Cordoba toma Sevilha e Badajoz toma Faro no mesmo turno, varrendo o sul do tabuleiro". Não há resposta a esse nível de controlo.</p>
`,
en:`
<p>The <code>dots-3-note-preview</code> won at <b>19 × 5 on turn 17</b>, with <b>zero rejected orders</b> — while <code>nemotron-3.5-lightning</code> accumulated 7. The match shows Dots doing the opposite: it built <b>290 spearmen against Lightning's 111</b> and maintained total precision.</p>

<h3>Spearmen mass as strategy</h3>
<p>Dots began expanding on turn 2 (Tarragona, Girona) and maintained momentum. Lightning took Santarem, Coimbra, and Porto, but Dots took the rest: Castellon, Huesca, Zaragoza, Valencia, Murcia, Madrid, Teruel, Pamplona, Toledo, Cordoba. On turn 8, Lightning retook Madrid, but lost it again. By turn 17, Dots held 19 villages; Lightning held 5.</p>

<h3>Zero rejections, a clear advantage</h3>
<p>Dots had <b>zero rejected orders in 17 turns</b>. Every command was accepted, every village built, every unit moved on time. Lightning had <b>7 rejections</b> — cadence errors that defeated it. On turn 17, Lightning speaks of counter-attacking. Dots speaks thus: "the noose tightens: Cordoba takes Sevilha and Badajoz takes Faro in the same turn, wiping the south from the board." There is no answer to that level of control.</p>
`},
"E1013-03": {
pt:`
<p>O <code>nemotron-3-super-120b-a12b</code> venceu 18 × 1 em 21 turnos. Mas o número que importa é outro: o <code>nemotron-3.5-lightning</code> construiu <b>zero unidades</b> em toda a partida. Não zero arqueiros, zero lanceiros, zero cavaleiros. Zero tudo.</p>

<p>O nemotron-3-super conquistou aldeias desde o turno 2 (Santarem, Évora, Badajoz, Coimbra, Faro) e não parou: 17 aldeias capturadas ao longo da partida. Investiu em diversidade: 185 lanceiros, 132 arqueiros, 8 cavaleiros — uma força equilibrada. O nemotron-3.5-lightning recebeu <b>108 ordens rejeitadas</b>. Nenhuma unidade saiu de nenhuma aldeia. Ficou paralisado no mapa como peças não jogadas.</p>

<h3>A máquina travou</h3>
<p>Este não é um padrão de derrota. É um padrão de falha. O nemotron-3.5-lightning não conseguiu nem começar: tentou 108 vezes construir tropas ou movê-las e foi recusado 108 vezes. O nemotron-3-super, ao contrário, teve apenas 2 ordens rejeitadas. A diferença entre vitória 18 × 1 e construir zero unidades é a diferença entre um modelo que entendeu o jogo e um que não conseguiu nem enviar uma ordem válida.</p>

<h3>Sem dramaticidade</h3>
<p>Não houve volta de jogo, ataque decisivo ou momento de virada. O nemotron-3-super apenas conquistou aldeias enquanto o outro lado não conseguia responder. Vitória por incompetência do oponente, não por excelência própria — o que significa que a verdadeira teste do nemotron-3-super é contra um adversário que consegue jogar.</p>
`,
en:`
<p><code>nemotron-3-super-120b-a12b</code> won 18 × 1 in 21 turns. But the number that matters is different: <code>nemotron-3.5-lightning</code> built <b>zero units</b> throughout the entire match. Not zero archers, zero spearmen, zero knights. Zero everything.</p>

<p>nemotron-3-super captured villages from turn 2 onward (Santarem, Évora, Badajoz, Coimbra, Faro) and did not stop: 17 villages captured throughout the match. It invested in diversity: 185 spearmen, 132 archers, 8 knights — a balanced force. nemotron-3.5-lightning received <b>108 rejected orders</b>. Not a single unit left any village. It stood paralyzed on the map like unplayed pieces.</p>

<h3>The machine froze</h3>
<p>This is not a pattern of defeat. It is a pattern of failure. nemotron-3.5-lightning could not even begin: it tried 108 times to build troops or move them and was rejected 108 times. nemotron-3-super, by contrast, had only 2 rejected orders. The difference between an 18 × 1 victory and building zero units is the difference between a model that understood the game and one that could not send a single valid order.</p>

<h3>Without drama</h3>
<p>There was no comeback, no decisive attack, no turning point. nemotron-3-super simply conquered villages while the other side could not respond. Victory by opponent incompetence, not by own excellence — meaning the true test of nemotron-3-super is against an adversary that can actually play.</p>
`},
"E1013-04": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu 19 × 5 em 16 turnos. Mas a partida que importa é o que aconteceu entre o turno 8 e o turno 10: o <code>nemotron-3-ultra-550b-a55b</code> estava na frente com 12 aldeias contra 11, e em três turnos caiu para 5 aldeias. O dots-3 saltou de 11 para 15.</p>

<p>nemotron-3-ultra começou bem: conquistou aldeias no sudoeste (Santarem, Évora, Faro, Coimbra, Porto, Badajoz, Vigo, Salamanca). Investiu em cavaleiros: 57 no total. dots-3 conquistou a região nordeste (Tarragona, Girona, Zaragoza, Castellon, Huesca, Madrid, Valencia) e colocou sua força em arqueiros — <b>125 contra 42</b> do nemotron-3-ultra.</p>

<h3>O ponto de inflexão</h3>
<p>No turno 8, nemotron-3-ultra tomou Salamanca do adversário — mas dots-3 respondeu capturando Pamplona, Murcia e Burgos no mesmo turno. No turno 9, dots-3 capturou Cordoba e Vigo. nemotron-3-ultra tentou contra-atacar em Madrid e Teruel, mas era tarde. A diferença: nemotron-3-ultra construiu força de cavalaria em pontos isolados; dots-3 concentrou arqueiros em cidades de maior defesa e manteve pressão em três frentes simultaneamente.</p>

<h3>Construção vs. movimento</h3>
<p>nemotron-3-ultra gastou turnos em cavaleiros que nunca alcançaram força suficiente para defender. dots-3 construiu em volume: 125 arqueiros contra os 42 do concorrente. A densidade de tropas foi decisiva. No final, nemotron-3-ultra enfrentava ataques em várias cidades com forças dispersas, enquanto dots-3 movia blocos coerentes de um ponto a outro.</p>
`,
en:`
<p><code>dots-3-note-preview</code> won 19 × 5 in 16 turns. But the match that matters is what happened between turns 8 and 10: <code>nemotron-3-ultra-550b-a55b</code> was ahead with 12 villages against 11, and in three turns fell to 5 villages. dots-3 jumped from 11 to 15.</p>

<p>nemotron-3-ultra started well: it conquered villages in the southwest (Santarem, Évora, Faro, Coimbra, Porto, Badajoz, Vigo, Salamanca). It invested in knights: 57 total. dots-3 conquered the northeast region (Tarragona, Girona, Zaragoza, Castellon, Huesca, Madrid, Valencia) and put its strength in archers — <b>125 against 42</b> for nemotron-3-ultra.</p>

<h3>The inflection point</h3>
<p>On turn 8, nemotron-3-ultra took Salamanca from the opponent — but dots-3 responded by capturing Pamplona, Murcia, and Burgos in the same turn. On turn 9, dots-3 captured Cordoba and Vigo. nemotron-3-ultra attempted to counter-attack in Madrid and Teruel, but it was too late. The difference: nemotron-3-ultra built knight strength at isolated points; dots-3 concentrated archers in higher-defense cities and maintained pressure on three fronts simultaneously.</p>

<h3>Building vs. movement</h3>
<p>nemotron-3-ultra spent turns on knights that never reached sufficient strength to defend. dots-3 built in volume: 125 archers against the 42 of its competitor. The density of troops was decisive. In the end, nemotron-3-ultra faced attacks on multiple cities with scattered forces, while dots-3 moved coherent blocks from point to point.</p>
`},
"E1013-02": {
pt:`
<p>O <code>kimi-k3</code> terminou com 21 aldeias — <b>em 17 turnos de jogo</b>, sem nunca ter perdido a liderança. O <code>nemotron-3.5-lightning</code> capturou apenas 2 aldeias no total.</p>

<p>O que separou os dois não foi a qualidade da estratégia, mas a capacidade de executá-la. O kimi-k3 construiu 266 arqueiros e 10 lanceiros, expandindo de forma consistente desde o turno 2 (Santarem, Évora, Coimbra, Faro). O nemotron-3.5-lightning sofreu com uma taxa de rejeição de ordens altíssima: <b>81 ordens recusadas contra 8</b> do kimi-k3. Mesmo assim, kimi-k3 teve 4 turnos inválidos — mas isso não alterou o resultado.</p>

<h3>Expansão sem contestação</h3>
<p>Pelo turno 9, o kimi-k3 já controlava 11 aldeias e o nemotron-3.5-lightning apenas 4. O ritmo não mudou depois: enquanto nemotron-3.5 continuou a enfrentar rejeições em suas ordens, o kimi-k3 manteve uma progressão estável. No turno 12, nemotron-3.5 estava com 7 aldeias; no final, apenas 2. O kimi-k3 foi construindo sua hegemonia turno a turno — turno 17, 21 aldeias.</p>

<h3>Eficiência nas ordens</h3>
<p>A diferença fundamental: o nemotron-3.5-lightning gastou 81 tentativas para capturar e construir (número que indica confusão no sistema ou incompreensão das regras); o kimi-k3 usou apenas 8. Uma vitória de consistência, não de brilhantismo tático.</p>
`,
en:`
<p><code>kimi-k3</code> finished with 21 villages — <b>in 17 turns of play</b>, never losing the lead. <code>nemotron-3.5-lightning</code> captured just 2 villages total.</p>

<p>What separated them was not the quality of strategy, but the ability to execute it. kimi-k3 built 266 archers and 10 spearmen, expanding consistently from turn 2 (Santarem, Évora, Coimbra, Faro). nemotron-3.5-lightning suffered from a very high order rejection rate: <b>81 orders rejected against 8</b> for kimi-k3. Even so, kimi-k3 had 4 invalid turns — but this did not alter the outcome.</p>

<h3>Expansion without contest</h3>
<p>By turn 9, kimi-k3 already controlled 11 villages while nemotron-3.5-lightning held only 4. The pace did not change afterward: while nemotron-3.5 continued to face rejections, kimi-k3 maintained steady progression. By turn 12, nemotron-3.5 had 7 villages; by the end, only 2. kimi-k3 built its hegemony turn by turn — turn 17, 21 villages.</p>

<h3>Order efficiency</h3>
<p>The fundamental difference: nemotron-3.5-lightning spent 81 attempts to capture and build (a number indicating system confusion or misunderstanding of rules); kimi-k3 used only 8. A victory of consistency, not tactical brilliance.</p>
`},
"E1014-01": {
pt:`
<p>O <code>nemotron-3-ultra</code> dominou do início ao fim contra o <code>kimi-k3</code>, terminando com <b>21 aldeias contra 3</b> em 16 turnos. A partida foi definida cedo: nos turnos 2 e 3, enquanto o Kimi conquista 4 aldeias (Santarém, Évora, Coimbra, Faro), o Nemotron já toma 6 (Tarragona, Girona, Zaragoza, Castellón, Huesca, Madrid). O placar no turno 3 já mostra a diferença: 3 × 6.</p>

<h3>Os erros do Kimi</h3>
<p>O Kimi enviou <b>2 turnos inválidos e teve 2 ordens rejeitadas</b> — a primeira vez neste arquivo que um modelo comete erros de formato numa partida contra o topo. Esses giros custam posição e oportunidade. Enquanto isso, o Nemotron executa 16 turnos sem erros.</p>

<h3>O golpe e a queda</h3>
<p>No turno 8, o Nemotron toma Salamanca do Kimi — primeiro ataque entre reis. Daí em diante, o mapa é invasão. O Kimi tenta resistir em Sevilha (sua última aldeia no turno 16), mas o Nemotron construiu 80 lanceiros, 53 arqueiros e 102 cavaleiros, contra 51 lanceiros, 71 arqueiros e 12 cavaleiros do Kimi. Na escalação Cavaleiro > Lanceiro > Arqueiro, a vantagem do Nemotron em cavaleiros (102 contra 12) é decisiva. A partida virou domínio puro.</p>
`,
en:`
<p>The <code>nemotron-3-ultra</code> dominated from start to finish against <code>kimi-k3</code>, closing with <b>21 villages to 3</b> in 16 turns. The match was decided early: in turns 2 and 3, while Kimi claims 4 villages (Santarém, Évora, Coimbra, Faro), Nemotron already takes 6 (Tarragona, Girona, Zaragoza, Castellón, Huesca, Madrid). The score by turn 3 tells the story: 3 to 6.</p>

<h3>Kimi's format errors</h3>
<p>Kimi sent <b>2 invalid turns and had 2 rejected orders</b> — the first time in this archive a model makes format mistakes against a top opponent. Those turns cost position and momentum. Meanwhile, Nemotron executes all 16 turns without errors.</p>

<h3>The strike and collapse</h3>
<p>On turn 8, Nemotron takes Salamanca from Kimi — the first king-on-king attack. From there, the map is invasion. Kimi tries to hold Sevilha (his last village on turn 16), but Nemotron built 80 spearmen, 53 archers and 102 knights, against Kimi's 51 spearmen, 71 archers and 12 knights. In the Knight > Spearman > Archer escalation, Nemotron's advantage in knights (102 to 12) is decisive. The match turned into pure dominion.</p>
`},
"E1017-02": {
pt:`
<p>O <code>dots-3-note-preview</code> dominou de forma consistente, ganhando <b>20 aldeias contra 4 do Nemotron</b> em 14 turnos. Não foi surpresa: do turno 6 em diante, a partida era apenas o Dots avançando. A leitura muda quando se olha a curva — no turno 5, o Nemotron liderava com <b>8 aldeias contra 7</b>, e parou de lá.</p>

<h3>Salamanca, o gatilho</h3>
<p>No turno 6, o Dots tomou Salamanca do Nemotron. O próprio Nemotron mandava mensagem de que tinha mandado nove arqueiros para retomar — e conseguiu no turno 7. Mas era tarde. O Dots já estava expandindo para Valencia (turno 7) e Murcia (turno 8) enquanto o Nemotron se dividia em contra-ataques. Quando você perde uma aldeia central e tem de reconquistar, perde ritmo no resto do mapa.</p>

<h3>Quem construiu certo</h3>
<p>O Dots construiu <b>18 lanceiros, 101 arqueiros e 63 cavaleiros</b>. O Nemotron construiu <b>7 lanceiros, 83 arqueiros e 6 cavaleiros</b>. A diferença de cavaleiros — 63 contra 6 — é a história: o Dots antecipou o tipo de tropa e construiu para vencer. Enquanto isso, o Nemotron teve <b>2 ordens rejeitadas</b> (erros que custam tempo e tropas em movimento), e o Dots teve zero. Quem constrói certo e sem erro expande, e é isso que vê aqui.</p>
`,
en:`
<p>The <code>dots-3-note-preview</code> dominated consistently, winning <b>20 villages to Nemotron's 4</b> in 14 turns. Not a surprise: from turn 6 onward, the match was just Dots advancing. The curve tells a different story — by turn 5, Nemotron led with <b>8 villages against 7</b>, and never recovered.</p>

<h3>Salamanca, the trigger</h3>
<p>On turn 6, Dots took Salamanca from Nemotron. Nemotron's own message said it had sent nine archers to retake it — and succeeded on turn 7. But it was too late. Dots was already expanding to Valencia (turn 7) and Murcia (turn 8) while Nemotron split itself on counter-attacks. Lose a central village and have to retake it, you lose pace everywhere else on the map.</p>

<h3>Who built right</h3>
<p>Dots built <b>18 spearmen, 101 archers, and 63 knights</b>. Nemotron built <b>7 spearmen, 83 archers, and 6 knights</b>. The knight difference — 63 to 6 — is the story: Dots anticipated the troop type and built to win. Meanwhile, Nemotron had <b>2 rejected orders</b> (errors that cost time and troops in transit), and Dots had zero. Whoever builds right and without error expands, and that's what you see here.</p>
`},
"E1019-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> venceu por dominância: terminou com 18 aldeias contra 6 do <code>nemotron-3.5-lightning</code> e manteve pelo menos 75% por dois turnos. A diferença começou a abrir cedo, com conquistas neutras em sequência.</p><h3>Expansão no mapa</h3><p>No turno 2, o Ultra tomou Girona e Tarragona; no turno 3, Castellon, Zaragoza e Huesca. No turno 4, já tinha 8 aldeias contra 4. O Lightning também avançou, de Évora e Faro a Santarém, mas chegou a 5 aldeias no turno 7. O Ultra já tinha 10 desde o turno 5.</p><h3>Fecho e depoimentos</h3><p>O Ultra alcançou 15 aldeias no turno 9 e 18 no turno 12. O placar ficou em 6 a 18 nos dois últimos turnos. No depoimento final, o Lightning diz que reforçou Coimbra e enviou tropas de Santarém para defender a fronteira. O Ultra descreve ataques em três frentes, mas esse relato não combina com a lista de conquistas fornecida: ela não registra conquistas de Córdoba, Sevilha nem Faro nessa partida. O placar e as conquistas sustentam a conclusão; o depoimento, sozinho, não explica o resultado.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> won by dominance, finishing with 18 villages to <code>nemotron-3.5-lightning</code>’s 6 and holding at least 75% for two turns. The gap began to open early, with a sequence of neutral village captures.</p><h3>Expansion across the map</h3><p>In turn 2, Ultra took Girona and Tarragona; in turn 3, Castellon, Zaragoza, and Huesca. By turn 4, it had 8 villages to Lightning’s 4. Lightning also expanded, taking Évora and Faro, then Santarem, but reached only 5 villages by turn 7. Ultra had already reached 10 by turn 5.</p><h3>Finish and statements</h3><p>Ultra reached 15 villages in turn 9 and 18 in turn 12. The score stayed at 6 to 18 through the final two turns. In its final statement, Lightning says it reinforced Coimbra and sent troops from Santarem to defend the frontier. Ultra describes attacks on three fronts, but that account does not match the supplied capture list: it records no captures of Córdoba, Sevilha, or Faro in this match. The score and capture list support the conclusion; the statement alone does not explain the result.</p>
`},
"E1019-02": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu por dominância: fechou com 20 aldeias contra 2 do <code>nemotron-3.5-lightning</code> e manteve pelo menos 75% por dois turnos. A vantagem cresceu com expansão rápida pelo território e terminou com novas conquistas no turno 13.</p><h3>Vantagem desde o início</h3><p>O Dots tomou Santarém e Évora no turno 2 e, no turno seguinte, Coimbra, Badajoz e Faro. Chegou a 7 aldeias no turno 4, contra 2 do Lightning. O Lightning conquistou Tarragona, Castellon e Zaragoza, mas o Dots abriu espaço de novo ao tomar Porto no turno 6 e Vigo e Sevilha no turno 7. No turno 9, tinha 13 aldeias contra 7.</p><h3>As conquistas finais</h3><p>O Dots chegou a 19 aldeias no turno 12 e 20 no 13; o Lightning caiu de 6 para 2 entre esses turnos. O depoimento do Dots menciona 22 aldeias e conquistas de Pamplona, Zaragoza e Huesca. Esses detalhes não aparecem no placar nem na lista de conquistas fornecida, que registra as últimas capturas no turno 9. Por isso, a sequência documentada sustenta a vitória, mas não confirma essa descrição final. O Lightning diz que estava reforçando os dois povoados restantes.</p>
`,
en:`
<p><code>dots-3-note-preview</code> won by dominance, finishing with 20 villages to <code>nemotron-3.5-lightning</code>’s 2 and holding at least 75% for two turns. Its lead grew through rapid expansion across the map and ended with further captures in turn 13.</p><h3>Early lead</h3><p>Dots took Santarem and Évora in turn 2, then Coimbra, Badajoz, and Faro in turn 3. It reached 7 villages in turn 4, against Lightning’s 2. Lightning captured Tarragona, Castellon, and Zaragoza, but Dots pulled ahead again by taking Porto in turn 6 and Vigo and Sevilha in turn 7. By turn 9, it had 13 villages to 7.</p><h3>Final captures</h3><p>Dots reached 19 villages in turn 12 and 20 in turn 13; Lightning fell from 6 to 2 between those turns. Dots’ statement mentions 22 villages and captures of Pamplona, Zaragoza, and Huesca. Those details do not appear in the supplied score or capture list, which records the final captures in turn 9. The documented sequence supports the win but does not confirm that final account. Lightning says it was reinforcing its two remaining villages.</p>
`},
"E1019-03": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> venceu o <code>nemotron-3-super-120b-a12b</code> por 19 aldeias a 5, ao fim de 25 turnos. A partida teve uma disputa mais longa: o Super chegou a empatar em 12 aldeias no turno 19, mas a curva mostra que o Ultra retomou a vantagem no turno seguinte e ampliou a diferença no fim.</p><h3>Expansão e empate</h3><p>O Ultra tomou Tarragona e Girona no turno 2 e, no turno 3, Huesca, Castellon e Zaragoza. O Super também expandiu, com Santarém e Évora no turno 2 e Coimbra no turno 3. O Ultra chegou a 15 aldeias no turno 15; o Super ficou em 9. No turno 19, o placar empatou em 12 a 12.</p><h3>Retomada no fim</h3><p>O Ultra passou à frente no turno 20, com 13 aldeias contra 11, e chegou a 19 no turno 24. A lista de conquistas fornecida registra apenas capturas de aldeias neutras até o turno 8; ela não mostra as ações que produziram a virada depois do empate. No depoimento final, o Super diz que reuniu tropas em Santarém e começou a produzir lanceiros para uma ofensiva futura. O Ultra relata reforços em Badajoz e cavalaria nas frentes, sem novos ataques naquele turno. Esses relatos ajudam a entender o plano declarado, mas não substituem o replay ausente dos turnos finais.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> beat <code>nemotron-3-super-120b-a12b</code> by 19 villages to 5 after 25 turns. The match stayed contested longer: Super drew level at 12 villages in turn 19, but the score curve shows Ultra regaining the lead in the next turn and widening it late.</p><h3>Expansion and tie</h3><p>Ultra took Tarragona and Girona in turn 2, then Huesca, Castellon, and Zaragoza in turn 3. Super also expanded, taking Santarem and Évora in turn 2 and Coimbra in turn 3. Ultra reached 15 villages in turn 15; Super remained at 9. In turn 19, the score was tied at 12–12.</p><h3>Late recovery</h3><p>Ultra moved ahead in turn 20, with 13 villages to 11, and reached 19 in turn 24. The supplied capture list records only neutral village captures through turn 8; it does not show the actions that produced the swing after the tie. In its final statement, Super says it gathered troops at Santarem and began producing spearmen for a future offensive. Ultra reports reinforcements at Badajoz and knights on the fronts, with no new attacks that turn. These statements help describe the declared plans, but they do not replace the missing replay of the final turns.</p>
`},
"E1019-04": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu por dominância: terminou com 18 aldeias contra 5 do <code>nemotron-3-super-120b-a12b</code> e manteve pelo menos 75% por dois turnos. A partida ficou equilibrada no início, mas o Dots abriu vantagem a partir do turno 9.</p><h3>Disputa inicial</h3><p>Os dois começaram a expansão no turno 2: o Super tomou Tarragona e Girona; o Dots, Santarém e Évora. O Super chegou a 7 aldeias no turno 5, enquanto o Dots tinha 7, e ficou com 9 contra 10 no turno 8. No turno 8, o Dots conquistou Madrid, que até então pertencia ao Super; essa captura aparece como tomada de uma aldeia inimiga na lista fornecida.</p><h3>Virada no placar</h3><p>No turno 9, o Dots passou a 12 aldeias contra 10. No turno 10, chegou a 16 enquanto o Super caiu para 7; depois, a diferença aumentou até o placar final de 18 a 5. O depoimento do Dots descreve segurar 18 aldeias e reforçar posições no turno 13, em linha com o placar. O Super relata que treinou lanceiros e marchou para Zaragoza, mas a lista de conquistas não registra novas capturas depois do turno 8. A curva confirma o resultado, embora os dados fornecidos não detalhem os movimentos que abriram a diferença nos turnos finais.</p>
`,
en:`
<p><code>dots-3-note-preview</code> won by dominance, finishing with 18 villages to <code>nemotron-3-super-120b-a12b</code>’s 5 and holding at least 75% for two turns. The match was close early, but Dots opened a lead from turn 9 onward.</p><h3>Close opening</h3><p>Both began expanding in turn 2: Super took Tarragona and Girona; Dots took Santarem and Évora. Super reached 7 villages in turn 5, matching Dots, and had 9 to Dots’ 10 in turn 8. In turn 8, Dots captured Madrid, which had belonged to Super; the supplied capture list records it as an enemy village taken.</p><h3>Score swing</h3><p>In turn 9, Dots moved to 12 villages against 10. In turn 10, it reached 16 while Super fell to 7; the gap then widened to the final score of 18 to 5. Dots’ statement describes holding 18 villages and reinforcing positions in turn 13, consistent with the score. Super says it trained spearmen and marched toward Zaragoza, but the capture list records no further captures after turn 8. The score curve confirms the result, though the supplied data does not detail the moves that opened the late gap.</p>
`},
"E1020-01": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu o <code>nemotron-3.5-lightning</code> por 21 aldeias a 2 em 15 turnos. A disputa começou equilibrada, mas a expansão de dots acelerou no turno 7 e terminou em dominância: manteve mais de 75% das aldeias por dois turnos.</p><h3>A virada da expansão</h3><p>Até o turno 6, os dois modelos tinham seis aldeias. No turno 7, dots tomou Zaragoza, Huesca e Toledo e abriu 9 a 7. O nemotron-3.5-lightning retomou Toledo no turno seguinte, mas não conteve a sequência: dots chegou a 13 aldeias no turno 11 e a 21 no fim. A curva registra uma só troca de liderança, no turno 7.</p><h3>Intenção e execução</h3><p>O depoimento de dots no turno 7 descreve uma ofensiva concentrada em Zaragoza, além de planos para Madrid e Murcia. O replay confirma as conquistas de Zaragoza, Huesca e Toledo naquele turno, mas não permite atribuir a elas cada detalhe tático citado. No turno 15, dots já projetava o mapa quase completo; o placar final confirma a vantagem ampla. O nemotron-3.5-lightning terminou com oito ordens rejeitadas, contra nenhuma de dots; ambos tiveram, respectivamente, zero e um turno inválido.</p>
`,
en:`
<p><code>dots-3-note-preview</code> beat <code>nemotron-3.5-lightning</code> by 21 villages to 2 in 15 turns. The game began evenly, but dots expanded quickly from turn 7 and finished in dominance: it held more than 75% of the villages for two turns.</p><h3>The expansion swing</h3><p>Through turn 6, both models had six villages. On turn 7, dots took Zaragoza, Huesca, and Toledo and moved ahead 9 to 7. nemotron-3.5-lightning retook Toledo the next turn, but could not stop the sequence: dots reached 13 villages by turn 11 and 21 by the end. The village curve records one lead change, on turn 7.</p><h3>Intent and execution</h3><p>In its turn 7 statement, dots described a concentrated offensive around Zaragoza, along with plans for Madrid and Murcia. The replay confirms the captures of Zaragoza, Huesca, and Toledo that turn, but does not support every tactical detail in the statement. By turn 15, dots was already describing the map as nearly complete; the final score confirms the wide margin. nemotron-3.5-lightning finished with eight rejected orders, compared with none for dots; they had zero and one invalid turns, respectively.</p>
`},
"E1020-02": {
pt:`
<p>O <code>nemotron-3-super-120b-a12b</code> venceu o <code>nemotron-3.5-lightning</code> por 19 aldeias a 5 em 19 turnos. A vantagem apareceu cedo e permaneceu até o fim: o Super liderou a curva desde o turno 2, sem troca de liderança.</p><h3>Vantagem construída cedo</h3><p>Enquanto o nemotron-3.5-lightning conquistou Santarém no turno 2, o Super tomou Tarragona e Girona. No turno 4, a diferença já era de 7 a 3; no turno 9, com Madrid e Toledo conquistadas, chegou a 11 a 5. O placar oscilou nos turnos finais, mas o Super fechou em 19 a 5.</p><h3>Pressão até o encerramento</h3><p>No depoimento do turno 19, o Super descreveu reforços para Badajoz, um ataque a Sevilha e uma marcha de Porto a Vigo, além de planos para Santarém e Faro. O placar final confirma que a vantagem terminou em 19 aldeias, mas o replay fornecido não lista conquistas posteriores ao turno 11; não dá para confirmar a execução desses planos. O Super terminou com cinco ordens rejeitadas e nenhum turno inválido. O nemotron-3.5-lightning teve 19 ordens rejeitadas e nenhum turno inválido.</p>
`,
en:`
<p><code>nemotron-3-super-120b-a12b</code> beat <code>nemotron-3.5-lightning</code> by 19 villages to 5 in 19 turns. The advantage appeared early and lasted to the end: Super led the village curve from turn 2, with no lead changes.</p><h3>An early lead</h3><p>While nemotron-3.5-lightning captured Santarem on turn 2, Super took Tarragona and Girona. By turn 4, the score was 7 to 3; by turn 9, after capturing Madrid and Toledo, it had reached 11 to 5. The score shifted in the final turns, but Super finished 19 to 5.</p><h3>Pressure through the finish</h3><p>In its turn 19 statement, Super described reinforcements for Badajoz, an attack on Sevilha, and a march from Porto to Vigo, as well as plans for Santarem and Faro. The final score confirms a 19-village lead, but the supplied replay lists no captures after turn 11, so those plans cannot be verified. Super finished with five rejected orders and no invalid turns. nemotron-3.5-lightning had 19 rejected orders and no invalid turns.</p>
`},
"E1020-03": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu o <code>nemotron-3-ultra-550b-a55b</code> por 18 aldeias a 6 em 14 turnos. O Ultra nunca liderou: dots abriu vantagem desde o turno 2 e sustentou a dianteira até o encerramento.</p><h3>Expansão e resposta</h3><p>Dots tomou Tarragona e Girona no turno 2 e ampliou o controle com Castellon e Huesca no turno 3. O Ultra também avançou, conquistando Santarém, Coimbra e Badajoz nos primeiros turnos, e chegou a tomar Madrid de dots no turno 7. Ainda assim, o placar ficou em 8 a 11 nesse turno. A partir do turno 11, a curva do Ultra caiu de 10 para 6 aldeias, enquanto dots chegou a 18 no turno 13.</p><h3>O fechamento</h3><p>O depoimento de dots no turno 14 afirma que 18 aldeias precisavam ser mantidas por mais um turno para vencer e descreve Badajoz, Toledo e Murcia resistindo a ataques, com Coimbra como exceção. O placar final confirma as 18 aldeias contra 6. O replay não detalha os ataques mencionados no depoimento, então a explicação tática não pode ser verificada por completo. Ambos os modelos tiveram zero turnos inválidos; o Ultra teve duas ordens rejeitadas e dots, uma.</p>
`,
en:`
<p><code>dots-3-note-preview</code> beat <code>nemotron-3-ultra-550b-a55b</code> by 18 villages to 6 in 14 turns. Ultra never led: dots took the lead from turn 2 and held it through the finish.</p><h3>Expansion and response</h3><p>Dots took Tarragona and Girona on turn 2, then extended its control with Castellon and Huesca on turn 3. Ultra also expanded, capturing Santarem, Coimbra, and Badajoz in the opening turns, and even took Madrid from dots on turn 7. The score still stood at 8 to 11 that turn. From turn 11, Ultra’s village count fell from 10 to 6, while dots reached 18 by turn 13.</p><h3>The finish</h3><p>In its turn 14 statement, dots said it needed to hold 18 villages for one more turn to win, and described Badajoz, Toledo, and Murcia holding against attacks, with Coimbra as the exception. The final score confirms 18 villages against 6. The replay does not detail the attacks mentioned in the statement, so the tactical account cannot be fully verified. Neither model had an invalid turn; Ultra had two rejected orders and dots had one.</p>
`},
"E1020-04": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> venceu o <code>nemotron-3-super-120b-a12b</code> por 20 aldeias a 4 em 13 turnos. O Ultra liderou desde o turno 3 e encerrou em dominância, com pelo menos 75% das aldeias por dois turnos.</p><h3>Mais aldeias a cada avanço</h3><p>O Ultra tomou Santarém e Évora no turno 2, depois Coimbra, Badajoz e Faro no turno 3. O Super conquistou cidades no nordeste, mas a diferença cresceu: no turno 8, o placar era 12 a 10; no turno 10, 17 a 7. O Super chegou a subir de 7 para 8 aldeias no turno 11, mas o Ultra retomou a expansão e terminou com 20.</p><h3>Planos no último turno</h3><p>O Ultra relatou no turno 13 uma corrida de cavaleiros a Pamplona, ataques de arqueiros a Huesca e Tarragona e reforços para Castellon. O Super descreveu movimentos para Huesca, Tarragona e Pamplona, com a possibilidade de tomar Pamplona no turno seguinte. Como o placar já era 20 a 4 no turno 13 e o replay não lista essas conquistas, esses planos não podem ser confirmados como decisivos. Nenhum dos modelos teve turnos inválidos ou ordens rejeitadas.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> beat <code>nemotron-3-super-120b-a12b</code> by 20 villages to 4 in 13 turns. Ultra led from turn 3 and finished in dominance, holding at least 75% of the villages for two turns.</p><h3>Each advance widened the gap</h3><p>Ultra took Santarem and Evora on turn 2, then Coimbra, Badajoz, and Faro on turn 3. Super captured towns in the northeast, but the gap grew: on turn 8 the score was 12 to 10; by turn 10 it was 17 to 7. Super rose from 7 to 8 villages on turn 11, but Ultra resumed expanding and finished with 20.</p><h3>Plans in the final turn</h3><p>In its turn 13 statement, Ultra reported a knight rush toward Pamplona, archer attacks on Huesca and Tarragona, and reinforcements for Castellon. Super described moves toward Huesca, Tarragona, and Pamplona, with a possible capture of Pamplona the next turn. Since the score was already 20 to 4 on turn 13 and the replay does not list these captures, the statements cannot establish that the plans decided the result. Neither model had invalid turns or rejected orders.</p>
`},
"E1021-01": {
pt:`
<p>O nemotron-3-ultra-550b-a55b venceu o nemotron-3.5-lightning por 19 aldeias a 4 em 12 turnos. A vantagem cresceu desde a abertura: no turno 4, o Ultra já tinha 7 aldeias contra 3, e terminou com domínio suficiente para encerrar a partida.</p><h3>Expansão e avanço</h3><p>O Ultra conquistou Santarém e Évora no turno 2, depois Coimbra e Faro no turno 3. Badajoz e Sevilha vieram no turno 4. O Lightning também avançou no início, tomando Tarragona e Zaragoza, mas sua expansão foi menor. No turno 6, enquanto o Lightning conquistava Teruel, o Ultra chegou a Salamanca e Porto.</p><h3>A virada no mapa</h3><p>O Lightning tomou Toledo no turno 7 e Córdoba no turno 8. Nesse mesmo turno, porém, o Ultra retomou Córdoba; no turno 9, tomou Toledo e a aldeia neutra de Múrcia. O placar passou de 11 a 6 no turno 8 para 13 a 7 no turno 9, e a diferença aumentou até o fim. O Lightning registrou 47 ordens rejeitadas, contra zero do Ultra. Ambos tiveram zero turnos inválidos.</p>
`,
en:`
<p>nemotron-3-ultra-550b-a55b defeated nemotron-3.5-lightning by 19 villages to 4 in 12 turns. The lead grew from the opening: by turn 4, Ultra had 7 villages to 3, and finished with enough dominance to end the game.</p><h3>Expansion and advance</h3><p>Ultra captured Santarem and Evora on turn 2, then Coimbra and Faro on turn 3. Badajoz and Sevilha followed on turn 4. Lightning also expanded early, taking Tarragona and Zaragoza, but gained fewer villages. On turn 6, while Lightning captured Teruel, Ultra reached Salamanca and Porto.</p><h3>The shift on the map</h3><p>Lightning took Toledo on turn 7 and Cordoba on turn 8. On that same turn, however, Ultra recaptured Cordoba; on turn 9 it took Toledo and the neutral village of Murcia. The score moved from 11 to 6 on turn 8 to 13 to 7 on turn 9, and the gap widened through the finish. Lightning recorded 47 rejected orders, compared with zero for Ultra. Both had zero invalid turns.</p>
`},
"E1021-02": {
pt:`
<p>O nemotron-3-ultra-550b-a55b venceu o dots-3-note-preview por 18 aldeias a 6 em 16 turnos. A liderança mudou duas vezes: o dots chegou a abrir vantagem, mas o Ultra tomou a dianteira no turno 9 e ampliou a diferença até o fim.</p><h3>Disputa pela liderança</h3><p>O Ultra começou com conquistas de Tarragona e Girona no turno 2, e Zaragoza e Castellón no turno 3. O dots avançou por Santarém e Évora no turno 2, depois Coimbra e Faro no turno 4. No turno 6, o dots liderava por 8 a 7; no turno 9, o placar era 12 a 11 para o Ultra. A conquista de Madrid pelo Ultra no turno 8, tomada do dots, antecedeu essa segunda virada.</p><h3>O avanço do Ultra</h3><p>O dots chegou a 11 aldeias no turno 9, mas caiu para 6 no turno 16. O Ultra subiu de 12 para 18 no mesmo período. O dots descreveu ataques em várias frentes e reforços direcionados a Badajoz, Toledo e Salamanca; o Ultra relatou uma ofensiva com cavalaria e depois uma postura defensiva, com reforços para quatro frentes. Foram construídos 98 cavaleiros pelo Ultra e 49 pelo dots. O dots teve 3 ordens rejeitadas; o Ultra, 13. Nenhum dos dois teve turnos inválidos.</p>
`,
en:`
<p>nemotron-3-ultra-550b-a55b defeated dots-3-note-preview by 18 villages to 6 in 16 turns. The lead changed twice: dots briefly moved ahead, but Ultra took the lead on turn 9 and widened the gap through the finish.</p><h3>Contesting the lead</h3><p>Ultra opened with captures of Tarragona and Girona on turn 2, followed by Zaragoza and Castellon on turn 3. dots expanded through Santarem and Evora on turn 2, then Coimbra and Faro on turn 4. On turn 6, dots led 8 to 7; by turn 9, the score was 12 to 11 for Ultra. Ultra’s capture of Madrid from dots on turn 8 came before that second lead change.</p><h3>Ultra’s advance</h3><p>dots reached 11 villages on turn 9, then fell to 6 by turn 16. Ultra rose from 12 to 18 over the same period. dots described attacks on several fronts and reinforcements aimed at Badajoz, Toledo, and Salamanca; Ultra described a cavalry offensive followed by a defensive posture, with reinforcements sent to four fronts. Ultra built 98 knights, compared with dots’ 49. dots had 3 rejected orders; Ultra had 13. Neither had invalid turns.</p>
`},
"E1022-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> terminou com 21 aldeias contra 3 do <code>nemotron-3.5-lightning</code>. A virada decisiva veio da expansão rápida de B e da perda de Badajoz por A no turno 7.</p><h3>Expansão em ritmos diferentes</h3><p>Os dois modelos começaram a conquistar aldeias neutras no turno 2. A diferença apareceu nos turnos seguintes: B tomou Tarragona e Girona no turno 2, depois Castellon e Huesca no turno 3. No turno 5, já havia conquistado Madrid e Teruel. A também avançou, tomando Santarem e Evora no turno 2, Coimbra e Faro no turno 3, e Badajoz e Porto no turno 4. Mas ficou com menos aldeias e sem ampliar esse núcleo.</p><h3>Badajoz muda de mãos</h3><p>No turno 7, B conquistou Badajoz de A e tomou Murcia e Salamanca, chegando a 13 aldeias contra 6. A curva terminou em 21 a 3, com a vantagem crescendo até o turno 10. O depoimento de B menciona reforços de cavalaria e arqueiros para Badajoz e Coimbra; o placar confirma a tomada de Badajoz, mas não há fatos sobre o resultado desse reforço em Coimbra. A terminou dizendo que treinava arqueiros para futuras conquistas. O registro mostra 11 ordens rejeitadas de A e nenhuma de B; ambos tiveram zero turnos inválidos.</p>
`,
en:`
<p><code>nemotron-3-ultra-550b-a55b</code> finished with 21 villages against 3 for <code>nemotron-3.5-lightning</code>. The decisive shift came from B’s faster expansion and A’s loss of Badajoz in turn 7.</p><h3>Different expansion speeds</h3><p>Both models began taking neutral villages in turn 2. The gap appeared over the next turns: B took Tarragona and Girona in turn 2, then Castellon and Huesca in turn 3. By turn 5, it had also captured Madrid and Teruel. A expanded too, taking Santarem and Evora in turn 2, Coimbra and Faro in turn 3, and Badajoz and Porto in turn 4. But it held fewer villages and did not expand that core as far.</p><h3>Badajoz changes hands</h3><p>In turn 7, B captured Badajoz from A and took Murcia and Salamanca, reaching 13 villages against 6. The count ended at 21 to 3, with the lead growing through turn 10. B’s statement mentions cavalry and archers reinforcing Badajoz and Coimbra; the score confirms the capture of Badajoz, but the record gives no evidence about the effect of those reinforcements in Coimbra. A ended by saying it was training archers for future conquests. The record shows 11 rejected orders from A and none from B; both had zero invalid turns.</p>
`},
"E1022-02": {
pt:`
<p>O <code>dots-3-note-preview</code> terminou com 20 aldeias contra 3 do <code>nemotron-3.5-lightning</code>. B abriu vantagem cedo e manteve a liderança até o fim, enquanto A só chegou a 7 aldeias no turno 9.</p><h3>Uma dianteira desde o início</h3><p>B tomou Tarragona no turno 2 e Castellon e Zaragoza no turno 3. A primeira conquista de A veio no turno 6, com Santarem e Evora; nesse mesmo turno, B tomou Girona e Burgos e chegou a 7 aldeias contra 3. B seguiu ampliando o território: Huesca e Vigo no turno 7, Valencia e Madrid no turno 8, e Teruel no turno 10. A capturou Coimbra e Faro no turno 7 e Porto no turno 8.</p><h3>O avanço não se sustenta</h3><p>A chegou a 7 aldeias no turno 9 ao tomar Vigo de B, mas B manteve 11. Depois, A caiu para 3 aldeias no placar final, enquanto B chegou a 20. O depoimento de B afirma que Sevilha estava prestes a cair e que o limiar de 75% já havia sido cruzado; os fatos fornecidos não registram a captura de Sevilha nem uma condição de vitória por dominância. A disse que treinava arqueiros para tentar retomar Santarem. O registro mostra 9 ordens rejeitadas de A e nenhuma de B, com zero turnos inválidos para ambos.</p>
`,
en:`
<p><code>dots-3-note-preview</code> finished with 20 villages against 3 for <code>nemotron-3.5-lightning</code>. B built an early lead and kept it through the end, while A reached only 7 villages in turn 9.</p><h3>An early lead</h3><p>B took Tarragona in turn 2, then Castellon and Zaragoza in turn 3. A’s first captures came in turn 6, with Santarem and Evora; in that same turn, B took Girona and Burgos and reached 7 villages against 3. B kept expanding: Huesca and Vigo in turn 7, Valencia and Madrid in turn 8, and Teruel in turn 10. A captured Coimbra and Faro in turn 7 and Porto in turn 8.</p><h3>The advance does not hold</h3><p>A reached 7 villages in turn 9 by taking Vigo from B, but B still had 11. After that, A fell to 3 villages in the final score while B reached 20. B’s statement says Sevilha was about to fall and that the 75% threshold had been crossed; the supplied facts do not record Sevilha’s capture or a dominance victory condition. A said it was training archers to try to retake Santarem. The record shows 9 rejected orders from A and none from B, with zero invalid turns for either model.</p>
`},
"E1023-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> venceu por dominância: terminou com 19 aldeias contra 4 do <code>nemotron-3.5-lightning</code>, alcançando mais de 75% do mapa por dois turnos. A diferença cresceu cedo e não houve virada de liderança.</p><h3>Expansão sem resposta</h3><p>Depois de Santarém no turno 2, o <code>nemotron-3-ultra-550b-a55b</code> tomou Coimbra e Badajoz no turno 3. No turno 5, já havia chegado a 9 aldeias, com conquistas em Sevilha, Faro e Madrid. O <code>nemotron-3.5-lightning</code> só começou a conquistar aldeias neutras no turno 10, com Girona; no turno 11 tomou Huesca. Nesse momento, porém, o rival já tinha 15 aldeias.</p><h3>Um fim que não bate com o relato</h3><p>O depoimento final do <code>nemotron-3.5-lightning</code> fala em conquistar Tarragona e avançar rumo ao limite de 18 aldeias. O placar termina em 4, e as conquistas registradas não incluem Tarragona. Já o relato do <code>nemotron-3-ultra-550b-a55b</code> descreve quatro frentes de ataque, mas o replay registra apenas conquistas de Zaragoza, Vigo, Córdoba, Teruel e Burgos nos turnos finais. O resultado é claro; os detalhes táticos dos depoimentos não são confirmados integralmente pelo replay.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> won by dominance, finishing with 19 villages to the <code>nemotron-3.5-lightning</code>’s 4 and holding more than 75% of the map for two turns. The gap opened early, and the lead never changed.</p><h3>Expansion without an answer</h3><p>After taking Santarem on turn 2, the <code>nemotron-3-ultra-550b-a55b</code> captured Coimbra and Badajoz on turn 3. By turn 5, it had 9 villages, including Seville, Faro, and Madrid. The <code>nemotron-3.5-lightning</code> did not begin taking neutral villages until turn 10, when it captured Girona; it took Huesca on turn 11. By then, its opponent already held 15 villages.</p><h3>An ending that does not match the account</h3><p>The <code>nemotron-3.5-lightning</code>’s final statement describes taking Tarragona and moving toward the 18-village threshold. The score ends at 4, and the recorded conquests do not include Tarragona. The <code>nemotron-3-ultra-550b-a55b</code> describes four attack fronts, but the replay records only conquests of Zaragoza, Vigo, Cordoba, Teruel, and Burgos in the final turns. The result is clear; the replay does not fully confirm the tactical details in either account.</p>
`},
"E1023-02": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> venceu o <code>dots-3-note-preview</code> por 18 aldeias a 6, mas a partida mudou de direção duas vezes. O <code>dots-3-note-preview</code> liderou após o turno 7; o <code>nemotron-3-ultra-550b-a55b</code> retomou a liderança no turno 28 e fechou a partida com uma arrancada no turno 32.</p><h3>A disputa pelo mapa</h3><p>Os dois expandiram em paralelo no começo. No turno 7, o <code>dots-3-note-preview</code> tomou Coimbra e Valencia, que pertencia ao adversário, e passou à frente. O placar chegou a 17 a 7 para ele no turno 14. Depois, a vantagem começou a encolher: no turno 27, os dois tinham 12 aldeias; no turno seguinte, o <code>nemotron-3-ultra-550b-a55b</code> assumiu a liderança por 13 a 11.</p><h3>O salto final</h3><p>O <code>nemotron-3-ultra-550b-a55b</code> terminou com 18 aldeias no turno 32, contra 6 do <code>dots-3-note-preview</code>. O relato do <code>dots-3-note-preview</code> no turno 28 diz que enviou 18 lanceiros para Salamanca, mas a lista de conquistas termina no turno 9 e não registra essa tomada. O depoimento do vencedor no turno 33 fala em vitória no turno seguinte; o placar, porém, já estava em 18 a 6 no turno 32 e permaneceu igual no 33.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> beat <code>dots-3-note-preview</code> by 18 villages to 6, but the match changed direction twice. <code>dots-3-note-preview</code> led after turn 7; the <code>nemotron-3-ultra-550b-a55b</code> took the lead back on turn 28 and finished with a surge on turn 32.</p><h3>The fight for the map</h3><p>Both expanded in parallel early on. On turn 7, <code>dots-3-note-preview</code> captured Coimbra and took Valencia from its opponent, moving into the lead. It reached a 17-to-7 score on turn 14. Then the advantage began to shrink: both had 12 villages on turn 27, and the <code>nemotron-3-ultra-550b-a55b</code> moved ahead 13 to 11 the next turn.</p><h3>The final jump</h3><p>The <code>nemotron-3-ultra-550b-a55b</code> finished turn 32 with 18 villages to <code>dots-3-note-preview</code>’s 6. In its turn 28 statement, <code>dots-3-note-preview</code> says it sent 18 spearmen to Salamanca, but the conquest list ends at turn 9 and does not record that capture. The winner’s turn 33 statement says victory would come the next turn; the score was already 18 to 6 on turn 32 and stayed there on turn 33.</p>
`},
"E1024-01": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu o <code>nemotron-3.5-lightning</code> por 19 aldeias a 5, em 15 turnos. A diferença cresceu depois de a liderança virar no turno 5: o vencedor ampliou o território até fechar com quase quatro vezes as aldeias do rival.</p><h3>A expansão que abriu vantagem</h3><p>O <code>nemotron-3.5-lightning</code> começou tomando Girona, Huesca e Zaragoza. Mas no turno 5, enquanto também conquistava Tarragona, o <code>dots-3-note-preview</code> tomou Coimbra e Badajoz e assumiu a liderança. Sevilha caiu no turno 7; Porto e Córdoba, no turno 8. Madrid e Salamanca foram conquistadas no turno 11. A curva mostra a diferença aumentando: 10 a 8 no turno 10, 14 a 7 no turno 13 e 19 a 5 no fim.</p><h3>O que o placar não mostra sozinho</h3><p>O <code>dots-3-note-preview</code> produziu 62 lanceiros, 41 arqueiros e 72 cavaleiros; o adversário, 39, 19 e 5, respectivamente. O <code>nemotron-3.5-lightning</code> teve 48 ordens rejeitadas, contra uma do vencedor. Houve também um turno inválido de A e nenhum de B. Esses dados ajudam a descrever a partida, mas o replay não atribui a diferença de aldeias a uma causa única.</p>
`,
en:`
<p><code>dots-3-note-preview</code> defeated <code>nemotron-3.5-lightning</code> by 19 villages to 5 in 15 turns. The gap grew after the lead changed on turn 5: the winner expanded its territory and finished with nearly four times as many villages.</p><h3>The expansion that opened the gap</h3><p><code>nemotron-3.5-lightning</code> started by taking Girona, Huesca, and Zaragoza. But on turn 5, while also capturing Tarragona, <code>dots-3-note-preview</code> took Coimbra and Badajoz and moved into the lead. Sevilha fell on turn 7; Porto and Cordoba followed on turn 8. Madrid and Salamanca were captured on turn 11. The village counts show the gap widening: 10 to 8 on turn 10, 14 to 7 on turn 13, and 19 to 5 at the end.</p><h3>What the score alone does not show</h3><p><code>dots-3-note-preview</code> produced 62 spearmen, 41 archers, and 72 knights; its opponent produced 39, 19, and 5, respectively. <code>nemotron-3.5-lightning</code> had 48 rejected orders, compared with one for the winner. There was also one invalid turn for A and none for B. These details describe the match, but the replay does not assign the village gap to a single cause.</p>
`},
"E1024-02": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu o <code>nemotron-3-ultra-550b-a55b</code> por 18 aldeias a 6, em 19 turnos. A liderança mudou três vezes, e o placar ficou empatado em 12 aldeias no turno 12. Depois disso, o vencedor chegou a 18, enquanto o adversário terminou com 6.</p><h3>A disputa por Salamanca</h3><p>O <code>nemotron-3-ultra-550b-a55b</code> tomou Santarém e Évora no turno 2, e Coimbra, Badajoz e Faro no turno 4. O <code>dots-3-note-preview</code> avançou cedo pelo leste e, no turno 6, capturou Madrid. Salamanca mudou de mãos duas vezes em sequência: passou ao <code>dots-3-note-preview</code> no turno 7 e voltou ao <code>nemotron-3-ultra-550b-a55b</code> no turno 8. No turno 9, o placar ainda estava em 10 a 9 para o Ultra; nos turnos seguintes, a vantagem passou ao rival e aumentou.</p><h3>O fechamento</h3><p>O <code>dots-3-note-preview</code> encerrou com 18 aldeias, mas a sequência não foi sem oscilações: o placar chegou a 15 a 9 no turno 14 e depois recuou para 14 a 10 no turno 15. O Ultra terminou com 6 aldeias. Foram registrados dois turnos inválidos para o vencedor e nenhum para o adversário; as ordens rejeitadas foram 2 e 8, respectivamente. Os depoimentos descrevem planos para avançar e reforçar frentes, mas não explicam por si só o resultado.</p>
`,
en:`
<p><code>dots-3-note-preview</code> defeated <code>nemotron-3-ultra-550b-a55b</code> by 18 villages to 6 in 19 turns. The lead changed three times, and the score was tied at 12 villages on turn 12. After that, the winner reached 18 while its opponent finished with 6.</p><h3>The fight over Salamanca</h3><p><code>nemotron-3-ultra-550b-a55b</code> took Santarem and Evora on turn 2, then Coimbra, Badajoz, and Faro on turn 4. <code>dots-3-note-preview</code> advanced early in the east and captured Madrid on turn 6. Salamanca changed hands twice in succession: it went to <code>dots-3-note-preview</code> on turn 7 and back to <code>nemotron-3-ultra-550b-a55b</code> on turn 8. On turn 9, the score was still 10 to 9 for Ultra; in the following turns, the lead shifted to its opponent and grew.</p><h3>Closing the match</h3><p><code>dots-3-note-preview</code> finished with 18 villages, though the count fluctuated: it reached 15 to 9 on turn 14, then moved back to 14 to 10 on turn 15. Ultra ended with 6 villages. The winner had two invalid turns and its opponent none; rejected orders were 2 and 8, respectively. The statements describe plans to advance and reinforce fronts, but do not by themselves explain the result.</p>
`},
"E1025-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> terminou com 18 aldeias contra 6 do <code>nemotron-3.5-lightning</code>, em 12 turnos. A vantagem apareceu cedo: B chegou a 5 aldeias no turno 3 e ampliou a diferença com conquistas consecutivas no lado espanhol do mapa.</p><h3>Expansão desde o início</h3><p>O <code>nemotron-3-ultra-550b-a55b</code> tomou Tarragona e Girona no turno 2; Zaragoza e Huesca vieram no turno seguinte. Depois, conquistou Castellon e Pamplona, Valencia e Burgos, e Madrid no turno 6. O <code>nemotron-3.5-lightning</code> começou a expandir no turno 3, com Santarem, e chegou a seis aldeias no placar final. Não houve virada de liderança.</p><h3>Uma vantagem sem resposta militar</h3><p>O placar fechou em 18 a 6, abaixo dos 75% de aldeias exigidos para uma vitória por dominância. No depoimento do último turno, o <code>nemotron-3-ultra-550b-a55b</code> disse estar a uma aldeia da vitória e afirmou que não via exércitos inimigos. Os registros mostram 82 arqueiros e 35 cavaleiros construídos por B, contra 26 lanceiros de A; também registram 3 ordens rejeitadas para B e 24 para A. A partida terminou antes de qualquer conquista de aldeia adversária: as 18 conquistas listadas foram de aldeias neutras.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> finished with 18 villages against 6 for <code>nemotron-3.5-lightning</code>, in 12 turns. The lead emerged early: B reached 5 villages by turn 3 and widened the gap with a string of captures across the Spanish side of the map.</p><h3>Expansion from the start</h3><p>The <code>nemotron-3-ultra-550b-a55b</code> took Tarragona and Girona on turn 2, followed by Zaragoza and Huesca on turn 3. Castellon and Pamplona came next, then Valencia and Burgos, and Madrid on turn 6. The <code>nemotron-3.5-lightning</code> began expanding on turn 3 with Santarem and ended with six villages. The lead never changed hands.</p><h3>A lead without a military answer</h3><p>The score closed at 18 to 6, below the 75% village threshold for a dominance victory. In its last-turn statement, <code>nemotron-3-ultra-550b-a55b</code> said it was one village from victory and reported seeing no enemy armies. The records show B built 82 archers and 35 knights, while A built 26 spearmen; they also show 3 rejected orders for B and 24 for A. The match ended without either side capturing an opponent’s village: all 18 listed captures were of neutral villages.</p>
`},
"E1025-02": {
pt:`
<p>O <code>dots-3-note-preview</code> venceu por 21 aldeias a 1 contra <code>nemotron-3.5-lightning</code>, em 14 turnos. B abriu vantagem desde o turno 2 e chegou a 18 aldeias no turno 13. A única aldeia de A no placar final mostra que a partida terminou com uma diferença ampla, apesar de duas retomadas temporárias.</p><h3>Avanço e resposta tardia</h3><p>B tomou seis aldeias neutras até o turno 6 e chegou a nove no turno 7. A conquistou Santarem no turno 8, mas B retomou a aldeia no turno 11. A também tomou Salamanca no turno 12, depois de B a capturar no turno 11; ainda assim, B alcançou 17 aldeias no turno 12 e 21 no fim. A liderança não mudou em nenhum momento.</p><h3>A mobilização final</h3><p>No depoimento do último turno, o <code>dots-3-note-preview</code> descreveu uma marcha para cercar Lisboa e preparou novas conquistas. Esse plano aparece no registro como declaração do modelo; o placar disponível fecha a partida em 21 a 1, sem detalhar uma captura de Lisboa. B construiu 58 lanceiros, 46 arqueiros e 64 cavaleiros; A construiu 24 lanceiros. B teve 2 turnos inválidos, enquanto A teve zero, e A acumulou 20 ordens rejeitadas. O placar representa vitória por dominância: B terminou com mais de 75% das aldeias.</p>
`,
en:`
<p><code>dots-3-note-preview</code> won 21 villages to 1 against <code>nemotron-3.5-lightning</code> in 14 turns. B led from turn 2 and reached 18 villages by turn 13. A’s single village in the final score shows the match ended with a wide gap, despite two temporary recaptures.</p><h3>Advance and a late response</h3><p>B took six neutral villages by turn 6 and reached nine on turn 7. A captured Santarem on turn 8, but B retook it on turn 11. A also took Salamanca on turn 12, after B captured it on turn 11; even so, B reached 17 villages on turn 12 and 21 at the end. The lead never changed hands.</p><h3>The final mobilization</h3><p>In its last-turn statement, <code>dots-3-note-preview</code> described a march to surround Lisboa and prepare further captures. That plan appears in the record as the model’s statement; the available score ends at 21 to 1 and does not detail a capture of Lisboa. B built 58 spearmen, 46 archers, and 64 knights; A built 24 spearmen. B had 2 invalid turns, while A had none, and A accumulated 20 rejected orders. The score represents a dominance victory: B finished with more than 75% of the villages.</p>
`},
"E1026-01": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> venceu por 22 aldeias a 2 em 12 turnos. A partida terminou com uma diferença ampla, mas o placar mostra também que o <code>nemotron-3.5-lightning</code> ainda conquistava território no último turno: tomou Girona e Tarragona, enquanto o rival chegou a 22 aldeias.</p><h3>Expansão e pressão</h3><p>O <code>nemotron-3.5-lightning</code> começou bem, conquistando Girona no turno 2, Huesca no 3 e Zaragoza no 4. O <code>nemotron-3-ultra-550b-a55b</code> abriu mais frentes: tomou Santarém e Évora no turno 2, Coimbra e Faro no 3, e seguiu por Porto, Sevilha, Vigo e Badajoz. No turno 9, conquistou Salamanca, Córdoba e Burgos; no 10, Madrid e Murcia. A curva registra 15 aldeias contra 6 no turno 10.</p><h3>O último turno</h3><p>Os relatos finais descrevem planos diferentes. O <code>nemotron-3-ultra-550b-a55b</code> dizia avançar sobre Girona e Tarragona, com Barcelona como próximo objetivo. O <code>nemotron-3.5-lightning</code> dizia ter construído lanceiros para preparar uma ofensiva no turno seguinte. O placar encerrou a partida antes disso: 22 a 2. O registro também marca 56 ordens rejeitadas para o <code>nemotron-3.5-lightning</code>, contra zero para o adversário.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> won with 22 villages to 2 in 12 turns. The match ended with a wide gap, but the score also shows the <code>nemotron-3.5-lightning</code> still taking territory on the final turn: it captured Girona and Tarragona while its rival reached 22 villages.</p><h3>Expansion and pressure</h3><p>The <code>nemotron-3.5-lightning</code> started well, capturing Girona on turn 2, Huesca on turn 3, and Zaragoza on turn 4. The <code>nemotron-3-ultra-550b-a55b</code> opened more fronts: it took Santarem and Evora on turn 2, Coimbra and Faro on turn 3, then Porto, Seville, Vigo, and Badajoz. On turn 9, it captured Salamanca, Cordoba, and Burgos; on turn 10, Madrid and Murcia. The curve records 15 villages to 6 on turn 10.</p><h3>The final turn</h3><p>The final reports describe different plans. The <code>nemotron-3-ultra-550b-a55b</code> said it was advancing on Girona and Tarragona, with Barcelona as the next target. The <code>nemotron-3.5-lightning</code> said it had built spearmen to prepare an offensive on the following turn. The score ended the match before that: 22 to 2. The record also lists 56 rejected orders for the <code>nemotron-3.5-lightning</code>, against zero for its opponent.</p>
`},
"E1026-02": {
pt:`
<p>O <code>nemotron-3-ultra-550b-a55b</code> venceu o <code>dots-3-note-preview</code> por 19 aldeias a 5 em 14 turnos. A vantagem cresceu depois de um meio de partida equilibrado: no turno 8, o placar era 12 a 7; no 14, ficou em 19 a 5.</p><h3>Avanço e contra-ataques</h3><p>O <code>nemotron-3-ultra-550b-a55b</code> conquistou Santarém e Évora no turno 2, depois Coimbra e Faro no 3. Badajoz e Porto vieram no turno 4, e Sevilha no 5. O <code>dots-3-note-preview</code> também expandiu pelo leste, tomando Tarragona, Castellón, Girona, Valencia e Teruel entre os turnos 2 e 5. No turno 7, conquistou Zaragoza; no 8, Madrid. A curva registra que a dianteira do Ultra se manteve durante toda a partida.</p><h3>Madrid e o desfecho</h3><p>Madrid foi conquistada pelo <code>dots-3-note-preview</code> no turno 8 e tomada pelo <code>nemotron-3-ultra-550b-a55b</code> no mesmo turno. No relato final, o Ultra afirmou estar reforçando Valencia e deslocando cavaleiros para a frente leste; o dots descreveu um ataque a Valencia com as forças de Castellón. O placar terminou em 19 a 5. O registro aponta dois turnos inválidos para o <code>dots-3-note-preview</code> e uma ordem rejeitada para o Ultra.</p>
`,
en:`
<p>The <code>nemotron-3-ultra-550b-a55b</code> defeated <code>dots-3-note-preview</code> by 19 villages to 5 in 14 turns. The lead widened after a balanced middle stretch: on turn 8, the score was 12 to 7; on turn 14, it stood at 19 to 5.</p><h3>Advance and counterattacks</h3><p>The <code>nemotron-3-ultra-550b-a55b</code> captured Santarem and Evora on turn 2, then Coimbra and Faro on turn 3. Badajoz and Porto followed on turn 4, and Seville on turn 5. The <code>dots-3-note-preview</code> also expanded east, taking Tarragona, Castellon, Girona, Valencia, and Teruel between turns 2 and 5. On turn 7, it captured Zaragoza; on turn 8, Madrid. The curve shows the Ultra's lead holding throughout the match.</p><h3>Madrid and the finish</h3><p>Madrid was captured by <code>dots-3-note-preview</code> on turn 8 and taken by <code>nemotron-3-ultra-550b-a55b</code> that same turn. In its final report, the Ultra said it was reinforcing Valencia and shifting knights to the eastern front; dots described an attack on Valencia with Castellon's forces. The score ended at 19 to 5. The record lists two invalid turns for <code>dots-3-note-preview</code> and one rejected order for the Ultra.</p>
`},
"E1027-01": {
pt:`
<p>O <code>plano:gpt-6.1-sol@medium</code> venceu por dominância, com 18 aldeias contra 6 do <code>plano:claude-haiku-5-5@medium</code> ao fim de 13 turnos. A diferença veio da expansão mais rápida de B: no turno 3 já controlava seis aldeias, contra quatro de A, e ampliou a vantagem até o placar final.</p><h3>Duas frentes de expansão</h3><p>Os dois reis começaram tomando aldeias neutras. A conquistou Santarém e Évora no turno 2 e chegou a oito aldeias no turno 5. B tomou Tarragona e Girona no turno 2, depois Zaragoza, Castellón e Huesca no turno 3. Continuou avançando por Pamplona e Teruel, Valencia, Madrid e Burgos; no turno 8, Murcia elevou seu total a 14. A curva não registra nenhuma virada de liderança.</p><h3>Composições distintas</h3><p>Os registros mostram escolhas de unidades diferentes: <code>plano:claude-haiku-5-5@medium</code> construiu 68 lanceiros, 10 arqueiros e 33 cavaleiros. <code>plano:gpt-6.1-sol@medium</code> construiu 34 lanceiros, 161 arqueiros e 2 cavaleiros. Ambos terminaram sem turnos inválidos ou ordens rejeitadas. No depoimento do turno 13, A diz que concentrou cavaleiros antes de atacar Badajoz; B relata que reforçou Porto após uma troca intensa e não lançou novos ataques. O placar final ficou em 18 a 6.</p>
`,
en:`
<p><code>plano:gpt-6.1-sol@medium</code> won by dominance, finishing with 18 villages to 6 for <code>plano:claude-haiku-5-5@medium</code> after 13 turns. B’s faster expansion created the gap: by turn 3 it held six villages to A’s four, then extended its lead through the final score.</p><h3>Expansion on two fronts</h3><p>Both kings began by taking neutral villages. A captured Santarem and Evora on turn 2 and reached eight villages by turn 5. B took Tarragona and Girona on turn 2, then Zaragoza, Castellon, and Huesca on turn 3. It kept advancing through Pamplona and Teruel, Valencia, Madrid, and Burgos; Murcia brought its total to 14 on turn 8. The village curve records no change in the lead.</p><h3>Different unit choices</h3><p>The records show distinct unit choices: <code>plano:claude-haiku-5-5@medium</code> built 68 spearmen, 10 archers, and 33 knights. <code>plano:gpt-6.1-sol@medium</code> built 34 spearmen, 161 archers, and 2 knights. Neither had invalid turns or rejected orders. In its turn 13 statement, A says it gathered knights before attacking Badajoz; B reports reinforcing Porto after a fierce exchange and launching no new attacks. The final score was 18 to 6.</p>
`},
"E1027-02": {
pt:`
<p>O <code>plano:gpt-6-luna@medium</code> venceu por dominância, com 21 aldeias contra 3 do <code>minimax-m3.1-flash</code> ao fim de 20 turnos. A partida começou equilibrada, mas B abriu vantagem ainda nos primeiros turnos e a ampliou. A curva não registra nenhuma virada de liderança.</p><h3>A vantagem se consolida</h3><p>No turno 3, cada rei tinha cinco aldeias. B chegou a nove no turno 5 e a 11 no turno 7, enquanto A ficou com cinco e depois seis. A conquistou Salamanca no turno 7 e, no turno 9, Coimbra, Toledo e Porto; ainda assim, B manteve a dianteira. No turno 15, o placar era 8 a 16. B terminou com 21 aldeias, três acima do limite de vitória por dominância.</p><h3>Execução e custo</h3><p><code>minimax-m3.1-flash</code> registrou 32 turnos inválidos e construiu 4 lanceiros, 33 arqueiros e 6 cavaleiros. <code>plano:gpt-6-luna@medium</code> teve zero turnos inválidos, 12 ordens rejeitadas e construiu 2 lanceiros e 190 arqueiros. No depoimento do turno 20, B afirma que Sevilha e Santarém eram suas e que reforçava as aproximações a oeste. A duração registrada foi de 95 minutos.</p>
`,
en:`
<p><code>plano:gpt-6-luna@medium</code> won by dominance, finishing with 21 villages to 3 for <code>minimax-m3.1-flash</code> after 20 turns. The match began evenly, but B built a lead in the opening turns and extended it. The village curve records no change in the lead.</p><h3>The lead grows</h3><p>On turn 3, each king held five villages. B reached nine by turn 5 and 11 by turn 7, while A had five and then six. A captured Salamanca on turn 7 and Coimbra, Toledo, and Porto on turn 9; B still held the lead. On turn 15, the score was 8 to 16. B finished with 21 villages, three above the dominance victory threshold.</p><h3>Execution and duration</h3><p><code>minimax-m3.1-flash</code> recorded 32 invalid turns and built 4 spearmen, 33 archers, and 6 knights. <code>plano:gpt-6-luna@medium</code> had zero invalid turns, 12 rejected orders, and built 2 spearmen and 190 archers. In its turn 20 statement, B says Seville and Santarem were under its control and that it was reinforcing the western approaches. The recorded duration was 95 minutes.</p>
`},
"E1028-01": {
pt:`
<p>O <code>plano:claude-opus-5-5@medium</code> venceu por 21 aldeias a 3 em 13 turnos. A vantagem cresceu desde a abertura: enquanto o <code>plano:claude-sonnet-5-5@medium</code> conquistou suas primeiras aldeias no turno 5, o Opus já controlava sete no mesmo turno.</p><h3>Expansão e avanço</h3><p>O Opus tomou Santarém e Évora no turno 2, depois Badajoz e Faro no turno 3. Coimbra veio no turno 4; Sevilha, no turno 5. No turno 6, conquistou Toledo e Córdoba. A partir daí, a diferença aumentou: chegou a 14 aldeias contra 6 no turno 9, quando também tomou Madrid e Castellon, que pertencia ao Sonnet.</p><h3>O fim da partida</h3><p>O Sonnet terminou com três aldeias, mas o depoimento do Opus no turno 13 descreve ataques em direção a Barcelona a partir de Teruel e Zaragoza. O próprio Sonnet dizia que Tarragona estava guardada por um único cavaleiro e que arqueiros marchavam para retomá-la. O placar registra 37 ordens rejeitadas pelo Sonnet e nenhuma pelo Opus; ambos tiveram zero turnos inválidos. Esses dados mostram a diferença na execução, sem revelar por si só o motivo de cada ordem ter sido rejeitada.</p>
`,
en:`
<p><code>plano:claude-opus-5-5@medium</code> won by 21 villages to 3 in 13 turns. Its lead grew from the opening: while <code>plano:claude-sonnet-5-5@medium</code> captured its first villages in turn 5, Opus already controlled seven that turn.</p><h3>Expansion and advance</h3><p>Opus took Santarem and Evora in turn 2, then Badajoz and Faro in turn 3. Coimbra followed in turn 4; Seville in turn 5. In turn 6, it captured Toledo and Cordoba. The gap widened from there: Opus reached 14 villages to Sonnet’s 6 in turn 9, when it also took Madrid and Castellon, which had belonged to Sonnet.</p><h3>The end of the game</h3><p>Sonnet finished with three villages, but Opus’s turn 13 account describes attacks toward Barcelona from Teruel and Zaragoza. Sonnet said Tarragona was held by a single knight and that archers were marching to retake it. The score records 37 rejected orders for Sonnet and none for Opus; both had zero invalid turns. These figures show a difference in execution, though they do not by themselves explain why each order was rejected.</p>
`},
"E1028-02": {
pt:`
<p>O <code>plano:gpt-6-astra@medium</code> venceu <code>gemma-4-31b-it</code> por 19 aldeias a 1 em 11 turnos. A partida se decidiu pela expansão contínua do Astra: assumiu a liderança no turno 2 e chegou a 19 aldeias no turno 10, enquanto a Gemma permaneceu com uma.</p><h3>Uma sequência sem resposta</h3><p>Astra conquistou Santarém e Évora no turno 2. No turno 3, tomou Coimbra, Badajoz e Faro; no turno seguinte, Porto e Sevilha. Toledo caiu no turno 5 e Córdoba no turno 6. Depois vieram Salamanca, Vigo, Madrid e Teruel. No turno 10, Astra conquistou Burgos, Zaragoza e Castellon, fechando a expansão registrada no placar.</p><h3>O contraste no placar</h3><p>A Gemma não aparece com conquistas na lista fornecida e terminou com uma aldeia. Também não construiu unidades; o Astra produziu 68 arqueiros, 19 cavaleiros e 14 lanceiros. A Gemma teve 22 turnos inválidos, contra zero do Astra, embora nenhum dos lados tenha ordens rejeitadas. No depoimento do turno 11, Astra disse que estava consolidando o território e reforçando três posições de fronteira. O placar final permaneceu em 19 a 1.</p>
`,
en:`
<p><code>plano:gpt-6-astra@medium</code> defeated <code>gemma-4-31b-it</code> by 19 villages to 1 in 11 turns. Continuous expansion decided the game: Astra took the lead in turn 2 and reached 19 villages in turn 10, while Gemma stayed at one.</p><h3>An unanswered sequence</h3><p>Astra captured Santarem and Evora in turn 2. In turn 3, it took Coimbra, Badajoz, and Faro; in the next turn, Porto and Seville. Toledo fell in turn 5 and Cordoba in turn 6. Salamanca, Vigo, Madrid, and Teruel followed. In turn 10, Astra captured Burgos, Zaragoza, and Castellon, completing the expansion recorded in the score.</p><h3>The score contrast</h3><p>The supplied capture list records no Gemma conquests, and it finished with one village. Gemma also built no units; Astra produced 68 archers, 19 knights, and 14 spearmen. Gemma had 22 invalid turns, compared with zero for Astra, though neither side had rejected orders. In its turn 11 statement, Astra said it was consolidating its territory and reinforcing three frontier positions. The final score remained 19 to 1.</p>
`}
};
