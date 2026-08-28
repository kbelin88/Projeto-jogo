# ITEM 2 — a interface nao se adapta ao monitor

## O sintoma

O Lucas usa tres telas (notebook, monitor externo maior, TV). Ao trocar de
tela, elementos se sobrepoem e areas ficam sem clique. O publico vai ver no
telemovel, no PC e na TV.

## Reproducao

```
python servir.py
```
abrir `http://localhost:8000/index.html` e medir com o DevTools (ou o script
abaixo) em varias larguras — nao precisa de dois monitores fisicos para ver o
problema, ele ja aparece so redimensionando a janela.

Este relatorio foi medido de verdade, rodando o jogo, com
`getBoundingClientRect()` em 4 larguras (celular, notebook comum, um
intermediario, e um desktop 1080p) — nao e opiniao sobre o CSS, e leitura
direta da pagina viva.

## Tabela de ruptura (medida, nao estimada)

| elemento | o que e | comportamento |
|---|---|---|
| `#gamebar` | barra de controle do jogo (item 4) | **largura FIXA de 1627px.** Estoura a tela em QUALQUER viewport abaixo disso — o que inclui a maioria dos notebooks. Em celular (375px) fica em **433% da largura**, quase inteira fora da tela e sem clique |
| `#depoTopo` x `#gamebar` | rodape de depoimento (94-346px do topo) x barra de controle | **SE SOBREPOEM DE VERDADE** abaixo de **725px de altura de viewport** (medido: 5px de overlap real em 1280x720; 43px de folga em 1366x768) |
| `#barraTopo` + `#depoTopo` + `#rodapeReis` | os 3 paineis fixos empilhados (placar, depoimento, resultado) | somam **632px de altura FIXA** (94+252+286), independente da tela. Numa tela de 720-768px de altura, isso e 82-88% da altura TOTAL so de UI fixa — sobra quase nada pro mapa |

## Causa raiz

**Nao e um bug isolado — e um padrao repetido:** varios elementos usam
medida FIXA em pixels (largura E altura) para paineis pensados para telas
grandes, sem nenhum ponto de quebra (`@media`) nem calculo relativo a
viewport.

1. **`--rr-h: 286px`** (index.html:300) — constante fixa, usada para reservar
   espaco para o rodape de resultado E para posicionar `#gamebar`,
   `#editorbar` e `#zoombar` ACIMA dela (index.html:458-459,466). Nao e
   calculada do tamanho real de nenhum elemento nem de `vh`. **Esta e a MESMA
   causa do item 4** — os dois itens se tocam exatamente aqui, como a spec
   avisou.
2. **`#gamebar` sem `flex-wrap`** — 14 controles (Play, Passo, Reiniciar, vel,
   Rei A, Rei B, turnos, teto, sem limite, olhos de, baixar log, salvar
   replay, ver replay, cinema) numa unica linha centralizada. Sem quebra de
   linha, a largura total (1627px) e uma CONSTANTE, nao uma funcao da tela.
3. **`#barraTopo` e `#depoTopo`** usam largura `100%` (isso esta certo), mas
   ALTURA fixa em px (94px e 252px) — nao encolhem em tela baixa. Isso e o que
   faz a SOMA das alturas nao caber numa tela de notebook.

Alguns elementos JA fazem certo (referencia positiva, para nao jogar fora no
conserto): `max-width: 46vw` e `min(560px, 92vw)` (mencionados na spec) usam
unidade relativa. **O padrao certo ja existe no proprio arquivo — falta
aplicar nos elementos que ainda nao usam.**

## Sobre "trocar de tela dispara resize()?"

Verifiquei o mecanismo (index.html:810-823): `DPR` (capado em 2) so e
recalculado DENTRO de `resize()`, e `resize()` so e chamado pelo evento
`window resize`. **Nao ha `ResizeObserver`, nem `matchMedia("(resolution:
...)")`, nem listener dedicado a mudanca de `devicePixelRatio`.**

**Nao consegui reproduzir com certeza absoluta** o caso especifico "so muda o
DPR sem o browser redimensionar a janela" — este ambiente de teste nao tem
dois monitores fisicos para simular a troca real. E uma suspeita tecnica
plausivel (mover uma janela MAXIMIZADA entre dois monitores de DPI diferente
no Windows normalmente redimensiona a janela tambem, o que dispara `resize`
— mas isso depende do gerenciador de janelas e nem sempre e garantido).

**O que esta provado, e mais simples e mais forte:** mesmo que `resize()`
dispare CORRETAMENTE toda vez, o layout ja quebra so pelas medidas fixas
acima — um teste de DPR seria so uma segunda causa, hipotetica, empilhada
numa primeira que ja e suficiente e ja esta provada.

## Sobre o DPR do canvas (`Math.min(devicePixelRatio,2)`)

Nao investiguei a fundo (fora do orcamento desta rodada) se o teto de 2 e
certo ou errado para uma TV 4K — precisaria medir nitidez/desempenho real
numa TV, que este ambiente nao tem. Fica como pergunta em aberto, nao como
achado.

## Opcoes

**Opcao A — so os paineis fixos (`--rr-h`, `--bt-h`, `--dp-h`) viram
relativos (`vh` ou calculados por JS a partir do elemento real).** Resolve a
causa 1 (a mais espalhada — afeta gamebar, editorbar, zoombar, e o proprio
espaco do mapa). **Custo:** medio, so `index.html`, mexe em variaveis usadas
em varios lugares — testar as 3 alturas de novo depois.

**Opcao B — A + `flex-wrap` em `#gamebar` (ou colapsar controles, ver item
4).** Resolve tambem a causa 2. **Recomendado fazer junto com o conserto do
item 4**, ja que e o mesmo elemento.

**Opcao C — breakpoints explicitos** (`@media` para celular / notebook /
desktop / TV), como a spec perguntou. **Custo:** maior — decidir os cortes
exatos, e cada faixa precisa de teste proprio. So vale a pena se A+B nao
bastarem sozinhos (paineis relativos DEVEM resolver a maior parte sem
precisar de breakpoints fixos).

## Recomendacao

**A + B primeiro, medir de novo, e so ai decidir se C e necessario.** A causa
1 (`--rr-h` fixo) e a raiz mais barata e mais espalhada — resolver ela sozinha
ja deve tirar o overlap literal (achado do item 725px) na maioria dos casos.
Fazer isso JUNTO com o item 4 (mesmo arquivo, mesma area de CSS, mesma
sessao de teste) evita medir a mesma coisa duas vezes.

## Como provar que ficou resolvido

Repetir a medicao (`getBoundingClientRect()` de `barraTopo`, `depoTopo`,
`rodapeReis`, `gamebar`, `editorbar`, `banner`) nas 4 larguras usadas aqui
(375x812, 1280x720, 1366x768, 1920x1080) e confirmar:
1. nenhum par de elementos com retangulos que se sobrepoem (checagem
   automatica: `!(a.right<b.left || a.left>b.right || a.bottom<b.top ||
   a.top>b.bottom)` para cada par);
2. nenhum elemento com `left<0` ou `right>innerWidth` (nada fora da tela);
3. repetir em pelo menos UMA largura de celular real (375-430px) e UMA de TV
   (3840x2160, se houver acesso a uma).
