# CLAUDE.md — Arena dos Reis (Projeto Jogo)

Guia de contexto para qualquer modelo/agente que for trabalhar neste repositório.
Repo público: https://github.com/kbelin88/Projeto-jogo

> **Este guia diz só o que é verdade hoje.** Reescrito em 22/09/2026, quando tinha
> 643 linhas, três camadas de "estado atual" e dez afirmações falsas (counter,
> regra de vitória, cliente de API, língua do protocolo…). O histórico saiu,
> tal e qual, para **`docs/HISTORIA.md`**. O `testes/test_guia_verdadeiro.js`
> confere os números deste ficheiro contra o jogo: **se mudar uma regra, mude
> aqui também, ou a suíte fica vermelha.**

---

## 1. O que é

Um **jogo de estratégia por turnos** onde **LLMs jogam como Reis** (Rei A vs Rei B)
disputando as aldeias do mapa da **Ibéria**. Não é só um jogo: é um **benchmark**
que mede *quão bem um modelo joga estratégia*, e é a matéria-prima de um canal de
YouTube em inglês (**The Kings Arena**: Vídeo 1 a 01/09, Vídeo 2 a 07/09).

**Escada de degraus** (como se mede um modelo): `0 formato (JSON válido) → 1
grounding (usa ids reais, não pede tropa que não tem) → 2 economia (rastreia o
caixa) → 3 estratégia (concentração de força, tempo)`. O achado mais forte até
hoje: **o que separa modelos é AGÊNCIA** (quantos envios faz, quanto tempo tem
exércitos fora de casa), **não validade** — ver `MODELOS_ARENA.md`.

O dono do projeto (Lucas) usa isto como espinha de um **estudo autodirigido de
Engenharia de Agentes de IA**. Método: conceito antes de código, uma peça por vez,
gabarito escrito antes do experimento, artefato publicado antes da próxima fase,
**nada se corrige antes de virar um número**.

---

## 2. Arquitetura

### O jogo

| ficheiro | o que é |
|---|---|
| **`engine.js`** | o MOTOR, puro e determinístico, corre em Node sem browser. `criarEstadoInicial`, `tick` (produção → construção → movimento+combate → endurecimento), `rodarTurno`, `checarVitoria`, `montarVisao` (o que o Rei sabe), `relatorioTexto`/`montarPrompt` (o prompt), `jogadorBurro` (o jogador-base, sem LLM), `resolverCombate`, `turnosDeCaminho` |
| **`world-iberia.js`** | o mapa autoral: 24 cidades, 37 estradas, custos de rota, e o PAR de cada cidade (a gémea do outro lado). `verificarEquilibrio()` TEM de devolver 0 falhas |
| **`index.html`** | o jogo no browser, onde as partidas do vídeo correm: o loop do duelo, o log `.txt`/RESUMO, o replay `.json`, o hover, a transmissão v5, o auto-save por turno. ~3 550 linhas num `<script>` inline |
| **`ponte3d.js`** | a ÚNICA porta entre a partida e o desenho: fog, posição das marchas (do motor), composição dos exércitos, conversão dos combates de estrada |
| **`marcas.js`** | o caderno de marcas (tecla M): o Lucas aponta um defeito no mapa e o Claude corrige na fonte. Fora do jogo de propósito |
| **`clienteor.js`** | o ÚNICO cliente de OpenRouter, partilhado pelo browser e pelo runner: honra o `Retry-After`, aprende o teto de resposta pelo HTTP 400 do modelo, conta throttles |
| **`rei.js`** | o decisor do runner headless (`criarCliente`, `decidirRei`, `rodarPartidaRei`); o OpenRouter vem do `clienteor.js` |
| **`runners/rei_vs_rei.js`** | duelo headless; grava o `.txt` e o `.replay.json` ao lado |
| **`servir.py`** | servidor local (`localhost:8000`). Rotas: `/checkpoint` (auto-save do `.txt` por turno), `/marcas` (o caderno), `/salvar-mapa` (só o `ferramentas/tracar-rede.html`) |
| **`sonda3d/`** | o mapa 3D (`mapa3d.js`, `batalha.js`) e as bancadas. Ficheiro a ficheiro no `sonda3d/LEIA-ME.md` |

### As ferramentas que importam

| ferramenta | para quê |
|---|---|
| `ferramentas/analisar-log.js` | métricas pós-jogo, do `.txt` **e do replay** (sem o replay, metade fica "indisponível") |
| `ferramentas/reconstruir-prompts.js` | recupera o prompt EXATO de qualquer turno, reexecutando o motor e conferindo contra o replay |
| `ferramentas/alucinacao-espacial.js` | mede alucinação espacial nos raciocínios gravados, sem gastar API |
| `ferramentas/tabela-modelos.js` | gera o `MODELOS_ARENA.md` a partir de `resultados_arena.json` + `modelos_free_openrouter.txt`. ⚠️ **Nunca editar o `.md` à mão** |
| `ferramentas/dump-modelos-free.js` | o catálogo `:free` ao vivo. Conferir o catálogo é o passo 1 de toda bateria |
| `ferramentas/medir-assento.js` | a mesa é neutra? (jogador-base contra ele próprio, dos dois lados) |
| `ferramentas/medir-tropa-inicial.js` | que parte da força fica parada nas aldeias de partida |
| `ferramentas/medir-cruzamentos.js` | colunas que se atravessam no desenho sem lutar (jogador-base, ou `--replay`) |

### Os testes

**33 ficheiros de teste** em `testes/` e **13 smokes** em `testes_arena/`. Os que
guardam mais:

- `test_prompt_p4.js` — o P4, o fog e o parser tolerante;
- `test_lote_c.js` / `test_lote_e.js` — regressão **byte a byte** contra baselines
  congeladas, com as flags novas desligadas (ver §5.4);
- `test_simetria_assento.js` — a mesa é neutra (ver §4);
- `test_sem_atravessar.js` — no replay, nenhuma coluna atravessa outra sem lutar;
- `test_ruleset_vivo.js` — há um ruleset só, e é o que pensamos;
- `test_guia_verdadeiro.js` — este ficheiro diz a verdade;
- `test_index_carrega.js` — o `index.html` corre inteiro (`node --check` NÃO basta);
- `Smoke5fog` / `Smoke8estrada` — correm a `ponte3d.js` a sério;
- `Smoke6rede` — resiliência a throttle, com `fetch` falso (não gasta cota);
- `Smoke12modulos` — os três módulos continuam ligados ao jogo.

⚠️ Cinco smokes fazem `eval` do `<script>` do `index.html` num DOM de mentira, e
por isso **carregam o `marcas.js`, o `ponte3d.js` e o `clienteor.js`**. Sem isso
correriam com os esboços de reserva do adaptador — verdes, a cobrir zero linhas.
Foi exatamente assim que um erro de zona morta temporal passou verde pela suíte
em 22/09 e matou o jogo no navegador.

---

## 3. Como correr

**Jogar/assistir:** `python servir.py` → `http://localhost:8000/index.html`.
**Nunca com duplo clique**: `file://` bloqueia fetch, `localStorage` e downloads.
A chave da API fica no `localStorage` do navegador. O mapa 3D precisa dos
ficheiros do forno (§7), que não estão no git.

**Duelo headless:** `node runners/rei_vs_rei.js <backend:modelo> <backend:modelo>
<seed> <maxTurnos> <saida.txt>` (ex.: `openrouter:dots-studio/dots-3-note-preview:free
burro 1 40 out.txt`). Chaves no `.env` (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`,
`GROK_API_KEY`). `REASONING_MAX_TOKENS=N` dá orçamento de raciocínio — ⚠️ muda o
que se mede, e alguns provedores ignoram-no.

**Testes:**
```bash
for f in testes/*.js testes_arena/*.js; do node "$f" || echo "FALHOU $f"; done
```
e `verificarEquilibrio()` tem de dar 0.

**Bateria:** uma spec por bateria (`SPEC_TESTES_HEADLESS_<data>.md`), tudo em
`resultados/p4-bateria-<data>/` com um `DIARIO.md`. O condutor aponta o dedo, não
julga — a análise é do Lucas.

---

## 4. A mecânica (o que o Rei precisa de saber)

- **Vitória:** ter **≥ 75% das aldeias (18 de 24) durante 2 turnos seguidos**, ou
  eliminar o inimigo. As partidas acabam cedo: mediana de **18 turnos** com o
  jogador-base, 18–19 nas LLM de 22/09.
- **Combate:** ataque e defesa separados por tipo (lanceiro 1/2, arqueiro 2/2,
  cavaleiro 4/2). Triângulo: lanceiro > cavaleiro > arqueiro > lanceiro, e ter o
  counter multiplica a força por **1.5**. O tipo MAIS NUMEROSO define o matchup
  (desempate L>A>C). Defesa: aldeia **×1.25**, capital **×1.5**, estrada sem
  bónus. Empate favorece o defensor. O vencedor perde sempre (atrito 50% da força
  efetiva do perdedor).
- **Economia POR ALDEIA** (não há caixa global): cada aldeia produz **30 madeira e
  20 ferro** por turno e paga as suas construções. Tudo fica pronto em 1 turno.
  Teto de 300 tropas em casa. Madeira é o gargalo.
- **Marcha pela REDE DE ESTRADAS**, nunca em linha reta, com `escalaMarcha` 0.2.
  Exército misto anda à velocidade da tropa mais lenta. Uma marcha **pára na 1ª
  aldeia não-sua** do caminho. Envios de aldeias diferentes **não somam** — lutam
  um de cada vez.
- **Estrada:** dois exércitos inimigos que estão no **mesmo ponto do mesmo troço
  no mesmo instante** lutam ali (de frente ou um a alcançar o outro), e o
  **perdedor é aniquilado**. Os encontros resolvem-se por ordem de tempo dentro do
  turno (`encontroNoTempo`, 23/09; antes bastava os troços percorridos se
  sobreporem no espaço, e 3,3% das "lutas" eram de quem nunca se tinha visto).
- **Neutras endurecem**: +1 tropa do seu tipo a cada 5 turnos.
- **Ordens simultâneas:** os dois Reis decidem sobre a mesma fotografia.

### A mesa é neutra (22/09)

Com dois jogadores idênticos, o Rei A ganhava **64%**. Duas causas, corrigidas:

- **`visaoEspelhada`** — os ids não são espelho (oeste numerado capital→fronteira,
  leste ao contrário). A visão, o prompt e o jogador-base passaram a percorrer as
  aldeias por **distância à própria capital inicial**, depois à do inimigo, com o
  **par de gémeas** a desempatar. Cada Rei lê a sua capital em primeiro lugar.
- **`chegadaSorteada`** — quando os dois chegam à mesma aldeia no mesmo turno,
  uma moeda com semente decide quem resolve primeiro (antes era sempre A).

Medido: **assento A 50,1%, lado de Lisboa 51,5%** em 2 400 jogos. **Método:** um
resultado de par de modelos são DOIS jogos, com os lados trocados.

---

## 5. O prompt (P4)

O jogo usa o **P4**: **em inglês**, com **fog of war**, **sem exemplo** (esquema
declarado). `config.promptP4 === true` e `config.fogOfWar === true` — lidas como
`=== true`, e não `!== false`, para os estados congelados do `test_lote_c`
continuarem a render o texto antigo.

- **O protocolo JSON é em inglês desde 01/09** (`build`, `movements`, `villageId`,
  `fromId`, `toId`, `troops`, `plan`, `statement`) — acabou com a troca de língua a
  meio da partida. O parser aceita também as chaves PT antigas e converte tudo
  para o formato interno (`construir`/`envios`). Nomes de tropa em inglês entram
  com registo em `normalizacoes`.
- O P4 diz a **condição de vitória real** com o progresso ao vivo, a
  **simultaneidade**, o **reforço** a aldeia própria, o **endurecimento** das
  neutras e o **corte de 600 caracteres** do plano.
- **"O prompt informa, não recomenda"** (decisão do Lucas): não há mínimo
  pré-calculado nem exemplo com valores.
- `plan` volta no turno seguinte (a única memória deliberada do Rei);
  `statement` vai só para a tela e o `.txt`.
- `construir` aceita `quantity`; o parser expande em N ordens de 1.
- **Combate de estrada** (`relatoEstrada`, 23/09): cada um vira uma linha com o
  troço, a coluna do Rei (origem → destino), o resultado, o exército destruído,
  as baixas e as forças efetivas. Antes dizia só "your army won the field".
  Plurais ingleses certos (`spearmen`), que o parser já aceitava.

### 5.1 Fog of war

`estado.visto[dono][id]` guarda a última fotografia que cada Rei teve de cada
aldeia, escrita no fim do `tick` — a memória é **do motor**, porque o modelo é
stateless. Visível: as aldeias próprias, as **vizinhas diretas na rede**, e o
destino de cada exército próprio em marcha. **A topologia é pública** (o fog
esconde estado, nunca geografia).

**Explorar é conquistar**: não há reconhecimento, e a marcha pára na 1ª aldeia
não-sua. O fog é **do relatório**: `montarVisao` carrega todos os alvos anotados
(`visivel`, `visto`), e motor, jogador-base e espectador continuam omniscientes.

### 5.2 Free-tier

- O custo agora é **relógio**, não dólar: partidas de 30 turnos levam 2–4 h.
  Teto de **20 req/min e 1000/dia**.
- O cliente (`clienteor.js`) honra o `Retry-After` (o maior entre o pedido do
  provedor e o backoff, teto de 45 s por espera). Acima dele,
  `deliberarComRetentativa` repete a **chamada** até 2 vezes em erro de rede,
  nunca o **parse** (JSON quebrado é o degrau 0 do benchmark).
- O log regista o throttle **sobrevivido** (`THROTTLE: N x 429/503 recuperado(s)`).
- **Falhas sem erro existem**: string vazia com `finish: length` — o modelo gastou
  o orçamento a pensar. **Sonda curta não prevê partida**: o raciocínio cresce com
  o prompt até bater no teto do provedor (três casos: laguna, nano-omni, lfm).
- **O catálogo `:free` roda depressa** — modelos somem em 24 h.

### 5.3 A câmara do Rei

O seletor `olhos de` (`#gvisao`) mostra o mapa como UM Rei o vê: esconde o que ele
não vê e mostra o que ele se lembra. Lê as mesmas fontes do prompt (a `ponte3d.js`
passa-lhe `visivel`/`lembrada`). Trancado por `Smoke5fog`.

### 5.4 As flags de lote

Cada mudança de texto ou de comportamento entrou **atrás de uma flag**, lida como
`cfg.X !== false` (ligada por omissão). Com as flags desligadas, o motor e o texto
são **byte a byte** os das baselines — é assim que `test_lote_c` e `test_lote_e`
continuam válidos. Ao acrescentar uma flag de comportamento, **acrescentá-la às
listas "desligadas" desses dois testes**. A história de cada lote está em
`docs/HISTORIA.md`.

---

## 6. Convenções e INVARIANTES (não quebrar)

- **Commits SEM rodapé de sessão.** Nada de `Co-Authored-By: Claude` nem link de
  conversa — o repo é público e o link expõe a conversa.
- **UM RULESET SÓ, sem opt-in em tempo de execução.** O `CONFIG` **é** o jogo. O
  `CONFIG_V3_ARQUIVO` existe só para o `test_lote_c`, congelado e não jogável.
  > Houve um segundo ruleset ligado por checkbox: o estado nascia antes de a
  > caixa ser marcada, o log lia a caixa ao vivo, e três partidas pagas (~$2,25)
  > correram em v3 com o log a dizer v4. **A lição: uma regra que *pode* não
  > estar ligada, mais cedo ou mais tarde, não está.**
- **Marcha nunca por pixel** — sempre custo de rota (`turnosDeCaminho`). Mordeu 3
  vezes: *o número que o decisor lê tem de ser o que o motor executa*.
- **Métricas vêm do estado do motor** (o replay), não de reparsear o `.txt`. *"O
  `.txt` narra, o JSON mede."* **Nunca apagar um `.replay.json`.**
- **O log descreve a partida que CORREU**: o cabeçalho lê de `game.config` (regras,
  e desde 22/09 a mesa). Já mentiu uma vez, e escondeu o bug do ruleset um dia.
- **Números da Arena contam-se dos ficheiros** (`=== PARTIDA` / `=== FIM`), nunca
  da nota anterior. Ao atualizar `resultados_arena.json`, **acrescentar**, não
  substituir, e registar o assento.
- **Não mexer** na topologia nem nos custos do `world-iberia.js` sem um lote
  próprio — `verificarEquilibrio()` = 0 **por construção**.
- **Suíte verde** antes de cada commit.
- **Ao apagar um símbolo, procurar quem depende dele FORA do código também**:
  `.claude/skills/`, a memória, os `.md`, `testes_arena/fixtures/`. Em 22/09 a
  skill de vídeo e o gerador da fixture ficaram a apontar para coisas apagadas.
- **Um `<script src>` que dá 404 falha em silêncio.** Qualquer módulo novo ao lado
  do `index.html` entra também no `Smoke12modulos` e nos cinco smokes que fazem
  `eval`.

---

## 7. O mapa 3D

**Desde 22/09 é o único mapa.** Não há `?mapa=2d` nem canvas plano: se os
ficheiros do forno faltarem, o jogo **diz e pára**. O canvas 2D foi apagado com
1 031 linhas de desenho que nenhum caminho atingia desde 11/09; o que ainda lia a
câmara plana (o balão do rato, o enquadramento de gravação, a tabela de posições
do vídeo) passou a ler a câmara 3D — e estava errado (o balão dizia "Lisboa" com a
câmara sobre Barcelona). No Node dos testes não há ecrã (`HA_ECRA`): corre o motor,
o HUD e o log, sem mapa.

### 7.1 O que corre no navegador

| ficheiro | o que é |
|---|---|
| `sonda3d/mapa3d.js` | o mapa: carrega, povoa, anima as marchas, abre as cenas |
| `sonda3d/batalha.js` | a cena da batalha de estrada — a MESMA no jogo e nas bancadas |
| `sonda3d/mapa.html` | o mapa sozinho, sem jogo |
| `sonda3d/encontro.html` | bancada: duas colunas encontram-se e o evento é o do motor |
| `sonda3d/marcha.html` | bancada: uma tropa a ir e vir |

Para vídeo, o jogo expõe `enquadrarGravacao()` (moldura fixa, da caixa das 24
aldeias) e `posAldeiasTela()` (onde cada aldeia aparece no ecrã). A receita está
na skill `video-arena`.

### 7.2 O forno

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -noaudio -P ferramentas/cena/exportar_mapa.py
```
~105 s → `sonda3d/pecas.glb` + `sonda3d/mapa3d.json`. Os soldados são
`sonda3d/{lanceiro,arqueiro,cavaleiro}_novo.glb`. **Nada disto está no git**
(dezenas de MB): quem clona tem de cozer. As ferramentas do forno e as texturas
estão em `ferramentas/cena/` e `assets/texturas/`.

### 7.3 As armadilhas do glTF (todas custaram horas)

- **O glTF NÃO leva grafos de nós.** Do material só sobrevivem uma imagem e o
  `baseColorFactor`. **O que tem de mudar, muda na IMAGEM** (`tex_estrada.py`,
  `tex_prado.py`). O único padrão que passa: imagem → `ShaderNodeMix` MULTIPLY com
  uma constante → Base Color.
- **Material sem `metallicFactor` assume metal = 1.0**, e metal branco sem
  ambiente renderiza preto (o cavalo preto).
- O exportador segue só o **Material Output ativo**.
- O `GLTFLoader` **corta os pontos dos nomes** (`mao.L` → `maoL`).
- **`InstancedMesh` não aceita esqueleto**; o que torna a animação pagável é o
  corte por **tamanho aparente em píxeis**, não por metros.
- A cor de vértice só é exportada se o material a usar.
- **Toda a instância da mata tem de levar `instanceColor`** — o vetor nasce a
  zeros e uma instância sem cor sai preta.

### 7.4 O que está trancado

- **A rede V2**: 24 cidades, 37 estradas, Lisboa→Barcelona custa 17,
  `verificarEquilibrio()` = 0 por construção.
- **Ninguém se atravessa na estrada**, nem no motor nem no ecrã. O motor luta
  quando dois inimigos estão no MESMO ponto no MESMO instante (`encontroNoPasso`,
  exato: a marcha anda a velocidade constante dentro do passo), resolve os
  encontros por ordem de tempo e grava no evento o instante (`sEncontro`) e o
  ponto. O replay para as duas colunas nesse instante e abre a cena ali
  (`progMarcha` + `eventosPorVir` no `index.html`). Trancado por
  `test_varredura_estrada.js` e `test_sem_atravessar.js`.
- **O progresso de uma marcha tem uma implementação só** (`progMarcha` no
  `index.html`), injetada na `ponte3d.js`.
- **Estradas e aldeias são zona protegida** no relevo (90 m à volta de cada
  estrada). Conferir depois de cada forno.
- **O mar está a 0 m**; praias só em costa baixa; areia e rocha são fitas
  recortadas por curva, não faces da grelha.

### 7.5 Como se corrige um asset 3D

**Cada defeito que o Lucas consegue VER tem de virar um número ou uma imagem que o
Claude consegue ver, antes de tentar corrigir.** As provas automáticas (pesos por
cor, lança × bota, pé × anca, ilhas por cor) e as armadilhas medidas estão na
skill **`asset-3d`**; a versão longa do método está em `docs/HISTORIA.md`.

---

## 8. Onde está o estado atual

Este guia não guarda estado. Para saber onde o projeto está:

- **`MODELOS_ARENA.md`** — que modelos jogam, o registo de cada um (por assento),
  e porquê. Ler antes de gastar cota.
- **o `RELATORIO_*` mais recente na raiz** — o que a última sessão fez.
- **`resultados/p4-*/`** — as partidas, com `DIARIO.md` nas baterias.
- **`docs/HISTORIA.md`** — como se chegou aqui.

**Em aberto** (23/09):

- **batalhas de estrada entre LLMs são raras**: precisam de dois Reis ativos, e o
  que perde costuma não sair de casa (exércitos-turno na estrada 13 contra 85);
- a **cena de conquista de aldeia** ainda não existe no 3D;
- **composição/monocultura** ("quem constrói menos lanceiro ganha"): medida três
  vezes, sem veredito.
