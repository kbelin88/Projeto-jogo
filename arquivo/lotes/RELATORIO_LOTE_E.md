# RELATÓRIO DE EXECUÇÃO — LOTE E (fairness do turno + diagnóstico de duração + métricas)

Branch `spec-lote-e-fairness`, a partir de `spec-lote-d-memoria`. Sem merge.
Origem: revisão de código Fable 5 (15/08/2026), achados A1–A6 + auditoria do analisador.
Execução: Claude Code (Opus 4.8), autônoma.

## 1. Status por etapa

| Etapa | O quê | Status | Commit |
|---|---|---|---|
| E0 | Baseline de COMPORTAMENTO do motor + teste E8.1 | ✅ | `666c347` |
| E1 | Ordens simultâneas no MOTOR (achado A1) | ✅ | `65be971` |
| E2 | Ordens simultâneas no BROWSER (achado A1) | ✅ | `78f0ed3` |
| E3 | Interceptação na chegada (achado A3) | ✅ | `ab6cb47` |
| E4 | Desempate de estrada sem lado fixo (achado A4) | ✅ | `5a27fa8` |
| E5 | Duração da chamada no log (achado A2) | ✅ | `7976f0d` |
| E6 | Teto de custo configurável (achado A6) | ✅ | `6b1fc12` |
| E7 | Analisador: 4 métricas novas | ✅ | `0c2f1e6` |
| E8 | Testes E8.2–E8.5 + fixture | ✅ | `3006d1c` |
| E9 | `.gitattributes` `* -text` (achado B3) | ✅ | `29fdecf` |
| E10 | Este relatório | ✅ | — |

**Verde final:** 26 arquivos de motor (`testes/*.js`, inclui `test_lote_e.js` 5/5 e
`test_lote_c.js` 7/7) + 5 smokes de arena + `verificarEquilibrio()` = 0 falhas.
Regressão byte-idêntica mantida com TODAS as flags dos lotes B/C/D **e E** a `false`
(texto via `ref-lote-c`; comportamento via `ref-lote-e`).

**Crescimento de prompt: ZERO** (verificado: `relatorioTexto` do mesmo estado com as
flags E on vs off é byte-idêntico, 11.913 bytes, delta 0). Este lote não toca o
relatório do Rei — mexe em motor, browser, log e analisador.

## 2. O que cada correção faz (e por que é do benchmark, não cosmética)

- **A1 (E1/E2) — a manchete.** No caminho antigo, `decidirEExecutar` (motor) e
  `passoTurnoDuelo` (browser) executavam a ordem de A **antes** de montar a visão de B,
  e `montarVisao` inclui `transito` (sem fog of war): o Rei B lia os envios que A
  ordenou NAQUELE turno (destino, composição, chegada); A nunca via os de B. Para um
  *benchmark*, isso é assimetria de medição. Agora as duas ordens saem da MESMA
  fotografia; a execução segue sequencial A→B (verificado seguro: `executarOrdem(A)` só
  muta aldeias/movimentos de A e `rejeicoesAnteriores[A]`; `diagnosticarOrdem(B)` lê só
  aldeias/estoque/teto de B; conquista acontece no `tick`, não aqui). Efeito real
  confirmado: `historico` de burro vs burro DIFERE on vs off nas 3 seeds.
- **A3 (E3).** Exército no último passo de marcha ia para `chegaram` antes do
  `detectarCombatesEstrada` (que só varre `viajando`) e atravessava um inimigo em
  sentido oposto sem lutar. Agora detecta sobre a lista inteira antes de separar.
- **A4 (E4).** `atk = m1.dono < m2.dono ? …` fazia de A sempre o "atacante"; como empate
  favorece o defensor, A perdia TODO empate de estrada (viés de assento, a mesma classe
  do viés de id que o `chaveRngAlvo` já matou). Agora o papel no empate é sorteado por
  `chaveRngAlvo` (hash puro, sem lado). Confirmado: o vencedor do empate varia com a
  seed (era sempre B).
- **A2 (E5).** `msUltimaChamada` nos 4 clientes do browser + `ultimosTokens.ms` nos 3 do
  runner; ` | ms N` no FIM da linha de tokens. É o dado que faltava para testar a
  hipótese dos 23 vazios (corte por tempo).
- **A6 (E6).** `TETO_CUSTO = 7.0` fixo era maior que o saldo (~$4.18) — o freio nunca
  freava. Agora é o input `gteto` no painel (default 7, `<=0` desliga), no log.
- **E7 (analisador).** (1) VAZIO/finish/nativo/ERRO API + `ms` separado vazio/não-vazio;
  (2) monomania sobre ATAQUES (o índice legado punia concentração logística — juntar
  tropa numa aldeia, que é jogo CERTO); (3) razão de força efetiva atk/def (métrica de
  concentração do degrau 3); (4) tokens/custo agregados. Tudo retro-compatível.

## 3. Validação do E7 no log REAL dos 23 vazios (13/08)

Rodei o analisador no log da partida qwen3-235b × nemotron-120b (o dos 23 vazios):
**A vazios=0, B vazios=23, B sem-usage=2** — bate com a análise da spec. Custo agregado
do Rei A = **$2.35** (confere com o custo conhecido daquela partida). `finish_hist` e
`ms` saíram `null` (log pré-D1/E5), provando a retro-compatibilidade num log real.

## 4. Predição pré-registrada do E5 (verbatim, para conferir na próxima partida real)

> Numa partida real com free tier, os turnos VAZIOS vão se agrupar num teto de duração
> aproximadamente constante (corte por tempo), com `finish`/`nativo` ≠ `length`; os 2
> casos sem usage aparecerão como `ERRO API` ou `choices` vazio. Se os vazios NÃO
> formarem teto de duração, a hipótese alternativa é o modelo encerrar dentro do
> raciocínio (`nativo: stop` + reasoning presente + content vazio).

O analisador agora imprime `ms vazios (min/med/max)` vs `ms não-vazios` direto — o teste
da hipótese sai do JSON, sem trabalho manual.

## 5. Desvios da spec (declarados)

- **E1 exigiu ajustar a geração de estado dos testes de TEXTO.** A baseline `ref-lote-c`
  foi capturada no motor pré-E (sequencial). Como o E1 muda o **default** do motor,
  `test_lote_c.js`/`cfgIberia` e `ref-lote-c/_capturar.js` passaram a gerar o estado com
  as três flags de motor do lote E a `false` — senão o estado (e o `relatorioTexto` dele)
  divergiria da baseline. Isso é a regra 2 aplicada; os `.txt` de referência NÃO mudaram.
- **E5 mede a chamada que RESOLVEU** (t0 antes do fetch DENTRO do loop de retry), não a
  primeira tentativa. Assim o backoff nosso (429/503) não infla o `ms` e o sinal fica o
  tempo do provedor — que é o que a hipótese quer.
- **E5 no runner: `ms` vive dentro de `ultimosTokens`** (spec-literal "exposto em
  `ultimosTokens.ms`"), logo só aparece quando há usage. No browser o `ms` é um global
  separado (aparece também na linha "(sem usage)"). Consistente com onde cada caminho
  imprime a linha de tokens.
- **E7: detecção de usage robustecida.** A spec assumia `finish/nativo` presentes, mas o
  log real dos vazios é pré-D1 (`tokens: prompt N | resposta N`, sem `raciocinio`/
  `finish`). O sinal de "tem usage" virou `prompt N | resposta N` (raciocínio/finish
  opcionais) — sem isso, os 21/23 vazios-com-usage seriam contados como sem-usage.
- **E8.5 usa fixture + log antigo versionado, não o log real de 13/08.** O log dos 23
  vazios está em `checkpoints/` (gitignored, 116k linhas) — não versionável como
  fixture. O teste usa `ref-lote-e/fixture_vazios.txt` (contagens determinísticas) + um
  log baseline de 03/08 já no repo (retro-compat sem crash). O log real foi validado
  MANUALMENTE nesta sessão (§3). Nota: a spec dizia "14/08"; a partida é de 13/08 12:15
  (o mesmo duelo de 101 turnos).

## 6. Decisões por ambiguidade

- **E4 reusa `chaveRngAlvo(seed, turno, origemId, alvoId)`** passando `min/max` dos dois
  ids de origem. Os nomes dos parâmetros "mentem" (não é um alvo), mas a função é um hash
  puro e determinístico — o efeito é exatamente um sorteio sem lado. Comentado no código.
- **E7 num único commit** (4 sub-etapas): mesmo arquivo, natureza aditiva, verificadas
  juntas contra o log real — como a spec permite.
- **E8.1 e o teste de comportamento** confirmam o par: com flags off, `rodarPartida`
  (burro vs burro) é byte-idêntico à baseline; com on, o `historico` diverge (o fix age).

## 7. Fora de escopo (respeitado)

Combate/triângulo/custos intactos; `world-iberia.js`, `servir.py`, encaixe da imagem não
tocados. Cliente OpenRouter browser/runner **não** unificado; chamadas de API **não**
paralelizadas (os globals de módulo — a armadilha do E2). Economia/monocultura,
`semRede`, retry em vazio, teto de 99 do `minimoParaTomar`: nada disso mexido. Nenhuma
partida paga correu. As duas chaves expostas em 03/08 seguem por revogar (tarefa do Lucas).
