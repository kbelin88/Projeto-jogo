# quatro_vistas.py — a peca vista de frente, de tras e dos dois lados.
#
#   blender -b --factory-startup -noaudio -P ferramentas/cena/quatro_vistas.py -- <ficheiro.glb>
#
# Serve para uma pergunta que o ficheiro nao responde: PARA QUE LADO ele olha?
# No nosso mapa o soldado olha para +Y, e uma peca que chegue virada para -X
# marcha de lado sem ninguem perceber porque. Tambem mostra a pose das pernas,
# que e onde o esqueleto vai ter de encaixar.
import math
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ALVO = ARGS[0] if ARGS else "assets/Lanceiro.glb"
LADO = int(ARGS[1]) if len(ARGS) > 1 else 520
NOME = os.path.splitext(os.path.basename(ALVO))[0]
PASTA = os.path.join(os.getcwd(), "ferramentas", "cena", "_saida")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(os.getcwd(), ALVO))
malhas = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for ob in malhas:
    if not ob.data.color_attributes:
        continue
    for mat in (ob.data.materials or []):
        if mat and mat.use_nodes:
            nt = mat.node_tree
            b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b and not b.inputs["Base Color"].is_linked:
                ca = nt.nodes.new("ShaderNodeVertexColor")
                ca.layer_name = ob.data.color_attributes[0].name
                nt.links.new(ca.outputs["Color"], b.inputs["Base Color"])

lo = [1e30] * 3
hi = [-1e30] * 3
for ob in malhas:
    for v in ob.bound_box:
        p = ob.matrix_world @ type(ob.location)(v)
        for k in range(3):
            lo[k] = min(lo[k], p[k])
            hi[k] = max(hi[k], p[k])
meio = [(lo[k] + hi[k]) / 2 for k in range(3)]
raio = max(hi[k] - lo[k] for k in range(3)) or 1.0

cena = bpy.context.scene
sol = bpy.data.lights.new("sol", "SUN")
sol.energy = 3.2
ob_sol = bpy.data.objects.new("sol", sol)
cena.collection.objects.link(ob_sol)
ob_sol.rotation_euler = (math.radians(55), 0, math.radians(30))
mundo = bpy.data.worlds.new("ceu")
cena.world = mundo
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (.62, .70, .80, 1)

cam_d = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_d)
cena.collection.objects.link(cam)
cena.camera = cam
alvo = bpy.data.objects.new("alvo", None)
alvo.location = meio
cena.collection.objects.link(alvo)
olhar = cam.constraints.new("TRACK_TO")
olhar.target = alvo
olhar.track_axis = "TRACK_NEGATIVE_Z"
olhar.up_axis = "UP_Y"

cena.render.engine = "CYCLES"
cena.cycles.samples = 32
cena.render.resolution_x = cena.render.resolution_y = LADO
cena.view_settings.view_transform = "AgX"

VISTAS = {"frente_-Y": (0.0, -1.0), "tras_+Y": (0.0, 1.0),
          "direita_+X": (1.0, 0.0), "esquerda_-X": (-1.0, 0.0)}
d = raio * 2.2
for nome, (dx, dy) in VISTAS.items():
    cam.location = (meio[0] + dx * d, meio[1] + dy * d, meio[2] + raio * 0.18)
    cena.render.filepath = os.path.join(PASTA, "%s_%s.png" % (NOME, nome))
    bpy.ops.render.render(write_still=True)
    print("SONDA vista %s" % nome)
print("SONDA caixa %.3f x %.3f x %.3f, chao em z=%.3f"
      % (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], lo[2]))
