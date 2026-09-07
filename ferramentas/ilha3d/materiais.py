# materiais.py — uma fotografia aérea vira os materiais do terreno.
#
#   python ferramentas/ilha3d/materiais.py [origem.png]
#
# A IDEIA: o Blender não sabe pintar. Uma difusão não sabe iluminar. Então a
# imagem gerada entra aqui só como PELE — recorta-se dela uma zona por tipo de
# paisagem (mata, restolho, olival, planalto, rocha, ribeira) e cada zona vira
# um material repetível que o render2.py liga ao mapa de altura, declive e
# humidade. A luz é toda do render; da foto só vem a cor e o grão.
#
# POR QUE A FOTO TEM DE SER DE NUBLADO: se a zona recortada trouxer sombra
# assada, essa sombra repete-se em ladrilho por toda a ilha e briga com o sol do
# render. Duas iluminações no mesmo mapa é exatamente o defeito que este
# trabalho existe para eliminar.
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA = os.path.join(AQUI, "_saida", "materiais")
GALERIA = os.path.join(AQUI, "galeria")
RECEITA = os.path.join(AQUI, "materiais.json")
os.makedirs(SAIDA, exist_ok=True)
os.makedirs(GALERIA, exist_ok=True)

PASTA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "assets/estudos-mapa")


def repetivel(im, banda=0.16):
    """torna um recorte ladrilhável sem o deixar simétrico.

    Passo 1: desloca-se meia largura e meia altura. Isto põe as quatro bordas
    antigas a cruzar-se no meio — e as bordas NOVAS passam a ser o antigo
    interior, que já era contínuo consigo mesmo. O ladrilho fecha de graça.

    Passo 2: falta apagar a cruz que ficou no meio. A PRIMEIRA VERSÃO COSIA-A
    COM UM ESPELHO e o resultado foi um caleidoscópio: cada ladrilho ficava com
    uma borboleta ao centro, e ao repetir lia-se como papel de parede barato.
    Um espelho é a coisa mais visível que existe numa textura natural, porque na
    natureza não há nenhuma.

    Aqui a cruz é tapada com OUTRO PEDAÇO da mesma imagem (a própria, deslocada
    um terço), esbatido nas beiras. Continua a ser uma mistura, portanto a faixa
    fica ligeiramente mais macia que o resto — mas não tem simetria nenhuma, e
    fundido a meio caminho entre oito materiais isso não se vê.
    """
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    h, w = a.shape[:2]
    a = np.roll(np.roll(a, w // 2, axis=1), h // 2, axis=0)
    remendo = np.roll(np.roll(a, w // 3, axis=1), h // 4, axis=0)

    def vinco(n, centro, larg):
        d = np.abs(np.arange(n, dtype=np.float32) - centro) / max(larg, 1)
        t = np.clip(1.0 - d, 0.0, 1.0)
        return t * t * (3 - 2 * t)                    # suave nas duas pontas

    mx = vinco(w, w / 2, w * banda)[None, :]
    my = vinco(h, h / 2, h * banda)[:, None]
    m = np.maximum(mx, my)[..., None]
    a = a * (1 - m) + remendo * m
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def sem_sombra(im, raio=None, forca=0.85):
    """achata a iluminação do recorte: divide pela própria versão muito borrada.

    Uma foto de nublado ainda tem sombra de árvore e modelação de rocha. Isso é
    LUZ, não cor, e tem de sair antes de a imagem virar material — senão a mesma
    sombra aparece repetida em toda a ilha, vinda de um sol que não é o nosso.
    """
    raio = raio or max(im.size) // 6
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    luz = np.asarray(im.convert("RGB").filter(ImageFilter.GaussianBlur(raio)),
                     dtype=np.float32) / 255.0
    media = luz.mean(axis=(0, 1), keepdims=True)
    plano = a * (media / np.maximum(luz, 1e-3))
    return Image.fromarray(
        np.clip((a * (1 - forca) + plano * forca) * 255, 0, 255).astype(np.uint8))


def extrair(pasta, receita, lado=512):
    """receita = {nome: {"de": ficheiro, "caixa": [x, y, larg, alt]}}"""
    fontes, feitos = {}, []
    for nome, r in receita.items():
        de = r["de"]
        if de not in fontes:
            fontes[de] = Image.open(os.path.join(pasta, de)).convert("RGB")
        fonte = fontes[de]
        x, y, w, h = r["caixa"]
        corte = fonte.crop((x, y, x + w, y + h))
        corte = corte.resize((lado, lado), Image.LANCZOS)
        corte = repetivel(sem_sombra(corte))
        cam = os.path.join(SAIDA, nome + ".png")
        corte.save(cam)
        a = np.asarray(corte, dtype=np.float32)
        feitos.append((nome, cam, a.mean(axis=(0, 1)).round(1)))
    return feitos


def folha(feitos, nome="15_materiais.jpg"):
    """a prova: cada material ladrilhado 2x2, para a costura se ver ou não"""
    from PIL import ImageDraw, ImageFont
    L = 240
    cols = min(4, len(feitos))
    linhas = (len(feitos) + cols - 1) // cols
    f = Image.new("RGB", (cols * L, linhas * (L + 26)), (20, 24, 28))
    dr = ImageDraw.Draw(f)
    try:
        fonte = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 15)
    except Exception:
        fonte = None
    for i, (rot, cam, _) in enumerate(feitos):
        im = Image.open(cam).resize((L // 2, L // 2), Image.LANCZOS)
        x, y = (i % cols) * L, (i // cols) * (L + 26)
        for a in range(2):
            for b in range(2):
                f.paste(im, (x + a * L // 2, y + 26 + b * L // 2))
        dr.text((x + 8, y + 5), rot, fill=(240, 220, 150), font=fonte)
    cam = os.path.join(GALERIA, nome)
    f.save(cam, quality=94)
    return cam


if __name__ == "__main__":
    if not os.path.exists(RECEITA):
        print("falta a receita de recortes em", RECEITA)
        print('formato: {"mata": {"de": "textura-01.png", "caixa": [x, y, l, a]}}')
        raise SystemExit(1)
    receita = json.load(open(RECEITA, encoding="utf-8"))
    feitos = extrair(PASTA, receita)
    for nome, cam, media in feitos:
        print("%-12s %s  RGB medio %s" % (nome, os.path.basename(cam), media))
    print("folha:", folha(feitos))
