# PLANO DO VIDEO PILOTO — Arena dos Reis
Escrito em 24/08/2026.

O objetivo deste video NAO e o video. E percorrer o caminho inteiro uma vez —
gravar, cortar, escrever na tela, exportar — para que o video de verdade nao
seja a primeira tentativa de nada.

---

## 1. O que a maquina ja tem (conferido em 24/08)

- **ffmpeg 8.1.1 instalado.** E um editor de video por comando. Significa que a
  EDICAO e feita aqui na conversa: cortar, cartelas, ritmo, exportar. Nao precisa
  aprender CapCut nem Resolve para o piloto.
- **Windows 11 grava tela nativamente** com `Win+G` (ou `Win+Alt+R` direto).
  **Nao instalar OBS agora.**
- Nao ha nenhum editor de video grafico instalado, e nao faz falta.

### O que da para fazer por comando
cortar inicio/fim/meio; cartelas de texto e legendas queimadas; acelerar,
desacelerar, congelar quadro; fades e cortes; juntar trechos; extrair imagem
para thumbnail; exportar no formato do YouTube.

### O que NAO da
operar a interface de CapCut/Resolve/Clipchamp; clicar em botao de programa;
gravar a tela por voce; julgar som e ritmo — isso e sempre seu.

---

## 2. Gravar, passo a passo

1. **Preparar a janela**
   - `python servir.py` e abrir `localhost:8000`.
   - Carregar o replay em "Ver replay", velocidade em **0.5x**.
   - Navegador maximizado, fechar o que puder atrapalhar.

2. **Ligar o modo cinema** — botao `cinema` na barra de replay.
   Todos os controles somem. Saida e `ESC`.
   Dentro do cinema: **barra de espaco** = play/pause; o botao redondo aparece
   quando o mouse mexe e some sozinho em 2,5 s (por isso nao entra no video).

3. **Comecar a gravacao** — `Win+G`, botao de gravar (ou `Win+Alt+R`).
   Se o Windows perguntar se aquilo e um jogo, responder que **sim** — e so como
   ele libera a captura da janela.

4. **Deixar rodar sem tocar em nada.** Nao passar o mouse sobre o mapa: o cursor
   entra no video e o hover acende informacao que nao queremos. Gravar alguns
   segundos a mais no comeco e no fim (sobra se corta, falta se regrava).

5. **Parar** com `Win+Alt+R`. O arquivo cai em `Videos\Capturas`.
   Mover para a pasta `videos/` do projeto (ja esta no .gitignore).

### ERRO DA PRIMEIRA TENTATIVA (24/08)
A primeira gravacao saiu **sem o modo cinema**: apareciam a aba do Edge, a barra
de endereco e a barra de replay. Da para cortar o topo, mas a barra de replay
fica no meio do quadro e nao sai por corte. **Clicar em cinema ANTES de gravar.**

---

## 3. A partida do piloto

Escolhida para ser facil, nao para ser boa. A partida boa fica para o video de verdade.

- **Preferencia:** uma partida gravada de 24/08 em diante, porque e a primeira
  geracao de replays que **guarda os depoimentos**. A voz dos reis aparece
  sozinha na tela, sem precisar montar cartela.
- **Reserva:** `resultados/p4-bateria-0822/P4_stealth-ox-alpha_vs_lightning_seed1_40t`
  — ox-alpha toma 21 aldeias em 13 turnos. 52 s a 0.5x, decisao limpa, dispensa
  explicacao. Nao tem depoimento (replay antigo); as falas teriam de sair do
  `.txt` como cartela.

### Estrutura, se o piloto for mudo
| tempo | o que entra |
|---|---|
| 0:00 | cartela de abertura, 3 s: "Dois modelos de IA disputam a Peninsula Iberica" |
| 0:03 | a partida corre, sem texto, deixando o mapa respirar |
| ~0:30 | cartela curta quando a vantagem dispara, nomeando o que acontece |
| fim | cartela de placar + uma linha de fecho com o link do projeto |

Tres cartelas. Suficiente para aprender o ciclo.

**Faca o piloto MUDO.** Uma habilidade por vez: gravar -> cortar -> escrever ->
exportar. A narracao entra no piloto 2, e ai so se aprende sincronia de audio.

---

## 4. Como funciona a edicao

1. Voce manda o caminho do `.mp4`.
2. Eu monto a versao 1 (corta pontas, poe cartelas, exporta).
3. Voce critica em portugues comum: "a cartela some rapido demais", "corta
   antes", "acelera o meio". Nao precisa de nome tecnico.
4. Repetimos ate ficar bom. No fim, exporto no formato do YouTube e tiro um
   quadro para a thumbnail.

Versoes ficam em `videos/corte_<nome>_vN.mp4`.

---

## 5. Quando instalar o OBS

Nao agora. Ele entra quando quiser **narracao gravada junto com a imagem**,
**cenas** (alternar mapa/site/camera) ou controle fino de qualidade — ou seja, no
video de dez minutos.

Quando chegar a hora: **1920x1080 a 60 fps**, captura de **janela**, nunca de
tela inteira. Captura de tela inteira pega notificacao que aparecer, e
notificacao num video publicado e irreversivel.

---

## 6. Pendencia conhecida

**O estandarte de tropa em marcha parece uma aldeia conquistada.** Ambos sao
marcador colorido com numero em cima; num turno cheio ha uns quinze escudos no
mapa. Confunde quem assiste (e confundiu o Lucas contando aldeias). Corrigir
antes da gravacao de verdade: o exercito deve parecer **carregado** (estandarte
inclinado numa haste) e a aldeia **fincada**.
