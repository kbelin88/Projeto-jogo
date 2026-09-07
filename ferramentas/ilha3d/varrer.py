# varrer.py — corre várias afinações da ilha e junta tudo numa folha de
# contacto, para se escolher a olho em vez de por tentativa e erro.
#
#   python ferramentas/ilha3d/varrer.py
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

# (rotulo, corte da rocha, ganho, cristas, altura no render)
CASOS = [
    ("1  segue a pintura, relevo baixo",  0.42, 2.2, 0.6, 0.30),
    ("2  segue a pintura, relevo medio",  0.42, 2.2, 0.6, 0.44),
    ("3  serra mais seletiva",            0.55, 2.8, 0.6, 0.44),
    ("4  serra menos seletiva",           0.30, 1.8, 0.6, 0.44),
    ("5  seletiva, relevo alto",          0.55, 2.8, 0.6, 0.60),
    ("6  seletiva, sem textura fina",     0.55, 2.8, 0.0, 0.44),
]

ESCALA, AMOSTRAS = 0.55, 24
tiras = []
for i, (rot, corte, ganho, cristas, altura) in enumerate(CASOS, 1):
    print("[%d/%d] %s" % (i, len(CASOS), rot), flush=True)
    r = subprocess.run([sys.executable, os.path.join(AQUI, "mapas.py"),
                        str(corte), str(ganho), str(cristas)],
                       capture_output=True, text=True, cwd=RAIZ)
    print("   ", r.stdout.strip(), flush=True)
    env = dict(os.environ, ILHA_ALTURA=str(altura))
    subprocess.run([BLENDER, "-b", "--factory-startup", "-noaudio", "-P",
                    os.path.join(AQUI, "render.py"), "--", str(ESCALA), str(AMOSTRAS)],
                   capture_output=True, text=True, cwd=RAIZ, env=env)
    im = Image.open(os.path.join(SAIDA, "ilha_render.png")).convert("RGBA")
    im.save(os.path.join(GALERIA, "varredura_%d.png" % i))
    tiras.append((rot, im))

# folha de contacto, sobre o mar do jogo
agua = Image.open(os.path.join(RAIZ, "assets/agua-textura.png")).convert("RGB")


def sobre_agua(im, larg):
    w, h = im.size
    f = Image.new("RGB", (w, h))
    for y in range(0, h, agua.size[1]):
        for x in range(0, w, agua.size[0]):
            f.paste(agua, (x, y))
    f = Image.blend(f, Image.new("RGB", (w, h), (40, 86, 96)), 0.25)
    f.paste(im, (0, 0), im)
    return f.resize((larg, int(h * larg / w)), Image.LANCZOS)


L = 640
ims = [(rot, sobre_agua(im, L)) for rot, im in tiras]
w, h = ims[0][1].size
cols = 3
linhas = (len(ims) + cols - 1) // cols
folha = Image.new("RGB", (w * cols, (h + 28) * linhas), (14, 18, 22))
dr = ImageDraw.Draw(folha)
try:
    fonte = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 18)
except Exception:
    fonte = ImageFont.load_default()
for i, (rot, im) in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * (h + 28)
    folha.paste(im, (x, y + 28))
    dr.text((x + 10, y + 5), rot, fill=(240, 220, 150), font=fonte)
folha.save(os.path.join(GALERIA, "02_varredura_pintura.jpg"), quality=92)
print("folha:", os.path.join(GALERIA, "02_varredura_pintura.jpg"))
