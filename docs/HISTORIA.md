# HISTÓRIA — o que o CLAUDE.md dizia, e já não precisa de dizer

Em 22/09/2026 o `CLAUDE.md` tinha 643 linhas, três camadas de "estado atual"
(28/08 noite, 28/08 manhã, as baterias de 17-19/08) e pelo menos dez afirmações
que tinham deixado de ser verdade. Foi reescrito para dizer só o que é estável e
verdadeiro hoje, e **tudo o que saiu veio para aqui, tal e qual** — nada foi
apagado. Estas secções são o registo de como se chegou ao jogo de hoje, com os
números e as decisões de cada dia.

⚠️ **Isto é HISTÓRIA.** Números e regras daqui podem estar desatualizados (o
counter já foi 1.25, a vitória já foi só por eliminação, o cliente de OpenRouter
já foi duplicado). O que vale hoje está no `CLAUDE.md`, e há um teste
(`testes/test_guia_verdadeiro.js`) que confere o guia contra o jogo.

---

# O prompt e o sistema de flags, na versão longa (até 22/09)

## 5. O PROMPT (P4, atual) e o sistema de flags

O relatório que o Rei vê é montado em `relatorioTexto`. Evoluiu por LOTES, cada
alteração de texto ATRÁS DE UMA FLAG (default ligada), e com **todas as flags a `false`
o output é BYTE-IDÊNTICO** ao P2 original (o lote de logs de controlo continua válido).

Flags (em `cfg`, lidas como `cfg.X !== false`, override por `opcoes.X`):
`promptP3` (LOTE B), `marchaComOrigem`, `redeComDono`, `marcarFronteira`,
`contagemAgregada`, `rotulosExpectativa` (LOTE C), `deltaDefesa`, `memoriaAlvo` (LOTE D).

O que o P3 mostrava que o P2 não mostrava: `defesa efetiva (inclui bonus do
local)`, `tropas em casa: N/300`, `marcha desde [id]: L lenta / M media / R rapida`,
tags FRONTEIRA/INTERIOR, donos na rede de estradas, `TOTAL:` de tropas, `para tomar
AGORA`, `(era X ha N turnos)` de defesa, `voce atacou aqui Nx nos ultimos 8 turnos`.

### 5.1 P4 — o prompt VIVO (17/08/2026)

**O jogo usa o P4.** É em **inglês**, tem **fog of war**, e **não tem exemplo**. Flags no
`CONFIG`: `promptP4: true` e `fogOfWar: true`, lidas como **`=== true`** (e não `!== false`
como as flags de lote) para que os estados congelados do `test_lote_c`, gerados com
`CONFIG_V3_ARQUIVO`, continuem a render o texto legado byte a byte.

- `montarPrompt` / `relatorioTexto` fazem **dispatch**: com `config.promptP4 === true` vão
  para `montarPromptP4` / `relatorioTextoP4`; `opcoes.promptP4 === false` força o legado.
- O renderizador legado (`montarPromptLegado`, `relatorioTextoLegado`) está **intocado** e
  continua a ser o que reproduz os logs antigos.
- Tokens do protocolo continuam PT (`construir`/`envios`, `lanceiro`/`arqueiro`/`cavaleiro`).
  Só a **prosa** é inglesa. `normalizarTipo` aceita os nomes ingleses como sinónimos,
  **com registro** em `normalizacoes`.
- O que o P4 diz e o P2/P3 não diziam: a **condição de vitória real** (75%/2 turnos, com o
  progresso ao vivo), a **simultaneidade** das ordens, o **reforço a aldeia própria** como
  mecânica, o **endurecimento das neutras**, e o **corte de 600 chars** do plano.
- O que **saiu**: o exemplo JSON com valores (virou **esquema declarado**, com os três tipos
  sempre enumerados juntos), o `para tomar AGORA` (o mínimo pré-calculado saiu do jogo por
  decisão do Lucas: *o prompt informa, não recomenda*), e a frase que **proibia reforçar**.
- `construir` aceita **`quantidade`** (ou `count`): `parsearOrdem` expande em N ordens de 1,
  então motor, diagnóstico e log continuam a ver ordens unitárias.

### 5.2 Fog of war

`estado.visto[dono][id]` guarda a última fotografia que cada Rei teve de cada aldeia
(turno, dono, tropas). Escrito por `registrarAvistamentos`, chamado no fim do `tick` —
a memória é **do motor**, porque o modelo é stateless.

Visibilidade (`visiveisPara`): aldeias próprias + **vizinhas diretas na rede** + o destino
efetivo de cada exército próprio em marcha. A **topologia é sempre pública** — o fog esconde
estado (dono, guarnição, defesa), nunca geografia; a localização da capital inimiga também
é pública.

**Explorar é conquistar.** Não há unidade de reconhecimento, e uma marcha para na 1ª aldeia
não-sua do caminho — então o destino iluminado é quase sempre um vizinho já visível. Quem
quer ver o mapa tem de tomar aldeias; o cavaleiro pesa nisto por ser rápido, não por ver
longe. (O `testes_arena/Smoke5fog.js` apanhou esta afirmação exagerada num handoff.)

O fog é **do relatório**: `montarVisao` continua a carregar todos os alvos (com `visivel` e
`visto` anotados), então motor, `jogadorBurro` e espectador seguem omniscientes.

### 5.3 Free-tier: o throttle é a maior causa de morte de partida

Medido em 17/08: as duas primeiras partidas em P4 morreram com **HTTP 429 do
`glm-5.2:free`** — provedor único (Decart), `limit_source: upstream_provider_shared_pool`,
`retry_after_seconds: 5`. O Nemotron 3 Ultra fez 5 chamadas sem um erro.

O cliente (`gerarOpenRouter`) **honra o `Retry-After`** (header ou `retry_after_seconds` do
corpo), com teto de 45s por espera e `MAX_TENT_OR = 9` tentativas. Acima dele,
`deliberarComRetentativa` repete a **deliberação** até 2 vezes em erro de rede — seguro
porque no caminho de ordens simultâneas nada foi aplicado ainda, e repete a **chamada**,
nunca o **parse** (JSON quebrado continua sem segunda chance: é o degrau 0 do benchmark).

O log passou a registar o throttle que a partida **sobreviveu** (`THROTTLE: N x 429/503
recuperado(s)`, `RETENTATIVA DE TURNO: N`, e um campo no RESUMO) — sem isso um modelo que
precisa de 5 tentativas por turno parecia igual a um que responde de primeira.

**Latência importa mais que custo em free-tier:** Nemotron 3 Ultra 550B tem mediana de
**167 s/turno** (máx. 264 s) contra 5.9 s do GLM 5.2. Quatro turnos = 11 min; 20 turnos ≈ 1h45.

**Atualização 18/08 (60 turnos medidos por partida, mediana por lado tirada do campo `| ms N`
do próprio log):** a dispersão é de duas ordens de grandeza — `nemotron-nano-12b-v2-vl` **7 s**,
Lightning **128–196 s**, Ultra 550B **324 s**, `laguna-xs-2.1` **1200 s** num turno só. Fora
isso, o throttle deixou de ser a maior causa de morte: das 4 partidas de 18/08, **1** caiu por
erro de rede (e o mesmo modelo correu 30/30 limpos horas depois, no mesmo dia — se fosse teto
diário não teria voltado). As outras falhas foram **do modelo**, não da rede: resposta cortada
no teto (`finish length`), degeneração por repetição, e `construir: []` sem erro nenhum.

**A câmara do Rei (UI):** o seletor `olhos de` (`#gvisao`) no painel escurece o que o Rei
escolhido não vê, marca as lembradas com `T<turno do último avistamento>` em pontilhado, põe
`?` nas nunca exploradas, e mostra uma etiqueta `ve N · lembra N · nunca viu N`. É só câmara
— lê `Engine.visiveisPara` e `game.visto`, as mesmas fontes do prompt, e não toca no estado.
Funciona com a partida pausada, a correr e dentro de um replay. Trancado por
`testes_arena/Smoke5fog.js`.

---

---

# O estado do projeto de 17/08 a 28/08 (as três camadas)

## 7. Estado atual (28/08/2026, fim do dia)

### A pasta foi reorganizada (28/08)

A raiz tinha 31 ficheiros `.md` e 45+ entradas; ficou com **27 entradas** e o que está
**vivo**. Tudo o resto foi para **`arquivo/`** — nada apagado. Ver `arquivo/LEIA-ME.md`.

⚠️ **Três coisas NÃO saíram da raiz, e mover qualquer uma parte algo:**
- **`mapa-ajustes.js`** — o `index.html` carrega-o por `<script src>`. ⚠️ O editor de mapa
  que o gravava **saiu em 22/09** (arrastava cidades no canvas plano, que já não existe);
  quem escreve neste ficheiro agora é o `ferramentas/tracar-rede.html`. A lição continua a
  valer, e agora para o `marcas.js` e o `ponte3d.js`: um `<script>` que dá 404 **falha em
  silêncio** — foi por isso que nasceu o `testes_arena/Smoke12modulos.js`.
- **`checkpoints/`** — caminho de escrita cravado no `servir.py:87`.
- **`docs/`** — dois comentários de código apontam para `docs/ACHADO_..._truncamento_ollama.txt`.

Ficheiros vivos na raiz: `CLAUDE.md`, `README.md`, `MODELOS_ARENA.md`, `ANTES_DO_MES_PAGO.md`,
`PLANO_DIA_*`, `HANDOFF_*`.

### Ferramentas novas (28/08)

- **`ferramentas/dump-modelos-free.js`** — gera `modelos_free_openrouter.txt` do catálogo AO
  VIVO. Existe porque o dump era manual e por isso ficou 10 dias parado enquanto o catálogo
  rodava por baixo. Conferir o catálogo é o passo 1 de toda bateria.
- **`ferramentas/medir-tropa-inicial.js`** — a métrica das aldeias de partida (ver §7 item 1).
  Validada contra a linha de base antes de ser usada.
- **`testes_arena/Smoke8estrada.js`** — tranca os quatro canais do combate de estrada e
  confronta os 19 campos que a UI lê contra um evento real do motor.

### Combate de estrada: o jogo passou a mostrá-lo (28/08)

Acontecia e não aparecia — 16 combates nas duas partidas do vídeo, nenhum visto. Quatro canais
do `index.html` excluíam o evento pela mesma condição `e.tipo !== "combate"`. Agora todos o
tratam; o evento do motor ganhou campos aditivos (origem/destino dos dois exércitos, forças
efetivas, composição aniquilada, baixas do vencedor); a câmera tem prioridade
**conquista > combate de estrada > assalto repelido** e aponta ao ponto da estrada.

**A cena** são duas batidas: choque em raios de DUAS cores (0 ms) e o estandarte do perdedor a
tombar (350 ms). **Não usa anel nem número flutuante** — em 25/08 o Lucas tirou os dois da
conquista ("círculos piscando e número de tropas mortas poluem o momento").
⚠️ **O aspeto nunca foi visto por ninguém** — é o item 1 do `ANTES_DO_MES_PAGO.md`.

---

#### 7.0 Estado anterior (28/08/2026, manhã)

✅ **`main` está em dia e sincronizada com `origin/main`.** A `spec-lote-e-fairness` já foi
mesclada. As 4 branches não mescladas (`exp-cautela-2x2`, `exp-duas-fases`, `exp-exemplo-ancora`,
`sonda-admissao-8b`) são experimentos antigos e **não devem ser promovidas** — o `exp-duas-fases`
teve resultado negativo (decompor a saída piora).

### O que o GitHub guarda, a partir de 28/08

**Decisão do Lucas: o repo público é BACKUP DE CÓDIGO E MOTOR, e mais nada.** Ficam de fora, no
`.gitignore` (continuam no disco, só não são versionados):

| fora do git | porquê |
|---|---|
| `resultados/`, `traces/` | 78 MB de partidas; o `.txt` é raciocínio cru de modelo |
| material de vídeo (`PLANO_VINHETA_*`, `NARRACAO.md`, `FOLHA_DE_TEMPOS.md`, `ferramentas/vinheta/`, `ROTEIRO_VIDEO_01.md`, `PLANO_VIDEO_*`) | plano de canal, não é código |
| imagens de plano (`IMAGEM-JOGO.png`, `MAPASITE.png`, `mapa.png`, `assets/banner_arena.png`, `assets/Generated Image*`) | mockup, não é asset do jogo |
| `HANDOFF_*`, `SESSAO_*`, `.claude/` | registro de sessão |

⚠️ **Os assets que o JOGO carrega continuam versionados** — `ilha-recortada.png`,
`agua-textura.png`, `brasoes/`, `sprites/`. Conferido: o `index.html` só referencia esses quatro
grupos, e todos estão rastreados. Não mexer nisso sem reconferir.

⚠️ Untrackear não apaga o histórico: o que já foi pushado antes de 28/08 continua nos commits
antigos do GitHub.

### Correções de 28/08 (motor + interface)

Saíram de uma pesquisa de 4 itens (`pesquisa/2026-08-28/`, com `REVISAO-OPUS.md` corrigindo
duas conclusões erradas do relatório original). Três implementadas; a quarta ficou para depois.

1. **Prompt: distância da retaguarda à frente** (`engine.js`, secção YOUR VILLAGES). Cada aldeia
   INTERIOR passa a mostrar `from here to your nearest border village [id]: N slow / N medium /
   N fast turns`. Medido em 53 replays: **um terço da força de um rei fica parada nas aldeias de
   partida a partida inteira**, e o relatório nunca dava o custo de mover entre aldeias próprias.
   ⚠️ **Há DUAS métricas parecidas e elas não são a mesma** — a troca já enganou uma vez:
   **INICIAIS** (capital + anel 1) = 34.1%, e é esta a afirmação acima, medida por
   `ferramentas/medir-tropa-inicial.js`; **INTERIOR** (aldeia sem vizinho inimigo) = 53.8%,
   medida por `pesquisa/2026-08-28/experimentos/medir-retaguarda.js`. Uma aldeia conquistada no
   meio do mapa é INTERIOR mas não é inicial.
   **Medida em 28/08** (repetição exata das duas partidas do vídeo, único delta = esta linha):
   30.3% → **25.2%**, e o ganho está quase todo na ABERTURA (38.6% → 23.5%); o fim de partida
   praticamente não mexeu. Direção consistente em 2 de 2 seeds, mas **n=2 e as duas referências
   diferem entre si em 20 pontos** — sugestivo, não estabelecido. Ver
   `resultados/p4-bateria-0828/DIARIO.md`.
   ⚠️ **Uma primeira versão pôs o peso em cada ARESTA da rede e foi revertida**: com
   `escalaMarcha 0.2` quase toda aresta arredonda para "1t", e três "1t" fariam o modelo esperar
   3 turnos onde a rota leva 2 (o motor soma os custos e arredonda **uma vez só**). Era um número
   que o decisor lê e o motor não executa — a regressão da secção 6. **Não repor peso por aresta.**
2. **Layout que se adapta à tela** (`index.html`). `--bt-h/--dp-h/--rr-h` eram px cravados
   (94+252+286 = 632px de UI fixa em qualquer tela); viraram `clamp(piso, vh, teto)`, com os
   **tetos iguais aos valores antigos** — em 1920x1080 o layout fica idêntico, e a transmissão do
   vídeo não muda. Ponto de corte em 900px para tela estreita.
3. **A barra de controlo desceu** (`index.html`). Tinha 1627px de largura FIXA (estourava
   qualquer tela abaixo disso, 433% num telemóvel) e era empurrada para o meio do mapa. Agora
   quebra linha, tem teto de largura que respeita as colunas do rodapé, e fica em `bottom: 14px`
   — o centro de baixo já estava livre desde 24/08, quando a `#replaybar` desceu.
4. **Bug pré-existente corrigido:** `#zoombar` não tinha `position: fixed` (dependia da classe
   `.hud`, que o elemento nunca teve) — os botões de zoom caíam no fluxo normal, **abaixo da
   dobra e sem clique possível**.

Verificado com `getBoundingClientRect()` em 5 resoluções (375x812, 1280x720, 1366x768,
1920x1080, 3840x2160): **0 sobreposições, 0 elementos fora da tela**. Suíte verde.

- **LOTES A→D** — instrumentação, prompt P3, visão de mapa, diagnóstico+memória.
- **LOTE E** — fairness do turno: ordens simultâneas (A1), interceptação na chegada (A3),
  desempate de estrada sem viés (A4), `| ms N` no log (A2), teto configurável (A6), 4 métricas
  no analisador (E7). Ver `RELATORIO_LOTE_E.md`.
- **RULESET (17/08)** — o que era o "reboot v4" **é agora o jogo**, sem toggle:
  produção madeira 30 / ferro 20, counter 1.5, cavaleiro def 2 em 1 turno, `escalaMarcha` 0.2
  (Lisboa→Barcelona 6 turnos, era 27), `dicaNeutras` false, vitória por ≥75% das aldeias por 2
  turnos. O `CONFIG_V3_ARQUIVO` guarda o antigo, não jogável.
- **TRANSMISSÃO v5** — barra longa no topo (modelo, aldeias, tropas, composição L/A/C
  empilhada, madeira, ferro, deltas, turno ao centro) e dois quadros no rodapé (depoimento do
  turno + benchmark ao vivo com custo em US$). Painéis laterais fora por CSS.
- **RESUMOS DO REI** (flag `resumosDoRei`) — `plano` volta no prompt do turno seguinte;
  `depoimento` não volta nunca, vai só para a tela e o `.txt`.
- **RUNNER GRAVA REPLAY (18/08)** — `runners/rei_vs_rei.js` escreve `<saida>.replay.json` ao
  lado do `.txt`. Era o maior buraco de ferramenta: sem ele, métricas A3 e reconstrução de
  prompt ficavam cegas em toda partida headless. **Nunca apagar os `.replay.json`.**

**Testes:** 30 ficheiros no motor + 13 smokes + `verificarEquilibrio()` = 0. Destaque para
**`testes/test_ruleset_vivo.js`** (há um ruleset só e é o que pensamos) e
**`testes_arena/Smoke6rede.js`** (resiliência a throttle, com `fetch` falso — não gasta cota).

#### 7.1 A Arena medida — três baterias (17, 18 e 19/08)

O P4 + fog deixaram de ser teóricos: **9 partidas de LLM contra LLM** já correram sob eles.

| bateria | o que correu | registro |
|---|---|---|
| 17→18/08 | 5 partidas completas, 222 req, zero interrompidas | `RELATORIO_BATERIA_P4_2026-08-18.md` |
| 18→19/08 | 10 sondas + 4 partidas (3 completas, 1 interrompida no t7), ~207 req, 11h40 | `resultados/p4-bateria-0818/DIARIO.md` |
| 19/08 | **planeada, ainda não corrida** | `SPEC_TESTES_HEADLESS_0819.md` |

**Estado do catálogo:** 18 modelos free, **14 aptos**, todos já sondados; **6 já jogaram**
partida. Quem está onde, e por quê, está em `MODELOS_ARENA.md` — leia-a antes de gastar cota.
Régua da tabela: `nvidia/nemotron-3.5-lightning:free` (9 lados). Mais forte medido:
`nemotron-3-ultra-550b-a55b` e `nemotron-3-super-120b-a12b`.

**O que as baterias ensinaram (e que muda como se testa):**

1. **A primeira vitória por dominância do projeto** aconteceu no T24 de 17/08 (Super 120B).
   A regra dos 75%/2 turnos está no ponto de tensão: 3 partidas tocaram o limiar, 1 converteu.
   `maxTurnos` subiu de 25 para **30** por causa disto.
2. **"Quem constrói menos lanceiro ganha" está EM ABERTO.** Valeu 5 de 5 em 17/08
   (correlação +0.80 entre ataque médio por unidade e aldeias finais) e **falhou 2 de 3 em
   18/08**: no espelho venceu o lado com 94% de lanceiro, e o `nano-12b-v2-vl` perdeu com o
   maior atq/unid já medido (3.29). Não trate como facto.
3. **Sonda de 1 turno não prevê latência nem estabilidade.** `laguna-s-2.1` deu 5 s na sonda e
   181 s de mediana em jogo, degenerando (repetia a mesma frase até estourar o teto);
   `nano-12b-v2-vl` deu 5.6 s e entregou 19 de 30 turnos. Por isso a spec de 19/08 usa
   **sonda de 3 turnos** e teto de latência de 180 s.
4. **Dá para falhar sem erro nenhum.** `laguna-xs-2.1` passou 20 minutos "a pensar", gastou os
   12401 tokens de resposta no raciocínio e devolveu `construir: []` com `finish: error` — sem
   uma linha de erro de rede. Modo de falha novo, e caro se apanhar uma partida.
5. **O catálogo `:free` roda rápido:** 3 dos 8 modelos de 17/08 morreram (404) em menos de 24 h.
   Conferir o catálogo é a primeira coisa de qualquer bateria.
6. **O custo agora é relógio, não dólar.** Partidas de 30 turnos levaram de **2h09 a 4h14**; a
   bateria de 18/08 levou 11h40 para 4 partidas. A spec de 19/08 tem regra de aborto por
   projeção de tempo (acima de 5 h, corta).

**Próximo passo:** correr a bateria de 19/08 (`SPEC_TESTES_HEADLESS_0819.md`) — sondas de 3
turnos dos 5 aptos que nunca jogaram, repetição do `nano-12b-v2-vl` (os 11 turnos perdidos
repetem?), espelho com seed 3 (fecha o trio 18×4 / 16×8 / ?) e dois modelos novos contra a régua.

**Abertos:**
(a) **monocultura/composição** — medida três vezes, ainda sem veredito (ver 7.1 §2);
(b) cavaleiro **resolvido** (95 construídos em 17/08, 62 e 110 em 18/08);
(c) **entesouramento** — envios de 1 tropa caíram de 62 em 90 (69%) para **6–35%** dos envios
em 18/08; o P4 parece ter resolvido, falta confirmar num relatório;
(d) **respostas vazias voltaram com outra cara**: não são erro de rede, são `construir: []` com
`finish error`/`length` (laguna-xs-2.1, nano-12b-v2-vl, e o próprio Lightning em 18 dos 30
turnos de um lado do espelho);
(e) cliente OpenRouter **duplicado** (`rei.js` × `index.html`) — a dívida continua;
(f) ~~2 chaves expostas em 03/08 por revogar~~ — **feito**: revogadas pelo Lucas em agosto
(confirmado por ele em 11/09). Não voltar a listar como pendente;
(g) ~~`main` por consolidar~~ — **feito**: `main` limpa e sincronizada (28/08);
(h) ~~counter por tipo de alvo no `analisar-log.js`~~ — **estava feito desde 20/08** e a nota é
que ficou para trás. É `counterPorAlvoDe` (`analisar-log.js:383`); exige o `.replay.json` como
2º argumento, senão o relatório diz "indisponível: sem replay". Confirmado a correr em 28/08.

**Orçamento OpenRouter pago: ESGOTADO** (HTTP 403 no turno 25 de 17/08; recarrega ~fim de
agosto). Desde então tudo corre em modelos **`:free`**, com teto de **20 req/min e 1000/dia** —
e é esse teto, mais o relógio, que dimensiona uma bateria. Custo observado quando havia crédito:
~$0.041/turno com dois raciocinadores.

---

---

# O método do soldado, na versão longa (13/09)

### 8.6 Como se corrige um soldado (o metodo, 13/09)

Durante dois dias o ciclo foi: eu exportava, o Lucas via o video, descrevia o
defeito por palavras ("uma imagem borrada da cor da bota"), e eu adivinhava a
causa. Lento e pouco fiavel — cada volta custava um forno inteiro e acertava
por sorte. **A regra que substitui isso: cada defeito que ele consegue VER tem
de virar um numero ou uma imagem que EU consigo ver, antes de tentar corrigir.**

Tres provas, todas escritas pelo `armar_lanceiro.py`, todas automaticas:

| prova | o que responde | onde sai |
|---|---|---|
| **pesos por cor** | de que OSSO e cada vertice | `_saida/pesos_{frente,lado}.png` |
| **lanca x bota** | a haste separa-se do pe no ciclo? | `varia N cm` (avisa abaixo de 4 cm) |
| **pe x anca** | o pe passa a frente da anca? | oito numeros, um por quadro |
| **ilhas por cor** | de que pedacos a malha e feita | `ilhas_cor.py` -> `_saida/ilhas_*.png` |

A primeira apanhou, em UM render, o que sete tentativas de adivinhar nao
apanharam: a metade de baixo da haste estava pintada da cor da BOTA. Nao havia
mais nada para discutir.

| **marca da lanca** | que madeira vai com a mao | `_saida/marca_lanca_{todo,pes}.png` |

**E a causa, que vale para qualquer asset que venha de fora. Sao DUAS hastes.**
O ComfyUI gerou a lanca duas vezes: uma vara SOLTA por dentro do modelo (ilha
propria, 2529 vertices, raio 0,008 da altura) e a que se VE, soldada a ilha
grande. Marcar a ilha — que parecia obviamente "a lanca", por ser comprida e
fina (vao/largura 6,1, contra 2,7 das pernas e 2,1 do corpo) — deixou a de fora
presa a perna: na bancada apareceram **duas madeiras no chao**, uma certa e uma
a seguir o pe. Um render das ilhas por cor (`ilhas_cor.py`) fechou a questao num
olhar: toda a superficie visivel era da MESMA ilha.

A ilha serve na mesma, mas para outra coisa: da o **eixo exato** da lanca. Com
esse eixo medido, a separacao e limpa em toda a altura — madeira a 0,010-0,014
do eixo, corpo e bota a 0,04-0,11 — e um corte em **0,020** apanha as duas
hastes e nenhuma bota.

⚠ **Sem corte em altura.** Uma versao so apanhava acima do fundo da vara
interna, a supor que mais abaixo so havia bota; a PONTEIRA ficou de fora e era
exatamente ela que andava agarrada ao pe. O raio sozinho chega.

⚠ **O cilindro tambem apanha a BIQUEIRA DA BOTA**, que o eixo atravessa rente
ao chao — e ai o erro e ao contrario: em vez de madeira presa ao pe, fica um
pedaco de PE preso a mao, e a bota estica e borra a cada passo (foi o mesmo
"borrao" de antes, com outra causa). A madeira distingue-se por ser CONTINUA:
parte-se a marca em pedacos ligados e ficam so os que atravessam o modelo de
alto a baixo. Foram 757 vertices de bota fora.

⚠ **A MALHA NAO VEM CENTRADA EM X**, e o esqueleto e simetrico a volta de x=0.
As pernas estavam em -0,121 e +0,005 (meio em -0,058); separa-las por "x < 0"
punha uma perna inteira e metade da outra do mesmo lado, e dai saia um
afastamento de 0,110 num lado e 0,193 no outro. Nenhuma afinacao do numero
arranjava isso, porque o errado era o EIXO. Acha-se sem supor nada: numa fatia
a altura do joelho os x fazem dois montes com um vazio no meio — corta-se no
maior vazio e cada monte da uma perna.

⚠ **Apertar as pernas mexe na GEOMETRIA, nao nos ossos.** Estreitar so o
esqueleto deixa o osso a correr fora do tubo da perna e a deformacao parte. O
modelo vinha com 29 cm entre eixos num homem de 2 m (uma pessoa anda com 22);
`APERTO_PERNAS` encolhe o x por rampa, nada na anca e tudo da coxa para baixo,
e os ossos sao medidos DEPOIS, por cima do resultado.

⚠ A marca tem de ser posta ANTES de reduzir, e a lanca sai para um objeto seu,
reduz-se a parte e junta-se outra vez. Um grupo de vertices sozinho nao chega:
o `Decimate` faz a MEDIA dos pesos e dos 7883 marcados sobravam 25 acima de 0,5.

⚠ Saber onde esta a lanca tambem conserta a ALTURA: o alto da cabeca era um
palpite (contagem de vertices por fatia) e mentiu assim que a haste mudou de
densidade — o soldado saiu 15% mais pequeno sem um aviso. Agora e o vertice
mais alto que **nao** e da lanca.

---

