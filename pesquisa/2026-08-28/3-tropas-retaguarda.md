# ITEM 3 — os reis nao levam tropas da retaguarda para o front

## O sintoma

A certa altura da partida, os modelos deixam tropas paradas nas aldeias
iniciais enquanto a disputa acontece no meio do mapa.

## A premissa parcialmente errada, e a pergunta que ela vira (ja na spec)

O Lucas tambem pediu para o modelo "saber a diferenca entre aldeia inimiga e
neutra" — mas o prompt P4 **ja faz isso**, com secoes separadas
(`NEUTRAL VILLAGES` / `ENEMY (King X)`) e a etiqueta `INTERIOR (no enemy
border)` / `BORDER with [...] (enemy)` em toda aldeia propria
(engine.js:2254-2258). Confirmado de novo aqui, lendo o prompt reconstruido
de verdade (ver secao seguinte). A pergunta certa nao e "falta informacao",
e **por que o modelo nao age sobre ela**.

## Reproducao / medida

```
node pesquisa/2026-08-28/experimentos/medir-retaguarda.js
```

Repete a MESMA regra de fronteira/interior do prompt (engine.js:2254-2258),
sobre os 53 replays de `resultados/`.

## O que a medida mostrou — e ela CONTRADIZ parte da premissa

**Medida 2 (para onde vao os reforcos aldeia-propria -> aldeia-propria — 952
ordens medidas):**

| direcao | quantidade | fracao |
|---|---|---|
| **interior -> border (retaguarda -> frente)** | **415** | **43.6%** |
| border -> border | 278 | 29.2% |
| interior -> interior | 256 | 26.9% |
| border -> interior (recuo) | 3 | 0.3% |

**Interior -> border e a categoria MAIS COMUM.** Os modelos, na maioria das
vezes que reforcam alguma aldeia propria, mandam para a fronteira, nao para
o interior. **Isso contradiz a leitura literal de "os modelos deixam as
tropas nas aldeias iniciais e nunca as movem"** — eles movem, na maior parte
das vezes que decidem mover algo.

**Medida 1 (fracao da forca de um rei parada em aldeias INTERIOR, em turnos
com combate acontecendo em algum lugar do mapa — 864 amostras):**

| fase do jogo | media |
|---|---|
| inicio (0-33% dos turnos) | 56.0% |
| meio (33-67%) | 56.5% |
| fim (67-100%) | 50.4% |
| **geral** | **53.8%** |

Mais da metade da forca de um rei fica, em media, em aldeias sem fronteira
com o inimigo, durante turnos de combate — **mas isso e estavel ao longo do
jogo inteiro**, nao concentrado numa "certa altura" como a descricao
sugeria.

### Por que os dois numeros nao se contradizem — achado qualitativo

Reconstrui os prompts reais de uma partida P4-EN (`G2_dots_vs_120b_seed2`,
25/08 — `ferramentas/reconstruir-prompts.js`, sem editar nada). No turno 13,
o Rei A tem **12 aldeias, e as 12 sao INTERIOR** — nenhuma faz fronteira com
o inimigo ainda:

```
=== YOUR VILLAGES (12) ===
[0] Lisboa - YOUR CAPITAL | INTERIOR (no enemy border) | ...
[1] Santarem | INTERIOR (no enemy border) | ...
[2] Evora | INTERIOR (no enemy border) | ...
... (todas as 12, todas INTERIOR)
```

**Um reino inteiro pode ser "interior" simplesmente porque ainda esta
expandindo para dentro de territorio neutro e ainda nao tocou o inimigo.**
Nesses turnos, "tropa parada no interior" nao e negligencia — e que **nao
ha fronteira nenhuma para onde mandar**. Isso explica parte (nao
necessariamente toda) da Medida 1: o numero mistura reinos genuinamente sem
frente ainda com reinos que JA tem fronteira e ainda assim deixam tropa
parada atras dela.

## Causa raiz confirmada (H3 da spec, com evidencia de codigo)

O prompt mostra tempo de marcha pre-calculado (`march from [x]: N slow / N
medium / N fast turns`) **so para aldeias ALVO** (neutras e inimigas —
`marchaTexto`, engine.js:2199-2202, chamada em 2284 e 2309, dentro dos loops
de `NEUTRAL VILLAGES` e `ENEMY`). **Nunca e chamada dentro da secao `YOUR
VILLAGES`** — conferido lendo o codigo E o prompt reconstruido (nenhuma linha
de "YOUR VILLAGES" tem tempo de marcha).

O bloco `ROAD NETWORK` (que O prompt manda o modelo consultar: "See the ROAD
NETWORK block in the report") e **topologia pura**, so lista de vizinhos:

```
=== ROAD NETWORK (armies march along these roads; the geography never changes) ===
[0] Lisboa (yours): [1], [2]
[1] Santarem (yours): [0], [3], [5]
```

**Nenhum peso, nenhum custo, nenhum numero de turnos por trecho.** Um modelo
que queira saber "quantos turnos ate reforcar a aldeia de fronteira X a
partir da minha aldeia interior Y" nao tem esse numero em lugar nenhum do
prompt — teria de reconstruir o caminho mais curto sozinho, a partir so da
lista de adjacencia, e ESTIMAR o custo sem nenhum dado de peso. Isso e
exatamente o tipo de raciocinio espacial multi-hop que o proprio projeto ja
identificou como fragil em modelo pequeno
(`ferramentas/alucinacao-espacial.js`, E9).

**H1 (informacao enterrada) e H2 (falta a acao) NAO se sustentam**: a
etiqueta INTERIOR/BORDER aparece logo no INICIO da linha de cada aldeia (nao
enterrada), e a regra de reforco ja e dita como mecanica explicita no prompt
(linha 40 do reconstruido: "You may also send troops to a village YOU
already own..."). **H3 e a causa que a evidencia sustenta.**

**H4 (e so capacidade do modelo, nao prompt)** fica em aberto — nao consegui
comparar DeepSeek R1 contra os modelos `:free` dentro do orcamento desta
pesquisa (os replays de R1 disponiveis sao poucos e a maioria de partida
antiga, prompt legado). Fica como pergunta para quando houver mais partidas
de R1 em P4.

## Opcoes

**Opcao A — mostrar o tempo de marcha tambem para pares aldeia-propria ->
aldeia-propria** (nao so para alvos). Muda `relatorioTextoP4` para chamar
`marchaTexto`-like tambem na secao YOUR VILLAGES, com a origem sendo a
aldeia MAIS PROXIMA da fronteira (ou de um destino especifico — a decidir).
**Custo:** baixo-medio, so `engine.js` (a funcao ja existe, e chamar em mais
um lugar). **Risco:** aumenta o tamanho do prompt (mais uma linha por
aldeia); testar se cabe no orcamento de contexto dos modelos menores.

**Opcao B — mostrar o peso de cada trecho no bloco ROAD NETWORK.** Ex.:
`[0] Lisboa (yours): [1] (2 turns), [2] (3 turns)`. **Custo:** baixo, so
formatar o numero que ja existe (`estradas.custo`) no lugar que ja existe.
**Risco:** o mesmo de A — mais texto por prompt. Mais generico que A (serve
para qualquer par, nao so ao alvo mais proximo).

**Opcao C — nao mexer no prompt agora; so confirmar com mais dados se a
Medida 1 realmente indica neglicencia ou e, na maior parte, o efeito
"reino ainda sem fronteira" que o turno 13 mostrou.** Mais barato (so
analise), mas adia a decisao.

**Lembrete de projeto (da propria spec):** o prompt **informa, nao
recomenda** — nenhuma das opcoes deve sugerir "mande tropa para a
fronteira", so tornar o CUSTO e a DISTANCIA visiveis, do jeito que ja e feito
para alvos.

## Recomendacao

**B primeiro, depois medir de novo.** E a mudanca mais barata, mais
generica, e reaproveita um numero que o motor ja calcula — so nunca foi
escrito no bloco de rede. Se depois de B a Medida 1 nao mudar muito, o
diagnostico vira mais para H4 (capacidade) ou para o efeito "sem fronteira
ainda" (que nao e bug, e so precisa ser separado do numero antes de julgar).

## Como provar que ficou resolvido

1. Rodar uma bateria nova (mesmos modelos de antes, para comparar) e repetir
   `medir-retaguarda.js` — comparar a Medida 2 (fracao interior->border)
   ANTES e DEPOIS da mudanca de prompt.
2. Separar, na proxima medida, os turnos em que o rei TEM pelo menos uma
   aldeia BORDER dos turnos em que e 100% interior (como o turno 13 do
   achado) — a Medida 1 fica mais justa comparando so contra kingdoms que
   JA tem fronteira.
3. Suite verde continua valendo (o prompt P4 tem 39 casos de teste dedicados,
   `testes/test_prompt_p4.js` — qualquer mudanca de texto precisa passar por
   eles, e provavelmente precisa de casos novos para a linha adicionada).
