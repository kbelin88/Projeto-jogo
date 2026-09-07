# mostrar.py — põe um render sobre o mar do JOGO e grava na galeria.
#
#   python ferramentas/ilha3d/mostrar.py <entrada.png> <nome_na_galeria> [rotulo]
#
# Existe porque olhar para o PNG com fundo transparente engana: metade dos
# defeitos de cor e de contorno só aparecem contra a água azul do jogo, que é o
# fundo que a ilha vai mesmo ter.
import os
import sys

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
GALERIA = os.path.join(AQUI, "galeria")
os.makedirs(GALERIA, exist_ok=True)

ENTRADA = sys.argv[1]
NOME = sys.argv[2]
ROTULO = sys.argv[3] if len(sys.argv) > 3 else ""

im = Image.open(ENTRADA).convert("RGBA")
w, h = im.size
agua = Image.open(os.path.join(RAIZ, "assets/agua-textura.png")).convert("RGB")
fundo = Image.new("RGB", (w, h))
for y in range(0, h, agua.size[1]):
    for x in range(0, w, agua.size[0]):
        fundo.paste(agua, (x, y))
fundo = Image.blend(fundo, Image.new("RGB", (w, h), (40, 86, 96)), 0.25)
fundo.paste(im, (0, 0), im)

if ROTULO:
    faixa = Image.new("RGB", (w, h + 30), (14, 18, 22))
    faixa.paste(fundo, (0, 30))
    dr = ImageDraw.Draw(faixa)
    try:
        fonte = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 18)
    except Exception:
        fonte = ImageFont.load_default()
    dr.text((10, 6), ROTULO, fill=(240, 220, 150), font=fonte)
    fundo = faixa

destino = os.path.join(GALERIA, NOME)
fundo.save(destino, quality=94)
print(destino, fundo.size)
