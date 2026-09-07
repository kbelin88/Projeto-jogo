# mapas.py — prepara o que o Blender precisa para dar RELEVO E LUZ à ilha.
#
#   python ferramentas/ilha3d/mapas.py [rocha_corte] [rocha_ganho] [cristas]
#
# A ideia: não redesenhar a Ibéria. A pintura que já existe é boa — o que lhe
# falta é sol e sombra. Extraímos dela um mapa de alturas (onde a pintura diz
# "serra", o terreno sobe) e devolvemos a mesma pintura como cor base. O Blender
# só acrescenta a luz. O contorno é o do próprio PNG, portanto o encaixe no jogo
# (escala 1.17613 ancorada no topo) não muda em nada.
#
# A LIÇÃO DAS DUAS PRIMEIRAS PASSAGENS: a serra tem de ser ESTREITA. Com a
# máscara de rocha larga (52% da ilha) o terreno inteiro fica encrespado e
# parece papel amassado; a planície tem de ficar mesmo plana, e só as cordilheiras
# é que ganham cristas.
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA = os.path.join(AQUI, "_saida")
os.makedirs(SAIDA, exist_ok=True)

A = sys.argv[1:]
ROCHA_CORTE = float(A[0]) if len(A) > 0 else 0.55   # a partir de onde conta como serra
ROCHA_GANHO = float(A[1]) if len(A) > 1 else 3.0    # quão depressa a serra sobe
CRISTAS = float(A[2]) if len(A) > 2 else 0.70       # quanto do ruído é crista

FONTE_COR = "assets/ilha-recortada-v2.png"          # a versão já corrigida de cor
ilha = Image.open(os.path.join(RAIZ, FONTE_COR)).convert("RGBA")
W, H = ilha.size
rgb = np.array(ilha.convert("RGB"), dtype=np.float32) / 255.0
alfa = np.array(ilha)[..., 3].astype(np.float32) / 255.0


def borrar(a, r):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0


# 1. distância à costa: perto do mar fica baixo, no interior sobe
dist = np.zeros_like(alfa)
for r in (4, 9, 18, 34, 60, 96):
    dist += borrar(alfa, r)
dist = np.clip(dist / dist.max(), 0, 1) ** 0.75

# 2. A ESTRUTURA VEM DA PINTURA, não de ruído.
# As três primeiras tentativas punham ruído isotrópico por cima e o resultado
# eram bolhas — mas cordilheira é LINHA, não bolha. E a pintura já tem as serras
# desenhadas: os Pirenéus, o Sistema Central, a Serra Morena estão lá como
# estrias castanhas. Então a altura passa a seguir a própria pintura, com pouco
# borrão para não perder a forma das estrias, e o ruído fica só para textura
# fina de superfície.
vmv = rgb[..., 1] - rgb[..., 0]
lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
bruta = np.clip((0.06 - vmv) / 0.16, 0, 1) * 0.75 + np.clip((lum - 0.42) / 0.30, 0, 1) * 0.45
bruta = np.clip(bruta, 0, 1)
# borrão CURTO: mantém a estria; o borrão longo era o que virava tudo mancha
serra = borrar(bruta, 2.2)
serra = np.clip((serra - ROCHA_CORTE) * ROCHA_GANHO, 0, 1)
# realça a espinha da estria: o que já é alto sobe mais, o resto fica planície
serra = serra ** 1.6
serra_larga = borrar(serra, 14)          # o corpo da cordilheira
serra = np.clip(serra * 0.65 + serra_larga * 0.55, 0, 1)

# 3. ruído fino, só para a superfície não ser lisa de plástico
rng = np.random.default_rng(7)                      # semente fixa: reproduzível
fino = np.zeros((H, W), dtype=np.float32)
peso = 0.0
for cel, amp in ((17, 1.0), (8, 0.55), (4, 0.28)):
    g = rng.random((H // cel + 2, W // cel + 2)).astype(np.float32)
    g = np.array(Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC),
                 dtype=np.float32) / 255.0
    fino += g * amp
    peso += amp
fino = fino / peso

# 4. a altura: corpo da ilha + cordilheiras da pintura + textura fina
altura = dist * 0.34                                 # o corpo, suave
altura += dist * serra * 1.25 * (0.75 + 0.25 * fino)  # as cordilheiras
altura += dist * fino * 0.05 * CRISTAS               # a textura da superfície
# a falésia: uma orla estreita que sobe depressa, para a costa ter aresta
orla = np.clip((borrar(alfa, 7) - 0.35) / 0.5, 0, 1) * alfa
altura = np.maximum(altura, orla * 0.11)
altura = borrar(altura, 1.4) * alfa
altura = np.clip(altura / max(altura.max(), 1e-6), 0, 1)

rocha = serra                                        # para o relatório

Image.fromarray((altura * 65535).astype(np.uint16)).save(os.path.join(SAIDA, "altura.png"))
Image.fromarray((rgb * 255).astype(np.uint8)).save(os.path.join(SAIDA, "cor.png"))
Image.fromarray((alfa * 255).astype(np.uint8)).save(os.path.join(SAIDA, "alfa.png"))

dentro = alfa > 0.5
print("corte %.2f ganho %.1f cristas %.2f | serra = %.1f%% da ilha | altura media %.3f"
      % (ROCHA_CORTE, ROCHA_GANHO, CRISTAS,
         100 * (rocha[dentro] > 0.4).mean(), altura[dentro].mean()))
