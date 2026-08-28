# CLAUDE.md — Arena dos Reis (Projeto Jogo)

Guia de contexto para qualquer modelo/agente que for trabalhar neste repositório.
Atualizado: 19/08/2026. Repo público: https://github.com/kbelin88/Projeto-jogo

---

## 1. O que é

Um **jogo de estratégia por turnos** onde **LLMs jogam como Reis** (Rei A vs Rei B)
disputando a conquista de aldeias no mapa da **Ibéria**. Não é só um jogo: é um
**benchmark** para medir *quão bem um modelo joga estratégia*, e está evoluindo para
um produto ("Arena dos Reis").

**Escada de degraus** (como se mede um modelo): `0 formato (JSON válido) → 1 grounding
(usa ids reais, não pede tropa que não tem) → 2 economia (rastreia o caixa) → 3
estratégia (concentração de força, tempo)`. O **DeepSeek R1** é o mais forte que passou
(candidato a degrau 3); modelos fracos travam no 1 ou 2.

O dono do projeto (Lucas) usa isto como espinha de um **estudo autodirigido de
Engenharia de Agentes de IA**. Método: conceito antes de código, uma peça por vez,
gabarito escrito antes de experimento, artefato publicado antes da próxima fase.

---

## 2. Arquitetura (arquivos que importam)

- **`engine.js`** — o MOTOR, puro e determinístico, roda em Node sem browser. Contém:
  - `criarEstadoInicial(config)`, `tick(estado)` (produção → construção → movimento+
    combate → endurecimento), `rodarTurno(estado, decisores)`, `checarVitoria` (só por
    ELIMINAÇÃO total: `jogadorVivo` = tem ≥1 aldeia).
  - `montarVisao(estado, dono, opcoes)` → a "visão" (relatório que o Rei recebe).
  - `montarPrompt(visao, opcoes)` / `relatorioTexto(visao, opcoes)` → o PROMPT em texto.
  - `jogadorBurro(visao)` → jogador-baseline burro (determinístico, sem LLM).
  - `resolverCombate` (COMBATE v3: ataque e defesa SEPARADOS — `atq`/`def` por tipo;
    triângulo counter ×1.25; bônus de terreno: aldeia ×1.25, castelo/capital ×1.5),
    `minimoParaTomar` (quantas tropas p/ conquistar; usa `preverCombateTipos`, a MESMA
    conta do combate), `turnosDeCaminho` (marcha = custo de rota × passoRef/velTropa).
- **`index.html`** — o JOGO NO BROWSER (é onde as partidas rodam de facto). Contém: o
  render em canvas, o loop `runDuelo`/`passoTurnoDuelo`, os clientes de API próprios
  (`gerarOpenRouter`, `gerarGemini`, `gerarGrok`, `gerarOllama`), o log `.txt`/RESUMO
  (`registrarTurnoLado`/`baixarLogGemini`), o replay `.json`, o cartão do espectador, o
  hover, o auto-save por turno. **~2900 linhas de JS inline num único `<script>`.**
- **`rei.js`** — cliente e decisor para o RUNNER headless (`clienteOllama/Gemini/
  OpenRouter`, `criarCliente`, `decidirRei`, `rodarPartidaRei`). ⚠️ É um cliente
  OpenRouter DUPLICADO do que está no `index.html` (dívida técnica conhecida — não
  unificar sem lote próprio).
- **`runners/rei_vs_rei.js`** — duelo LLM×LLM headless (linha de comando), grava `.txt`.
- **`world-iberia.js`** — o mapa autoral da Ibéria (cidades, estradas, custos de rota).
  `verificarEquilibrio()` TEM de devolver 0 falhas.
- **`world.js`** — mapa procedural antigo (fallback).
- **`servir.py`** — servidor HTTP local (`localhost:8000`). Necessário porque `file://`
  bloqueia fetch/localStorage/downloads. Rotas: `/salvar-mapa` (editor) e `/checkpoint`
  (auto-save do `.txt` por turno, sobrevive a crash).
- **`ferramentas/reconstruir-prompts.js`** — recupera o PROMPT EXATO de qualquer partida
  reexecutando o motor com as ordens gravadas no `.txt` e **verificando** o estado contra o
  replay `.json`. Detecta pelo cabeçalho se a partida foi P4 ou legado.
- **`ferramentas/alucinacao-espacial.js`** — E9: mede alucinação espacial nos raciocínios já
  gravados (adjacência, rota em turnos, ids inexistentes), sem gastar API. Deduz a
  `escalaMarcha` do **replay**, não do cabeçalho (que já mentiu).
- **`ferramentas/analisar-log.js`** — analisador pós-jogo (métricas do `.txt` + replay
  `.json`). Métricas: reforço-vs-ataque (pelo replay = estado do motor), distribuição de
  counter, taxa de ataque viável (conquistas/COMBATES, nunca /envios), cobertura de
  raciocínio, etc.
- **`ferramentas/tabela-modelos.js`** — gera **`MODELOS_ARENA.md`** (a tabela viva de quais
  modelos free servem para jogar) a partir de `modelos_free_openrouter.txt` (dump do catálogo)
  + **`resultados_arena.json`** (o que já foi medido, escrito à mão a cada bateria).
  ⚠️ **Não edite `MODELOS_ARENA.md` à mão** — edite o JSON e rode `node ferramentas/tabela-modelos.js`.
  A coluna "apto" é regra explícita (texto→texto, ctx ≥ 32k, saída ≥ 4k, não é router nem
  classificador), não gosto.
- **`testes/`** — 29 ficheiros de teste do motor (`test_*.js`). **`testes/test_prompt_p4.js`**
  (39 casos) cobre o P4, o fog e o parser tolerante. **`testes_arena/`** — 7 smokes; o
  **`Smoke5fog.js`** guarda a câmara do Rei e o **`Smoke6rede.js`** a resiliência a throttle
  de free-tier (com `fetch` falso: não toca a rede, não gasta cota). **`testes/test_lote_c.js`** cobre
  LOTE C/D (regressão byte-idêntica + features). **`testes/ref-lote-c/`** = os 3 outputs
  de referência da regressão. **`testes_arena/`** — 5 smokes que fazem `eval` do
  `index.html` num stub Node.

---

## 3. Como rodar

**Jogar/assistir (browser):** `python servir.py` → abre `http://localhost:8000/
index.html`. **NÃO abrir com duplo clique** (`file://` quebra chave/downloads/canvas).
A chave da API fica no `localStorage` do navegador (o jogo pede uma vez).

**Duelo headless:** `node runners/rei_vs_rei.js <backend:modelo> <backend:modelo> <seed>
<maxTurnos> <out.txt>` (ex.: `openrouter:deepseek/deepseek-r1 burro 1 40 out.txt`). Lê a
chave do `.env` (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GROK_API_KEY`).

**Bateria (headless, uma sessão inteira de partidas):** cada bateria tem uma spec própria
(`SPEC_TESTES_HEADLESS_<data>.md`), é conduzida por um agente e deixa tudo em
`resultados/p4-bateria-<data>/` — sondas, `.txt`, `.replay.json` e o `DIARIO.md`. Regra da
spec: **o condutor aponta o dedo, não julga** — a análise é do Lucas, depois.

**Testes:** `for f in testes/*.js; do node "$f"; done` + `node testes_arena/{Race,Smoke,
Smoke2,Smoke3duelo,Smoke4pausa}.js`. Invariante: `node --check` NÃO basta — usar
`testes/test_index_carrega.js` (roda o script inteiro).

---

## 4. Mecânica essencial (o que o modelo precisa saber pra jogar)

- **Vitória:** conquistar TODAS as aldeias do inimigo (eliminação). Partidas costumam
  terminar no limite de turnos (empate) se ninguém elimina o outro.
- **Combate:** número decide o vencedor; triângulo (lanceiro/arqueiro/cavaleiro, RPS)
  modula via counter ×1.25; o TIPO MAIS NUMEROSO define o matchup (desempate L>A>C). O
  vencedor SEMPRE sofre baixas (atrito 50% da força efetiva do perdedor). Defesa: aldeia
  ×1.25, capital ×1.5.
- **Recurso é POR ALDEIA** (não há caixa global): cada aldeia acumula madeira/ferro e
  gasta do estoque local pra construir. **Madeira é o gargalo** (ferro sobra).
- **Marcha pela REDE DE ESTRADAS** (não em linha reta), custo por trecho. Exército misto
  anda na velocidade da tropa MAIS LENTA (lanceiro lenta / arqueiro média / cavaleiro
  rápida). Marcha para na 1ª aldeia não-sua do caminho.
- **Envios de aldeias DIFERENTES não somam** no mesmo ataque (lutam um de cada vez) —
  para concentrar, reúna numa aldeia e ataque num envio só. Aldeias endurecem +1/5 turnos.
- **Neutras endurecem** (+1 do seu tipo a cada 5 turnos) → pegar cedo é melhor (tempo).

---

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

## 6. Convenções e INVARIANTES (não quebrar)

- **Commits: SEM rodapé de sessão.** Nada de `Co-Authored-By: Claude` nem link de
  conversa — o repo é PÚBLICO e o link expõe a conversa. Travado no settings.
- **Uma flag por vez / um commit por etapa** ao seguir uma spec de lote.
- **UM RULESET SÓ, sem opt-in (17/08).** O `CONFIG` **é** o jogo e pode ser mexido — ainda
  estamos a afinar, e comparabilidade com o histórico não é prioridade até haver YouTube e
  ranking. O `CONFIG_V3_ARQUIVO` é o ruleset antigo, congelado e **não jogável**: existe só
  porque `testes/test_lote_c.js` congela o texto do relatório contra estados gerados com ele.
  **Nunca crie um segundo ruleset selecionável em tempo de execução** — houve um, ligado por
  checkbox, e três partidas pagas (~$2.25) correram com as regras erradas enquanto o log dizia
  o contrário.

  > **O caso, por extenso** (era o §2 do handoff de 17/08, trazido para cá em 28/08 porque os
  > handoffs saíram do repo): o ruleset era escolhido por um checkbox (`gv4`). O estado da
  > partida nasce quando a página carrega — **antes** de a caixa ser marcada — mas o cabeçalho
  > do log lia a caixa **ao vivo**. Marcar e dar Play deixava o jogo em v3 com o log a dizer v4;
  > só `Reiniciar` depois de marcar é que aplicava, e ninguém sabia. Provado por dois números:
  > produção observada de **+10 madeira / +6 ferro** (o v4 dá 30/20) e **7 de 7 marchas** a bater
  > com `escalaMarcha` 1.0 em vez de 0.2.
  > **A lição não foi "faltou um listener"** — foi que uma regra que *pode* não estar ligada,
  > mais cedo ou mais tarde, não está.
- **Não tocar** em: topologia/custos do `world-iberia.js`; encaixe da imagem (escala 1.17613,
  xMidYMin slice).
- **Marcha nunca por pixel** — sempre custo de rota (`turnosDeCaminho`). Regressão dessa
  regra já mordeu 3x (L3/L4/B3): "o número que o DECISOR LÊ tem de ser o que o MOTOR
  EXECUTA" — uma regra, uma implementação.
- **Métricas vêm do estado do motor** (replay `.json`), não de reparsear o `.txt`. "O
  `.txt` narra, o JSON mede."
- **O log tem de descrever a partida que CORREU**, não a intenção do painel. O cabeçalho de
  condições lê de `game.config`. Já mentiu uma vez (texto fixo "dist x2/3" depois da escala
  mudar) e escondeu o bug do ruleset por um dia inteiro.
- **Suíte tem de ficar verde** (23 testes + 5 smokes + `verificarEquilibrio()=0`) antes
  de commitar.
- Sprite de aldeia é desenhado LEVANTADO (base em `baseVisualIB`, não na âncora crua) —
  já mordeu no hit-test do hover e nas estradas.

---

## 7. Estado atual (28/08/2026)

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

**Testes:** 29 ficheiros no motor + 7 smokes + `verificarEquilibrio()` = 0. Destaque para
**`testes/test_ruleset_vivo.js`** (há um ruleset só e é o que pensamos) e
**`testes_arena/Smoke6rede.js`** (resiliência a throttle, com `fetch` falso — não gasta cota).

### 7.1 A Arena medida — três baterias (17, 18 e 19/08)

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
(f) 2 chaves expostas em 03/08 por revogar;
(g) `main` por consolidar + ~84 ficheiros por commitar;
(h) **`analisar-log.js` ainda não separa a taxa de counter por tipo de alvo** (neutra vs
inimigo) — é a recomendação nº 1 do relatório de 18/08 e não foi feita; sem ela, os números de
counter das baterias novas são agregados e não comparáveis com os de 17/08.

**Orçamento OpenRouter pago: ESGOTADO** (HTTP 403 no turno 25 de 17/08; recarrega ~fim de
agosto). Desde então tudo corre em modelos **`:free`**, com teto de **20 req/min e 1000/dia** —
e é esse teto, mais o relógio, que dimensiona uma bateria. Custo observado quando havia crédito:
~$0.041/turno com dois raciocinadores.
