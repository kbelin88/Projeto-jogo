# REVISAO (Opus, 28/08) — correcoes ao RESUMO.md

Revisao independente da pesquisa do Sonnet. **Nao aceitei os numeros: refiz as
contas por fora, com metodo proprio.** Dois itens mudam de conclusao.

O trabalho de base e bom (metodo honesto, becos sem saida registrados, suite
verde, nada de producao tocado). As correcoes abaixo sao sobre CONCLUSOES, nao
sobre honestidade.

---

## ITEM 1 — a "causa real" apontada NAO se sustenta

O relatorio afirma que a causa do que o Lucas ve sao **duas estradas que se
cruzam geometricamente** (`cordoba-madrid` x `teruel-toledo`, `burgos-toledo` x
`madrid-salamanca`), com "17 ocorrencias medidas".

### O que eu testei

As 17 ocorrencias so medem **"os dois exercitos estavam em algum lugar das duas
estradas no mesmo turno"** — nao que tenham passado um pelo outro. Calculei a
distancia REAL de cada exercito ao ponto de cruzamento, nas 17:

```
resumo: 0 ocorrencia(s) com AMBOS perto (<40px) do ponto de cruzamento; 17 nao.
```

**Zero de 17.** O par mais proximo ficou a 69px um do outro. O proprio
relatorio mostra o dado que o contradiz — "A esta a 50% do caminho (cruzamento
em 75%)" — mas o suaviza como "mesma vizinhanca, mesmo turno". Nao e a mesma
vizinhanca: e a metade do caminho contra tres quartos.

Depois varri TODOS os pares inimigo-inimigo com subamostragem (24 passos por
tick), medindo a distancia minima entre os dois ao longo do tick. **Os pares de
estrada cruzada nunca produziram nem uma aproximacao.**

### Conclusao correta

O achado estrutural **e verdadeiro e vale registrar**: as duas estradas se
cruzam de fato, e se dois exercitos estivessem no cruzamento ao mesmo tempo o
motor NAO os testaria (a chave de trecho e diferente por construcao). Mas isso
e um **bug latente — nunca observado em 53 replays**, nao a causa do sintoma.

### O que a evidencia realmente aponta

Varredura completa, 5451 pares x transicao de turno, medindo distancia minima
na tela (limiar 45px ~ raio de sprite):

| categoria | casos | o que e |
|---|---|---|
| chegam a <=45px SEM combate | 305 | o que o Lucas veria como "passaram e nao lutaram" |
| — mesmo DESTINO | 280 | **jogo certo**: convergem na aldeia e brigam com a guarnicao, um de cada vez |
| — mesmo TRECHO | 3 | **o motor deveria ter pego** |
| — trechos e destinos diferentes | **22** | **os candidatos reais** |

Dos 22, amostrei 20 e **18 compartilham uma ALDEIA no caminho dos dois**. O
padrao dominante nao e cruzamento em campo aberto: e **um exercito chegando a
uma aldeia enquanto o inimigo PASSA POR DENTRO dela** (passa reto porque a
aldeia e dele — MOTOR #4 so para em aldeia que nao e sua). Os dois ficam no
mesmo ponto da tela; o que chega briga com a guarnicao, o que passa segue.

Testei tambem um invariante mais limpo: como o motor resolve os cruzamentos
ANTES de gravar o frame, nenhum frame gravado deveria conter um par que
satisfaz `cruzaramNaEstrada`. Achei **2 em 527 frames** — os dois com o inimigo
recem-emitido (`turnosRestantes === turnosTotal`), ou seja, criado DEPOIS de
`avancarMovimentos` ter rodado. Sao reais, mas raros.

**Veredito do item 1:** a prioridade muda. O alvo nao e rotear duas estradas —
e decidir o que acontece quando um exercito **atravessa uma aldeia propria com
inimigo em cima dela**. Isso e uma decisao de REGRA (exercito em transito
guarnece? pode ser interceptado?), nao um conserto de geometria.

---

## ITEM 3 — a premissa do Lucas se sustenta; o relatorio mediu outra coisa

O relatorio conclui que **"a premissa nao se sustenta"**, porque
interior->fronteira e a categoria mais comum de reforco (43.6%).

O problema: o Lucas falou em **"aldeias iniciais"**. O relatorio mediu
**"INTERIOR"** (sem vizinho inimigo). **Nao e a mesma coisa** — uma aldeia
conquistada no meio do mapa, longe da frente, e INTERIOR mas nao e inicial.

Medi o que ele descreveu — capital + anel 1 (as tres primeiras aldeias de cada
rei), em turnos com combate:

| fase | fracao da forca parada nas aldeias INICIAIS |
|---|---|
| inicio | 39.0% |
| meio | 31.6% |
| **fim** | **32.4%** |
| geral | **34.1%** |

**Um terco do exercito fica nas tres aldeias de partida a partida inteira** — e
quase nao cai do inicio para o fim (39% -> 32%), quando a frente ja se mudou
para o meio do mapa. **A observacao do Lucas esta certa.**

A causa raiz que o relatorio encontrou (H3: o prompt so mostra tempo de marcha
para ALVOS, nunca para aldeia-propria -> aldeia-propria; o bloco ROAD NETWORK
nao tem peso nenhum) **continua valida e bem evidenciada** — e a melhor parte
do trabalho. So a conclusao "a premissa esta errada" e que cai.

---

## ITENS 2 e 4 — sem correcao

Nao refiz as medidas de tela, mas o metodo esta certo: rodou o jogo de verdade
e mediu com `getBoundingClientRect()` em larguras controladas, em vez de opinar
sobre o CSS. Os numeros (1627px fixos; sobreposicao real de 5px em 1280x720;
ponto de ruptura em 725px de altura) sao do tipo que so sai de medida, nao de
leitura. Aceito.

A unica ressalva e de forma: o relatorio 2 diz "causa provada" e mais abaixo
admite que nao conseguiu testar a troca de monitor. As duas coisas convivem (o
que esta provado basta), mas o campo "estado" no RESUMO deveria dizer
**"causa provada para o layout; troca de monitor nao testada"**.

---

## Ordem revista

1. **Item 3** — inalterado como primeiro. A causa e boa e o conserto e barato.
   So corrigir a linha do RESUMO que diz que a premissa nao se sustenta.
2. **Itens 2+4** — inalterados.
3. **Item 1** — muda de natureza: nao e mais "rotear duas estradas", e decidir
   a regra do exercito que atravessa a propria aldeia com inimigo em cima.
   Continua sendo o que mais precisa de decisao do Lucas antes de codigo.

---

# ADENDO — a pergunta do Lucas sobre animacao (28/08)

> "voce verificou se existe alguma animacao para quando as tropas se encontram
> nas estradas, porque nunca vi isso acontecer em nenhuma partida"

Verifiquei. **A pergunta reescreve o item 1 pela terceira vez — e desta vez a
resposta explica o sintoma inteiro.**

## Os combates de estrada ACONTECEM nas partidas que voce assistiu

| partida | turnos | combate_estrada | combate de aldeia |
|---|---|---|---|
| **G1_dots_vs_120b_seed1** | 19 | **5** | 48 |
| **G2_dots_vs_120b_seed2** | 40 | **11** | 93 |

Nas 23 partidas com >=5 turnos: **16 tiveram combate de estrada**, 7 nao. A
proporcao tipica e de **1 combate de estrada para cada 8 a 26 de aldeia**.

Ou seja: nas duas partidas do video, dezesseis choques de estrada foram
resolvidos pelo motor. Voce assistiu as duas, em camera lenta, e nao viu
nenhum.

## A animacao existe — e e quase invisivel de proposito

`registrarEfeitosTurno` (index.html:2631) empurra um efeito para
`combate_estrada`: `{x, y, t0, cor: COR[vencedorDono]}`. Sem `plantar`, sem
`dano`, sem `conq` — entao ele cai no **anel generico** do fim do laco de
desenho (index.html:4126): um circulo que expande e esmaece, `EFEITO_DUR` de
**900 ms**, espessura `cs*0.08`, alpha caindo de 0.9 a 0.

E so isso. Compare com o que uma conquista de aldeia ganha: estandarte
plantando (340 ms), torre pegando fogo (1800 ms), bandeira derretendo,
numeros rolando no topo — uma coreografia de varios segundos, documentada em
index.html:2640-2646.

## E ele e excluido de TODOS os outros canais de atencao

Encontrei tres exclusoes, todas pela mesma condicao `e.tipo !== "combate"`:

| canal | linha | o que faz | combate_estrada entra? |
|---|---|---|---|
| **camera automatica** | index.html:2354 | escolhe `alvoCam` e aponta a camera | **NAO** |
| **cronica do espectador** (paineis laterais, replay) | index.html:2334 | uma frase-icone por evento | **NAO** |
| **cronica de jogo** (`cronicaEventos`) | index.html:2594 | painel de quem agiu | **NAO** |
| **log .txt da partida** (`registrarEventosTurno`) | index.html:3098 | linha COMBATE/REFORCO | **NAO** |

**O combate de estrada nao aponta a camera, nao entra em nenhum painel, e nao
sai no .txt.** Ele existe so como um anel fino de 900 ms, num ponto qualquer
do mapa, enquanto a camera automatica esta apontada para outro lugar — para a
aldeia que foi atacada no mesmo turno.

Some-se a isso que ele acontece em media **1 a cada 8-26 combates de aldeia**,
e o resultado e exatamente o que voce relatou: nunca ver um.

## O que isso faz com o item 1

**O sintoma "tropas se cruzam sem lutar" tem uma explicacao muito mais simples
e muito mais provavel do que qualquer bug de motor: elas LUTAM, e o jogo nao
mostra.**

Isso nao anula os dois achados anteriores — eles continuam de pe, mas mudam de
tamanho:

- os 22 casos de encontro perto de aldeia compartilhada (adendo acima):
  **continuam reais**, e agora sao a unica parte que talvez seja mesmo motor;
- as duas estradas que se cruzam: **continuam bug latente**, nunca observado;
- a amostragem discreta: 1 em 5451, desprezivel.

**Recomendacao revista para o item 1, e ela inverte a ordem do conserto:**

1. **Primeiro, dar visibilidade ao combate de estrada** (barato, so
   `index.html`, nenhuma regra muda): incluir `combate_estrada` no alvo da
   camera, na cronica lateral e no `.txt`, e dar a ele um efeito com peso
   proprio — nao o anel generico. **So depois disso da para julgar se ainda
   falta combate**, porque hoje nao ha como saber pela tela.
2. Depois, com o combate visivel, rodar as partidas que o Lucas ja ia rodar e
   marcar os turnos. Com o efeito na tela e a linha no `.txt`, marcar vira
   trivial — e a lista dele passa a poder ser cruzada com os eventos gravados.
3. So entao decidir a regra do exercito que atravessa a propria aldeia.

> Nota para o Lucas: o plano de marcar turno e aldeias continua otimo, mas
> vale fazer **depois** do passo 1. Hoje, marcar "onde nao houve luta" e
> impossivel de conferir contra o replay — o `.txt` nao registra combate de
> estrada, entao nao ha o que comparar. Com o passo 1 feito, cada marcacao sua
> tem um evento correspondente (ou a ausencia dele vira prova).
