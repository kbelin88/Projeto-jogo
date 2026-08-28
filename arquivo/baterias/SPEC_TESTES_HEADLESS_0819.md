# SPEC — bateria 19/08: repetir o que ficou duvidoso (para o Sonnet conduzir)

Terceira bateria. A de 18/08 sondou os 10 aptos que faltavam e correu 4 partidas (3 completas).
O catálogo está mapeado; **o que falta agora é confiança**, não cobertura. Duas coisas de
ontem não se sustentaram numa medição só e são o alvo de hoje:

1. **A sonda de 1 turno mentiu duas vezes.** `laguna-s-2.1` deu 5 s na sonda e 181 s de mediana
   em partida (com degeneração: repetiu a mesma frase até estourar o teto). `nemotron-nano-12b-v2-vl`
   deu 5.6 s e depois só entregou 19 de 30 turnos. → **hoje a sonda tem 3 turnos, não 1.**
2. **A regra "quem constrói menos lanceiro ganha" falhou 2 de 3 vezes.** No espelho, venceu o
   lado com 94% de lanceiro (atq/unid 1.08 contra 1.71); e o `nano-12b-v2-vl` perdeu com o maior
   atq/unid já medido (3.29). → **hoje são mais partidas contra a mesma régua**, para ver se a
   regra de 17/08 sobrevive.

Leia `MODELOS_ARENA.md` antes de começar — é a tabela que esta bateria alimenta, e já traz o
veredito de sonda de todos os 14 aptos. **Não gaste cota em nada que ela marque como banido,
morto, lento demais ou "não joga".**

---

## 1. REGRAS DURAS

1. **Não altere código.** Nem `engine.js`, nem `rei.js`, nem o prompt, nem o `CONFIG`, nem as
   ferramentas. Bug encontrado → anote no diário e siga.
2. **Não use**, em partida nenhuma:
   - `z-ai/glm-5.2:free`, `deepseek/deepseek-v4-flash:free`, `minimax/minimax-m3:free`,
     `liquid/lfm-2.5-2.6b:free` — mortos/banidos desde 18/08;
   - `poolside/laguna-xs-2.1:free` — responde e não joga (`construir: []`, `finish: error`, 20 min);
   - `cohere/north-mini-code:free` — 353 s num turno só; 30 turnos custariam ~6 h de um lado só;
   - `openai/gpt-oss-20b:free` — até 45 min/turno em 17/08;
   - os inaptos de `MODELOS_ARENA.md` (routers, classificadores, modelos de áudio).
3. **Nunca apague um log nem um `.replay.json`**, incluindo os das partidas que falharam.
4. Teto: **20 req/min, 1000/dia**. Cada turno de partida = 2 chamadas; cada turno de sonda = 1.
   **Uma partida de cada vez.** Orçamento previsto de hoje: ~16 (sondas) + ~240 (4 partidas) ≈ **256**.
5. Se precisar decidir fora desta spec, escolha o que gasta menos cota e escreva no diário.
6. **Você aponta o dedo; não julga.** Nada de conclusões sobre estratégia, monocultura ou
   qualidade de modelo — isso é análise, e é do Lucas.

---

## 2. PREFLIGHT

```bash
cd "C:\Users\biolu\projetos\Projeto Jogo"
for f in testes/test_*.js;   do node "$f" >/dev/null 2>&1 || echo "FALHOU $f"; done
for f in testes_arena/*.js;  do node "$f" >/dev/null 2>&1 || echo "SMOKE FALHOU $f"; done
node -e "const E=require('./engine.js');const c=E.CONFIG;console.log('promptP4',c.promptP4,'fog',c.fogOfWar,'escala',c.escalaMarcha)"
node -e "require('fs').readFileSync('.env','utf8').includes('OPENROUTER_API_KEY')&&console.log('chave OK')"
mkdir -p resultados/p4-bateria-0819
```

Esperado: nenhum FALHOU, `promptP4 true fog true escala 0.2`, `chave OK`.
**Se a suíte estiver vermelha, não lance nada.**

**Checagem do catálogo (custo zero, não conta cota).** Três dos oito modelos de 17/08 morreram
em menos de 24 h; vale 10 segundos confirmar que os de hoje ainda existem:

```bash
node -e "fetch('https://openrouter.ai/api/v1/models').then(r=>r.json()).then(d=>{const f=d.data.filter(m=>+m.pricing.prompt===0&&+m.pricing.completion===0).map(m=>m.id).sort();console.log(f.length+' free');console.log(f.join('\n'))})"
```

Compare com a lista de `MODELOS_ARENA.md` e **anote no diário só a diferença** (o que sumiu, o
que apareceu). Se sumiu algum modelo que esta spec manda usar, escolha o substituto pela regra
da §4 e escreva por quê.

---

## 3. FASE 1 — SONDAS DE **3 TURNOS**

A mudança do dia. Uma sonda de 1 turno responde "o endpoint existe e o formato sai"; não responde
"ele aguenta 30 turnos". Três turnos custam 3 chamadas e já pegam degeneração, queda de latência
e resposta vazia intermitente — os três modos de falha que apareceram ontem.

```bash
node runners/rei_vs_rei.js openrouter:<modelo> burro 1 3 resultados/p4-bateria-0819/sonda3_<slug>.txt
```

(O 2º lado é `burro` — zero API. Seed 1, 3 turnos → **3 requisições por modelo**.)

Os 5 a sondar — são os que passaram a sonda de 1 turno ontem e **nunca jogaram**:

| # | id | latência da sonda de 18/08 |
|---|---|---|
| S1 | `nvidia/nemotron-3-nano-30b-a3b:free` | 24 s |
| S2 | `google/gemma-4-26b-a4b-it:free` | 32 s (passou só no retry) |
| S3 | `dots-studio/dots-3-note-preview:free` | 35 s |
| S4 | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 47 s |
| S5 | `nvidia/nemotron-nano-9b-v2:free` | 63 s |

**Opcional, 1 requisição:** `google/gemma-4-31b-it:free` foi banido ontem por 429 em duas
tentativas. É outro dia e outro pool — vale **uma** sonda de 1 turno. Se der 429 de novo,
banido de vez, sem terceira chance.

Classificação de cada sonda (rode os quatro greps e cole no diário):

```bash
grep -c ">>> detalhe:"          <sonda.txt>   # erros de rede/API
grep -c "^ordem.construir: \[\]" <sonda.txt>   # turnos sem construção
grep    "^tokens.contexto"       <sonda.txt>   # 3 linhas: ms e finish de cada turno
grep -c "finish length"          <sonda.txt>   # respostas cortadas no teto
```

| o que viu nos 3 turnos | veredito |
|---|---|
| 3 turnos com `construir` cheio, `finish stop`, sem erro | **APTO** |
| 1 ou 2 turnos vazios/cortados, o resto bom | **INSTÁVEL** — anote a fração (ex.: 2/3) |
| 3 turnos vazios ou `finish error` | **NÃO JOGA** |
| `404` | **MORTO** · `400` **INCOMPATÍVEL** · `429` **THROTTLED** (1 retry em 10 min) |
| mediana de ms acima de **180000** (3 min) | **LENTO** — não use em partida de 30 turnos |

Repare que o teto de latência **baixou de 300 s para 180 s**: com 30 turnos, 180 s de um lado já
são 1 h 30 só dele, e a partida inteira passa das 3 h.

**Escreva a tabela de vereditos no diário antes de passar à Fase 2.**

---

## 4. FASE 2 — PARTIDAS

`maxTurnos` **30**. Uma de cada vez. Ordem abaixo; **corte de baixo para cima** se faltar tempo.
Prefira 2 partidas terminadas a 4 cortadas ao meio.

| ordem | A | B | seed | pergunta |
|---|---|---|---|---|
| P1 | `nvidia/nemotron-nano-12b-v2-vl:free` | `nvidia/nemotron-3.5-lightning:free` | **2** | ontem ele só entregou 19 de 30 turnos. Repete? É também a partida mais barata em relógio do dia (7 s/turno do lado A) |
| P2 | **melhor APTO da Fase 1** | `nvidia/nemotron-3.5-lightning:free` | 1 | modelo novo contra a régua da tabela |
| P3 | `nvidia/nemotron-3.5-lightning:free` | `nvidia/nemotron-3.5-lightning:free` | **3** | espelho, 3ª seed. Seed 1 deu 18×4, seed 2 deu 16×8 — **esta fecha o trio da variância** |
| P4 | **2º melhor APTO da Fase 1** | `nvidia/nemotron-3.5-lightning:free` | 1 | segundo modelo novo contra a mesma régua |
| P5 | `poolside/laguna-s-2.1:free` | `nvidia/nemotron-3.5-lightning:free` | 1 | **só se sobrar tempo**: é a P1 de ontem, que caiu no t7 por erro de rede do lado B |

"Melhor APTO" = entre os aprovados na Fase 1, prefira nesta ordem: **(1) estabilidade** (3/3
turnos limpos ganha de 2/3, sempre), (2) menor mediana de ms, (3) tem raciocínio. Escreva no
diário qual escolheu **e por quê**.

Comando e nomes de ficheiro:

```bash
node runners/rei_vs_rei.js openrouter:<modeloA> openrouter:<modeloB> <seed> 30 \
  resultados/p4-bateria-0819/P<n>_<slugA>_vs_<slugB>_seed<n>_30t.txt
ls -la resultados/p4-bateria-0819/P<n>_*.replay.json    # tem de existir
```

Se o `.replay.json` **não** existir, pare tudo e anote — algo regrediu no runner.

### 4.1 Regra de relógio (nova)

Ontem uma partida levou **4 h 14** e a bateria inteira, 11 h 40. Hoje, **depois do turno 5** de
cada partida, meça e decida:

```bash
grep "^tokens.contexto" <partida.txt> | grep -o "ms [0-9]*" | awk '{s+=$2; n++} END {print "media", s/n/1000, "s em", n, "chamadas -> projecao", s/n*60/3600000, "h"}'
```

- projeção **acima de 5 h** → **aborte a partida** (Ctrl-C), anote `ABORTADA POR RELÓGIO` com a
  projeção, e siga para a próxima da lista. Não é falha do modelo; é escolha de orçamento.
- projeção abaixo de 5 h → siga até o fim, sem mexer mais.

---

## 5. SANIDADE POR PARTIDA (não é análise)

Dois blocos, os dois colados no diário.

**(a) O de sempre** — passe o replay como 2º argumento, senão o bloco A3 sai vazio:

```bash
node ferramentas/analisar-log.js <arquivo.txt> <arquivo.replay.json> 2>&1 | head -14
```

**(b) Por lado — latência, cortes e turnos vazios.** Foi o que faltou ontem: o diário registrou
"~2 h de partida" sem dizer qual dos dois lados custou o tempo. Rode tal e qual:

```bash
awk '
/^########## TURNO/ { if (match($0,/Rei [AB]/)) lado=substr($0,RSTART+4,1); next }
/^tokens\.contexto:/ {
  if (match($0,/ms [0-9]+/)) { ms=substr($0,RSTART+3,RLENGTH-3)+0; n[lado]++; v[lado","n[lado]]=ms }
  if (match($0,/finish [a-z]+/)) cnt[lado" "substr($0,RSTART+7,RLENGTH-7)]++
  next }
/^ordem\.construir: \[\]/ { vazio[lado]++ }
END {
  for (l in n) { c=n[l]; for(i=1;i<=c;i++) a[i]=v[l","i]
    for(i=1;i<c;i++) for(j=i+1;j<=c;j++) if(a[i]>a[j]){t=a[i];a[i]=a[j];a[j]=t}
    printf "Rei %s: chamadas=%d mediana=%.0fms min=%d max=%d construir_vazio=%d\n", l,c,(c%2)?a[int(c/2)+1]:(a[int(c/2)]+a[int(c/2)+1])/2,a[1],a[c],vazio[l]+0 }
  for (k in cnt) printf "   finish %s = %d\n", k, cnt[k] }
' <arquivo.txt>
```

Saída esperada (exemplo real de ontem):

```
Rei A: chamadas=19 mediana=7305ms min=4960 max=64901 construir_vazio=11
Rei B: chamadas=29 mediana=196017ms min=6692 max=360058 construir_vazio=21
   finish A stop = 19
   finish B length = 13
   finish B stop = 16
```

Se alguma ferramenta crashar: anote o erro completo e siga. **Não corrija.**

---

## 6. O DIÁRIO — `resultados/p4-bateria-0819/DIARIO.md`

Atualize **depois de cada sonda e de cada partida**, nunca no fim (se o processo morrer, o que
não foi escrito não existe).

Sondas, uma tabela só:

```markdown
| modelo | veredito | turnos limpos | mediana ms | finish | observação |
|---|---|---|---|---|---|
| nvidia/nemotron-3-nano-30b-a3b:free | APTO | 3/3 | 24000 | 3 stop | — |
```

Partidas: lançada/terminou (com as horas), resultado, placar, **os dois blocos da §5**,
`INTERROMPIDA`/`ABORTADA POR RELÓGIO` se for o caso, e as estranhezas.

No fim do dia acrescente: estado por modelo, total de requisições, linhas da spec que não
correram e **as 3 coisas mais estranhas** que viu.

---

## 7. PARADA GLOBAL

Pare e escreva o diário se: aparecer `403`/`Key limit`; o contador passar de **800**
requisições; **três sondas seguidas** falharem com erro que não seja 404; a suíte do preflight
estiver vermelha; faltar disco.

**Exceção aprendida ontem:** 429 de um provedor (Google AI Studio, Darkbloom) **não** é problema
da conta — é pool compartilhado daquele modelo. Se as três falhas seguidas forem 429 de
provedores diferentes de modelos diferentes, **não pare**: marque os modelos e siga. Pare de
verdade só se o erro for da chave (`403`, `Key limit`) ou se as três falhas forem do mesmo
modelo que você precisa usar.

---

## 8. QUANDO ACABAR

Deixe no diretório: sondas, `.txt`, **`.replay.json`** e o `DIARIO.md`. Não faça commit, não
faça push, não apague nada. Última linha do diário:

> Bateria concluída/interrompida em <hora>. Sondas: <N> aptas, <N> instáveis, <N> outras.
> Partidas: <N> completas, <N> abortadas. Requisições: <N>. Replays gravados: <N>.
