# Notas da sessão — 2026-06-22 (handoff p/ próxima sessão)

Sessão muito positiva. O foco foi **observar a decisão estratégica de um LLM jogando o Rei**,
e isso destravou — primeira partida do Gemini rodada de ponta a ponta e avaliada.

## O que foi FEITO hoje (commitado nesta sessão)
1. **Guarnição inicial dos reis** — knob novo na CONFIG `rei.tropas_iniciais` (10/10/10 = força 550,
   ~faixa das neutras), aplicado aos 2 reis em `gerarTeatro` (`engine.js`). Sem isso o rei começava
   com 0 tropas e só acumulava (produção lenta demais p/ atacar cedo). Testes `test_peca1` e
   `test_v1_peca1` ajustados (invariante "rei sem tropas" → "rei com a guarnição da CONFIG").
2. **Modo Gemini no mapa** (`index.html`) — checkbox "Rei B = Gemini" + campo de turnos. Com ele
   ligado, o Play roda a partida do Gemini AO VIVO no mapa (B = Gemini, A = burro). Cliente Gemini
   no browser (mesma lógica do `rei.js`: pacing 13s + backoff 429/503, SEM retry de conteúdo; chave
   via prompt() em localStorage, nunca hardcode). Captura por turno → baixa um `.txt` automático.
   **Isso contorna o teto de cota DIÁRIA do Node** (fetch a partir do file:// no browser).
3. **Eval da partida** salvo em `eval_gemini_seed1_14turnos.txt` (raw + análise).

## EVAL 4 — conclusão principal (Gemini-2.5-flash, seed 1, 14 turnos)
Resultado: **empate** (limite de turnos, A 2 × B 2, 16/18 neutras intactas).

- **Mecânico = SÓLIDO** (era o objetivo da troca p/ Gemini): JSON 14/14 válido, ancoragem 100%
  (0 ids inexistentes), sumiu o resíduo "tropa que não tem" do qwen.
- **Gap agora é ESTRATÉGICO**, não mais grounding:
  - economia mal planejada = modo de falha dominante (~10/14 turnos pedindo build que não pode pagar);
  - fragmenta força em gotas (1/1/1, 2/2/2) pequenas demais p/ neutra forte;
  - abertura ALL-IN: mandou os 550 na capital inimiga distante, esvaziou a própria casa → trocou bases.
- **Triângulo continua NÃO-MENSURÁVEL**: 0 envios miraram neutra tipada (só brigou por bases).

## INSIGHT-CHAVE de design (raiz do all-in)
O que torna o all-in racional é a regra **"NÚMERO decide o vencedor; triângulo só modula baixas"**.
No eval o triângulo NUNCA mudou um vencedor, só o `m`. Logo: **massa ganha sempre → counter e
posicionamento são irrelevantes**. Duas alavancas p/ corrigir:
  (a) **limite de tropa por aldeia** (limita concentração de massa, força distribuição) — ideia do Lucas;
  (b) fazer **o triângulo afetar o RESULTADO**, não só as baixas.

## Custo / tokens (medido)
- Input ~650 tok/turno (relatório inteiro vai todo turno; estável). Output visível ~57 tok/turno.
- Preço Gemini 2.5-flash: in $0,30/1M, out (inclui tokens de pensamento) $2,50/1M.
- **Partida de 14 turnos custou ~US$ 0,005 a 0,04** (½ a ~4 centavos), conforme quanto o modelo "pensou".
- O `usageMetadata` da API (promptTokenCount/candidatesTokenCount/**thoughtsTokenCount**) daria o custo
  EXATO — o cliente do browser hoje descarta isso. (Não feito ainda — candidato a melhoria.)
- **Conclusão: dinheiro não é o gargalo; o teto de 20 requests/dia do free tier é.**

## ONDE PARAMOS / PRÓXIMOS PASSOS (decisão em aberto)
O Lucas vai voltar à mesa de planejamento. Backlog ordenado por dependência (proposto, não decidido):

- **0. (FEITO nesta sessão)** fechar o marco atual com commit.
- **1. Harness local** — voltar aos modelos locais (grátis, sem cota). Parametrizar o `clienteOllama`
  p/ rodar **qwen2.5:3b** E **llama3.2:3b** pelo runner. Modelos locais instalados: qwen2.5:3b,
  llama3.2:3b, phi3, llama3 (8b), nomic-embed (embedding, não serve de jogador).
- **2. Mecânicas** — limite de tropa por aldeia + rebalanço. (sub-decisões de design a levantar:
  teto conta trânsito? sobra na conquista é perdida? produção para no teto? número do teto?)
- **3. Evals formais** — cravar métricas/saída quando a mecânica estabilizar.
- **5. Eficiência de tokens** — enxugar o relatório + context caching ($0,03/1M no bloco fixo).
  Anda junto da 2/3. Importa p/ modelos pagos e p/ caber nos locais pequenos.
- **4. Meta-progressão (registro entre partidas, "jogador evolui")** — sistema maior e mais aberto;
  depende do loop de 1 partida estável. Por ÚLTIMO. Design próprio (o que persiste? stats? recursos?
  desbloqueios?). O Lucas vai colocar valores em alguns modelos p/ testes de partidas reais.

Ordem recomendada: **1 → 2 → 3 → (5 junto) → 4**. A primeira peça da próxima sessão deve ser a **1**.

## Regras do projeto (manter)
- **Uma peça por vez.** Não refatorar além do necessário.
- **Sem retry de conteúdo ruim** (Rei passa o turno + loga). Backoff só p/ 429/503 (transporte) — já OK.
- A chave (`GEMINI_API_KEY`) nunca é hardcoded; mora no `.env` (gitignored). Se ela vazou da máquina
  do Lucas em algum momento, vale gerar uma nova.
- Mostrar o diff antes de commitar; só commitar quando o Lucas pedir.
