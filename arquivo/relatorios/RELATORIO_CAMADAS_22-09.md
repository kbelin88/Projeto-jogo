# Relatório — por que o mapa está baralhado, e o que limpar

Feito a pedido do Lucas em 22/09, depois de ele ver o replay burro×burro. Tudo o
que está aqui foi **medido no jogo a correr**, não deduzido.

---

## 1. "Em algumas estradas a batalha não acontece"

**Confirmado, e a causa é minha.** Medido no replay `burro_seed7`, combates de
estrada convertidos por turno:

| turno | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|
| combates | 2 | 8 | 3 | 5 | **10** | 8 | 9 | 6 | 3 | 1 |

O motor resolve todos. A cena tem um **teto de 6 ao mesmo tempo** (pus eu, em
21/09, quando 59 cenas abertas quase mataram a placa). Nos turnos cheios, quatro
combates ficam **sem cena nenhuma** — nem figuras, nem marcador. Daí a sensação
de que umas estradas têm batalha e outras não: têm todas, mas só seis se veem.

Há um segundo caso, e é de fundo: **o assalto a uma aldeia não tem cena nenhuma.**
Só o combate em campo aberto tem. Quem olha vê tropas a chegar a uma muralha e
a bandeira a mudar de cor.

## 2. "A tropa fica parada depois da batalha"

**Confirmado, e também é meu.** Em 21/09 pus um *rescaldo* de 12 segundos para dar
tempo de levar a câmara ao sítio. Só que ele deixa **os sobreviventes de pé, em
formação, a não fazer nada** — quando o que devia ficar no campo são os mortos, e
o vencedor devia seguir caminho. É isso que se vê como "tropa parada".

## 3. "Os soldados novos misturam-se com os antigos"

**Confirmado, com número.** Com a câmara sobre uma estrada movimentada, medido em
410 amostras seguidas: **56 figuras novas (com esqueleto) e 4 antigas (rígidas) ao
mesmo tempo, em 100% das amostras.**

A causa está à vista no código: o mapa tem **dois desenhos de tropa**.
- o **poço animado**: 28 cópias por tipo, com os modelos novos do ComfyUI;
- o **símbolo rígido**: `InstancedMesh` com as peças `lanceiro`/`arqueiro`/
  `cavaleiro` assadas no `pecas.glb` — que são os **soldados antigos**
  (`ferramentas/cena/guerreiros.py`, 1 224 / 1 360 / 1 956 triângulos).

Quando o poço esgota (mais de 28 de um tipo à vista), o resto da coluna é
desenhado com o modelo antigo. E o `mapa3d.json` diz o resto da história: essas
peças têm **zero cópias** no mapa — ficaram lá só para servir de reserva.

## 4. A sensação de "coisas feitas por cima de coisas" é verdadeira

Três sistemas desenham tropas, escritos em alturas diferentes:

| sistema | nasceu para | ainda serve? |
|---|---|---|
| símbolo rígido instanciado | quando não havia esqueletos | **não** — só polui |
| poço animado (28/tipo) | as colunas em marcha | sim |
| `batalha.js` (cópias próprias) | a cena de combate | sim |

E há mais camadas velhas a viver por baixo:

- **`index.html` com 6 424 linhas**: motor de desenho 2D, laço do jogo, clientes
  de API, replay, crónica, caderno de marcas e a ponte 3D, tudo no mesmo ficheiro.
- o **desenhador 2D** continua vivo por trás do 3D (já não pinta, mas o código
  todo está lá);
- o **cliente OpenRouter está duplicado** (`rei.js` e `index.html`) — dívida
  conhecida desde agosto;
- a bancada `encontro.html` faz hoje o mesmo que `batalha.js`, com código
  paralelo;
- o forno continua a assar peças que ninguém coloca (os soldados antigos).

Nada disto é "erro"; é o rasto de seis semanas a construir por cima. Mas já
chegou ao ponto de o mapa mentir sobre o que está a acontecer, que é o que o
Lucas viu.

---

## O que proponho, por ordem de valor

### A. Um só desenho de tropa *(meio dia, sem cozer o mapa)*
1. Tirar o **símbolo rígido** do `mapa3d.js`: acima do que o poço aguenta, a
   coluna mostra **menos figuras** em vez de mostrar figuras diferentes. Um
   exército é um símbolo, não um censo — esta regra já é a do jogo.
2. Aumentar o poço de 28 para ~40 por tipo e emprestar entre tipos.
3. Tirar as peças de tropa antigas do forno (`exportar_mapa.py` / `pecas.py`).
   Isso alivia o `pecas.glb` e acaba a mistura pela raiz.
4. **Prova:** contador que acusa "figuras antigas no ecrã: 0" e uma foto da mesma
   estrada antes/depois.

### B. A batalha comporta-se *(2 a 3 horas)*
1. No rescaldo ficam **só os mortos**; os sobreviventes somem e a coluna do
   vencedor volta a marchar.
2. Marcador para **todos** os combates do turno, mesmo os que não ganham cena —
   assim nenhuma estrada fica "sem nada a acontecer".
3. Fila: os combates sem cena entram quando uma acaba, ou a cena encurta quando
   há muitos.

### C. Cena de assalto a aldeia *(uma sessão)*
É o que falta para o mapa contar a partida inteira. O portão já abre.

### D. Limpeza de camadas *(uma sessão, sem mexer no que se vê)*
1. Arrumar `index.html` em pedaços com nome (a ponte 3D, o replay, a crónica, o
   caderno) — sem reescrever nada, só separar.
2. Matar o desenhador 2D (fica a etiqueta `v1` no git para quem quiser ver).
3. Unificar o cliente OpenRouter.
4. `encontro.html` passa a usar o `batalha.js` em vez de ter guião próprio.

### E. Travar com testes *(1 hora)*
- "nenhum modelo antigo no ecrã";
- "todo o combate de estrada do turno tem marcador";
- "o vencedor volta a marchar no fim da cena".

---

## Ordem sugerida

**A → B → E** primeiro: são os três que arrumam o que se vê e o que se mede, e
não obrigam a cozer o mapa. Depois **C** (assalto), que é o que dá vídeo novo.
**D** fica para quando a próxima coisa custar caro por causa da bagunça — é a
única parte que não se nota no ecrã.
