# Análise da partida 17/08 13:03 — Gemini (A) × Nemotron-3-Super-120B (B)

Primeira partida corrida sob o **ruleset novo de verdade**. Fonte: `partida_gemini_vs_...
_202608171303.txt` + `replay_202608171303.json`, lidos com `ferramentas/analisar-log.js`.
Todos os números abaixo saem do replay (estado do motor) ou do RESUMO do `.txt`.

---

## 0. Estatuto do dado (ler antes de citar qualquer número)

| | |
|---|---|
| turnos | 16 (limite era ∞, empate por estagnação em 30t) |
| fim | **INTERROMPIDA** — HTTP 502 da Nvidia no turno 16 do Rei B |
| custo | $0.0000 (free tier) |
| placar ao morrer | A **19** aldeias / B **5** / neutras 0 |

O próprio log já avisa: **não é dado de benchmark**. Um turno do Rei B (T4) e outro (T16)
correram sem ordens por falha de infra, e o mapa andou sem elas. Serve para o que o
handoff pedia — *validar o ruleset* — e não para ranquear os dois modelos.

**Mas o ruleset vivo confere.** Conferido no replay, não no cabeçalho:

- produção observada em aldeias sem construção: **(30 madeira, 20 ferro)** em 11 de 11
  observações. É o ruleset novo — o erro de 16/08 não se repetiu.
- marchas de 5 trechos concluídas em 3 turnos → `escalaMarcha` 0.2 aplicada.

---

## 1. As quatro perguntas do handoff — respondidas

### 1.1 "O duelo rei-contra-rei chega por volta do turno 10?" → **Chegou no turno 8.**

| | 17/08 01:49 (ruleset antigo) | 17/08 13:03 (ruleset novo) |
|---|---|---|
| turnos corridos | 25 | 16 |
| 1º combate A×B | **nunca** | **T8** |
| combates A×B | **0** | **10** |
| interceptações na estrada | 0 | **4** (T9, T10, T12, T16) |
| aldeias tomadas ao inimigo | 0 | A 5 / B 2 |

Três partidas seguidas de 20-25 turnos sem um único tiro trocado, e agora dez combates
rei-contra-rei em dezesseis turnos. **A remoção da `dicaNeutras` é a alavanca mais
provável** (o Rei já não é mandado gastar 27 turnos em neutras), com a escala 0.2 a ajudar.
Uma partida não separa as duas causas — mas o resultado que se queria, apareceu.

Bônus: a **interceptação na estrada (LOTE E, A3) disparou 4 vezes em partida real**, com
combate em campo aberto e sem bônus de defesa. A feature saiu do teste e entrou no jogo.

### 1.2 "As neutras esgotam-se?" → **Sim, no turno 15.**

Neutras por turno: 22 → 19 → 15 → 12 → 10 → 9 → 9 → 8 → 6 → 5 → 5 → 4 → 1 → 1 → **0** (T15).

A simulação prometia ~T13. Deu T13 com uma sobrando e T15 no zero. Contra as **7 neutras
que ainda existiam no turno 25** da partida anterior.

### 1.3 "Alguém compra cavaleiro?" → **Sim. 95 cavaleiros construídos.**

| construções (L/A/C) | Rei A | Rei B |
|---|---|---|
| **17/08 13:03 (novo)** | 20 / 103 / **74** | 64 / 9 / **21** |
| 17/08 01:49 (antigo) | 4 / 74 / **0** | 76 / 5 / **0** |
| 16/08 16:20 (antigo) | 6 / 14 / **0** | 0 / 15 / **0** |
| 15/08 21:09 (antigo) | 4 / 70 / **0** | 10 / 59 / **0** |

**Zero cavaleiros em 4 partidas sob o ruleset antigo; 95 na primeira partida com
def 2 / 1 turno e ferro 20.** A thread do cavaleiro fecha. O Rei A terminou com uma
composição genuinamente mista (21L / 70A / 45C em campo) — a primeira da história do
projeto.

E o cavaleiro **decidiu combates**: a única conquista do Rei B contra o Rei A por counter
foi `T9 B→[23] Madrid: cav vs arq, vant +1, Fatk 4 × Fdef 2`. Quatro cavaleiros tomaram uma
aldeia defendida.

### 1.4 "É do prompt ou daqueles dois modelos, o entesouramento?" → **É do prompt, mas atenuou.**

| envios de 1 tropa | |
|---|---|
| DeepSeek R1, 17/08 01:49 | 62 / 90 = **69%** |
| Gemini A, 13:03 | 40 / 99 = **40%** |
| Nemotron B, 13:03 | 9 / 18 = **50%** |

Pela métrica A3 (só ataques, classificados pelo estado do motor): **A 0.20**, B 0.53 —
contra 0.24 / 0.40 na partida anterior. E a razão reforço-vs-ataque virou ao contrário:
DeepSeek fazia **69 reforços contra 21 ataques**; o Gemini fez **44 reforços contra 55
ataques**. O gotejamento de uma tropa continua a existir em dois modelos diferentes de dois
fornecedores diferentes — logo **não é um vício daqueles dois**, é comportamento induzido
pelo formato. Mas deixou de ser o modo dominante.

---

## 2. A partida morreu a UM TURNO da primeira vitória por dominância

O limiar é `ceil(24 × 0.75)` = **18 aldeias por 2 turnos consecutivos**. O contador vive no
`tick`, que lê o estado do fim do turno anterior:

```
tick T15: A tinha 17 aldeias -> contador A = 0
tick T16: A tinha 19 aldeias -> contador A = 1
tick T17: A tinha 19 aldeias -> contador A = 2  <== VITÓRIA DE A
```

O 502 da Nvidia entrou no T16. **A regra de vitória funciona e estava a um turno de
disparar pela primeira vez.** O log diz "INTERROMPIDA" e está correto — mas vale registrar
que o desenho de 75%/2t produziu um vencedor em 17 turnos, exatamente o que se queria.

---

## 3. Assimetria de agência: 6.19 × 1.29 envios/turno

O RESUMO parece dizer que o Gemini jogou cinco vezes mais. Decompondo os 16 turnos do
Rei B, a história é outra:

| causa | turnos | envios perdidos |
|---|---|---|
| T4 — `ERRO API: Upstream error from Nvidia` | 1 | ordem inteira |
| T7 — **truncamento**: 32000 tokens, `finish=length` | 1 | ordem inteira |
| T10 — **JSON malformado** (um `}` a menos) | 1 | ordem inteira |
| T16 — HTTP 502 | 1 | ordem inteira |
| T15 — `"envios": []` **por decisão** | 1 | nenhum (escolha) |
| turnos com ordem executada | 11 | 18 envios |

**5 dos 16 turnos do Rei B (31%) não moveram uma tropa, e 4 deles por causa não-estratégica.**
Nos 11 turnos em que jogou, fez 1.64 envios/turno — ainda pouco, mas isso é outra coisa: é
escolha. O raciocínio do T15 diz literalmente *"a força em marcha de Girona avança para tomar
[18] **sem dividir nossas tropas**"*. O Rei B está a seguir a doutrina de concentração que o
próprio prompt ensina. O Rei A ignora essa doutrina, esparrama 99 envios e ganha o mapa.

Ou seja: **o prompt recomenda concentrar, e quem obedeceu perdeu a corrida por território.**
Não é bug do modelo — é uma tensão real no jogo que o prompt não expõe (concentrar é certo
*contra defesa*, errado *contra o relógio das neutras*).

Custo em tempo, para a fase de transmissão: A mediana 30s/turno (total 530s); B mediana
138s/turno, máximo **435s** (total 2178s). A partida de 16 turnos levou ~45 min de relógio.

---

## 4. Cinco achados sobre o PROMPT (é aqui que o estudo começa)

Evidência tirada desta partida, com o prompt real reconstruído do `engine.js`
(`montarPrompt` + `relatorioTexto`, 120 linhas / ~10.8k chars no turno 1).

### 4.1 O prompt diz que o objetivo é a capital. O motor termina a partida por 75%.

O topo do prompt: *"Seu objetivo e conquistar a CAPITAL inimiga."* Nenhuma linha do prompt
menciona os 75% / 2 turnos. **Zero ocorrências** de "75", "dominância" ou "maioria das
aldeias" no prompt gerado.

E o Rei vencedor acreditou nisso, em todos os turnos:

> T6: *"My overall goal is still the enemy's capital at [12]"*
> T10: *"the ultimate objective, as always, is to bring that enemy capital [12] to its knees"*
> T14: *"My primary objective remains the enemy CAPITAL [12]"*

O Gemini ia ganhar por dominância **sem saber que essa condição existia**. Isto é a mesma
família de bug que o projeto já escreveu na parede — *"o número que o decisor LÊ tem de ser
o que o motor EXECUTA"* — aplicada à **condição de vitória**, não a um número de marcha.
É o achado mais importante desta partida e custa uma linha para corrigir.

### 4.2 `construir` é um objeto por unidade. Isso custou um turno inteiro.

O molde pede `{"aldeiaId": 12, "tipo": "lanceiro"}` — sem campo `quantidade`. Para construir
40 lanceiros, o modelo tem de emitir 40 objetos idênticos. No T7 o Nemotron entrou em loop
de repetição, bateu nos 32000 tokens, `finish_reason=length`, turno perdido:

```json
{"construir": [ {"aldeiaId": 12, "tipo": "lanceiro"},   ← repetido 44+ vezes
                {"aldeiaId": 12, "tipo": "lanceiro"}, ...
```

O formato **convida** ao token blowup, e o custo é real: o T14 do Rei A gastou 36
construções no JSON. Um campo `quantidade` mata a classe inteira de falha e reduz tokens de
resposta (= custo por turno, quando voltar o crédito).

### 4.3 Um `}` a menos apagou o melhor turno do Rei B.

T10, resposta reconstruída e re-parseada com o `parsearOrdem` real:

```json
"envios": [
    { "origemId": 12, "destinoId": 23,
      "tropas": { "lanceiro": 7, "arqueiro": 2, "cavaleiro": 4 }
  ]                                    ← faltou fechar o objeto do envio
  ],
```

`parsearOrdem` → `{ok: false, erro: "nenhum bloco {...} na resposta"}`. Resultado: perdeu-se
o envio **e também os 2 `construir` que estavam perfeitamente válidos antes do erro**. Era o
maior ataque concentrado do Rei B na partida (13 tropas em Madrid), fruto de 11682 tokens de
raciocínio.

Duas coisas separadas aqui:

1. **Política de parse tudo-ou-nada.** `construir` e `envios` são listas independentes; um
   erro numa não devia matar a outra.
2. **A mensagem de erro mente.** Diz *"nenhum bloco {...} na resposta"* quando há um bloco —
   está desbalanceado. `extrairBlocoJSON` devolve `null` e a causa real (chave não fechada)
   nunca aparece no log. Invariante do projeto: o log tem de descrever o que aconteceu.

### 4.4 O relatório pré-calcula a conta do ATAQUE e não pré-calcula a conta da CONSTRUÇÃO.

Cada alvo vem com `| para tomar AGORA: 8 lanc ou 3 arq ou 1 cav`. Cada aldeia própria vem
com `madeira 0 (+30/turno) | ferro 0 (+20/turno)` — **e o modelo tem de fazer a divisão
sozinho, todo turno.** É exatamente o que o Nemotron faz, em inglês, a cada chamada:

> *"Costs: lanceiro 15 wood, 0 iron; arqueiro 20 wood, 10 iron; cavaleiro 30 wood, 30 iron.
> We have wood: Barcelona 55, Tarragona 55... So wood is limiting. We can build lanceiros
> cheap (15 wood). So we should focus on lanceiros."*

**74% dos tokens de saída do Rei B foram raciocínio** (107.648 de 146.403), boa parte dele
a re-derivar aritmética que o relatório poderia entregar pronta — do mesmo jeito que já
entrega o `para tomar AGORA`. E note onde essa derivação o levou: **madeira é o gargalo → o
lanceiro é o mais barato → 64 lanceiros**. Monocultura por otimização local correta.

### 4.5 A divergência de composição não veio da informação — veio do prompt não pedir a conta.

Os dois Reis leram o mesmo prompt. O Nemotron fez a conta de **custo** e foi ao mais barato.
O Gemini não fez conta nenhuma — *"My production strategy is straightforward: prioritize the
creation of arqueiros and cavaleiros"* (T14) — e por prior escolheu as tropas de ataque 2 e
4. Nenhum dos dois relacionou a construção com o **counter 1.5** contra a composição real do
inimigo, apesar de o triângulo estar explicado no topo do prompt e a composição inimiga estar
listada na seção INIMIGO.

O counter 1.5 pune monocultura *no combate*, mas ninguém está a otimizar a construção contra
ele. Se o objetivo é medir estratégia (degrau 3), isto é bom: discrimina. Se o objetivo é ver
exércitos mistos, o prompt precisa de aproximar as duas informações.

---

## 5. Experimentos propostos (ordenados por custo/benefício)

Todos rodáveis em free-tier, `temp=0`, seed 1, com o `analisar-log.js` como gabarito.

| # | mudança | hipótese medível | custo |
|---|---|---|---|
| **E1** | dizer a condição de vitória real no prompt (75% / 2 turnos, e quantas aldeias faltam) | o Rei deixa de marchar para a capital de nariz; conquistas/turno sobe; partidas terminam por dominância em vez de morrer no limite | 1 linha |
| **E2** | `quantidade` em `construir` | truncamentos 1 → 0; tokens de resposta caem; nenhuma perda de agência | pequena, mexe no `parsearOrdem` |
| **E3** | parse independente de `construir` e `envios` + mensagem de erro honesta ("bloco JSON desbalanceado: falta fechar N chaves") | turnos perdidos por formato caem; o log passa a dizer a causa real | pequena |
| **E4** | linha `pode construir AGORA: N lanc ou N arq ou N cav` em cada aldeia própria | tokens de raciocínio caem (o modelo para de dividir à mão); rejeições por "recurso insuficiente" → 0 | média, é simétrica ao `para tomar AGORA` que já existe |
| **E5** | na seção INIMIGO, mostrar `tipo dominante: arqueiro → seu counter: cavaleiro` | monocultura cai; taxa de counter sobe acima de 0.4-0.6 | média |
| **E6** | trocar o `tipo` do exemplo âncora (`lanceiro` → sorteado) | se a composição construída seguir o exemplo, a monocultura é **artefacto do molde**, não estratégia — teste barato e de alto valor diagnóstico | trivial |

**E1 e E6 primeiro**: são as duas mais baratas e as duas que podem invalidar conclusões já
tiradas. E6 em particular: o exemplo do prompt sempre mostra `"tipo": "lanceiro"`, e o Rei B
construiu 64 lanceiros. Pode ser coincidência de otimização de custo — ou pode ser cópia do
molde, e nesse caso quatro partidas de "monocultura de lanceiro" mudam de significado.

---

## 6. Dívidas de instrumentação notadas de passagem

- **Gemini não reporta `finish_reason` nem tokens de raciocínio**: o log mostra
  `finish/nativo A: ?:16 / ?:16` e `raciocinio 0` em todos os turnos, embora o texto de
  raciocínio esteja capturado (16/16). Comparar "% de tokens em raciocínio" entre backends
  é impossível hoje.
- **Custo $0.0000** com modelos free: a coluna de custo do RESUMO e do rodapé fica morta na
  validação em free-tier. Esperado, mas não confundir com "partida barata".
- **Tempo de parede**: 45 min para 16 turnos, com um turno de 7 min. Relevante para a fase
  de transmissão/YouTube.

---

## 7. Como reconferir (não acreditar, conferir)

```bash
node ferramentas/analisar-log.js partida_gemini_vs_...202608171303.txt replay_202608171303.json
```

- produção 30/20 e escala 0.2: ler `recursos` de duas frames consecutivas numa aldeia sem
  `construindo`, e `turnosTotal` dos `movimentos` com `caminho` de 5 trechos.
- vitória por dominância: contar `dono==='A'` por frame; limiar `ceil(24*0.75)=18`; o
  contador do `tick` lê o fim do turno anterior.
- T10 do Rei B: extrair a `resposta crua`, desescapar, e passar em `Engine.parsearOrdem` —
  devolve `ok:false`.
