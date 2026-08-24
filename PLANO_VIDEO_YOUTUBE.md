# PLANO DO VIDEO DE 10 MINUTOS — Arena dos Reis
Escrito em 23/08/2026, revisto em 24/08.

O video de verdade, para depois do piloto (ver `PLANO_VIDEO_PILOTO.md`).

---

## 1. A tese

Numa transmissao de xadrez voce ve os lances, mas nao a cabeca do jogador. Aqui
ve as duas coisas. Cada turno gravado guarda o `plano`, o `depoimento` e o
raciocinio inteiro dos dois reis — e, por causa do fog of war, **nenhum dos dois
sabe o que o outro pensa, mas o espectador sabe**. Isso e ironia dramatica, o
motor narrativo mais antigo que existe, e cai de graca no colo deste projeto.

O melhor exemplo ja esta gravado. Turno 27 da partida espelho, os dois reis
rodando o MESMO modelo, cada um convencido de que esta ganhando — e os dois
reivindicando Burgos:

    Rei A, t27: "Conquered Pamplona today with arqueiros from Faro! Our village
                 count is now 16. The counter triangle worked perfectly."

    Rei B, t27: "Great success this turn! Conquered Murcia and Burgos without
                 losing a single troop. Now at 11 villages, need 7 more."

Abrir com estas duas falas lado a lado, antes de explicar qualquer regra,
resolve o gancho dos primeiros trinta segundos.

---

## 2. As duas partidas

Escolhidas entre as 25 gravadas, por funcao narrativa: uma ENSINA, a outra EMOCIONA.
Ambas tem `.replay.json` no repo — reproduziveis a vontade, sem custo de API.

### Partida de ensino — `0822-P4` (ox-alpha vs lightning)
seed 1, 13 turnos, vitoria por dominancia, **21-2**.
Empatada ate o turno 5 (9-9), depois demolicao limpa. Serve para ensinar porque e
curta, legivel e decisiva. **52 s a 0.5x.**

### Partida principal — `0819-P3` (lightning vs lightning)
seed 3, 30 turnos, empate no limite, **11-10**.
O MESMO modelo dos dois lados — so a posicao no mapa muda. B lidera do t3 ao t26 e
chega a abrir 8-13. Entre o t25 e o t27 ha uma virada de oito aldeias e A assume
12-9. Placar mais apertado de todo o conjunto. **2:00 a 0.5x.**

> **Atencao:** as duas somadas dao menos de TRES MINUTOS de imagem corrida. Num
> video de dez minutos, a narracao e as pausas e que carregam a peca — a imagem e
> a cama, nao o conteudo. Por isso o roteiro reserva mais tempo para explicar do
> que para assistir.
>
> **Nenhuma das duas tem depoimento gravado** (sao anteriores a 24/08). As falas
> existem nos `.txt` e teriam de virar cartela na edicao — ou grava-se uma partida
> nova.

---

## 3. Roteiro de dez minutos

| tempo | bloco | o que acontece |
|---|---|---|
| 00:00 | **Gancho** (40 s) | Tela dividida com as duas falas do t27 enquanto o mapa corre mudo. "Estes dois reis acham que estao ganhando. E o mesmo modelo. E nenhum dos dois enxerga o outro." Cartela de titulo. |
| 00:40 | **A proposta** (70 s) | O que e a Arena: LLMs jogando estrategia por turnos como benchmark. A escada de degraus (formato, grounding, economia, estrategia). Prova de multipla escolha nao mede manter um plano por 30 turnos com informacao incompleta. |
| 01:50 | **As regras** (140 s) | Seis batidas sobre a partida curta rodando por baixo: objetivo (18 de 24 aldeias por 2 turnos); economia por aldeia com madeira como gargalo; triangulo lanceiro/arqueiro/cavaleiro; marcha por estrada na velocidade da tropa mais lenta; fog of war; ordens simultaneas. |
| 04:10 | **A partida** (210 s) | O espelho em quatro atos: abertura e corrida as neutras; B abre vantagem; a virada do t26-t27 com as duas falas simultaneas (climax); fecho 11-10. Aqui entram os cortes de fog ("olhos de A", "olhos de B") para mostrar por que ninguem viu a virada chegar. |
| 07:40 | **O que isso mede** (90 s) | O que 25 partidas ensinaram: modos de falha reais (JSON quebrado, `construir: []` sem erro nenhum, degeneracao por repeticao), dispersao de latencia de 7 s a 1200 s por turno, e a pergunta em aberto sobre monocultura de tropa. Honestidade sobre o que NAO esta resolvido e o que separa isto de marketing. |
| 09:10 | **Fecho** (50 s) | Para onde vai: mais modelos, ranking, o site. Link do repo e da Arena. Encerrar sobre o mapa em movimento, sem locucao nos ultimos segundos. |

---

## 4. Pipeline

| # | fase | o que e | custo |
|---|---|---|---|
| 01 | Dossie das partidas | extrair por turno: depoimento, plano, conquistas, num documento de consulta | 2 h (automatizavel) |
| 02 | Roteiro palavra a palavra | locucao inteira contra o rundown. ~150 palavras/min em portugues => 10 min ~= 1.400 palavras | 4 h |
| 03 | Captura | as passadas de tela (secao 5). Gravar TUDO antes de editar | 3 h |
| 04 | Narracao | locucao limpa, sem eco, gravada por blocos | 2 h |
| 05 | Edicao | montar sobre a locucao (o audio e a espinha) | 6-10 h |
| 06 | Publicacao | thumbnail, titulo, descricao com capitulos, links | 2 h |

---

## 5. Receita de captura

- **Gravador:** para o video longo, OBS Studio — 1920x1080, 60 fps, MP4,
  captura de JANELA (nunca de tela inteira).
- **Navegador:** janela 1920x1080, zoom 100%, servido por `python servir.py`.
  Nunca por `file://`.
- **Modo cinema:** botao `cinema`. Esconde todos os controles.
  Dentro dele: espaco = play/pause, ESC = sair.
- **Velocidade:** 0.5x (4 s por turno). Da margem para acelerar na edicao;
  o contrario nao e possivel.
- **Camera:** `cam auto` ligada nas passadas gerais (segue os combates sozinha).
  Desligar so nos close-ups enquadrados a mao.

### As passadas a gravar
1. **Geral, mapa completo** — cada partida do inicio ao fim, cam auto ligada.
2. **Olhos de A** — a mesma partida com o fog do Rei A.
3. **Olhos de B** — idem do outro lado. O par A/B sustenta o climax do t27.
4. **Close-ups** — t26 a t28 do espelho, zoom manual, camera parada.
5. **B-roll** — o site, a tabela de modelos, o mapa em zoom lento, a barra do topo.

Cinco passadas de menos de tres minutos cada: cabe numa tarde. Como o replay e
deterministico, qualquer take se refaz identico.

---

## 6. Narracao a tres vozes

- **Voce, narrador** — em portugues, explicando regras, contexto e o que esta em
  jogo. A unica voz que fala com o espectador.
- **Rei A e Rei B** — os `depoimentos` dos proprios modelos, em primeira pessoa,
  tratados como fala de personagem. Cartelas na cor de cada rei, ou duas vozes
  sinteticas distintas, sempre com filtro que as separe da sua.

A forca disso e que **as falas nao sao escritas por voce**. Quando um modelo
escreve "Hope the RNG favors the bold" ou abre com "BREAKTHROUGH!", isso e
documento, nao roteiro. Deixe claro no video que sairam do log, sem edicao.

Os depoimentos estao em ingles. Legendar em portugues e manter o original
preserva a autenticidade; traduzir na locucao perde.

---

## 7. O que falta construir

- **`ferramentas/roteiro.js`** (bloqueante) — le o `.txt` + `.replay.json` e
  cospe um dossie em Markdown: um bloco por turno com placar, conquistas, plano,
  depoimento e o timecode acumulado na velocidade escolhida. Transforma a fase 01
  de duas horas de garimpo num comando.
- **Injetar depoimento em replay antigo** — os `.txt` sempre guardaram a fala; os
  `.replay.json` anteriores a 24/08 nao. Uma ferramenta que casa os dois destrava
  todo o material das baterias.
- **Velocidades 0.25x e 0.125x** (conveniencia) — duas opcoes a mais no seletor.
- **Ir para o turno N** (conveniencia) — hoje o replay so recomeca do zero.

---

## 8. Antes de publicar

- Nenhuma chave de API visivel em qualquer quadro (conferir o b-roll do painel).
- Nomes dos modelos legiveis na barra do topo em todos os cortes.
- Audio normalizado perto de -14 LUFS (alvo do YouTube).
- Legendas conferidas, principalmente nomes de aldeia e de modelo.
- Capitulos na descricao, batendo com os timecodes do roteiro.
- Links do repo e do site na descricao, nao so no video.
- Thumbnail legivel em 320 px de largura — e o tamanho real no feed.
