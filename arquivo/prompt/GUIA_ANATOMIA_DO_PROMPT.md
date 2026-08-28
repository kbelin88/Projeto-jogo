# Anatomia do prompt — o que o Rei realmente recebe

Companheiro de leitura dos ficheiros em `prompts_reconstruidos_1303/`. Mapeia cada bloco do
texto que chega ao modelo para a linha do `engine.js` que o produz e para a flag que o liga.

Partida de referência: **17/08 13:03, Gemini (A) × Nemotron-3-Super-120B (B)**.
Opções usadas pelo `index.html` (linha 2970): `montarVisao(game, lado, { minimos: true })`
e `montarPrompt(visao, { variante: "P2" })`. Nada mais — `rejeicaoNoFim` fica **desligada**
no browser, então as rejeições aparecem no TOPO do relatório, não no fim do prompt.

---

## 1. Como estes prompts foram recuperados (e por que são exatos, não aproximados)

O `.txt` guarda a resposta e nunca o prompt. Mas guarda as **ordens parseadas** de cada
turno (`ordem.construir:` / `ordem.envios   :`, JSON completo, sem corte) e o motor é
determinístico. Então `ferramentas/reconstruir-prompts.js` reexecuta a partida na mesma
sequência do `passoTurnoDuelo` (linha 3012 do `index.html`):

```
tick(game)  ->  montarPrompt para A e B sobre a MESMA fotografia  ->  aplica A  ->  aplica B
```

e fotografa o prompt antes das aplicações. Duas verificações independentes:

1. **Estado contra o replay, turno a turno**: dono e as três contagens de tropa de cada uma
   das 24 aldeias, mais o número de exércitos em trânsito. **0 divergências em 16 turnos.**
2. **Razão chars/token estável**: A entre 2.71 e 2.80, B entre 2.59 e 2.75, ao longo dos 16
   turnos (tokenizadores diferentes, cada um estável). Um bloco a mais ou a menos faria essa
   razão saltar.

E uma terceira, por acaso: o raciocínio do Nemotron no T10 diz
*"total troops: 39 soldiers at home (15 lanceiros, 5 arqueiros, 19 cavaleiros)"*.
O prompt reconstruído do T10 do Rei B tem, textualmente:

```
TOTAL: 39 soldados em casa (15 lanceiros, 5 arqueiros, 19 cavaleiros) + 0 em marcha
```

Um detalhe de fidelidade que valeu a pena replicar: no caminho de **erro de rede** o
`aplicarLado` retorna **antes** de `guardarPlano` (index.html linha ~3000). Logo, num turno
que morreu na rede o `plano` antigo **sobrevive** e reaparece no prompt do turno seguinte.
O script faz o mesmo.

---

## 2. A ordem dos blocos (é a ordem em que o modelo lê)

`montarPrompt` está em `engine.js:1975`. Monta um array `L` e junta com `\n`:

| # | bloco | engine.js | flag | ligado nesta partida |
|---|---|---|---|---|
| 1 | identidade: *"Voce e o Rei..."* | 1988 | — | sim |
| 2 | objetivo: *"conquistar a CAPITAL inimiga"* | 1989 | — | sim |
| 3 | frase das neutras (factual, sem prescrição) | 1998-2002 | `dicaNeutras` | **desligada** (é a versão factual) |
| 4 | `=== REGRAS DE COMBATE ===` | 2005 → 1891 | `variante` P0/P1 | P2 usa o texto padrão |
| 5 | *"defesa efetiva JÁ INCLUI o bônus"* | 2006 | `promptP3` | sim |
| 6 | `=== REGRAS DE ECONOMIA ===` | 2008 → 1941 | — | sim |
| 7 | `=== REGRAS DE MOVIMENTO ===` | 2010 → 1961 | — | sim |
| 8 | velocidades + *"exército misto anda no mais lento"* | 2011 | `promptP3` | sim |
| 9 | *"a defesa que você vê é a de AGORA"* | 2015 | `rotulosExpectativa` | sim |
| 10 | **o relatório inteiro** | 2020 → 1518 | várias | ver §3 |
| 11 | pedido dos dois textos (`plano`, `depoimento`) | 2043-2045 | `resumosDoRei` | sim |
| 12 | *"Responda APENAS com um JSON válido"* | 2048 | — | sim |
| 13 | instrução de processo (use só ids reais) | 2052 | — | sim |
| 14 | **o exemplo JSON ancorado** | 2054 → 1833 | — | sim |
| 15 | rejeições no fim absoluto | 2055-2062 | `rejeicaoNoFim` | **desligada** no browser |
| 16 | `=== A SUA NOTA DO TURNO ANTERIOR ===` | 2065-2070 | `resumosDoRei` | sim (do T2 em diante) |

Repare no efeito da flag 15 estar desligada: as ordens recusadas aparecem no **topo** do
relatório (`engine.js:1611`), não no fim do prompt. A escolha está documentada como H2
("modelos pequenos pesam mais o rabo do prompt") mas o browser não a usa.

---

## 3. Dentro do relatório (`relatorioTexto`, engine.js:1518)

| bloco | linha | o que traz |
|---|---|---|
| `TURNO N` + *"estes números são do TURNO N"* | 1614 | âncora contra citar quantidades velhas |
| `=== ATENCAO: SUAS ORDENS RECUSADAS ===` | 1611 | só aparece se houve rejeição |
| `=== SUAS ALDEIAS (n) ===` | 1670 | uma linha por aldeia |
| ↳ `TOTAL: N soldados em casa (...) + N em marcha` | 1680 | `contagemAgregada` |
| ↳ `FRONTEIRA com [x] / INTERIOR` | 1696 | `marcarFronteira` |
| ↳ `DISPONIVEL PARA ENVIAR AGORA: ...(ataque se enviar tudo: N)` | 1703 | maiúsculas de propósito: é instrução |
| `=== ALDEIAS NEUTRAS (n) - ordenadas por distância ===` | 1741 | + `para tomar AGORA: N lanc ou N arq ou N cav` |
| ↳ `(era X há N turnos)` / `(estável há N turnos)` | 1649-1652 | `deltaDefesa` |
| ↳ `você atacou aqui Nx nos últimos 8 turnos (N conquistas)` | 1655 | `memoriaAlvo` |
| `=== INIMIGO (Rei X) - n aldeia(s) ===` | 1751 | composição visível + defesa efetiva |
| `=== REDE DE ESTRADAS ===` | 1774 | 24 linhas de adjacência, com dono (`redeComDono`) |
| `=== EXERCITOS EM TRANSITO ===` | 1790 | seus e os do inimigo |
| `=== O QUE ACONTECEU NO ULTIMO TURNO ===` | 1809 | eventos do turno anterior |

---

## 4. Onde vão os caracteres (o orçamento do prompt)

Turno 1 do Rei A: **10.687 chars / 120 linhas**. Turno 15: **15.729 / 177**. O que cresce é
o relatório; o preâmbulo de regras é fixo em 2.871 chars.

| bloco | T1 (Rei A) | T15 (Rei A) |
|---|---|---|
| regras (combate + economia + movimento) | 2.871 · **26.9%** | 2.871 · 18.3% |
| SUAS ALDEIAS | 372 · 3.5% | 5.759 · **36.6%** |
| ALDEIAS NEUTRAS | 3.635 · **34.0%** | 75 · 0.5% |
| INIMIGO | 225 · 2.1% | 985 · 6.3% |
| REDE DE ESTRADAS | 1.829 · **17.1%** | 1.718 · 10.9% |
| EXÉRCITOS EM TRÂNSITO | 65 · 0.6% | 1.445 · 9.2% |
| O QUE ACONTECEU | 61 · 0.6% | 773 · 4.9% |
| pedido dos resumos | 433 · 4.1% | 433 · 2.8% |
| instrução de formato + processo | 474 · 4.4% | 474 · 3.0% |
| **exemplo JSON** | **314 · 2.9%** | **318 · 2.0%** |
| NOTA do turno anterior | — | 468 · 3.0% |

Três leituras que importam:

- **A `REDE DE ESTRADAS` é o terceiro maior bloco e é 100% redundante entre turnos** — a
  topologia nunca muda, só os rótulos de dono. 1.8k chars repetidos 16 vezes por Rei.
- **O exemplo custa 2-3% do prompt.** Se ele enviesa, o custo de removê-lo é quase nada em
  tokens; o risco está em outro lugar (§5).
- **A fase inverte-se sozinha**: no T1 o prompt é 34% "lista de neutras"; no T15 é 37%
  "minhas aldeias" e as neutras somem. O modelo lê um documento com uma forma diferente na
  abertura e no fim do jogo, sem nada avisar que a fase mudou.

---

## 5. Sobre remover o exemplo — o que a história do repo já diz

Concordo com a direção (um exemplo é um atrator), mas o repo já pagou por duas lições que
convém não repetir de trás para a frente. Os comentários do `engine.js` registram:

- **`exemploAncorado` (1845-1854)**: o exemplo já foi de quantidades fixas (10 lanceiros /
  5 arqueiros) contra um Rei que tinha 5/4/3 — *"copia = 100% rejeitada"*. Hoje as
  quantidades saem da metade das tropas reais da 1ª aldeia, e o alvo é a primeira **neutra**
  justamente para que um copia-cola não vire ataque suicida à capital.
- **A "permissão de vazio" (2023-2029)**: a frase *"listas vazias são uma resposta válida"*
  congelou o `llama3:8b` em **0.00 envios/turno, 5 de 5 seeds, variância zero** — ele copiava
  a linha do `construir` do exemplo e esvaziava os `envios`. Removê-la destravou para 1.71.

Ou seja: já há prova documentada de que **modelos pequenos copiam o molde**. O que não há é
prova de que os modelos fortes *não* copiem. E olhando esta partida, há um indício
incômodo: o exemplo mostra `{"aldeiaId": N, "tipo": "lanceiro"}` — sempre lanceiro — e o
Nemotron construiu **64 lanceiros contra 9 arqueiros e 21 cavaleiros**.

Isso sugere separar duas coisas que hoje estão no mesmo bloco:

| o que o exemplo faz | precisa de valores? | alternativa sem viés |
|---|---|---|
| ensina o **esquema** (que chaves existem, que tipo tem cada uma) | não | esquema declarado: `construir: lista de {aldeiaId: inteiro, tipo: "lanceiro"\|"arqueiro"\|"cavaleiro"}` — enumera os três tipos, não escolhe um |
| ensina a **escala** (quantas tropas cabem num envio) | é o que ancora | já está no relatório: `DISPONIVEL PARA ENVIAR AGORA` |
| ensina o **alvo** (que id pôr em destinoId) | é o que enviesa | a instrução de processo (2052) já diz de onde tirar os ids |

Três experimentos baratos que separam viés de utilidade, em ordem de custo:

- **E6a** — sortear o `tipo` do exemplo por turno. Se a composição construída seguir o
  sorteio, a monocultura é artefacto do molde. **É o teste mais informativo do lote**, porque
  pode reinterpretar quatro partidas já corridas.
- **E6b** — trocar o exemplo por esquema declarado (sem números), mantendo a instrução de
  processo. Medir: turnos inválidos, rejeições por id inexistente, agência.
- **E6c** — remover o exemplo por inteiro. Medir o mesmo. Esperado: piora nos modelos
  pequenos (já provado) e ideal nos grandes — o que, se confirmado, é ele próprio um achado
  publicável ("o andaime que ajuda o fraco enviesa o forte").

E o par que anda junto com isto, do relatório da partida: **o prompt diz que o objetivo é a
capital, e o motor termina a partida com 75% das aldeias por 2 turnos**. Enquanto essa linha
não for corrigida, qualquer medição de "escolha livre do modelo" está a medir a escolha
livre dentro de um objetivo errado.

---

## 6. Regenerar para qualquer partida

```bash
node ferramentas/reconstruir-prompts.js <partida.txt> <replay.json> <dir_saida>
```

Exige o `.txt` **e** o `replay.json` da mesma partida (o `.txt` dá as ordens, o `.json`
verifica). Imprime a tabela chars/linhas por turno e a verificação; grava um ficheiro por
turno e por Rei. Sem o replay não há verificação — e um prompt reconstruído sem verificação
não vale como evidência.
