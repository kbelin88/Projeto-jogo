# rolar.py -- prepara uma textura gerada para o SDXL lhe coser as costuras.
#
#   python ferramentas/comfy/rolar.py gerada.png rolada.png      (antes)
#   python ferramentas/comfy/rolar.py --fim cosida.png final.jpg  (depois)
#
# Desloca a imagem meio lado: as bordas (que nao casam) vao para o meio, em
# cruz, e as bordas novas sao o meio da original -- continuas. O canal alfa
# marca a cruz: o LoadImage do ComfyUI da mascara = 1 - alfa, e o fluxo
# `costura_sdxl.json` repinta SO ali (SetLatentNoiseMask). O resultado repete-se
# sem costura e sem a "imagem fantasma" de uma mistura.
# Com --fim, volta a deslocar (o centro da textura volta a ser o da original).
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

if sys.argv[1] == "--fim":
    a = np.asarray(Image.open(sys.argv[2]).convert("RGB"))
    H, W = a.shape[:2]
    Image.fromarray(np.roll(a, (H // 2, W // 2), (0, 1))).save(sys.argv[3], quality=94)
    print("final:", sys.argv[3])
    sys.exit(0)
a = np.asarray(Image.open(sys.argv[1]).convert("RGB"))
H, W = a.shape[:2]
b = np.roll(a, (H // 2, W // 2), (0, 1))
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
d = np.minimum(np.abs(xx - W / 2), np.abs(yy - H / 2))
LARG = W * 0.07
m = np.clip(1.0 - d / LARG, 0.0, 1.0)            # 1 = repintar
m = ndimage.gaussian_filter(m, 6)
alfa = (255 * (1.0 - m)).astype(np.uint8)
Image.fromarray(np.dstack([b, alfa]), "RGBA").save(sys.argv[2])
print("rolada:", sys.argv[2])
