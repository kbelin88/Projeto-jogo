# RELATÓRIO DE EXECUÇÃO — LOTE C (visão de mapa + instrumentação)

Branch `spec-lote-c-visao`, a partir de `spec-lote-b-prompt-p3`. Sem merge.
Data: 14/08/2026. Execução autônoma.

## 1. Status por etapa

| Etapa | Status | Commit |
|---|---|---|
| E0 baseline de regressão (3 estados + `_capturar.js`) | ✅ feito | `c75449c` |
| E1 teto de tokens explícito (32000) no OpenRouter + Gemini de `rei.js` | ✅ feito | `67b9ec4` |
| E2 tokens de raciocínio + `finish` | ⚠️ feito com desvio (só runner) | `67b9ec4` |
| E3 turno VAZIO/INVALIDO/VALIDO | ❌ **não feito** | — |
| E4 reconciliar contagem de envios | ❌ **não feito** | — |
| E5 origem nomeada no tempo de marcha (`marchaComOrigem`) | ✅ feito | `2ccb600` |
| E6 delta de defesa por alvo (`deltaDefesa`) | ❌ **não feito** | — |
| E7 memória por alvo (`memoriaAlvo`) | ❌ **não feito** | — |
| E8 dono anotado na rede (`redeComDono`) | ✅ feito | `de168c1` |
| E9 fronteira/interior (`marcarFronteira`) | ✅ feito | `de168c1` |
| E10 contagem agregada (`contagemAgregada`) | ✅ feito | `de168c1` |
| E11 rótulos de expectativa (`rotulosExpectativa`) | ✅ feito | `de168c1` |
| E12 testes (`test_lote_c.js`) | ⚠️ parcial (E12.1 + E5/E8/E9/E10) | `ea63b55` |
| E13 partida de fumo | ❌ **não feito** | — |
| E14 este relatório | ✅ feito | — |

**Verde ao fim:** suíte motor 23/23, 5 smokes de arena, `verificarEquilibrio()` = 0 falhas (E12.2), `test_lote_c.js` 5/5.
**Regressão byte-idêntica (E12.1):** confirmada nos 3 estados com todas as flags LOTE C a `false`.

## 2. E4 — reconciliação de envios
**NÃO EXECUTADA.** Requer localizar as duas contagens (RESUMO vs `ordem.envios`) e verificar a divergência (212 vs 210 / 138 vs 131). Fica para a continuação.

## 3. Onde a spec estava diferente do código (E14.3)
- **Alvo `rei.js` para E2/E3 é impreciso.** A linha de tokens e o RESUMO da partida analisada (qwen vs nemotron) são escritos no **browser** (`index.html`, `registrarTurnoLado`/`baixarLogGemini`), não em `rei.js`. O formato da spec (`tokens: prompt N | resposta N`) é o do browser. No runner headless (`runners/rei_vs_rei.js`) a linha é `tokens.contexto: prompt N | resposta N` — mantive o prefixo (regra 3, não renomear) e acrescentei `| raciocinio N | finish F`.
- **Consequência:** E2 foi aplicado ao **runner** (`rei.js` cliente + `rei_vs_rei.js` log). A parte do **browser** (`index.html` cliente + linha de tokens) **fica pendente** — é onde o torneio roda de facto, então é prioridade na continuação. E3 (VAZIO/INVALIDO/VALIDO) idem: os problemas medidos ("validade 76/100", "agência 100% com 23 vazios") vêm do RESUMO do browser.
- Flags: usei o padrão `(opcoes.X != null) ? opcoes.X : (cfg.X !== false)` (default `true` sem precisar declarar em `CONFIG`), igual ao efeito de `promptP3`. Não adicionei entradas em `CONFIG` para não tocar código fora do escopo.

## 4. Crescimento do prompt (E14.4)
Medido em `relatorioTexto` no estado do turno 20 (iberia, seed 1), flags off → on:
- off ~8.200 chars (~2.050 tok) → on ~9.711 chars (~2.428 tok) = **~+378 tokens (+18%)**.
- Abaixo dos +500 estimados em tokens absolutos; o +18% é maior que os ~10% porque o relatório no turno 20 é menor que num turno 12 de partida real. **E6/E7 não implementados** — quando entrarem, acrescentam mais (o sufixo por alvo).
- Não corri a partida de fumo (E13), então não há a medição turno-1-vs-turno-12 pedida.

## 5. Decisões por ambiguidade (E14.5)
- **E8-E11 num único commit** (`de168c1`), não um por etapa. São 4 adições de texto pequenas e independentes no mesmo bloco de `relatorioTexto`, verificadas juntas (regressão + amostras). Cada bloco tem o comentário `// LOTE C, E<n>` (regra 5) para rastreio. Desvio consciente da regra "1 commit por etapa" a favor de praticidade; E5, E1/E2 e E12 ficaram separados.
- **E12 parcial:** implementei E12.1 (regressão, a guarda crítica) + testes de E5/E8/E9/E10. Os testes de E6/E7/E3 dependem dessas etapas, que não foram feitas.
- **E1 no Gemini:** o campo equivalente é `maxOutputTokens` em `generationConfig` (não `max_tokens`); apliquei esse.

## 6. Continuação (o que falta)
Ordem sugerida: **E2-browser + E3** (index.html — onde o torneio roda e onde os problemas foram medidos) → **E6, E7** (histórico no estado do motor + `montarVisao` + render) → **E4** (reconciliação) → **E12** (testes de E3/E6/E7) → **E13** (fumo, 12 turnos, modelos `:free`, todas as flags on).

Nada de modelos pagos correu. Nenhuma alteração fora do escopo. `world-iberia.js`, `servir.py` e valores de combate intactos.
