# SPEC DE PESQUISA — 28/08/2026

Quatro problemas achados pelo Lucas assistindo replays a 0.125x e 0.25x.

**Esta spec e de PESQUISA, nao de conserto.** O objetivo e chegar a proxima
sessao com cada problema tendo: causa raiz provada, opcoes de solucao com custo
e risco, e uma recomendacao. Quem decide o que fazer e o Lucas, na sessao
seguinte, com os relatorios na mao.

---

## 0. A regra que vale para os quatro itens

**Nao conserte. Investigue.** Um patch aplicado sem o Lucas ter visto o
diagnostico e trabalho jogado fora quando ele escolher outro caminho — e pior,
esconde o problema antes de ele ser entendido.

**Toda afirmacao precisa de prova.** "O combate de estrada falha" nao serve.
"Falha porque `cruzaramNaEstrada` (engine.js:1355) exige que os dois exercitos
estejam no MESMO trecho no instante da amostragem, e o teste X mostra dois
exercitos trocando de trecho entre dois turnos sem nunca coincidir" serve.
Cite sempre `arquivo:linha`, ou um comando que reproduz.

**"Nao sei" e uma resposta valida.** Melhor do que uma causa plausivel e errada,
que custa uma sessao inteira a perseguir.

**Nao gaste API paga.** Ha 25+ partidas gravadas em `resultados/` com
`.replay.json`. Toda a investigacao dos itens 1 e 3 cabe nelas.

---

## 1. Como trabalhar e salvar

### Onde escrever

Tudo em **`pesquisa/2026-08-28/`**, criando a pasta:

    pesquisa/2026-08-28/
      DIARIO.md                    o que foi tentado, EM ORDEM, inclusive becos sem saida
      RESUMO.md                    escrito por ultimo: 1 paragrafo por item + recomendacao
      1-cruzamento-estradas.md
      2-interface-monitores.md
      3-tropas-retaguarda.md
      4-barra-de-controle.md
      experimentos/                scripts avulsos que provam cada coisa

### O que NAO tocar

**Nao editar `engine.js`, `index.html`, `world-iberia.js` nem nada em
`ferramentas/`.** Se precisar instrumentar para medir, faca uma **copia** dentro
de `experimentos/` e instrumente a copia. O codigo de producao sai desta sessao
byte a byte como entrou.

**Nao commitar.** O repo tem ~90 arquivos por versionar e o Lucas ainda nao
decidiu o escopo do commit. Deixe tudo no diretorio de trabalho.

### O formato de cada relatorio

Os quatro seguem a mesma estrutura, para o Lucas conseguir ler os quatro seguidos:

1. **O sintoma** — o que o Lucas ve, em uma frase.
2. **Reproducao** — o comando ou os passos exatos. Se nao conseguiu reproduzir,
   diga isso com destaque: e o achado mais importante do relatorio.
3. **Causa raiz** — com evidencia. Se houver mais de uma causa, numere.
4. **Opcoes** — 2 a 4 caminhos, cada um com: o que muda, quanto custa (em
   arquivos e risco), e o que pode quebrar.
5. **Recomendacao** — uma, com o porque.
6. **Como provar que ficou resolvido** — o teste que a proxima sessao vai rodar.

### O DIARIO

Uma linha por tentativa, com hora. **Inclua o que NAO funcionou.** Metade do
valor de uma sessao de pesquisa esta em saber onde ja se procurou.

---

## 2. ITEM 1 — exercitos se cruzam na estrada sem lutar

**Prioridade: a mais alta.** E regra de jogo, afeta o benchmark, e ja foi dada
como resolvida uma vez sem estar.

### O sintoma

Assistindo replay em camera lenta, dois exercitos inimigos passam um pelo outro
no mesmo trecho de estrada e seguem viagem. Deveriam se enfrentar.

### O que ja se sabe (conferido em 27/08)

O motor **tem** combate de estrada. Ele vive em `engine.js`:

| onde | o que faz |
|---|---|
| `posicaoRota` (~1333) | onde um exercito esta na rota dele, por progresso de turnos |
| `cruzaramNaEstrada` (~1355) | decide se dois exercitos inimigos se cruzaram |
| `resolverCombateEstrada` (~1385) | resolve o choque em campo aberto |
| `interceptaChegada` (~1442) | LOTE E / achado A3: quem esta no ULTIMO passo tambem cruza |
| `cruzamentoMesmoSentido` (~1378) | flag: mesmo sentido tambem se enfrenta (regra do Lucas, 23/08) |

Ou seja: **o codigo existe e ja foi mexido duas vezes.** Se ainda falha, a causa
esta numa condicao que ele nao cobre — nao na ausencia do recurso.

### Hipoteses para testar (nesta ordem)

**H1 — amostragem discreta.** `cruzaramNaEstrada` e um teste INSTANTANEO, rodado
uma vez por turno. Dois exercitos podem estar no mesmo trecho sem terem
convergido no turno N, e no turno N+1 ja terem ambos saido para trechos
diferentes. Trocaram de lugar sem nunca produzir uma amostra que os pegasse
juntos e convergidos. **Esta e a hipotese mais forte** — teste-a primeiro.

**H2 — trechos diferentes da mesma rota.** O teste exige `lo/hi` identicos
(mesmo par de aldeias). Dois exercitos podem se cruzar EM CIMA de uma aldeia
(no no, nao no trecho), ou em trechos adjacentes, e escapar.

**H3 — velocidades diferentes.** Um cavaleiro e um lanceiro cruzando o mesmo
trecho avancam fracoes muito diferentes por turno. Ver se isso aumenta a chance
de pularem um pelo outro entre amostras.

**H4 — a flag desligada em jogo.** Conferir que `cruzamentoMesmoSentido` e
`interceptaChegada` estao de facto ativas no CONFIG **vivo** (nao no
`CONFIG_V3_ARQUIVO`). Ja houve um bug exatamente dessa familia — ver CLAUDE.md
secao 6, o caso do ruleset com toggle.

### Como investigar

1. **Varra os replays existentes** procurando pares de exercitos que ocuparam o
   mesmo trecho em sentidos opostos e nao geraram evento de combate. Os
   `.replay.json` em `resultados/` tem o estado do motor por turno. Escreva o
   varredor em `experimentos/`.
2. **Meca a frequencia:** quantas vezes por partida isto acontece? Se for 1 em
   40 turnos e outra coisa; se for toda partida, e regra quebrada.
3. **Construa um caso minimo** — duas aldeias, dois exercitos, sentidos opostos —
   e rode o motor direto em Node. Se o caso minimo FUNCIONA, a causa esta na
   interacao com rotas longas, e a H1/H2 sobem de peso.

### O que entregar

Alem do formato padrao: **um numero**. "Em N partidas, M cruzamentos deveriam
ter acontecido e K aconteceram." Sem isso nao da para saber se a correcao
funcionou depois.

---

## 3. ITEM 2 — a interface nao se adapta ao monitor

### O sintoma

O Lucas usa tres telas: a do notebook, um monitor externo maior, e uma TV
grande. Ao trocar de tela, **elementos se sobrepoem e areas ficam sem clique**.
E o publico vai ver no telemovel, no PC e na TV.

### O que ja se sabe

- `#map` e `100vw x 100vh`; ha um `resize()` (index.html:813) que recalcula
  `DPR`, `VW`, `VH`, ligado ao evento `resize` (:823).
- **Mas ha muita medida fixa em px no CSS** — varias caixas com `999px`,
  `320px`, `560px`, `520px`… Uma barra de 999px numa tela de 1366 sobra; numa TV
  4K some.
- Alguns elementos ja usam `vw` (`max-width: 46vw`, `min(560px, 92vw)`), outros
  nao. **A inconsistencia e o problema**, mais do que o valor de cada um.

### Perguntas a responder

1. **Trocar de tela dispara `resize()`?** Mover uma janela entre monitores com
   DPR diferente nem sempre dispara `resize` — as vezes so muda o
   `devicePixelRatio`. Existe `matchMedia("(resolution: …)")` ou
   `window.onmove`? Testar de verdade, nos tres monitores se possivel.
2. **Quais elementos quebram, e em que largura exata?** Levantar a lista com o
   ponto de ruptura de cada um. Nao "o painel quebra" — "o painel `#X` sobrepoe
   `#Y` abaixo de 1180px de largura".
3. **Quais faixas precisam existir?** Telemovel / notebook / desktop / TV. Definir
   os pontos de corte a partir dos elementos, nao de numeros da moda.
4. **O canvas trata DPR corretamente ao mudar de monitor?** `DPR` e capado em 2
   (:810). Numa TV 4K isso pode ser certo (desempenho) ou errado (borrado) —
   medir, nao supor.

### Como investigar

- Levantar **todos** os elementos posicionados (`position: fixed/absolute`) e
  suas medidas, numa tabela. Essa tabela e metade do relatorio.
- Usar o navegador em larguras controladas (375, 768, 1366, 1920, 2560, 3840) e
  registrar o que quebra em cada uma. **Com captura de tela** em
  `experimentos/telas/`.
- Verificar se o problema e de **layout** (CSS) ou de **estado** (JS que mediu
  uma vez e nao remediu). Sao consertos diferentes.

### O que entregar

Uma **tabela de ruptura**: elemento x largura em que quebra x o que acontece. E
uma proposta de estrategia (faixas + o que vira relativo), com o custo estimado.

---

## 4. ITEM 3 — os reis nao levam tropas da retaguarda para o front

### O sintoma

A certa altura da partida, os modelos deixam tropas paradas nas aldeias
iniciais enquanto a disputa acontece no meio do mapa. Um humano moveria pelo
menos parte dessas tropas para a frente.

### ATENCAO: a premissa do pedido esta parcialmente errada

O Lucas pediu tambem para "o modelo saber a diferenca entre aldeia inimiga e
neutra". **Ele ja sabe** — conferido em 27/08 no `relatorioTextoP4`:

- ha secoes separadas: `=== NEUTRAL VILLAGES (n) ===` e `=== ENEMY (King X) ===`
  (engine.js ~2288 e ~2292);
- cada alvo leva etiqueta `NEUTRAL` / `ENEMY (King X)` / `ENEMY CAPITAL` (~2283);
- e cada aldeia PROPRIA e marcada `BORDER with … (enemy)` ou
  `INTERIOR (no enemy border)` (~2257).

Ou seja, o prompt **ja diz** quais aldeias do rei sao interior e quais fazem
fronteira, e ja separa neutra de inimiga.

**Entao a pergunta de pesquisa muda**, e e mais interessante:

> Por que o modelo nao AGE sobre uma distincao que ja lhe e dita?

### Hipoteses

**H1 — a informacao esta la mas enterrada.** `INTERIOR` aparece no fim de uma
linha longa, entre muitos numeros. Medir: em que posicao do prompt, e com que
destaque, aparece a marca de interior/fronteira?

**H2 — falta a acao, nao a informacao.** O prompt diz que reforcar aldeia
propria e uma mecanica, mas talvez nunca sugira **mover de tras para a frente**
como um movimento tipico. Ver o texto exato das regras.

**H3 — o custo esta invisivel.** Marchar da retaguarda ao front leva N turnos, e
o relatorio talvez nao mostre esse tempo para pares aldeia-propria -> aldeia-
propria; so para alvos. Se o rei nao ve quanto tempo leva, nao planeja.

**H4 — e comportamento, nao prompt.** Modelos pequenos podem simplesmente nao
manter um plano logistico por varios turnos. Se for isso, o conserto e de
prompt-engineering fraco e a conclusao honesta e "nao da para consertar por
prompt neste tamanho de modelo".

### Como investigar

1. **Meca primeiro.** Nos replays de `resultados/`, quantas tropas ficam paradas
   em aldeias INTERIOR enquanto ha combate acontecendo? Quantos envios sao de
   aldeia propria para aldeia propria (reforco), e quantos desses vao de tras
   para a frente? Escreva o medidor em `experimentos/`.
   **Sem esse numero nao ha como saber se um conserto funcionou.**
2. **Reconstrua o prompt exato** de um turno em que isso acontece, com
   `ferramentas/reconstruir-prompts.js`, e leia como um rei leria. A pergunta:
   *daria para saber, so lendo isto, quais tropas minhas estao longe do front?*
3. **Compare modelos.** O DeepSeek R1 (o mais forte medido) faz isso melhor que
   os `:free`? Se sim, e capacidade; se nao, e prompt.

### O que entregar

Alem do padrao: a **taxa de reforco retaguarda->front** medida nos replays, e
uma proposta de mudanca de prompt **com o texto exato** que entraria — para a
proxima sessao so precisar decidir sim ou nao.

> Lembrete de projeto: o prompt **informa, nao recomenda** (decisao do Lucas —
> foi por isso que o "para tomar AGORA" saiu). Uma proposta que mande o rei
> reforcar o front provavelmente sera recusada por esse motivo. Proposta que
> torne o CUSTO e a DISTANCIA visiveis, nao.

---

## 5. ITEM 4 — a barra de controle

**O mais simples dos quatro.** Nao precisa de investigacao profunda: precisa de
diagnostico correto e de uma proposta visual.

### O sintoma

Ao rodar uma partida, a barra com PLAY/PAUSE ocupa quase toda a largura, fica
sobre o meio do mapa, e carrega controles que nao fazem mais sentido (como
velocidade). O Lucas quer ela **menor e embaixo**.

### Primeiro passo: descobrir QUAL barra e

Ha pelo menos tres candidatas no `index.html`:

- **`#barraTopo`** (:592) — a barra de transmissao v5, no topo
- **`#replaybar`** (:699) — a do replay, que **ja esta embaixo**
  (`bottom: 14px`, centrada) e ja tem o seletor de velocidade `#grepVel`
- os botoes do painel de jogo (`#gplay`, :718)

O Lucas descreveu "grande, quase toda a tela, acima no meio do mapa, com coisa
como velocidade". **Confirme qual e antes de propor qualquer coisa** — de
preferencia rodando o jogo e olhando.

### O que entregar

- Qual elemento e, com prova.
- Que controles fazem sentido hoje e quais sao restos (o Lucas citou velocidade
  como resto — confirmar se ainda e usada em algum fluxo).
- Uma proposta de barra compacta e no rodape, **desenhada** (mockup HTML avulso
  em `experimentos/`, nao alteracao do `index.html`).
- Como ela se comporta nas larguras do ITEM 2 — os dois itens se tocam aqui.

---

## 6. Invariantes que a pesquisa nao pode quebrar

Da CLAUDE.md secao 6, e valem mesmo em experimento:

- **Marcha nunca por pixel** — sempre custo de rota. "O numero que o DECISOR LE
  tem de ser o que o MOTOR EXECUTA." Ja mordeu tres vezes.
- **Metricas vem do estado do motor** (`.replay.json`), nao de reparsear o
  `.txt`. "O `.txt` narra, o JSON mede."
- **Nao tocar** topologia/custos do `world-iberia.js`, nem o encaixe da imagem
  (escala 1.17613, xMidYMin slice).
- **UM ruleset so, sem opt-in.** Nao criar um segundo ruleset selecionavel para
  testar nada — houve um, e tres partidas pagas correram com as regras erradas.
- **Nunca apagar os `.replay.json`.**
- A suite tem de continuar verde: 29 testes + 7 smokes + `verificarEquilibrio()`
  = 0 falhas. Como esta pesquisa nao altera codigo de producao, rodar a suite no
  fim e so uma confirmacao de que nada escapou.

---

## 7. Entrega

No fim, **`pesquisa/2026-08-28/RESUMO.md`** com, para cada um dos quatro itens:

| campo | conteudo |
|---|---|
| estado | causa provada / hipotese forte / nao reproduzido |
| causa | uma frase |
| recomendacao | uma frase |
| custo | quantos arquivos, que risco, estimativa grosseira |
| bloqueio | o que precisa de decisao do Lucas antes de comecar |

E uma linha final: **em que ordem atacar os quatro**, com o porque.

O Lucas le o RESUMO primeiro e os relatorios so onde quiser fundo. Escreva o
RESUMO como se fosse a unica coisa que ele vai ler — porque pode ser.
