# comparar.py — a ilha de hoje ao lado da ilha nova, sobre o mar do jogo.
#
#   python ferramentas/ilha3d/comparar.py <render.png> <nome.jpg>
#
# É a única prova que interessa: sozinho, qualquer render parece bom.
import os
import sys

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
GALERIA = os.path.join(AQUI, "galeria")

NOVO = sys.argv[1]
NOME = sys.argv[2] if len(sys.argv) > 2 else "comparacao.jpg"
LARG = 900

agua = Image.open(os.path.join(RAIZ, "assets/agua-textura.png")).convert("RGB")


def sobre_agua(cam, larg):
    im = Image.open(cam).convert("RGBA")
    w, h = im.size
    f = Image.new("RGB", (w, h))
    for y in range(0, h, agua.size[1]):
        for x in range(0, w, agua.size[0]):
            f.paste(agua, (x, y))
    f = Image.blend(f, Image.new("RGB", (w, h), (40, 86, 96)), 0.25)
    f.paste(im, (0, 0), im)
    return f.resize((larg, int(h * larg / w)), Image.LANCZOS)


painéis = [
    ("o jogo hoje  —  assets/ilha-recortada.png",
     os.path.join(RAIZ, "assets/ilha-recortada.png")),
    ("proposta  —  terreno desenhado + luz e materiais no Blender", NOVO),
]
ims = [(rot, sobre_agua(cam, LARG)) for rot, cam in painéis]
w, h = ims[0][1].size
folha = Image.new("RGB", (w, (h + 30) * len(ims)), (14, 18, 22))
dr = ImageDraw.Draw(folha)
try:
    fonte = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 19)
except Exception:
    fonte = ImageFont.load_default()
for i, (rot, im) in enumerate(ims):
    folha.paste(im, (0, i * (h + 30) + 30))
    dr.text((12, i * (h + 30) + 6), rot, fill=(240, 220, 150), font=fonte)
destino = os.path.join(GALERIA, NOME)
folha.save(destino, quality=93)
print(destino, folha.size)
