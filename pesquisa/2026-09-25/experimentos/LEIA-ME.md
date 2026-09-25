# experimentos/ — pesquisa do prompt, 25/09

Scripts do `../RELATORIO_PROMPT.md`. Todos só leem: não tocam no motor, no jogo nem nos logs.

**Não precisam do replay.** O `reexec.js` reexecuta a partida no `engine.js` a partir das
ordens gravadas no `.txt` (as linhas `ordem.construir` / `ordem.envios`) e confere o estado
contra cada linha `placar`. As 4 partidas de 23/09 batem nos 120 turnos. Se uma partida
futura divergir, os números dos outros scripts deixam de valer para ela: corra o
`reexec.js` primeiro.

```bash
# as partidas ficam fora do git (resultados/); passe os .txt
node reexec.js   resultados/p4-bateria-0923/P1_dots_x_super120_seed3.txt
node falhas.js   resultados/p4-bateria-0923/*.txt
node p5_prototipo.js resultados/p4-bateria-0923/P3_ultra550_x_dots_seed5.txt 12 A /tmp/p5
# no motor, sem partidas (minutos):
node variantes.js 100
node variantes2.js 150
```

| script | mede |
|---|---|
| `reexec.js` | reconstrói e confere a partida; os outros importam `carregar`/`reexec` dele |
| `medir.js` | força, tropa parada, tropa nas aldeias de partida, taxa de falha, razão força/defesa |
| `falhas.js` | cada ataque: já perdia na ordem, ou ganhava e a defesa mudou na marcha |
| `mudou.js` | por que mudou: construção, reforço, parou antes do alvo |
| `estoque.js` | o estoque do alvo (antes das ordens) previa a construção? |
| `retaguarda.js` | tropa de retaguarda que sai, alvos por turno, maior ataque em % do exército |
| `banda.js` | aldeias que dão ordem de envio por turno; reforços contra ataques |
| `fatia.js` | fração da guarnição da origem enviada em cada ataque |
| `convergentes.js` | envios de aldeias diferentes ao mesmo alvo no mesmo turno |
| `memoria.js` | depois de falhar: volta ao alvo com mais força? ganha? |
| `bug_baixas.js` | "your losses: N troops" contra as tropas realmente perdidas |
| `raciocinio.js` | em quantos turnos o raciocínio toca cada dúvida de regra (regex: conta temas, não certezas) |
| `trechos.js '<regex>' <n> <partidas>` | amostra de frases do raciocínio que batem na regex |
| `variantes.js`, `variantes2.js`, `perfil.js` | políticas do jogador-base no motor (margem, retaguarda, fatiamento) |
| `p5_prototipo.js` | o P4 e o P5 do mesmo turno real, lado a lado (numa CÓPIA do motor) |
| `sonda_casos.js` | escolhe os turnos-teste da sonda (onde o Rei errou) |
| `sonda_p5.js` | a mesma decisão pedida com P4 e P5, avaliada pelo motor (`--seco` e `--burro` correm sem rede) |
| `sonda_comum.js` | reconstruir um turno e avaliar uma ordem (partilhado pela sonda) |

**Cuidado com a simultaneidade.** Tudo o que diz "o que o Rei podia saber" usa a
`fotografia` de antes das ordens (`reexec.js`, fase `"pre"`). Na fase `"pos"` as ordens
dos DOIS lados já correram: o inimigo pode ter tirado tropa do alvo, gasto a madeira ou
mandado um reforço que o Rei nunca viu. Duas conclusões desta pesquisa estiveram erradas
por isso durante a noite, e foram corrigidas (ver o relatório, §4).

`saidas_partidas.txt` e `saidas_motor.txt` guardam as saídas da noite de 25/09.

Os prompts renderizados pelo `p5_prototipo.js` não vão para o git: saem de partidas, e as
partidas ficam no disco (regra de 28/08).
