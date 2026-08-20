# RELATÓRIO DE EXECUÇÃO — LOTE D (diagnóstico de fim de geração + memória)

Branch `spec-lote-d-memoria`, a partir de `spec-lote-c-visao`. Sem merge.
Data: 14-15/08/2026. Execução autônoma.

## 1. Status por etapa

| Etapa | Status | Commit |
|---|---|---|
| D1 registar o fim de geração literal (finish + native + error) no browser | ✅ feito | `d9425aa` |
| D2 teto de tokens no browser (controlo) + cabeçalho com max_tokens real | ✅ feito | `024490c` |
| D3 VAZIO/INVALIDO/VALIDO + agência sobre turnos com resposta | ✅ feito | `5f7eaaa` |
| D3.5 propagar "turnos sem resposta" ao painel do espectador | ✅ feito | `ce466e1` |
| D4 delta de defesa por alvo (histórico no `tick`) | ✅ feito | `8fb483f` |
| D5 memória por alvo (lê `estado.log`, sem estrutura nova) | ✅ feito | `8fb483f` |
| D6 testes (D4/D5 no `test_lote_c.js`) | ✅ feito | `0b75256` |
| D7 partida de fumo | ⚠️ ver secção 2 | — |
| D8 este relatório | ✅ feito | — |

**Verde:** suíte motor 23/23, 5 smokes de arena, `test_lote_c.js` 7/7 (E12.1 regressão byte-idêntica + E5/E8/E9/E10 + D4/D5). Regressão byte-idêntica mantida com TODAS as flags do LOTE C **e** do LOTE D a `false`.

## 2. D7 — partida de fumo e o que o D1 revelou
**Status: parcial — a instrumentação foi validada, o duelo completo não fechou no ambiente.**

Não consigo dirigir um browser real aqui (o navegador embutido bloqueia `localhost`), então montei um harness Node que faz `eval` do `index.html` com **fetch real + a chave do `.env` + os modelos `:free`** (`gpt-oss-20b:free` vs `nemotron-nano-9b:free`, $0). O que aconteceu:

1. **Bug do harness (não do jogo), corrigido:** as 2 primeiras corridas deram `Failed to parse URL` — porque eu tinha sobrescrito `global.URL` inteiro com um stub `{createObjectURL,...}`, e o `undici` (fetch do Node) faz `new URL()` internamente. Corrigido preservando o construtor `URL` real. O jogo em browser real não tem este problema.
2. **Após o fix, o duelo começou a fazer chamadas reais**, mas os `:free` são lentos demais no prompt do jogo (~2.500 tok + reasoning): nem 3 turnos (6 chamadas) fecharam em 4,5 min (cada chamada ~45s+ com pacing + backoff de 429 ocasional). O `.txt` só é escrito no fim da partida, então não sobrou log de turnos.
3. **Sonda única a `gpt-oss-20b:free` (validação direta do D1):** HTTP 200, `finish: stop | native_finish_reason: stop | content: "ok" | reasoning_tokens: 29`. **Confirma que o D1 captura exatamente estes campos.** A sonda pequena passou rápido — o gargalo é a latência do prompt grande no free-tier, não indisponibilidade.
4. **D2 confirmado:** o cabeçalho de condições do log gerado mostrou `max_tokens_resposta=32000` (valor real, não `default_provedor`).

**O que o D1 revelou sobre os 23 vazios:** nada ainda — **a causa continua desconhecida**, porque a fumo não reproduziu turnos e a sonda devolveu um `stop` normal. Isto é resultado, não ausência de resultado: o mecanismo do D1 está provado; a **próxima partida real no Edge** (com D1 já ligado) vai imprimir `finish`/`nativo`/`erroApi` na primeira resposta vazia que ocorrer — é aí que a causa aparece. Recomendação: correr uma partida real curta e ler essa linha.

## 3. Sítios onde a spec estava diferente do código (D8.3)
- **D5 janela: 8 turnos, não 6.** O filtro da spec é `ev.turno > estado.turno - 8` (janela 8), mas o texto de exemplo dizia "nos ultimos 6 turnos". Usei **8** para o número renderizado bater com o filtro (evita mentir sobre a janela). O sufixo diz "nos ultimos 8 turnos".
- **D4 "mesma função que o relatório usa":** o relatório calcula defesa efetiva num `const defefetiva` LOCAL a `relatorioTexto` (não uma função de módulo). Para o `tick` (D4) usar a MESMA conta sem reimplementar, extraí `defesaEfetivaDe(tropas, capital, cfg)` (defesaDe × bónus do terreno) — valor idêntico ao `defefetiva`. Não toquei no `defefetiva` do relatório (byte-idêntico garantido).
- **Cliente OpenRouter duplicado (correção da spec, confirmada):** o `index.html` tem `gerarOpenRouter` próprio (~2426), separado do `rei.js`. D1/D2/D3 foram todos ao `index.html` (o caminho da partida). As mudanças do LOTE C em `rei.js` continuam intactas (não revertidas).

## 4. Crescimento do prompt (D8.4)
Medido em `relatorioTexto` no estado do turno 12 (iberia, seed 1), TODAS as flags LOTE C+D off → on:
- off ~2.501 tok → on ~2.978 tok = **~+477 tokens (+19%)** — inclui D4 (delta) e D5 (memória) além das etapas do LOTE C.
- O crescimento por-alvo (D4/D5) só aparece quando há histórico/tentativas; num turno 12 de partida real com combates, é o valor acima.

## 5. Decisões por ambiguidade (D8.5)
- **D3.5 em commit próprio** (`ce466e1`), separado de D3 (`5f7eaaa`): D3 é log/resumo (o `.txt`), D3.5 é o painel (UI). Separei por serem alvos diferentes.
- **D4 e D5 num único commit** (`8fb483f`): partilham a mesma linha de render (sufixos por alvo em NEUTRAS/INIMIGO) e foram verificados juntos. Cada bloco tem `// LOTE D, D4`/`D5`.
- **D3 classificação `valido`:** mantive `ct.valido` = `r.ok` (parse bem-sucedido). Como resposta vazia dá `r.ok` falso, a cadeia VAZIO→INVALIDO→VALIDO é equivalente e não parte nada a jusante.

## 6. Fora de escopo (respeitado)
Combate/triângulo/custos intactos; `world-iberia.js` e `servir.py` não tocados; nenhum retry em turno vazio; `rei.js` do LOTE C não revertido; cliente OpenRouter do browser e do runner NÃO unificados (fica para lote próprio).
Nenhuma partida paga correu. As duas chaves expostas a 03/08 continuam por revogar (tarefa do Lucas, antes de carregar crédito).
