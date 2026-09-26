# exportar_faro.py - a aldeia de Faro feita a mao no Blender, para o navegador.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b \
#       ferramentas/cena/_saida/faro_aldeia.blend -P ferramentas/cena/exportar_faro.py
#     -> sonda3d/faro_aldeia.glb
#
# ── PORQUE (26/09) ──────────────────────────────────────────────────────────
# A aldeia foi montada ao vivo no Blender (MCP), com materiais que projetam a
# fotografia em CAIXA pelas coordenadas do objeto. O glTF nao leva grafos de
# nos (CLAUDE.md, 7.3): so passa imagem (por UV) -> MULTIPLY constante -> Base
# Color. Entao aqui:
#   1. cada face ganha o UV que a projecao em caixa lhe dava (eixo dominante da
#      normal, em metros / tamanho do ladrilho) -- a imagem fica igual;
#   2. o material perde o TexCoord/Mapping e a variacao por objeto;
#   3. as ~600 pecas juntam-se numa malha por material (~30 desenhos, nao 600);
#   4. ficam de fora o campo, as arvores de fora da muralha (o mapa tem as
#      suas) e o mastro com o pano (a bandeira do jogo e do dono da aldeia).
# Fazia-se no Blender aberto, e o Blender caiu: converter 600 objetos com o
# viewport em render. Em -b nao ha viewport.
import os

import bmesh
import bpy
import mathutils
import numpy as np

RAIZ = os.getcwd()
SAIDA = os.path.join(RAIZ, "sonda3d", "faro_aldeia.glb")
RAIO_FORA = 21.0          # metros: a muralha tem 19,5 de raio


def centro(o):
    cs = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return sum(cs, mathutils.Vector()) / 8


def fica(o):
    if o.type != "MESH" or not o.material_slots or not o.material_slots[0].material:
        return False
    if o.name.startswith(("campo", "pano", "mastro")):
        return False
    if o.name.startswith("arvore") and centro(o).xy.length > RAIO_FORA:
        return False
    return True


conv = {}
# ── O NAVEGADOR NAO E O EEVEE ───────────────────────────────────────────────
# O three tem menos luz de ceu que o render do Blender: as folhas que no Blender
# eram verde-escuro sairam PRETAS no navegador (bancada, 26/09), e o chao de
# terra cinzento-claro. Um fator por material (linear, RGB), assado na imagem.
AJUSTE = {
    "folha_laranjeira": (2.2, 2.0, 1.6),
    "palma": (2.0, 1.9, 1.5),
    "tronco_palma": (1.5, 1.4, 1.3),
    "chao": (0.95, 0.80, 0.62),
    "empedrado": (0.85, 0.78, 0.68),
}


def _srgb_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def mat_gltf(m):
    """copia do material no unico padrao que o exportador leva: imagem -> Base Color.

    A cadeia de MIX entre a fotografia e o Base Color (a tinta MULTIPLY, e na
    cal um MIX de 78% para o branco) e ASSADA NA IMAGEM: o glTF so sabe
    multiplicar, e a cal "multiplicada" pela taipa saia preta no navegador.
    """
    if m.name in conv:
        return conv[m.name]
    m2 = m.copy()
    m2.name = m.name[2:] if m.name.startswith("F_") else m.name
    nt = m2.node_tree
    metros = 1.0
    for n in nt.nodes:
        if n.type == "MAPPING":
            metros = 1.0 / n.inputs["Scale"].default_value[0]
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    # do Base Color para tras, ate a imagem
    passos, img_no = [], None
    sock = b.inputs["Base Color"]
    while sock.is_linked:
        n = sock.links[0].from_node
        if n.type == "TEX_IMAGE":
            img_no = n
            break
        if n.type != "MIX":
            break
        if not n.inputs[7].is_linked:          # a variacao por objeto nao vai
            passos.append((n.blend_type, n.inputs[0].default_value,
                           np.array(n.inputs[7].default_value[:3], dtype=np.float32)))
        sock = n.inputs[6]
    passos.reverse()                           # da imagem para fora
    nome_img = img_no.name if img_no else None
    if img_no and (passos or m2.name in AJUSTE):
        im = img_no.image
        if im.size[0] > 1024:
            im = im.copy()
            im.scale(1024, 1024)
        w, h = im.size
        px = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        px = px.reshape(-1, 4)
        c = _srgb_lin(px[:, :3])
        for tipo, f, cor in passos:
            if tipo == "MULTIPLY":
                c = c * (1 - f) + c * cor * f
            else:                              # MIX
                c = c * (1 - f) + cor * f
        if m2.name in AJUSTE:
            c = c * np.array(AJUSTE[m2.name], dtype=np.float32)
        px[:, :3] = _lin_srgb(c)
        nova = bpy.data.images.new("faro_" + m2.name, w, h)
        nova.pixels.foreach_set(px.ravel())
        pasta = os.path.join(RAIZ, "ferramentas", "cena", "_saida", "faro_tex")
        os.makedirs(pasta, exist_ok=True)
        nova.filepath_raw = os.path.join(pasta, m2.name + ".jpg")
        nova.file_format = "JPEG"
        nova.save()
        img_no.image = nova
    # ⚠ apagar nos invalida as referencias Python aos outros: mexer num no
    # guardado antes dava EXCEPTION_ACCESS_VIOLATION (Blender 5.2). Pelo nome.
    for nome in [n.name for n in nt.nodes
                 if n.type in ("TEX_COORD", "MAPPING", "OBJECT_INFO", "MAP_RANGE",
                               "COMBINE_COLOR", "MIX")]:
        nt.nodes.remove(nt.nodes[nome])
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    if nome_img:
        nt.links.new(nt.nodes[nome_img].outputs["Color"], b.inputs["Base Color"])
    for n in nt.nodes:
        if n.type == "TEX_IMAGE":
            n.projection = "FLAT"
    # sem metallicFactor o glTF assume metal = 1 (o cavalo preto)
    b.inputs["Metallic"].default_value = 0.0
    conv[m.name] = (m2, metros)
    return conv[m.name]


# uma bmesh por material, com tudo ja em coordenadas do mundo
grupos = {}
col = bpy.data.collections["Faro"]
n_obj = 0
# ⚠ em lista ANTES: criar/apagar malhas e materiais dentro do laco estragava o
# iterador vivo do `all_objects` -- saiam 166 de 646 pecas, sem erro nenhum
for o in list(col.all_objects):
    if not fica(o):
        continue
    m2, metros = mat_gltf(o.material_slots[0].material)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        nrm = f.normal
        ax = max(range(3), key=lambda i: abs(nrm[i]))
        for lo in f.loops:
            p = lo.vert.co
            u, v = ((p.y, p.z), (p.x, p.z), (p.x, p.y))[ax]
            lo[uv].uv = (u / metros, v / metros)
    bm.transform(o.matrix_world)
    me = bpy.data.meshes.new("tmp")
    bm.to_mesh(me)
    bm.free()
    if m2.name not in grupos:
        grupos[m2.name] = (m2, bmesh.new())
    grupos[m2.name][1].from_mesh(me)
    bpy.data.meshes.remove(me)
    n_obj += 1

# cena limpa so com as malhas juntas
cena = bpy.data.scenes.new("faro_export")
for nome, (m2, bm) in grupos.items():
    me = bpy.data.meshes.new("faro_" + nome)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m2)
    ob = bpy.data.objects.new("faro_" + nome, me)
    cena.collection.objects.link(ob)
# as fotografias vao a 1024: a aldeia tem 40 m e ve-se de 275 m; a 2048 e em
# PNG o GLB saia com 50 MB
for m2, _ in conv.values():
    for n in m2.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > 1024:
            n.image.scale(1024, 1024)
with bpy.context.temp_override(scene=cena):
    bpy.ops.export_scene.gltf(filepath=SAIDA, export_format="GLB", use_active_scene=True,
                              export_apply=True, export_lights=False, export_cameras=False,
                              export_image_format="JPEG", export_jpeg_quality=85)
print("SONDA faro: %d objetos -> %d malhas, %s (%.0f KB)"
      % (n_obj, len(grupos), SAIDA, os.path.getsize(SAIDA) / 1024))
