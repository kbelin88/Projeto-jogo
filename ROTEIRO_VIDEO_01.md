# ROTEIRO — VIDEO 01: "THE KINGS ARENA"
Melhor de 3 entre dois modelos. Escrito em 25/08/2026.

---

## 1. A peca

**Formato:** abertura explicativa sobre o banner -> partidas -> tabela final.
**Confronto:** `dots-3-note-preview` (Rei A, azul) x `nemotron-3-super-120b` (Rei B, vermelho).
**Regra:** melhor de 3. Sao 2 ou 3 partidas conforme o placar.
**Sem limite de turnos:** as partidas correm ate a vitoria de verdade.
**Velocidade de reproducao:** **0.35x** (5715 ms/turno). Ja esta no seletor.
0.5x atropela a leitura; 0.25x arrasta. 0.35x foi a escolha do Lucas.

**Abertura:** `assets/banner_arena.png` — os dois reis sobre o mapa da Iberia.
(O original tinha "THE THE KINGS ARENA", com o "THE" repetido, e a marca d'agua
do gerador. Os dois foram removidos; o arquivo limpo e o `banner_arena.png`.)

---

## 2. Abertura sobre o banner (~2 min)

O banner fica parado no fundo e a informacao entra por cima, em blocos. O
espectador precisa sair daqui sabendo **ler** a partida — sem isso o resto e
so cor se mexendo.

### Bloco 1 — o que e isto (20 s)
Duas IAs jogam um jogo de estrategia por turnos, uma contra a outra, disputando
a Peninsula Iberica. Nenhuma delas foi treinada para este jogo. Elas recebem as
regras por escrito, olham o tabuleiro por escrito, e decidem.

### Bloco 2 — as regras que importam (50 s)
Seis batidas, uma por conceito. Mostrar cada uma com um recorte do mapa.

1. **Objetivo** — 24 aldeias no mapa. Vence quem segurar 18 (75%) por dois
   turnos seguidos, ou eliminar o outro.
2. **Economia por aldeia** — cada aldeia junta madeira e ferro e gasta do
   proprio estoque. Nao ha caixa central. **Madeira e o gargalo.**
3. **Tres tropas, um triangulo** — lanceiro vence cavaleiro, cavaleiro vence
   arqueiro, arqueiro vence lanceiro. Ter o counter multiplica a forca por 1.5.
   Na tela sao os simbolos: lanca, arco e cavalo.
4. **Marcha por estrada** — nao se anda em linha reta. E o exercito inteiro
   anda na velocidade da tropa mais lenta.
5. **Fog of war** — cada rei so ve as proprias aldeias e as vizinhas. O resto e
   memoria velha ou escuridao. **Explorar e conquistar**: nao ha batedor.
6. **Ordens simultaneas** — os dois decidem no escuro, ao mesmo tempo. Ninguem
   reage ao lance do outro.

### Bloco 3 — como o modelo joga (40 s)
Esta e a parte que ninguem mais mostra. Vale ir devagar.

- **O prompt**: mostrar o relatorio de um turno real, na tela. E texto puro —
  a lista de aldeias, guarnicoes, defesa efetiva, tempo de marcha, quem faz
  fronteira. Sublinhar que **o modelo nao ve o mapa**; ele le uma tabela.
- **A resposta**: mostrar o JSON cru que o modelo devolveu, com `construir`,
  `envios`, `plano` e `depoimento`.
- **A ponte**: o `depoimento` e o que aparece nas caixas laterais durante a
  partida. Quando o rei fala na tela, **e a fala dele mesmo, sem edicao**.

> Recorte sugerido: um turno de verdade das partidas de hoje, com o prompt de
> um lado e o JSON do outro. `ferramentas/reconstruir-prompts.js` recupera o
> prompt exato de qualquer turno gravado.

### Bloco 4 — gancho (10 s)
"Os dois reis nunca se veem. Cada um acha que esta ganhando. Voce vai ver os
dois pensamentos ao mesmo tempo — e eles nao."

Corta para a partida.

---

## 3. As partidas

Cada partida entra com uma cartela curta: numero do jogo, seed e o placar da
serie ate ali.

| | cartela de entrada |
|---|---|
| Jogo 1 | JOGO 1 — seed 1 |
| Jogo 2 | JOGO 2 — seed 2 · serie 1x0 (ou o que for) |
| Jogo 3 | JOGO 3 — o desempate (so se 1x1) |

**Durante a partida:** sem locucao por cima o tempo todo. Deixar a partida
respirar e entrar so nos momentos que pedem — a primeira conquista, a virada,
o momento em que os dois depoimentos se contradizem.

**Momentos que valem parar e comentar** (marcar ao assistir os replays):
- primeira vez que uma torre pega fogo
- um combate na estrada (exercitos se cruzando no caminho)
- turno em que os dois reis dizem estar ganhando
- a conquista que fecha a vitoria por dominancia

---

## 4. Fecho: a tabela (~1 min)

Encerrar no **benchmark**, que e a razao de o projeto existir.

Dados que saem prontos de `ferramentas/analisar-log.js --json`:

| metrica | por que importa |
|---|---|
| placar da serie | quem venceu a melhor de 3 |
| turnos por partida | quanto tempo levou para decidir |
| conquistas / combates | **taxa de ataque viavel** — atacou e levou? |
| taxa de counter | usou o triangulo ou bateu de qualquer jeito? |
| construcoes S/A/K | monocultura ou exercito misto? |
| rejeicoes | ordens que o motor recusou (grounding) |
| vazios / invalidos | turnos que o modelo perdeu sem jogar |
| mediana de decisao | segundos por turno |
| tokens in/out | custo de pensamento |

**Fechamento falado:** o que estes numeros dizem sobre os dois modelos, e o que
eles **nao** dizem. Ser honesto sobre a amostra: tres partidas nao definem
qual modelo e melhor — definem quem ganhou hoje, neste mapa, com estas seeds.

---

## 5. Producao

**Gravar:** `python servir.py`, carregar o replay, velocidade **0.35x**, botao
**cinema**, e entao `Win+Alt+R`. Dentro do cinema: **R** volta ao inicio
pausado, **espaco** da play, **ESC** sai.
Nao encostar no mouse depois do play — o cursor e o controle entram no video.

**Editar:** ffmpeg, aqui na conversa. Manda o caminho do `.mp4` e eu corto,
ponho cartelas e devolvo para revisao.

**Arquivos:** brutos e cortes em `videos/` (fora do git).

---

## 6. Pendencias

- [ ] as duas partidas terminarem (rodando desde 25/08, sem limite de turnos)
- [ ] escolher os momentos de comentario assistindo os replays
- [ ] decidir se ha 3o jogo (so se a serie ficar 1x1)
- [ ] gerar a tabela final com `analisar-log.js`
- [ ] gravar a abertura sobre o banner
