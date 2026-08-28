# O P4 no ar — primeiras duas partidas (17/08, 16:24 e 16:36)

GLM 5.2 free (Rei A) × Nemotron 3 Ultra 550B free (Rei B), seed 1, ruleset vivo com
`promptP4` e `fogOfWar` ligados. Duas partidas curtas: **1 turno** e **4 turnos**.

## 0. Estatuto do dado

Nenhuma das duas serve como benchmark, e as duas morreram pela **mesma causa, que não é o
jogo**: `z-ai/glm-5.2:free` devolveu HTTP 429 três vezes (uma na 16:24, duas na 16:36), sempre
do provedor **Decart**, sempre com `limit_source: upstream_provider_shared_pool` e
`retry_after_seconds: 5`. O Nemotron 3 Ultra fez **5 chamadas sem um único erro**.

Mas dá para responder a pergunta que importava — **o P4 funciona?** — porque o Nemotron
jogou 4 turnos inteiros e deixou o raciocínio gravado. Funciona, e melhor do que eu esperava.

---

## 1. As três incoerências corrigidas apareceram no comportamento

Não é inferência: são as palavras do modelo, no log.

**Condição de vitória (incoerência 2)** — o P4 passou a dizer os 75%/2 turnos, e o modelo
adotou isso como objetivo em todos os turnos:

> T1: *"Goal: hold 18 of 24 villages for 2 consecutive turns, or eliminate all enemy villages"*
> T2: *"We need to expand to reach 18 villages (75%)"*
> T3: *"Goal: expand to hold 18 villages"*

Compare com a partida de 13:03, em que o Gemini repetia *"my primary objective remains the
enemy CAPITAL"* enquanto ia ganhando por dominância sem saber que a regra existia.

**Reforço (incoerência 1)** — o Nemotron, que na partida anterior fez **1 reforço em 16
turnos** porque a instrução o proibia, fez **4 reforços em 2 turnos**:

```
T3: reforco chegou em [13] Tarragona do Rei B: 3L+2A+1C
T4: reforco chegou em [13] Tarragona do Rei B: 2L+1A
T4: reforco chegou em [13] Tarragona do Rei B: 1C
```

Ele está a concentrar força em Tarragona, que é a doutrina que o prompt sempre ensinou e a
instrução sempre proibiu. **Concentração logística 0.50** na métrica A3.

**Fog of war** — o modelo fala de visão em todos os turnos: *"We can see two neutral villages:
Tarragona (13) and Girona (14)"*, *"We don't know enemy location"*, e a partir do T2 cita a
seção `UNEXPLORED`. No T4: *"Unexplored... unknown"*.

**O campo `quantidade` foi usado no primeiro turno, sem exemplo nenhum.** O modelo emitiu
`{"aldeiaId": 12, "tipo": "lanceiro", "quantidade": 2}` só por ler o esquema declarado —
4 vezes ao longo da partida, todas registradas como `NORMALIZADO: quantidade N expandida`.

---

## 2. O achado grande: tirar o "para tomar" MELHOROU o jogo

A decisão do Lucas foi remover o mínimo pré-calculado por alvo. O medo era perder qualidade
de ataque. Aconteceu o contrário:

| | 15/08 e 17/08 01:49 (P2, com "para tomar") | 17/08 16:36 (P4, sem) |
|---|---|---|
| taxa de counter, Rei A | 0.55 / 0.67 | **0.40** |
| taxa de counter, Rei B | 0.46 / 0.50 | **1.00** (6 de 6) |
| conquistas/combates A | 0.82 / 0.75 | **1.00** (5 de 5) |
| conquistas/combates B | 0.46 / 0.67 | **1.00** (6 de 6) |

**Todos os ataques das duas partidas foram vitoriosos, e o Nemotron acertou o counter em
100% deles.** E o raciocínio mostra *por que*: sem o número pronto, ele fez a conta —
e ao fazê-la, descobriu a jogada ótima que o número pronto escondia:

> *"If we have counter, defender does not [...] So even 1 cavaleiro (attack 4) × 1.5 = 6 > 3.
> So 1 cavaleiro alone can capture a neutral village!"*

Foi exatamente o que fez: 1 cavaleiro por aldeia neutra, com o counter certo. O antigo
`para tomar: 8 lanc ou 3 arq ou 1 cav` **enumerava soluções mono-tipo e não mencionava o
counter** — dava o peixe e escondia a vara.

Isto obriga a reinterpretar o "entesouramento". O Nemotron tem **75% dos ataques com 1
tropa** — pelo indicador antigo, entesouramento clássico. Só que aqui é **cirurgia**: 1
cavaleiro com counter derrota uma neutra, e todos venceram. A métrica `envios de 1 tropa`
confunde duas coisas opostas: gotejar tropa sem efeito, e explorar o counter com precisão.
**Proposta para o `analisar-log.js`**: separar `ataques de 1 tropa que CONQUISTARAM` de
`ataques de 1 tropa que falharam` e de `reforços de 1 tropa`. Sem isso a métrica pune quem
joga bem.

---

## 3. Custo: −38% de tokens de prompt, medido

Comparação honesta, porque os dois Reis B são Nemotron (mesma família de tokenizador):

| turno | P2 (13:03) | P4 (16:36) | tokens | chars | chars/token |
|---|---|---|---|---|---|
| 1 | 4126 | **2396** | −42% | −30% | 2.61 → 3.16 |
| 2 | 4369 | **2751** | −37% | −24% | 2.61 → 3.17 |
| 3 | 4683 | **3091** | −34% | −20% | 2.59 → 3.16 |

**Média: −38% em tokens, −24% em chars.** Os 14 pontos de diferença são a tokenização: o
inglês rende **3.16 chars/token contra 2.61 do português (+21%)**. A hipótese do estudo
(§3 do `ESTUDO_PROMPT_P4.md`) previa +30-70% e entregou +21% — menos do que o texto puro
daria, porque metade do prompt são ids e números, que tokenizam igual em qualquer língua.

Lembrete do estudo que continua válido: 84-93% do custo está na **resposta**. O ganho de
prompt é real mas secundário; quem paga a conta é o raciocínio.

---

## 4. Zero alucinação de id, sem exemplo para copiar

A E9 não extraiu **nenhuma** afirmação espacial verificável nos 8 turnos-modelo, e
**nenhum id inexistente foi citado** por qualquer dos dois. Duas leituras:

- **A favor do P4**: o medo de que remover o exemplo quebrasse o grounding não se
  materializou. Nem um id inventado, nem uma origem inválida. A única rejeição da partida foi
  económica (`construir [0]: recurso insuficiente p/ cavaleiro (tem 30m/10f, custa 30m/30f)`)
  — o GLM tentou cavalaria sem ferro, que é o degrau 2 clássico.
- **Efeito colateral do fog**: com 5 aldeias visíveis em vez de 23, o modelo **deixa de
  especular sobre geografia distante**. A E9 mede afirmações espaciais, e elas quase
  desapareceram. Isso é bom para o jogo e ruim para aquela métrica: sob fog, a E9 precisa de
  partidas longas para ter denominador. Não é para corrigir agora, é para saber ao ler.

A escala de marcha deduzida do replay deu **0.2** — o ruleset novo, confirmado pela terceira
via (o cabeçalho diz, o teste prova, e agora a ferramenta deduz sozinha).

---

## 5. O que quebrou, e o que fiz

**O 429 do pool compartilhado.** `glm-5.2:free` é servido por um provedor só (Decart) e o
pool é compartilhado entre todos os utilizadores gratuitos da OpenRouter. O cliente tinha
6 tentativas com backoff exponencial **adivinhado**, e o provedor estava a dizer no header
`Retry-After: 5` — que o cliente ignorava. Gastava as tentativas rápido e desistia.

Implementado (tudo infra, nada toca métrica de modelo):

1. **O cliente honra o `Retry-After`**, do header ou do `retry_after_seconds` no corpo, com
   teto de 45s por espera, e passou de 6 para **9 tentativas**.
2. **Retentativa no nível do TURNO** (`deliberarComRetentativa`): num erro de rede, repete a
   **deliberação** até 2 vezes, com 20s de intervalo. É seguro para a fairness porque, no
   caminho de ordens simultâneas, **nada foi aplicado ainda** — o Rei recebe o mesmo prompt
   sobre o mesmo estado. E repete a **chamada**, nunca o **parse**: um JSON quebrado continua
   sem segunda chance, porque esse é o degrau 0 que o benchmark mede.
3. **O log passa a dizer o throttle que a partida SOBREVIVEU**: linha
   `THROTTLE: N x 429/503 recuperado(s)` e `RETENTATIVA DE TURNO: N`, mais um campo no RESUMO.
   Antes, um modelo free que precisa de 5 tentativas por turno parecia igual a um que responde
   de primeira.

Trancado em `testes_arena/Smoke6rede.js` (13 checagens, com `fetch` falso — não toca a rede,
não gasta cota, não precisa de chave). Suíte: **29 testes do motor + 7 smokes**, verde.

**Nota:** o `.txt` das duas partidas registra corretamente que houve erro de rede e avisa para
não usar como benchmark. E, se acontecer de novo, **basta apertar Play** — a partida retoma de
onde parou; o turno afetado fica fora das métricas.

---

## 6. A restrição prática que ninguém previu: latência

| | mediana | máximo |
|---|---|---|
| GLM 5.2 free | **5.9s** | 6.9s |
| Nemotron 3 Ultra 550B free | **167s** | 264s |

4 turnos levaram ~11 minutos. Nesse ritmo, **20 turnos são ~1h45**, e uma partida até os 75%
(que na partida de 13:03 chegou no T17) passa das duas horas. O Nemotron 3 Ultra é 550B: a
qualidade tem preço em relógio, não em dólar.

Para as próximas partidas, isto muda a escolha de par mais do que qualquer outra coisa.

---

## 7. O que eu recomendo para o próximo teste

**Par sugerido: GLM 5.2 × Nemotron 3.5 Lightning.** Motivos: o Lightning é 1M de contexto,
Nvidia-hosted (o Ultra não deu um erro, então a hospedagem Nvidia parece sólida) e, sobretudo,
**não tem raciocínio** — o que faz dele o braço de controlo perfeito para isolar quanto do
desempenho vem do thinking. E deve ser muito mais rápido que o Ultra.

**Se quiser dois raciocinadores**, mantenha GLM × Ultra, mas com `turnos 20` em vez de ∞, e
saiba que vai levar ~1h45.

**O que ainda não sabemos** e a próxima partida longa responde:
- o duelo rei-contra-rei chega quando, **sob fog**? (sem fog chegou no T8; agora os Reis
  precisam de se *encontrar* primeiro)
- as neutras esgotam-se, ou o fog deixa aldeias nunca exploradas até o fim?
- a vitória por dominância dispara? (75% de 24 = 18 aldeias, sob fog, é muito mais difícil)
- o GLM aprende a usar o counter como o Ultra, ou fica nos 0.40?
- o `plano` está a servir de memória de mapa? (com fog, é a única memória que o Rei tem
  além do "last seen" — vale ler os planos dele)

**Uma coisa que eu não posso fazer**: disparar as partidas. As chamadas saem do seu
navegador, com a sua chave no `localStorage`. O que faço bem é o que fiz aqui — pegar o
`.txt` e o `replay.json` e devolver a leitura. Deixe os ficheiros e eu analiso.
