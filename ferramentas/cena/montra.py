# montra.py — cada peça sozinha, em fundo neutro, para se ver o que tem.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/montra.py -- [peca] [lado_px] [amostras]
#
# Sem argumento faz todas; com `-- torre` faz só a torre.
#
# POR QUE ESTA FERRAMENTA EXISTE: o Lucas viu "madeiras a voar" à volta das
# torres e uma falha entre a muralha e o portão. Numa cena com doze mil árvores
# não há maneira de perceber de onde vem uma tábua solta — a peça tem de ser
# vista sozinha, grande, e de dois lados. Foi assim que se encontrou o defeito
# em dois minutos em vez de meia hora a apalpar valores.
import math
import os
import sys
import time

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
QUAL = ARGS[0] if ARGS and not ARGS[0].isdigit() else "todas"
NUM = [a for a in ARGS if a.isdigit()]
LADO = int(NUM[0]) if NUM else 700
AMOSTRAS = int(NUM[1]) if len(NUM) > 1 else 90
SAIDA = os.path.join(os.getcwd(), "ferramentas", "cena", "_saida", "montra")
os.makedirs(SAIDA, exist_ok=True)

# (nome, construtor, quantos metros o quadro abrange)
CATALOGO = {
    "muro":     (lambda: P.proto_muro(4.4, 4.4), 9.0),
    "torre":    (lambda: P.proto_torre_muro(13.5), 20.0),
    "portao":   (lambda: P.proto_casa_portao(13.0, 5.2), 24.0),
    "folha":    (lambda: P.proto_folha_portao(5.2, 4.8), 9.0),
    "casa":     (lambda: P.proto_casa2(7.6, 5.8, 2.9), 14.0),
    "celeiro":  (lambda: P.proto_celeiro2(), 20.0),
    "poco":     (lambda: P.proto_poco(), 7.0),
    "carroca":  (lambda: P.proto_carroca(), 7.0),
}


def montar(quadro, giro):
    cena = bpy.context.scene
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 100))
    sol = bpy.context.object
    sol.data.energy = 4.4
    sol.data.angle = 0.06
    sol.rotation_euler = (math.pi / 2 - math.radians(34), 0.0, 2.22 + giro)
    mundo = bpy.data.worlds.new("ceu")
    cena.world = mundo
    mundo.use_nodes = True
    f = mundo.node_tree.nodes["Background"]
    f.inputs["Color"].default_value = (0.42, 0.50, 0.60, 1.0)
    f.inputs["Strength"].default_value = 0.9
    # um chão neutro: sem ele não se vê o que está apoiado e o que está no ar,
    # que é exatamente a pergunta que esta ferramenta responde
    bpy.ops.mesh.primitive_plane_add(size=quadro * 3, location=(0, 0, 0))
    P._novo(bpy.context.object, "relva", 0)

    inclina = math.radians(56)
    D = 200.0
    bpy.ops.object.camera_add(
        location=(D * math.sin(inclina) * math.sin(giro),
                  -D * math.sin(inclina) * math.cos(giro),
                  quadro * 0.18 + D * math.cos(inclina)),
        rotation=(inclina, 0, giro))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = quadro
    cam.data.clip_start, cam.data.clip_end = 1.0, 600.0
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
    cena.render.image_settings.file_format = "PNG"
    cena.view_settings.view_transform = "AgX"


t0 = time.time()
alvos = list(CATALOGO) if QUAL == "todas" else [QUAL]
for nome in alvos:
    construir, quadro = CATALOGO[nome]
    # DOIS ÂNGULOS. Uma tábua no ar pode esconder-se atrás da peça de um lado e
    # saltar à vista do outro; com um só ângulo o defeito escapa.
    for rot, giro in (("a", math.radians(45)), ("b", math.radians(215))):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        P._mats.clear()
        P.LIXO = None
        proto = construir()
        # o protótipo vive fora da cena; para o ver, põe-se uma cópia
        P.onde(proto, 0, 0, 0, 0)
        montar(quadro, giro)
        bpy.context.scene.render.filepath = os.path.join(SAIDA, "%s_%s.png" % (nome, rot))
        bpy.ops.render.render(write_still=True)
print("SONDA montra: %d pecas x 2 angulos em %s  (%.1f s)"
      % (len(alvos), SAIDA, time.time() - t0))
