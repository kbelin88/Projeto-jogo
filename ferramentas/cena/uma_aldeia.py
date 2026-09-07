# uma_aldeia.py — uma aldeia só, de perto, feita para ficar boa.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/uma_aldeia.py -- [largura_px] [amostras]
#
# Depois das duas aldeias vistas de longe, esta é a que serve para APRENDER: o
# quadro tem 130 m, portanto uma casa ocupa uns 120 px e passa a valer a pena
# dar-lhe carácter. É aqui que se descobre do que uma peça precisa, antes de as
# cozer todas em imagens para o jogo montar.
#
# NÃO É UMA QUINTA, É UMA PRAÇA-FORTE. A primeira versão tinha uma paliçada de
# estacas soltas e hortas por todo o lado — lia-se como jogo de cultivo. Uma
# aldeia deste jogo é tomada e defendida, e isso tem de estar na silhueta:
# muralha com espessura e adarve, duas torres mais altas que o muro, casa do
# portão, fosso, estandarte. As hortas ficaram, mas fora de portas.
#
# A ALDEIA É COMPOSTA, NÃO SORTEADA. As casas não caem em sítios aleatórios: há
# um largo com um poço ao centro, as casas viram a porta para o largo, os
# caminhos vão do portão ao largo e do largo a cada porta, as hortas ficam nas
# traseiras e o gado fica num curral encostado à paliçada. Uma aldeia sorteada
# lê-se como acampamento; uma aldeia composta lê-se como sítio onde vive gente.
import math
import os
import random
import sys
import time

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402
import relevo as R                                         # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
LARG = int(ARGS[0]) if ARGS else 1920
AMOSTRAS = int(ARGS[1]) if len(ARGS) > 1 else 180
SAIDA = os.environ.get("CENA_SAIDA", os.path.join(
    os.getcwd(), "ferramentas", "cena", "_saida", "uma_aldeia.png"))


def amb(nome, pad):
    return float(os.environ.get(nome, pad))


CAMPO_X = amb("CENA_LARGURA", 168.0)          # metros no quadro
CAMPO_Y = CAMPO_X * 9 / 16
SEM = int(os.environ.get("CENA_SEMENTE", 11))
rnd = random.Random(SEM)
t0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene

# ---- terreno -----------------------------------------------------------------
RAIO = 34.0                                   # raio da paliçada
print("SONDA t=%.2f  antes do terreno" % (time.time()-t0), flush=True)
T = R.Terreno(CAMPO_X * 3.4, CAMPO_Y * 4.6, celula=1.1, semente=SEM, amplitude=9.0)
T.patamar(0, 0, RAIO + 7, 22.0)               # a praça assenta num patamar
FOSSO_R = RAIO + 8.5
FOSSO_D = FOSSO_R - RAIO                      # do portão até ao meio do fosso

# a estrada chega de fora e entra pelo portão
ANG_PORTAO = math.radians(-64)
GX, GY = RAIO * math.cos(ANG_PORTAO), RAIO * math.sin(ANG_PORTAO)
fora = [(GX + math.cos(ANG_PORTAO) * d + math.sin(ANG_PORTAO) * math.sin(d * 0.05) * 9,
         GY + math.sin(ANG_PORTAO) * d - math.cos(ANG_PORTAO) * math.sin(d * 0.05) * 9)
        for d in range(0, 130, 6)]
ESTRADA = T.corredor(fora[1:], largura=6.0, borda=13.0)
# O FOSSO É CAVADO DEPOIS DA ESTRADA, e a ordem não é detalhe. Ao contrário, a
# estrada — que aplana o seu corredor — enchia o fosso exatamente no sítio por
# onde passa, e a ponte ficava a atravessar chão firme. Cavar por último deixa a
# vala aberta debaixo da ponte, que é o que se quer ver.
T.fosso(0, 0, FOSSO_R, largura=8.0, fundo=2.8)

print("SONDA t=%.2f  terreno gerado e cavado" % (time.time()-t0), flush=True)
co, quads = T.malha()
chao = P.malha_rapida("chao", co, quads, "relva")
print("SONDA t=%.2f  malha do chao no Blender (%d vertices)" % (time.time()-t0, len(co)), flush=True)
chao.data.materials.clear()

mat = bpy.data.materials.new("chao")
mat.use_nodes = True
nos, liga = mat.node_tree.nodes, mat.node_tree.links
princ = nos["Principled BSDF"]
princ.inputs["Roughness"].default_value = 0.95


def ruido(escala, detalhe=8.0):
    n = nos.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = escala
    n.inputs["Detail"].default_value = detalhe
    return n.outputs["Fac"]


# O CHÃO É DOIS MATERIAIS, NÃO UM. Relva onde há relva, terra onde a encosta é
# a pique ou onde o ruído manda — e a passagem entre eles feita por ruído, não
# por uma linha. Um chão de um material só lê-se como carpete, por melhor que
# seja a textura.
c_relva, r_relva, n_relva = P.carregar_tex(mat.node_tree, "relva", 3.4, 0.6,
                                           tinta=P.COR["relva"])
c_terra, r_terra, n_terra = P.carregar_tex(mat.node_tree, "terra", 2.8, 0.8,
                                           tinta=P.COR["terra"])
if c_relva is None:                                  # sem ficheiros, o padrão
    rampa = nos.new("ShaderNodeValToRGB")
    rampa.color_ramp.elements[0].position = 0.34
    rampa.color_ramp.elements[0].color = P.COR["relva"]
    rampa.color_ramp.elements[1].position = 0.72
    rampa.color_ramp.elements[1].color = P.COR["relva_seca"]
    liga.new(ruido(0.10), rampa.inputs["Fac"])
    c_relva = rampa.outputs["Color"]
if c_terra is None:
    t = nos.new("ShaderNodeRGB")
    t.outputs[0].default_value = P.COR["terra"]
    c_terra = t.outputs[0]

# quanto de terra: o declive manda, e um ruído largo desmancha a fronteira
geo = nos.new("ShaderNodeNewGeometry")
sep = nos.new("ShaderNodeSeparateXYZ")
liga.new(geo.outputs["Normal"], sep.inputs["Vector"])
decl = nos.new("ShaderNodeMapRange")
decl.inputs["From Min"].default_value = 0.990
decl.inputs["From Max"].default_value = 0.93
decl.clamp = True
liga.new(sep.outputs["Z"], decl.inputs["Value"])
calvas = nos.new("ShaderNodeMapRange")
calvas.inputs["From Min"].default_value = 0.56
calvas.inputs["From Max"].default_value = 0.72
calvas.clamp = True
liga.new(ruido(0.9, 6.0), calvas.inputs["Value"])
quanto = nos.new("ShaderNodeMath")
quanto.operation = "MAXIMUM"
liga.new(decl.outputs["Result"], quanto.inputs[0])
liga.new(calvas.outputs["Result"], quanto.inputs[1])

mist = nos.new("ShaderNodeMix")
mist.data_type = "RGBA"
liga.new(quanto.outputs["Value"], mist.inputs["Factor"])
liga.new(c_relva, mist.inputs[6])
liga.new(c_terra, mist.inputs[7])
liga.new(mist.outputs["Result"], princ.inputs["Base Color"])

if r_relva and r_terra:
    mr = nos.new("ShaderNodeMix")
    mr.data_type = "FLOAT"
    liga.new(quanto.outputs["Value"], mr.inputs["Factor"])
    liga.new(r_relva, mr.inputs[2])
    liga.new(r_terra, mr.inputs[3])
    liga.new(mr.outputs[0], princ.inputs["Roughness"])
if n_relva:
    liga.new(n_relva, princ.inputs["Normal"])
elif n_terra:
    liga.new(n_terra, princ.inputs["Normal"])
else:
    bump = nos.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    liga.new(ruido(6.0, 6.0), bump.inputs["Height"])
    liga.new(bump.outputs["Normal"], princ.inputs["Normal"])

chao.data.materials.append(mat)
bpy.context.view_layer.objects.active = chao
bpy.ops.object.shade_smooth()


def z(x, y):
    return T.altura(x, y)


# ---- protótipos (bpy.ops só aqui) -------------------------------------------
CASAS = [P.proto_casa2(7.6, 5.8, 2.9, "colmo", "reboco"),
         P.proto_casa2(9.0, 6.2, 3.1, "colmo2", "reboco2"),
         P.proto_casa2(6.8, 5.4, 2.8, "colmo", "reboco2"),
         P.proto_casa2(8.2, 6.0, 3.0, "colmo2", "reboco", False)]
CELEIRO = P.proto_celeiro2()
POCO = P.proto_poco()
MURO = P.proto_muro(4.4, 4.4)
TORRE = P.proto_torre_muro(13.5)
PORTAO = P.proto_casa_portao(16.0, 5.2)
PONTE = P.proto_ponte(15.0, 6.4)
FOLHA = P.proto_folha_portao(5.2, 4.8)
ESTANDARTE = P.proto_estandarte(6.5, "pano_azul")
MURO_PEDRA = P.proto_muro_pedra(4.2, 2.6)
ALVO = P.proto_alvo()
LANCAS = P.proto_lancas()
CERCA = P.proto_cerca(4.0)
CARROCA = P.proto_carroca()
LENHA = P.proto_lenha()
MEDA = P.proto_meda()
HORTA = P.proto_horta(6.5, 4.2)
OVELHA = P.proto_ovelha()
PINHEIROS = [P.proto_arvore(8.5, "folha"),
             P.proto_arvore(7.0, "folha2", ((0.55, 1.0), (0.80, 0.62)))]
FOLHOSAS = [P.proto_arvore_folha(9.5, "folha2"), P.proto_arvore_folha(7.5, "folha3")]
ARBUSTOS = [P.proto_arbusto(0.9, "folha3"), P.proto_arbusto(0.6, "folha2")]
PENEDO = P.proto_penedo(1.4)
print("SONDA prototipos em %.1f s" % (time.time() - t0), flush=True)

# ---- o largo, e as casas viradas para ele ------------------------------------
LARGO = 9.0
CASAS_POSTAS = []
N = 9
for i in range(N):
    a = 2 * math.pi * i / N + 0.22 + rnd.uniform(-0.08, 0.08)
    d = RAIO * (0.52 + 0.18 * rnd.random())
    if abs(((a - ANG_PORTAO + math.pi) % (2 * math.pi)) - math.pi) < 0.30:
        continue                                   # não tapar o portão
    x, y = d * math.cos(a), d * math.sin(a)
    rz = math.atan2(-y, -x) - math.pi / 2          # a porta vira para o largo
    P.onde(CASAS[i % 4], x, y, z(x, y) - 0.3, rz, 0.94 + 0.16 * rnd.random())
    CASAS_POSTAS.append((x, y, a))

# celeiro e poço
ac = ANG_PORTAO + math.pi * 0.72
xc, yc = RAIO * 0.60 * math.cos(ac), RAIO * 0.60 * math.sin(ac)
P.onde(CELEIRO, xc, yc, z(xc, yc) - 0.3, math.atan2(-yc, -xc) - math.pi / 2, 0.95)
P.onde(POCO, 1.5, -0.8, z(1.5, -0.8) - 0.15, 0.4)

# ---- caminhos: do portão ao largo, e do largo a cada porta -------------------


def fita(pts, largura, alto, cor):
    v, f = [], []
    for i, pt in enumerate(pts):
        x, y = pt[0], pt[1]
        j0, j1 = max(0, i - 1), min(len(pts) - 1, i + 1)
        tx, ty = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
        L = max(math.hypot(tx, ty), 1e-6)
        nx, ny = -ty / L, tx / L
        w = largura * (0.84 + 0.30 * math.sin(i * 1.7))
        for lado in (1, -1):
            ex, ey = x + nx * w / 2 * lado, y + ny * w / 2 * lado
            v.append((ex, ey, z(ex, ey) + alto))
        if i:
            k = 2 * i
            f.append((k - 2, k - 1, k + 1, k))
    return P._malha("caminho", v, f, cor, bisel=0)


fita(ESTRADA, 5.6, 0.06, "caminho")
bpy.ops.mesh.primitive_circle_add(vertices=24, radius=LARGO, fill_type="NGON",
                                  location=(0, 0, z(0, 0) + 0.05))
P._novo(bpy.context.object, "caminho", 0)
for x, y, a in CASAS_POSTAS:                      # trilho do largo até cada porta
    passos = [(LARGO * 0.8 * math.cos(a) * t + x * (1 - t) * 0 + x * t * 0,
               0) for t in ()]                    # (placeholder legível abaixo)
    pts = []
    for k in range(7):
        t = k / 6
        px = (LARGO * 0.75 * math.cos(a)) * (1 - t) + x * 0.72 * t
        py = (LARGO * 0.75 * math.sin(a)) * (1 - t) + y * 0.72 * t
        pts.append((px + math.sin(t * 4) * 0.7, py + math.cos(t * 4) * 0.7))
    fita(pts, 2.4, 0.07, "caminho")

# ---- a muralha, as torres e a casa do portao ---------------------------------
# UMA implementacao so, em `pecas.muralha`. Estava escrita duas vezes, aqui e no
# outro ficheiro, e as duas copias ja tinham divergido — foi dai que veio a falha
# entre o muro e o portao.
_panos, (gx, gy, zg) = P.muralha(
    MURO, TORRE, PORTAO, FOLHA, RAIO, ANG_PORTAO,
    [ANG_PORTAO + 2.05, ANG_PORTAO - 2.05], z,
    abertura=amb("PORTAO_ABERTO", 0.0))

# a ponte sobre o fosso, alinhada com a saida do portao
# no CENTRO do fosso, que e o que ela existe para atravessar
px = gx + math.cos(ANG_PORTAO) * FOSSO_D
py = gy + math.sin(ANG_PORTAO) * FOSSO_D
P.onde(PONTE, px, py, zg, ANG_PORTAO)

# ---- curral, hortas, alfaias --------------------------------------------------
ap = ANG_PORTAO + math.pi * 1.28
cx, cy = RAIO * 0.63 * math.cos(ap), RAIO * 0.63 * math.sin(ap)
lado = 9.0
canto = [(cx - lado, cy - lado * 0.7), (cx + lado, cy - lado * 0.7),
         (cx + lado, cy + lado * 0.7), (cx - lado, cy + lado * 0.7)]
P.enfileirar(CERCA, canto, 4.0, z, fechado=True)
for i in range(7):
    ox = cx + rnd.uniform(-lado * 0.8, lado * 0.8)
    oy = cy + rnd.uniform(-lado * 0.55, lado * 0.55)
    P.onde(OVELHA, ox, oy, z(ox, oy), rnd.random() * 6.3, 0.9 + 0.25 * rnd.random())

# o terreiro de treino, encostado ao portão: é o que diz guarnição
tt = ANG_PORTAO + 0.95
ax, ay = RAIO * 0.60 * math.cos(tt), RAIO * 0.60 * math.sin(tt)
P.onde(ALVO, ax, ay, z(ax, ay), rnd.random() * 6.3)
P.onde(ALVO, ax + 3.4, ay + 1.2, z(ax + 3.4, ay + 1.2), rnd.random() * 6.3)
P.onde(LANCAS, ax - 3.0, ay + 2.6, z(ax - 3.0, ay + 2.6), tt)
P.onde(ESTANDARTE, 6.2, 5.0, z(6.2, 5.0), 0.7)

# o celeiro ganha um recinto de pedra: mistura os dois materiais, como pedido
rp = ANG_PORTAO + math.pi * 0.72
px0, py0 = RAIO * 0.60 * math.cos(rp), RAIO * 0.60 * math.sin(rp)
quad = [(px0 - 7, py0 - 6), (px0 + 8, py0 - 6), (px0 + 8, py0 + 6), (px0 - 7, py0 + 6)]
P.enfileirar(MURO_PEDRA, quad[:2] + quad[2:3], 4.2, z)

for i in range(3):
    a = rnd.random() * 6.3
    d = RAIO * (0.30 + 0.3 * rnd.random())
    mx, my = d * math.cos(a), d * math.sin(a)
    P.onde(MEDA, mx, my, z(mx, my), rnd.random() * 6.3, 0.85 + 0.3 * rnd.random())
for proto, quantos in ((CARROCA, 2), (LENHA, 4)):
    for i in range(quantos):
        a = rnd.random() * 6.3
        d = RAIO * (0.34 + 0.32 * rnd.random())
        px, py = d * math.cos(a), d * math.sin(a)
        P.onde(proto, px, py, z(px, py), rnd.random() * 6.3)

# ---- fora da paliçada: campos, mata, arbustos --------------------------------
for i in range(4):                                # hortas, agora fora de portas
    a = 2 * math.pi * i / 4 + 1.1
    d = RAIO + 17 + rnd.random() * 6
    hx, hy = d * math.cos(a), d * math.sin(a)
    if T.declive(hx, hy) < 0.2:
        P.onde(HORTA, hx, hy, z(hx, hy) + 0.02, a + math.pi / 2)
for i in range(6):
    a = 2 * math.pi * i / 6 + 0.4
    d = RAIO + 30 + rnd.random() * 14
    fx, fy = d * math.cos(a), d * math.sin(a)
    if T.declive(fx, fy) > 0.20:
        continue
    o = P.campo(fx, fy, 20 + rnd.random() * 12, 14 + rnd.random() * 8, a,
                "trigo" if rnd.random() < 0.6 else "lavrado")
    o.location = (fx, fy, z(fx, fy))


def livre(x, y, folga=6.0):
    if math.hypot(x, y) < RAIO + folga + 22:
        return False
    for ex, ey, _ in ESTRADA[::2]:
        if (x - ex) ** 2 + (y - ey) ** 2 < 64:
            return False
    return True


arv = arb = 0
for i in range(int(amb("CENA_MATA", 14000))):
    x = (rnd.random() - 0.5) * CAMPO_X * 2.8
    y = (rnd.random() - 0.5) * CAMPO_Y * 3.6
    if not livre(x, y):
        continue
    borda = max(abs(x) / (CAMPO_X * 0.58), abs(y) / (CAMPO_Y * 0.62))
    if rnd.random() > 0.02 + borda ** 3 * 1.5:
        continue
    if rnd.random() < 0.34:
        P.onde(FOLHOSAS[i % 2], x, y, z(x, y) - 0.5, rnd.random() * 6.3,
               0.7 + rnd.random() * 0.5)
    else:
        P.onde(PINHEIROS[i % 2], x, y, z(x, y) - 0.5, rnd.random() * 6.3,
               0.72 + rnd.random() * 0.6)
    arv += 1
for i in range(int(amb("CENA_ARBUSTOS", 1500))):
    x = (rnd.random() - 0.5) * CAMPO_X * 2.6
    y = (rnd.random() - 0.5) * CAMPO_Y * 3.2
    if math.hypot(x, y) < RAIO - 2:
        continue
    P.onde(ARBUSTOS[i % 2], x, y, z(x, y) - 0.2, rnd.random() * 6.3,
           0.5 + rnd.random() * 0.9)
    arb += 1
for i in range(260):
    x = (rnd.random() - 0.5) * CAMPO_X * 2.4
    y = (rnd.random() - 0.5) * CAMPO_Y * 3.0
    if livre(x, y, 2.0):
        P.onde(PENEDO, x, y, z(x, y) - 0.3, rnd.random() * 6.3, 0.4 + rnd.random() * 1.1)
print("SONDA povoada em %.1f s | %d arvores, %d arbustos" % (time.time() - t0, arv, arb),
      flush=True)

# ---- luz e atmosfera ---------------------------------------------------------
# TRÊS COISAS, e a ordem de importância é esta:
#
#  1. A ALTURA DO SOL. É ela que dá a sombra comprida, e é a sombra comprida que
#     separa cada casa do chão e cada árvore da mata. Ao meio-dia tudo fica
#     achatado — não por falta de detalhe, por falta de sombra.
#  2. O CÉU A SÉRIO, e não uma cor chapada. O nó de céu do Blender calcula a cor
#     do ar para uma dada altura do sol: ao fim da tarde fica laranja no
#     horizonte e azul no zénite, e é ESSE azul que enche as sombras. Uma sombra
#     cheia de azul lê-se como sombra; uma sombra cinzenta lê-se como sujidade.
#  3. A NÉVOA. Umas partículas no ar e o que está longe perde contraste. É o que
#     dá profundidade a uma imagem sem lhe mexer na geometria — e nós temos a
#     câmara ortográfica, que por definição não tem perspetiva nenhuma para
#     ajudar. Aqui a névoa faz o trabalho que a perspetiva faria.
HORA = os.environ.get("CENA_HORA", "tarde")
HORAS = {                      # (altura do sol acima do horizonte, azimute, força)
    "meiodia": (math.radians(62), 2.05, 4.6),
    "tarde":   (math.radians(24), 2.22, 5.4),
    "poente":  (math.radians(11), 2.38, 6.2),
    "manha":   (math.radians(31), -0.75, 4.8),
}
ELEV, AZIM, FORCA = HORAS.get(HORA, HORAS["tarde"])
ELEV = amb("SOL_ELEV", ELEV)
AZIM = amb("SOL_AZ", AZIM)

bpy.ops.object.light_add(type="SUN", location=(0, 0, 200))
sol = bpy.context.object
sol.data.energy = amb("SOL_FORCA", FORCA)
sol.data.angle = 0.055                       # o disco do sol: sombra com beira macia
sol.data.color = (1.0, 0.86, 0.66) if ELEV < 0.55 else (1.0, 0.95, 0.86)
# rotação do sol: o eixo X é o ângulo a partir do zénite, portanto pi/2 - elevação
sol.rotation_euler = (math.pi / 2 - ELEV, 0.0, AZIM)

mundo = bpy.data.worlds.new("ceu")
cena.world = mundo
mundo.use_nodes = True
nm, lm = mundo.node_tree.nodes, mundo.node_tree.links
fundo = nm["Background"]
ceu = nm.new("ShaderNodeTexSky")
try:
    ceu.sky_type = "NISHITA"
    ceu.sun_elevation = ELEV
    ceu.sun_rotation = AZIM
    ceu.sun_disc = False                     # o sol já é a lâmpada; dois seria a dobrar
    ceu.altitude = 250.0
    ceu.air_density = amb("CEU_AR", 1.4)
    ceu.dust_density = amb("CEU_PO", 2.2)    # o pó é o que torna o poente laranja
except Exception:
    pass
lm.new(ceu.outputs["Color"], fundo.inputs["Color"])
fundo.inputs["Strength"].default_value = amb("CEU_FORCA", 0.65)

# A NÉVOA VAI NUMA CAIXA, NÃO NO MUNDO.
# A primeira versão ligou o `Volume Scatter` ao volume do MUNDO e a cena inteira
# saiu preta — as quatro horas do dia iguais, média 0,08 em 255. A causa não é
# um valor mal posto: um volume de mundo no Cycles é INFINITO, e o sol é uma luz
# infinitamente distante. Os raios do sol atravessam profundidade ótica infinita
# antes de chegarem seja ao que for, e extinguem-se por completo. Não há
# densidade pequena que safe isso; o erro é de topologia, não de afinação.
# Dentro de uma caixa há um princípio e um fim, e a conta fecha.
# DESLIGADA POR OMISSÃO, e a razão é física: a cena tem 168 m de largura, e a
# 168 m de distância o ar não tira contraste nenhum. Medido: mesmo à densidade
# mais baixa que testei, o desvio-padrão da imagem caía de 60,7 para 42,6 — 30%
# do contraste, deitado fora para simular uma coisa que a esta escala não
# acontece. Fica como botão para os planos LARGOS (o mapa da Ibéria, onde as
# distâncias são de centenas de quilómetros e a névoa é o que faz a distância
# ler-se).
NEVOA = amb("CENA_NEVOA", 0.0)
if NEVOA > 0:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 26))
    caixa = bpy.context.object
    caixa.scale = (T.larg * 0.98, T.comp * 0.98, 90.0)
    ar = bpy.data.materials.new("ar")
    ar.use_nodes = True
    na, la = ar.node_tree.nodes, ar.node_tree.links
    na.remove(na["Principled BSDF"])
    disp = na.new("ShaderNodeVolumeScatter")
    disp.inputs["Color"].default_value = (0.66, 0.76, 0.90, 1.0)
    disp.inputs["Density"].default_value = NEVOA
    disp.inputs["Anisotropy"].default_value = 0.35
    la.new(disp.outputs["Volume"], na["Material Output"].inputs["Volume"])
    caixa.data.materials.append(ar)
    caixa.visible_shadow = False

# ---- câmara -------------------------------------------------------------------
INCLINA = amb("CENA_INCLINA", math.radians(52))
GIRO = amb("CENA_GIRO", math.radians(26))
# para onde a câmara aponta. Serve para aproximar sem mexer na cena: o
# enquadramento é uma decisão de vista, não de conteúdo.
ALVO = (amb("CENA_ALVO_X", 0.0), amb("CENA_ALVO_Y", 0.0))
D = 400.0
bpy.ops.object.camera_add(
    location=(ALVO[0] + D * math.sin(INCLINA) * math.sin(GIRO),
              ALVO[1] - D * math.sin(INCLINA) * math.cos(GIRO),
              z(ALVO[0], ALVO[1]) + D * math.cos(INCLINA)),
    rotation=(INCLINA, 0, GIRO))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = CAMPO_X
cam.data.clip_start, cam.data.clip_end = 10.0, 1200.0
cena.camera = cam

# ---- render -------------------------------------------------------------------
# MOTOR: Cycles traça raios de luz um a um (fisicamente correto, lento) e o
# EEVEE rasteriza (aproximado, quase instantâneo). O EEVEE serve para COMPOR —
# ver se a casa está no sítio, se a sombra cai para o lado certo — e o Cycles
# para a imagem final. Trocar de um para o outro é uma variável.
MOTOR = os.environ.get("CENA_MOTOR", "CYCLES").upper()
if MOTOR.startswith("EEVEE"):
    cena.render.engine = "BLENDER_EEVEE"
    try:
        cena.eevee.taa_render_samples = max(16, AMOSTRAS // 4)
        cena.eevee.use_shadows = True
    except Exception:
        pass
else:
    bpy.ops.preferences.addon_enable(module="cycles")
    cena.render.engine = "CYCLES"
prefs = (bpy.context.preferences.addons["cycles"].preferences
         if MOTOR == "CYCLES" else None)
for tipo in (("OPTIX", "CUDA") if prefs else ()):
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

if MOTOR == "CYCLES":
    cena.cycles.samples = AMOSTRAS
    cena.cycles.use_denoising = True
cena.render.resolution_x = LARG
cena.render.resolution_y = int(LARG * 9 / 16)
cena.render.image_settings.file_format = "PNG"
# GESTÃO DE COR: "Standard" mostra os números como são e queima o que passa de
# 1,0 — com sol baixo, o telhado virado ao sol vira uma mancha branca. O "AgX"
# dobra as altas luzes como uma película e mantém a cor lá dentro. Custa
# saturação, que se devolve com o `look`.
cena.view_settings.view_transform = os.environ.get("CENA_COR", "AgX")
try:
    cena.view_settings.look = os.environ.get("CENA_LOOK", "AgX - Medium High Contrast")
except Exception:
    pass
cena.render.filepath = SAIDA
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
print("SONDA t=%.2f  cena pronta, a comecar o render" % (time.time()-t0), flush=True)
bpy.ops.render.render(write_still=True)
print("SONDA aldeia escrita: %s  %dx%d | %s | %d amostras | %.1f s"
      % (SAIDA, cena.render.resolution_x, cena.render.resolution_y,
         MOTOR, AMOSTRAS, time.time() - t0))
