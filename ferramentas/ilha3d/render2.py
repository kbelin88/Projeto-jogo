# render2.py — a Ibéria: relevo construído no Blender, pele vinda de fotografia.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/ilha3d/render2.py -- [escala] [amostras]
#
# A DIVISÃO DE TRABALHO, que é a ideia toda:
#   * O BLENDER não sabe pintar. Sabe iluminar, e sabe pôr uma sombra onde a
#     geometria manda. Dele vem a FORMA: as serras do terreno.py, os vales dos
#     rios, o sol, a silhueta exata da ilha.
#   * UM MODELO DE DIFUSÃO não sabe iluminar de forma consistente com mais nada.
#     Sabe pintar. Dele vem a PELE: oito materiais recortados de duas fotografias
#     aéreas de nublado (`materiais.py`), sem sombra própria.
# A tentativa anterior fazia a cor com rampas chapadas e ficou legível mas pobre;
# a pintura antiga do jogo tinha o grão e não tinha relevo nenhum. Isto é as duas.
#
# A câmara é ortográfica e enquadra o plano exatamente, portanto a silhueta é a
# mesma do PNG do jogo e o encaixe (escala 1.17613 ancorada no topo) não muda.
#
# QUEM ESCOLHE O MATERIAL EM CADA PONTO:
#   posição na paleta (húmido→seco)  = humidade regional + mancha de ruído
#   ribeira                          = fundo de vale (altura baixa)
#   rocha                            = declive a pique, e só em terra alta
#   falésia                          = a faixa de costa que o terreno.py marcou
import math
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ESCALA = float(ARGS[0]) if ARGS else 1.0
AMOSTRAS = int(ARGS[1]) if len(ARGS) > 1 else 48

AQUI = os.path.join(os.getcwd(), "ferramentas", "ilha3d")
S = os.path.join(AQUI, "_saida")
MAT = os.path.join(S, "materiais")
LARG_PNG, ALT_PNG = 1215, 864
LARG, ALT = int(LARG_PNG * ESCALA), int(ALT_PNG * ESCALA)
UX, UY = LARG_PNG / 100.0, ALT_PNG / 100.0


def amb(nome, pad):
    return float(os.environ.get(nome, pad))


ALTURA_MAX = amb("ILHA_ALTURA", 1.00)
DENSIDADE = int(os.environ.get("ILHA_DENS", 900))
SOL_ALT = amb("SOL_ALT", 0.52)          # radianos a partir do zénite
SOL_AZ = amb("SOL_AZ", 2.45)
SOL_FORCA = amb("SOL_FORCA", 4.6)
CEU_FORCA = amb("CEU_FORCA", 0.85)
SATURA = amb("ILHA_SAT", 1.35)
BRILHO = amb("ILHA_BRILHO", 1.18)
MANCHA = amb("ILHA_MANCHA", 0.30)       # quanto o mosaico desloca a paleta
# quantas vezes cada ladrilho cabe na largura da ilha. Baixo = campos legíveis e
# repetição visível; alto = grão. A escala real seria mil vezes maior que isto —
# a fotografia cobre uns 600 m e a ilha representa mil quilómetros — portanto o
# número é de GOSTO, não de verdade.
LADRILHOS = amb("ILHA_LADRILHOS", 26.0)

bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene

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

# ---- o material -------------------------------------------------------------
mat = bpy.data.materials.new("terra")
mat.use_nodes = True
nos, liga = mat.node_tree.nodes, mat.node_tree.links
nos.clear()
saida = nos.new("ShaderNodeOutputMaterial")
princ = nos.new("ShaderNodeBsdfPrincipled")
princ.inputs["Roughness"].default_value = 0.95
if "Specular IOR Level" in princ.inputs:
    princ.inputs["Specular IOR Level"].default_value = 0.06

coord = nos.new("ShaderNodeTexCoord")
sepUV = nos.new("ShaderNodeSeparateXYZ")
liga.new(coord.outputs["UV"], sepUV.inputs["Vector"])

# as UV dos MATERIAIS são ampliadas; as da ALTURA nunca, senão a cor sai de
# registo com o relevo que a mesma imagem produziu
def ruido(escala, detalhe=6.0, aspereza=0.55, contraste=0.16):
    """ruído JÁ ESTICADO para ocupar 0..1.

    A ARMADILHA QUE CUSTOU TRÊS PASSAGENS: o `Fac` do nó de ruído do Blender não
    é uniforme em 0..1 — é uma distribuição estreita à volta de 0,5, com desvio
    de ~0,1. Quem escreve `(fac - 0,5) * peso` a contar com ±0,5 está de facto a
    somar ±0,1, e o efeito fica visível só ao microscópio.
    """
    n = nos.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = escala
    n.inputs["Detail"].default_value = detalhe
    n.inputs["Roughness"].default_value = aspereza
    e = nos.new("ShaderNodeMapRange")
    e.inputs["From Min"].default_value = 0.5 - contraste
    e.inputs["From Max"].default_value = 0.5 + contraste
    e.clamp = True
    liga.new(n.outputs["Fac"], e.inputs["Value"])
    return e.outputs["Result"]


def misturar(a, b, fator):
    m = nos.new("ShaderNodeMix")
    m.data_type = "RGBA"
    if isinstance(fator, (int, float)):
        m.inputs["Factor"].default_value = fator
    else:
        liga.new(fator, m.inputs["Factor"])
    for alvo, origem in ((6, a), (7, b)):
        if isinstance(origem, (int, float, tuple)):
            m.inputs[alvo].default_value = origem
        else:
            liga.new(origem, m.inputs[alvo])
    return m.outputs["Result"]


def somar(a, b, peso=1.0):
    """a + (b - 0,5) * peso"""
    centra = nos.new("ShaderNodeMath")
    centra.operation = "SUBTRACT"
    centra.inputs[1].default_value = 0.5
    liga.new(b, centra.inputs[0])
    escala = nos.new("ShaderNodeMath")
    escala.operation = "MULTIPLY"
    escala.inputs[1].default_value = peso
    liga.new(centra.outputs["Value"], escala.inputs[0])
    soma = nos.new("ShaderNodeMath")
    soma.operation = "ADD"
    soma.use_clamp = True
    liga.new(a, soma.inputs[0])
    liga.new(escala.outputs["Value"], soma.inputs[1])
    return soma.outputs["Value"]


def janela(valor, de, ate):
    r = nos.new("ShaderNodeMapRange")
    r.inputs["From Min"].default_value = de
    r.inputs["From Max"].default_value = ate
    r.clamp = True
    liga.new(valor, r.inputs["Value"])
    return r.outputs["Result"]


def multiplicar(a, b):
    m = nos.new("ShaderNodeMath")
    m.operation = "MULTIPLY"
    if isinstance(b, (int, float)):
        m.inputs[1].default_value = b
    else:
        liga.new(b, m.inputs[1])
    liga.new(a, m.inputs[0])
    return m.outputs["Value"]


def _mapa(escala, giro, desloc):
    m = nos.new("ShaderNodeMapping")
    k = LADRILHOS * escala
    m.inputs["Scale"].default_value = (k, k * ALT_PNG / LARG_PNG, 1.0)
    m.inputs["Rotation"].default_value = (0.0, 0.0, giro)
    m.inputs["Location"].default_value = (desloc, desloc * 0.7, 0.0)
    liga.new(coord.outputs["UV"], m.inputs["Vector"])
    return m.outputs["Vector"]


LAD_A = _mapa(1.00, 0.00, 0.00)
LAD_B = _mapa(0.61, 0.62, 0.37)
_QUEBRA = None


def pele(nome):
    """a mesma fotografia lida DUAS VEZES, e as duas misturadas por ruído.

    Uma só leitura repete o motivo do ladrilho em grelha regular — uma sebe, uma
    mancha clara — e o olho apanha a grelha antes de apanhar o terreno. Com a
    segunda leitura noutra escala e noutro ângulo, os dois períodos não coincidem
    e a repetição deixa de ter ritmo. Custa uma procura de textura a mais.
    """
    global _QUEBRA
    if _QUEBRA is None:
        _QUEBRA = ruido(3.2, 5.0, contraste=0.13)
    cam = os.path.join(MAT, nome + ".png")
    saidas = []
    for vetor in (LAD_A, LAD_B):
        t = nos.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(cam)
        t.extension = "REPEAT"
        liga.new(vetor, t.inputs["Vector"])
        saidas.append(t.outputs["Color"])
    return misturar(saidas[0], saidas[1], _QUEBRA)


# a altura, lida da MESMA imagem que deformou a malha, pelas MESMAS UV
alt_img = nos.new("ShaderNodeTexImage")
alt_img.image = img_alt
alt_img.interpolation = "Cubic"
liga.new(coord.outputs["UV"], alt_img.inputs["Vector"])
h = alt_img.outputs["Color"]

# ---- a humidade: v cresce para NORTE, e o noroeste galego é o canto chuvoso --
hum_n = janela(sepUV.outputs["Y"], 0.28, 0.84)
hum_o = nos.new("ShaderNodeMapRange")
hum_o.inputs["From Min"].default_value = 0.44
hum_o.inputs["From Max"].default_value = 0.12
hum_o.inputs["To Max"].default_value = 0.60
hum_o.clamp = True
liga.new(sepUV.outputs["X"], hum_o.inputs["Value"])
# o Atlântico só molha o NOROESTE. A primeira versão dava humidade a toda a
# costa oeste e o Alentejo saía verde — na Ibéria a chuva atlântica morre na
# Estrela, e o sul de Portugal é tão seco como a Andaluzia.
hum_oeste = multiplicar(hum_o.outputs["Result"], janela(sepUV.outputs["Y"], 0.30, 0.68))
hum_max = nos.new("ShaderNodeMath")
hum_max.operation = "MAXIMUM"
liga.new(hum_n, hum_max.inputs[0])
liga.new(hum_oeste, hum_max.inputs[1])
humidade = somar(hum_max.outputs["Value"], ruido(5.0, 4.0), 0.50)

# ---- a posição na paleta: seco menos húmido, mais o mosaico -----------------
seco = nos.new("ShaderNodeMath")
seco.operation = "MULTIPLY_ADD"
seco.inputs[1].default_value = -0.88
seco.inputs[2].default_value = 0.74
liga.new(humidade, seco.inputs[0])
pos = somar(seco.outputs["Value"], ruido(6.0, 5.0), MANCHA * 1.30)
pos = somar(pos, ruido(18.0, 8.0, 0.62), MANCHA * 0.85)
pos = somar(pos, ruido(52.0, 8.0, 0.60), MANCHA * 0.50)
pos = somar(pos, h, MANCHA * 0.75)          # terra alta é mais seca e mais pobre

# ---- a paleta: cinco peles empilhadas, do húmido ao seco -------------------
# Cada camada cobre a anterior acima do seu limiar. É uma rampa de cor, só que
# em vez de cores tem fotografias.
# a ordem é a do eixo R−G medido pelo escolher.py: mata −5, matos +10,
# planalto +16, restolho +20. O olival e os socalcos SAÍRAM: têm linhas, e
# textura com direção repete-se como listas assim que o ladrilho volta.
PALETA = [("mata", None), ("matos", (0.14, 0.36)), ("planalto", (0.40, 0.62)),
          ("restolho", (0.64, 0.86))]
cor = pele(PALETA[0][0])
for nome, (de, ate) in PALETA[1:]:
    cor = misturar(cor, pele(nome), janela(pos, de, ate))

# ---- a ribeira: fundo de vale, onde os rios cavaram -------------------------
vale = multiplicar(janela(h, 0.30, 0.12), ruido(11.0, 6.0, contraste=0.20))
cor = misturar(cor, pele("ribeira"), multiplicar(vale, 0.92))

# ---- a rocha: encosta a pique E terra alta ---------------------------------
geo = nos.new("ShaderNodeNewGeometry")
sepN = nos.new("ShaderNodeSeparateXYZ")
liga.new(geo.outputs["Normal"], sepN.inputs["Vector"])
declive = janela(sepN.outputs["Z"], 0.86, 0.46)      # 1 = a pique
pedra = misturar(pele("rocha"), pele("calcario"), ruido(9.0, 6.0, contraste=0.22))
cor = misturar(cor, pedra, multiplicar(declive, janela(h, 0.34, 0.62)))

# ---- a neve, só nos cumes que a merecem ------------------------------------
neve = janela(somar(h, ruido(38.0, 6.0), 0.055), 0.984, 1.00)
cor = misturar(cor, (0.700, 0.726, 0.760, 1), multiplicar(neve, 0.22))

# ---- a falésia da costa ----------------------------------------------------
costa_t = nos.new("ShaderNodeTexImage")
costa_t.image = bpy.data.images.load(os.path.join(S, "costa.png"))
costa_t.image.colorspace_settings.name = "Non-Color"
liga.new(coord.outputs["UV"], costa_t.inputs["Vector"])
cor = misturar(cor, (0.062, 0.046, 0.032, 1), multiplicar(costa_t.outputs["Color"], 0.88))

ajuste = nos.new("ShaderNodeHueSaturation")
ajuste.inputs["Saturation"].default_value = SATURA
ajuste.inputs["Value"].default_value = BRILHO
liga.new(cor, ajuste.inputs["Color"])
liga.new(ajuste.outputs["Color"], princ.inputs["Base Color"])

# relevo fino: agora a fotografia já traz detalhe, portanto isto é só um resto
relevo = nos.new("ShaderNodeBump")
relevo.inputs["Strength"].default_value = 0.14
liga.new(ruido(260.0, 6.0, contraste=0.30), relevo.inputs["Height"])
liga.new(relevo.outputs["Normal"], princ.inputs["Normal"])

# o recorte da ilha, do alfa do PNG do jogo
mist_s = nos.new("ShaderNodeMixShader")
transp = nos.new("ShaderNodeBsdfTransparent")
tex_alf = nos.new("ShaderNodeTexImage")
tex_alf.image = bpy.data.images.load(os.path.join(S, "alfa.png"))
tex_alf.image.colorspace_settings.name = "Non-Color"
liga.new(coord.outputs["UV"], tex_alf.inputs["Vector"])
liga.new(transp.outputs["BSDF"], mist_s.inputs[1])
liga.new(princ.outputs["BSDF"], mist_s.inputs[2])
liga.new(tex_alf.outputs["Color"], mist_s.inputs["Fac"])
liga.new(mist_s.outputs["Shader"], saida.inputs["Surface"])
terreno.data.materials.append(mat)


# ---- ÁRVORES E PEDRAS A SÉRIO ----------------------------------------------
# A QUEIXA QUE ISTO RESPONDE: "não se distingue nada, parece um jogo dos anos 90".
# Estava certa, e a culpa era da abordagem. Uma ortofoto vista a pique é
# GENUINAMENTE ilegível: sem sombra própria, uma árvore vista de cima É uma
# mancha verde. Eu andava a tentar tornar legível uma coisa que por natureza não
# é. A saída não é melhor textura — é volume. Milhares de árvores com corpo e
# com sombra projetada no chão, que é a única coisa que faz uma floresta ler-se
# como floresta. É também a única coisa aqui que nem uma pintura nem uma difusão
# conseguem dar, e portanto a razão de o Blender existir neste projeto.
PLANTAS = bpy.data.collections.new("plantas")


def _material(nome, cor, rugosidade=0.9):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = cor
    p.inputs["Roughness"].default_value = rugosidade
    return m


CASCA = _material("casca", (0.052, 0.030, 0.016, 1))
FOLHA = [_material("folha%d" % i, c) for i, c in enumerate((
    (0.030, 0.062, 0.017, 1), (0.046, 0.082, 0.022, 1),
    (0.062, 0.070, 0.024, 1), (0.086, 0.088, 0.030, 1)))]
PEDRA = [_material("pedra%d" % i, c) for i, c in enumerate((
    (0.128, 0.116, 0.098, 1), (0.196, 0.180, 0.156, 1)))]


def _guardar(obj):
    bpy.context.scene.collection.objects.unlink(obj)
    PLANTAS.objects.link(obj)
    return obj


def _juntar(partes):
    bpy.ops.object.select_all(action="DESELECT")
    for o in partes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = partes[0]
    bpy.ops.object.join()
    return bpy.context.object


def arvore(folha, alt, raio, copas):
    """tronco + copas em bolas achatadas. Poucos polígonos de propósito: o que
    conta a esta escala é a SILHUETA e a SOMBRA, não a folha."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=raio * 0.15,
                                        depth=alt * 0.6, location=(0, 0, alt * 0.30))
    tronco = bpy.context.object
    tronco.data.materials.append(CASCA)
    partes = [tronco]
    for z, r in copas:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=raio * r,
                                              location=(0, 0, alt * z))
        o = bpy.context.object
        o.scale = (1.0, 1.0, 0.76)
        o.data.materials.append(folha)
        partes.append(o)
    return _guardar(_juntar(partes))


def penedo(mat, raio):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=raio, location=(0, 0, raio * 0.42))
    o = bpy.context.object
    o.scale = (1.0, 0.78, 0.52)
    o.data.materials.append(mat)
    return _guardar(o)


ARVORES = bpy.data.collections.new("arvores")
ROCHAS = bpy.data.collections.new("rochas")
ESC_A = amb("ILHA_ARVORE", 0.062)
for i, f in enumerate(FOLHA):
    a = arvore(f, ESC_A * (0.82 + 0.30 * i / 3), ESC_A * 0.46,
               ((0.58, 1.0), (0.80, 0.70), (0.96, 0.36)) if i % 2 else
               ((0.62, 1.0), (0.86, 0.62)))
    ARVORES.objects.link(a)
for i, m in enumerate(PEDRA):
    ROCHAS.objects.link(penedo(m, ESC_A * (0.42 + 0.24 * i)))


def espalhar(nome, colecao, mapa, quantos, tamanho, aleatorio=0.55, inclina=0.0):
    terreno.modifiers.new(nome, "PARTICLE_SYSTEM")
    st = terreno.particle_systems[-1].settings
    st.type = "HAIR"
    st.use_advanced_hair = True
    st.count = quantos
    st.hair_length = 0.01
    st.emit_from = "FACE"
    st.distribution = "RAND"
    st.use_modifier_stack = True      # SEM ISTO as plantas nascem no plano liso,
                                      # antes do Displace, e ficam a flutuar sobre
                                      # os vales e enterradas nas serras
    st.render_type = "COLLECTION"
    st.instance_collection = colecao
    st.use_collection_pick_random = True
    st.particle_size = tamanho
    st.size_random = aleatorio
    st.use_rotations = True
    st.rotation_mode = "GLOB_Z"
    st.phase_factor_random = 2.0      # cada uma virada para o seu lado
    st.child_type = "NONE"
    tex = bpy.data.textures.new("d_" + nome, type="IMAGE")
    tex.image = bpy.data.images.load(os.path.join(S, mapa))
    tex.image.colorspace_settings.name = "Non-Color"
    slot = st.texture_slots.add()
    slot.texture = tex
    slot.texture_coords = "UV"
    slot.use_map_density = True
    slot.use_map_time = False
    slot.density_factor = 1.0
    return st


if os.environ.get("ILHA_PLANTAS", "1") == "1":
    espalhar("mata", ARVORES, "d_mata.png", int(amb("ILHA_N_ARVORES", 34000)), 1.0)
    espalhar("pedras", ROCHAS, "d_pedras.png", int(amb("ILHA_N_PEDRAS", 9000)), 1.0, 0.7)

# ---- luz --------------------------------------------------------------------
bpy.ops.object.light_add(type="SUN", location=(0, 0, 10))
sol = bpy.context.object
sol.data.energy = SOL_FORCA
sol.data.angle = 0.08
sol.data.color = (1.0, 0.95, 0.86)
sol.rotation_euler = (SOL_ALT, 0.0, SOL_AZ)

mundo = bpy.data.worlds.new("ceu")
cena.world = mundo
mundo.use_nodes = True
fundo = mundo.node_tree.nodes["Background"]
fundo.inputs["Color"].default_value = (0.40, 0.50, 0.60, 1.0)
fundo.inputs["Strength"].default_value = CEU_FORCA

# ---- a câmara: ORTOGRÁFICA INCLINADA, e o chão continua no sítio ------------
# O TRUQUE, que é o que permite ter profundidade sem partir o jogo:
#
# Uma câmara ortográfica projeta o mundo de forma AFIM, a qualquer ângulo. Um
# ponto do chão (x, y, 0) visto com inclinação θ cai em (x, y·cos θ). Ou seja: o
# chão não se deforma, só encolhe em Y por um fator conhecido. Se ANTES disso eu
# esticar o terreno em Y por 1/cos θ, as duas operações anulam-se e cada ponto do
# chão volta exatamente ao pixel onde estava — a escala 1.17613 continua válida e
# nenhuma aldeia sai do lugar.
#
# O que NÃO se anula é a altura: um ponto a z sobe z·sin θ no ecrã. As serras
# passam a ter perfil, as árvores ganham corpo, e vê-se o lado das coisas em vez
# de só o topo. É a diferença entre uma fotografia de satélite e uma paisagem.
#
# O preço: o que é alto tapa o que está atrás. Acima de uns 30° uma serra começa
# a esconder terreno, e num mapa de jogo isso custa. Por isso é um botão.
INCLINA = amb("ILHA_INCLINA", 0.0)          # radianos
if INCLINA > 0.001:
    terreno.scale = (1.0, 1.0 / math.cos(INCLINA), 1.0)
D = 40.0
bpy.ops.object.camera_add(
    location=(0, -D * math.sin(INCLINA), D * math.cos(INCLINA)),
    rotation=(INCLINA, 0, 0))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = UX
cam.data.clip_start, cam.data.clip_end = 1.0, 120.0
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
# O DENOISER COME O GRÃO. Ele não sabe distinguir ruído de amostragem de
# textura fina, e a fotografia de terreno é quase toda textura fina — a 96
# amostras ele limpa o ruído e leva o restolho atrás. Com amostras a mais vale
# mais desligá-lo.
cena.cycles.use_denoising = os.environ.get("ILHA_SUAVIZAR", "1") == "1"
cena.render.resolution_x, cena.render.resolution_y = LARG, ALT
cena.render.film_transparent = True
cena.render.image_settings.file_format = "PNG"
cena.render.image_settings.color_mode = "RGBA"
cena.view_settings.view_transform = "Standard"
cena.render.filepath = os.environ.get("ILHA_SAIDA", os.path.join(S, "ilha_render2.png"))
bpy.ops.render.render(write_still=True)
print("SONDA escrito", cena.render.filepath, LARG, "x", ALT, "|", AMOSTRAS, "amostras")
