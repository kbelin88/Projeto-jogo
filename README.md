# Arena dos Reis (Projeto-jogo)


![testes](https://github.com/kbelin88/Projeto-jogo/actions/workflows/testes.yml/badge.svg)


Um jogo de estratégia medieval no navegador que funciona como **benchmark de LLMs**: modelos de linguagem jogam como reis — comandam aldeias, tropas e recursos — e o motor mede *como* eles jogam. Construído do zero (motor próprio em JavaScript, sem engine de jogo), com Claude como interlocutor de estudo.

A pergunta que o projeto responde: **o que um modelo pequeno realmente entende de um ambiente com regras — e onde exatamente ele quebra?**

## Por que um jogo como benchmark

Benchmarks de texto medem resposta certa/errada. Um jogo por turnos mede outra coisa: decisão sob regras, uso de feedback, consistência ao longo do tempo. O motor é determinístico (seed), valida toda ordem contra o estado real, e rejeita as ilegais com explicação — o que transforma cada partida num experimento controlado sobre o comportamento do modelo.

## As métricas (originais do projeto)

- **Validade** — % de respostas em JSON parseável. Descoberta que motivou o resto: validade não discrimina nada (llama3 8B: 100% de validade, zero jogo).
- **Agência** — envios de tropa *aceitos* por turno. Mede se o rei está de fato jogando, não só respondendo bonito.
- **Reincidência** — perseveração *semântica*: a mesma ação rejeitada voltando em turnos seguidos, mesmo com texto diferente. Definição operacional de "o modelo leu o feedback?".
- **seqMax/repetidos** — perseveração byte a byte (dimensão independente da reincidência; ler sempre o par).
- **Normalizações** — jogadas salvas pelo parser tolerante (plural/caixa/acento), com registro explícito no log. Erro real fica cru.

## Principais achados (protocolo: seed fixa, 1 variável por vez, 3 rodadas por condição, previsão registrada antes)

1. **Posição do feedback > temperatura (H2 vs H1).** Mover o bloco de rejeições do meio para o **fim** do prompt, a temp 0, cortou a reincidência do llama3.2:3b de mediana 21,5 para 8 (~2,6x) e multiplicou a agência por ~4 (0,05 → 0,23), sem custo de validade. Temperatura (H1) só maquiou o sintoma: matou a repetição byte a byte sem melhorar o que o modelo entende.
2. **O efeito NÃO generaliza.** O mesmo experimento no qwen2.5:3b deu ruído — porque o baseline do qwen já era melhor que o llama3.2 *com* o remédio. Sensibilidade à estrutura do prompt é propriedade do modelo, não regra dos 3B. "Onde colocar o feedback" é um knob a calibrar por modelo, como temperatura.
3. **Agência contradiz tamanho.** No benchmark: qwen2.5:3b > llama3.2:3b > llama3 8B — o dobro de parâmetros jogando pior. O que o pós-treinamento otimizou pesa mais que escala, nesta faixa.
4. **Controle de sanidade:** Gemini, mesma arena e mesmo prompt: agência 2,95, zero rejeições em 121 ações, jogo mecanicamente perfeito. O ambiente é jogável; as falhas dos 3B são dos modelos.

Detalhes e logs: `docs/PROTOCOLO_EXPERIMENTOS_H1_H2.txt`, `docs/BENCHMARK_modelos.txt`, `logs/exp/resumo.txt`.

## Como rodar

**Arena (navegador):**
```bash
python servir.py
```
Depois abrir `http://localhost:8000/index.html`. **Não abrir o ficheiro com duplo
clique:** em `file://` o navegador bloqueia `fetch`, `localStorage` e downloads, e
o jogo abre sem chave de API, sem mapa e sem log.

O mapa é 3D e vem de ficheiros cozidos no Blender que **não estão no git** (dezenas
de MB). Quem clona o repositório tem de os cozer — ver `CLAUDE.md`, secção 8.2. Sem
eles o jogo diz o que falta e pára; não há mapa de reserva.

A chave da API é pedida uma vez e fica só no `localStorage` do navegador.

**Duelo headless (linha de comando):**
```bash
node runners/rei_vs_rei.js openrouter:deepseek/deepseek-r1 burro 1 40 saida.txt
```
Lê a chave do `.env` da pasta (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GROK_API_KEY`).
Escreve o `.txt` narrado e, ao lado, o `.replay.json` — que é de onde saem as
métricas. O `.txt` narra, o JSON mede.

**Testes:** 30 testes do motor (`testes/`) + 13 smokes da arena (`testes_arena/`),
com stubs de DOM em modo estrito. Rodar da raiz:
```bash
for f in testes/*.js testes_arena/*.js; do node "$f" || echo "FALHOU $f"; done
```

## O que tem dentro

Motor de combate com triângulo de tropas, influência territorial, sistema de replay com controles de cockpit, painel duplo de reis, e um protocolo de experimentos com proveniência de ponta a ponta. Tudo sem framework — a escolha que ensina o que os frameworks escondem.

## Roadmap (Arena dos Reis)

Fog of war, ordens simultâneas, 3+ reis e diplomacia — transformando o duelo num torneio observável, com transmissão gravada das partidas. A taxa de sucesso de *injeção indireta plantada no tabuleiro* está no plano como métrica de segurança do benchmark.

---

*Projeto-irmão: [teste-agente](https://github.com/kbelin88/teste-agente) — o agente construído do zero (RAG, MCP, multi-agente, observabilidade), com postmortems formais e modelo de ameaças em `docs/`.*
