# RESUMO — pesquisa de 28/08/2026

Quatro problemas que o Lucas achou assistindo replays a 0.125x/0.25x.
**Nada de producao foi tocado** (confirmado: `git status` limpo em
`engine.js`, `index.html`, `world-iberia.js`, `ferramentas/`). Suite verde:
31 testes + 8 smokes + `verificarEquilibrio()=0`.

Cada item tem um relatorio completo nesta pasta. Este resumo e o suficiente
para decidir o que fazer a seguir; os relatorios sao para quando quiser o
fundo.

---

## Item 1 — exercitos se cruzam na estrada sem lutar

| campo | |
|---|---|
| **estado** | **causa provada**, e nao e a que a spec desconfiava |
| **causa** | duas estradas DIFERENTES do mapa (`cordoba-madrid` x `teruel-toledo`, e `burgos-toledo` x `madrid-salamanca`) se cruzam geometricamente no desenho — e o combate de estrada so compara exercitos no MESMO trecho, entao nunca testa esse par. Nao e falha de timing: e SEMPRE perdido |
| **recomendacao** | detectar cruzamentos geometricos entre estradas diferentes no motor (nao so mesmo-trecho), com uma 3a familia de combate. Mais barato: so rotear as 2 estradas para nao se cruzarem — tapa o caso de hoje, nao o geral |
| **custo** | rotear (barato, 1-2 linhas em `world-iberia.js`, mas o CLAUDE.md pede lote proprio para mexer la); detectar no motor (medio, mexe em `engine.js`, pede testes novos) |
| **bloqueio** | decidir entre conserto rapido (2 estradas) ou geral (qualquer cruzamento futuro) |

A hipotese original da spec (amostragem discreta perdendo cruzamentos por
timing) e **real mas desprezivel**: 1 caso em 5451 pares testados, contra 17
ocorrencias medidas do problema das estradas cruzadas, em 6 partidas
diferentes.

## Item 4 — a barra de controle

| campo | |
|---|---|
| **estado** | **causa provada**, com medida exata |
| **causa** | `#gamebar` tem largura FIXA de 1627px (14 controles numa linha sem quebra) — estoura QUALQUER tela abaixo disso (127% em notebook, 433% em celular). A altura reservada para o rodape (`--rr-h: 286px`) tambem e fixa, empurrando a barra para o MEIO vertical da tela em qualquer viewport abaixo de 725px de altura — medido, com 5px de sobreposicao real em 1280x720 |
| **recomendacao** | desenhar um mockup (sem tocar `index.html`) para o Lucas aprovar a forma, depois colapsar em 2 fileiras (essencial sempre visivel + resto num menu), no MESMO lote que o item 2 (mesma causa raiz) |
| **custo** | mockup: baixo. Implementacao: medio, so `index.html`, so CSS/layout, sem mexer em logica de jogo |
| **bloqueio** | aprovar a forma do mockup antes de implementar |

O slider "vel" (80-1200ms) e confirmado como resto: so importa para burro x
burro; para qualquer modelo real, a espera pela API (segundos a minutos) o
torna irrelevante. Os outros 13 controles ainda servem.

## Item 2 — a interface nao se adapta ao monitor

| campo | |
|---|---|
| **estado** | **causa provada**, mesma raiz do item 4 |
| **causa** | padrao repetido de medida FIXA em px (nao relativa a tela) em varios paineis: `--rr-h`, `--bt-h`, `--dp-h`, e a largura de `#gamebar`. Medido: em 1280x720, `#depoTopo` e `#gamebar` se sobrepoem de verdade (5px); os 3 paineis fixos empilhados somam 632px, que e 82-88% da altura de uma tela de notebook |
| **recomendacao** | trocar as variaveis de altura fixas por relativas (vh ou calculadas do elemento real), junto com o conserto do item 4 (mesmo arquivo, mesma area) |
| **custo** | medio, so `index.html` |
| **bloqueio** | nenhum — pode comecar assim que o item 4 for decidido, no mesmo lote |

Nao consegui confirmar com certeza absoluta (falta hardware de 2 monitores
neste ambiente) se trocar de monitor sem redimensionar a janela falha em
disparar o `resize()` do jogo — o mecanismo existe e e unico (so
`window.resize`, sem `ResizeObserver` nem `matchMedia` de resolucao), mas o
que esta provado e mais simples: mesmo com `resize()` disparando certo, o
layout ja quebra sozinho pelas medidas fixas acima.

## Item 3 — tropas na retaguarda

| campo | |
|---|---|
| **estado** | **causa provada**, mas a premissa original era so parcialmente certa |
| **causa** | o prompt mostra tempo de marcha pre-calculado SO para aldeias alvo (ataque) — nunca para aldeia-propria -> aldeia-propria. O bloco de rede de estradas mostrado ao modelo e topologia pura, sem nenhum peso. O modelo nao tem como saber quantos turnos leva para reforcar a fronteira a partir do interior |
| **recomendacao** | mostrar o peso de cada trecho no bloco ROAD NETWORK (`[1] (2 turns)` em vez de so `[1]`) — reaproveita um numero que o motor ja calcula |
| **custo** | baixo, so `engine.js`, mas precisa de testes novos em `testes/test_prompt_p4.js` (39 casos ja existentes, mudanca de texto do prompt) |
| **bloqueio** | nenhum |

**A premissa "os modelos deixam as tropas e nunca movem" NAO se sustenta**:
medido em 952 ordens de reforco, interior->border e a categoria MAIS COMUM
(43.6%). O que e real e mais sutil: 53.8% da forca de um rei fica parada em
aldeias sem fronteira durante turnos de combate, estavel a partida inteira
(nao concentrado numa fase) — e parte disso (medido num caso real, turno 13
de uma partida) e reino AINDA SEM fronteira nenhuma (expansao em curso), nao
negligencia.

---

## Ordem recomendada para atacar os quatro

1. **Item 3** (prompt: mostrar peso no ROAD NETWORK) — o mais barato dos
   quatro, isolado, sem depender de decisao de design. So `engine.js` +
   testes.
2. **Itens 2+4 juntos** (mesmo arquivo, mesma causa raiz — `--rr-h` fixo e a
   barra sem quebra). Comecar pelo mockup do item 4 para aprovar a forma,
   depois implementar os dois de uma vez.
3. **Item 1** (cruzamento de estradas) por ultimo, nao porque e menos
   importante — e o de MAIOR prioridade por afetar o benchmark — mas porque
   e o que exige mais decisao antes de comecar (rotear 2 estradas x detectar
   o caso geral no motor), e essa decisao merece ser tomada com calma, nao
   encaixada no fim de uma sessao.

Os quatro relatorios completos, os 3 scripts de medida (reutilizaveis se o
Lucas quiser rodar de novo depois de qualquer conserto) e os prompts
reconstruidos para leitura estao em `pesquisa/2026-08-28/`.
