# DIARIO — BATERIA 24/08/2026

**Conduzida sozinha pelo agente**, com o Lucas fora. Regra da casa: o condutor
aponta o dedo, nao julga — a analise e do Lucas depois.

## Objetivo (diferente das baterias anteriores)

As baterias de 17-22/08 mediam modelos. Esta tem um alvo de **produto**:

> conseguir **pelo menos uma partida completa, com os depoimentos gravados no
> replay**, boa o bastante para virar o primeiro video.

Por isso o criterio de escolha nao e "quem joga melhor" e sim **quem tem a maior
chance de terminar** — velocidade e estabilidade de formato pesam mais que forca.

## O que mudou no motor hoje (e por que importa aqui)

1. **Nome das tropas virou ingles** no protocolo: `spearman` / `archer` /
   `knight`. Antes o P4 era ingles na prosa mas pedia tokens em PT, entao o
   depoimento saia meio em cada lingua — ruim para video.
2. **O runner headless passou a gravar `plano` e `depoimento`** (no `.txt` e no
   `.replay.json`). Ate hoje **so o browser gravava**; toda partida de bateria
   anterior a esta esta **sem a voz do rei**. Este e o motivo de precisar de
   partida nova para o video.
3. **O runner passou a chamar `guardarPlano`**, entao o plano do rei volta no
   prompt do turno seguinte — como sempre foi no browser. As partidas anteriores
   correram sem essa memoria.

> Consequencia: **os numeros desta bateria nao sao estritamente comparaveis** aos
> das anteriores. O rei joga com uma memoria que antes nao tinha.

## Estado do catalogo

`resultados_arena.json` esta **desatualizado**: marca `dots-3-note-preview` com 0
partidas, mas ele jogou e venceu em 0819-P4, 0821-P2 e 0822-P3. Corrigir depois.

## Sondas (2 turnos, modelo x burro)

Objetivo: confirmar que o modelo esta vivo HOJE (o catalogo `:free` apodrece — 3
de 8 morreram em menos de 24 h em agosto) e medir a latencia do dia.

Teto de 420 s por sonda (2 turnos). Estourar = reprovado para partida longa.

| modelo | resultado | latencia media | depoimento? |
|---|---|---|---|
| dots-studio/dots-3-note-preview | **APTO** | 139 s | sim |
| nvidia/nemotron-3-super-120b-a12b | **APTO** (o mais rapido do dia) | 26 s | sim |
| nvidia/nemotron-3-ultra-550b-a55b | **APTO** | 98 s | sim |
| nvidia/nemotron-3.5-lightning | **REPROVADO** — timeout (exit 124) | > 420 s em 2 turnos | nao respondeu |
| nvidia/nemotron-3-nano-30b-a3b | **REPROVADO** — ordem vazia | — | nao |

**Dois achados nas sondas:**

1. **A regua da bateria (`nemotron-3.5-lightning`) reprovou hoje.** Estourou 420 s
   em 2 turnos. Some-se a isto o historico recalculado: **24 partidas, 0 vitorias,
   6 interrompidas**. A regua nunca ganhou. Vale perguntar se ela ainda serve como
   regua ou se virou so um adversario lento.
2. **`nemotron-3-nano-30b-a3b` devolveu `construir: []` e passou o turno**, sem
   erro de rede — o modo de falha silenciosa ja documentado (CLAUDE.md 7.1 §4).
   A sonda de 1 turno de 19/08 tinha dado "OK, 24 s"; com 2 turnos ele cai.
   Reforca a regra: sonda curta nao prediz partida.

**Latencia do 120b: 26 s hoje, contra ~185 s medidos na partida das 13:03 do
mesmo dia.** Mesma familia, mesmo provedor, mesmo dia — a dispersao e do provedor,
nao do modelo. Nao tratar latencia de sonda como propriedade do modelo.

## Partidas

Escolha pelo **historico real recalculado dos replays** (o `resultados_arena.json`
esta defasado — marca `dots-3-note-preview` com 0 partidas, e ele jogou 5):

| modelo | partidas | vitorias | interrompidas |
|---|---|---|---|
| nemotron-3-super-120b | 5 | 2 | **0** |
| dots-3-note-preview | 5 | **3** | 2 |
| nemotron-3-ultra-550b | 5 | 1 | 2 |
| nemotron-3.5-lightning | 24 | **0** | 6 |

Criterio: **quem termina**, nao quem joga melhor. O 120b nunca foi interrompido
em 5 partidas; o dots tem a melhor taxa de vitoria. As duas partidas correm em
paralelo — o volume de chamadas (~2 por 2 min) fica muito abaixo do teto free de
20/min, e dobra a chance de ao menos uma fechar.

| # | Rei A | Rei B | seed | turnos | fim | duracao |
|---|---|---|---|---|---|---|
| P1 | dots-3-note-preview | nemotron-3-super-120b | 1 | 24 | **vitoria A por dominancia (19x5)** | ~2h40 |
| P2 | nemotron-3-super-120b | nemotron-3-ultra-550b | 2 | 30 | cortada pelo teto de 3h30 (B 14 x A 10) | 3h30 |

**P1 (a boa):** 24 quadros sequenciais, **21 de 24 turnos com depoimento dos DOIS
reis**. Zero erro de API dos dois lados. Curva: A abre no t2 e nao larga
(t10 16-8), leva um susto no t13 (14-10) e fecha 19-5 no t24. Vitoria limpa e
legivel — boa para o video de ensino, ainda que sem a virada dramatica.

| | Rei A (dots) | Rei B (120b) |
|---|---|---|
| envios aceites | 105 | 69 |
| construcoes S/A/K | 10 / **431** / 14 | 78 / 132 / 30 |
| taxa counter | **0.55** | 0.27 |
| conquistas/combates | 26/38 (**0.68**) | 17/37 (0.46) |
| rejeicoes | 0 | 3 |
| ms mediano | 132 s | 148 s |

**P2:** sem vencedor — o teto de 3h30 cortou no t30 com B na frente (14x10).
Nao houve erro de rede nenhum dos dois lados; foi so relogio. 40 turnos entre
dois modelos desta latencia **nao cabem em 3h30**: a media ficou em ~415 s por
turno de jogo (os dois lados somados).

## Achados

1. **O depoimento chegou ao replay, fim a fim.** Era o objetivo da bateria e
   esta feito: 21/24 turnos com a voz dos dois reis em P1, em ingles e em
   personagem, gravados pelo runner headless pela primeira vez.

2. **Monocultura extrema venceu de novo — e agora do lado do arqueiro.** O dots
   construiu **431 archers contra 10 spearmen e 14 knights** (96% arqueiro) e
   ganhou com taxa de counter 0.55 contra 0.27. Ja o P2 mostra o oposto: o 120b
   fez 328 spearmen (78%) e PERDEU para o 550b, que diversificou (78/198/148).
   A pergunta aberta de 7.1 §2 ("quem constroi menos lanceiro ganha") ganha dois
   pontos a favor, mas por caminhos diferentes — nao fecha.

3. **Teto de turnos x teto de relogio.** Nenhuma das duas usou os 40 turnos: uma
   acabou antes por vitoria, a outra por relogio. Para bateria futura, dimensionar
   por TEMPO (turnos = horas / 415 s) e nao por numero redondo.

4. **A latencia de sonda nao previu nada.** O 120b sondou a 26 s e jogou a 148 s
   de mediana (max 997 s). Fator 5,7x. Ver tambem o achado 3 das sondas.

## ERRO DO CONDUTOR (24/08) — P1 lancada DUAS vezes

O agente lancou a P1 duas vezes: a primeira com `nohup ... &` (que reportou
`exit 1` e P1.out vazio, e foi dada como falhada), a segunda pelo mecanismo de
segundo plano da ferramenta. **O processo do nohup nao tinha morrido.** Os dois
correram em paralelo escrevendo nos MESMOS arquivos por ~2h30.

**Como isso se manifesta:** `gravar()` faz `writeFileSync(outfile, L.join("\n"))`
— reescreve o arquivo INTEIRO a partir do buffer em memoria daquele processo. O
mesmo vale para o replay. Entao os arquivos nunca ficaram com linhas
intercaladas: a cada escrita, um processo sobrepunha o log completo do outro. O
conteudo final e o do **ultimo** que escreveu.

**O que se perdeu:** a segunda execucao FECHOU em **vitoria por dominancia no
turno 23 (A 20 x B 4)**, com uma virada real (B liderou ate o t11, A abriu 17-7
no t16, B empatou 12-12 no t20, A fechou 20-4). Esse log foi sobrescrito pelo
processo orfao e **nao existe mais**. So sobrou o resumo no console:

    T12 A 13 B 11  |  T16 A 17 B 7  |  T20 A 12 B 12  |  T23 A 20 B 4
    CONQUISTAS 47 (A 28 | B 19) | 23 turnos | 9169s

**O que se salvou:** o processo orfao e uma corrida legitima do mesmo confronto
e da mesma seed, e passou a ser o unico escritor — entao o arquivo final e
coerente (turnos sequenciais, cabecalho unico). Foi deixado terminar em vez de
morto: matar so desperdicaria ~2h30 de chamadas de API ja gastas.

**Licao para a proxima bateria:** nunca lancar partida com `nohup ... &` neste
ambiente — o `exit 1` do shell NAO significa que o processo morreu. Usar sempre
o mecanismo de segundo plano da ferramenta, e antes de relancar qualquer coisa,
conferir com `tasklist //FI "IMAGENAME eq node.exe"` (o `pgrep` nao existe aqui).

## Achados

(preenchido pelo agente ao fim das partidas)
