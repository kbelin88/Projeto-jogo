# SPEC — 31/08: as duas primeiras partidas pagas de topo

Escrita no fim de uma sessão longa, para que outra sessão possa conduzir isto do zero.
**Leia esta spec inteira antes de correr o primeiro comando.**

Hoje o projeto passou de free tier para crédito pago e mediu, pela primeira vez, modelos de
topo a jogar. Estas duas partidas são o produto disso.

---

## 0. O QUE JÁ SE SABE (não repetir o trabalho)

**Saldo:** $15 na OpenRouter, **~$12,99 restantes**. Chave nova, no `.env` e no navegador
(terminada em `d219`), com teto de $15 na própria chave.

**A descoberta do dia: o esforço de raciocínio é obrigatório, não opcional.**
Sem ele, o `glm-5.3-flash` gastou os 128.000 tokens inteiros a pensar no turno 5 e devolveu
string vazia; e o Sonnet subiu 2.438 → 17.416 tokens em cinco turnos sem sinal de patamar,
o que projetava estourar o teto de custo por volta do turno 13. Com `medium`, a mesma partida
correu 15 turnos limpa por $0,91.

⚠️ Correção a uma conclusão anterior: eu tinha dito que o consumo **estabiliza** ao longo da
partida, com base em três replays antigos. Estava errado — aqueles eram modelos free já
encostados ao seu teto. Com 128k de folga, o Sonnet **não estabilizou**.

**Medições de hoje** (todas com `REASONING_EFFORT=medium`, 3 a 8 turnos contra o `burro`):

| modelo | vs burro | counter | raciocínio | tempo/turno | $/25 turnos |
|---|---|---|---|---|---|
| Claude Sonnet 5 | (venceu 19x5 o Flash) | — | ~3.000 | ~40 s | ~$1,50 |
| **GPT-5.6 Luna** | 6x3 | **4/5** | 1.193 | **19 s** | **$0,05** |
| DeepSeek V4 Pro | 6x4 | 3/5 | 6.314 | 177 s | $0,42 |
| GLM 5.2 | 5x3 | 4/4 | 13.870 | 232 s | $1,41 |
| GLM 5.3 Flash | **perdeu 9x11** | 1/11 | ~200 | 17 s | $0,03 |

**Zero falhas de formato e zero ordens rejeitadas em todos**, exceto o Flash (8 rejeições).

⚠️ **O GLM 5.3 Flash está fora**: perde para o jogador burro, que é um algoritmo determinístico
sem LLM. Não é adversário. Foi o par da partida de hoje e por isso ela ficou 19x5.

**Cuidado ao ler tokens de prompt entre fornecedores.** O mesmo relatório de 7.508 caracteres
conta 3.169 tokens na Anthropic e 2.224 na Z.ai — 42% de diferença **só de tokenizador**.
Comparar modelos por "tokens de prompt" produz uma conclusão falsa; compare caracteres ou
dólares.

---

## 1. REGRAS DURAS

1. **Não altere código.** Bug encontrado → anote no diário e siga.
2. **Uma partida de cada vez** se forem do mesmo fornecedor. As duas de hoje são de
   fornecedores diferentes (OpenAI e DeepSeek), então **podem correr em paralelo** — mas o
   Sonnet está nos dois lados A, e é da Anthropic. Na dúvida, sequencial.
3. **Nunca apague um log nem um `.replay.json`**, incluindo os das partidas que falharem.
4. **Nunca corte o teto de resposta** (`max_tokens`). Medido em 28/08: o `minimax-m3` perdeu
   6x18 com teto de 32k e sobreviveu 40 turnos com 64k. O botão certo é o esforço, não o teto.
5. **Confirme o gasto antes e depois de cada partida** (comando na secção 2).
6. **Você aponta o dedo; não julga.** Conclusões sobre estratégia são do Lucas.

---

## 2. PREFLIGHT

```bash
cd "C:/Users/biolu/projetos/Projeto Jogo"

# suite verde (31 testes + 9 smokes)
falhas=0; for f in testes/*.js testes_arena/*.js; do node "$f" >/dev/null 2>&1 || { echo "FALHOU: $f"; falhas=1; }; done; [ $falhas -eq 0 ] && echo "suite verde"

# nenhum processo pendurado de sessão anterior
tasklist | grep -ci node

# saldo e chave
node -e "const fs=require('fs');const k=/^OPENROUTER_API_KEY=(.+)\$/m.exec(fs.readFileSync('.env','utf8'))[1].trim();fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+k}}).then(r=>r.json()).then(j=>console.log('chave ...'+k.slice(-4)+'  usado \$'+j.data.usage.toFixed(3)+'  limite \$'+j.data.limit));"
```

A chave tem de terminar em **d219**. Se não terminar, pare e avise o Lucas.

---

## 3. AS DUAS PARTIDAS

Ambas **headless**, pelo runner — correm sozinhas enquanto o Lucas trabalha. A gravação para
vídeo faz-se **depois**, a partir do `.replay.json`, no navegador (é o fluxo estabelecido).

### Partida 1 — Claude Sonnet 5 × GPT-5.6 Luna

```bash
mkdir -p resultados/duelos-0831
LIM_ERRO_REDE=8 REASONING_EFFORT=medium LIM_TURNO_INVALIDO=1 TETO_CUSTO=4 \
node runners/rei_vs_rei.js \
  openrouter:anthropic/claude-sonnet-5 \
  openrouter:openai/gpt-5.6-luna \
  1 200 resultados/duelos-0831/P1_sonnet_vs_luna.txt
```

Previsto: **~1 min/turno**, $1,50 a $2 numa partida de 25 turnos.

### Partida 2 — Claude Sonnet 5 × DeepSeek V4 Pro

```bash
LIM_ERRO_REDE=8 REASONING_EFFORT=medium LIM_TURNO_INVALIDO=1 TETO_CUSTO=4 \
node runners/rei_vs_rei.js \
  openrouter:anthropic/claude-sonnet-5 \
  openrouter:deepseek/deepseek-v4-pro \
  1 200 resultados/duelos-0831/P2_sonnet_vs_deepseek.txt
```

Previsto: **~3,5 min/turno** (o DeepSeek levou 177 s), $2 a $2,50. Uma partida de 25 turnos
leva perto de **1h30**.

**Notas sobre os parâmetros:**

- **`200` não é um limite, é um número grande.** A decisão do Lucas: *a partida tem de ser
  completa*. Ela acaba por vitória (75% por 2 turnos) ou eliminação, não por contagem. Os 200
  existem só para o `while` ter fim.
- **`LIM_TURNO_INVALIDO=1` — aborta ao PRIMEIRO turno inválido.** É a outra decisão do Lucas, e
  é o oposto do que serve para bateria de medição: ali o turno perdido *é* o dado. Aqui não —
  uma partida com turnos mortos não vai para o canal, e continuar só gasta crédito. Vale para
  resposta vazia, cortada no teto, ou JSON quebrado.
  ⚠️ Só dispara em lados que são modelo. O `burro` não produz JSON e sem essa guarda o freio
  matava a partida no turno 1 (apanhado a testar).
- **`TETO_CUSTO=4` — o runner não tinha teto nenhum**, só o navegador tinha. Sem limite de
  turnos e sem teto, uma partida que nunca resolva corre até o saldo acabar. Encerra LIMPO,
  com log e replay salvos.
- `LIM_ERRO_REDE=8` — o padrão é 2, pensado para o free tier onde um teto diário girava horas
  em vão. Com crédito pago a conta inverte-se: uma chamada que falha não custa nada, mas
  abortar no turno 30 deita fora tudo o que já foi pago.
- `REASONING_EFFORT` vale para **os dois** lados. É o que torna a comparação honesta: hoje
  cada fornecedor tem um padrão diferente, e sem isto estaríamos a comparar "o padrão da
  Anthropic" com "o padrão da OpenAI".

---

## 4. ABORTAR SE

Os dois primeiros já são automáticos (`LIM_TURNO_INVALIDO=1` e `TETO_CUSTO=4`). Os restantes
são para o olho:

- **Qualquer turno inválido** → o runner para sozinho e escreve o motivo no log.
- **Um turno acima de 15 minutos** → degeneração por repetição (o `laguna-s-2.1` fez isso em
  agosto). Pare.
- **Gasto acima de $4** → o runner encerra sozinho (`TETO_CUSTO=4`), com tudo salvo.

Em qualquer aborto: o `.txt` e o `.replay.json` ficam gravados até ao último turno completo.
Não se perde nada do que já foi pago.

---

## 5. NO FIM DE CADA PARTIDA

```bash
# o dossiê: placar por turno, como cada aldeia caiu, as falas dos reis, timecodes
node ferramentas/dossie.js resultados/duelos-0831/<nome>.replay.json --vel 5715

# saúde: falhas, rejeições, custo
node -e "
const r=require('./resultados/duelos-0831/<nome>.replay.json');
let mau={A:0,B:0},rej={A:0,B:0};
for(const q of r.frames) for(const L of ['A','B']){const d=q.diag&&q.diag[L];if(!d)continue;
  if(d.vazio||d.truncado||d.formatoOk===false)mau[L]++; rej[L]+=(d.rejeicoes||[]).length;}
const u=r.frames.at(-1);let a=0,b=0;for(const v of u.aldeias){if(v.dono==='A')a++;else if(v.dono==='B')b++;}
console.log('placar '+a+'x'+b+' | turnos '+r.frames.length+' | falhas A '+mau.A+' B '+mau.B+' | rejeicoes A '+rej.A+' B '+rej.B);"
```

E escreva `resultados/duelos-0831/DIARIO.md` com: o que correu, o que falhou, os números, e
**o que ficou por saber**. Sem conclusões sobre qualidade de jogo — isso é do Lucas.

---

## 6. O QUE ESTAS PARTIDAS SERVEM

São o material do canal. O primeiro vídeo longo (`videos/video01/`) tem a vinheta pronta
(1:33, com narração) e o formato de Short fechado (`videos/modelo-short/`).

O título que se procura é **Claude contra GPT** e **Claude contra os chineses** — foi a ideia
do Lucas e é o que faz alguém clicar. Uma partida disputada vale mais que uma demolição: a de
hoje deu 19x5 e não dá bom vídeo.

**Para gravar depois:** modo cinema fixa a câmera automaticamente desde 31/08, e as posições
das 24 aldeias na tela estão em `videos/aldeias_tela.txt` (frações, válidas em qualquer 16:9).
Isso dispensa medir aldeia por aldeia como foi preciso em todas as gravações de agosto.

---

## 7. FIOS ABERTOS QUE NÃO SÃO DESTA SPEC

- ~~Duas chaves expostas em 03/08 por revogar.~~ **REVOGADAS em 01/09.**
- Cliente OpenRouter duplicado (`rei.js` × `index.html`) — a mesma mudança teve de ser feita
  duas vezes hoje, outra vez.
- Um **403 de chave** é reportado como "ERRO DE REDE" e repetido 9 vezes + 2 deliberações.
  Custou minutos hoje e mandou-me investigar o fornecedor errado. 401/403 deviam abortar já.
- `dots-3-note-preview` (4 vitórias por dominância) e `minimax-m3` **não aceitam
  `reasoning_effort`** — ficam de fora enquanto o esforço for obrigatório.
