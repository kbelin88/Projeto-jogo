# Pauta de publicações — LinkedIn

Onze posts tirados dos dados de 17–20/08. Ordenados por **força do gancho**, não por ordem de publicação
(a sequência sugerida está no fim). Cada um traz: o gancho literal, o dado que sustenta, o que mostrar, e
a ressalva que **precisa** aparecer no post — o valor do projeto está em não vender leitura que os dados
não sustentam.

Convenção: 🟢 = dado forte, publicável como está · 🟡 = dado interessante mas com ressalva obrigatória ·
🔴 = só publicar depois de mais medição.

---

## 1. 🟢 "Dá para um modelo falhar sem um único erro"

**Gancho:** *"Um modelo passou 43 minutos pensando num turno de um jogo de estratégia. Gastou os 32.000
tokens de resposta inteiros no raciocínio. Devolveu uma lista vazia. E o log não registrou um único erro."*

**Dado:** três modelos distintos (`laguna-xs-2.1`, `gemma-4-26b-a4b-it`, `laguna-s-2.1`) com a mesma
assinatura: `finish: error`, `construir: []`, raciocínio = teto de saída, zero erro de HTTP. Um deles
levou 20 min, outro 43 min num único turno.

**Desenvolvimento:** o ponto não é "modelo ruim". É que **o contador que a maioria das pessoas usa está
errado**. Se você mede requisições bem-sucedidas, esse modelo tem 100% de saúde. O contador certo é
*turno válido* — a unidade de trabalho que você realmente pediu. Vale para qualquer agente em produção:
a taxa de sucesso do HTTP não é a taxa de sucesso da tarefa.

**Mostrar:** o bloco do log com `finish: error`, `raciocinio 32000 / resposta 32000`, `construir: []`.

**Ressalva:** são modelos `:free`, o teto de saída é baixo, e o comportamento pode ser do provedor.

---

## 2. 🟢 "O modelo acerta a tática quando ela é fácil e erra quando ela importa"

**Gancho:** *"Medi a mesma decisão tática em 16 lados de partida. Contra um alvo previsível, os modelos
acertam 59% das vezes. Contra um adversário que reage, 34%. A mesma decisão."*

**Dado:** taxa de counter correto (o triângulo pedra-papel-tesoura do jogo) separada por tipo de alvo,
calculada do estado do motor: 0,588 contra aldeia neutra, 0,336 contra o exército inimigo. **14 dos 16
lados pioram** quando o alvo é outro modelo. Teste de sinal p = 0,002.

**Desenvolvimento:** a diferença é mecânica e é o post inteiro. A aldeia neutra tem guarnição de um tipo
só, e a informação está na tela: acertar é **leitura de tabela**. O exército inimigo é misto e muda todo
turno: acertar exige **prever o estado futuro do adversário**. Duas competências completamente diferentes
que qualquer benchmark somaria numa métrica só — e a métrica somada teria dito que os modelos vão bem.

**Mostrar:** tabela de duas colunas, 16 linhas, com as setas para baixo.

**Ressalva:** 16 lados, 9 modelos, só modelos gratuitos. Duas exceções na amostra, e as duas são
interessantes (o lado que ignorava o triângulo quando era barato passou a acertá-lo quando passou a doer).

---

## 3. 🟢 "Publiquei um achado em segunda-feira e os dados de quarta o derrubaram"

**Gancho:** *"Semana passada eu tinha uma regra que acertava 5 de 5. Rodei mais 8 partidas. Virou 10 de 13,
e quando testei se ela prevê o futuro em vez de explicar o passado, caiu para 5 de 8."*

**Dado:** "quem constrói menos lanceiro ganha" (correlação +0,80 com 10 lados) → +0,26 com 26 lados.
A versão que sobrou (ataque total construído) acerta 11 de 13 no jogo inteiro, **mas só 5 de 8 quando a
soma é cortada no turno 10**, antes de a economia virar bola de neve.

**Desenvolvimento:** é o post mais honesto e provavelmente o mais valioso. A métrica estava medindo
*consequência* de estar ganhando, não causa. O teste que revela isso — cortar a janela antes do efeito
suspeito — custa uma tarde e devia ser reflexo em qualquer análise de agente.

**Mostrar:** dois gráficos lado a lado: correlação com N=10 e com N=26.

**Ressalva:** nenhuma — a ressalva **é** o post.

---

## 4. 🟢 "Uma sonda de um turno não prevê nada"

**Gancho:** *"O modelo respondeu em 5 segundos no teste. Em partida, a mediana foi 181 segundos, e ele
começou a repetir a mesma frase até estourar o limite."*

**Dado:** `laguna-s-2.1`: 5 s na sonda → 181 s em jogo, degeneração por repetição.
`nemotron-nano-12b-v2-vl`: 5,6 s na sonda → 19 de 30 turnos entregues.
`gemma-4-26b-a4b-it`: passou a sonda num dia → 43 min no turno 1 do dia seguinte.

**Desenvolvimento:** o smoke test de uma chamada mede **disponibilidade**, não latência nem estabilidade.
É uma licença para entrar em campo, não uma nota. Depois disso a spec da bateria passou a usar sonda de
3 turnos com teto de latência — e a sonda de 3 turnos derrubou dois modelos que a de 1 turno tinha aprovado.

**Mostrar:** tabela sonda × partida, três linhas, com a discrepância em destaque.

---

## 5. 🟡 "O mesmo modelo, dois dias depois, virou outro modelo"

**Gancho:** *"Uso um modelo como régua do meu benchmark: 15 partidas, comportamento estável. Terça-feira ele
respondia em 3 minutos. Quinta, em 6 — e devolveu metade dos turnos em branco. Mesmo slug, mesmo prompt,
mesmo motor determinístico."*

**Dado:** `nemotron-3.5-lightning`, medianas de 128–196 s em 17–18/08 e de 136–356 s em 19/08, com 14 a 17
turnos de `construir: []` por partida e derrota nos quatro confrontos do dia.

**Desenvolvimento:** o mais desconfortável dos achados. Se a régua se move, **nenhum número de dias
diferentes é comparável**. A correção é barata e devia ser padrão: rodar um lado determinístico (no meu
caso um bot burro, custo zero) em toda bateria, só para calibrar o dia.

**Mostrar:** as medianas por dia, mesmo modelo.

**Ressalva:** é um modelo `:free`, num pool compartilhado. Não afirme que "modelo X piorou" — afirme que
o que você mede inclui o provedor.

---

## 6. 🟢 "O custo do meu benchmark não é dinheiro, é relógio"

**Gancho:** *"13 partidas de LLM contra LLM. Custo em dólar: zero. Custo em relógio: 42 horas."*

**Dado:** mediana por turno de 7 s a 1200 s entre os modelos medidos — duas ordens de grandeza. Partidas de
30 turnos levaram de 61 min a 4h14. Uma bateria de 4 partidas consumiu 11h40.

**Desenvolvimento:** quando o token é grátis, a variável de projeto vira o tempo de parede, e ela muda o
desenho do experimento: regra de aborto por projeção de tempo, checkpoint de relógio no turno 5, ordem das
partidas por latência esperada. Ninguém escreve isso nos posts sobre "avaliação de agentes".

**Mostrar:** barra horizontal com a mediana por modelo, escala log.

---

## 7. 🟢 "O medo era que a névoa de guerra travasse o jogo. Aconteceu o contrário"

**Gancho:** *"Escondi o mapa dos dois modelos e apostei que eles nunca se encontrariam. Errei: o primeiro
confronto direto passou a acontecer no turno 7."*

**Dado:** antes do fog, o primeiro duelo rei-contra-rei **nunca acontecia** em 25 turnos. Com fog, acontece
entre T7 e T14 em todas as partidas em que os dois lados jogaram — de 11 a 43 confrontos por partida.

**Desenvolvimento:** o desenho é o motivo. A névoa esconde *o que há* na aldeia, nunca *onde ela fica* —
a topologia é pública. Então os modelos continuam marchando um para o outro na mesma velocidade, e cada
conquista abre a vizinhança. Detalhe fino: **os espelhos (mesmo modelo dos dois lados) demoram mais a
duelar**, porque jogam a mesma abertura e se expandem simetricamente.

**Mostrar:** o replay do site, com o momento em que as frentes se tocam.

---

## 8. 🟡 "Dois modelos, o mesmo prompt, a mesma seed, o mesmo motor. Um ganhou 18 a 4"

**Gancho:** *"Coloquei o mesmo modelo para jogar contra si mesmo, três vezes, com três mapas iniciais.
Resultados: 18 × 4, 16 × 8 e 11 × 10."*

**Dado:** os três espelhos de `lightning`. Motor determinístico, mesmo prompt, única fonte de variação = a
decisão do modelo.

**Desenvolvimento:** é a medida direta da variância que qualquer benchmark de agente carrega e quase nenhum
reporta. **Nenhuma afirmação comparativa devia sair de uma partida** — e mesmo com três, o intervalo é
largo demais para ranquear dois modelos próximos.

**Mostrar:** as três curvas de aldeias por turno, sobrepostas.

**Ressalva:** três repetições ainda é pouco. Diga isso.

---

## 9. 🟡 "A partida mais disputada que já rodei acabou por causa de uma cota"

**Gancho:** *"Turno 23. Onze aldeias contra treze. Uma cidade trocou de dono duas vezes no mesmo turno.
E aí a API devolveu 429: cota diária esgotada."*

**Dado:** Ultra 550B × Gemini 2.5 Flash, 20/08. 41 confrontos diretos, placar oscilando em torno do empate
desde o turno 9, Burgos conquistada por B, retomada por A e atacada de novo por B no mesmo turno.
Interrompida por `generate_content_free_tier_requests, limit: 20`.

**Desenvolvimento:** dois recados. O primeiro é o do jogo — foi a primeira vez que a partida ficou boa de
assistir. O segundo é o de infraestrutura: **um experimento longo tem de ser desenhado assumindo que a cota
acaba no meio**, com checkpoint por turno e replay gravado, senão você perde 23 turnos de dado.

**Mostrar:** o replay + o bloco do 429.

**Ressalva:** essa partida **não entra no ranking** — o mapa correu um turno sem as ordens de um dos reis.
Deixe isso explícito; é o que separa registro de propaganda.

---

## 10. 🟡 "Meu próprio log estava mentindo há três dias"

**Gancho:** *"Todo log da minha bateria dizia que as partidas tinham corrido com uma regra. Elas correram
com outra. O cabeçalho era texto fixo, escrito à mão meses atrás."*

**Dado:** `runners/rei_vs_rei.js` escreve a linha de condições com string literal; o cliente do browser lê
da configuração viva. Todas as partidas headless de 17–19/08 carregam um cabeçalho falso. Os dados estão
certos (o replay grava o estado real), a narração não.

**Desenvolvimento:** o princípio que vale levar: **o log tem de descrever o que correu, não a intenção de
quem escreveu o log**. Se existe um caminho em que a descrição e a execução podem divergir, elas vão
divergir. Já tinha acontecido uma vez no projeto, por outro cliente.

**Ressalva:** é um post de humildade técnica. Funciona bem no LinkedIn justamente por isso, mas só se o
conserto vier junto.

---

## 11. 🔴 "Ranking de LLMs jogando estratégia"

**Gancho:** o óbvio — a tabela.

**Por que 🔴:** o ranking existe e está no site, mas **os números de dias diferentes não são comparáveis**
(post 5), a maioria dos modelos tem 1 lado jogado, e o vencedor de hoje pode ser artefato do provedor.
Publicar a tabela como "ranking" agora compraria alcance e gastaria credibilidade. **Publique o site**,
mas o post que aponta para ele deve ser o de método (2, 3 ou 7), com a tabela como material de apoio.

Volte a este post quando houver: ≥3 partidas por modelo, régua determinística no mesmo dia, e ao menos
um modelo pago no plantel.

---

## Sequência sugerida (4 semanas, 2 posts por semana)

| semana | post | por quê nessa ordem |
|---|---|---|
| 1 | **7** (névoa) → **2** (counter fácil × difícil) | abre com o jogo (visual, fácil de entender) e emenda no primeiro achado forte |
| 2 | **1** (falhar sem erro) → **6** (custo é relógio) | os dois posts de engenharia, o público de AI eng. compartilha |
| 3 | **3** (o achado que caiu) → **4** (sonda não prevê) | dobradinha de método; o post 3 é o mais forte da lista para autoridade |
| 4 | **9** (a partida disputada) → **5** ou **10** | fecha com narrativa + o site no ar |

**Formato:** cada post carrega **um** número e **uma** imagem. Os replays do site são o melhor ativo visual
que o projeto tem — um GIF de 10 s do mapa mudando de cor vale mais que qualquer gráfico.

**Link:** todo post deve terminar apontando para a página da Arena, não para o repositório. O repositório
é para quem já se convenceu.
