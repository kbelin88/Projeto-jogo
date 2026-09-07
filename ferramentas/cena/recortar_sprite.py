# recortar_sprite.py — corta o render ao alfa e regista onde ficou a ancora.
#
#   python ferramentas/cena/recortar_sprite.py assets/sprites/_bruto_aldeia_v4.png
#
# POR QUE ISTO E UM PASSO SEPARADO: o `bpy.types.Image` nao sabe recortar e o
# Python do Blender nao traz PIL garantidamente. Aqui, no Python do sistema, e
# uma linha.
#
# E POR QUE A ANCORA VAI NUM FICHEIRO: o jogo desenha o sprite pela BASE AO
# CENTRO. Depois de se cortar a moldura vazia, o centro da aldeia deixa de estar
# no meio da imagem. Se alguem tiver de medir isso a olho, sai do sitio — ja
# saiu tres vezes neste projeto. O render sabe onde esta o centro (e o meio
# exato do quadro, porque a camara ortografica aponta a origem); entao grava-se.
import json
import os
import sys

import numpy as np
from PIL import Image

BRUTO = sys.argv[1]
info = json.load(open(os.path.splitext(BRUTO)[0] + "_quadro.json", encoding="utf-8"))
DESTINO = sys.argv[2] if len(sys.argv) > 2 else info["destino"]

def sangrar_alfa(im, passos=8):
    """empurra a cor do interior para dentro da orla transparente.

    ── A ORLA BRANCA ("parece neve") ────────────────────────────────────────
    Num render com fundo transparente, um pixel meio coberto pela geometria
    recebe a cor do que estiver por tras — o CEU. Ele fica com alfa baixo, mas a
    sua cor e clara, e quando o jogo o desenha sobre relva verde essa cor
    aparece: uma auréola pálida a toda a volta da peça.
    Medido no sprite de Madrid: os píxeis com alfa entre 5% e 60% tinham
    luminância 150, contra 103 do interior opaco. Cinquenta por cento mais
    claros.
    A correção não mexe no alfa — mexe na COR por baixo dele. A cor sólida é
    empurrada para fora, camada a camada, e cada pixel da orla passa a ter a cor
    do vizinho opaco em vez da do céu. O recorte continua igual; o halo
    desaparece.
    """
    a = np.asarray(im).astype(np.float32)
    rgb, alfa = a[..., :3].copy(), a[..., 3]
    peso = (alfa > 230).astype(np.float32)
    cor = rgb * peso[..., None]
    for _ in range(passos):
        acc = np.zeros_like(cor)
        w = np.zeros_like(peso)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                acc += np.roll(np.roll(cor, dy, 0), dx, 1)
                w += np.roll(np.roll(peso, dy, 0), dx, 1)
        novo = (w > 0) & (peso == 0)
        if not novo.any():
            break
        cor[novo] = acc[novo] / w[novo][:, None]
        peso[novo] = 1.0
    a[..., :3] = np.where(peso[..., None] > 0, cor, rgb)
    return Image.fromarray(a.astype(np.uint8))


im = sangrar_alfa(Image.open(BRUTO).convert("RGBA"))
w, h = im.size
caixa = im.getbbox()
if caixa is None:
    print("SONDA o render saiu vazio")
    raise SystemExit(1)
x0, y0, x1, y1 = caixa
corte = im.crop(caixa)
larg, alt = corte.size

saida = {
    "ficheiro": os.path.basename(DESTINO),
    "largura": larg,
    "altura": alt,
    "metros_de_largura": info["metros_do_quadro"] * larg / w,
    # a ancora, em fracao do recorte. x medido da esquerda, y medido de BAIXO,
    # que e como o jogo pensa (assenta a peca pela base).
    "ancora_x": (w / 2.0 - x0) / larg,
    "ancora_y": 1.0 - (h / 2.0 - y0) / alt,
    "isometria": info["isometria"],
}
# OS MASTROS ACOMPANHAM O RECORTE. Vinham em pixeis da imagem BRUTA; aqui
# passam a fracao do recorte, que e o unico sistema que o jogo conhece — ele so
# sabe onde desenhou o sprite e que tamanho lhe deu.
mastros = []
for m in info.get("mastros", []):
    mx, my = m["x"] - x0, m["y"] - y0
    if -8 <= mx <= larg + 8 and -8 <= my <= alt + 8:
        mastros.append({"x": round(mx / larg, 4), "y": round(my / alt, 4),
                        "alt": round(m["alt_px"] / alt, 4)})
saida["mastros"] = mastros
bocas = []
for b in info.get("bocas", []):
    bx, by = b["x"] - x0, b["y"] - y0
    bocas.append({"x": round(bx / larg, 4), "y": round(by / alt, 4), "rumo": b["rumo"]})
saida["bocas"] = bocas
os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
corte.save(DESTINO)
with open(os.path.splitext(DESTINO)[0] + ".json", "w", encoding="utf-8") as f:
    json.dump(saida, f, indent=2, ensure_ascii=False)
os.remove(BRUTO)
os.remove(os.path.splitext(BRUTO)[0] + "_quadro.json")
print("SONDA sprite: %s  %dx%d  ancora (%.3f, %.3f)  %.0f m de largura"
      % (DESTINO, larg, alt, saida["ancora_x"], saida["ancora_y"],
         saida["metros_de_largura"]))
