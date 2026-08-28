# DIARIO — pesquisa 28/08/2026

## Item 1 — cruzamento nas estradas

- **17:20** Li engine.js:1290-1470 inteiro (enviarExercito, resolverChegada,
  posicaoRota, cruzaramNaEstrada, resolverCombateEstrada,
  detectarCombatesEstrada, avancarMovimentos, tick). Confirmado: o mecanismo
  existe, roda 1x por tick, e faz o teste `cruzaramNaEstrada` sobre TODOS os
  pares da lista `estado.movimentos` (O(m^2)).
- **17:25** Contagem bruta em todos os 53 replays: 72 eventos `combate_estrada`
  gravados, em 16 de 53 partidas. O mecanismo FUNCIONA as vezes — nao esta
  morto, a pergunta e a taxa de perda.
- **17:35** V1 do varredor: casava o MESMO movimento entre o frame N e o frame
  N+1 por assinatura (dono+origem+destinoPedido+caminho+turnosTotal), so
  testava cruzamento geometrico entre quem sobrevivia nos dois frames.
  Resultado: 760 pares checados, 1 cruzamento geometrico, sem evento.
  **Numero implausivelmente baixo — investigado antes de aceitar.**
- **17:40** Causa do numero baixo (BECO SEM SAIDA, mas instrutivo): validei a
  V1 contra o evento combate_estrada REAL mais facil de achar (P2
  nemotron-120b vs nemotron-550b, turno 12: A[10->11] x B[20->11], ambos com
  turnosRestantes=1 no frame 11). Os DOIS movimentos desaparecem do frame 12
  (um morreu no cruzamento, o outro seguiu/resolveu) — nenhum dos dois tem
  assinatura casavel no frame seguinte. A V1 e estruturalmente CEGA para o
  caso mais comum de colisao: dois exercitos que se resolvem no MESMO turno
  em que se cruzam. So testava sobreviventes.
- **17:50** V2: para CADA movimento do frame N, projeta 1 tick a frente
  (turnosRestantes-1) pelo PROPRIO caminho/turnosTotal, sem depender de achar
  o "par" no frame seguinte. Teste trocado de "segmentos se cruzam" (interseccao
  estrita) para "distancia minima entre os dois segmentos <= 6px" — porque o
  caso de convergencia no MESMO destino termina as duas cordas EXATAMENTE no
  mesmo ponto (toque na ponta, nao um X), e o teste de interseccao por sinal
  perde isso por construcao.
- **17:55** V2 rodada: 5451 pares, 621 encontros geometricos, 256 com evento,
  365 sem evento (58,8% de perda). **Numero suspeito por ser alto demais** —
  investigado antes de aceitar.
- **18:05** Causa (BECO SEM SAIDA, achado importante): inspecionei o maior
  arquivo (P2 nemotron-120b vs nemotron-550b, geom=75) turno a turno. O
  "cruzamento" mais comum e MUITAS setas de A e MUITAS de B convergindo na
  MESMA aldeia (ex.: Madrid, id 23) vindas de ESTRADAS DIFERENTES. Confirmado
  nos eventos reais do turno 10: cada exercito de A que chega ataca a
  GUARNICAO de Madrid (evento `combate`, via resolverChegada), NAO os
  exercitos de B que tambem estao chegando. Isso e o jogo funcionando CERTO —
  armadas que convergem por caminhos diferentes nao compartilham nenhum
  trecho de estrada, entao nao ha "estrada" para brigarem nela; elas fazem
  fila e brigam pela aldeia, uma de cada vez, que e exatamente o que
  resolverChegada faz. O teste de PROXIMIDADE (x,y) da V2 confundia "terminam
  perto no mapa" com "estavam no mesmo trecho" — falso positivo sistematico,
  nao um bug do jogo.
- **18:10** Decisao de metodo: abandonar o teste por distancia x,y. Reescrever
  usando a logica EXATA de cruzaramNaEstrada (que ja exige mesmo trecho
  lo/hi), com SUBAMOSTRAGEM dentro do intervalo de 1 tick (frame N ->
  frame N+1), interpolando turnosRestantes fracionario. A prova de H1 fica
  precisa: cruzaramNaEstrada falso no inicio do tick (k=0, ja testado pelo
  motor real), falso no fim (k=1, sera testado pelo motor no proximo tick),
  mas VERDADEIRO em algum k estritamente entre os dois — cruzamento que
  aconteceu segundo a propria definicao de posicao continua do jogo, e que
  a amostragem discreta (1x/turno) nunca teve chance de pegar.

## Item 4 — a barra de controle

- **19:10** Rodei o jogo de verdade (python servir.py, ja tinha .claude/launch.json
  configurado) e usei o navegador para medir, nao adivinhar. `#gamebar`
  (id confirmado pelo read_page: tem os botoes Play/Passo/Reiniciar, o slider
  "vel", os selects Rei A/Rei B, turnos, teto $, sem limite, olhos de,
  baixar log, salvar/ver replay, cinema) e a barra que o Lucas descreveu.
  NAO e a `#barraTopo` (essa so mostra estatisticas dos dois reis, sem
  play/pause) nem a `#replaybar` (essa so aparece durante um REPLAY, ja fica
  embaixo, e o Lucas estava falando de RODAR uma partida, nao ver replay).
- **19:15** Medido com `getBoundingClientRect()` em 3 larguras (as mesmas do
  item 2): 1280x720, 1366x768 (notebook comum), 1920x1080. Nas duas menores,
  a barra tem 119-127% da LARGURA da tela (estoura os dois lados, ~130-170px
  de controles ficam fisicamente fora da tela e sem clique) e fica a
  47-51% do TOPO (bem no meio vertical) — bate exatamente com "grande, quase
  toda a tela, acima no meio do mapa". Na maior (1920x1080) a largura cabe
  (84.7%) mas a altura nao: fica a 65% do topo, longe do rodape de verdade.
- **19:20** Causa raiz achada: `#gamebar { bottom: calc(var(--rr-h) + 12px) }`
  (index.html:458), e `--rr-h: 286px` e uma CONSTANTE FIXA em px
  (index.html:300) — nao e calculada do tamanho real de nenhum elemento, e
  nao e relativa a altura da tela. Em qualquer viewport com menos de ~1000px
  de altura, esses 286px (+ 12px de vao + 81px da propria barra ~ 380px)
  empurram a barra para acima do meio da tela. Isso e o MESMO padrao geral
  do item 2 (medida fixa em px que nao se adapta ao monitor) — os dois itens
  compartilham a causa, exatamente como a spec desconfiou.

## Item 2 — interface nao se adapta ao monitor

- **19:30** Em vez de so ler CSS, medi de verdade com o jogo rodando (mesma
  sessao de navegador do item 4) — `getBoundingClientRect()` de todos os
  paineis fixos, em 4 larguras: 375x812 (celular), 1280x720, 1366x768
  (notebook comum), 1920x1080.
- **19:35** Achado principal: em 1280x720, `#depoTopo` (rodape em 94-346px)
  e `#gamebar` (341-422px) SE SOBREPOEM DE VERDADE — 5px de overlap real,
  medido, nao suposto. A soma das alturas fixas dos 4 paineis empilhados
  (barraTopo 94 + depoTopo 252 + zona do gamebar ~90 + rodapeReis 286 = 722px)
  e MAIOR que a altura da tela testada (720px). Resolvendo a equacao dos
  paineis, o ponto exato de ruptura de ALTURA e **725px** — abaixo disso,
  depoTopo e gamebar se tocam ou se sobrepoem.
- **19:40** `#gamebar` sozinho (o mesmo do item 4) estoura a LARGURA em
  QUALQUER tela abaixo de 1627px — o que inclui a maioria dos notebooks.
  Em celular (375px) fica em 433% da largura, quase todo fora da tela.
- **19:45** Testei se ha algum mecanismo ALEM do evento `resize` para pegar
  troca de monitor (grep por matchMedia de resolucao, ResizeObserver,
  devicePixelRatio change listener): **so existe um**, o
  `window.addEventListener("resize", resize)` de index.html:823, que
  recalcula DPR (capado em 2) DENTRO do proprio resize(). Nao ha
  ResizeObserver nem matchMedia("(resolution:...)"). NAO CONSEGUI reproduzir
  com certeza absoluta, neste ambiente, o caso "so muda o DPR sem o browser
  redimensionar" (precisaria de hardware real com 2 monitores fisicos,
  trocando de um para o outro, o que este ambiente de teste nao tem) — sendo
  honesto: e uma suspeita plausivel, nao um fato provado. O que ESTA provado
  e mais simples e mais forte: mesmo com resize() disparando CORRETAMENTE, o
  layout quebra so por causa de medidas fixas em px.

## Item 3 — tropas na retaguarda

- **20:00** Repliquei a regra EXATA de fronteiraTag (engine.js:2254-2258) num
  script de medida (`medir-retaguarda.js`), usando a adjacencia publica de
  world-iberia.js — a mesma fonte que o prompt usa.
- **20:10** MEDIDA 1 (forca parada em INTERIOR, em turnos com combate em
  algum lugar do mapa): 864 amostras (rei x turno), media **53.8%**.
  Repeti por fase do jogo (inicio/meio/fim, por fracao do turno maximo):
  **56.0% / 56.5% / 50.4%** — bastante estavel, NAO concentrado numa "certa
  altura" especifica como a descricao do Lucas sugeria.
- **20:15** MEDIDA 2 (para onde vao os reforcos aldeia-propria->aldeia-propria):
  952 ordens medidas. **interior->border e a categoria MAIS COMUM (43.6%)**,
  na frente de interior->interior (26.9%) e border->border (29.2%).
  **Isto contradiz a premissa literal do pedido** ("os modelos deixam as
  tropas nas aldeias iniciais") — eles reforcam a fronteira ativamente, na
  maioria das vezes que reforcam algo.
- **20:25** Reconstrui os prompts reais de uma partida P4-EN (G2, 25/08) com
  `ferramentas/reconstruir-prompts.js` (sem editar nada, so leitura — saida
  em experimentos/prompts-reconstruidos-p4/). Achado qualitativo importante:
  no turno 13, o Rei A tem 12 aldeias e **TODAS SAO INTERIOR** — nao ha
  nenhuma fronteira ainda. Parte da "forca parada" da MEDIDA 1 pode ser isso:
  reinos em expansao que ainda nao tocam o inimigo, onde nao ha "frente" para
  mandar tropa nenhuma.
- **20:30** Confirmado H3 da spec, com evidencia de codigo: `marchaTexto`
  (engine.js:2199-2202) so e chamada para aldeias ALVO (neutras/inimigas,
  linhas 2284/2309) — NUNCA para a secao YOUR VILLAGES. O bloco ROAD NETWORK
  mostrado ao modelo (linha 89 do prompt reconstruido) e topologia PURA — so
  adjacencia (`[0] Lisboa (yours): [1], [2]`), sem nenhum peso/custo. Um
  modelo que queira saber quantos turnos leva para reforcar uma aldeia
  propria a partir de outra NAO TEM esse numero em lugar nenhum do prompt —
  teria de reconstruir o caminho mais curto sozinho, a partir so da lista de
  vizinhos, sem peso nenhum.

## Fechamento

- **20:45** Confirmado `git status` limpo em engine.js/index.html/world-iberia.js/ferramentas/
  — nada de producao tocado. Suite rodada: 31 testes + 8 smokes +
  verificarEquilibrio()=0, tudo verde.
- **20:50** RESUMO.md escrito. Os 4 relatorios (1-cruzamento-estradas.md,
  2-interface-monitores.md, 3-tropas-retaguarda.md, 4-barra-de-controle.md)
  e os scripts de experimentos/ estao prontos para a proxima sessao.

## IMPLEMENTACAO (28/08, Opus) — itens 2, 3 e 4

### Item 3 — engine.js
- Primeira tentativa: peso por ARESTA no bloco ROAD NETWORK. **REVERTIDA.**
  Com escalaMarcha 0.2, quase toda aresta isolada arredonda para "1t", e tres
  arestas de "1t" fariam o modelo esperar 3 turnos quando a rota inteira leva 2
  (o motor soma os CUSTOS e arredonda UMA vez). Seria um numero que o decisor le
  e o motor nao executa — a regressao que ja mordeu 3x (CLAUDE.md 6). Verificado
  com numeros reais antes de manter.
- Conserto certo: linha nova na secao YOUR VILLAGES, so em aldeia INTERIOR —
  `from here to your nearest border village [id]: N slow / N medium / N fast`.
  Calculado por `turnosDeCaminho` sobre a rota INTEIRA (a conta do motor).
- **Verificado contra o motor**: 6 pares conferidos enviando o exercito de
  verdade e comparando `turnosTotal` com o numero do prompt. 0 divergencias.

### Itens 2 e 4 — index.html
- `--bt-h/--dp-h/--rr-h` viraram `clamp(piso, vh, teto)`. Os TETOS sao os
  valores antigos: em 1920x1080 as alturas medidas sao 94/252/286, identicas —
  a transmissao do video nao muda.
- `#gamebar`: `flex-wrap` + teto de largura que respeita as duas colunas do
  rodape; desceu para `bottom: 14px` (o centro de baixo esta livre — a
  #replaybar ja tinha feito isso em 24/08 e a #gamebar nunca acompanhou).
- **Bug pre-existente achado na auditoria**: `#zoombar` nao tinha
  `position: fixed` (dependia da classe `.hud`, que o elemento nunca teve) —
  os botoes de zoom caiam no fluxo normal, ABAIXO DA DOBRA, sem clique.
  E um caso literal do "nao consigo clicar em alguns lugares" do item 2.
- Ponto de corte em 900px: abaixo disso o teto de largura ficava NEGATIVO
  (2x178 de piso das colunas > 375px) e a barra colapsava em 24x627. Na faixa
  estreita o rodape encolhe, a barra volta a subir, o editor de mapa some e o
  zoom vai para o topo. Barra com teto de 30vh e rolagem para nao engolir o
  mapa.
- Erro de processo: movi o bloco da media query com script e ele cortou um
  comentario ao meio, deixando CSS orfao dentro de `/* */`. Pego na medicao
  seguinte (a media query parou de aplicar), reparado a mao.

### Conferido no fim
5 resolucoes medidas com getBoundingClientRect (375x812, 1280x720, 1366x768,
1920x1080, 3840x2160): **0 sobreposicoes, 0 elementos fora da tela** em todas.
Suite: 31 testes + 8 smokes + verificarEquilibrio()=0, tudo verde. Console do
navegador sem erros.
