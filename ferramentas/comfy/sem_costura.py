# sem_costura.py -- torna uma imagem gerada numa textura que se repete sem costura.
#
#   python ferramentas/comfy/sem_costura.py entrada.png saida.png [largura_da_mistura]
#
# O SDXL gera uma imagem que NAO se repete: as bordas nao casam. O ComfyUI base
# nao tem no de "tiling", entao faz-se depois: desloca-se a imagem meio lado (as
# costuras vao para o meio, em cruz) e cobre-se essa cruz com a imagem ORIGINAL
# (que ali e continua), com uma mascara suave de ruido -- a transicao nao fica
# uma linha reta. As bordas finais sao as do meio da original: continuas.
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ent, sai = sys.argv[1], sys.argv[2]
L = float(sys.argv[3]) if len(sys.argv) > 3 else 0.22

a = np.asarray(Image.open(ent).convert("RGB"), dtype=np.float32)
H, W = a.shape[:2]
b = np.roll(a, (H // 2, W // 2), (0, 1))          # costuras em cruz, no meio
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
dx = np.abs(xx - W / 2) / W
dy = np.abs(yy - H / 2) / H
r = np.random.default_rng(3).random((H // 32 + 2, W // 32 + 2)).astype(np.float32)
ruido = ndimage.zoom(r, (H / r.shape[0], W / r.shape[1]), order=3)[:H, :W]
d = np.minimum(dx, dy) + (ruido - 0.5) * 0.06
m = np.clip(1.0 - d / L, 0.0, 1.0)
m = m * m * (3 - 2 * m)
c = b * (1 - m[..., None]) + a * m[..., None]
Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).save(sai)
print("sem costura:", sai, "%dx%d" % (W, H))
