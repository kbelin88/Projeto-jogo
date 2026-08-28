# SPEC — bateria 21/08: alargar a tabela para fora da Nemotron (para o Sonnet conduzir)

Quarta bateria. As três anteriores construíram a classificação, e ela tem um problema que
nenhuma métrica dentro dela consegue mostrar: **dos 9 modelos medidos, 6 são da família
Nemotron.** A tabela do site diz "benchmark de estratégia para LLMs" e é, na prática, um
estudo interno de uma família com três convidados. O alvo de hoje é esse e só esse.

Duas coisas mudam em relação à spec de 19/08, e as duas mudam **como** se conduz, não só o quê:

1. **Isto corre sem vigilância, a noite toda.** Não há ninguém para responder a uma pergunta
   às 3 da manhã. Toda decisão desta spec está pré-decidida por regra; onde a regra não
   alcançar, a instrução é **parar aquele item e seguir para o próximo**, nunca improvisar e
   nunca esperar. O relógio deixa de ser vigiado a olho e passa a ser imposto por `timeout`.
2. **A régua deixou de ser um item à parte.** Toda partida desta bateria tem
   `nvidia/nemotron-3.5-lightning:free` de um dos lados. Isso resolve de graça o §5 da análise
   de 20/08 (a régua mudou de comportamento entre dias, e sem repeti-la no mesmo dia os números
   não são comparáveis) e ao mesmo tempo é o confronto que a cobertura precisa: modelo novo
   contra o mesmo adversário conhecido.

Leia `MODELOS_ARENA.md` e a `ANALISE_CONSOLIDADA_2026-08-20.md` antes de começar.

**O que mudou na ferramenta desde ontem:** o `analisar-log.js` passou a separar a taxa de
counter por **dono do alvo** (`neutra` / `inimigo` / `proprio` = reconquista / `nao_inimigo` =
critério binário antigo, para comparar com números publicados). Precisa do `.replay.json` como
2º argumento — sem ele o campo sai `indisponivel`. A §7 desta spec já usa os campos novos.

---

## 1. REGRAS DURAS

1. **Não altere código.** Nem `engine.js`, nem `rei.js`, nem o prompt, nem o `CONFIG`, nem as
   ferramentas — incluindo o `analisar-log.js`, que foi mexido hoje de manhã e está com a suíte
   verde. Bug encontrado → anote no diário e siga.
2. **Você aponta o dedo; não julga.** Nada de conclusões sobre estratégia, monocultura ou
   qualidade de modelo. Isso é análise, e é do Lucas.
3. **Nunca apague um log nem um `.replay.json`**, incluindo os das partidas que falharam ou
   foram abortadas. O replay é gravado por turno e sobrevive a um kill — uma partida morta a
   meio ainda é dado.
4. **Não use**, em partida nenhuma:
   - `z-ai/glm-5.2:free`, `deepseek/deepseek-v4-flash:free`, `minimax/minimax-m3:free`,
     `liquid/lfm-2.5-2.6b:free` — fora do catálogo free em 18/08;
   - `poolside/laguna-xs-2.1:free` — responde e não joga (`construir: []`, `finish: error`, 20 min);
   - `cohere/north-mini-code:free` — 353 s num turno só, muito acima do teto de 180 s;
   - `openai/gpt-oss-20b:free` — até 45 min/turno, e falha o degrau 2/3 (razão atq/def 0.64);
   - os inaptos de `MODELOS_ARENA.md` (routers, classificadores, modelos de áudio).
5. Teto OpenRouter: **20 req/min, 1000/dia**. O orçamento previsto de hoje (§6) fica em ~400.
   **A cota não é o que limita esta bateria — o relógio é.** Se tiver de escolher entre gastar
   cota e gastar relógio, gaste cota.
6. **Uma partida de cada vez.** Nunca duas em paralelo: o throttle do free-tier é por conta,
   e duas partidas competem pela mesma janela de 20 req/min.
7. Se precisar decidir fora desta spec, **escolha a opção que termina o item mais depressa**,
   escreva no diário o que escolheu e por quê, e siga. Não pare a bateria para perguntar.

---

## 2. PREFLIGHT

```bash
cd "C:\Users\biolu\projetos\Projeto Jogo"
for f in testes/test_*.js;   do node "$f" >/dev/null 2>&1 || echo "FALHOU $f"; done
for f in testes_arena/*.js;  do node "$f" >/dev/null 2>&1 || echo "SMOKE FALHOU $f"; done
node -e "const E=require('./engine.js');const c=E.CONFIG;console.log('promptP4',c.promptP4,'fog',c.fogOfWar,'escala',c.escalaMarcha)"
node -e "const s=require('fs').readFileSync('.env','utf8');console.log('openrouter',s.includes('OPENROUTER_API_KEY'),'gemini',s.includes('GEMINI_API_KEY'))"
timeout 1 sleep 5; echo "timeout devolve $? (esperado 124)"
mkdir -p resultados/p4-bateria-0821
date -u +"%Y-%m-%dT%H:%M:%SZ" > resultados/p4-bateria-0821/INICIO.txt
```

Esperado: nenhum FALHOU, `promptP4 true fog true escala 0.2`, `openrouter true gemini true`,
`timeout devolve 124`.
**Se a suíte estiver vermelha, não lance nada** — escreva no diário e pare aqui.

**Se o `timeout` não existir neste shell** (não devolveu 124, ou disse "command not found"), a
§6.1 perde o mecanismo que substitui a vigilância humana. Nesse caso, **reduza `maxTurnos` de
30 para 20** em todas as partidas da §5 e anote a troca no diário: 20 turnos a 4 min por turno
dão ~2 h 40, que cabe na noite mesmo sem teto mecânico. Não corra 30 turnos sem `timeout`.

O `INICIO.txt` é o relógio da noite. **Grave-o antes de tudo**: a §6.2 decide se ainda dá tempo
de abrir mais uma partida comparando com ele.

---

## 3. FASE 0 — RECENSEAR O CATÁLOGO (custo zero, 1 requisição)

Esta fase é o motor da bateria, não uma formalidade. O dump que alimenta a `MODELOS_ARENA.md`
é de **18/08** e o catálogo free já provou mexer-se em menos de 24 h (quatro modelos morreram
entre 17 e 18/08). **Qualquer modelo novo não-Nemotron que apareça aqui entra na fila de
sondas à frente dos que já conhecemos** — é exatamente o que a bateria procura.

```bash
node -e "fetch('https://openrouter.ai/api/v1/models').then(r=>r.json()).then(d=>{const f=d.data.filter(m=>+m.pricing.prompt===0&&+m.pricing.completion===0);console.log(f.length+' free');f.map(m=>({id:m.id,ctx:m.context_length,out:(m.top_provider||{}).max_completion_tokens})).sort((a,b)=>a.id<b.id?-1:1).forEach(m=>console.log(m.id+'  ctx='+m.ctx+'  out='+m.out))})"
```

Escreva no diário, em três listas: **sumiu**, **apareceu**, **continua**. Depois classifique
cada modelo de "apareceu" pela regra de aptidão da `MODELOS_ARENA.md` (produz texto,
contexto ≥ 32k, saída ≥ 4k, não é classificador nem router) e junte os aptos à fila da §4.

---

## 4. FASE 1 — SONDAS DE 3 TURNOS

```bash
node runners/rei_vs_rei.js openrouter:<modelo> burro 1 3 resultados/p4-bateria-0821/sonda3_<slug>.txt
```

Segundo lado `burro` = zero API. **3 requisições por modelo.**

**A fila, por ordem.** Sonde de cima para baixo e pare quando tiver **três APTOS**
não-Nemotron — mais do que isso não cabe na noite.

| # | id | por que está na fila |
|---|---|---|
| S0 | *(qualquer não-Nemotron novo da Fase 0)* | é o que a bateria procura; entra à frente de todos |
| S1 | `dots-studio/dots-3-note-preview:free` | passou a sonda de 1 turno em 18/08 (35 s) e **nunca jogou uma partida**. É o candidato mais limpo do catálogo |
| S2 | `google/gemma-4-31b-it:free` | banido em 18/08 por 429 em duas sondas com 10 min de intervalo, no pool partilhado da Google. **São três dias depois e outro pool.** Merece a segunda chance que a spec de 19/08 já lhe tinha prometido |
| S3 | `google/gemma-4-26b-a4b-it:free` | passou a sonda de 1 turno mas tem a assinatura do "pensou e não jogou": 32000 tokens de raciocínio e **43 min num único turno**. A sonda de 3 turnos existe precisamente para apanhar isto antes de custar uma partida |
| S4 | `poolside/laguna-s-2.1:free` | jogou 7 turnos em 18/08 e degenerou (repetiu a mesma frase até estourar o teto). Nunca teve uma partida limpa: a de 18/08 caiu por erro de rede **do adversário** e a P5 de 19/08 parou no turno 5. Sonde antes de lhe dar a terceira |

**Não sonde Nemotron nenhum.** Os quatro que faltam sondar dessa família (`nano-30b-a3b`,
`nano-omni-30b-a3b-reasoning`, `nano-9b-v2`) ficam para outra bateria — não é o alvo de hoje.

Classificação de cada sonda (rode os quatro e cole a saída no diário):

```bash
grep -c ">>> detalhe:"           <sonda.txt>   # erros de rede/API
grep -c "^ordem.construir: \[\]" <sonda.txt>   # turnos sem construção
grep    "^tokens.contexto"        <sonda.txt>  # 3 linhas: ms e finish de cada turno
grep -c "finish length"           <sonda.txt>  # respostas cortadas no teto
```

| o que viu nos 3 turnos | veredito |
|---|---|
| 3 turnos com `construir` cheio, `finish stop`, sem erro | **APTO** |
| 1 ou 2 turnos vazios/cortados, o resto bom | **INSTÁVEL** — anote a fração (ex.: 2/3) |
| 3 turnos vazios ou `finish error` | **NÃO JOGA** |
| `404` **MORTO** · `400` **INCOMPATÍVEL** · `429` **THROTTLED** (1 retry em 10 min, depois banido) |
| mediana de ms acima de **180000** (3 min) | **LENTO** — não use em partida |

Um **INSTÁVEL** joga, mas entra na fila **abaixo** de qualquer APTO. Um APTO com 3/3 turnos
limpos ganha sempre de um INSTÁVEL mais rápido — estabilidade primeiro, latência depois.

**Escreva a tabela de vereditos no diário antes de passar à Fase 2.**

---

## 5. FASE 2 — PARTIDAS

**Toda partida tem `nvidia/nemotron-3.5-lightning:free` de um lado.** É a régua: calibra o dia
(§5 da análise de 20/08) e dá ao modelo novo um adversário com 9 lados de histórico.

| ordem | Rei A | Rei B | seed | turnos | por quê |
|---|---|---|---|---|---|
| **P1** | `gemini:gemini-2.5-flash` | `openrouter:nvidia/nemotron-3.5-lightning:free` | 1 | **18** | O modelo não-Nemotron mais forte que já entrou no jogo, e o mais barato em relógio (25 s/turno). 18 turnos e não 30 **de propósito** — ver §5.1 |
| **P2** | *melhor APTO não-Nemotron da Fase 1* | `openrouter:nvidia/nemotron-3.5-lightning:free` | 1 | 30 | a partida que a bateria existe para produzir |
| **P3** | `openrouter:nvidia/nemotron-3.5-lightning:free` | *o mesmo modelo da P2* | 1 | 30 | **assento trocado.** Sem isto não se sabe se o resultado da P2 é do modelo ou da posição no mapa — e o A/B de assento já mudou uma conclusão antes (17/08, Super 120B) |
| **P4** | *2º melhor APTO não-Nemotron* | `openrouter:nvidia/nemotron-3.5-lightning:free` | 1 | 30 | segundo modelo novo contra a mesma régua |
| **P5** | *3º melhor APTO não-Nemotron* | `openrouter:nvidia/nemotron-3.5-lightning:free` | 1 | 30 | terceiro, **só se a §6.2 deixar** |

**Corte de baixo para cima.** Duas partidas terminadas valem mais que quatro cortadas ao meio.
A P3 (assento trocado) tem prioridade sobre a P4: um modelo medido dos dois lados vale mais para
a tabela do que dois modelos medidos de um lado só.

Se a Fase 1 não devolver nenhum APTO não-Nemotron, faça a P1 e depois **pare** — escreva no
diário "sem candidatos aptos" com a tabela de vereditos. Não encha a noite com Nemotron contra
Nemotron; isso não é o alvo e a tabela já tem seis.

### 5.1 Por que a P1 tem 18 turnos

O `gemini-2.5-flash` corre pelo cliente Gemini direto, **não pela OpenRouter**, e o free tier
dele é de **20 requisições por dia**. A partida de 20/08 morreu exatamente assim: HTTP 429 no
turno 23, com o mapa a correr um turno sem as ordens do Rei B, e o próprio log marcado
`NAO use esta partida como dado de benchmark`.

18 turnos = 18 requisições, com duas de folga. Prefere-se uma partida **completa e curta**, que
termina em `limite` e entra na classificação, a uma partida longa que morre a meio e não entra.

**Consequência a registar no diário:** a P1 tem 18 turnos e as outras 30, por isso a coluna
*aldeias / partida* dela **não é comparável** com as restantes. Escreva isso ao lado do
resultado — não deixe que a tabela o esconda.

Se aparecer 429 do Gemini antes do turno 18, anote e siga: a cota do dia já estava gasta.

### 5.2 Comando

```bash
timeout 14400 node runners/rei_vs_rei.js <A> <B> <seed> <turnos> \
  resultados/p4-bateria-0821/P<n>_<slugA>_vs_<slugB>_seed<n>_<turnos>t.txt
echo "exit=$?"
ls -la resultados/p4-bateria-0821/P<n>_*.replay.json
```

O `.replay.json` **tem de existir**. Se não existir, pare tudo e anote — algo regrediu no runner,
e sem replay metade das métricas da tabela (incluindo o counter por tipo de alvo) fica cega.

---

## 6. RELÓGIO — as duas regras que substituem a vigilância humana

Ninguém vai estar acordado para carregar em Ctrl-C. Por isso o relógio é imposto por comando,
não por atenção.

### 6.1 Teto por partida: 4 h, mecânico

O `timeout 14400` da §5.2 **não é opcional**. Mata a partida às 4 h e devolve `exit=124`.

Isto é seguro: o runner grava o `.txt` por lado e o `.replay.json` por turno, com checkpoint —
um kill perde no máximo o turno em curso. Uma partida morta às 4 h continua a ser dado bom,
marcado como interrompida.

Quando vir `exit=124`, escreva no diário `ABORTADA POR RELÓGIO (4 h)` com o número de turnos que
deu, e siga para a próxima. **Não relance a mesma partida.**

### 6.2 Teto da noite: não abrir partida sem 4 h de folga

Antes de lançar **cada** partida:

```bash
INI=$(cat resultados/p4-bateria-0821/INICIO.txt)
node -e "const i=new Date(process.argv[1]),h=(Date.now()-i)/3600000;console.log('decorridas',h.toFixed(1),'h ->',h<8?'PODE ABRIR':'PARE');" "$INI"
```

- **decorridas < 8 h** → pode abrir a próxima partida.
- **decorridas ≥ 8 h** → **não abra mais nenhuma.** Vá para a §9.

8 + 4 = 12 h de tecto absoluto para a noite. A conta é deliberadamente conservadora: prefere-se
acabar mais cedo com tudo fechado a ser apanhado a meio de uma partida de manhã.

### 6.3 Orçamento previsto

| item | requisições |
|---|---|
| Fase 0 (catálogo) | 1 (não conta para a cota) |
| até 5 sondas × 3 turnos | 15 |
| P1 (18 turnos, 1 lado OpenRouter) | 18 OpenRouter + 18 Gemini |
| P2–P5 (30 turnos × 2 lados) | 60 cada, até 240 |
| **total OpenRouter** | **~275 de 1000** |

Folga larga. Repetindo a regra 5: **a cota não é o que limita esta noite.**

---

## 7. SANIDADE POR PARTIDA (não é análise)

Assim que cada partida acabar — antes de lançar a seguinte:

```bash
node ferramentas/analisar-log.js <partida.txt> <partida.replay.json> | tee resultados/p4-bateria-0821/analise_P<n>.txt
```

Cole no diário **só estes números**, sem interpretar:

- turnos completos, resultado final, placar
- turnos inválidos e ordens inválidas de cada lado
- `finish/nativo` de cada lado (é onde os quatro modos de falha aparecem)
- mediana de ms de cada lado
- **counter vs NEUTRA, counter vs INIMIGO e counter vs RECONQUISTA** — os campos novos.
  São três números por lado, não um. **Não os some** e não reporte a taxa agregada: medem
  competências diferentes (análise de 20/08, §1)
- construções L/A/C de cada lado

Se `counter por tipo de alvo` sair como `indisponivel`, o replay não foi passado ou não existe —
verifique o comando antes de anotar.

**Não escreva o que os números querem dizer.** Nem uma frase. Isso é do Lucas, de manhã.

---

## 8. O DIÁRIO — `resultados/p4-bateria-0821/DIARIO.md`

Escreva **enquanto corre**, não no fim. Se a sessão morrer às 4 da manhã, o diário é tudo o que
sobra, e um diário escrito no fim é um diário que não existe.

Uma entrada por acontecimento, com hora UTC:

```
## 02:14Z — P2 lançada
dots-3-note-preview (A) vs lightning (B), seed 1, 30 turnos
comando: timeout 14400 node runners/rei_vs_rei.js ...

## 03:47Z — P2 terminada, exit=0
28 turnos, resultado: limite, A 13 x B 11
[números da §7 colados aqui]
```

No topo, mantenha uma tabela de estado que se atualiza a cada item — para quem chegar de manhã
saber em dez segundos onde parou:

| item | estado | quando |
|---|---|---|
| Fase 0 | feito | 01:02Z |
| S1 dots-3 | APTO 3/3 | 01:11Z |
| P1 gemini | terminada, 18t | 02:05Z |
| P2 | **a correr** | desde 02:14Z |

---

## 9. PARADA GLOBAL

Pare a bateria inteira, escreva o motivo no diário e vá para a §10, se:

1. a suíte ficar vermelha no preflight;
2. um `.replay.json` não for gerado por uma partida;
3. **três** itens seguidos (sondas ou partidas) morrerem por erro de rede — é a conta que está
   throttled, não os modelos, e insistir só queima cota;
4. o `INICIO.txt` disser 8 h ou mais decorridas (§6.2);
5. a fila da Fase 2 acabar.

Não pare por: um modelo mau, uma partida abortada por relógio, um 429 isolado, um resultado
estranho. Nada disso é motivo de paragem — é dado.

---

## 10. QUANDO ACABAR

1. Feche o `DIARIO.md`: tabela de estado final, e uma lista do que **não** foi feito e porquê.
2. `ls -la resultados/p4-bateria-0821/` no diário — o inventário do que ficou em disco.
3. Uma linha por partida numa tabela de fecho: quem jogou, quantos turnos, placar, como acabou.
4. **Não** atualize a `MODELOS_ARENA.md`, o `resultados_arena.json`, o `site/` ou o
   `manifesto.json`. **Não** faça commit. **Não** faça push.
   Isso é decisão do Lucas depois de ler os números — e é ele que decide, em particular, se as
   partidas de 18 turnos entram na classificação e qual das colunas de counter vai para o site.
5. Deixe escrito, na última linha do diário, o comando exato que ele deve correr para reproduzir
   a análise de qualquer uma das partidas.
