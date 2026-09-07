# terreno.py — o mapa de alturas da Ibéria, DESENHADO, não deduzido.
#
#   python ferramentas/ilha3d/terreno.py
#
# POR QUE ASSIM: as tentativas anteriores tiravam a altura da pintura, com ruído
# por cima, e davam sempre a mesma coisa — papel amassado. O problema é de forma:
# cordilheira é uma LINHA e ruído isotrópico só sabe fazer bolhas. Aqui há três
# camadas, e cada uma existe por um motivo:
#
#   1. A MESETA. A Ibéria é um planalto alto (~700 m) com planície só na orla.
#      Sem isto a ilha fica com serras a nascer do nível do mar, que é Nepal.
#   2. AS SERRAS, traçadas como polilinhas ancoradas nas cidades do jogo. Cada
#      uma tem crista estreita MAIS encosta larga: uma serra sem encosta é um
#      arame, e foi exatamente isso que saiu da primeira versão.
#   3. OS RIOS. Sem eles o planalto é uma chapa cinzenta. Douro, Tejo, Guadiana,
#      Guadalquivir e Ebro cavam vales, e é isso que faz o interior ler-se como
#      terreno em vez de mesa. É também a única camada que EXPLICA a meseta: um
#      planalto reconhece-se pelos vales que o cortam, não pela altura.
#
# A sinuosidade vem de DEFORMAR O DOMÍNIO (torcer o espaço antes de medir a
# distância), não de somar ruído à distância. Somar à distância abre buracos na
# crista — a serra desaparece aos pedaços; deformar o domínio dobra a serra
# inteira sem a partir.
#
# Coordenadas: as cidades vivem no viewBox do jogo; o PNG da ilha converte-se com
#   pixel = (coord - 130) / 1.17613
# que é o encaixe cravado no index.html e não pode mudar.
import json
import os
import subprocess

import numpy as np
from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA = os.path.join(AQUI, "_saida")
GALERIA = os.path.join(AQUI, "galeria")
os.makedirs(SAIDA, exist_ok=True)
os.makedirs(GALERIA, exist_ok=True)

ESC, OX, OY = 1.17613, 130.0, 144.0
ilha = Image.open(os.path.join(RAIZ, "assets/ilha-recortada.png")).convert("RGBA")
W, H = ilha.size
alfa = np.array(ilha)[..., 3].astype(np.float32) / 255.0

CID = json.loads(subprocess.run(
    ["node", "-e", "const W=require('./world-iberia.js');"
     "console.log(JSON.stringify(Object.fromEntries(W.CIDADES.map(c=>[c.id,[c.x,c.y]]))))"],
    capture_output=True, text=True, check=True, cwd=RAIZ).stdout)


def px(nome, dx=0.0, dy=0.0):
    """cidade -> pixel do PNG, com desvio em pixels (o traço raramente passa
    exatamente por cima da cidade)"""
    x, y = CID[nome]
    return ((x - OX) / ESC + dx, (y - OY) / ESC + dy)


# ---- as serras --------------------------------------------------------------
# (nome, pontos, largura da CRISTA, altura 0-1, quão larga é a encosta)
SERRAS = [
    ("pirineus",   [px("pamplona", -30, -34), px("pamplona", 40, -46),
                    px("huesca", 30, -40), px("girona", -60, -34),
                    px("girona", 10, -14)],                       26, 1.00, 6.0),
    ("cantabrica", [px("vigo", 30, -18), px("burgos", -120, -54),
                    px("burgos", -10, -58), px("pamplona", -60, -26)], 21, 0.66, 5.6),
    ("iberico",    [px("burgos", 40, 26), px("zaragoza", -80, 60),
                    px("teruel", -30, -30), px("teruel", 20, 46),
                    px("valencia", -60, 10)],                     19, 0.58, 5.2),
    ("central",    [px("coimbra", 60, 40), px("salamanca", 10, 60),
                    px("madrid", -110, 34), px("madrid", 6, 46)],  21, 0.68, 5.6),
    ("estrela",    [px("coimbra", 20, 0), px("coimbra", 62, 44)],  15, 0.46, 4.5),
    ("toledo",     [px("badajoz", 78, 8), px("toledo", -70, 26),
                    px("toledo", 44, 20)],                        14, 0.38, 4.2),
    ("morena",     [px("badajoz", 30, 74), px("cordoba", -80, 34),
                    px("cordoba", 44, 6)],                        17, 0.50, 4.9),
    ("nevada",     [px("sevilha", 120, 44), px("cordoba", 60, 62),
                    px("murcia", -90, 48)],                       17, 0.80, 4.5),
    ("betica",     [px("murcia", -40, 22), px("murcia", 34, -6)],  14, 0.44, 4.2),
]

# ---- os rios ----------------------------------------------------------------
# (nome, pontos da nascente à foz, largura do vale, quanto cava)
RIOS = [
    ("douro",        [px("burgos", -50, -6), px("salamanca", 30, -70),
                      px("salamanca", -70, -46), px("porto", 26, 6)],   34, 0.115),
    ("tejo",         [px("teruel", -70, -20), px("madrid", -20, 4),
                      px("toledo", -6, -14), px("santarem", 70, 20),
                      px("lisboa", 6, -14)],                            32, 0.120),
    ("guadiana",     [px("toledo", -30, 60), px("badajoz", 40, 6),
                      px("badajoz", -20, 40), px("faro", 46, -40)],     28, 0.090),
    ("guadalquivir", [px("cordoba", 30, -14), px("cordoba", -50, 22),
                      px("sevilha", 20, 8), px("sevilha", -30, 60)],    36, 0.130),
    ("ebro",         [px("burgos", 60, -40), px("pamplona", -30, 40),
                      px("zaragoza", 0, 10), px("tarragona", -60, 20)], 32, 0.115),
]


def borrar(a, r):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rng = np.random.default_rng(11)


def ruido(cel, oitavas=3):
    saida = np.zeros((H, W), dtype=np.float32)
    peso = 0.0
    for k in range(oitavas):
        c = max(2, int(cel / (2 ** k)))
        g = rng.random((H // c + 2, W // c + 2)).astype(np.float32)
        g = np.array(Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC),
                     dtype=np.float32) / 255.0
        saida += g * (0.5 ** k)
        peso += 0.5 ** k
    return saida / peso


# a deformação do domínio: dois campos que torcem o espaço. TODAS as serras e
# rios são medidos no espaço torcido, portanto dobram juntos — a geologia de uma
# região é uma só, e é isso que faz o mapa parecer feito e não sorteado.
TORCAO = 26.0
dx_gr = (ruido(90, 3) - 0.5) * 2 * TORCAO
dy_gr = (ruido(90, 3) - 0.5) * 2 * TORCAO
dx_md = (ruido(30, 3) - 0.5) * 2 * (TORCAO * 0.45)
dy_md = (ruido(30, 3) - 0.5) * 2 * (TORCAO * 0.45)
SX, SY = xx + dx_gr + dx_md, yy + dy_gr + dy_md       # espaço torcido, serras
RX, RY = xx + dx_md, yy + dy_md                       # torção curta, rios

n_gr = ruido(70)
n_med = ruido(24)
n_fino = ruido(9)


def distancia(pontos, X, Y):
    """menor distância de cada pixel à polilinha"""
    d = np.full((H, W), 1e9, dtype=np.float32)
    for i in range(len(pontos) - 1):
        ax, ay = pontos[i]
        bx, by = pontos[i + 1]
        vx, vy = bx - ax, by - ay
        L2 = max(vx * vx + vy * vy, 1e-6)
        t = np.clip(((X - ax) * vx + (Y - ay) * vy) / L2, 0.0, 1.0)
        d = np.minimum(d, np.hypot(X - (ax + t * vx), Y - (ay + t * vy)))
    return d


def serra(pontos, larg, encosta):
    """crista estreita + encosta larga.

    O peso está quase todo na ENCOSTA. Uma cordilheira vista de cima é sobretudo
    o seu pé: os Pirenéus têm poucos quilómetros de crista e cento e cinquenta de
    largura. A primeira versão pôs 70% do peso na crista e saíram nove arames.
    """
    d = distancia(pontos, SX, SY)
    crista = np.clip(1.0 - d / larg, 0.0, 1.0) ** 1.5
    pe = np.clip(1.0 - d / (larg * encosta), 0.0, 1.0) ** 2.2
    colo = 0.62 + 0.38 * np.clip((n_med - 0.18) / 0.62, 0, 1)   # a crista tem colos
    return np.clip(crista * 0.46 * colo + pe * 0.78, 0.0, 1.0)


def rio(pontos, larg, fundo):
    """vale em V largo, mais fundo perto do eixo"""
    d = distancia(pontos, RX, RY)
    return np.clip(1.0 - d / larg, 0.0, 1.0) ** 1.6 * fundo


# ---- 1. a meseta ------------------------------------------------------------
dist = np.zeros_like(alfa)
for r in (5, 12, 26, 50, 84, 130):
    dist += borrar(alfa, r)
dist = np.clip(dist / dist.max(), 0, 1)
planalto = np.clip((dist - 0.14) / 0.46, 0, 1) ** 0.85
altura = planalto * 0.30 + dist * 0.05
altura += planalto * (n_gr - 0.5) * 0.09              # ondulação larga do planalto
altura += planalto * np.clip(1.0 - yy / (H * 0.72), 0, 1) * 0.05   # norte mais alto

# ---- 2. as serras -----------------------------------------------------------
for nome, pontos, larg, alto, encosta in SERRAS:
    m = serra(pontos, larg, encosta)
    aspereza = 1.0 + 0.34 * (n_fino - 0.5) * np.clip(m * 2.4, 0, 1)
    altura = np.maximum(altura, altura * 0.55 + m * alto * aspereza)

# ---- 3. os rios cavam -------------------------------------------------------
vale = np.zeros((H, W), dtype=np.float32)
for nome, pontos, larg, fundo in RIOS:
    vale = np.maximum(vale, rio(pontos, larg, fundo))
altura = np.clip(altura - vale, 0.0, 1.0)

# ---- 4. a falésia da costa -------------------------------------------------
# A pintura antiga do jogo tem uma aresta escura a toda a volta e é metade da
# razão por que se lê bem; sem ela a ilha desmaia para dentro do mar. Aqui a
# terra MERGULHA nos últimos pixels em vez de esmorecer, e o material do render
# pinta essa faixa de rocha por ser a mais inclinada de toda a ilha.
costa = 1.0 - np.clip((borrar(alfa, 13) - 0.50) / 0.30, 0, 1)
costa = np.clip(costa, 0, 1) * alfa
altura = altura * (1.0 - costa * 0.80) + costa * 0.015
orla = np.clip((borrar(alfa, 14) - 0.50) / 0.34, 0, 1)
altura = np.maximum(altura, orla * 0.10)
altura += (n_fino - 0.5) * 0.010                      # grão de superfície
altura = borrar(np.clip(altura, 0, 1), 1.2) * alfa
altura = np.clip(altura / max(altura.max(), 1e-6), 0, 1)

Image.fromarray((altura * 65535).astype(np.uint16)).save(os.path.join(SAIDA, "altura.png"))
Image.fromarray((alfa * 255).astype(np.uint8)).save(os.path.join(SAIDA, "alfa.png"))
Image.fromarray((costa ** 0.85 * 255).astype(np.uint8)).save(os.path.join(SAIDA, "costa.png"))
Image.fromarray((np.clip(altura, 0, 1) ** 0.75 * 255).astype(np.uint8)).save(
    os.path.join(GALERIA, "04_altura_desenhada.png"))

# ---- 5. onde ficam as arvores e as pedras -----------------------------------
# Mapas de DENSIDADE, para o render espalhar objetos a serio em vez de pintar
# uma mancha verde. Sao calculados aqui, em numpy, e nao no sombreador, porque
# quem os le e o sistema de particulas do Blender, que precisa de uma imagem.
uu = xx / W
vv = 1.0 - yy / H                                  # cresce para NORTE
humid = np.maximum(np.clip((vv - 0.28) / 0.56, 0, 1),
                   np.clip((0.44 - uu) / 0.32, 0, 1)
                   * np.clip((vv - 0.30) / 0.38, 0, 1))
humid = np.clip(humid + (ruido(60, 4) - 0.5) * 0.55, 0, 1)

# a mata: onde chove, abaixo do limite das arvores, e nunca na rocha nua
mata = humid ** 1.25
mata = mata * np.clip(1.0 - (altura - 0.62) / 0.24, 0, 1)      # limite das arvores
mata = mata * np.clip((ruido(26, 4) - 0.30) / 0.42, 0, 1) ** 0.8   # bosques, nao tapete
mata = np.clip(mata, 0, 1) * alfa * (1.0 - costa)

# as pedras: no alto, e mais onde ha declive
gy, gx = np.gradient(altura * 260.0)
decl = np.clip(np.hypot(gx, gy) / 2.2, 0, 1)
pedras = np.clip((altura - 0.42) / 0.34, 0, 1) * (0.35 + 0.65 * decl)
pedras = np.clip(pedras * (ruido(18, 4) * 1.4), 0, 1) * alfa

Image.fromarray((mata * 255).astype(np.uint8)).save(os.path.join(SAIDA, "d_mata.png"))
Image.fromarray((pedras * 255).astype(np.uint8)).save(os.path.join(SAIDA, "d_pedras.png"))

dentro = alfa > 0.5
a = altura[dentro]
print("altura: media %.3f | >0,5: %.1f%% | >0,25: %.1f%% | %d serras, %d rios"
      % (a.mean(), 100 * (a > 0.5).mean(), 100 * (a > 0.25).mean(), len(SERRAS), len(RIOS)))
print("mata cobre %.1f%% da ilha | pedras %.1f%%"
      % (100 * (mata[dentro] > 0.35).mean(), 100 * (pedras[dentro] > 0.35).mean()))
