# escolher.py - procura os melhores recortes para ladrilho, por medicao.
#
#   python ferramentas/ilha3d/escolher.py
#
# POR QUE NAO A OLHO: os dois primeiros recortes que escolhi a olho tinham uma
# sebe em S e uma grelha de olival. Sao bonitos parados e desastrosos repetidos:
# uma feicao forte vira grelha assim que o ladrilho repete, e o olho apanha a
# grelha antes de apanhar o terreno. O que uma textura de ladrilho precisa e do
# contrario do que faz uma boa fotografia - nada de assunto, so materia.
#
# Duas medidas, por janela:
#   MANCHA  = desvio-padrao da versao muito borrada. Alto = ha uma feicao grande
#             (uma sebe, um campo claro, uma estrada). Queremos BAIXO.
#   GRAO    = desvio-padrao do que sobra depois de tirar o borrado. Alto = ha
#             textura fina. Queremos ALTO.
# A nota e grao / (mancha + k).
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
PASTA = os.path.join(RAIZ, "assets", "estudos-mapa")
GALERIA = os.path.join(AQUI, "galeria")

LADO = int(sys.argv[1]) if len(sys.argv) > 1 else 224
PASSO = 24

achados = []
for f in sorted(os.listdir(PASTA)):
    if not f.lower().endswith((".png", ".jpg", ".jpeg")):
        continue
    im = Image.open(os.path.join(PASTA, f)).convert("RGB")
    W, H = im.size
    borr = im.filter(ImageFilter.GaussianBlur(LADO // 7))
    a = np.asarray(im, dtype=np.float32)
    b = np.asarray(borr, dtype=np.float32)
    fino = a - b
    for y in range(0, H - LADO + 1, PASSO):
        for x in range(0, W - LADO + 1, PASSO):
            jb = b[y:y + LADO, x:x + LADO]
            jf = fino[y:y + LADO, x:x + LADO]
            mancha = float(jb.std())
            grao = float(jf.std())
            media = a[y:y + LADO, x:x + LADO].reshape(-1, 3).mean(0)
            achados.append(dict(de=f, caixa=[x, y, LADO, LADO], mancha=mancha,
                                grao=grao, nota=grao / (mancha + 6.0),
                                media=media,
                                verde=float(media[1] - (media[0] + media[2]) / 2),
                                luz=float(media.mean())))

achados.sort(key=lambda d: -d["nota"])
print("janelas medidas:", len(achados))

# PRIMEIRO agrupar por COR, depois escolher a mais homogenea de cada grupo.
# A primeira versao ordenava tudo pela nota e ficava com oito variacoes do mesmo
# tom: as mais homogeneas da imagem toda sao todas mato seco, porque campo tem
# beira e mata tem tufo. Sem agrupar por cor, a paleta colapsa.
n = 8
X = np.array([[(d["media"][0] - d["media"][1]) * 3.0,
               (d["media"][1] - d["media"][2]) * 1.6,
               d["luz"] * 0.55] for d in achados], dtype=np.float32)
rng = np.random.default_rng(3)
C = X[rng.choice(len(X), n, replace=False)].copy()
for _ in range(40):                                   # k-medias, simples
    dist = ((X[:, None, :] - C[None, :, :]) ** 2).sum(2)
    quem = dist.argmin(1)
    for k in range(n):
        if (quem == k).any():
            C[k] = X[quem == k].mean(0)
escolhidos = []
for k in range(n):
    grupo = [d for d, q in zip(achados, quem) if q == k]
    if grupo:
        escolhidos.append(min(grupo, key=lambda d: d["mancha"]))
escolhidos.sort(key=lambda d: d["media"][0] - d["media"][1])

L = 210
folha = Image.new("RGB", (4 * L, ((n + 3) // 4) * (L + 34)), (20, 24, 28))
dr = ImageDraw.Draw(folha)
try:
    fonte = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 13)
except Exception:
    fonte = None
src = {}
for i, d in enumerate(escolhidos):
    if d["de"] not in src:
        src[d["de"]] = Image.open(os.path.join(PASTA, d["de"])).convert("RGB")
    x, y, w, hh = d["caixa"]
    im = src[d["de"]].crop((x, y, x + w, y + hh)).resize((L, L), Image.LANCZOS)
    cx, cy = (i % 4) * L, (i // 4) * (L + 34)
    folha.paste(im, (cx, cy + 34))
    dr.text((cx + 6, cy + 3), "%d  %s %d,%d" % (i, d["de"][-6:-4], x, y),
            fill=(240, 220, 150), font=fonte)
    dr.text((cx + 6, cy + 18), "verde %+.1f  mancha %.1f  grao %.1f"
            % (d["verde"], d["mancha"], d["grao"]), fill=(170, 180, 190), font=fonte)
cam = os.path.join(GALERIA, "18_escolha_medida.jpg")
folha.save(cam, quality=94)
print("folha:", cam)
for i, d in enumerate(escolhidos):
    print('%d  {"de": "%s", "caixa": %s}   verde %+.1f mancha %.1f grao %.1f'
          % (i, d["de"], d["caixa"], d["verde"], d["mancha"], d["grao"]))
