# O mapa dos EUA (`world-usa.js`) — 11/11/2026

O segundo mapa do jogo, para **quatro Reis**. Este documento diz o que o mapa é,
porque é justo, e o que falta para se jogar nele. Ver a rede:

```bash
node ferramentas/desenhar-rede.js usa pesquisa/rede-usa.svg
```

## 1. O que é

| | Ibéria | EUA |
|---|---|---|
| Reis | 2 | 4 |
| cidades | 24 | 45 |
| estradas | 37 | 72 |
| cidades por Rei | 12 | 11,25 |
| saídas da capital | 2 | 2 |
| espelhos | 1 (oeste ↔ este) | 2 (este-oeste e norte-sul) + a rotação |
| capitais mais próximas | 17 | 11 (pela costa) |
| capitais mais afastadas | 17 | 26 e 27 (de costa a costa) |
| custo de uma estrada | 1,5 a 4,5 | 1,5 a 4,0 |

Capitais: **Seattle** (noroeste), **Los Angeles** (sudoeste), **New York**
(nordeste), **Miami** (sudeste). Centro: **Kansas City**.

## 2. Como é construído

Um **quadrante modelo** de 9 papéis, repetido nos quatro cantos, mais **9
cidades de eixo** que ficam em cima de um espelho.

| papel | o que é | NO | SO | NE | SE |
|---|---|---|---|---|---|
| K | capital | Seattle | Los Angeles | New York | Miami |
| P | a porta (1.ª cidade a sair da capital) | Portland | Bakersfield | Philadelphia | Orlando |
| C | costa, a caminho do vizinho do mesmo lado | Medford | Fresno | Washington | Jacksonville |
| H | 1.ª da linha de fora (fronteira norte ou sul) | Spokane | San Diego | Boston | Tampa |
| H2 | linha de fora | Helena | Phoenix | Buffalo | Tallahassee |
| H3 | linha de fora | Billings | El Paso | Detroit | New Orleans |
| H4 | linha de fora, junto ao meridiano | Cheyenne | Amarillo | Chicago | Memphis |
| A | diagonal para o centro | Boise | Las Vegas | Pittsburgh | Atlanta |
| B | diagonal, junto ao eixo | Salt Lake City | Albuquerque | Indianapolis | Nashville |

Eixo horizontal (entre norte e sul): **San Francisco** e **Denver** a oeste,
**Raleigh** e **St. Louis** a este. Meridiano (entre oeste e este):
**Minneapolis** e **Omaha** a norte, **Dallas** e **Oklahoma City** a sul.
**Kansas City** no cruzamento.

### As estradas e os custos

O custo de cada órbita é a **média das distâncias reais** (em milhas, linha
reta) das estradas que a compõem, a 110 milhas por unidade, arredondada a meio,
com mínimo de 1,5.

| órbita | NO | SO | NE | SE | média | custo |
|---|---|---|---|---|---|---|
| K–P | 145 | 101 | 81 | 206 | 133 | 1,5 |
| K–H | 228 | 111 | 190 | 206 | 184 | 1,5 |
| P–C | 221 | 104 | 123 | 125 | 143 | 1,5 |
| P–A | 345 | 224 | 257 | 402 | 307 | 3,0 |
| H–H2 | 264 | 299 | 399 | 204 | 292 | 2,5 |
| H2–A | 288 | 256 | 179 | 229 | 238 | 2,0 |
| H2–H3 | 178 | 345 | 216 | 347 | 272 | 2,5 |
| A–B | 296 | 483 | 329 | 215 | 331 | 3,0 |
| H3–H4 | 370 | 359 | 237 | 359 | 331 | 3,0 |
| H3–B | 386 | 230 | 240 | 469 | 331 | 3,0 |
| H4–B | 370 | 272 | 165 | 196 | 251 | 2,5 |
| C–eixo H de fora | 316 | 161 | 233 | 415 | 281 | 2,5 |
| B–eixo H de dentro | 371 | 335 | 230 | 254 | 297 | 2,5 |
| H4–eixo H de dentro | 97 | 357 | 262 | 241 | 239 | 2,0 |
| H4–meridiano de fora | 640 | 334 | 355 | 420 | 437 | 4,0 |
| H4–meridiano de dentro | 462 | 244 | 431 | 422 | 390 | 3,5 |
| B–B (norte ↔ sul) | 485 (oeste) | | 252 (este) | | 368 | 3,5 |
| meridiano de fora–de dentro | 290 (norte) | 190 (sul) | | | 240 | 2,0 |
| meridiano de dentro–Kansas City | 165 (norte) | 298 (sul) | | | 232 | 2,0 |
| eixo H de dentro–Kansas City | 557 (oeste) | | 238 (este) | | 397 | 3,5 |

## 3. Porque é justo

`verificarEquilibrio()` devolve **0 falhas**. Confere, para cada um dos três
espelhos, que estrada vai a estrada com o mesmo custo, capital a capital, e que
o custo de marcha de cada capital a cada cidade se conserva. Trancado por
`testes/test_mapa_usa.js`, que também confere que a verificação **apanha** um
mapa torto.

Consequências, todas medidas:

- cada capital tem o mesmo **quintal**: 9 cidades mais perto dela do que de
  qualquer outra; as 9 de eixo estão empatadas entre os Reis que as partilham;
- as **três** maneiras de fazer duas equipas são justas (há sempre um espelho
  que troca uma equipa pela outra):
  - **costas** (Oeste × Este): os aliados são vizinhos pela costa (11), o
    inimigo está do outro lado do país (26–27). A frente é o meridiano, com
    cinco cidades disputadas;
  - **norte × sul**: o aliado está longe (26) e o inimigo perto (11);
  - **diagonal**: cada Rei fica entre dois inimigos;
- **nenhuma estrada cruza outra** no desenho.

## 4. O que ficou abaixo do resto (dito, não escondido)

- **O mapa é anisotrópico**: os EUA têm o dobro da largura. As capitais do mesmo
  lado ficam a 11 e as de lados opostos a 26. É a geografia; muda o carácter de
  cada modo de equipas, não a justiça. Se o modo norte × sul sair apressado
  demais (o inimigo a 6 saltos), a correção é subir os custos da costa, não
  mexer na forma.
- **Custo igual, comprimento diferente**: estradas da mesma órbita custam o
  mesmo mas não medem o mesmo no desenho. A razão unidades/custo vai de 45 a 165
  (3,7×; na Ibéria vai de 44 a 131, 3,0×). No 3D, as colunas vão andar mais
  depressa numas do que nas outras. O pior caso é Cheyenne–Denver (97 milhas a
  custo 2).
- **Jacksonville fica perto da estrada Orlando–Atlanta.** Não a toca nem a
  cruza, mas no 3D o traçado dessa estrada tem de curvar para oeste (como a
  I-75 real).
- **Estradas sem interestadual por baixo**: Cheyenne–Minneapolis e Bakersfield–Las
  Vegas existem como caminho, não como autoestrada. São o preço de um quadrante
  único.
- **Ficaram de fora** cidades que um americano esperaria: Houston, San Antonio,
  Cleveland, Charlotte, Sacramento. Entrar com uma é entrar com quatro.
- **A guarnição das neutras não está calibrada.** O motor dá 1/2/3 tropas pela
  distância à capital mais próxima, normalizada pela distância entre as duas
  capitais. Com quatro capitais há duas distâncias (11 e 26), e a escolha muda
  tudo: pela de 26 saem 22 neutras fracas, 14 médias e 5 fortes; pela de 11
  saem 8, 8 e 25. Fica para medir com o jogador-base quando o motor jogar a 4.

## 5. A ilha, as posições e as vias (11/11, tarde)

Decisão do Lucas: os EUA são uma **ilha**, só os 48 estados; o Canadá e o
México são mar, e os Grandes Lagos ficam baías. Com a terra real na grelha do
forno (`ferramentas/cena/preparar_usa.py`):

- **15 cidades de beira-mar foram puxadas até meio grau para terra** (Seattle
  saiu do Puget Sound, San Francisco passou para o lado de lá da baía, New
  Orleans subiu do delta): a posição real caía na água ou a menos de 10 m dela.
- **12 estradas levam `via`** (`VIAS` no `world-usa.js`): em linha reta, 20 das
  72 pisavam água (Buffalo–Detroit ia pelo Ontário, Tampa–Tallahassee pelo
  Golfo). Agora são **0 de 72**. A via muda o desenho, nunca o custo.
- O vale do Salton Sea (abaixo do nível do mar, ligado ao golfo da Califórnia)
  foi aterrado: abria um braço de mar entre San Diego e Phoenix.

## 6. O que falta para se jogar

O mapa é um ficheiro de dados **que ainda nada lê**. O plano, em lotes, está em
`RELATORIO_2026-11-11_MAPA_USA_E_ANALISE.md`.
