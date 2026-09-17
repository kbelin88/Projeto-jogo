# ver_montanhas.py - fotografa os estilos do `montanhas.py` em perspetiva.
#
#   blender -b --factory-startup -noaudio -P ferramentas/cena/ver_montanhas.py -- [saida.png]
#
# A prova de cima (relevo sombreado) engana: um paredao e um vale largo podem
# dar a mesma mancha escura. Aqui cada estilo vira malha num prato de relva, a
# rocha pintada pelo declive (a mesma regra do forno), e tira-se UMA foto com a
# camara inclinada como a do jogo. ~20 s, sem o mapa inteiro.
import math
import os
import sys

import bpy
import numpy as np

RAIZ = os.getcwd()
sys.path.insert(0, os.path.join(RAIZ, "ferramentas", "cena"))
import montanhas as MT  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAIDA = args[0] if args else os.path.join(RAIZ, "ferramentas", "cena", "_saida", "montanhas_3d.png")
ROCHA_GRAUS = float(os.environ.get("ROCHA_GRAUS", "34"))

bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene
PASSO = 6.0
L = 1500.0
xs = np.arange(-L / 2, L / 2 + 1e-6, PASSO)
n = len(xs)
X, Y = np.meshgrid(xs, xs)
ESPACO = 1500.0

for k, (nome, raio) in enumerate(MT.ESTILOS):
    H = MT.forma(nome, X, Y, raio, semente=3 + k).astype(np.float32)
    gy, gx = np.gradient(H, PASSO)
    decl = np.degrees(np.arctan(np.hypot(gx, gy)))
    ox = (k - 1) * ESPACO
    verts = [(float(X[j, i] + ox), float(Y[j, i]), float(H[j, i])) for j in range(n) for i in range(n)]
    faces = [(j * n + i, j * n + i + 1, (j + 1) * n + i + 1, (j + 1) * n + i)
             for j in range(n - 1) for i in range(n - 1)]
    me = bpy.data.meshes.new(nome)
    me.from_pydata(verts, [], faces)
    cor = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    alto = H / max(float(H.max()), 1.0)
    for j in range(n):
        for i in range(n):
            if decl[j, i] > ROCHA_GRAUS:
                t = 0.55 + 0.25 * alto[j, i]
                c = (t, t * 0.93, t * 0.86)
            else:
                c = (0.20 + 0.10 * alto[j, i], 0.34 + 0.06 * alto[j, i], 0.13)
            cor.data[j * n + i].color = (*c, 1.0)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(nome, me)
    cena.collection.objects.link(ob)
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    bsdf = next(x for x in m.node_tree.nodes if x.type == "BSDF_PRINCIPLED")
    atr = m.node_tree.nodes.new("ShaderNodeAttribute")
    atr.attribute_name = "Col"
    m.node_tree.links.new(atr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95
    me.materials.append(m)
    print("VER %s: max %.0f m, rocha %.0f%%" % (nome, H.max(), 100 * (decl[H > 5] > ROCHA_GRAUS).mean()))

sol = bpy.data.objects.new("sol", bpy.data.lights.new("sol", "SUN"))
sol.data.energy = 2.6
sol.rotation_euler = (math.radians(55), 0, math.radians(215))
cena.collection.objects.link(sol)
mundo = bpy.data.worlds.new("ceu")
mundo.use_nodes = True
fundo = next(x for x in mundo.node_tree.nodes if x.type == "BACKGROUND")
fundo.inputs["Color"].default_value = (0.55, 0.68, 0.82, 1)
fundo.inputs["Strength"].default_value = 0.45
cena.world = mundo

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cena.collection.objects.link(cam)
cam.data.lens = 35
cam.data.clip_end = 20000
cena.camera = cam
for motor in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        cena.render.engine = motor
        break
    except TypeError:
        pass
cena.view_settings.view_transform = "Standard"
cena.render.resolution_x, cena.render.resolution_y = 900, 560
# uma foto por estilo, a camara como a do jogo: 1100 m de distancia, 30 graus
base, ext = os.path.splitext(SAIDA)
for k, (nome, raio) in enumerate(MT.ESTILOS):
    ox = (k - 1) * ESPACO
    ang = math.radians(28)
    d = 1150.0
    cam.location = (ox, -d * math.cos(ang), 60 + d * math.sin(ang))
    cam.rotation_euler = (math.radians(90 - 28 + 6), 0, 0)
    cena.render.filepath = "%s_%d%s" % (base, k, ext)
    bpy.ops.render.render(write_still=True)
    print("VER ->", cena.render.filepath)
