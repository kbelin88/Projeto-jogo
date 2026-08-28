# SPEC — Site da Arena, versão 1

Para o Claude Code (Sonnet) executar no repositório `Projeto Jogo`, branch viva
`spec-lote-e-fairness`. Escrita em 20/08/2026 a partir de decisões do Lucas.

**Leia `CLAUDE.md` primeiro.** Esta spec assume o contexto de lá (mecânica, convenções,
invariantes) e não o repete.

O que já existe: a pasta `site/` foi criada em 20/08 e funciona (`python servir.py` →
`localhost:8000/site/`). Esta spec **reforma** essa pasta; não parte do zero.

---

## 0. Como trabalhar

- **Fases em ordem.** A Fase 0 corrige dados. Sem ela a tabela nova mostra zeros e mentiras.
  Não pule para o HTML.
- **Depois de cada fase:** rode a suíte (`for f in testes/test_*.js; do node "$f" >/dev/null || echo FALHOU $f; done`)
  e abra o site no browser. Verde antes de seguir.
- **Se um número seu não bater com o §8**, pare e investigue antes de continuar. A tabela do §8
  foi apurada dos logs em 20/08 e é o gabarito.
- **Não invente texto de interface.** Todo o texto visível ao usuário está escrito nesta spec,
  nas duas línguas. Se faltar alguma string, pergunte — não improvise.
- **Ao terminar tudo:** commit e `git push` (§7).

---

## 1. Regras duras

1. **Métricas vêm do estado do motor**, não de reparsear narração quando existe alternativa.
   Onde o `.replay.json` tem o dado, use o replay. O `.txt` só para o que não existe no replay
   (tokens, ms, finish, plano, depoimento, raciocínio).
2. **Nenhuma coluna sem legenda.** Toda métrica da tabela tem uma linha explicando o que é,
   em linguagem de quem nunca viu o projeto, **antes** da tabela.
3. **Não invente número.** Métrica que não existe para um modelo aparece como `—`, nunca como 0.
   Isto vale especialmente para tokens de raciocínio (ver §2.3) e custo (§4.3).
4. **Bilíngue de verdade.** Toda string nova entra no dicionário `DIC` de `site/arena.js`, nas
   duas línguas. Nada de texto solto em HTML sem `data-t`.
5. **Sem build, sem framework, sem dependência nova.** O site é HTML/CSS/JS puro servido por
   `servir.py` ou GitHub Pages.
6. **Não mexa** em `engine.js`, `world-iberia.js`, no ruleset, nem em nada que altere partida.
   As únicas mudanças fora de `site/` estão na Fase 0 e são de *registro*, não de jogo.

---

## 2. FASE 0 — três correções de dados

Estas três já estão diagnosticadas e conferidas. Faça-as primeiro.

### 2.1 `analisar-log.js` não lê os logs do runner headless

`ferramentas/analisar-log.js`, linha ~146:

```js
if (linha.startsWith("tokens:") && reiAtual) {
```

O browser escreve `tokens: ...`; o runner headless escreve `tokens.contexto: ...`
(`runners/rei_vs_rei.js` linha ~234). **Resultado: nas 13 partidas headless o analisador
devolve `tokens_prompt_total: 0`, `tokens_resposta_total: 0`, `custo_total_usd: 0` e
`ms_turnos_nao_vazios: null`.** Confira você mesmo:

```bash
node ferramentas/analisar-log.js resultados/p4-bateria-0819/P4_dots-3-note-preview_vs_lightning_seed1_30t.txt --json /tmp/a.json
python -c "import json;d=json.load(open('/tmp/a.json'));print(d['reis']['A']['tokens_prompt_total'], d['reis']['A']['ms_turnos_nao_vazios'])"
```

Esperado hoje: `0 None`. Depois da correção: valores reais.

**Correção:** aceitar os dois prefixos, e também o campo opcional `| nativo X` que só o
browser emite. Regex sugerida (substitui o `startsWith` + parsing atual):

```js
const RE_TOKENS = /^tokens(?:\.contexto)?: prompt (\d+) \| resposta (\d+) \| raciocinio (\d+) \| finish (\S+)(?: \| nativo (\S+))? \| ms (\d+)/;
```

Mantenha o comportamento atual para o formato do browser — não pode regredir. Acrescente um
teste em `testes/` que passe uma linha de cada formato e verifique que as duas são contadas.

### 2.2 O cabeçalho do runner headless é texto fixo e está errado

`runners/rei_vs_rei.js` linha ~120 escreve:

```
condicoes: ... prompt=relatorio v3 (disponivel-para-enviar) ... regras=v4 (cav def2/1t, madeira 15, dist x2/3, vitoria 75%/2t)
```

As partidas correram com **P4 + fog, madeira 30, ferro 20, escala 0,2**. O `index.html` já lê de
`game.config` (commit `bfc3a77`); o runner ficou para trás. **Todo `.txt` das baterias de 17, 18
e 19/08 carrega um cabeçalho falso.**

Esta é a quinta vez que esta família de bug morde (`CLAUDE.md` §6: *"o log tem de descrever a
partida que CORREU"*).

**Correção:** montar a linha lendo de `cfg`/`Engine.CONFIG`, como o browser faz. Nenhum valor
literal de regra na string.

**Não reescreva os `.txt` já gravados.** Em vez disso, crie
`resultados/AVISO_CABECALHO.md` com uma nota curta explicando que os logs anteriores a esta
correção têm a linha `condicoes:` desatualizada e que o ruleset real está no `CLAUDE.md` §7 e
nos `.replay.json`.

### 2.3 O catálogo diz que o `lightning` não raciocina — e ele raciocina

`index.html`, `CATALOGO_FREE`:

```js
"nvidia/nemotron-3.5-lightning:free": { ... rac: false, nota: "SEM raciocinio: serve para isolar o efeito do thinking" },
```

Os logs desmentem. Exemplo real (`P4_dots-3...txt`, Rei B, turno 3):

```
tokens.contexto: prompt 2396 | resposta 9388 | raciocinio 8299 | finish stop | ms 51926
raciocinio: Here's a thinking process:
1.  **Analyze the User's Request:** ...
```

Agregado nas 13 partidas em que jogou: mediana de 20.931 tokens de saída, com ~84% contados
como raciocínio. **O `lightning` era a régua "sem thinking" do benchmark inteiro** — a nota
está errada e precisa ser corrigida, senão qualquer conclusão sobre o efeito do raciocínio
está comprometida.

**Correção:** trocar `rac: false` por `rac: true` e a nota por algo como
*"raciocinio ATIVO (conferido nos logs de 17-19/08: mediana ~84% da saída em tokens de
raciocínio). A nota anterior dizia o contrário e estava errada."*

**Achado colateral que a spec precisa respeitar:** numa das linhas o contador de raciocínio é
**maior** que o de resposta (`resposta 32000 | raciocinio 39863`). Ou seja, os dois contadores
vêm independentes do provedor e `raciocinio ⊄ resposta`. Isto tem consequência direta na coluna
"% de raciocínio" (§4.3, item 11).

E o inverso: nos logs do browser o **Gemini** reporta `raciocinio 0` mesmo tendo raciocinado
(o RESUMO da partida diz `raciocinio 22/22`). Ou seja, `raciocinio 0` pode significar *"não
reportado"*, não *"não pensou"*. A tabela **não pode** mostrar 0% nesse caso.

---

## 3. FASE 1 — o pipeline de dados

Hoje `site/gerar/manifesto.json` é preenchido à mão, inclusive as construções L/A/C. Isso não
escala e é fonte de erro.

**Mudança:** `site/gerar/gerar.py` passa a **chamar `ferramentas/analisar-log.js --json`** para
cada partida do manifesto que tenha `.txt`, e a consumir a saída. O manifesto reduz-se ao que
só um humano sabe:

```json
{ "id": "0819-P2", "data": "2026-08-19", "bat": "19/08",
  "seed": 1, "fim": "vitoriaA",
  "txt":    "resultados/p4-bateria-0819/P2_...",
  "replay": "resultados/p4-bateria-0819/P2_...",
  "publicarReplay": true }
```

Tudo o mais — modelos A/B, turnos, placar, construções L/A/C, rejeições, ataques, conquistas,
tokens, ms — sai do `analisar-log --json` e do `.replay.json`. Campos que hoje existem no
manifesto (`A`, `B`, `turnos`, `aldA`, `aldB`, `cA`, `cB`) **saem**.

- `fim` continua manual: `limite` · `vitoriaA` · `vitoriaB` · `interrompida`.
- `publicarReplay` decide se a partida ganha página navegável. Hoje `true` só em `0819-P2` e
  `0819-P4`; as demais `false`.
- As **5 partidas de 17/08 não têm `.replay.json`** (o runner ainda não gravava). Elas têm
  `replay: null` e todas as métricas saem do `.txt`. O counter por tipo de alvo fica `—` nelas —
  não estime, não reconstrua.
- Se o `analisar-log` falhar num arquivo, **pare com erro claro**, não gere dado parcial em
  silêncio.

Mantenha `site/gerar/parselog.py` como está (ele extrai plano/depoimento/raciocínio para as
páginas de partida; é outro trabalho, não conflita).

---

## 4. FASE 2 — a tabela de classificação

### 4.1 Ordenação

1. **Vitórias**, decrescente.
2. Desempate: **saldo total de aldeias** (aldeias suas − do adversário, somado nas partidas
   decididas). **O saldo não aparece como coluna** — é só critério de desempate.
3. Desempate final: menos derrotas.

Partidas com `fim: "interrompida"` **não contam** para vitória, derrota nem saldo. Contam
para as colunas de comportamento (tokens, ms, rejeições, ataques).

Partida que termina no limite de turnos **conta como vitória** de quem tem mais aldeias.
Empate verdadeiro (mesmo número de aldeias) não recebe coluna; hoje existe exatamente um caso
e ele foi interrompido de qualquer forma.

### 4.2 Colunas, nesta ordem exata

| # | coluna | rótulo PT | rótulo EN |
|---|---|---|---|
| 1 | posição | (sem título) | (sem título) |
| 2 | modelo | modelo | model |
| 3 | vitórias | V | W |
| 4 | derrotas | D | L |
| 5 | partidas | partidas | matches |
| 6 | turnos inválidos | turnos inválidos | invalid turns |
| 7 | ordens inválidas | ordens inválidas | invalid orders |
| 8 | segundos por turno | s / turno | s / turn |
| 9 | tokens de entrada | tokens entrada | input tokens |
| 10 | tokens de saída | tokens saída | output tokens |
| 11 | % de raciocínio | % raciocínio | % reasoning |
| 12 | custo por turno | custo / turno | cost / turn |
| 13 | % lanceiro | % lanceiro | % spearmen |
| 14 | % arqueiro | % arqueiro | % archers |
| 15 | % cavaleiro | % cavaleiro | % knights |
| 16 | % ataques vencidos | ataques vencidos | attacks won |
| 17 | aldeias por partida | aldeias / partida | villages / match |

Agrupe visualmente com um cabeçalho de dois níveis: **Resultado** (3–5), **Confiabilidade**
(6–7), **Custo** (8–12), **Jogo** (13–17). A coluna do modelo fica fixa (`position: sticky`) no
scroll horizontal.

### 4.3 Definição de cada coluna — leia com atenção, várias têm armadilha

**5. partidas** — número de **lados jogados**, não de arquivos. Num espelho (mesmo modelo dos
dois lados) o modelo conta **duas vezes**: uma vitória e uma derrota. Assim `V + D` fecha com
`partidas` menos as interrompidas.

**6. turnos inválidos** — **número absoluto**, não percentagem (decisão do Lucas). É a contagem
de turnos em que o modelo **não entregou ordem utilizável**: soma de `vazios` + `infra_erros`
do `analisar-log`. Não confundir com "turno em que respondeu mas não construiu nada"
(`construir: []`) — esse é comportamento, não falha, e **não entra aqui**.
Conferência: `0818-P3` Rei A deve dar **11** (o `DIARIO.md` de 18/08 registra "só 19/30 turnos
válidos").

**7. ordens inválidas** — **número absoluto** de ordens rejeitadas pelo motor
(`rejeicoes_total` do `analisar-log`): pediu tropa que não tem, id que não existe, envio de
zero tropas, recurso insuficiente. É a medida concreta de alucinação deste projeto.

**8. s / turno** — **mediana** dos `ms` do modelo, em segundos. Mediana, não média: a
distribuição tem cauda longa (turnos de 45 minutos) e a média mentiria.

**9. tokens entrada** — **mediana** de `prompt` por turno.

**10. tokens saída** — **mediana** de `resposta` por turno.

**11. % raciocínio** — `tokens de raciocínio ÷ tokens de saída`, agregado (soma sobre soma, não
média de razões). **Três casos especiais, todos obrigatórios:**
  - Se o modelo reporta `raciocinio 0` em **todos** os turnos, mostre `—` (não reportado), não
    `0%`. O Gemini cai aqui: ele raciocina, o cliente não conta.
  - Se a razão passar de 100% (acontece: os contadores vêm independentes do provedor e o de
    raciocínio pode ser maior), mostre `>100%` e não o número.
  - A legenda tem de dizer que este número vem do contador do provedor, não de medição própria.

**12. custo / turno** — todas as 14 partidas correram no free tier: **custo real US$ 0,00**.
Uma coluna de zeros é pior que nenhuma coluna. Portanto:
  - Calcule **custo estimado**: `(tokens_entrada × preço_in + tokens_saída × preço_out) / 1e6`,
    por turno, usando o preço da **versão paga do mesmo modelo** na OpenRouter.
  - Busque os preços **uma vez** em `https://openrouter.ai/api/v1/models` (endpoint público,
    não precisa de chave) e grave em `site/dados/precos.json` com a data da consulta. O
    gerador lê desse arquivo; não faz rede a cada execução.
  - Para um modelo `X:free`, procure o slug `X` sem o sufixo. **Se não existir versão paga,
    mostre `—`.** Não invente preço, não use o preço de um modelo "parecido".
  - Rótulo da coluna leva `(est.)`. A legenda explica em uma frase: *"Todas as partidas
    correram no free tier — o custo real foi US$ 0,00. Esta coluna estima o que o mesmo modelo
    custaria a preço de tabela da OpenRouter, para dar uma base de comparação."*
  - Já existe um `PRECOS_OR` em `index.html` com 4 modelos pagos. **Não o use como fonte** —
    é curto e desatualizado. Se quiser, atualize-o depois a partir do `precos.json`.

**13–15. % lanceiro / arqueiro / cavaleiro** — sobre o total de unidades **construídas** pelo
modelo em todas as partidas (`construcoes_aceites` do `analisar-log`). As três somam 100%.
Renderize como uma **barra empilhada de três cores** na célula, com os números ao lado —
monocultura tem de se ler em meio segundo, que é a mesma razão pela qual a barra existe na
transmissão v5.

**16. ataques vencidos** — `conquistas ÷ ataques`, em %. Um ataque "vencido" é o que resultou
em conquista da aldeia. Só conta ataque iniciado pelo modelo.

**17. aldeias / partida** — `conquistas ÷ lados jogados`. Média de aldeias tomadas por partida.

### 4.4 A legenda

Acima da tabela, antes dela, uma lista com **uma linha por coluna**, escrita para quem nunca
viu o projeto. Não use jargão do repo ("degrau", "clamp", "agência", "rejeição") sem explicar.
Colapsável é aceitável, mas tem de vir **aberta por padrão** na primeira visita.

Texto sugerido (PT — traduza para EN mantendo o tom):

- **V / D** — partidas ganhas e perdidas. Ganha quem tiver mais aldeias no fim.
- **partidas** — quantas vezes o modelo jogou. Num espelho, o mesmo modelo joga dos dois lados
  e conta duas vezes.
- **turnos inválidos** — turnos em que o modelo não conseguiu jogar: não respondeu, respondeu
  fora do formato, ou a resposta não chegou.
- **ordens inválidas** — ordens que o motor recusou: mandar tropa que não existe, atacar uma
  aldeia que não está no mapa, gastar recurso que não tem.
- **s / turno** — quanto tempo o modelo leva para decidir um turno (mediana).
- **tokens entrada / saída** — tamanho médio do que o modelo lê e do que escreve por turno.
- **% raciocínio** — quanto da saída foi pensar antes de responder. Vem do contador do
  provedor; `—` quer dizer que ele não informa.
- **custo / turno (est.)** — [a frase do §4.3 item 12].
- **lanceiro / arqueiro / cavaleiro** — de que o modelo montou o exército. Lanceiro é barato e
  fraco, cavaleiro é caro e forte, arqueiro fica no meio.
- **ataques vencidos** — de cada 100 ataques, quantos tomaram a aldeia.
- **aldeias / partida** — quantas aldeias o modelo conquista, em média, por partida.

---

## 5. FASE 3 — a home

### 5.1 Hero

Título fica como está. A descrição é substituída por (PT):

> O jogo existe para testar diferentes LLMs num jogo de estratégia simples: cada modelo comanda
> um exército num mapa, constrói tropas, administra recursos e conquista aldeias para vencer a
> outra LLM.

EN:

> The game exists to test different LLMs on a simple strategy game: each model commands an army
> on a map, builds troops, manages resources and captures villages to beat the other LLM.

O segundo parágrafo atual ("O que está aqui é o registro bruto…") **sai**.

### 5.2 Números do topo

Só **dois**: número de **partidas** e número de **modelos**. Saem lados jogados, requisições e
horas de relógio. Os dois números são calculados do `partidas.json`, nunca escritos à mão.

### 5.3 Seção de partidas

- Sai o parágrafo de descrição.
- **Saem os dois cartões de destaque.**
- Fica a tabela como está hoje — ela está aprovada.

### 5.4 Seção "O que as partidas ensinaram"

**Remover inteira**, junto com a constante `ACHADOS` em `index.html`. Esse material vira
publicação no LinkedIn, não conteúdo de site.

---

## 6. FASE 4 — a seção Método

Sai o formato de quatro cartões soltos. Vira **texto corrido + uma imagem do mapa**.

### 6.1 A imagem do mapa

Gere `site/assets/mapa.svg` a partir de `site/dados/mapa.json` — estático, sem JavaScript:
as 41 estradas como linhas, as 24 aldeias como círculos, os nomes ao lado, as duas capitais
(Lisboa e Barcelona) destacadas em dourado. Mesma paleta do `estilo.css`. É a mesma geometria
que o replay já desenha; reaproveite o código de `partida.html` em vez de reescrever.

Legenda sob a imagem (PT): *"24 aldeias, 41 estradas. As duas capitais são o ponto de partida
de cada Rei. O mapa é simétrico: para cada cidade do Oeste existe uma gêmea no Este com os
custos de marcha invertidos."*

### 6.2 O texto

Substitui os quatro cartões. Escreva assim (PT; traduza para EN):

**Como funciona.** Dois modelos de linguagem jogam como Reis, um de cada lado do mapa. A cada
turno, cada Rei recebe um relatório em texto do que consegue ver e responde com um JSON de
ordens: o que construir e para onde mandar tropa. Um motor determinístico executa as duas
ordens ao mesmo tempo e devolve o mundo novo. Os modelos nunca se falam e nunca veem o código.

**As regras.**
- Cada aldeia produz 30 de madeira e 20 de ferro por turno.
- Três tropas: lanceiro (ataque 1, barato), arqueiro (ataque 2), cavaleiro (ataque 4, caro e
  rápido). Elas se contra-atacam em triângulo — lanceiro vence cavaleiro, cavaleiro vence
  arqueiro, arqueiro vence lanceiro — e acertar o contra-ataque multiplica a força por 1,5.
- Marchar leva turnos, e o custo é o da estrada, nunca a distância no desenho.
- Aldeias neutras endurecem sozinhas com o tempo: quem demora a expandir paga mais caro.
- **Névoa de guerra:** cada Rei vê as próprias aldeias e as vizinhas diretas. Vê *onde* ficam
  todas as cidades — o mapa é público — mas não *o que há dentro* das que não alcança. Não
  existe unidade de exploração: explorar é conquistar.
- **Vitória:** quem segurar 75% das aldeias por dois turnos seguidos ganha. Sem isso, a partida
  vai até o limite de turnos e quem tiver mais aldeias fica na frente.

**O que é medido.** Tudo o que a tabela mostra sai do estado do motor gravado a cada turno, não
da narração do jogo. O registro de cada partida fica no repositório, aberto: o texto de todos
os turnos, o raciocínio dos modelos e o arquivo de replay.

---

## 7. FASE 5 — fechar

1. Rode a suíte inteira. Verde.
2. Rode `python site/gerar/gerar.py` e confira a tabela contra o §8.
3. Abra o site nas duas línguas e clique em tudo: as duas partidas com replay, as três abas,
   o slider, o botão de raciocínio.
4. **Commit** com mensagem descrevendo as fases. Sem rodapé de sessão (repo público).
5. **`git push`.** A branch viva é `spec-lote-e-fairness`. Se o Lucas quiser o site publicado
   pelo GitHub Pages a partir da `main`, isso exige consolidar a `main` — **não faça isso por
   conta própria**, apenas avise no fim que é o próximo passo e quantos commits estão em jogo.
6. Antes de commitar, normalize fim-de-linha nos arquivos que você tocou:
   `sed -i 's/\r$//' <arquivo>` (o repo é LF; o editor no Windows grava CRLF e o diff aparece
   inteiro modificado).

---

## 8. Critérios de aceite

### 8.1 A suíte

Verde, incluindo o teste novo do §2.1.

### 8.2 Gabarito da tabela

Apurado dos `.txt` em 20/08, direto dos logs. Medianas por turno, agregado de todas as partidas
do modelo. **Tolerância: ±1 na última casa.** Se algo divergir mais que isso, investigue antes
de seguir — pode ser um bug seu ou meu, mas não pode passar em silêncio.

| modelo | partidas (arquivos) | turnos | s/turno | tok entrada | tok saída | % rac | ordens inv. | ataques | conquistas | % venc |
|---|---|---|---|---|---|---|---|---|---|---|
| `nemotron-3.5-lightning` | 13 | 371 | 173 | 3529 | 20931 | 84 | 100 | 390 | 302 | 77 |
| `nemotron-3-super-120b-a12b` | 3 | 79 | 164 | 3852 | 13494 | 91 | 10 | 123 | 72 | 59 |
| `nemotron-3-ultra-550b-a55b` | 3 | 68 | 279 | 3939 | 8892 | 80 | 1 | 93 | 67 | 72 |
| `poolside/laguna-s-2.1` | 2 | 12 | 583 | 2530 | 32000 | 100 | 2 | 7 | 7 | 100 |
| `nemotron-nano-12b-v2-vl` | 2 | 60 | 8 | 3399 | 262 | — | 53 | 61 | 34 | 56 |
| `openai/gpt-oss-20b` | 1 | 20 | 1159 | 2868 | 27318 | 99 | 8 | 28 | 7 | 25 |
| `nemotron-3-nano-30b-a3b` | 1 | 29 | 69 | 4042 | 9903 | 92 | 0 | 38 | 32 | 84 |
| `dots-3-note-preview` | 1 | 16 | 83 | 3511 | 15863 | 74 | 2 | 22 | 19 | 86 |
| `gemini-2.5-flash` | 1 | 23 | 25 | 3950 | 4910 | — | 4 | 32 | 25 | 78 |

Atenção a duas linhas:
- `nemotron-nano-12b-v2-vl` e `gemini-2.5-flash` têm `% rac` = **`—`**, não 0. É o caso do
  §4.3 item 11. (O `nano-12b` de fato não raciocina; o Gemini raciocina e o cliente não conta.
  Os dois aparecem como `—` porque a tabela não tem como distinguir — e a legenda diz isso.)
- A coluna "partidas (arquivos)" acima conta **arquivos**; a coluna do site conta **lados**
  (§4.3 item 5). Para o `lightning` são 13 arquivos e **15 lados** (ele jogou os dois lados em
  dois espelhos). Confira que a sua coluna dá 15.

Vitórias e derrotas esperadas (partidas decididas, das 14 totais duas são interrompidas):

| modelo | V | D |
|---|---|---|
| `nemotron-3-nano-30b-a3b` | 1 | 0 |
| `dots-3-note-preview` | 1 | 0 |
| `nemotron-3-ultra-550b-a55b` | 2 | 0 |
| `nemotron-3-super-120b-a12b` | 2 | 1 |
| `nemotron-3.5-lightning` | 6 | 8 |
| `nemotron-nano-12b-v2-vl` | 0 | 2 |
| `openai/gpt-oss-20b` | 0 | 1 |
| `poolside/laguna-s-2.1` | 0 | 0 |
| `gemini-2.5-flash` | 0 | 0 |

### 8.3 Interface

- [ ] Home tem exatamente **dois** números no topo.
- [ ] A seção "O que as partidas ensinaram" não existe mais, e a constante `ACHADOS` foi removida.
- [ ] Não há cartões de destaque acima da tabela de partidas.
- [ ] A legenda das colunas aparece antes da tabela, aberta, nas duas línguas.
- [ ] Nenhuma célula mostra `0` onde o dado não existe — mostra `—`.
- [ ] A seção Método é texto corrido com a imagem do mapa, sem cartões.
- [ ] Trocar PT/EN não deixa nenhuma string em português na versão inglesa, nem o contrário.
- [ ] O site abre pelo `servir.py` sem erro no console (`F12` → Console limpo).
- [ ] A tabela rola horizontalmente no celular sem quebrar, com a coluna do modelo fixa.

---

## 9. O que NÃO fazer

- **Não** mexa em `engine.js`, `world-iberia.js`, no ruleset ou em qualquer coisa que mude uma
  partida. As correções da Fase 0 são de registro e catálogo.
- **Não** reescreva os `.txt` já gravados (Fase 0.2) — a correção é para os próximos.
- **Não** reconstrua métricas para as 5 partidas de 17/08 que não têm `.replay.json`. O que não
  existe fica `—`.
- **Não** acrescente coluna, seção ou métrica que não esteja nesta spec. A lista foi decidida.
  Se você achar que falta algo, escreva no relatório final em vez de implementar.
- **Não** instale dependência, não introduza build, não converta para framework.
- **Não** publique nada nem mexa em configuração do GitHub Pages. Só commit e push.

---

## 10. O que entregar no fim

Um relatório curto em `RELATORIO_SITE_V1.md` na raiz, com:

1. O que cada fase mudou, em uma linha por fase.
2. **Os três bugs da Fase 0:** o que era, o que ficou, e como você confirmou a correção.
3. A tabela que o gerador produziu, ao lado do gabarito do §8, com as diferenças destacadas —
   ou "sem diferenças".
4. O que você achou que faltava e não implementou porque não estava na spec.
5. Quantos commits a `main` está atrás da `spec-lote-e-fairness`, para o Lucas decidir a
   consolidação.
