# assar_pecas.py — desdobra uma peça em UV e ASSA a luz nela.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/assar_pecas.py -- [peca] [px] [amostras]
#
# ── POR QUE ISTO E O PASSO QUE FALTAVA ───────────────────────────────────────
# A sondagem de 07/09 mostrou duas coisas:
#   1. o glTF nao transporta os nossos materiais (sao grafos de nos, com a
#      textura mapeada por coordenada de OBJETO e a cor misturada em modo
#      COLOR) — so transporta PBR com UV;
#   2. a oclusao ambiente em tempo real, no navegador, vale ~3% de
#      escurecimento. Medido, nao estimado.
#
# As duas apontam para o mesmo sitio: **desdobrar em UV e assar**. Uma vez por
# peca, no Cycles, com a oclusao verdadeira la dentro. Depois disso o navegador
# so tem de mostrar uma imagem — que e exatamente o que ele faz bem.
#
# E e a mesma frase que ja governa este projeto: assar o que e geometria,
# desenhar o que e bandeira.
import os
import sys
import time

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402

ARG = [a for a in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])]
PECA = next((a for a in ARG if not a.isdigit()), "torre")
NUMS = [int(a) for a in ARG if a.isdigit()]
PX = NUMS[0] if NUMS else 1024
AMOSTRAS = NUMS[1] if len(NUMS) > 1 else 64
SAIDA = os.path.join(os.getcwd(), "sonda3d", "assadas")

FABRICA = {
    "torre":  lambda: P.proto_torre_muro(),
    "muro":   lambda: P.proto_muro(),
    "portao": lambda: P.proto_casa_portao(),
    "casa":   lambda: P.proto_casa2(),
    "menagem": lambda: P.proto_menagem(),
}

t0 = time.time()
os.makedirs(SAIDA, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
P._mats.clear(); P.LIXO = None
P.MASTROS_CENA.clear(); P.PORTOES_CENA.clear()

ob = FABRICA[PECA]()
# a peça vive na coleção dos protótipos, fora do render; para assar tem de estar
# na cena — foi este mesmo detalhe que devolveu um glTF de 132 bytes na sondagem
for c in list(ob.users_collection):
    c.objects.unlink(ob)
bpy.context.scene.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob
ob.select_set(True)

# ── o desdobramento ─────────────────────────────────────────────────────────
# `smart_project` e automatico e feio de ver, e nao faz mal nenhum: ninguem vai
# olhar para o mapa UV. O que importa e nao haver sobreposicao — duas faces no
# mesmo sitio da textura assariam uma por cima da outra.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.008)
bpy.ops.object.mode_set(mode="OBJECT")
print("SONDA %s: %d poligonos, %d ilhas de UV por assar"
      % (PECA, len(ob.data.polygons), len(ob.data.uv_layers)))

# ── o alvo ──────────────────────────────────────────────────────────────────
img = bpy.data.images.new("assado_" + PECA, PX, PX, alpha=False)
for m in ob.data.materials:
    if not m or not m.use_nodes:
        continue
    n = m.node_tree.nodes.new("ShaderNodeTexImage")
    n.image = img
    n.select = True
    m.node_tree.nodes.active = n          # o Cycles assa para o no ATIVO

# ── luz de forno: so o ceu ──────────────────────────────────────────────────
# Um sol daria a sombra de UMA hora do dia colada a peca para sempre, e a peca
# aparece no mapa em qualquer orientacao. O que se quer assar e a parte da luz
# que NAO tem direcao: a oclusao. O sol continua a ser calculado em tempo real,
# que e o que ele faz bem e barato.
mundo = bpy.data.worlds.new("forno")
bpy.context.scene.world = mundo
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0

cena = bpy.context.scene
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
cena.cycles.bake_type = "DIFFUSE"
cena.render.bake.use_pass_direct = False
cena.render.bake.use_pass_indirect = False
cena.render.bake.use_pass_color = True     # a COR do material, ja resolvida
cena.render.bake.margin = 8

print("SONDA a assar a cor...", flush=True)
bpy.ops.object.bake(type="DIFFUSE")
img.filepath_raw = os.path.join(SAIDA, PECA + "_cor.png")
img.file_format = "PNG"
img.save()

# e a oclusão, num ficheiro seu: separada, para se poder pesar cada uma
ao = bpy.data.images.new("ao_" + PECA, PX, PX, alpha=False)
for m in ob.data.materials:
    if m and m.use_nodes:
        m.node_tree.nodes.active.image = ao
print("SONDA a assar a oclusao...", flush=True)
bpy.ops.object.bake(type="AO")
ao.filepath_raw = os.path.join(SAIDA, PECA + "_ao.png")
ao.file_format = "PNG"
ao.save()

for f in (PECA + "_cor.png", PECA + "_ao.png"):
    print("SONDA -> sonda3d/assadas/%s  (%.0f KB)"
          % (f, os.path.getsize(os.path.join(SAIDA, f)) / 1024))
print("SONDA assado em %.1f s" % (time.time() - t0))
