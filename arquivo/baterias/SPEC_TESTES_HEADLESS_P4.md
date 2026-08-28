# SPEC — bateria de partidas P4 em free-tier (headless, para o Sonnet conduzir)

Escrita em 17/08/2026 por pedido do Lucas, que vai estar a trabalhar. **Você (Sonnet, no Claude
Code) executa; ninguém está a olhar.** A análise fica para depois — o seu produto é
**logs limpos e um diário honesto do que aconteceu**.

---

## 1. REGRAS DURAS (violar isto invalida a bateria)

1. **NÃO altere `engine.js`, `index.html`, `rei.js`, o `CONFIG` nem o prompt.** A bateria mede
   o jogo como ele está. Se encontrar um bug, **anote no diário e siga** — não corrija.
2. **NÃO use `z-ai/glm-5.2:free` nem `google/gemma-4-31b-it:free`.** Decisão do Lucas: os dois
   dão HTTP 429 de pool compartilhado e queimam a bateria.
3. **Um modelo que não responde é motivo para PARAR aquela partida e TROCAR de modelo** —
   nunca para insistir em loop. O runner já faz metade disso (§5).
4. **Nunca apague um log**, nem os das partidas que falharam no turno 1. O log de uma falha é
   dado sobre o provedor.
5. **Não gaste a cota a explorar.** Teto da conta: **20 requisições/minuto e 1000/dia**. Cada
   turno = **2 chamadas** (um por Rei). Faça a conta antes de lançar (§6).
6. Se algo o obrigar a decidir fora desta spec, **escolha o caminho que gasta menos cota** e
   escreva a decisão no diário.

---

## 2. PREFLIGHT (uma vez, antes da primeira partida)

```bash
cd "C:\Users\biolu\projetos\Projeto Jogo"

# 1. suíte verde — se falhar, PARE e escreva no diário. Não corrija.
for f in testes/test_*.js; do node "$f" >/dev/null 2>&1 || echo "FALHOU $f"; done
for f in testes_arena/*.js; do node "$f" >/dev/null 2>&1 || echo "SMOKE FALHOU $f"; done

# 2. o ruleset e o prompt vivos são os esperados
node -e "const E=require('./engine.js');const c=E.CONFIG;console.log('promptP4',c.promptP4,'fog',c.fogOfWar,'madeira',c.producao.madeira,'escala',c.escalaMarcha,'vitoria',c.vitoriaFracao)"
# esperado: promptP4 true fog true madeira 30 escala 0.2 vitoria 0.75

# 3. a chave está no .env
node -e "require('fs').readFileSync('.env','utf8').includes('OPENROUTER_API_KEY')&&console.log('chave OK')"

# 4. pasta de saída
mkdir -p resultados/p4-bateria-0817
```

Se (1), (2) ou (3) falhar: **não lance nada**, escreva o diário e pare.

---

## 3. COMO SE RODA UMA PARTIDA

```bash
node runners/rei_vs_rei.js <modeloA> <modeloB> <seed> <maxTurnos> <arquivo_saida.txt>
```

- `<modelo>` = `openrouter:<id>` ou `burro` (zero API).
- O runner lê a chave do `.env`, grava o `.txt` com **checkpoint por turno** (se o processo
  morrer, o que já correu está no disco).
- **P4 + fog estão ativos por construção** — o runner usa o mesmo `montarPrompt` do browser.

**Limitação conhecida, registe-a no diário:** o runner headless **não grava `replay.json`**.
Consequência: as métricas A3 (reforço vs ataque), a detecção de escala e a verificação do
`reconstruir-prompts.js` **não funcionam nestes logs**. O que funciona: todo o resto do
`analisar-log.js` e a `alucinacao-espacial.js` (esta última avisa que está sem replay). Partidas
com replay só saem do browser, e isso é tarefa do Lucas — não tente contornar.

O formato de tokens do headless é `tokens.contexto:` (o do browser é `tokens:`), então o
`analisar-log.js` **não soma tokens** nestes logs. Não é defeito seu; anote e siga.

---

## 4. O PLANTEL (todos verificados em 17/08; os dois banidos já estão fora)

| # | id | ctx | maxOut | raciocínio | nota |
|---|---|---|---|---|---|
| M1 | `openrouter:nvidia/nemotron-3-ultra-550b-a55b:free` | 1M | 65k | sim | 0 erros em 5 chamadas; **muito lento** (~167 s/turno) |
| M2 | `openrouter:nvidia/nemotron-3.5-lightning:free` | 1M | 65k | **não** | braço de controlo do thinking |
| M3 | `openrouter:nvidia/nemotron-3-super-120b-a12b:free` | 262k | 262k | sim | já jogou em 17/08 |
| M4 | `openrouter:deepseek/deepseek-v4-flash:free` | 1M | ? | ? | MoE 284B/13B ativos |
| M5 | `openrouter:minimax/minimax-m3:free` | 1M | ? | ? | agêntico de horizonte longo |
| M6 | `openrouter:openai/gpt-oss-20b:free` | 131k | ? | sim | 21B MoE |
| M7 | `openrouter:liquid/lfm-2.5-2.6b:free` | 128k | **8k** | sim | baseline FRACO de propósito |
| M8 | `openrouter:nvidia/nemotron-nano-9b-v2:free` | ? | ? | ? | não reverificado |

---

## 5. POLÍTICA DE FALHA — parar e trocar

**O runner já aborta sozinho:** ao ver **2 erros de rede consecutivos do mesmo lado**, escreve
`>>> INTERROMPIDO: ...` e fecha o log limpo (`LIM_ERRO_REDE = 2`). Não mexa nesse número.

Sua parte, depois de cada partida:

```bash
# o log foi interrompido?
grep -c ">>> INTERROMPIDO" <arquivo.txt>
# quem falhou e por quê?
grep -m3 ">>> detalhe:" <arquivo.txt>
# quantos turnos correram?
grep -c "^########## TURNO" <arquivo.txt>
```

Classifique e aja:

| o que viu | veredito | ação |
|---|---|---|
| `INTERROMPIDO` + `429` + `retry_after` | **modelo throttled** | marque o modelo como **QUEIMADO**, não o use mais hoje, passe ao próximo par |
| `INTERROMPIDO` + `403` / `Key limit` | **cota da conta esgotou** | **PARE A BATERIA INTEIRA** e escreva o diário |
| `INTERROMPIDO` + `HTTP 404` / `not a valid model` | **id errado ou modelo saiu** | marque **INEXISTENTE**, siga |
| `INTERROMPIDO` + `HTTP 400` | **parâmetro rejeitado** (provável `reasoning` num modelo sem suporte) | marque **INCOMPATÍVEL**, siga |
| turnos < 3 sem `INTERROMPIDO` | anómalo | anote e siga |
| terminou por vitória, limite ou estagnação | **partida boa** | anote e siga |

**Regra de ouro: um modelo QUEIMADO ou INEXISTENTE nunca volta na mesma bateria.** Se dois
modelos seguidos queimarem, espere **10 minutos** antes do próximo lançamento (o pool
compartilhado precisa de folga) e registe a espera.

---

## 6. ORÇAMENTO DE COTA (faça a conta antes de cada lançamento)

- Teto: **1000 requisições/dia**, **20/minuto**.
- Custo: `2 × maxTurnos` requisições por partida (mais as retentativas em throttle).
- A matriz do §7 pede **≈ 320 requisições** se tudo correr até o fim — cabe com folga.
- Mantenha um contador no diário. **Ao chegar a 800, pare** e deixe margem para o Lucas.
- O runner é sequencial (um Rei depois do outro), então 20/min não é risco real. Nunca rode
  **duas partidas em paralelo** — é o jeito mais rápido de estourar o limite por minuto.

---

## 7. A MATRIZ, EM ORDEM DE VALOR

Rode **na ordem**. Cada linha diz a pergunta que responde — se tiver de cortar por tempo ou
cota, corte de baixo para cima. Seed fixa em 1 (comparabilidade com o histórico).

| ordem | A | B | turnos | pergunta que responde |
|---|---|---|---|---|
| 1 | M2 Lightning | M3 Super 120B | 25 | **a principal**: sob fog, o duelo rei-contra-rei chega? as neutras esgotam? a dominância dispara? (par rápido: os dois devem ser velozes) |
| 2 | M2 Lightning | M2 Lightning | 25 | espelho: o mesmo modelo dos dois lados isola a **variância do jogo** da diferença entre modelos |
| 3 | M3 Super 120B | M2 Lightning | 25 | **A/B de assento** — inverte os lados da partida 1. Sem isto não há afirmação comparativa (thread aberta do handoff) |
| 4 | M4 DeepSeek V4 Flash | M2 Lightning | 25 | modelo novo, nunca testado no jogo |
| 5 | M5 MiniMax M3 | M2 Lightning | 25 | idem |
| 6 | M6 gpt-oss 20B | M2 Lightning | 20 | modelo pequeno com raciocínio |
| 7 | M7 LFM 2.6B | burro | 15 | **degrau 0/1**: um 2.6B consegue emitir JSON válido e usar ids reais sob o P4 sem exemplo? Contra `burro` custa metade da cota |
| 8 | M1 Ultra 550B | M2 Lightning | 15 | o mais forte contra o de controlo. **Turnos baixos de propósito**: o Ultra leva ~167 s/turno (15 turnos ≈ 45-60 min) |

Nomes de ficheiro, exatamente assim (o `<slug>` é o id sem `openrouter:` e com `/` e `:`
trocados por `-`):

```
resultados/p4-bateria-0817/<ordem>_<slugA>_vs_<slugB>_seed1_<turnos>t.txt
# ex.: resultados/p4-bateria-0817/01_nvidia-nemotron-3.5-lightning-free_vs_nvidia-nemotron-3-super-120b-a12b-free_seed1_25t.txt
```

**Antes da primeira partida de cada modelo novo (M4, M5, M6, M7): faça uma sonda de 1 turno
contra `burro`** — custa **1 chamada** e evita perder uma partida inteira num id morto:

```bash
node runners/rei_vs_rei.js <modelo> burro 1 1 resultados/p4-bateria-0817/sonda_<slug>.txt
grep -E ">>> (INTERROMPIDO|detalhe)|^ordem.construir" resultados/p4-bateria-0817/sonda_<slug>.txt | head -3
```

Se a sonda falhar, marque o modelo e **salte a linha da matriz** que o usa.

---

## 8. O DIÁRIO (o seu entregável mais importante)

Mantenha `resultados/p4-bateria-0817/DIARIO.md`, atualizado **depois de cada partida** (não no
fim — se o processo morrer, o que não foi escrito não existe). Uma entrada por linha da matriz:

```markdown
## 01 — Lightning (A) x Super 120B (B), 25 turnos
- lançado: 17:52 | terminou: 18:09 (17 min)
- resultado: FIM natural, turno 25, limite | A 9 ald / B 11 ald / neutras 4
- turnos com resposta: A 25/25, B 24/25
- INTERROMPIDO: não
- throttle: 3 x 429 recuperados (nenhum matou)
- requisições gastas: 50 (acumulado: 51)
- estranhezas: no T14 o Rei B pediu 40 lanceiros de uma vez (quantidade); o motor cortou por recurso
```

No fim do dia, acrescente ao diário:

- **tabela de estado por modelo**: OK / QUEIMADO / INEXISTENTE / INCOMPATÍVEL
- **total de requisições gastas**
- **quais linhas da matriz não correram e por quê**
- **as 3 coisas mais estranhas** que você viu nos logs (sem análise profunda — só o dedo
  apontado, para o Lucas e o próximo modelo olharem)

---

## 9. SANIDADE POR PARTIDA (rápido, não é análise)

Depois de cada log, rode **uma vez** e cole as 6 primeiras linhas no diário:

```bash
node ferramentas/analisar-log.js <arquivo.txt> 2>&1 | head -12
```

Se o analisador **crashar**, isso é achado: anote o erro completo no diário e siga. Não corrija
o analisador.

Não escreva conclusões sobre qualidade de modelo, monocultura, counter ou estratégia. **Isso é
a análise, e é para depois** — com replay, no browser, com o Lucas.

---

## 10. CONDIÇÕES DE PARADA GLOBAL

Pare a bateria e escreva o diário se:

- aparecer `403` / `Key limit exceeded` (cota da conta);
- o contador de requisições passar de **800**;
- **três modelos seguidos** falharem na sonda (sinal de problema na conta, não nos modelos);
- a suíte do preflight estiver vermelha;
- faltar espaço em disco.

Em qualquer parada: o diário tem de dizer **onde parou e por quê**, para a bateria poder ser
retomada de onde ficou.

---

## 11. QUANDO ACABAR

Deixe no diretório: os `.txt` de todas as partidas (**incluindo os falhados**), as sondas, e o
`DIARIO.md`. Não faça commit, não faça push, não apague nada. Escreva no fim do diário:

> Bateria concluída/interrompida em <hora>. <N> partidas boas, <N> interrompidas.
> Requisições gastas: <N>. Para analisar: `analisar-log.js` em cada `.txt`; as métricas A3 e
> a alucinação espacial precisam de replay, que só o browser grava.

O Lucas volta do trabalho e lê o diário primeiro.
