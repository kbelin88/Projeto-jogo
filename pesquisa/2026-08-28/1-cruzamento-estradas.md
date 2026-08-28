# ITEM 1 — exercitos se cruzam na estrada sem lutar

## O sintoma

Assistindo replay em camera lenta (0.125x/0.25x), dois exercitos inimigos
passam um pelo outro visualmente e seguem viagem, sem combate.

## Reproducao

Nao ha um comando de "reproduzir o bug" no sentido classico — o motor e
determinista e os replays gravados ja contem o fenomeno. Os dois scripts
abaixo, rodados sobre os 53 `.replay.json` de `resultados/`, provam e medem
os dois mecanismos encontrados:

```
node pesquisa/2026-08-28/experimentos/varredor-cruzamento-estrada.js
node pesquisa/2026-08-28/experimentos/verificar-estradas-cruzadas.js
```

## Causa raiz — DUAS causas, de pesos muito diferentes

O motor **tem** combate de estrada (`cruzaramNaEstrada`, engine.js:1355) e ele
funciona: 72 eventos `combate_estrada` gravados em 16 das 53 partidas. A
pergunta certa nao e "o mecanismo existe?", e "por que ele nao pega tudo?".

### Causa 1 — amostragem discreta (H1 da spec): RARA, nao e o driver principal

`cruzaramNaEstrada` roda uma vez por turno, sobre a posicao NO FIM do turno.
Para provar se dois exercitos podem se cruzar ENTRE duas amostras sem nunca
coincidir numa amostra, escrevi uma reproducao fiel de
`posicaoRota`/`cruzaramNaEstrada` (copiada linha a linha de engine.js:1194-1380,
comentada com a origem) e testei, para cada par inimigo-inimigo de cada
transicao de turno, se o teste e falso no INICIO do tick, falso no FIM do
tick, mas VERDADEIRO em algum ponto estritamente no meio (subamostrado em 40
passos). Essa combinacao e a prova precisa de "a amostragem perdeu um
cruzamento real".

**Resultado, nos 39 replays validos (>=2 turnos) de `resultados/`:**

| | valor |
|---|---|
| pares inimigo-inimigo x transicao de turno testados | 5451 |
| ja cruzados no inicio do tick (consistencia) | 2 |
| vao cruzar no fim do tick (normal, o motor pega) | 78 |
| **perdidos no meio do tick (H1 provado)** | **1** |

Um caso em 5451. **H1 e real, mas e desprezivel como causa do que o Lucas
esta vendo.** (O caso unico: `P3_lightning_vs_lightning_seed3_30t`, turno
29->30, exercito de 3 aldeias de distancia cruzando com um de 2, no trecho
Toledo-Zaragoza/Burgos — ver `achados-cruzamento-estrada.json`.)

> Nota de metodo: cheguei a essa reproducao fiel depois de DUAS tentativas
> erradas (ver DIARIO.md). A primeira (casar o mesmo movimento entre dois
> frames) era cega para o caso mais comum de colisao (dois exercitos que se
> resolvem no MESMO turno em que se cruzam) e achou so 1 cruzamento em 760
> pares. A segunda (projetar 1 tick e medir distancia x,y entre as cordas)
> achou 621 "cruzamentos", mas a maioria era **falso positivo**: exercitos de
> lados opostos convergindo na MESMA ALDEIA por ESTRADAS DIFERENTES —
> comportamento CORRETO do jogo (cada um briga com a guarnicao da aldeia via
> `resolverChegada`, nao um com o outro). So a terceira versao, usando a
> logica EXATA de `cruzaramNaEstrada` (que ja exige o MESMO trecho) em vez de
> proximidade no mapa, deu um numero defensavel.

### Causa 2 — estradas DIFERENTES que se cruzam no desenho do mapa: A CAUSA REAL

Esta nao estava nas 4 hipoteses da spec — apareceu ao investigar por que H1
dava um numero tao baixo.

`cruzaramNaEstrada` exige que os dois exercitos estejam no **mesmo par de
cidades** (`lo,hi`). Mas o mapa da Iberia e "MST + k vizinhos + N travessias"
(CLAUDE.md secao 2) — um grafo com atalhos, **nao um grafo planar**. Nada no
codigo garante que duas ESTRADAS DIFERENTES nao se cruzem geometricamente no
desenho.

Verifiquei as 41 estradas contra si mesmas (segmento a segmento, incluindo os
2 trechos com curva) e **2 pares de estradas diferentes se cruzam de fato no
mapa**, bem no meio de cada uma (nao na ponta):

| estrada 1 | estrada 2 | cruzam em | ponto (x,y) |
|---|---|---|---|
| cordoba-madrid | teruel-toledo | 75% de cordoba-madrid / 62% de teruel-toledo | (846, 604) |
| burgos-toledo | madrid-salamanca | 52% de burgos-toledo / 62% de madrid-salamanca | (740, 496) |

As duas ficam no eixo central do mapa (Toledo/Madrid), que o proprio
CLAUDE.md ja descreve como o mais trafegado. Isso importa: **e exatamente
onde a disputa entre os dois reis mais acontece.**

Um exercito de A em `cordoba->madrid` e um de B em `teruel->toledo` podem
passar PELO MESMO PIXEL da tela ao mesmo tempo — e `cruzaramNaEstrada` nunca
os compara, porque as chaves de trecho (`cordoba|madrid` vs `teruel|toledo`)
sao diferentes por construcao. **Isso nao e uma falha de timing (como H1): e
SEMPRE perdido, nao importa a frequencia de amostragem**, porque o par nunca
seria testado, mesmo com amostragem continua.

**Medido nos 53 replays:** 17 ocorrencias, em 6 partidas diferentes, de
exercitos inimigos ocupando as duas estradas de um par cruzado no MESMO
turno (`achados-estradas-cruzadas.json`). Conferi manualmente duas: em
`G2_dots_vs_120b_seed2` turno 13, o exercito de A esta a 50% do caminho
cordoba->madrid (cruzamento em 75%) enquanto B esta a 50% do caminho
teruel->toledo (cruzamento em 62%) — mesma vizinhanca, mesmo turno. Em
`N1_..._seed1` turno 11, B esta a exatos 50% de burgos->toledo, a 2 pontos
percentuais do cruzamento (52%).

## Opcoes

**Opcao A — rotear as 2 estradas para nao se cruzarem (mexer no `via` de
uma delas).** Baixo custo (so `world-iberia.js`, so o campo `via` de UMA das
quatro estradas por par — 2 edicoes). **Risco:** o CLAUDE.md proibe
explicitamente mexer em `world-iberia.js` sem lote proprio ("Nao tocar:
topologia/custos do world-iberia.js"); e um `via` cosmetico, nao custo, mas
ainda assim e a regra escrita. Tambem nao resolve o CASO GERAL — so os 2
cruzamentos ja achados; se o mapa mudar no futuro, o problema pode voltar sem
aviso (nao ha teste que trave isso).

**Opcao B — detectar cruzamentos GEOMETRICOS entre estradas diferentes no
motor, e tratar como uma 3a familia de combate** (alem do "mesmo trecho" e do
"chegada simultanea na mesma aldeia"). Resolve o caso geral, inclusive se o
mapa mudar. **Custo:** maior — precisa de uma tabela pre-calculada de pares de
estradas cruzadas (calculavel 1x, como o script `verificar-estradas-cruzadas.js`
ja faz) e uma extensao de `detectarCombatesEstrada` para testar esses pares
tambem. Toca `engine.js`, arquivo central. **Risco:** e exatamente o tipo de
mudanca de regra que pede o formato "uma flag por vez" do CLAUDE.md, e testes
novos na suite (os 2 pares cruzados viram casos de teste fixos).

**Opcao C — nao mexer no jogo; travar com um TESTE que falha se um mapa
futuro introduzir estradas cruzadas.** O mais barato (so um teste, tipo
`verificarEquilibrio()`), mas nao resolve o comportamento ATUAL — so evita
piorar. Serve como complemento de A ou B, nao como solucao sozinha.

**Sobre H1 (amostragem):** dado que a taxa e 1 em 5451, **nao recomendo
investir em consertar isso agora** — o retorno e desprezivel perto do
cruzamento geometrico.

## Recomendacao

**B, com C como rede de seguranca.** A6 e a unica opcao que resolve a causa
REAL (nao um sintoma de mapa especifico) e sobrevive a qualquer edicao futura
do mapa. E mais trabalho, mas e o unico caminho que nao deixa a mesma classe
de bug voltar se o Lucas ou outro agente mexer no `world-iberia.js` depois.
A e mais rapida mas so tapa os 2 casos de hoje — se o Lucas preferir o
conserto rapido, A + C (o teste de trava) e um meio-termo razoavel: conserta
o que se sabe, e AVISA se aparecer de novo.

## Como provar que ficou resolvido

1. Rodar `verificar-estradas-cruzadas.js` de novo: 0 pares de estradas
   cruzadas (se optar por A ou C), OU
2. Rodar uma bateria nova e conferir, nos replays gravados, que toda
   ocorrencia de exercitos inimigos nos dois lados de um cruzamento GEOMETRICO
   gera um evento de combate (se optar por B) — o mesmo script serve, so
   trocando a pergunta de "quantas vezes NAO houve combate" para "quantas
   vezes nao houve, apos o conserto" (deve dar zero).
3. Suite verde (29 testes + 7 smokes + `verificarEquilibrio()=0`) continua
   valendo depois de qualquer uma das tres opcoes.
