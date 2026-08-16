# CLAUDE.md — Arena dos Reis (Projeto Jogo)

Guia de contexto para qualquer modelo/agente que for trabalhar neste repositório.
Atualizado: 15/08/2026. Repo público: https://github.com/kbelin88/Projeto-jogo

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
- **`ferramentas/analisar-log.js`** — analisador pós-jogo (métricas do `.txt` + replay
  `.json`). Métricas: reforço-vs-ataque (pelo replay = estado do motor), distribuição de
  counter, taxa de ataque viável (conquistas/COMBATES, nunca /envios), cobertura de
  raciocínio, etc.
- **`testes/`** — 23 testes do motor (`test_*.js`). **`testes/test_lote_c.js`** cobre
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

## 5. O PROMPT (P2 → P3) e o sistema de flags

O relatório que o Rei vê é montado em `relatorioTexto`. Evoluiu por LOTES, cada
alteração de texto ATRÁS DE UMA FLAG (default ligada), e com **todas as flags a `false`
o output é BYTE-IDÊNTICO** ao P2 original (o lote de logs de controlo continua válido).

Flags (em `cfg`, lidas como `cfg.X !== false`, override por `opcoes.X`):
`promptP3` (LOTE B), `marchaComOrigem`, `redeComDono`, `marcarFronteira`,
`contagemAgregada`, `rotulosExpectativa` (LOTE C), `deltaDefesa`, `memoriaAlvo` (LOTE D).

O que o P3 (atual) mostra que o P2 não mostrava: `defesa efetiva (inclui bonus do
local)`, `tropas em casa: N/300`, `marcha desde [id]: L lenta / M media / R rapida`,
tags FRONTEIRA/INTERIOR, donos na rede de estradas, `TOTAL:` de tropas, `para tomar
AGORA`, `(era X ha N turnos)` de defesa, `voce atacou aqui Nx nos ultimos 8 turnos`.

---

## 6. Convenções e INVARIANTES (não quebrar)

- **Commits: SEM rodapé de sessão.** Nada de `Co-Authored-By: Claude` nem link de
  conversa — o repo é PÚBLICO e o link expõe a conversa. Travado no settings.
- **Uma flag por vez / um commit por etapa** ao seguir uma spec de lote.
- **Não tocar** em: valores de combate/triângulo/custos de unidade no `CONFIG` (mantém
  partidas comparáveis); topologia/custos do `world-iberia.js`; encaixe da imagem (escala
  1.17613, xMidYMin slice). **Exceção sancionada:** o rebalanceamento vive em
  `CONFIG_V4` (fork opt-in — ver §7); o `CONFIG` segue congelado e byte-idêntico.
- **Marcha nunca por pixel** — sempre custo de rota (`turnosDeCaminho`). Regressão dessa
  regra já mordeu 3x (L3/L4/B3): "o número que o DECISOR LÊ tem de ser o que o MOTOR
  EXECUTA" — uma regra, uma implementação.
- **Métricas vêm do estado do motor** (replay `.json`), não de reparsear o `.txt`. "O
  `.txt` narra, o JSON mede."
- **Suíte tem de ficar verde** (23 testes + 5 smokes + `verificarEquilibrio()=0`) antes
  de commitar.
- Sprite de aldeia é desenhado LEVANTADO (base em `baseVisualIB`, não na âncora crua) —
  já mordeu no hit-test do hover e nas estradas.

---

## 7. Estado atual (16/08/2026)

⚠️ **`main` local está DESATUALIZADA** (`1ee5cc2`, 03-04/08). Todo o trabalho recente
está na branch **`spec-lote-e-fairness`**, na linhagem: `... → spec-lote-c-visao →
spec-lote-d-memoria → spec-lote-e-fairness`. **Branches locais, ainda não pushadas.** O
ponto salvo mais recente é **`HANDOFF_2026-08-16.md`** — leia-o para retomar.

- **LOTES A→D** — instrumentação, prompt P3, visão de mapa, diagnóstico+memória (cada um
  atrás de flags; ver `RELATORIO_LOTE_C.md`/`_D.md`).
- **LOTE E** — fairness do turno (Fable 5): ordens simultâneas (A1), interceptação na
  chegada (A3), desempate de estrada sem viés (A4), `| ms N` no log (A2), teto configurável
  (A6), 4 métricas no analisador (E7). Ver `RELATORIO_LOTE_E.md`.
- **RULESET V4 (reboot de balanceamento, 16/08)** — a partir da análise da partida
  qwen×deepseek de 15/08 (monocultura de arqueiro = equilíbrio racional; triângulo morto;
  impasse por vitória-só-eliminação). 6 mudanças opt-in em `Engine.CONFIG_V4` (o `CONFIG`
  congelado segue default e byte-idêntico): counter 1.25→1.5, cavaleiro def1→2 e turnos
  2→1, madeira 10→15, `escalaMarcha=2/3` (centro 9→6 turnos), e **vitória por ≥75% das
  aldeias por 2 turnos** (além da eliminação). Toggle no browser (**⚔️ regras v4**,
  `#gv4`), 7º arg `v4` no runner. Testes em `testes/test_regras_v4.js` (12/12). Smoke
  free-tier confirmou: Nemotron 120b diversificou (72L/39A/5C); Gemini caiu em lanceiro-mono
  e PERDEU. Ver memória `ruleset-v4-reboot`.

**Próximo passo:** partida ao vivo **DeepSeek R1 × Qwen3-235B com regras v4** no browser
(Lucas vai assistir). A pergunta: dois reasoners fortes montam exército MISTO?

**Abertos:** (a) 23 respostas vazias (13/08) — instrumento pronto (D1/E5/E7), confirmação
na próxima partida real; (b) **monocultura ENDEREÇADA pelo v4** — falta confirmar em dois
reasoners fortes; (c) madeira 15 tenta lanceiro-spam (Fase 4) — Lucas manteve 15, v4 pune;
(d) cliente OpenRouter duplicado browser/runner — adiado; (e) 2 chaves expostas 03/08 a
revogar; (f) `main` a consolidar.

**Orçamento OpenRouter:** conta paga, **~$2.32 restantes** de $10 (16/08). Dá pra ~1
partida de 2 reasoners (~$1.7). `:free` = 50/dia compartilhado. Raciocinadores pesados
~$0.03/turno (out $2.3-10/M).
