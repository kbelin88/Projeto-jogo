# ITEM 4 — a barra de controle

## O sintoma

Ao rodar uma partida, a barra com PLAY/PAUSE ocupa quase toda a largura,
fica sobre o meio do mapa, e carrega controles que nao fazem mais sentido
(como velocidade). O Lucas quer ela menor e no rodape.

## Reproducao

```
python servir.py
```
abrir `http://localhost:8000/index.html`, deixar a partida padrao (burro x
burro) carregar. A barra aparece sozinha, sem precisar dar Play.

Medido de verdade (nao adivinhado) com o navegador, em 3 larguras:

| viewport | largura da barra | posicao vertical (do topo) |
|---|---|---|
| 1280x720 | **127.1%** da tela (estoura 174px de cada lado) | 47.4% (meio) |
| 1366x768 (notebook comum) | **119.1%** da tela (estoura 130px de cada lado) | 50.7% (meio) |
| 1920x1080 | 84.7% (cabe) | 64.9% (nem perto do rodape) |

## Causa raiz

**E `#gamebar` (index.html:707-782).** Confirmado rodando o jogo e lendo a
arvore de acessibilidade: e a barra com Play/Passo/Reiniciar, o slider "vel",
os seletores de modelo do Rei A e do Rei B, turnos, teto $, "sem limite",
"olhos de", baixar log, salvar/ver replay e cinema — **14 controles numa
unica linha, sem quebra** (`flex-wrap: nowrap`). NAO e a `#barraTopo` (so
mostra placar, sem play/pause) nem a `#replaybar` (so aparece DENTRO de um
replay, e essa ja fica no rodape).

Duas causas independentes, que se somam:

**1. Largura.** 14 controles centralizados (`left:50%; transform:
translateX(-50%)`) sem `flex-wrap` somam 1627px de largura FIXA,
independente da tela. Em qualquer viewport abaixo de ~1627px (a maioria dos
notebooks, inclusive o do Lucas), a barra estoura os dois lados igualmente —
nao so visualmente: **os controles das pontas ficam fisicamente fora da tela
e sem clique**, o que bate com "elementos ficam sem clique" do item 2.

**2. Altura reservada e uma constante FIXA em pixels, nao proporcional a
tela.** `#gamebar { bottom: calc(var(--rr-h) + 12px) }` (index.html:458), e
`--rr-h: 286px` (index.html:300) e um numero fixo — a altura reservada para
o rodape de depoimento/benchmark, escrita a mao, **nao calculada do tamanho
real de nenhum elemento nem relativa a altura da tela**. Nas telas de
notebook (altura ~720-800px), 286px + 12px de vao + os 81px da propria barra
comem quase metade da altura disponivel, empurrando a barra para o meio
vertical. Numa tela de 1080p ou numa TV, a MESMA constante de 286px e uma
fatia bem menor da altura, entao o problema e menos visivel — mas mesmo la a
barra fica a 65% do topo, longe do rodape de verdade.

Isso e a mesma familia de causa do ITEM 2 (medida fixa em px que nao se
adapta ao monitor) — os dois itens se tocam exatamente onde a spec
desconfiou.

## Controles: o que faz sentido hoje e o que e resto

Rastreei `speed` (a variavel que o slider "vel" controla, index.html:2089)
ate o unico lugar onde e usada: `timer = setInterval(passoTurno, speed)`
(index.html:3548) — o intervalo do LOOP de auto-play entre um turno e o
proximo. Isso so importa quando o decisor responde INSTANTANEAMENTE (o
jogador "burro"). Para qualquer modelo real (Gemini, Grok, OpenRouter...) o
turno ja espera segundos a minutos pela resposta da API antes de
`passoTurno` sequer poder rodar de novo — o slider de 80 a 1200 ms e
imperceptivel perto disso. **O Lucas tem razao: e resto, sobrevivente de
quando o jogo so tinha o burro.**

Os outros 13 controles, conferidos um a um:

| controle | ainda serve? |
|---|---|
| Play / Passo / Reiniciar | sim — nucleo |
| **vel (slider)** | **nao, para jogo com modelo real** — so importa burro x burro |
| Rei A / Rei B (modelo) | sim — essencial |
| turnos (max) | sim |
| teto $ | sim — freio de custo |
| sem limite | sim — trabalha com o teto |
| olhos de (fog da camera) | sim — so cosmetico (nao muda a partida), mas usado para assistir |
| Baixar log / Salvar replay / Ver replay | sim — fluxo de gravar/conferir partida |
| Cinema | sim — necessario para gravar video limpo |

## Opcoes

**Opcao A — so mover e diminuir, sem redesenhar.** Trocar `--rr-h: 286px`
fixo por algo relativo (`vh` ou lido do elemento real via JS, ver item 2), e
tirar o slider "vel" da barra (ou escondê-lo atras de um "modo teste" que so
aparece quando os dois lados sao "burro"). **Custo:** baixo, 1 arquivo
(`index.html`), risco pequeno — nao muda a logica do jogo, so CSS/layout.
**Nao resolve** a largura fixa de 1627px sozinha; precisa de uma segunda
mudanca (quebra de linha ou colapsar em menu).

**Opcao B — colapsar em duas fileiras fixas + esconder o secundario.**
Fileira 1 (sempre visivel, pequena): Play/Passo/Reiniciar/turnos/teto. Fileira
2 (num menu "mais opcoes" ou acordeao): Rei A/Rei B/sem limite/olhos
de/log/replay/cinema. **Custo:** medio — mais HTML/CSS, mas nenhuma mudanca
de logica. Resolve largura E altura ao mesmo tempo, e da a "barra pequena no
rodape" que o Lucas pediu literalmente.

**Opcao C — redesenho completo da barra** (fora do escopo desta pesquisa;
so mockup). Um `experimentos/mockup-barra.html` avulso, sem tocar
`index.html`, para o Lucas aprovar a forma antes de qualquer implementacao.

## Recomendacao

**C primeiro (mockup para aprovar), depois B.** A opcao A e rapida mas so
empurra o problema (a barra fica menor mas ainda pode estourar largura em
telas pequenas, e ainda vai competir com o item 2 pela mesma correcao de
`--rr-h`). Como o Lucas pediu explicitamente "menor e no rodape" — nao so
"mais pra baixo" — vale desenhar a versao final antes de mexer no
`index.html` de verdade, e resolver os dois problemas (largura E altura) de
uma vez so, no mesmo lote que o item 2.

## Como provar que ficou resolvido

Repetir a medicao com `getBoundingClientRect()` nas mesmas 3 larguras
(1280x720, 1366x768, 1920x1080 — usar os pontos de ruptura reais do item 2
quando esse relatorio existir) e confirmar:
1. largura da barra <= 100% da viewport nas tres;
2. `top` da barra >= ~85% da altura da viewport (perto do rodape de verdade)
   nas tres;
3. nenhum controle com `getBoundingClientRect().left < 0` ou
   `.right > innerWidth` (nada fora da tela).
