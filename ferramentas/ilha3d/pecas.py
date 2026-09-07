# pecas.py — as peças do mapa (aldeia, torre, castelo) construídas no Blender.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/ilha3d/pecas.py -- [lado] [amostras]
#
# POR QUE REFAZER: os sprites de hoje foram gerados um a um e por isso têm três
# luzes diferentes, três paletas e três bases. O castelo assenta num monte de
# pedra, a torre no chão liso, a aldeia numa plataforma de terra — nenhuma delas
# assenta no mapa da mesma maneira. Construídas aqui, todas partilham:
#
#   * A MESMA CÂMARA isométrica (30° de elevação, 45° de rotação), portanto as
#     três encaixam no mesmo mapa sem uma parecer inclinada em relação à outra.
#   * O MESMO SOL da ilha (render2.py), portanto a sombra da torre cai para o
#     mesmo lado da sombra da serra atrás dela. É esta a diferença que se vê sem
#     se saber porquê.
#   * A MESMA BASE: um disco de terra batida do mesmo tamanho, para o jogo poder
#     assentar todas na âncora sem correções por peça.
#
# A saída é PNG com alfa, base ao centro-baixo, como o desenharSprite() espera.
import math
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
LADO = int(ARGS[0]) if ARGS else 512
AMOSTRAS = int(ARGS[1]) if len(ARGS) > 1 else 64

AQUI = os.path.join(os.getcwd(), "ferramentas", "ilha3d")
SAIDA = os.path.join(AQUI, "_saida", "pecas")
os.makedirs(SAIDA, exist_ok=True)

# o sol da ilha, rodado com a câmara: azimute 2,45 + 45° para a luz cair no
# mesmo canto do ecrã que cai no mapa
SOL_ALT, SOL_AZ = 0.62, 2.45 + math.pi / 4

COR = {
    "madeira":   (0.118, 0.062, 0.026, 1),
    "madeira2":  (0.176, 0.100, 0.042, 1),
    "colmo":     (0.310, 0.196, 0.058, 1),
    "telha":     (0.215, 0.066, 0.030, 1),
    "pedra":     (0.330, 0.300, 0.244, 1),   # quente e CLARA: escura virava massa preta
    "pedra2":    (0.238, 0.212, 0.168, 1),
    "terra":     (0.112, 0.084, 0.046, 1),
    "relva":     (0.078, 0.116, 0.036, 1),
}


VARIA = {"pedra": 0.16, "pedra2": 0.16, "madeira": 0.13, "madeira2": 0.13,
         "colmo": 0.10, "telha": 0.10}
_conta = {}


def material(nome, rugosidade=0.92):
    """cada chamada devolve um tom LIGEIRAMENTE diferente do mesmo material.

    Uma muralha inteira de um cinzento só lê-se como esferovite. Com ±15% de
    variação entre blocos, a mesma geometria passa a parecer pedra assente.
    """
    v = VARIA.get(nome, 0.0)
    if v:
        i = _conta[nome] = _conta.get(nome, 0) + 1
        chave = "M_%s_%02d" % (nome, i % 9)
    else:
        chave = "M_" + nome
    m = bpy.data.materials.get(chave)
    if m:
        return m
    m = bpy.data.materials.new(chave)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    base = COR[nome]
    if v:
        f = 1.0 + v * (((_conta[nome] * 7919) % 17) / 8.0 - 1.0)
        base = (base[0] * f, base[1] * f, base[2] * f, 1)
    p.inputs["Base Color"].default_value = base
    p.inputs["Roughness"].default_value = rugosidade
    if "Specular IOR Level" in p.inputs:
        p.inputs["Specular IOR Level"].default_value = 0.10
    return m


def vestir(obj, nome, suave=False, bisel=0.014):
    obj.data.materials.append(material(nome))
    if bisel:
        b = obj.modifiers.new("bisel", "BEVEL")
        b.width = bisel
        b.segments = 2
        b.limit_method = "ANGLE"
        b.angle_limit = 0.52
    if suave:
        bpy.ops.object.shade_smooth()
    return obj


def caixa(x, y, z, sx, sy, sz, rz=0.0, cor="madeira"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    o = bpy.context.object
    o.scale = (sx, sy, sz)
    o.rotation_euler = (0, 0, rz)
    return vestir(o, cor)


def cilindro(x, y, z, r, h, cor="madeira", lados=16, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=lados, radius=r, depth=h,
                                            location=(x, y, z))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=lados, radius1=r, radius2=r2,
                                        depth=h, location=(x, y, z))
    return vestir(bpy.context.object, cor)


def piramide(x, y, z, r, h, cor="colmo", lados=4, rz=math.pi / 4):
    bpy.ops.mesh.primitive_cone_add(vertices=lados, radius1=r, radius2=0.0,
                                    depth=h, location=(x, y, z))
    o = bpy.context.object
    o.rotation_euler = (0, 0, rz)
    return vestir(o, cor)


# ---- as peças ---------------------------------------------------------------

def chao(raio=2.30):
    """o disco de terra batida: a MESMA base para as três peças"""
    cilindro(0, 0, -0.05, raio, 0.10, "terra", lados=28)
    cilindro(0, 0, -0.12, raio * 1.06, 0.10, "relva", lados=28)


def paliçada(raio, n=30, altura=0.90, aberta=True):
    """estacas em círculo, com um portão virado para a câmara"""
    for i in range(n):
        ang = 2 * math.pi * i / n
        # o portão: um vão do lado que dá para o observador
        if aberta and abs(((ang - math.pi * 1.25 + math.pi) % (2 * math.pi)) - math.pi) < 0.22:
            continue
        h = altura * (0.90 + 0.20 * ((i * 7919) % 11) / 10.0)
        x, y = raio * math.cos(ang), raio * math.sin(ang)
        cilindro(x, y, h / 2, 0.075, h, "madeira" if i % 3 else "madeira2", lados=6)
        piramide(x, y, h + 0.05, 0.075, 0.12, "madeira2", lados=6, rz=0)


def cabana(x, y, esc=1.0, rz=0.0, cor_teto="colmo"):
    caixa(x, y, 0.24 * esc, 0.62 * esc, 0.46 * esc, 0.48 * esc, rz, "madeira2")
    piramide(x, y, 0.48 * esc + 0.20 * esc, 0.58 * esc, 0.42 * esc, cor_teto, 4, rz + math.pi / 4)


def peça_aldeia():
    chao()
    paliçada(1.90, n=24, altura=0.85)
    cabana(-0.55, 0.30, 1.05, 0.15)
    cabana(0.72, -0.12, 0.92, -0.35)
    cabana(0.05, -0.95, 0.80, 0.55)
    # o poço: dá escala e diz "isto é habitado", que uma caixa com telhado não diz
    cilindro(-0.15, 1.10, 0.16, 0.22, 0.32, "pedra", lados=12)
    caixa(-0.15, 1.10, 0.52, 0.05, 0.05, 0.36, 0, "madeira")
    piramide(-0.15, 1.10, 0.78, 0.34, 0.20, "colmo", 4, math.pi / 4)


def peça_torre():
    chao()
    paliçada(1.90, n=24, altura=0.95)
    # os quatro pernos
    for sx in (-1, 1):
        for sy in (-1, 1):
            cilindro(sx * 0.46, sy * 0.46, 1.05, 0.085, 2.10, "madeira", lados=8)
    # travessas, duas alturas: sem elas a torre parece quatro paus soltos
    for z in (0.62, 1.42):
        for sx in (-1, 1):
            caixa(sx * 0.46, 0, z, 0.05, 0.94, 0.045, 0, "madeira2")
            caixa(0, sx * 0.46, z, 0.94, 0.05, 0.045, 0, "madeira2")
    caixa(0, 0, 2.14, 1.30, 1.30, 0.10, 0, "madeira2")          # plataforma
    for i in range(4):                                            # guarda-corpo
        ang = math.pi / 2 * i
        caixa(0.62 * math.cos(ang), 0.62 * math.sin(ang), 2.42,
              1.30 if i % 2 else 0.09, 0.09 if i % 2 else 1.30, 0.46, 0, "madeira")
    piramide(0, 0, 2.86, 1.05, 0.62, "colmo", 4, math.pi / 4)     # cobertura
    cilindro(0, 0, 3.45, 0.045, 1.10, "madeira2", lados=6)        # mastro
    cabana(-1.25, -0.60, 0.72, 0.30)


def peça_castelo():
    chao(2.55)
    # o rochedo: o castelo domina, e domina por estar mais alto
    cilindro(0, 0, 0.42, 2.30, 0.86, "pedra2", lados=24, r2=1.86)
    # muralha em octógono, com ameias
    R, N = 1.66, 8
    for i in range(N):
        ang = 2 * math.pi * i / N + math.pi / N
        x, y = R * math.cos(ang), R * math.sin(ang)
        larg = 2 * R * math.tan(math.pi / N) + 0.26
        caixa(x, y, 1.46, 0.28, larg, 1.10, ang + math.pi / 2, "pedra")
        # ameias encostadas umas às outras: espaçadas viravam cubos soltos
        dx, dy = -math.sin(ang + math.pi / 2), math.cos(ang + math.pi / 2)
        for k in (-1.5, -0.5, 0.5, 1.5):
            caixa(x + dx * k * 0.30, y + dy * k * 0.30, 2.14,
                  0.28, 0.19, 0.28, ang + math.pi / 2, "pedra2")
    # torres de canto
    for i in range(4):
        ang = 2 * math.pi * i / 4 + math.pi / 4
        x, y = R * 1.05 * math.cos(ang), R * 1.05 * math.sin(ang)
        cilindro(x, y, 1.55, 0.40, 2.30, "pedra", lados=12)
        cilindro(x, y, 2.78, 0.48, 0.20, "pedra2", lados=12)
        piramide(x, y, 3.16, 0.52, 0.62, "telha", 12, 0)
    # a torre de menagem
    cilindro(0, 0, 2.10, 0.78, 3.40, "pedra", lados=12)
    cilindro(0, 0, 3.92, 0.90, 0.24, "pedra2", lados=12)
    piramide(0, 0, 4.52, 0.94, 0.98, "telha", 12, 0)
    cilindro(0, 0, 5.28, 0.05, 1.10, "madeira2", lados=6)          # mastro
    # o portão, virado ao observador
    ang = math.pi * 1.25
    caixa(R * 1.05 * math.cos(ang), R * 1.05 * math.sin(ang), 1.16,
          0.34, 0.74, 1.30, ang + math.pi / 2, "madeira")


PECAS = {"aldeia_v3": (peça_aldeia, 7.4), "torre_v3": (peça_torre, 8.6),
         "castelo_v3": (peça_castelo, 9.8)}


def montar_cena(quadro):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cena = bpy.context.scene

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 12))
    sol = bpy.context.object
    sol.data.energy = 5.8
    sol.data.angle = 0.09
    sol.data.color = (1.0, 0.95, 0.86)
    sol.rotation_euler = (SOL_ALT, 0.0, SOL_AZ)

    mundo = bpy.data.worlds.new("ceu")
    cena.world = mundo
    mundo.use_nodes = True
    f = mundo.node_tree.nodes["Background"]
    f.inputs["Color"].default_value = (0.46, 0.48, 0.50, 1.0)
    f.inputs["Strength"].default_value = 0.95

    # câmara isométrica de jogo: 30° de elevação, 45° de rotação
    bpy.ops.object.camera_add(location=(9, -9, 7.35),
                              rotation=(math.radians(60), 0, math.radians(45)))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = quadro
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
        if any(d.type == tipo for d in prefs.devices):
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
    cena.view_settings.view_transform = "Standard"
    return cena


for nome, (construir, quadro) in PECAS.items():
    cena = montar_cena(quadro)
    construir()
    cena.render.filepath = os.path.join(SAIDA, nome + ".png")
    bpy.ops.render.render(write_still=True)
    print("SONDA peca", nome, "->", cena.render.filepath)
print("SONDA fim", len(PECAS), "pecas em", SAIDA)
