# preparar_texturas.py — arruma uma textura descarregada num formato previsível.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/preparar_texturas.py -- <familia> <ficheiro.zip>
#
# POR QUE ESTA PEÇA EXISTE: cada sítio nomeia os mapas à sua maneira —
# `_diff_`, `_Color`, `_albedo`, `_basecolor` são todos a mesma coisa — e cada
# descarga vem na resolução e no formato que calhou. Se o código dos materiais
# tiver de adivinhar isso, parte à primeira textura que venha de outro sítio.
# Aqui converte-se UMA VEZ para um nome só:
#
#     assets/texturas/<familia>/cor.jpg
#     assets/texturas/<familia>/rugosidade.png
#     assets/texturas/<familia>/normal.png
#     assets/texturas/<familia>/altura.png
#
# E baixa-se para 2K. O 4K que o Lucas descarregou tem 83 MB e o normal sozinho
# são 35 MB de EXR; à distância a que vemos uma casa, 2K não se distingue de 4K
# e carrega em segundos onde o outro enche a memória da placa.
#
# Corre no Blender e não em Python puro porque o EXR precisa de quem o saiba
# ler, e o Blender já o traz.
import os
import shutil
import sys
import tempfile
import zipfile

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(ARGS) < 2:
    print("SONDA uso: -- <familia> <ficheiro.zip ou pasta>")
    raise SystemExit(1)
FAMILIA, ORIGEM = ARGS[0], ARGS[1]
LADO = int(ARGS[2]) if len(ARGS) > 2 else 2048

RAIZ = os.getcwd()
DESTINO = os.path.join(RAIZ, "assets", "texturas", FAMILIA)
os.makedirs(DESTINO, exist_ok=True)

# o que cada mapa se chama por esse mundo fora
PISTAS = [
    ("cor", ("_diff", "_color", "_albedo", "_basecolor", "_col_")),
    ("rugosidade", ("_rough", "_roughness")),
    ("normal", ("_nor_gl", "_normalgl", "_nor_", "_normal")),
    ("altura", ("_disp", "_displacement", "_height", "_bump")),
]
IGNORAR = ("_ao", "ambientocclusion", "_arm", "_spec", "_metal", "_idmap", "_preview")


def familia_do_mapa(nome):
    n = nome.lower()
    if any(k in n for k in IGNORAR):
        return None
    for alvo, chaves in PISTAS:
        if any(k in n for k in chaves):
            return alvo
    return None


origem = os.path.join(RAIZ, ORIGEM) if not os.path.isabs(ORIGEM) else ORIGEM
tmp = None
if zipfile.is_zipfile(origem):
    tmp = tempfile.mkdtemp(prefix="tex_")
    with zipfile.ZipFile(origem) as z:
        z.extractall(tmp)
    pasta = tmp
else:
    pasta = origem

achados = {}
for raiz, _dirs, ficheiros in os.walk(pasta):
    for f in ficheiros:
        if not f.lower().endswith((".jpg", ".jpeg", ".png", ".exr", ".tif", ".tiff")):
            continue
        alvo = familia_do_mapa(f)
        if alvo and alvo not in achados:
            achados[alvo] = os.path.join(raiz, f)

if "cor" not in achados:
    print("SONDA nao encontrei o mapa de COR em", origem)
    print("SONDA ficheiros vistos:", sorted(os.listdir(pasta))[:12])
    raise SystemExit(1)

cena = bpy.context.scene
cena.render.image_settings.color_mode = "RGB"
escritos = []
for alvo, caminho in sorted(achados.items()):
    im = bpy.data.images.load(caminho)
    # O ESPAÇO DE COR PRIMEIRO, A ESCALA DEPOIS. Mexer no espaço de cor faz o
    # Blender RECARREGAR a imagem do disco, e isso deita fora o resultado de um
    # `scale()` anterior — foi assim que a primeira versão gravou 4K a dizer que
    # tinha reduzido para 2K. A cor é a única que quer sRGB; as outras são DADOS
    # e não podem levar correção de gama, senão a rugosidade e o relevo saem
    # errados de uma forma que só se nota quando a luz bate de lado.
    if alvo == "cor":
        im.colorspace_settings.name = "sRGB"
        cena.render.image_settings.file_format = "JPEG"
        cena.render.image_settings.quality = 92
        ext = ".jpg"
    else:
        im.colorspace_settings.name = "Non-Color"
        cena.render.image_settings.file_format = "PNG"
        cena.render.image_settings.color_depth = "8"
        ext = ".png"
    w, h = im.size
    if max(w, h) > LADO:
        k = LADO / max(w, h)
        im.scale(int(w * k), int(h * k))
    saida = os.path.join(DESTINO, alvo + ext)
    im.save_render(filepath=saida)
    escritos.append("%s %dx%d -> %s (%.1f MB)"
                    % (alvo, im.size[0], im.size[1], os.path.basename(saida),
                       os.path.getsize(saida) / 1e6))
    bpy.data.images.remove(im)

if tmp:
    shutil.rmtree(tmp, ignore_errors=True)
print("SONDA familia '%s' pronta em %s" % (FAMILIA, DESTINO))
for linha in escritos:
    print("SONDA   " + linha)
faltam = [a for a, _ in PISTAS if a not in achados]
if faltam:
    print("SONDA   (sem %s — o padrao gerado por codigo cobre esses)" % ", ".join(faltam))
