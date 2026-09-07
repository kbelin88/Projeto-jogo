# espalhar_mata.py — decide ONDE ficam os bosques, uma vez, fora do jogo.
#
#   python ferramentas/cena/espalhar_mata.py [quantos]
#
# ── POR QUE FORA DO JOGO ─────────────────────────────────────────────────────
# Espalhar por rejeição — sortear um ponto, ver se calha em floresta, se não
# calhar sortear outro — é barato uma vez e caro sessenta vezes por segundo. E
# se fosse sorteado a cada carregamento, a mata mudava de sítio entre partidas e
# entre o jogo e o vídeo. Aqui decide-se uma vez, grava-se, e o mapa é sempre o
# mesmo mapa.
#
# ── DE ONDE VEM A DENSIDADE ──────────────────────────────────────────────────
# Do `d_mata.png` que o `terreno.py` escreve: húmido, abaixo do limite das
# árvores, e com bosques em vez de tapete. É o MESMO campo que decidiu onde o
# render da ilha pôs mata — portanto os bosques do jogo caem onde a ilha já é
# escura, e não em cima de uma planície amarela.
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image

RAIZ = os.getcwd()
QUANTOS = int(sys.argv[1]) if len(sys.argv) > 1 else 360
ESC, OX, OY = 1.17613, 130.0, 144.0          # pixel da ilha -> viewBox do jogo

dens = np.asarray(Image.open(os.path.join(
    RAIZ, "ferramentas/ilha3d/_saida/d_mata.png")).convert("L"),
    dtype=np.float32) / 255.0
alfa = np.asarray(Image.open(os.path.join(
    RAIZ, "assets/ilha-recortada.png")).convert("RGBA"))[..., 3] / 255.0
H, W = dens.shape

M = json.loads(subprocess.run(
    ["node", "-e", "const W=require('./world-iberia.js');console.log(JSON.stringify("
     "{c:W.CIDADES.map(c=>[c.x,c.y]),e:W.ESTRADAS.map(e=>[e.de,e.para]),"
     "p:Object.fromEntries(W.CIDADES.map(c=>[c.id,[c.x,c.y]]))}))"],
    capture_output=True, text=True, check=True, cwd=RAIZ).stdout)
CID = [((x - OX) / ESC, (y - OY) / ESC) for x, y in M["c"]]
VIAS = [(((M["p"][a][0] - OX) / ESC, (M["p"][a][1] - OY) / ESC),
         ((M["p"][b][0] - OX) / ESC, (M["p"][b][1] - OY) / ESC))
        for a, b in M["e"] if a in M["p"] and b in M["p"]]

# ── AS FOLGAS SAO CALCULADAS, NAO ESCOLHIDAS ────────────────────────────────
# Em 07/09 o Lucas marcou 16 arvores em cima de estradas. O filtro nao estava
# avariado: rejeitava tudo a menos de 11 px do eixo e a moita mais proxima
# ficou a 13,0 — fez exatamente o que lhe mandaram. O NUMERO e que estava
# errado, e por uma razao que se repete neste projeto: era uma constante
# escrita a mao a tentar adivinhar duas medidas que vivem noutro ficheiro.
#
# Nesse intervalo as estradas passaram de 0,30 para 0,70 de célula e as moitas
# de 1,55 para 1,95 — e os 11 px ficaram onde estavam. Duas coisas cresceram e
# a distancia entre elas nao.
#
# Agora a folga sai da SOMA de tres medidas, cada uma com a linha do
# `index.html` de onde vem. Se lá mudarem, muda-se AQUI e volta-se a correr.
# E a verificação no fim mede o que de facto ficou, para uma divergencia
# futura aparecer como número em vez de aparecer como marca vermelha.
CELULA_PX = (1429.0 / 108.0) / ESC   # px da ilha por célula (IB.larg/largCels)

MEIA_ESTRADA = 0.70 * 0.78 * 1.16    # base * passada mais larga * ondulação
SERPENTE = 0.22                      # o quanto a estrada foge da reta
MEIA_COPA = 1.95 / 2                 # largura desenhada da moita, por escala 1
RAIO_ALDEIA_CEL = 4.6 / 2            # a peça da capital, a maior das aldeias
MIN_ENTRE = 13.0                     # dois bosques encostados leem-se como um borrão


def folga_da_estrada(esc):
    """px da ilha entre o eixo da estrada e o centro de uma moita de escala `esc`"""
    return (MEIA_ESTRADA + SERPENTE + MEIA_COPA * esc) * CELULA_PX


def folga_da_aldeia(esc):
    return (RAIO_ALDEIA_CEL + MEIA_COPA * esc) * CELULA_PX


def dist_a_estrada(x, y):
    melhor = 1e9
    for (ax, ay), (bx, by) in VIAS:
        vx, vy = bx - ax, by - ay
        L2 = max(vx * vx + vy * vy, 1e-6)
        t = max(0.0, min(1.0, ((x - ax) * vx + (y - ay) * vy) / L2))
        melhor = min(melhor, math.hypot(x - (ax + t * vx), y - (ay + t * vy)))
    return melhor


rng = np.random.default_rng(7)
postos = []
tentativas = 0
while len(postos) < QUANTOS and tentativas < QUANTOS * 400:
    tentativas += 1
    x = float(rng.random() * W)
    y = float(rng.random() * H)
    i, j = int(x), int(y)
    if alfa[j, i] < 0.7:
        continue                                   # fora de terra
    if rng.random() > dens[j, i] ** 0.85:
        continue                                   # a densidade manda
    # O TAMANHO DECIDE-SE PRIMEIRO. A folga que uma moita precisa depende do
    # tamanho dela, e antes disto o tamanho era sorteado DEPOIS de ela ja estar
    # colocada — logo a folga so podia ser um valor unico para todas, e um
    # valor unico ou aperta as pequenas ou deixa passar as grandes.
    forte = float(dens[j, i])
    peso = rng.random() * 0.55 + forte * 0.45
    qual = min(5, int(peso * 6))
    esc = round(0.72 + 0.55 * peso, 3)

    if any((x - cx) ** 2 + (y - cy) ** 2 < folga_da_aldeia(esc) ** 2 for cx, cy in CID):
        continue
    if dist_a_estrada(x, y) < folga_da_estrada(esc):
        continue
    if any((x - px) ** 2 + (y - py) ** 2 < MIN_ENTRE ** 2 for px, py, _s, _e in postos):
        continue
    postos.append((x, y, qual, esc))

# de norte para sul: quem está mais a sul desenha-se por cima, senão um bosque
# do fundo tapa outro da frente
postos.sort(key=lambda p: p[1])
saida = [{"x": round(px * ESC + OX, 1), "y": round(py * ESC + OY, 1),
          "s": qual, "e": esc} for px, py, qual, esc in postos]
alvo = os.path.join(RAIZ, "assets", "sprites", "mata.json")
with open(alvo, "w", encoding="utf-8") as f:
    json.dump(saida, f, separators=(",", ":"))
print("SONDA %d bosques (%d tentativas) -> %s  %.1f KB"
      % (len(saida), tentativas, alvo, os.path.getsize(alvo) / 1024))
print("SONDA por tipo:", {k: sum(1 for p in postos if p[2] == k) for k in range(6)})

# ── A VERIFICACAO ───────────────────────────────────────────────────────────
# Mede o que ficou, e nao o que se pediu. A primeira versao desta ferramenta
# nao verificava nada e por isso 16 defeitos chegaram ao ecra do Lucas antes de
# alguem reparar. `sobra` negativa = copa por cima do leito da estrada.
pior = None
for px, py, _q, esc in postos:
    sobra = dist_a_estrada(px, py) - folga_da_estrada(esc)
    if pior is None or sobra < pior[0]:
        pior = (sobra, px, py, esc)
print("SONDA folga pedida: %.1f a %.1f px da ilha (conforme o tamanho da moita)"
      % (folga_da_estrada(0.72), folga_da_estrada(1.27)))
print("SONDA pior caso colocado: sobra %+.1f px em (%.0f, %.0f), escala %.2f"
      % pior)
if pior[0] < 0:
    print("SONDA ATENCAO: ha copa por cima de estrada. Isto NAO devia acontecer.")
