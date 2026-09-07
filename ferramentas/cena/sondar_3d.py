# sondar_3d.py — a SONDAGEM: as nossas peças saem do Blender como MALHA.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/sondar_3d.py -- [px_textura]
#
# ── O QUE ESTA SONDAGEM PERGUNTA ─────────────────────────────────────────────
# Uma coisa só, e é a única que decide o caminho C: **como fica a luz sem o
# Cycles?** O que faz as nossas peças parecerem bem não é a geometria — é serem
# renders com sombras por raio e oclusão ambiente calculadas. Em tempo real isso
# não existe de graça.
#
# Tudo o resto (triângulos, MB, quadros por segundo) mede-se de caminho e é
# barato de corrigir. A luz não é.
#
# ── POR QUE SAI UMA CENA E NÃO SEIS PEÇAS ────────────────────────────────────
# A pergunta do Lucas foi "tudo parecer parte do mesmo desenho". Seis peças
# soltas num fundo cinzento não respondem a isso. Sai uma aldeia POUSADA num
# chão, com uma estrada a chegar-lhe ao portão e mata à volta — as mesmas quatro
# camadas que hoje não conversam.
import json
import math
import os
import random
import sys
import time

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402
import cozer as C                                          # noqa: E402

ARGS = [a for a in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
        if a.isdigit()]
TEX_PX = int(ARGS[0]) if ARGS else 512
SAIDA = os.path.join(os.getcwd(), "sonda3d")
CIDADE = "toledo"
PERFIL = "media"

t0 = time.time()
os.makedirs(SAIDA, exist_ok=True)

# ── a aldeia, pelo MESMO construtor que faz o sprite ────────────────────────
# Se divergisse deste, a sondagem comparava duas coisas diferentes e não
# responderia a nada.
quadro = C.construir(PERFIL, cidade=CIDADE)
raio = C.PERFIS[PERFIL]["raio"]
rnd = random.Random(4)

# ── o chão ──────────────────────────────────────────────────────────────────
# Um quadrado grande de relva. No jogo de hoje isto é um PNG verde chapado; aqui
# é uma superfície que RECEBE sombra, que é metade do que falta ao mapa.
LADO = quadro * 1.9
bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=24,
                                size=LADO, location=(0, 0, -0.2))
chao = bpy.context.object
chao.name = "chao"
chao.data.materials.append(P.material("relva"))

# ── a estrada, a chegar ao portão ───────────────────────────────────────────
# Vai do primeiro portão para fora, no rumo em que ele aponta. É a ligação que
# no mapa de hoje é um polígono desenhado por cima e aqui é geometria pousada.
if P.PORTOES_CENA:
    bx, by, _bz, _rumo = P.PORTOES_CENA[0]
    ang = math.atan2(by, bx)
else:
    ang = math.radians(-64)
comp, larg = LADO * 0.52, 7.0
cx, cy = math.cos(ang), math.sin(ang)
d0 = raio + 8.0
verts, faces = [], []
N = 26
for i in range(N):
    t = i / (N - 1.0)
    d = d0 + comp * t
    w = larg * (0.5 + 0.10 * math.sin(t * 9.1) + 0.06 * math.sin(t * 21.3))
    px, py = cx * d, cy * d
    verts.append((px - cy * w, py + cx * w, -0.16))
    verts.append((px + cy * w, py - cx * w, -0.16))
for i in range(N - 1):
    faces.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
P._novo(P._malha("estrada", verts, faces, "caminho", bisel=0), "caminho")

# ── a mata ──────────────────────────────────────────────────────────────────
PINHEIROS = [P.proto_arvore(17.0, "folha", ((0.56, 0.78), (0.76, 0.58), (0.93, 0.32))),
             P.proto_arvore(13.0, "folha2", ((0.60, 0.80), (0.83, 0.50)))]
FOLHOSAS = [P.proto_arvore_folha(16.0, "folha2"), P.proto_arvore_folha(12.0, "folha3")]
postas = []
for i in range(90):
    for _ in range(60):
        a = rnd.random() * 2 * math.pi
        d = (raio + 22) + rnd.random() * (LADO * 0.42 - raio - 22)
        x, y = d * math.cos(a), d * math.sin(a)
        # nem em cima da estrada nem em cima de outra árvore — a mesma regra que
        # o `espalhar_mata.py` aprendeu a medir esta semana
        proj = x * cx + y * cy
        if proj > 0 and abs(-x * cy + y * cx) < larg * 0.5 + 6.0:
            continue
        if all((x - ox) ** 2 + (y - oy) ** 2 > 64 for ox, oy in postas):
            postas.append((x, y))
            break
    else:
        continue
    proto = (FOLHOSAS if rnd.random() < 0.4 else PINHEIROS)[i % 2]
    P.onde(proto, x, y, -0.2, rnd.random() * 6.3, 0.72 + rnd.random() * 0.55)

# ── tudo o que está na coleção dos protótipos tem de ir para a cena ─────────
# Os protótipos vivem fora do render de propósito. O exportador respeita isso e
# devolveria um ficheiro de 132 bytes — aconteceu, e a primeira medição não
# mediu nada. Aqui apagam-se, porque só as CÓPIAS interessam.
if P.LIXO:
    for ob in list(P.LIXO.objects):
        bpy.data.objects.remove(ob, do_unlink=True)

# ── as texturas descem ──────────────────────────────────────────────────────
# 2K é o que uma peça precisa para um render de perto; à escala do mapa uma
# tábua nunca ocupa mais de umas dezenas de píxeis. Medido: 7 conjuntos x 3
# mapas x 2048 = 352 MB em cru. A 512 são 22 MB, e é isso que o jogador carrega.
antes = sum(im.size[0] * im.size[1] * 4 for im in bpy.data.images if im.size[0])
for im in bpy.data.images:
    if im.size[0] > TEX_PX:
        im.scale(TEX_PX, TEX_PX)
depois = sum(im.size[0] * im.size[1] * 4 for im in bpy.data.images if im.size[0])
print("SONDA texturas: %d imagens, %.0f MB -> %.0f MB em cru"
      % (len(bpy.data.images), antes / 1e6, depois / 1e6))

# ── O ACHADO DA SONDAGEM, E VALE MAIS QUE OS NUMEROS ────────────────────────
# A primeira exportacao saiu com as copas BRANCAS. Nao e um erro do exportador:
# os nossos materiais sao GRAFOS DE NOS — a textura e mapeada por coordenada de
# OBJETO (a geometria nasce de caixas e cilindros e nunca foi desdobrada em UV),
# a cor sai de uma mistura em modo COLOR entre a nossa paleta e a luminancia da
# fotografia, e cada copia leva um tom seu vindo do `Object Info`.
#
# O glTF nao transporta nada disso. Transporta PBR: uma cor base, um mapa de
# cor com UV, rugosidade, normais. Tudo o que for no fica pelo caminho.
#
# Logo, o caminho C tem um passo que nao estava na conta: **desdobrar as pecas
# em UV e assar o material em mapas**. E o mesmo forno, feito uma vez por peca
# em vez de uma vez por sprite — mas e trabalho, e e melhor descobri-lo aqui.
#
# Para a sondagem responder aquilo a que veio — COMO FICA A LUZ — achata-se cada
# material na cor da paleta. Perde-se o detalhe fotografico e fica-se com a
# forma, a sombra e o tom: exatamente o que se quer julgar.
if os.environ.get("ACHATAR", "1") == "1":
    achatados = 0
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        cor = P.COR.get(m.name[2:], None)         # "M_relva" -> "relva"
        if cor is None:
            continue
        for lig in list(bsdf.inputs["Base Color"].links):
            m.node_tree.links.remove(lig)
        bsdf.inputs["Base Color"].default_value = cor
        achatados += 1
    print("SONDA %d materiais achatados na cor da paleta (ACHATAR=0 para nao)"
          % achatados)

tris = 0
for ob in bpy.context.scene.objects:
    if ob.type != "MESH":
        continue
    ob.data.calc_loop_triangles()
    tris += len(ob.data.loop_triangles)
print("SONDA cena: %d objetos, %d triangulos"
      % (len(bpy.context.scene.objects), tris))

alvo = os.path.join(SAIDA, "aldeia.glb")
bpy.ops.export_scene.gltf(filepath=alvo, export_format="GLB", export_apply=True,
                          export_yup=True, export_cameras=False, export_lights=False)

# ── e o SOL vai escrito ─────────────────────────────────────────────────────
# Sem isto o Three.js inventaria uma luz e a comparação não valia nada: metade
# do que faz as peças parecerem bem é a direção e a cor desta luz, que é a mesma
# de todos os sprites já assados.
elev, az = math.radians(30), 2.22 + math.radians(45)
with open(os.path.join(SAIDA, "cena.json"), "w", encoding="utf-8") as f:
    json.dump({
        "cidade": CIDADE, "perfil": PERFIL, "quadro_m": round(quadro, 1),
        "triangulos": tris, "textura_px": TEX_PX,
        "sol": {"elevacao_graus": 30, "azimute_rad": round(az, 4),
                "forca": 5.2, "cor": [1.0, 0.90, 0.74],
                # a direcao para onde a luz VIAJA, em coordenadas Y-para-cima
                # (o exportador roda a cena; a luz tem de rodar com ela)
                "direcao_yup": [round(-math.cos(elev) * math.cos(az), 4),
                                round(-math.sin(elev), 4),
                                round(math.cos(elev) * math.sin(az), 4)]},
        "camera_do_sprite": {"inclinacao_graus": 60, "giro_graus": 45,
                             "ortografica": True, "escala_m": round(quadro, 1)},
    }, f, indent=1)
print("SONDA %s  %.1f MB  em %.1f s"
      % (alvo, os.path.getsize(alvo) / 1e6, time.time() - t0))
