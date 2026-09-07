# cozer_mata.py — bosques em sprite, para o mapa deixar de ser um tapete.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/cozer_mata.py -- [lado_px] [amostras]
#
# ── POR QUE BOSQUES E NÃO ÁRVORES SOLTAS ─────────────────────────────────────
# Uma árvore sozinha, à escala do mapa, tem três píxeis: é um ponto verde e não
# se lê como árvore. O que se lê é a MANCHA — um grupo com silhueta irregular e
# uma sombra comum. Por isso cada sprite é um punhado de árvores já montado, e o
# jogo espalha punhados em vez de árvores.
#
# E é também o que torna isto barato: 6 sprites cobrem um mapa inteiro, e
# espalhar 400 cópias de 6 imagens custa ao canvas o mesmo que 400 de uma só.
#
# A ISOMETRIA E O SOL SÃO OS DAS ALDEIAS. Se divergirem, a mata inclina para um
# lado e a aldeia para o outro, e ninguém sabe dizer porquê — só que está errado.
import json
import math
import os
import random
import sys
import time

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402

ARGS = [a for a in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
        if a.isdigit()]
LADO = int(ARGS[0]) if ARGS else 512
AMOSTRAS = int(ARGS[1]) if len(ARGS) > 1 else 160
DESTINO = os.path.join(os.getcwd(), "assets", "sprites")


def amb(nome, pad):
    return float(os.environ.get(nome, pad))


# (nome, quantas árvores, raio da mancha em metros, mistura de folhosas)
BOSQUES = [
    ("mata_1", 22, 16.0, 0.30),
    ("mata_2", 34, 22.0, 0.45),
    ("mata_3", 14, 12.0, 0.60),
    ("mata_4", 46, 27.0, 0.35),
    ("mata_5", 9, 9.0, 0.55),
    ("mata_6", 28, 19.0, 0.25),
]


def construir(nome, quantas, raio, folhosas, semente):
    rnd = random.Random(semente)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P._mats.clear()
    P.LIXO = None
    P.MASTROS_CENA.clear()

    # ARVORES MAIS ALTAS (07/09). O que da sensacao de escala nao e a largura da
    # mancha — e a VERTICAL: um tronco alto com sombra comprida ao lado diz
    # "isto tem trinta metros". Copas mais estreitas e mais altas; a mancha
    # mantem o raio, portanto o bosque nao incha, so cresce para cima.
    PINHEIROS = [P.proto_arvore(17.0, "folha", ((0.56, 0.78), (0.76, 0.58), (0.93, 0.32))),
                 P.proto_arvore(13.0, "folha2", ((0.60, 0.80), (0.83, 0.50)))]
    FOLHOSAS = [P.proto_arvore_folha(16.0, "folha2"),
                P.proto_arvore_folha(12.0, "folha3")]
    ARBUSTOS = [P.proto_arbusto(1.3, "folha3"), P.proto_arbusto(0.9, "folha2")]

    # ── o chão do bosque ────────────────────────────────────────────────────
    # Uma mancha de sombra e folhada, com a orla irregular. Sem ela as árvores
    # ficam em cima da relva do mapa como se estivessem coladas, e vê-se o corte.
    verts, faces = [], []
    N = 60
    for i in range(N):
        a = 2 * math.pi * i / N
        r = raio * (0.74 + 0.20 * math.sin(a * 2.7 + semente) + 0.09 * math.sin(a * 5.3))
        verts.append((r * math.cos(a), r * math.sin(a), -0.05))
    verts.append((0.0, 0.0, 0.0))
    for i in range(N):
        faces.append((i, (i + 1) % N, N))
    P._novo_orla(P._malha("folhada", verts, faces, "folhada", bisel=0),
                 "folhada", raio * 0.92, raio * 0.46)

    postas = []
    for i in range(quantas):
        for _ in range(40):
            a = rnd.random() * 2 * math.pi
            d = raio * 0.88 * math.sqrt(rnd.random())
            x, y = d * math.cos(a), d * math.sin(a)
            if all((x - ox) ** 2 + (y - oy) ** 2 > 9 for ox, oy in postas):
                postas.append((x, y))
                break
        else:
            continue
        proto = (FOLHOSAS if rnd.random() < folhosas else PINHEIROS)[i % 2]
        P.onde(proto, x, y, -0.4, rnd.random() * 6.3, 0.72 + rnd.random() * 0.55)
    for i in range(quantas):
        a = rnd.random() * 2 * math.pi
        d = raio * (0.5 + 0.55 * rnd.random())
        P.onde(ARBUSTOS[i % 2], d * math.cos(a), d * math.sin(a), -0.2,
               rnd.random() * 6.3, 0.6 + rnd.random() * 0.7)
    return (raio + 5) * 2.3


def cena_pronta(quadro):
    cena = bpy.context.scene
    giro = math.radians(45)
    elev = amb("SOL_ELEV", math.radians(30))
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 200))
    sol = bpy.context.object
    sol.data.energy = amb("SOL_FORCA", 5.2)
    sol.data.angle = 0.055
    sol.data.color = (1.0, 0.90, 0.74)
    sol.rotation_euler = (math.pi / 2 - elev, 0.0, amb("SOL_AZ", 2.22) + giro)

    mundo = bpy.data.worlds.new("ceu")
    cena.world = mundo
    mundo.use_nodes = True
    nm, lm = mundo.node_tree.nodes, mundo.node_tree.links
    ceu = nm.new("ShaderNodeTexSky")
    try:
        ceu.sky_type = "NISHITA"
        ceu.sun_elevation = elev
        ceu.sun_rotation = amb("SOL_AZ", 2.22) + giro
        ceu.sun_disc = False
    except Exception:
        pass
    lm.new(ceu.outputs["Color"], nm["Background"].inputs["Color"])
    nm["Background"].inputs["Strength"].default_value = amb("CEU_FORCA", 0.65)

    inclina = math.radians(60)
    D = 300.0
    bpy.ops.object.camera_add(
        location=(D * math.sin(inclina) * math.sin(giro),
                  -D * math.sin(inclina) * math.cos(giro),
                  D * math.cos(inclina)),
        rotation=(inclina, 0, giro))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = quadro
    cam.data.clip_start, cam.data.clip_end = 5.0, 700.0
    cena.camera = cam

    bpy.ops.preferences.addon_enable(module="cycles")
    cena.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for tipo in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = tipo
        except Exception:
            continue
        prefs.get_devices()
        if any(x.type == tipo for x in prefs.devices):
            for dev in prefs.devices:
                dev.use = dev.type in (tipo, "CPU")
            cena.cycles.device = "GPU"
            break
    cena.cycles.samples = AMOSTRAS
    cena.cycles.use_denoising = True
    cena.render.resolution_x = cena.render.resolution_y = LADO
    cena.render.film_transparent = True
    cena.render.image_settings.file_format = "PNG"
    cena.render.image_settings.color_mode = "RGBA"
    cena.view_settings.view_transform = os.environ.get("CENA_COR", "AgX")
    try:
        cena.view_settings.look = os.environ.get("CENA_LOOK", "AgX - Medium High Contrast")
    except Exception:
        pass
    return cena


t0 = time.time()
os.makedirs(DESTINO, exist_ok=True)
for i, (nome, quantas, raio, folhosas) in enumerate(BOSQUES):
    quadro = construir(nome, quantas, raio, folhosas, 40 + i * 7)
    cena = cena_pronta(quadro)
    bruto = os.path.join(DESTINO, "_bruto_" + nome + ".png")
    cena.render.filepath = bruto
    bpy.ops.render.render(write_still=True)
    with open(os.path.splitext(bruto)[0] + "_quadro.json", "w", encoding="utf-8") as f:
        json.dump({"lado_px": LADO, "metros_do_quadro": quadro,
                   "isometria": {"inclinacao_graus": 60, "giro_graus": 45},
                   "destino": os.path.join(DESTINO, nome + ".png")}, f, indent=2)
    print("SONDA bruto %-8s %2d arvores, %.0f m de mancha" % (nome, quantas, raio),
          flush=True)
print("SONDA %d bosques em %.1f s" % (len(BOSQUES), time.time() - t0))
