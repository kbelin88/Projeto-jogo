# ESTUDO — o caminho para o prompt P4

Responde às quatro dúvidas do Lucas (exemplos, inglês, fog of war, compreensão do mapa),
lista as incoerências novas encontradas no prompt atual, e decompõe o custo real por turno.
Material: os 32 prompts exatos reconstruídos da partida 13:03 (`prompts_reconstruidos_1303/`),
os 4 logs de partida, o replay, e o `engine.js` da branch `spec-lote-e-fairness`.

Princípio que guia tudo abaixo, na formulação do próprio projeto: *o prompt informa, não
recomenda*. Toda regra que o motor executa tem de estar dita; nenhuma frase pode empurrar
uma jogada; e a memória é responsabilidade do motor, não do modelo.

---

## 1. ANTES DAS DÚVIDAS — a incoerência que muda a leitura das últimas partidas

**A instrução de processo do prompt PROÍBE reforçar as próprias aldeias. E a doutrina de
concentração, quinze linhas acima, EXIGE isso.**

O bloco de REGRAS DE MOVIMENTO diz (engine.js:1961→, presente em todos os prompts):

> *"Para atacar com forca concentrada, primeiro reuna as tropas numa aldeia sua
> (**enviando-as para la como reforco**) e depois ataque a partir dessa aldeia num unico envio."*

E a instrução de processo, logo antes do exemplo (engine.js:2052):

> *"Escolha o 'destinoId' **entre os ids das secoes ALDEIAS NEUTRAS e INIMIGO**."*

Reforçar = `destinoId` numa aldeia da seção SUAS ALDEIAS. A instrução exclui exatamente
isso. O motor aceita reforços normalmente (`diagnosticarOrdem` não recusa; a métrica A3
existe para os contar) — a proibição só existe no texto.

**E há prova de que um modelo obedeceu, no raciocínio gravado.** Nemotron, turno 3 —
ele tinha PLANEJADO um reforço, releu a instrução e o cancelou:

> *"In envios we used origemId 12 and 15, destinoId 13 and 16. Destination 13 is our own
> village (allowed? The rule says choose destinoId between ids of sections ALDEIAS NEUTRAS
> and INIMIGO. [...] **So we cannot send to our own village. So sending reinforcement from
> Barcelona to Tarragona is not allowed** because Tarragona is our own village."*

O raciocínio dele cita a regra do `destinoId` **39 vezes** ao longo da partida. Agora os
números de reforço (A3, pelo replay) das duas partidas com replay:

| partida | Rei | reforços | ataques |
|---|---|---|---|
| 13:03 | Gemini (A) | **44** | 55 |
| 13:03 | Nemotron (B) | **1** | 17 |
| 01:49 | DeepSeek (A) | **69** | 21 |
| 01:49 | Qwen (B) | **25** | 20 |

Todos os outros três **desobedeceram a letra da instrução** — e o jogo os recompensou,
porque concentrar via reforço é a jogada certa. O Nemotron foi o único literal, e ficou
estruturalmente impedido de concentrar força: cada aldeia dele lutou com o que tinha.

Três consequências:

1. **A "agência 6.19 × 1.29" da partida 13:03 mede, em parte, disposição a violar uma
   instrução literal.** O Nemotron não foi passivo — foi obediente. Isto suaviza a leitura
   do relatório anterior (§3), que atribuiu o 1.64 envios/turno dele a "escolha".
2. **O entesouramento ganha um suspeito novo.** O gotejamento de 1 tropa é feito de envios
   de reforço — exatamente a categoria que a instrução proíbe. Modelos que meio-obedecem
   podem estar a reforçar "timidamente". Não está provado; entra na lista de hipóteses.
3. É a **quinta mordida** da família "o que o decisor LÊ ≠ o que o motor EXECUTA" — desta
   vez o texto proíbe o que o motor permite. A direção inversa das quatro anteriores.

**Correção**: a linha deve dizer que `destinoId` pode ser qualquer aldeia que não a origem —
inimiga ou neutra para atacar, **sua para reforçar**. Uma frase.

---

## 2. DÚVIDA 1 — retirar os exemplos?

**Sim ao objetivo, com escada em vez de salto.** O que os dados e a história do repo dizem:

- **O exemplo influencia.** O molde mostra sempre `"tipo": "lanceiro"` (engine.js:1867) e o
  Nemotron construiu 64L/9A/21C. O repo já provou a versão forte disto em modelo pequeno:
  a frase "listas vazias são válidas" congelou o llama3:8b em 0.00 envios/turno, 5/5 seeds
  (comentário em engine.js:2023-2029). Modelos copiam o molde; falta só medir o quanto os
  grandes copiam.
- **O exemplo também DEMONSTRA uma anti-doutrina.** As duas linhas de envio do
  `exemploAncorado` saem da MESMA origem com METADE das tropas cada, para DOIS alvos
  diferentes (engine.js:1855-1863) — ou seja, o exemplo encena divisão de forças, que as
  regras de movimento mandam evitar. O modelo lê "concentre" e vê "divida".
- **Mas o exemplo hoje carrega três funções diferentes**, e só uma delas precisa de valores:
  ensinar o **esquema** (chaves e tipos — não precisa de valores), ensinar a **escala** (já
  está no `DISPONIVEL PARA ENVIAR AGORA`), ensinar de onde tirar **ids** (a instrução de
  processo já diz).

**Proposta**: substituir o exemplo por um **esquema declarado** — a descrição dos campos com
os três tipos de tropa enumerados (nenhum escolhido), sem nenhum número:

```
"construir": lista de {"aldeiaId": <id de uma aldeia SUA>, "tipo": "lanceiro"|"arqueiro"|"cavaleiro"}
"envios":    lista de {"origemId": <id SEU>, "destinoId": <qualquer outra aldeia>, "tropas": {...}}
```

E validar pela escada de experimentos (free-tier, uma mudança por vez):

- **E6a** — sortear o `tipo` do exemplo por turno. Se a composição seguir o sorteio, a
  monocultura das 4 partidas é artefacto do molde. É o experimento mais informativo do lote
  porque reinterpreta dados já pagos.
- **E6b** — esquema declarado no lugar do exemplo. Medir: turnos inválidos, rejeições,
  agência, composição.
- **E6c** — braço de controlo com modelo pequeno (ollama local), porque a previsão é que o
  esquema declarado piore os pequenos. Se confirmar, o achado é publicável por si: *o
  andaime que o fraco precisa é o viés que o forte sofre* — e o benchmark pode adotar
  esquema declarado como padrão e reportar "precisou de exemplo" como métrica de degrau.

**Nota sobre o caminho que NÃO recomendo**: forçar JSON por `response_format`/grammar do
provedor resolveria o formato de vez — mas o degrau 0 da escada ("emite JSON válido?") é
uma das coisas que o benchmark mede. Constrained decoding apagaria essa medição. Enquanto
isto for benchmark, formato livre; quando virar produto, aí sim.

---

## 3. DÚVIDA 2 — prompt em inglês?

**Sim, e os dados internos são mais fortes do que a intuição.** Os quatro raciocinadores
já pensam em inglês SOBRE o prompt em português — verificado nos logs:

> DeepSeek T3: *"We are in Turn 3. We have 4 villages: [0] Lisboa..."*
> Qwen T3: *"Okay, let's see. I need to figure out the best move..."*
> Nemotron T10: *"We need to compute resources per village..."*
> Gemini T6: *"Alright, let's get down to brass tacks."*

Cada turno de cada modelo já paga uma tradução PT→EN implícita. E há um segundo argumento,
medível e que ninguém intui: **tokenização**. O prompt em PT rende 2.6-2.8 chars/token nos
tokenizadores destes modelos (medido nos 32 prompts contra os tokens reportados). Inglês
técnico rende tipicamente 3.5-4.5. **O mesmo conteúdo em inglês deve custar ~20-30% menos
tokens de prompt** — de graça, sem cortar informação.

Decisões que a migração arrasta (e é melhor decidir agora do que carregar dois idiomas —
a lição do ruleset aplica-se a prompts: *uma língua que pode não estar ligada, não estará*):

| item | proposta |
|---|---|
| nomes dos tipos no JSON | migrar para `spearman`/`archer`/`knight` e ensinar o `normalizarTipo` (engine.js:878, hoje só tira acento/plural) a aceitar os nomes PT como sinónimos — logs antigos e modelos teimosos continuam válidos |
| `plano` | inglês — é nota do modelo para si mesmo; menos tokens, língua nativa do raciocínio |
| `depoimento` | **é a única peça de AUDIÊNCIA** — idioma configurável (`idiomaNarracao`), porque a narração do YouTube decide, não o benchmark. Se o canal for PT, pedir o depoimento em PT custa uma frase |
| comparabilidade | quebra com o histórico — aceitável pelo CLAUDE.md §6 ("comparabilidade não é prioridade até haver YouTube e ranking"), e é agora ou nunca |

Experimento de validação (**E7**): mesma partida free-tier, prompt EN vs PT, mesmo seed.
Métricas: tokens de prompt (deve cair ~25%), tokens de raciocínio (aposta: cai também —
menos tradução), validade, agência, e uma leitura qualitativa do raciocínio.

---

## 4. DÚVIDA 3 — fog of war?

**Sim — mas pela razão certa, e o custo NÃO é a razão.** Primeiro os números que matam o
argumento económico (partida paga 01:49, preços do `index.html`):

| | prompt | resposta |
|---|---|---|
| DeepSeek R1 | $0.093 (**16%**) | $0.485 (**84%**) |
| Qwen3-235B | $0.032 (**7%**) | $0.418 (**93%**) |

**84-93% do dinheiro está na RESPOSTA** (raciocínio incluído), não no prompt. Cortar 40% do
prompt pouparia $0.04-0.05 por partida; cortar 30% da resposta (campo `quantidade` + conta
de construção pronta) poupa $0.12-0.15. O fog é a alavanca errada para custo. E note: o
bloco que o fog esconde (NEUTRAS, 34% do prompt no T1) é justamente o que desaparece
sozinho no fim do jogo — no T15 são 0.5%. O fog poupa onde o prompt já é pequeno.

**As razões certas são jogo e benchmark**: informação vira uma habilidade medível (um
degrau 4 natural na escada: *formato → grounding → economia → estratégia → informação*),
o cavaleiro ganha um papel que nenhum ruleset lhe deu (batedor: rápido e barato de arriscar),
e a partida ganha o drama que o mapa aberto mata — os dois reis hoje jogam xadrez com o
tabuleiro todo visível e 22 aldeias de comida entre eles.

**O desenho que respeita a arquitetura** (o modelo é stateless; a memória tem de ser do
motor — mesma família do `histDefesa`/`era X ha N turnos` que já existe):

- **Topologia pública, guarnições privadas.** A REDE DE ESTRADAS continua inteira no prompt
  (mapa é conhecimento de qualquer rei); o que o fog esconde é dono, tropas e defesa de
  quem está longe.
- **Visibilidade**: aldeias suas + vizinhas diretas na rede + onde os seus exércitos estão
  ou passaram neste turno.
- **Memória no motor**: aldeia já vista aparece como
  `[8] visto pela ultima vez no T12: era de A, 2 lanceiros | HOJE: desconhecido`.
  Nunca vista: `[8] nunca explorada`. O modelo não tem de guardar mapa nenhum no `plano`
  (600 chars não guardariam).
- **`minimos`/`para tomar` só para aldeias visíveis** — senão o cálculo vaza a informação.
- **Espectador vê tudo** — a transmissão não muda; o cartão pode até mostrar "o que cada
  rei sabe", que é conteúdo de narração novo.
- **Sem toggle permanente.** Valida-se em free-tier atrás de flag de LOTE e depois **vira o
  jogo** — a lição de 16/08 vale aqui: fog opcional acabaria numa partida gravada com o
  fog errado.

Risco real a medir antes de adotar (**E8**): modelos fracos podem colapsar sem visão total
(atacar o desconhecido às cegas ou paralisar). Free-tier responde isso barato.

---

## 5. DÚVIDA 4 — os modelos entendem o mapa?

O que os logs mostram: **a leitura pontual é boa; o que falta é síntese espacial — e o
prompt não a oferece.** O Nemotron citou o `TOTAL:` textualmente, derivou "wood is
limiting" certo, planeou rotas multi-trecho válidas. Os erros observados nas 4 partidas não
são de leitura, são de estratégia (fixação em alvo: Salamanca 52×; Huesca 4× no mesmo
matchup perdedor) e de formato.

O que o formato atual dificulta:

- **A rede como lista de adjacência** (24 linhas, cada aresta dita duas vezes) obriga o
  modelo a reconstruir a geometria inteira a cada turno para responder "o que está entre
  mim e o inimigo?". Compressão possível sem perda: `[0]: 1,2 | [1]: 0,3,5 | ...` (~1.8k →
  ~0.6k chars) — ou, melhor, curar a informação: com fog, rotular cada aldeia visível com
  a distância à SUA fronteira já responde a pergunta que importa.
- **Nomes só nas aldeias próprias.** Neutras e inimigas são `[13] 1 arqueiros` — anónimas.
  O modelo usa nomes quando os tem (os raciocínios falam "Salamanca", "Huesca"); nome é
  âncora de memória e de narração. Dar nome a tudo custa ~15 chars/linha e ajuda os dois
  lados da câmara.
- **A fase do jogo muda a forma do documento sem aviso** (T1: 34% neutras; T15: 37% suas
  aldeias) — um cabeçalho de uma linha (`fase: expansao | 5 neutras restantes | fronteira
  em [17],[23]`) daria ao modelo o que um humano vê no mapa em meio segundo.

Medição barata de compreensão (**E9**, sem partida nova): reprocessar os raciocínios das
partidas pagas contando afirmações espaciais verificáveis (*"X é adjacente a Y"*, *"a rota
X→Y leva N turnos"*) contra o estado real do replay. O material já está pago; o script é
pequeno; sai uma taxa de alucinação espacial por modelo.

---

## 6. Lista consolidada de incoerências do prompt atual

Por ordem de gravidade. As três primeiras custam uma frase cada.

| # | incoerência | onde | efeito medido/provável |
|---|---|---|---|
| 1 | instrução proíbe reforço; doutrina exige | engine.js:2052 vs 1961→ | Nemotron cancelou reforços planejados (T3, citou a regra 39×); 1 reforço vs 44 do adversário |
| 2 | objetivo dito = capital; vitória real = 75%/2t | engine.js:1989 vs 2496 | Gemini ia ganhar por dominância declarando a capital como objetivo em todos os turnos |
| 3 | exemplo encena divisão de forças (2 meios-envios, 2 alvos) | engine.js:1855-1863 | contradiz a doutrina de concentração do próprio prompt |
| 4 | exemplo fixa `"tipo": "lanceiro"` | engine.js:1867 | suspeito na monocultura (64L do Nemotron); E6a decide |
| 5 | `para tomar AGORA` só enumera soluções mono-tipo | minTexto, engine.js:1602 | empurra ataques monotipo que o counter 1.5 existe para punir |
| 6 | capital é o ÚNICO alvo sem `para tomar` | engine.js:1605 (early-return) | o alvo declarado como objetivo é o único sem número; "exército grande" fica sem escala |
| 7 | simultaneidade das ordens não é dita | LOTE E mudou o motor; prompt não | modelo pode planear como se movesse primeiro |
| 8 | rejeições vão para o topo; a flag H2 (`rejeicaoNoFim`) existe e o browser não a usa | index.html:2970 | o achado "modelos pesam o rabo do prompt" está codificado e desligado |
| 9 | `plano` cortado em 600 chars em silêncio | engine.js:2160 | nota truncada sem o modelo saber; pedir "2-4 linhas" e avisar do corte |
| 10 | idioma misto: prompt PT, raciocínio EN, tipos PT no JSON | — | tradução implícita por turno; §3 resolve |
| 11 | rede de estradas: 1.8k chars, arestas em dobro, zero mudança entre turnos | engine.js:1774 | ~12-17% do prompt repetido 16× por rei |
| 12 | nomes de cidades só nas aldeias próprias | engine.js:1741 vs 1670 | âncora de memória/narração desperdiçada |

E uma **dívida de harness** (não é texto): as três funções do exemplo, a política
tudo-ou-nada do parser e a mensagem *"nenhum bloco {...}"* mentirosa (relatório da partida
13:03, achado 4.3) continuam valendo e entram no mesmo lote.

---

## 7. Custo — as alavancas por ordem de retorno

Base: $1.03/partida de 24 turnos com dois raciocinadores (01:49); 84-93% na resposta.

1. **Campo `quantidade` no construir** — o T14 do Gemini emitiu 36 objetos; o T7 do
   Nemotron morreu em loop de 32k tokens repetindo `{"aldeiaId": 12, "tipo": "lanceiro"}`.
   Corta o modo de falha E os tokens. É mudança de parser (aceitar os dois formatos).
2. **Conta de construção pronta no relatório** (`pode construir AGORA: 2 lanc ou 1 arq...`,
   simétrica ao `para tomar`) — ataca os 74% de tokens de raciocínio do Nemotron, que gasta
   parte deles dividindo madeira por custo à mão, todo turno.
3. **Inglês** — ~20-30% menos tokens de prompt pela tokenização (§3), possível redução
   também no raciocínio.
4. **Compactar a rede de estradas** — ~1.2k chars/turno/rei.
5. **Fog of war** — poupa pouco e no lugar errado; fazer pelo jogo, não pelo custo (§4).
6. **Prompt caching** — o preâmbulo de regras (2.9k chars) é prefixo estável e já está no
   topo (bom para cache de provedor); manter o volátil (turno, placar) fora das primeiras
   linhas quando o P4 for reordenado.

---

## 8. O P4 — princípios e rascunho

Princípios, cada um deduzido de uma mordida real:

1. **Toda regra que o motor executa está no prompt** — inclusive vitória por dominância e
   simultaneidade (incoerências 2 e 7).
2. **Nenhuma frase prescreve jogada** — o fim da `dicaNeutras` estendido ao resto: o prompt
   descreve mecânica e estado; a estratégia é toda do modelo.
3. **Nenhum número de exemplo** — esquema declarado; os três tipos sempre enumerados juntos.
4. **A memória é do motor** — `plano` que volta, `era X ha N turnos`, e (com fog) o
   "visto pela última vez".
5. **Uma língua** — inglês, com `depoimento` no idioma da audiência por config.
6. **O que o texto proíbe e o que o motor recusa são a MESMA lista** — a instrução de
   processo só pode conter restrições que `diagnosticarOrdem` de facto aplica.

O rascunho completo, em inglês, com cada bloco anotado (texto-apenas vs exige-motor), está
em **`PROMPT_P4_DRAFT.md`**. Não é para colar no engine — é o gabarito para discutirmos
antes de qualquer código, no método do projeto: conceito antes de código.

---

## 9. Ordem de execução proposta (tudo free-tier até o crédito voltar)

| passo | o quê | custo | por quê primeiro |
|---|---|---|---|
| F1 | 3 frases: reforço permitido (inc. 1), vitória real (inc. 2), simultaneidade (inc. 7) | texto | corrige mentiras; pré-requisito de qualquer medição de "escolha livre" |
| F2 | E6a (tipo do exemplo sorteado) | texto | pode reinterpretar 4 partidas já pagas |
| F3 | E9 (alucinação espacial nos raciocínios pagos) | script | usa material já pago, zero API |
| F4 | E6b (esquema declarado) + E6c (controlo com modelo pequeno) | texto | decide o destino do exemplo |
| F5 | E7 (inglês vs português, mesmo seed) | texto | maior corte de custo barato |
| F6 | `quantidade` + parse independente + mensagem de erro honesta | parser | maior corte de custo real; mata o loop de 32k |
| F7 | E8 (fog of war em LOTE, depois vira o jogo) | motor | o maior em valor e em risco — por último, sobre um prompt já saneado |

A regra de sempre: uma flag por mudança, byte-idêntico com tudo desligado, suíte verde, e o
`analisar-log.js` + `reconstruir-prompts.js` como gabarito de cada braço.
