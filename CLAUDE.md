# CLAUDE.md — Arena dos Reis (Projeto Jogo)

Guia de contexto para qualquer modelo/agente que for trabalhar neste repositório.
Atualizado: 17/08/2026. Repo público: https://github.com/kbelin88/Projeto-jogo

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
  o contrário. Ver `HANDOFF_2026-08-17.md` §2.
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

## 7. Estado atual (17/08/2026)

⚠️ **`main` local está DESATUALIZADA** (`1ee5cc2`, 03-04/08). Todo o trabalho recente está na
branch **`spec-lote-e-fairness`**. **Branches locais, ainda não pushadas.** O ponto salvo mais
recente é **`HANDOFF_2026-08-17.md`** — leia-o para retomar, sobretudo o §2 (o erro do dia).

- **LOTES A→D** — instrumentação, prompt P3, visão de mapa, diagnóstico+memória.
- **LOTE E** — fairness do turno: ordens simultâneas (A1), interceptação na chegada (A3),
  desempate de estrada sem viés (A4), `| ms N` no log (A2), teto configurável (A6), 4 métricas
  no analisador (E7). Ver `RELATORIO_LOTE_E.md`.
- **RULESET (17/08)** — o que era o "reboot v4" **é agora o jogo**, sem toggle:
  produção madeira 30 / ferro 20, counter 1.5, cavaleiro def 2 em 1 turno, `escalaMarcha` 0.2
  (Lisboa→Barcelona 6 turnos, era 27), `dicaNeutras` false (saiu "conquiste neutras primeiro"),
  vitória por ≥75% das aldeias por 2 turnos. O `CONFIG_V3_ARQUIVO` guarda o antigo, não jogável.
- **TRANSMISSÃO v5** — barra longa no topo (modelo, aldeias, tropas, composição L/A/C
  empilhada, madeira, ferro, deltas, turno ao centro) e dois quadros separados no rodapé
  (depoimento do turno + benchmark ao vivo com custo em US$). Painéis laterais fora por CSS.
- **RESUMOS DO REI** (flag `resumosDoRei`) — `plano` volta no prompt do turno seguinte (memória
  deliberada entre turnos); `depoimento` **não volta nunca**, vai só para a tela e o `.txt`
  (roteiro de narração). Funcionaram em 100% das respostas de DeepSeek R1 e Qwen3-235B.

**Testes:** 29 ficheiros no motor + 7 smokes + `verificarEquilibrio()` = 0. Destaque para
**`testes/test_ruleset_vivo.js`**: prova que há um ruleset só, que é o que pensamos, e que os
invariantes valem sob ele (produção observada = declarada, marcha executada = marcha prometida
no relatório, escala mesmo aplicada, `minimoParaTomar` == `preverCombate`).

**RULESET NOVO VALIDADO (17/08, partida Gemini × Nemotron):** duelo rei-contra-rei no **T8**
(era zero em 25 turnos), neutras esgotadas no **T15**, **95 cavaleiros** construídos (era 0 em
4 partidas). Ver `RELATORIO_PARTIDA_2026-08-17_1303.md`.

**P4 + FOG APLICADOS (17/08, sessão Fable):** as 12 incoerências do `ESTUDO_PROMPT_P4.md`
estão fechadas no código, sem testes de campo (decisão do Lucas: crédito a expirar). Ver
`HANDOFF_2026-08-17_P4.md` — **é o ponto de partida da próxima sessão.**

**Próximo passo:** a primeira partida real em P4 + fog. Nada foi medido com modelo de verdade.

**Abertos:** (a) monocultura — **nunca testada** com dois reasoners sob o ruleset novo, e agora
com o P4 há uma hipótese nova (era o exemplo do prompt que fixava `lanceiro`?); (b) cavaleiro
**resolvido** (95 construídos em 17/08); (c) **entesouramento** — 62 de 90 envios com uma tropa;
o P4 pode tê-lo mudado porque a instrução antiga **proibia reforçar** (ver handoff §2);
(d) 23 respostas vazias (13/08) não reapareceram; (e) cliente OpenRouter duplicado — **o P4 foi
aplicado nos dois**, a dívida continua; (f) 2 chaves expostas 03/08 a revogar; (g) `main` a
consolidar; (h) **P4 e fog sem nenhum teste de campo** — a maior thread aberta.

**Orçamento OpenRouter: ESGOTADO** (HTTP 403 no turno 25 de 17/08). Recarrega ~fim de agosto.
Custo observado ~$0.041/turno com dois raciocinadores.
