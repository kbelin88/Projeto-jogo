# tex_prado_algarve.py - a erva do sul: a fotografia do prado, seca e dourada.
#
#   python ferramentas/cena/tex_prado_algarve.py
#     -> assets/texturas/prado_algarve/{cor.jpg,normal.png,rugosidade.png,altura.png}
#
# ── PORQUE (25/09) ──────────────────────────────────────────────────────────
# Na bancada da costa o campo saia um relvado verde-cheio. A primeira tentativa
# de o secar foi pela cor de vertice -- e nao passou: a cor de vertice e um BYTE,
# nao sobe de 1,0, e o "vermelho a 1,42" que amarelaria a relva ficou cortado.
# Sobre uma fotografia verde, so se pode escurecer. A mesma licao do glTF (ver
# CLAUDE.md, 7.3): o que tem de mudar, muda na IMAGEM.
#
# Parte da fotografia tratada do prado (`tex_prado.py`) e leva-a ao sul: matiz
# do verde para o amarelo-azeitona, menos saturacao, mais luz. A textura, o grao
# e o relevo ficam os da fotografia.
import os
import shutil

import numpy as np
from PIL import Image

RAIZ = os.getcwd()
DE = os.path.join(RAIZ, "assets", "texturas", "prado")
PARA = os.path.join(RAIZ, "assets", "texturas", "prado_algarve")

im = np.asarray(Image.open(os.path.join(DE, "cor.jpg")).convert("RGB")).astype(np.float32) / 255.0
lum = im @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
lum = lum / max(lum.mean(), 1e-6)                    # o claro-escuro da fotografia, em torno de 1

# a cor alvo: erva seca de fim de verao, amarelo-azeitona (e o verde fica para
# a cor de vertice, que so consegue escurecer -- escurecer o vermelho e o azul
# devolve o verde onde a regiao for humida)
seco = np.array([0.52, 0.47, 0.22], dtype=np.float32)
verde = np.array([0.30, 0.38, 0.14], dtype=np.float32)
# um pouco da cor original, para nao ficar chapado
orig = im / max(float(im.mean()), 1e-6) * float(seco.mean())
cor = (0.72 * seco + 0.12 * verde)[None, None, :] * lum[..., None] + 0.16 * orig
cor = np.clip(cor, 0.0, 1.0)

os.makedirs(PARA, exist_ok=True)
Image.fromarray((cor * 255).astype(np.uint8)).save(os.path.join(PARA, "cor.jpg"), quality=92)
for f in ("normal.png", "rugosidade.png", "altura.png"):
    if os.path.exists(os.path.join(DE, f)):
        shutil.copyfile(os.path.join(DE, f), os.path.join(PARA, f))
print("prado_algarve: media %s -> %s" % (np.round(im.reshape(-1, 3).mean(0), 3),
                                        np.round(cor.reshape(-1, 3).mean(0), 3)))
