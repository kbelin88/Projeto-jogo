# SPEC — bateria 18/08: mapear o catálogo free (para o Sonnet conduzir)

Segunda bateria. A de 17/08 mediu 4 modelos; **o catálogo tem 14 aptos** e 10 nunca jogaram.
O objetivo de hoje é **encher a tabela**, não aprofundar. Leia `MODELOS_ARENA.md` antes de
começar — é a tabela que esta bateria alimenta.

**Novidade desde ontem:** o runner headless agora grava **`<saida>.replay.json`** ao lado do
`.txt`. Não faça nada para isso acontecer; só **nunca apague o `.replay.json`** — é ele que
permite as métricas A3, a escala de marcha e a reconstrução de prompt.

---

## 1. REGRAS DURAS

1. **Não altere código.** Nem `engine.js`, nem o prompt, nem o `CONFIG`, nem as ferramentas.
   Bug encontrado → anote no diário e siga.
2. **Não use** `z-ai/glm-5.2:free` (banido, 429 crónico) nem os mortos de ontem
   (`deepseek/deepseek-v4-flash:free`, `minimax/minimax-m3:free`, `liquid/lfm-2.5-2.6b:free`).
3. **Não use** os inaptos listados em `MODELOS_ARENA.md` (routers, classificadores, modelos de
   áudio). A tabela diz o porquê de cada um.
4. **Nunca apague um log nem um replay**, incluindo os das partidas que falharam.
5. Teto: **20 req/min, 1000/dia**. Cada turno = 2 chamadas. **Uma partida de cada vez.**
6. Se precisar decidir fora desta spec, escolha o que gasta menos cota e escreva no diário.

---

## 2. PREFLIGHT

```bash
cd "C:\Users\biolu\projetos\Projeto Jogo"
for f in testes/test_*.js;   do node "$f" >/dev/null 2>&1 || echo "FALHOU $f"; done
for f in testes_arena/*.js;  do node "$f" >/dev/null 2>&1 || echo "SMOKE FALHOU $f"; done
node -e "const E=require('./engine.js');const c=E.CONFIG;console.log('promptP4',c.promptP4,'fog',c.fogOfWar,'escala',c.escalaMarcha)"
node -e "require('fs').readFileSync('.env','utf8').includes('OPENROUTER_API_KEY')&&console.log('chave OK')"
mkdir -p resultados/p4-bateria-0818
```

Esperado: nenhum FALHOU, `promptP4 true fog true escala 0.2`, `chave OK`.
**Se a suíte estiver vermelha, não lance nada.**

---

## 3. FASE 1 — SONDAR TUDO ANTES DE JOGAR QUALQUER COISA (prioridade máxima)

Ontem 3 de 8 modelos estavam mortos e só se descobriu no meio da bateria. Hoje **sonde os 10
não-testados primeiro**, de uma vez. Custo: **10 requisições** — 1% da cota diária.

```bash
node runners/rei_vs_rei.js <modelo> burro 1 1 resultados/p4-bateria-0818/sonda_<slug>.txt
```

Os 10 a sondar (todos aptos por `MODELOS_ARENA.md`, nenhum testado):

| # | id | por que interessa |
|---|---|---|
| S1 | `cohere/north-mini-code:free` | 30B-A3B agêntico; tokenizer Cohere (o único não-GPT/Gemma da lista) |
| S2 | `dots-studio/dots-3-note-preview:free` | 512k de contexto e 512k de saída — o maior teto de resposta do catálogo |
| S3 | `google/gemma-4-31b-it:free` | 31B denso |
| S4 | `google/gemma-4-26b-a4b-it:free` | 26B MoE, irmão do anterior |
| S5 | `poolside/laguna-s-2.1:free` | raciocínio ligado por padrão |
| S6 | `poolside/laguna-xs-2.1:free` | 33B-A3B, o irmão pequeno |
| S7 | `nvidia/nemotron-3-nano-30b-a3b:free` | nano da família que já domina a tabela |
| S8 | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | raciocínio por padrão |
| S9 | `nvidia/nemotron-nano-12b-v2-vl:free` | 12B |
| S10 | `nvidia/nemotron-nano-9b-v2:free` | 9B — o menor apto; candidato a baseline fraco |

Depois de cada sonda, classifique com **três** greps:

```bash
grep -m2 ">>> detalhe:" <sonda.txt>            # erro de rede/API, se houve
grep -m1 "^ordem.construir" <sonda.txt>        # produziu ordem?
grep -m1 "^tokens.contexto" <sonda.txt>        # latência (campo | ms N)
```

| o que viu | veredito |
|---|---|
| `ordem.construir` com conteúdo | **OK** |
| `ordem.construir: []` mas sem erro | **RESPONDE MAS NÃO JOGA** — anote, é achado |
| `404` | **MORTO** |
| `400` | **INCOMPATÍVEL** (provável `reasoning` não suportado) |
| `429` | **THROTTLED** — tente 1 vez mais depois de 10 min; se repetir, banido do dia |
| `ms` acima de **300000** (5 min) | **LENTO DEMAIS** — marque, e não o use em partida longa |

**Escreva a tabela de vereditos no diário antes de passar à Fase 2.** Ela é o entregável mais
valioso do dia, mesmo que nenhuma partida corra.

---

## 4. FASE 2 — PARTIDAS

Só com os modelos **OK** da Fase 1. `maxTurnos` **30** (ontem duas partidas morreram no limite
com alguém já nos 75%). Seed 1.

**Referência de tempo:** ontem uma partida de 25 turnos levou 2h-2h39. Com 30 turnos, conte
~3h por partida. **Não lance mais partidas do que cabem no seu tempo** — prefira menos
partidas terminadas a muitas cortadas ao meio.

Ordem (corte de baixo para cima se faltar tempo):

| ordem | A | B | turnos | pergunta |
|---|---|---|---|---|
| P1 | **melhor OK novo** | `nvidia/nemotron-3.5-lightning:free` | 30 | o novo modelo bate o cavalo de batalha da tabela? |
| P2 | `nvidia/nemotron-3-super-120b-a12b:free` | `nvidia/nemotron-3-ultra-550b-a55b:free` | 30 | **os dois que constroem exército de ataque alto, frente a frente.** Nunca se enfrentaram |
| P3 | **2º melhor OK novo** | `nvidia/nemotron-3.5-lightning:free` | 30 | segundo modelo novo contra a mesma régua |
| P4 | `nvidia/nemotron-3.5-lightning:free` | `nvidia/nemotron-3.5-lightning:free` | 30 | espelho, **seed 2** (ontem o espelho com seed 1 deu 18×4; medir a variância) |

"Melhor OK novo" = entre os aprovados na Fase 1, prefira nesta ordem: (1) o de menor latência,
(2) o que tem raciocínio, (3) o de maior contexto. Escreva no diário qual escolheu **e por quê**.

Nomes de ficheiro:

```
resultados/p4-bateria-0818/P<n>_<slugA>_vs_<slugB>_seed<n>_<turnos>t.txt
```

O `.replay.json` sai sozinho ao lado. **Confira que ele existe** depois de cada partida:

```bash
ls -la resultados/p4-bateria-0818/P1_*.replay.json
```

Se **não** existir, pare tudo e anote — significa que algo regrediu no runner.

---

## 5. SANIDADE POR PARTIDA (não é análise)

```bash
node ferramentas/analisar-log.js <arquivo.txt> <arquivo.replay.json> 2>&1 | head -14
```

Cole as linhas no diário. **Passe o replay como 2º argumento** — sem ele o bloco A3 sai
"indisponivel" e metade do valor da partida se perde.

Se alguma ferramenta crashar: anote o erro completo e siga. Não corrija.

**Não escreva conclusões** sobre qualidade, monocultura, counter ou estratégia. Isso é análise
e é do Lucas. Você aponta o dedo; não julga.

---

## 6. O DIÁRIO — `resultados/p4-bateria-0818/DIARIO.md`

Atualize **depois de cada sonda e de cada partida**, nunca no fim (se o processo morrer, o que
não foi escrito não existe).

Para as sondas, uma tabela só:

```markdown
| modelo | veredito | ms do turno 1 | observação |
|---|---|---|---|
| cohere/north-mini-code:free | OK | 42000 | respondeu JSON válido, 3 construções |
```

Para as partidas, o mesmo formato de ontem (lançado/terminou, resultado, turnos com resposta,
INTERROMPIDO, throttle, requisições, e as estranhezas).

No fim do dia acrescente: estado por modelo, total de requisições, linhas que não correram e
**as 3 coisas mais estranhas** que viu.

---

## 7. PARADA GLOBAL

Pare e escreva o diário se: aparecer `403`/`Key limit`; o contador passar de **800**
requisições; **três sondas seguidas** falharem com erro que não seja 404 (404 é modelo morto,
não problema de conta); a suíte do preflight estiver vermelha; faltar disco.

---

## 8. QUANDO ACABAR

Deixe no diretório: sondas, `.txt`, **`.replay.json`** e o `DIARIO.md`. Não faça commit, não
faça push, não apague nada. Última linha do diário:

> Bateria concluída/interrompida em <hora>. Sondas: <N> OK, <N> mortos, <N> outros.
> Partidas: <N> completas. Requisições: <N>. Replays gravados: <N>.
