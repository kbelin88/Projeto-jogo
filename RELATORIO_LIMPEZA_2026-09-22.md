# Relatório da limpeza — 22/09/2026

O que se fez nesta sessão, porquê, e o que ficou medido. Quinze commits, suíte
verde em todos, e o jogo conferido a correr no navegador a cada passo.

**Resumo em um número:** o `index.html` passou de **6386 para 3551 linhas**
(−44%), e dessas 2835 linhas que saíram, **1031 eram desenho que nenhum caminho
do jogo atingia desde 11/09**.

---

## 1. Por onde isto começou

O pedido foi "uma análise profunda do código e depois as correções". A análise
(`arquivo/relatorios/ANALISE_CODIGO_22-09.md`) encontrou sete frentes; esta
sessão fechou as que restavam — os passos 3 a 7 — e corrigiu, pelo caminho,
**cinco defeitos que ninguém tinha visto** porque todos falhavam em silêncio.

O método foi o mesmo do resto do projeto: **nada se corrige antes de virar um
número**. Cada secção abaixo tem a medida que motivou a mudança e a medida que a
confirmou.

---

## 2. Passo 3 — uma só cena de batalha

A bancada `sonda3d/encontro.html` tinha **841 linhas** com o guião completo da
batalha: formação, flechas, golpes, tombos e uma debandada. O `sonda3d/batalha.js`
tinha o mesmo guião outra vez, e era esse que corria no jogo.

Afinava-se um e o outro ficava para trás. O sintoma concreto: **a debandada
viveu na bancada dias depois de a cena do jogo já aniquilar o perdedor**, que é
o que o motor faz de verdade — no `resolverCombateEstrada` o perdedor sai inteiro
do trânsito, sempre.

A bancada deixou de saber lutar. Move duas marchas pelo `mapa3d` e, quando se
encontram, emite o **mesmo evento `combate_estrada`** que o motor emite. O que se
vê ali é, linha por linha, o que se vê numa partida. Ficou com 160 linhas.

> **Medido na bancada, a passo fixo:** 2 marchas / 24 figuras → cena de 17
> figuras com as colunas fora do desenho → rescaldo com 11 caídos, 0 de pé, e o
> vencedor a marchar outra vez com as baixas descontadas.

---

## 3. Passo 5 — o mapa antigo saiu (e levou três mentiras com ele)

### 3.1 O desenho morto

O mapa 3D é o default desde 11/09, e o `draw()` saía na primeira linha desde
então. Atrás desse `return` ficaram a ilha, o mar, as estradas, 380 bosques, 24
aldeias, uma grelha de coordenadas e o véu do fog.

Medi por **alcance a partir do `draw`**, não por leitura: 35 funções, **1031
linhas**, que nenhum caminho do jogo atingia.

Saiu também o sistema de **efeitos de mapa**. Durante onze dias continuou a
encher uma lista de estandartes a plantar e choques em duas batidas, e a pedir
quadros ao navegador para os animar, **sem nada disso chegar ao ecrã**. Não dava
erro nenhum. É o mesmo modo de falha do `mapa-ajustes.js` a dar 404 e do ruleset
por checkbox: uma coisa que corre e não se vê.

O `?mapa=2d` deixou de existir. Se o forno faltar, o jogo **diz e pára** — não há
mapa de reserva, e fingir que há era pior do que a falha.

### 3.2 As três coisas que liam uma câmara parada

Aqui está o achado que justifica sozinho a limpeza. Havia código vivo — que
ninguém suspeitava — a medir posições com a **câmara do canvas plano**, que
ninguém mexe desde 11/09. Ela está parada no sítio onde a página abriu.

| o que | o que fazia | medido depois |
|---|---|---|
| o balão do rato (hover) | com a câmara 3D sobre **Barcelona**, dizia **"Lisboa"** | 6 de 6 aldeias certas |
| o enquadramento de gravação | punha um `scale` que nenhum pixel obedece | 24 de 24 aldeias no quadro |
| a tabela `videos/aldeias_tela.txt` | dava as posições de um mapa invisível — **as flechas dos Shorts cairiam ao lado das aldeias** | idem |

Os três passaram a ler a câmara verdadeira (`M3D.ecraDoMundo`).

### 3.3 E dois defeitos de projeção, que teriam mordido no vídeo

1. **A câmara tem amortecimento e leva ~2 s a assentar.** Quem enquadrasse e
   perguntasse logo a seguir — que é exatamente o que a ferramenta de vídeo faz —
   lia a moldura **a meio do movimento**: o centro do mapa caía em `y=897` num
   ecrã de 800 px.
2. **`project()` usa a `matrixWorldInverse`, que só é recalculada dentro do
   `render`.** Projetar depois de mexer a câmara e antes do quadro seguinte dava
   a posição **anterior**. Um quadro de atraso não se vê no rato; vê-se numa
   tabela que manda nas flechas de um vídeo.

3. Um terceiro, de robustez: **um ecrã de 0×0 envenenava a câmara para sempre.**
   `aspect = 0/0` é NaN, a matriz de projeção fica NaN, e nada a recalcula quando
   o ecrã volta a ter tamanho. Acontece com um separador escondido ou um painel
   encolhido.

### 3.4 O editor de mapa

Arrastava cidades e curvava estradas **no canvas plano**, e gravava
`mapa-ajustes.js` — coordenadas de viewBox que só o desenho 2D lia. O mapa que se
joga vem do forno, que não sabe da existência desse ficheiro, e o próprio desenho
das alças já estava morto desde 11/09. Era uma barra com cinco botões que não
faziam nada.

O que o substitui já existe e já se usa: o **caderno de marcas** (tecla M).

Os botões `+` e `−` do canto também não faziam nada — chamavam um `zoomAt` que
mexia o `scale` do mapa invisível. Agora aproximam e afastam a câmara a sério
(medido: 1992 m → 1532 → 2589).

> ⚠ O caderno de marcas quase foi junto: os `mouseup`/`mousemove` que fecham um
> risco viviam **dentro** do bloco do editor. Ficaram, sozinhos e com o porquê
> escrito.

### 3.5 4,4 MB descarregados a cada abertura

Medido antes: **33 pedidos de rede** ao abrir o jogo, **13 deles (4,4 MB)** para
um desenhador apagado — a arte da ilha, a textura de água, onze sprites do kit,
os dois brasões e a mata do `mata.json`.

Medido depois: **20 pedidos, 0 do mapa plano.**

---

## 4. Passo 4 — os módulos, e porque só dois

O plano falava em cinco módulos. Medi a **fronteira** de cada um antes de lhe
tocar — o que importa de fora e o que exporta — e o resultado mudou o plano:

| candidato | linhas | importa | extraído? |
|---|---|---|---|
| `marcas.js` — o caderno de marcas | 534 | **4** | sim |
| `ponte3d.js` — a porta entre motor e mapa | 91 | **4** | sim |
| clientes de API | 457 | **35** | não — virou o Passo 6 |
| crónica | 100 | 20 | não |
| cartão pós-partida | 108 | 21 | não |
| transmissão v5 | 391 | 39 | não |

Mover os quatro últimos não seria mover código: seria **inventar uma interface**.
E cada interface inventada é um sítio onde se mete um bug — na véspera de correr
partidas, era mau negócio.

O corpo dos dois extraídos **não foi reescrito**. Os nomes de dentro continuam
`M3D`, `game`, `IB`, `draw`, agora variáveis do módulo que um `sincronizar()`
mantém em dia. É por isso que o diff é legível.

### O que o `ponte3d.js` guarda

É a única porta entre a partida e o desenho, e três regras da casa vivem nela:

1. **o fog é o MESMO do prompt** (`visiveisPara` + `game.visto`) — se divergirem,
   o mapa mente ao espectador, que é o pior caso: a narração passaria a contar
   outra partida;
2. **a marcha é a do MOTOR** (`posicaoRota`, peso de rota, nunca pixéis);
3. **a composição vai INTEIRA** — achatá-la punha doze arqueiros numa coluna de
   lanceiros.

### O modo de falha que isto cria, e como se tranca

Um adaptador com esboço de reserva + um `<script src>` que dá 404 **em silêncio**
= o jogo abre, nada estoura, a suíte fica verde, e a ferramenta deixou de
existir. Sem cuidado, os cinco smokes que fazem `eval` do `index.html` passariam
**verdes a cobrir zero linhas** do que saiu.

Passaram a carregar os módulos (como já faziam com o `engine.js`), e o
**`Smoke12modulos.js`** confere as duas pontas de cada um.

O `Smoke5fog` e o `Smoke8estrada` deixaram de extrair a ponte do HTML com
expressão regular e passaram a **correr o módulo**: deixa de haver uma cópia do
código a ser testada.

---

## 5. Passo 6 — um só cliente de OpenRouter

A dívida estava escrita no `CLAUDE.md` desde agosto. O problema não era a
duplicação: era as duas cópias **saberem coisas diferentes**.

Em 17/08 três partidas morreram porque o cliente adivinhava a espera de um 429
por backoff em vez de honrar o `Retry-After`. O browser foi corrigido — espera o
**maior** entre o pedido do provedor e o backoff, com teto de 45 s. **O `rei.js`
não.** Um mês depois:

| | browser | runner (antes) |
|---|---|---|
| honra o `Retry-After` | sim | **não** |
| insiste | 9 vezes | 6 |
| lê do corpo | `retry_after_seconds` | `retryDelay` |
| conta throttles | sim | **não** |

O último ponto importa para o benchmark: sem contar throttles, **um modelo que
precisa de cinco tentativas por turno parece igual a um que responde de
primeira**.

> ⚠ Isto **muda o comportamento do runner**, de propósito. A regra nova já estava
> medida e documentada; o que estava errado era este lado não a ter.

Ficam de cada lado, porque mudá-los mexeria no que já foi medido: o **ritmo**
(browser 300 ms, runner 3 s) e a **insistência** (9 e 6).

> **Provado com chamada real** pelo runner (`lfm-2.5-2.6b:free`): resposta
> "pronto", 72 tokens, `finish stop`, 0 throttles, 4,9 s.

### O bug que eu proprio meti, e a cegueira que o escondeu

Vale contar porque e a licao mais util do dia. O `const _or = ClienteOR.criar({...})`
ficou **acima** das declaracoes de `TETO_ALTO_LLM` e `tetoPorModelo`, que o
literal de opcoes le. Avaliar aquilo ali e um `ReferenceError` na **zona morta
temporal**: o script morria a meio, `game` ficava `null`, e o jogo abria **sem
partida nenhuma**.

O que o tornou invisivel: no Node dos testes o `ClienteOR` **nao existia** — os
smokes ainda nao o carregavam —, o adaptador caia no ramo de reserva, e o literal
nunca chegava a ser avaliado. **Trinta testes e treze smokes verdes, jogo morto
no navegador.** Foi exatamente o modo de falha que o `Smoke12modulos` nasceu para
apanhar, e eu tinha deixado o terceiro modulo de fora dele.

Duas correcoes, nao uma: o cliente passa a nascer **a pedido** (quando a pagina ja
carregou inteira), e os cinco smokes passaram a carregar tambem o `clienteor.js`.

E a regra que fica: **conferir que o global existe nao e conferir que o jogo
corre.** Depois de extrair um modulo, abrir e jogar.

### E um teste que mentia

A extração do `Smoke8estrada` tinha um `[\s\S]*?` ganancioso. Quando o
`continue;` que lhe servia de âncora mudou de ficheiro com o cliente, o trecho
saltou de **21 mil para 75 mil caracteres**, apanhou `e.` de meio ficheiro e
**inventou catorze campos em falta que não existiam**. Passou a ter limite.

---

## 6. Passo 7 — varrer o resto

**Runners mortos (1030 linhas):** `eval_validador.js` (Fase 12),
`exp_prompt_tropas.js` (o prompt v3, que o P4 substituiu), `eval_endurecimento.js`
(varredura do V0) e `exp_perseveracao.js` (H1/H2 de julho, contra modelos 3B no
Ollama que já não jogam). Ficou o `medir_contexto.js`: é a guarda de regressão do
truncamento silencioso do Ollama.

**Branches: de 16 locais para uma.** As 15 mescladas viviam em `main` há meses. As
4 experiências fechadas **não foram apagadas e sim etiquetadas** (`exp/<nome>`),
portanto os commits continuam lá e acham-se pelo nome. As branches **remotas
ficaram como estavam** — apagar coisa no GitHub é decisão do Lucas.

**Disco:** `mapa_montanhas.glb` + `.json`, **45 MB que nenhum ficheiro
carregava**. A `montanhas.html` lê a biblioteca (`montanhas.glb`), não o mapa
inteiro. As montanhas não se perderam: quem as faz é o
`ferramentas/cena/montanhas.py` e a decisão está no `MONTANHAS.md`, os dois no
git. `sonda3d/` passou de **157 MB para 111 MB**.

**`sonda3d/LEIA-ME.md`** (novo) diz, ficheiro a ficheiro, o que está no git, o que
é saída de forno, quem precisa de cada um e o comando que os coze.

**O README** mandava abrir o `index.html` com duplo clique (quebra em `file://`),
correr um runner apagado, e contava "10 testes + 5 smokes" quando são 30 + 13.

**O `CLAUDE.md`** mandava quem chega para o `world.js`, o `?mapa=2d` e o editor de
mapa.

---

## 7. A conta

| | antes | depois |
|---|---|---|
| `index.html` | 6386 linhas | **3551** |
| `rei.js` | 633 | 580 |
| ficheiros novos | — | `marcas.js`, `ponte3d.js`, `clienteor.js` |
| testes | 30 + 11 smokes | 30 + **13** smokes |
| pedidos de rede ao abrir | 33 (4,4 MB de arte morta) | **20** |
| `sonda3d/` em disco | 157 MB | **111 MB** |
| branches locais | 16 | **1** |

Os cinco defeitos corrigidos pelo caminho — o hover a mentir, o enquadramento de
gravação, a tabela de posições do vídeo, o amortecimento da câmara e a projeção
sem render — **tinham todos a mesma causa**: código a falar com uma câmara que
já não existia. Nenhum deles dava erro. Foi por isso que sobreviveram onze dias.

---

## 8. As partidas de prova

O pedido era correr **a mesma partida dos modelos de hoje de manhã, até ao turno
100**, para haver tempo de acontecerem batalhas nas estradas. Correram três
coisas, e a segunda é a que responde à pergunta.

### 8.1 A tentativa com os dois modelos de manhã — parou sozinha no T19

`liquid/lfm-2.5-2.6b:free` × `inclusionai/ling-3.0-flash-fin:free`, seed 7.

A partida **congelou no turno 19**: A com 5 aldeias e 7 tropas, B com 7 aldeias e
75 tropas, e **zero exércitos em trânsito dos dois lados**. Ficou assim, turno
após turno. Não houve uma única batalha de estrada, e não ia haver: sem ninguém
a marchar, não há onde os exércitos se cruzarem.

A causa está medida:

- do turno 5 em diante, **34 respostas vazias em 23 turnos**, todas com
  `finish = length`;
- o `lfm` gasta os **8192 tokens inteiros a pensar** e devolve string vazia;
- **não é o nosso teto**: ele aprendeu 61579 pelo HTTP 400 do próprio modelo. É o
  **provedor** que corta em 8192;
- **o orçamento de raciocínio não salva**: com `REASONING_MAX_TOKENS=1500` o
  primeiro turno ainda deu 8192 de raciocínio e `finish length`. Este provedor
  ignora o pedido — não é um botão nosso.

A sonda de 3 turnos da manhã não previa nada disto: ali ele respondeu **6 de 6
com envios**. É a lição de 19/08 outra vez, com outra cara — **sonda curta não
prevê partida longa**, porque o prompt cresce e o raciocínio cresce com ele.

A partida parada ficou guardada como prova
(`resultados/p4-partida-0922/PARADA_sem_orcamento_lfm_x_ling_seed7.txt`) e a
`MODELOS_ARENA.md` foi atualizada: o `lfm` não volta a partida longa.

### 8.2 Duas partidas que correram até ao fim — e **nenhuma chegou ao turno 100**

Trocado o `lfm` pelo `dots-studio/dots-3-note-preview:free` (o outro modelo
sondado hoje que respondeu 4 de 4 com envios), contra o mesmo
`inclusionai/ling-3.0-flash-fin:free`. Teto de 100 turnos nas duas.

| | seed 7 | seed 3 |
|---|---|---|
| acabou no turno | **18** | **19** |
| como | vitória de A por **domínio** (75%, 2 turnos) | idem |
| placar | A 19 × B 2 | A 19 × B 5 |
| envios de A | 52 (198 tropas) | 72 (342 tropas) |
| envios de B | **12** (52 tropas) | **15** (74 tropas) |
| latência mediana | 89 s/turno | 91 s/turno |
| respostas vazias | 17 em 36 | 14 em 38 |
| **combates de estrada** | **0** | **0** |

**O teto de 100 turnos nunca foi usado**: as duas acabaram antes do turno 20,
pela regra de domínio. Subir o teto não dá mais tempo a uma partida que termina
por vitória.

### Porque não houve batalhas de estrada — a causa, medida

Um combate de estrada precisa de **dois exércitos no mesmo troço**. Contei quantos
exércitos cada Rei teve na estrada, turno a turno:

| | exércitos-turno na estrada | turnos com ALGUM exército fora |
|---|---|---|
| A (dots) | 59 / 85 | 18 de 18 / 19 de 19 |
| B (ling) | **13 / 15** | **7 de 18 / 6 de 19** |

**O Rei B passa dois terços da partida sem um único exército fora de casa.** Não é
que os dois se desencontrem: é que um deles quase nunca sai. Com um lado parado,
a probabilidade de cruzamento vai a quase zero — e o que se vê no log confirma-o:
27 combates de estrada... **de assalto a aldeia** (`COMBATE [id]`), nenhum
`COMBATE-ESTRADA`.

É o velho **entesouramento** com outra cara. A diferença agora é que está medido
num número que se pode seguir de partida para partida: *exércitos-turno na
estrada, por Rei*.

### 8.3 O controlo burro × burro, 100 turnos — **55 batalhas de estrada**

Mesma seed, mesmo mapa, sem API. Serve para responder a outra pergunta, que é a
que interessa ao sistema: **as batalhas de estrada funcionam de ponta a ponta?**

| | |
|---|---|
| turnos | acabou no **17** — por eliminação, não por limite |
| placar final | A **22** aldeias, B **0** |
| **combates de estrada** | **55** |
| no replay `.json` | os mesmos 55, com os 27 campos |

E todos com a semântica certa do motor — **o perdedor sai inteiro**:

```
COMBATE-ESTRADA no trecho [2] Evora-[5] Faro: A (ia [2] Evora->[4] Badajoz)
  vs B (ia [4] Badajoz->[5] Faro) Fatk=2 (ef 2) Fdef=7 (ef 7) vant=0
  -> vence B | exercito de A ANIQUILADO (2S) | vencedor perdeu 0
```

### 8.4 E um evento real abre mesmo uma cena no mapa

Peguei no **primeiro combate de estrada dessa partida de 100 turnos** e meti-o no
jogo pela porta de sempre — o log do motor. A ponte converteu-o e o mapa abriu a
cena:

| | |
|---|---|
| convertido para | `evora → faro` |
| vencedor / perdedor | B / A |
| composição aniquilada | 2 lanceiros — **a mesma do evento do motor** |
| cenas no mapa | 0 → **1** |
| figuras na cena | **16** |

É o caminho inteiro provado com dados reais: motor → `ponte3d.js` →
`mapa3d.js` → `batalha.js`.


---

## 9. O que fica para amanhã

Três coisas saíram desta noite e nenhuma é código:

1. **O teto de turnos não é o botão certo para ver batalhas de estrada.** As duas
   partidas acabaram por domínio antes do turno 20. Se o objetivo é filmar
   choques na estrada, o que falta não é tempo — é os **dois** lados marcharem.
2. **`exércitos-turno na estrada, por Rei`** é a métrica que faltava. Separa
   "não se encontraram" de "um deles nunca saiu de casa", e o segundo é o que
   está a acontecer (B: 13 e 15, contra 59 e 85 de A).
3. **A sonda de 3 turnos não prevê partida.** O `lfm` respondeu 6 de 6 na sonda e
   congelou a partida no T19. Já tinha sido dito em 19/08; agora tem um segundo
   caso e uma causa nomeada (o raciocínio cresce com o prompt até bater no teto
   do provedor).

E uma quarta, sobre o jogo: a **cena de conquista de aldeia** continua por fazer
no mapa 3D — o combate de estrada tem cena, o assalto a aldeia ainda não. Está no
`PLANO_BATALHAS_E_ALDEIAS.md`, e os 27 assaltos por partida que estas duas
produziram mostram que é o evento mais frequente do jogo.

---

## 10. Os ficheiros desta noite

```
resultados/p4-partida-0922/
  dots_x_ling_seed7_t100.txt          + .replay.json   (18 turnos, A vence 19x2)
  dots_x_ling_seed3_t100.txt          + .replay.json   (19 turnos, A vence 19x5)
  burro_x_burro_seed7_t100.txt        + .replay.json   (17 turnos, 55 combates de estrada)
  PARADA_sem_orcamento_lfm_x_ling_seed7.txt            (a que congelou no T19)
```

O replay do burro é o que vale a pena abrir: **55 batalhas de estrada** para ver
a cena nova a funcionar.
