# render.py — a ilha com relevo e sol, no Blender, sem interface.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/ilha3d/render.py -- [escala] [amostras]
#
# O que faz: um plano denso, deslocado pelo mapa de alturas que o mapas.py tirou
# da própria pintura, com a pintura como cor base e um sol baixo de noroeste.
# A câmara é ORTOGRÁFICA e enquadra o plano exatamente — a silhueta que sai é a
# mesma do PNG original, portanto o encaixe no jogo (escala 1.17613 ancorada no
# topo) continua válido e nenhuma aldeia sai do sítio.
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ESCALA = float(ARGS[0]) if ARGS else 2.0        # 2x o tamanho do PNG atual
AMOSTRAS = int(ARGS[1]) if len(ARGS) > 1 else 64

AQUI = os.path.dirname(os.path.abspath(bpy.data.filepath or __file__))
if not os.path.isdir(os.path.join(AQUI, "_saida")):
    AQUI = os.path.join(os.getcwd(), "ferramentas", "ilha3d")
S = os.path.join(AQUI, "_saida")
LARG_PNG, ALT_PNG = 1215, 864
LARG, ALT = int(LARG_PNG * ESCALA), int(ALT_PNG * ESCALA)

# unidades: 1 = 100 px do PNG. A ilha fica com ~12 x 8,6 unidades.
UX, UY = LARG_PNG / 100.0, ALT_PNG / 100.0
# o exagero do relevo: um mapa lê-se melhor exagerado, mas passar de ~0,5 faz
# a Ibéria parecer papel amassado. Pode vir do ambiente, para o varrer.py poder
# testar vários valores sem editar o ficheiro.
ALTURA_MAX = float(os.environ.get("ILHA_ALTURA", 0.46))
DENSIDADE = 620            # vértices no lado maior

bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene

# ---- o terreno --------------------------------------------------------------
bpy.ops.mesh.primitive_grid_add(
    x_subdivisions=DENSIDADE, y_subdivisions=int(DENSIDADE * ALT_PNG / LARG_PNG),
    size=1, location=(0, 0, 0))
terreno = bpy.context.object
terreno.scale = (UX, UY, 1)
bpy.ops.object.transform_apply(scale=True)

img_alt = bpy.data.images.load(os.path.join(S, "altura.png"))
img_alt.colorspace_settings.name = "Non-Color"
tex = bpy.data.textures.new("altura", type="IMAGE")
tex.image = img_alt
tex.extension = "EXTEND"
d = terreno.modifiers.new("desloc", "DISPLACE")
d.texture = tex
d.texture_coords = "UV"
d.strength = ALTURA_MAX
d.mid_level = 0.0
bpy.ops.object.shade_smooth()

# ---- o material: a pintura como cor, o alfa como recorte --------------------
mat = bpy.data.materials.new("ilha")
mat.use_nodes = True
mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else mat.blend_method
nos, liga = mat.node_tree.nodes, mat.node_tree.links
nos.clear()
saida = nos.new("ShaderNodeOutputMaterial")
princ = nos.new("ShaderNodeBsdfPrincipled")
princ.inputs["Roughness"].default_value = 0.92
if "Specular IOR Level" in princ.inputs:
    princ.inputs["Specular IOR Level"].default_value = 0.18
mistura = nos.new("ShaderNodeMixShader")
transp = nos.new("ShaderNodeBsdfTransparent")

tex_cor = nos.new("ShaderNodeTexImage")
tex_cor.image = bpy.data.images.load(os.path.join(S, "cor.png"))
tex_alf = nos.new("ShaderNodeTexImage")
tex_alf.image = bpy.data.images.load(os.path.join(S, "alfa.png"))
tex_alf.image.colorspace_settings.name = "Non-Color"

# a cor entra intacta: o mapas.py ja parte da versao corrigida, e
# dessaturar aqui foi o que deixou o primeiro render lavado
hsv = nos.new("ShaderNodeHueSaturation")
hsv.inputs["Saturation"].default_value = 1.0
hsv.inputs["Value"].default_value = 1.0

liga.new(tex_cor.outputs["Color"], hsv.inputs["Color"])
liga.new(hsv.outputs["Color"], princ.inputs["Base Color"])
liga.new(transp.outputs["BSDF"], mistura.inputs[1])
liga.new(princ.outputs["BSDF"], mistura.inputs[2])
liga.new(tex_alf.outputs["Color"], mistura.inputs["Fac"])
liga.new(mistura.outputs["Shader"], saida.inputs["Surface"])
terreno.data.materials.append(mat)

# ---- a luz: sol baixo de noroeste, mais um céu de preenchimento -------------
bpy.ops.object.light_add(type="SUN", location=(0, 0, 10))
sol = bpy.context.object
sol.data.energy = 5.6
sol.data.angle = 0.09                     # sombra com beira macia, não recortada
sol.data.color = (1.0, 0.94, 0.82)
sol.rotation_euler = (0.90, 0.0, 2.45)    # ~38 graus: sombra mais comprida

mundo = bpy.data.worlds.new("ceu")
cena.world = mundo
mundo.use_nodes = True
fundo = mundo.node_tree.nodes["Background"]
fundo.inputs["Color"].default_value = (0.42, 0.56, 0.68, 1.0)
fundo.inputs["Strength"].default_value = 0.30

# ---- a câmara: ortográfica, a olhar de cima, enquadrada ao plano ------------
bpy.ops.object.camera_add(location=(0, 0, 14), rotation=(0, 0, 0))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = UX                 # o lado maior do plano preenche o quadro
cena.camera = cam

# ---- render -----------------------------------------------------------------
bpy.ops.preferences.addon_enable(module="cycles")
cena.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for tipo in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = tipo
    except Exception:
        continue
    prefs.get_devices()
    if any(d.type == tipo for d in prefs.devices):
        for dev in prefs.devices:
            dev.use = dev.type in (tipo, "CPU")
        cena.cycles.device = "GPU"
        print("SONDA a renderizar em", tipo)
        break

cena.cycles.samples = AMOSTRAS
cena.cycles.use_denoising = True
cena.render.resolution_x, cena.render.resolution_y = LARG, ALT
cena.render.resolution_percentage = 100
cena.render.film_transparent = True       # o mar é do jogo, não do render
cena.render.image_settings.file_format = "PNG"
cena.render.image_settings.color_mode = "RGBA"
cena.view_settings.view_transform = "Standard"   # sem filmic: a cor tem de bater
cena.render.filepath = os.path.join(S, "ilha_render.png")
bpy.ops.render.render(write_still=True)
print("SONDA escrito", cena.render.filepath, LARG, "x", ALT, "|", AMOSTRAS, "amostras")
