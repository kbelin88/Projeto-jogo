# varrer_luz.py — escolhe a LUZ e o exagero do relevo a olho, não por palpite.
#
#   python ferramentas/ilha3d/varrer_luz.py
#
# O problema que isto resolve: com relevo muito exagerado e sol baixo, a sombra
# projetada de cada serra vira uma faixa preta larga e a ilha lê-se como fossos
# em vez de montanhas. Os dois parâmetros brigam entre si — mais relevo pede sol
# mais alto — e por isso têm de ser vistos juntos, na mesma folha.
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA = os.path.join(AQUI, "_saida")
GALERIA = os.path.join(AQUI, "galeria")
os.makedirs(GALERIA, exist_ok=True)
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"

# (rotulo, altura do relevo, sol: rad do zenite, forca do sol, forca do ceu)
CASOS = [
    ("1  relevo 0,85  sol 49o  ceu 0,6", 0.85, 0.86, 5.0, 0.62),
    ("2  relevo 0,55  sol 49o  ceu 0,6", 0.55, 0.86, 5.0, 0.62),
    ("3  relevo 0,55  sol 36o  ceu 1,2", 0.55, 0.62, 4.2, 1.20),
    ("4  relevo 0,55  sol 25o  ceu 1,2", 0.55, 0.44, 4.2, 1.20),
    ("5  relevo 0,40  sol 36o  ceu 1,2", 0.40, 0.62, 4.2, 1.20),
    ("6  relevo 0,70  sol 30o  ceu 1,6", 0.70, 0.52, 4.0, 1.60),
]
ESCALA, AMOSTRAS = 0.5, 20

tiras = []
for i, (rot, alt, sol, forca, ceu) in enumerate(CASOS, 1):
    print("[%d/%d] %s" % (i, len(CASOS), rot), flush=True)
    alvo = os.path.join(SAIDA, "luz_%d.png" % i)
    env = dict(os.environ, ILHA_ALTURA=str(alt), SOL_ALT=str(sol),
               SOL_FORCA=str(forca), CEU_FORCA=str(ceu), ILHA_SAIDA=alvo,
               ILHA_DENS="560")
    subprocess.run([BLENDER, "-b", "--factory-startup", "-noaudio", "-P",
                    os.path.join(AQUI, "render2.py"), "--", str(ESCALA), str(AMOSTRAS)],
                   capture_output=True, text=True, cwd=RAIZ, env=env)
    tiras.append((rot, Image.open(alvo).convert("RGBA")))

agua = Image.open(os.path.join(RAIZ, "assets/agua-textura.png")).convert("RGB")


def sobre_agua(im):
    w, h = im.size
    f = Image.new("RGB", (w, h))
    for y in range(0, h, agua.size[1]):
        for x in range(0, w, agua.size[0]):
            f.paste(agua, (x, y))
    f = Image.blend(f, Image.new("RGB", (w, h), (40, 86, 96)), 0.25)
    f.paste(im, (0, 0), im)
    return f


ims = [(rot, sobre_agua(im)) for rot, im in tiras]
w, h = ims[0][1].size
cols = 3
linhas = (len(ims) + cols - 1) // cols
folha = Image.new("RGB", (w * cols, (h + 28) * linhas), (14, 18, 22))
dr = ImageDraw.Draw(folha)
try:
    fonte = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 17)
except Exception:
    fonte = ImageFont.load_default()
for i, (rot, im) in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * (h + 28)
    folha.paste(im, (x, y + 28))
    dr.text((x + 10, y + 5), rot, fill=(240, 220, 150), font=fonte)
destino = os.path.join(GALERIA, "06_varredura_luz.jpg")
folha.save(destino, quality=92)
print("folha:", destino)
