# O prompt visto do lado do Rei — pesquisa de 25/09/2026

Pedido do Lucas: *"me ajudar a identificar problemas e melhorias no prompt… a IA não
aproveita as tropas das aldeias iniciais… não concentra tropas, envia ataques pequenos…
que tenha memória e que saiba o resultado das suas ações passadas."*

**Nada de produção foi tocado.** O jogo, o motor e o prompt estão como estavam. Tudo o
que está aqui saiu de medições reproduzíveis (`experimentos/`, ver §11) sobre:

- **as 4 partidas de 23/09** que o Lucas mandou (P1–P4: dots × Super 120B, dots × Ultra
  550B, 120 turnos no total). Os replays não estavam disponíveis, então **reconstruí o
  estado completo de cada turno reexecutando o motor com as ordens gravadas no `.txt`**.
  O resultado bate com as linhas `placar` do log em **todos os 120 turnos das 4 partidas**
  (0 divergências);
- **~7 500 partidas no motor** entre variantes do jogador-base, cada uma isolando um
  comportamento (margem de ataque, uso da retaguarda, fatiamento), com lados trocados;
- **os raciocínios gravados** (218 turnos com raciocínio), contados por tema e lidos à mão.

Não havia chave de API nesta sessão, então **nenhuma proposta foi testada com LLM**. O
§9 traz o protocolo para isso.

---

## 0. Resumo (se só der para ler isto)

1. **As 12 tropas iniciais saem.** Nas 4 partidas os três modelos esvaziam a capital no
   turno 1–2, quase sempre com as 12. A premissa literal não se confirma. O que fica
   parado é **a produção**: cada aldeia gera ~2 tropas por turno, e 50–70% do exército
   vive em aldeias sem vizinho inimigo.
2. **No motor, a retaguarda decide o jogo.** Com tudo o resto igual, levar a produção
   das aldeias de trás para a fronteira faz o jogador vencer **100% contra 0%** a
   versão que a deixa parada. Nenhum outro comportamento testado pesa tanto. **A sua
   intuição está certa quanto à mecânica.**
3. **Ninguém concentra.** O maior ataque de cada turno tem, em mediana, **8–15% do
   exército** nos três modelos. Mandar só metade ou um terço da guarnição (o
   "ataque pequeno") perde **80–83%** das partidas contra quem manda a guarnição inteira.
4. **Nas partidas LLM, o dots vence por não fatiar e por atacar com margem**, e não
   por usar melhor a retaguarda (usa menos que o Ultra). Ele manda a guarnição inteira
   (mediana de 83–100%) com ~1,5× a defesa, e falha 15–32% dos ataques. O Super falha
   35–48%, e o Ultra 23–51%.
5. **Os ataques falham por dois motivos, e cada um tem conserto diferente:**
   - **Super**: **76%** das derrotas (22 de 29) já estavam perdidas quando deu a ordem
     (atacou com 0,12–0,8× a defesa que via). Além disso, planeja o reino como **um só
     exército agrupado por tipo** e reparte-o em envios de várias aldeias ao mesmo
     alvo, que o motor não soma (54% dos ataques numa partida).
   - **Ultra**: 82% das derrotas (28 de 34) **ganhavam na hora da ordem**. A defesa cresceu durante
     a marcha, por **construção** (a aldeia gastou madeira guardada, e o estoque do alvo
     previa isso em 22 de 26 casos) ou por **reforço** que o inimigo ordenou **no mesmo
     turno**. Este último é simultâneo e nenhum prompt o pode mostrar.
6. **Bug no prompt: "your losses: N troops" está errado em 82% das vitórias.** O motor
   põe ali a *força* perdida, não as tropas: o prompt disse 910 tropas perdidas quando
   foram 444. O custo de atacar aparece dobrado, e quadruplicado com cavaleiros.
   Viola a regra de ouro do projeto: *o número que o decisor lê tem de ser o que o motor
   executa*.
7. **A memória de resultados é pobre onde mais importa.** O combate de estrada ganhou
   números em 23/09, mas o de aldeia ainda diz só "DEFEAT". Depois de falhar, o Super
   volta ao mesmo alvo com a **mesma força ou menos em 61%** das vezes, e falha de novo.
8. **Três regras que o motor executa são vagas no P4**, e os modelos gastam raciocínio a
   adivinhá-las em quase todo turno: o alcance do counter (o exército todo ou só uma
   parte?), o atrito (quanto perde quem ganha? o atacante derrotado morre todo?) e o
   que acontece às tropas depois de conquistar.
9. **Proposta**: um P5 com **4 correções de verdade** (bug + 3 regras), **2 acréscimos de
   informação** (combate de aldeia com números, exército inimigo com tamanho e rumo) e
   **2 opções de design para o Lucas decidir** (distribuição do exército; estoque das
   aldeias inimigas visíveis). Nenhuma diz ao Rei o que fazer. Protótipo funcional em
   `experimentos/p5_prototipo.js`, renderizado sobre turnos reais (+800–1 060 chars por
   prompt, com todas as opções).

---

## 1. A pergunta de partida: as tropas iniciais

### 1.1 O que os modelos fizeram com as 12 da capital

| partida | T1, capital do Rei | T2 |
|---|---|---|
| P1 dots (A) | **12 → Santarém** | as 8 sobreviventes seguem para Coimbra |
| P1 Super (B) | **12 → Tarragona** | segue |
| P2 Super (A) | 4 + 4 → as duas vizinhas | +1 +1 |
| P2 dots (B) | **12 → Tarragona** | segue |
| P3 Ultra (A) | 5 → Santarém | 4 → Évora; 4 vão adiante |
| P3 dots (B) | **12 → Tarragona** | segue |
| P4 dots (A) | 5 + 4 → as duas vizinhas | 3 cavaleiros → Badajoz |
| P4 Ultra (B) | 3 + 2 → as duas vizinhas | 6 + 3 |

As 12 iniciais **não ficam paradas** nestas partidas. A medida de 28/08 (34% da força nas
aldeias de partida) veio de partidas de agosto, com outro runner e sem a linha "from here
to your nearest border village" que entrou nesse mesmo dia. Nestas 4 partidas, a fração
nas aldeias de partida é 20–44% (média de toda a partida), e é também ali que a capital
continua a **produzir**.

### 1.2 O que realmente fica parado: a produção

| lado | força média | em aldeias só com vizinhas próprias | tropa de retaguarda que sai, por turno |
|---|---|---|---|
| P1 dots ✅ | 95 | 63% | 15% |
| P1 Super | 76 | 52% | 14% |
| P2 Super | 78 | 68% | 5% |
| P2 dots ✅ | 76 | 58% | 18% |
| P3 Ultra | 73 | 32% | **45%** |
| P3 dots ✅ | 108 | 64% | 10% |
| P4 dots (à frente, interrompida) | 73 | 51% | 23% |
| P4 Ultra | 47 | 34% | **44%** |

O vencedor tem **mais** tropa parada, não menos. Isto é em parte artefato de quem ganha:
mais aldeias significa mais aldeias de interior. Mas também mostra que, **nestas
partidas**, mover a retaguarda **não separou** vencedor de perdedor. O Ultra é quem mais
a move e perde.

---

## 2. O que o motor diz que vale (sem LLM)

Variantes do jogador-base, **iguais em tudo menos numa política**: todas constroem como
o jogador-base e atacam o alvo vencível mais perto. 150 seeds × 2 lados = **300 jogos
por par**. A tabela dá a taxa de vitória da linha contra a coluna.

| | burro | k1,5 ataca | k1,5 PARADA | k1,5 REFORÇA | k3 REFORÇA | REFORÇA, manda 1/2 | REFORÇA, manda 1/3 |
|---|---|---|---|---|---|---|---|
| **k1,5 REFORÇA** | **88%** | **90%** | **100%** | — | **70%** | **80%** | **83%** |
| k3,0 REFORÇA | 85% | 71% | 95% | 30% | — | 93% | 92% |
| REFORÇA, manda 1/2 | 83% | 62% | 92% | 20% | 7% | — | 70% |
| k1,5 ataca | 60% | — | 72% | 10% | 29% | 38% | 33% |
| k1,5 PARADA | 49% | 28% | — | 0% | 5% | 8% | 13% |

*kX = só ataca se a força efetiva prevista (com counter e terreno) for ≥ X × a defesa.
REFORÇA = as aldeias sem vizinho não-próprio mandam tudo para a aldeia de fronteira mais
perto. PARADA = as aldeias de retaguarda nunca se mexem. "ataca" = elas atacam o alvo
mais perto, atravessando o próprio território.*

O que isto diz sobre **a mecânica** do jogo:

1. **Retaguarda que reforça a frente: 100 × 0** contra a retaguarda parada. É a maior
   alavanca do jogo.
2. **Fatiar a guarnição custa caro**: mandar metade ou um terço cai para 17–20% contra
   quem manda tudo. A política "fatiada" imita o LLM.
3. **Margem importa, mas pouco e com teto**: contra o jogador-base, margem 1,0 vence
   41%, 1,5 vence 56% e 2,0 vence 60%. Mas exigir 3× perde para 1,5× (30%). Esperar
   demais é tão ruim quanto atacar sem folga.
4. Perfil da política vencedora: 98% das aldeias de retaguarda se mexem todo turno, e o
   exército fica pequeno (~30 tropas), porque é gasto em território. Os LLM chegam a
   70–100 tropas **estocadas**.

**Limite honesto:** as variantes são omniscientes (o fog é só do relatório; o motor e o
jogador-base veem tudo) e jogam contra o jogador-base e entre si, não contra LLM. Medem o
que a regra premia, não o que um LLM faria.

---

## 3. A concentração: onde o LLM erra

| lado | maior ataque do turno (mediana) | tamanho mediano do ataque | fração da guarnição da origem enviada (mediana) | ataques com < 50% da guarnição |
|---|---|---|---|---|
| P1 dots ✅ | 9% do exército | 5 | 83% | 21% |
| P1 Super | 8% | 3 | **40%** | **56%** |
| P2 Super | 10% | 4 | 64% | 29% |
| P2 dots ✅ | 15% | 7 | **90%** | 7% |
| P3 Ultra | 11% | 5 | 79% | 32% |
| P3 dots ✅ | 9% | 7 | **100%** | 18% |
| P4 dots | 13% | 5 | **100%** | 21% |
| P4 Ultra | 15% | 6 | 89% | 19% |

Dois fenômenos que se somam:

- **Estrutural**: com a economia por aldeia, cada aldeia tem 2–10 tropas. Mesmo mandando
  a guarnição inteira, cada envio é pequeno. Concentrar exige **reforçar uma aldeia de
  preparação e atacar dela no turno seguinte**. É um plano de 2 turnos, que tem de
  sobreviver na nota de 600 caracteres.
- **Fatiamento** (Super, e o Ultra em parte): a guarnição de uma aldeia é repartida por
  2–4 alvos, ou só uma parte sai. O raciocínio do Super no T28 da P1 mostra o mecanismo:
  > *"total spear we can use for Pamplona = 47 (home spears)… We'll send: Pamplona:
  > from Zaragoza 6, Huesca 10, Burgos 2, Girona home 7, Girona marching 6 = total 31
  > troops."*

  Ele planeja o reino como **um só exército agrupado por tipo**, e o `TOTAL: 87 soldiers
  (47 spearman, 13 archer, 27 knight)` do topo do relatório é exatamente esse agrupamento.
  Depois reparte o plano em envios por aldeia, e o motor faz cada um lutar sozinho. Nessa
  partida, **54% dos ataques do Super** saíram em grupos convergentes (várias aldeias ao
  mesmo alvo no mesmo turno). Em 7 desses 9 grupos nenhum envio vencia sozinho, e em 4
  **os envios somados venceriam**: era o ataque que o Rei planejou, desfeito pela regra.
  Nos outros modelos a fração fica em 7–22%, e quase sempre com um envio que já vencia
  sozinho. Noutros turnos o
  mesmo Super escreve *"troops from different villages never add up"*: **conhece a regra
  quando a lê, e perde-a quando planeja.**

---

## 4. Por que os ataques falham

Cada ataque foi classificado com o alvo **como o Rei o via**: o estado do motor depois do
tick e antes das ordens (as ordens são simultâneas, e o inimigo pode tirar tropa do alvo
no mesmo turno). A conta é a `preverCombate`, a mesma do combate:

| modelo | ataques de aldeia que falharam | já perdiam na ordem | ganhavam na ordem, a defesa mudou na marcha |
|---|---|---|---|
| Super (P1+P2) | 29 | **22 (76%)**, com 0,12–0,8× a defesa | 7 |
| Ultra (P3+P4) | 34 | 6 | **28 (82%)** |
| dots (4 partidas) | 26 | 6 | 20 |

**Por que a defesa mudou** (as ~55 que ganhavam na ordem):

| causa | casos | o prompt avisava? |
|---|---|---|
| **construção** durante a marcha | 32 | não. Ex.: Teruel (P3 T11) tinha 90 de madeira e treinou 6 lanceiros no turno do ataque: defesa **8 → 23**. Em **22 de 26** falhas deste tipo contra aldeias de Rei, **o estoque do alvo, antes das ordens, já pagava defesa suficiente** (pior caso: tudo em lanceiros). O prompt não mostra estoque de aldeia inimiga. |
| **reforço** inimigo chegou antes | 21 | **quase nunca podia**: só em **2** destas falhas o reforço já marchava antes da ordem. Nas outras, o inimigo ordenou-o **no mesmo turno** (27 marchas), e as ordens são simultâneas. Nenhum texto o mostraria. Antecipar isto é estratégia: as guarnições das aldeias inimigas vizinhas do alvo, que o Rei vê, são o reforço possível. |
| parou numa aldeia antes do alvo | 1 | a regra está no P4 |

*(Duas correções feitas durante a noite, pelo mesmo motivo: as ordens são simultâneas.
Uma primeira versão dizia "34 ataques com o reforço já a caminho na hora da ordem", e a
conta incluía as marchas que o inimigo ordenou no mesmo turno. E a previsão "ganhava na
ordem" usava o alvo DEPOIS das ordens, quando o inimigo já podia ter tirado tropa de lá.
Os scripts usam agora a fotografia de antes das ordens (`fotografia` em `reexec.js`).)*

A linha que o Rei vê quando há marchas inimigas avistadas continua a gerar dúvida, dezenas
de vezes, mesmo sem ter causado estas derrotas:
> *"This means next turn, the enemy army will be at [8] Toledo, reinforcing it or
> attacking it?"* (Ultra, P3)
> *"Where is it coming from? The report says 'enemy army marching toward [12] Madrid,
> arrives in 2 turns'"* (Super, P1)

---

## 5. O que os modelos não entendem das regras

Contei, por modelo, em quantos turnos o raciocínio volta a cada dúvida. É uma contagem
por regex, com ruído, mas os trechos lidos à mão confirmam os temas:

| dúvida | exemplo real | o que o P4 diz | o que o motor faz |
|---|---|---|---|
| **alcance do counter** (25–40% dos turnos do dots) | *"is the multiplier applied to the whole force or just spearman? … I'll assume the whole force"* | "Having the counter multiplies your force by 1.5" | multiplica a força **toda** |
| **atrito** (na maioria dos turnos com raciocínio) | *"winner takes losses equal to loser's effective force?"*; *"If the winner has fewer troops than the loser's effective force, what happens? It doesn't say."*; *"Let's assume attacker army is destroyed if loses"* | "The winner also takes losses (attrition against the loser's effective force)" | o vencedor perde tropas no valor de **metade** da força efetiva do perdedor, distribuídas pelos tipos; o perdedor morre **inteiro**, também o atacante contra uma aldeia; o defensor que segura perde pela mesma conta |
| **depois da conquista** | *"troops stay there?"*, *"become the garrison?"* | nada | os sobreviventes **ficam** como guarnição da aldeia tomada |
| **tempo entre aldeias próprias que não a fronteira mais perto** | *"Castellon to Teruel: let's assume 1 turn"*; *"Let's assume Badajoz to Sevilha is 1 fast turn"* | só para a fronteira mais próxima | (propositadamente fora: ver §8) |

Um detalhe que vale ouro: o Super raciocinou certo, e sozinho, a consequência mais
importante do atrito.
> *"Actually losses are based on loser's effective force, not dependent on winner's
> size. So winner always loses same amount regardless of size?"*

É **a** razão matemática para concentrar: um exército maior paga o mesmo pela vitória e
não arrisca perder tudo. O P4 esconde o 0,5 e o "perdedor morre inteiro", e com isso
esconde o argumento.

---

## 6. O bug: "your losses: N troops"

`resolverCombate` (`engine.js:980`) calcula `baixasForca = fracao × Fatk`, que é **poder
de ataque**, não tropas. O `eventoTextoEN` (`engine.js:2240`) escreve-o como
`(your losses: ${ev.baixasForca} troops)`. O legado PT tem o mesmo erro (`engine.js:1730`).
O combate de estrada está certo: usa `baixasVencedor`, que conta tropas reais.

Medido nas 4 partidas (`bug_baixas.js`):

- **183 de 223** vitórias de ataque (82%) reportaram o número errado;
- soma dita **910**, soma real **444**. O prompt dobra o custo aparente de atacar;
- com cavaleiros (ataque 4) o erro chega a 4×: *"enviou 2 cavaleiros → o prompt diz
  'your losses: 4 troops', perdeu de fato 1"*; *"3 cavaleiros → diz 2, perdeu 0"*;
- também erra para baixo: *"4 lanceiros → diz 2, perdeu 3"* (o arredondamento do
  `aplicarBaixas`).

Não é questão de gosto. É o tipo de erro que o CLAUDE.md §6 diz ter mordido três vezes:
*o número que o decisor lê tem de ser o que o motor executa.* E empurra na direção errada:
faz atacar parecer mais caro do que é, o que favorece guardar tropa em casa.

---

## 7. A memória: o Rei aprende com o que fez?

O Rei tem três memórias: o `plan` (600 caracteres, escrito por ele), o bloco
`WHAT HAPPENED LAST TURN` (só o último turno) e o contador por alvo *"you attacked here 5x
in the last 8 turns (0 conquered)"*.

O que se mede quando um ataque falha e o Rei volta ao mesmo alvo em ≤4 turnos:

| modelo | voltas | com **mais** força efetiva | com igual ou **menos** | a volta ganhou |
|---|---|---|---|---|
| Super | 23 | 9 | **14 (61%)** | 4 |
| Ultra | 34 | 21 | **13 (38%)** | 18 |
| dots | 30 | 24 | 6 (20%) | 17 |

A frase que o P4 dá para a derrota é `You attacked [13] Teruel: DEFEAT (your army was
lost)`. Não diz **por quanto** ficou aquém, e esse é justamente o número de que um Rei
precisa para corrigir. O combate de estrada recebeu isso em 23/09 (`relatoEstrada`). O de
aldeia, que nestas partidas é ~13× mais frequente (340 contra 27), ficou para trás.

Com o protótipo, a mesma linha no mesmo turno (P3, T12, Rei A) fica assim:

```
- You attacked [13] Teruel with 2 spearmen, 2 knights (effective force 10 vs its defense 23):
  DEFEAT. Your whole army was destroyed; the defenders lost 2 troops (7 left).
- You attacked [15] Murcia with 11 spearmen (effective force 11 vs its defense 25):
  DEFEAT. Your whole army was destroyed; the defenders lost 2 troops (8 left).
- You attacked [14] Burgos with 4 archers, 1 knight (effective force 18 vs its defense 13):
  VICTORY, conquered. You lost 1 troop; 4 troops stay there as its new garrison.
```

(o P4 disse "your losses: **4** troops" em Burgos. Foi **1**.)

---

## 8. As propostas: um P5

Critério do projeto: **"o prompt informa, não recomenda."** Cada item está classificado:

- 🔧 **correção de verdade**: o P4 omite ou erra algo que o motor executa. Entra sem
  debate, mas muda o benchmark (atrás de flag, como manda §5.4);
- ➕ **informação que o motor já sabe e o Rei não vê**, sem quebrar o fog;
- ⚖️ **decisão de design do Lucas**: mexe no fog, ou fica perto da fronteira entre
  informar e sugerir.

| # | tipo | o quê | evidência | custo em texto |
|---|---|---|---|---|
| **P5-0** | 🔧 | **bug das baixas**: `baixasForca` → tropas reais | §6: 82% errado, 2× em média | 0 |
| **P5-1** | 🔧 | "multiplies your **WHOLE army's** force by 1.5 (every troop in it, not only the countering type)" | §5: dúvida em 25–40% dos turnos do dots, e resolvida por palpite | +50 chars |
| **P5-2** | 🔧 | a regra exata do atrito: perdedor destruído (**também o atacante contra aldeia**); vencedor perde tropas no valor de **metade** da força efetiva do perdedor, **o mesmo seja qual for o tamanho do vencedor**; defensor que segura perde igual | §5: a dúvida mais frequente; muitos palpites errados | +330 chars |
| **P5-3** | 🔧 | "When an attack conquers a village, the surviving attackers stay there as its new garrison." | §5 | +100 chars |
| **P5-4** | ➕ | **combate de aldeia com números**, como o de estrada: tropas enviadas, força vs defesa, baixas reais, o que resta. Também quando o Rei é o **defensor** ("King B attacked YOUR [2] Evora with … : REPELLED. You lost 2 troops (5 left)") | §7: voltar com igual ou menos força 61% (Super); "DEFEAT" hoje não diz por quanto | +80 chars por combate |
| **P5-5** | ➕/⚖️ | exército inimigo avistado com **origem, composição e intenção**: *"enemy army of 3 spearmen, 15 archers, 3 knights from [1] Santarem marching to [7] Salamanca - THEIR OWN village (a reinforcement) - arrives in 1 turn"* | §4: **fraca** para derrotas (só 2 reforços eram visíveis na ordem); forte como dúvida recorrente ("reinforcing or attacking?", "where is it coming from?") | +70 chars por exército |
| **P5-6** | ⚖️ | uma linha sob o TOTAL: *"at home: 75 in INTERIOR villages (no enemy neighbour), 17 in BORDER villages"* | §2: a alavanca nº 1 do motor; §1.2: 50–70% do exército no interior | +70 chars |
| **P5-7** | ⚖️ | estoque das aldeias **inimigas visíveis**: *"… \| stock: wood 90, iron 80"* | §4: previa 22 de 26 falhas por construção (alarme de pior caso: tocaria em 36% dos ataques que venceram) | +30 chars por aldeia inimiga visível |

**P5-5, a parte "⚖️"**: a *intenção* (reforço, ataque ou neutra) é só a leitura do dono
do destino, que o Rei já vê, então é ➕ puro. A *composição* é que é design: hoje o fog
deixa ver que um exército vem, mas não quanto traz. As vigias veem a coluna chegar e não a
contam? Pode-se dar só o **total** ("an army of 21 troops") como meio-termo.

**P5-6, por que ⚖️**: é um espelho, não um conselho, e não diz "mova". Mas foi escolhido
porque o motor mostrou que é a alavanca. Um leitor rigoroso pode dizer que escolher o
espelho já é sugerir. Minha leitura: o `INTERIOR`/`BORDER` já está em cada linha, e isto só
**soma o que já está lá**, como o `TOTAL` já soma por tipo. O risco oposto também existe:
o `TOTAL` por tipo alimenta o "reino = um exército", e este espelho mostra onde esse
exército de fato está.

**P5-7, por que ⚖️**: mostra estado inimigo que hoje é invisível. É o maior acréscimo de
informação da lista, e o que mais pode mudar o jogo.

Tamanho do P5 completo (as 8 propostas) sobre 6 turnos reais: **+794 a +1 059
caracteres** (~+250 tokens, ~+7% de um prompt de 11–15 mil caracteres).

### O que eu NÃO proponho, e por quê

- **"Envie a guarnição inteira" / "reúna tropas antes de atacar" / um mínimo
  pré-calculado.** Instrução estratégica. Mudaria o que se mede (o degrau 3 é
  justamente descobrir isso).
- **Tempo de marcha em cada aresta da ROAD NETWORK.** Já foi tentado e revertido em
  28/08, pelo arredondamento (três arestas de "1t" não somam 3). Continua certo. Se
  faltar tempo entre pares de aldeias próprias, a forma segura é uma tabela por **rota
  inteira** (`turnosDeCaminho`), e isso custa caro em texto. Ficou fora.
- **Tirar o `TOTAL` por tipo** para desfazer o "exército único". É tentador pelo §3, mas
  a evidência é de um modelo só. Medir antes (§9).
- **Mais história em `WHAT HAPPENED`.** O contador por alvo já dá memória longa. Com o
  P5-4, o último turno passa a ter o dado que faltava. Crescer o bloco pesa no prompt, e
  o lfm já mostrou que o raciocínio cresce com ele.

---

## 9. Como testar isto (quando houver cota)

O prompt não se testa no motor. Proposta de bateria A/B, no formato do projeto
(`SPEC_TESTES_HEADLESS_<data>.md` + `DIARIO.md`):

- **Par fixo**: dots × Super 120B (o par com mais partidas: comparável com 23/09).
- **Seeds 3 e 5** (as de 23/09), **os dois assentos**, **P4 e P5** → 8 partidas, ~20–30 h
  de relógio no free-tier. Os P4 de 23/09 já existem: são 4 das 8.
- **Uma flag por vez seria o ideal**, mas custa 4× mais. Ordem sugerida: primeiro
  **P5-0..P5-4 juntos** (verdade + feedback), depois cada ⚖️ isolado.
- **Métricas** (todas com script pronto em `experimentos/`, e as 4 partidas de 23/09 como
  linha de base):

| métrica | script | o que se espera se o P5 funcionar |
|---|---|---|
| ataques que já perdiam na ordem | `falhas.js` | ↓ sobretudo no Super (P5-1, 2, 4) |
| voltar ao alvo com ≤ força | `memoria.js` | ↓ (P5-4) |
| fração da guarnição por ataque | `fatia.js` | ↑ (P5-2: o atacante derrotado morre todo) |
| envios convergentes | `convergentes.js` | ↓ no Super (P5-4 mostra cada um a morrer sozinho) |
| retaguarda que sai | `retaguarda.js` | ↑ só se o P5-6 entrar |
| taxa de vitória | — | **não** é a métrica principal: 8 partidas não dão para ela |

### A sonda (pronta, validada, à espera de cota)

Antes da bateria, uma sonda de **minutos**: a **mesma decisão** pedida com o P4 e com o
P5, em turnos reais onde um modelo errou, e cada resposta avaliada pelo motor. Compara
ordens, não partidas. O gabarito existe antes de perguntar.

```bash
cd pesquisa/2026-09-25/experimentos
node sonda_casos.js /tmp/casos.json 3 resultados/p4-bateria-0923/*.txt   # 30 turnos-teste
node sonda_p5.js /tmp/casos.json --seco        # valida o avaliador (sem rede)
node sonda_p5.js /tmp/casos.json --burro       # valida o caminho inteiro (sem rede)
node sonda_p5.js /tmp/casos.json openrouter:dots-studio/dots-3-note-preview:free --n 3 --saida /tmp/sonda
```

- **Os turnos-teste** (`sonda_casos.js`): até 3 por (modelo, categoria), nas 4 partidas.
  São 30 casos em 4 categorias: `ja_perdia` (ordenou um ataque que já perdia),
  `reforco_visivel`, `apos_falha` (o turno em que o relato da derrota chega) e
  `retaguarda_parada` (≥20 tropas atrás e moveu <10%).
- **A avaliação** (`sonda_comum.js`), por resposta: JSON válido; ataques que já perdiam;
  ataques contra reforço visível; grupos convergentes; fração da guarnição enviada;
  retaguarda movida. Depois, **o turno seguinte a sério**: executa a ordem avaliada mais
  a ordem **real** que o inimigo deu nesse turno (está no `.txt`), corre o tick e conta
  vitórias e derrotas.
- **Validada sem rede**: no modo `--seco` (responde com a ordem que o Rei de fato deu), o
  avaliador reproduz o turno seguinte da partida real em **30 de 30** casos. Essa
  partida real é reexecutada por outro caminho, com todas as ordens do log. O modo
  `--burro` passa o caminho inteiro (prompt → JSON EN → parser → avaliação) com 100% de
  JSON válido.
- **Custo**: 30 casos × 2 prompts × 3 respostas = 180 chamadas, ~1–3 h no free-tier com
  o dots (mais rápido em paralelo com outro modelo). O teto é de 1000/dia.
- **O que diz se o P5 funciona**: queda de "já perdiam" em `ja_perdia` e `apos_falha`,
  subida da "guarnição enviada", queda dos grupos convergentes no Super, e mais V/D no
  turno seguinte. Com 3 respostas por caso e temperatura 0, parte da variância é do
  provedor. Vale correr `--temp 0.7` também.

---

## 10. Caminhos além do texto

1. **Corrigir o P5-0 já, mesmo sem P5.** É um bug de verdade. Mas muda o texto que o
   modelo lê, então entra atrás de uma flag (`baixasReais`), e ela vai para as listas
   "desligadas" do `test_lote_c`/`test_lote_e`.
2. **Acrescentar ao evento de combate de aldeia os campos que o protótipo cria**
   (`atkTropas`, `defTropasAntes`, `baixasTropas`). São aditivos e não mudam texto
   nenhum. Servem para o `.txt`, para o `analisar-log.js` e para o replay, mesmo antes
   do P5.
3. **A logística como mecânica, não como prompt.** O problema de fundo pode ser de
   **banda**: com 8–12 aldeias, o Rei dá ordens de envio a 1–5 delas por turno (13–41%
   das aldeias; o Ultra chegou a 53% numa partida). Um humano automatiza a logística ("ponto de reunião"). Uma ordem
   permanente do tipo *"a aldeia X manda o que produzir para Y"* acabaria com a tropa
   parada. **Mas** mede-se hoje exatamente essa agência (MODELOS_ARENA: *"o que separa
   modelos é AGÊNCIA"*), e automatizá-la apagaria o sinal. Fica como pergunta para o
   Lucas: o benchmark quer medir **estratégia** ou **gestão**?
4. **Um gabarito humano.** Tudo aqui compara LLM com LLM e com o jogador-base. Um
   jogador humano (ou um jogador-base "humano": REFORÇA + guarnição inteira + margem
   1,5, que vence 88% do burro) daria a régua de "o que é jogar bem" nesta mesa. O
   `experimentos/variantes.js` já tem essa política pronta, e ela pode entrar em
   `engine.js` como segundo jogador-base.

---

## 11. Como reproduzir

Tudo em `experimentos/`, lendo o `.txt` de uma partida (sem replay: o motor é
reexecutado a partir das ordens, e `reexec.js` confere contra cada `placar`).

| script | mede |
|---|---|
| `reexec.js <partida.txt>` | reconstrói e confere a partida (base de todos os outros) |
| `medir.js` | força, tropa parada, taxa de falha, razão força/defesa |
| `falhas.js` | cada ataque: previsível na ordem, ou a defesa mudou na marcha |
| `mudou.js` | por que mudou: construção, reforço, parou antes |
| `estoque.js` | o estoque do alvo previa a construção? |
| `retaguarda.js` | tropa de retaguarda que sai, alvos por turno, maior ataque |
| `banda.js` | aldeias que dão ordem por turno |
| `fatia.js` | fração da guarnição enviada em cada ataque |
| `convergentes.js` | envios de aldeias diferentes ao mesmo alvo |
| `memoria.js` | depois de falhar: volta com mais força? |
| `bug_baixas.js` | "your losses" contra as tropas realmente perdidas |
| `raciocinio.js`, `trechos.js` | dúvidas de regra nos raciocínios; trechos por regex |
| `variantes.js`, `variantes2.js`, `perfil.js` | as políticas do §2 no motor |
| `p5_prototipo.js <partida.txt> <turno> <A\|B> <dir>` | o P4 e o P5 do mesmo turno, lado a lado |
| `sonda_casos.js`, `sonda_p5.js`, `sonda_comum.js` | a sonda P4 × P5 do §9 |

As saídas desta noite estão em `experimentos/saidas_partidas.txt` e
`experimentos/saidas_motor.txt`. Os prompts renderizados **não** vão para o git (mesma
regra dos `prompts-reconstruidos` de 28/08). Regeneram-se com o `p5_prototipo.js`.

**Limites**: 4 partidas, 3 modelos, e o dots vence todas. Parte do que separa o dots pode
ser só o modelo. As variantes do motor são omniscientes. Nenhuma proposta foi vista por
um LLM.
