# Direção de arte — The Kings Arena

Instruções para gerar as quatro peças visuais da marca. Escrita em 20/08/2026.

**Como usar:** cada peça tem um prompt pronto para copiar e colar. Os prompts estão **em inglês
de propósito** — todo gerador de imagem foi treinado majoritariamente em inglês e responde
melhor a termos de arte nessa língua, mesmo quando aceita português.

**O que fazer com o resultado:** me manda o PNG. Eu limpo, recorto, converto em SVG quando for
o caso (tenho potrace aqui) e integro. Não precisa editar nada antes.

---

## A lei da paleta (vale para as quatro peças)

Isto vem do `docs/DIRECAO_DE_ARTE_transmissao.txt` e não muda: **fundo terroso, e só três cores
gritam.** Nenhuma quarta cor saturada entra.

| papel | nome para o prompt | hex |
|---|---|---|
| Rei A | *deep steel blue* | `#2f5d8a` |
| Rei B | *deep crimson red* | `#9b2f2c` |
| destaque / realeza | *antique gold* | `#e0b04a` |
| pergaminho (traço, luz) | *aged parchment cream* | `#e9dfc6` |
| fundo | *dark umber brown, almost black* | `#12100c` |

Se aparecer verde, roxo, ciano ou magenta na imagem gerada, **descarta e gera de novo.** Não é
preciosismo: a leitura do mapa durante a partida depende de só três cores terem significado.

---

## Regra que vale para todos os prompts

**Nunca peça texto na imagem.** Gerador de imagem escreve errado, e mesmo quando acerta a letra
sai torta. O nome "The Kings Arena" é tipografia de verdade (Cormorant Garamond), que eu componho
por código em cima. Todo prompt abaixo termina com uma instrução explícita de *não* desenhar letras.

---

## Peça 1 — O símbolo

O mais difícil dos quatro, porque gerador de imagem é ruim em logo: ele faz ilustração, não marca.
A saída é pedir um **emblema heráldico chapado**, quase sem sombra, que eu depois vetorizo.

### Prompt

```
A heraldic coat of arms emblem, flat vector illustration style, perfectly centered,
symmetrical, front-facing.

A single medieval shield, party per bend — the upper-left half deep steel blue (#2f5d8a),
the lower-right half deep crimson red (#9b2f2c), divided by a clean straight diagonal line.
The shield has a bold outline in aged parchment cream (#e9dfc6). Resting on top of the
shield, a simple five-pointed medieval crown in antique gold (#e0b04a), solid fill,
geometric, no jewels, no filigree.

Style: flat two-dimensional, thick confident outlines, solid color fills, NO gradients,
NO shading, NO 3D, NO glow, NO texture. The look of a printed guild mark or a football
club crest — reducible to four flat colors. Clean silhouette that stays readable when
shrunk to 16 pixels.

Background: plain solid dark umber brown (#12100c), completely empty, no scene, no
decorative border, no rays, no banner, no ribbon.

Absolutely no text, no letters, no numbers, no lettering of any kind anywhere in the image.

Square composition, generous empty margin around the emblem.
```

### Como avaliar antes de me mandar

Gere **quatro** e escolha por esta lista, não pelo que "ficou mais bonito":

- [ ] Dá para descrever a forma em uma frase? Se precisar de duas, está detalhado demais.
- [ ] Aperte os olhos até desfocar: ainda dá para ver escudo e coroa? Se virar mancha, descarte.
- [ ] Tem exatamente quatro cores? Gradiente e sombra são motivo de descarte — eles impedem a
      vetorização.
- [ ] A coroa está *apoiada* no escudo, não flutuando nem cortada.
- [ ] Nenhuma letra apareceu.

### Se não sair bom em quatro tentativas

Tente trocar `party per bend` por `party per pale` (divisão vertical em vez de diagonal) — é uma
forma mais simples e os geradores acertam mais. E se a coroa continuar ruim, **peça o escudo sem
coroa**: a variante A que eu já tinha desenhado funciona, e um escudo limpo bate um escudo com
coroa mal desenhada.

---

## Peça 2 — A ilustração de abertura

É a imagem grande do topo do site. Hoje está o mapa do jogo, que já funciona; esta peça é para
ficar **melhor** que ele, não para tapar buraco. Se o resultado não for claramente melhor, o mapa
continua.

### Prompt

```
A medieval illuminated manuscript illustration, wide horizontal composition.

Two crowned kings in profile facing each other across the frame, seen from the chest up,
in the stylized flat manner of a 14th century chronicle miniature. The king on the left is
rendered in deep steel blue (#2f5d8a) robes; the king on the right in deep crimson red
(#9b2f2c) robes. Both wear simple antique gold (#e0b04a) crowns. Their faces are calm and
expressionless, drawn with simple confident ink lines, not realistic, not cartoon.

Between them, filling the center of the frame, a stylized top-down map of a peninsula
with roads drawn as thin pale lines connecting small castle marks — drawn as a chart on
parchment, not as landscape.

Palette locked to: dark umber brown background (#12100c), aged parchment cream (#e9dfc6)
for line work and light, and only the three accents named above. No green, no purple, no
cyan, no teal.

Style: hand-inked medieval manuscript, flat perspective, visible paper grain, gold leaf
feel on the crowns. Slightly dark and solemn. NOT fantasy concept art, NOT digital
painting, NOT airbrushed, NOT glossy, NOT photorealistic.

Absolutely no text, no letters, no numbers, no scrolls with writing, no banners with
words.

Aspect ratio 16:9, wide. Leave the left third visually calm and uncluttered — headline
text will be placed over it.
```

**Aquela última frase é a mais importante do prompt.** Sem ela vem uma imagem cheia dos dois
lados e o título fica ilegível por cima. Se o gerador ignorar, peça de novo com
`empty dark space on the left third`.

**Formato:** o mais largo que o gerador permitir, mínimo 1920 px de largura.

---

## Peça 3 — Os brasões dos modelos

Um selo por LLM, para aparecer ao lado do nome na tabela e nos replays. É o que faz o benchmark
parecer uma liga em vez de uma planilha.

**O problema desta peça é consistência**, não beleza: nove selos precisam parecer da mesma
família. A técnica é manter o prompt **idêntico palavra por palavra** e trocar só a última frase.

### Prompt base (não mude nada além da última linha)

```
A minimal heraldic charge on a plain shield, flat vector style, centered, symmetrical.

Single medieval shield shape, solid fill in aged parchment cream (#e9dfc6), with a bold
outline in antique gold (#e0b04a). Inside the shield, one simple geometric charge in dark
umber (#12100c), flat, solid, no shading, no gradient, no 3D, occupying the middle half of
the shield.

Style: the visual language of medieval heraldry — bold, simple, reducible, the kind of
mark that stays legible on a flag at distance. NO text, NO letters, NO numbers.

Background: plain solid dark umber brown (#12100c), empty.

Square composition.

The charge is: A BOLT OF LIGHTNING.
```

### As nove últimas linhas, uma por modelo

Troque **só** a linha final por uma destas, mantendo o resto igual:

| modelo | linha final |
|---|---|
| nemotron-3.5-lightning | `The charge is: A BOLT OF LIGHTNING.` |
| nemotron-3-ultra-550b | `The charge is: A TRIPLE MOUNTAIN PEAK.` |
| nemotron-3-super-120b | `The charge is: A TOWER WITH THREE BATTLEMENTS.` |
| nemotron-3-nano-30b | `The charge is: A SINGLE OAK LEAF.` |
| nemotron-nano-12b-v2-vl | `The charge is: AN OPEN EYE.` |
| dots-3-note-preview | `The charge is: THREE DOTS IN A TRIANGLE.` |
| gpt-oss-20b | `The charge is: AN OPEN PADLOCK.` |
| laguna-s-2.1 | `The charge is: A CRESCENT MOON.` |
| gemini-2.5-flash | `The charge is: TWO CROSSED ARROWS.` |

**Se o gerador tiver semente fixa (seed), use a mesma nas nove.** É o que garante que saiam
irmãs. Se não tiver, gere as nove na mesma sessão e sem mudar nenhum outro ajuste.

**Se ficarem desiguais**, não insista: me manda as que ficaram boas e eu desenho as outras à mão
no mesmo estilo. Selo heráldico simples é uma das poucas coisas que eu desenho bem em SVG.

---

## Peça 4 — A imagem de compartilhamento (LinkedIn)

É o retângulo que aparece quando você cola o link num post. **Esta é a peça mais importante das
quatro para o seu plano de publicação** — é a primeira coisa que a pessoa vê, antes do texto.

**Não precisa de IA.** Eu monto com o mapa que você já tem, o símbolo e a tipografia, no formato
certo (1200 × 630 px), com o nome e uma linha de assinatura. Fica pronta em minutos e não depende
de nenhuma geração dar certo.

Só me diga a frase de assinatura. Três opções:

- *"Dois modelos de linguagem. Um mapa. Uma coroa."*
- *"LLMs jogam estratégia. Aqui estão os resultados."*
- *"Benchmark aberto de estratégia para LLMs — 14 partidas, todos os logs públicos."*

---

## Resumo do que fazer

1. Gere a **Peça 1** (símbolo) — quatro tentativas, escolha pela lista de avaliação.
2. Gere a **Peça 2** (abertura) — só entra se ficar melhor que o mapa atual.
3. Gere a **Peça 3** (nove brasões) — mesma semente, prompt idêntico, só a última linha muda.
4. A **Peça 4** eu faço, assim que você escolher a frase.

Me mande os PNGs como estão. Eu recorto, vetorizo o que for vetorizável, e trago a v3 do site
com tudo integrado.
