# cozer.py — as povoações viram sprites com alfa, para o jogo montar.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/cozer.py -- [perfil] [cor] [lado_px] [amostras]
#
#   perfis: pequena  media  grande  capital        cores: neutra  azul  vermelha
#   sem perfil nem cor, coze a família inteira (4 x 3 = 12 sprites).
#
# ── É AQUI QUE A OPÇÃO (c) SE CUMPRE ─────────────────────────────────────────
# O Blender não corre dentro do jogo. O que o jogo recebe é ISTO: uma imagem com
# transparência, com a luz já assada, que o canvas desenha numa posição. É como
# o Age of Empires II, o Anno 1602 e o Caesar III funcionavam, e é o que nos
# deixa manter o motor determinístico e leve.
#
# TRÊS DECISÕES QUE ESTA PEÇA TOMA, e cada uma tem de bater certo com o jogo:
#
#  1. A PROJEÇÃO. Ortográfica, 60° a partir do zénite e 45° de rotação — a
#     isometria clássica de jogo. Se divergir, esta aldeia parece inclinada ao
#     lado das outras peças.
#  2. O SOL. O mesmo azimute e a mesma altura da cena grande, rodados com a
#     câmara. É o que faz a sombra desta povoação cair para o mesmo lado da
#     sombra de tudo o resto — a diferença que se vê sem se saber porquê.
#  3. A ÂNCORA. O jogo assenta o sprite pela BASE ao centro. Depois de se cortar
#     a moldura vazia o centro deixa de estar no meio da imagem, portanto ele é
#     gravado num .json ao lado — ver `recortar_sprite.py`.
#
# ── E POR QUE UMA FAMÍLIA E NÃO UMA PEÇA ─────────────────────────────────────
# O mapa tem 24 povoações e já as distingue: 12 pequenas, 6 médias, 4 grandes e
# 2 capitais. Vinte e quatro cópias da mesma peça ficariam PIOR do que os sprites
# antigos, porque a repetição lê-se de imediato e denuncia o truque. Como tudo é
# paramétrico, a família custa quase o mesmo que uma peça: muda o raio, o número
# de casas, o tipo de muro e quantas torres.
import json
import math
import os
import random
import subprocess
import sys
import time

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402

# ── UMA ALDEIA POR CIDADE, E NÃO UMA POR TAMANHO ─────────────────────────────
# O portão tem de dar para a estrada, e uma cidade pode ter de duas a seis
# estradas — portanto a peça depende da CIDADE, não só do seu tamanho. Isto tem
# duas consequências, e as duas são boas:
#   * cada uma das 24 povoações fica visualmente única, o que mata de vez o
#     problema da repetição;
#   * o portão passa a apontar para onde as tropas de facto saem.
# O preço é cozer 24 x 3 em vez de 4 x 3. A ~16 s cada, são uns vinte minutos —
# uma vez.
REDE = json.loads(subprocess.run(
    ["node", "-e", "const W=require('./world-iberia.js');"
     "const g={};for(const c of W.CIDADES)g[c.id]=[];"
     "for(const e of W.ESTRADAS){if(g[e.de])g[e.de].push(e.para);"
     "if(g[e.para])g[e.para].push(e.de);}"
     # as ESTRADAS vao inteiras, com a curva autoral: e o `via` que faz a
     # fita do mapa 3D dobrar pelo mesmo sitio por onde o desenho 2D dobra
     "console.log(JSON.stringify({c:Object.fromEntries(W.CIDADES.map("
     "c=>[c.id,{x:c.x,y:c.y,t:c.tamanho,nome:c.nome,papel:c.papel}])),v:g,"
     "e:W.ESTRADAS.map(e=>({de:e.de,para:e.para,via:e.via||null}))}))"],
    capture_output=True, text=True, check=True, cwd=os.getcwd()).stdout)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NOMES = [a for a in ARGS if not a.isdigit()]
NUM = [a for a in ARGS if a.isdigit()]
LADO = int(NUM[0]) if NUM else 1024
AMOSTRAS = int(NUM[1]) if len(NUM) > 1 else 200

PERFIS = {
    "pequena": dict(raio=20.0, casas=4, torres=0, muro="estacas",
                    portao="simples", menagem=False),
    "media":   dict(raio=26.0, casas=6, torres=1, muro="madeira",
                    portao="casa", menagem=False),
    "grande":  dict(raio=34.0, casas=9, torres=2, muro="madeira",
                    portao="casa", menagem=False),
    "capital": dict(raio=42.0, casas=12, torres=4, muro="madeira",
                    portao="casa", menagem=True),
}
# ── DEIXOU DE HAVER CORES ────────────────────────────────────────────────────
# O pano do Rei era o eixo que mais multiplicava: 24 cidades x 3 cores = 72
# renders, e numa expansão com seis Reis seriam 168 — tudo para desenhar uma
# bandeira diferente, que não muda a forma de nada. Agora coze-se a povoação
# NEUTRA e o cozedor grava onde ficaram os mastros; o jogo hasteia a cor de quem
# for dono. 24 renders, e um sétimo Rei custa zero.
#
# ── E AS CAPITAIS FICAM DE FORA (decisão do Lucas, 07/09) ────────────────────
# Lisboa e Barcelona continuam com o castelo antigo enquanto a peça da capital
# não convencer. Ficam listadas aqui, e não espalhadas por condições no jogo.
DE_FORA = {"lisboa", "barcelona"}


def amb(nome, pad):
    return float(os.environ.get(nome, pad))


# ── QUANTOS PORTOES ─────────────────────────────────────────────────────────
# Medido na rede v3: com 2/2/3/3, 32 das 74 pontas de estrada ficavam sem
# portao alinhado -- quase metade -- e essas acabavam no CENTRO da aldeia,
# atravessando a muralha. Subir um em cada tamanho tira a maior parte disso sem
# transformar o muro num crivo: a regra dos 31 graus de afastamento continua a
# recusar portoes encostados, portanto uma aldeia com duas estradas juntas
# continua a ter um portao so para as duas.
PORTOES_POR_TAMANHO = {"pequena": 3, "media": 3, "grande": 4, "capital": 4}


def rumos_de(cidade):
    """os ângulos, JÁ NA CENA, em que as estradas desta cidade saem.

    O mapa pensa em coordenadas de ecrã (y para baixo); a cena pensa em metros
    com y para cima e ainda leva o achatamento da isometria. A conversão é o
    `angulo_de_cena` — e não é só somar o giro da câmara: na projeção isométrica
    uma direção do chão aparece rodada E ACHATADA, portanto duas estradas a 90°
    no mapa não aparecem a 90° no sprite.
    """
    c = REDE["c"][cidade]
    saidas = []
    for outra in REDE["v"][cidade]:
        o = REDE["c"][outra]
        saidas.append(math.atan2(o["y"] - c["y"], o["x"] - c["x"]))
    return [P.angulo_de_cena(a) for a in saidas]


def construir(perfil, semente=11, cidade=None):
    """monta uma povoação inteira e devolve o quadro em metros que a enquadra"""
    cfg = PERFIS[perfil]
    raio = cfg["raio"]
    rnd = random.Random(semente + len(perfil) * 13)
    P.MASTROS_CENA.clear()
    P.PORTOES_CENA.clear()

    bpy.ops.wm.read_factory_settings(use_empty=True)
    P._mats.clear()
    P.LIXO = None
    if cidade:
        rumos = rumos_de(cidade)
        portoes_ang = P.escolher_portoes(rumos, PORTOES_POR_TAMANHO[perfil])
    else:
        portoes_ang = [math.radians(-64)]
    ang_portao = portoes_ang[0]

    def z(x, y):
        return 0.0                    # chão liso: o relevo é do mapa, não da peça

    # ---- o chão da peça: disco de terra com a orla irregular ----------------
    verts, faces = [], []
    N = 80
    for i in range(N):
        a = 2 * math.pi * i / N
        r = (raio + 6.0) * (0.94 + 0.10 * math.sin(a * 3.7 + 1.1) + 0.05 * math.sin(a * 7.3))
        verts.append((r * math.cos(a), r * math.sin(a), -0.15))
    verts.append((0.0, 0.0, -0.10))
    for i in range(N):
        faces.append((i, (i + 1) % N, N))
    P._novo_orla(P._malha("terreiro", verts, faces, "terra", bisel=0),
                 "terra", (raio + 6.0) * 0.98, (raio + 6.0) * 0.42)
    bpy.ops.mesh.primitive_circle_add(vertices=44, radius=raio + 1.5, fill_type="NGON",
                                      location=(0, 0, 0.04))
    P._novo(bpy.context.object, "caminho", 0)

    # ---- protótipos ---------------------------------------------------------
    CASAS = [P.proto_casa2(7.6, 5.8, 2.9, "colmo", "reboco"),
             P.proto_casa2(9.0, 6.2, 3.1, "colmo2", "reboco2"),
             P.proto_casa2(6.8, 5.4, 2.8, "colmo", "reboco2"),
             P.proto_casa2(8.2, 6.0, 3.0, "colmo2", "reboco", False)]
    CELEIRO = P.proto_celeiro2()
    POCO = P.proto_poco()
    MURO = (P.proto_muro_estacas(4.2, 3.0) if cfg["muro"] == "estacas"
            else P.proto_muro(4.4, 4.4))
    TORRE = P.proto_torre_muro(13.5)
    if cfg["portao"] == "simples":
        PORTAO, FOLHA = P.proto_portao_simples(4.2, 5.0), P.proto_folha_portao(4.2, 3.6)
    else:
        PORTAO, FOLHA = P.proto_casa_portao(16.0, 5.2), P.proto_folha_portao(5.2, 4.8)
    CARROCA, LENHA, MEDA = P.proto_carroca(), P.proto_lenha(), P.proto_meda()

    # ---- o largo e as casas viradas para ele --------------------------------
    for i in range(cfg["casas"]):
        a = 2 * math.pi * i / cfg["casas"] + 0.22 + rnd.uniform(-0.10, 0.10)
        d = raio * (0.50 + 0.20 * rnd.random())
        # não tapar NENHUM portão — a primeira versão só evitava o principal e
        # as casas encostavam-se aos postigos
        if any(abs(((a - g + math.pi) % (2 * math.pi)) - math.pi) < 0.30
               for g in portoes_ang):
            continue
        x, y = d * math.cos(a), d * math.sin(a)
        P.onde(CASAS[i % 4], x, y, -0.25, math.atan2(-y, -x) - math.pi / 2,
               0.92 + 0.18 * rnd.random())
    ac = ang_portao + math.pi * 0.72
    xc, yc = raio * 0.58 * math.cos(ac), raio * 0.58 * math.sin(ac)
    P.onde(CELEIRO, xc, yc, -0.25, math.atan2(-yc, -xc) - math.pi / 2, 0.95)
    if cfg["menagem"]:
        P.onde(P.proto_menagem(20.0, 7.0), 0, 0, -0.3, 0.5)
    else:
        P.onde(POCO, 1.5, -0.8, -0.1, 0.4)
    for proto, n in ((CARROCA, 2), (LENHA, 3), (MEDA, max(1, cfg["casas"] // 3))):
        for i in range(n):
            a = rnd.random() * 6.3
            d = raio * (0.32 + 0.34 * rnd.random())
            P.onde(proto, d * math.cos(a), d * math.sin(a), 0, rnd.random() * 6.3)

    # ---- os portões: o principal com casa, os outros como postigos -----------
    POSTIGO = P.proto_portao_simples(4.2, 5.0)
    POSTIGO_F = P.proto_folha_portao(4.2, 3.6)
    portoes = [(portoes_ang[0], PORTAO, FOLHA, 2.6 if cfg["portao"] == "casa" else 2.1)]
    for a in portoes_ang[1:]:
        portoes.append((a, POSTIGO, POSTIGO_F, 2.1))

    # ---- as torres: nos MAIORES VÃOS entre portões ---------------------------
    # Uma torre existe para bater o terreno que o muro não vê; pô-la ao lado de
    # um portão é desperdiçá-la, e ainda aperta o encaixe. Então vão para o meio
    # dos arcos mais compridos, que é onde a muralha está mais sozinha.
    torres = []
    if cfg["torres"]:
        ocupado = sorted(a % (2 * math.pi) for a, _p, _f, _d in portoes)
        arcos = []
        for i, a0 in enumerate(ocupado):
            a1 = ocupado[(i + 1) % len(ocupado)]
            arcos.append((((a1 - a0) % (2 * math.pi)) or 2 * math.pi, a0))
        arcos.sort(reverse=True)
        for k in range(cfg["torres"]):
            arco, a0 = arcos[k % len(arcos)]
            quantas = sum(1 for j in range(cfg["torres"]) if j % len(arcos) == k % len(arcos))
            posto = sum(1 for j in range(k) if j % len(arcos) == k % len(arcos))
            torres.append(a0 + arco * (posto + 1) / (quantas + 1))

    P.muralha(MURO, TORRE, portoes, raio, torres, z,
              abertura=amb("PORTAO_ABERTO", 0.0))
    # o quadro tem de dar folga às CASAS DO PORTÃO, que avançam para fora do
    # raio da muralha; com folga a menos elas ficavam encostadas à beira
    return (raio + 17) * 2.30


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
    D = 500.0
    bpy.ops.object.camera_add(
        location=(D * math.sin(inclina) * math.sin(giro),
                  -D * math.sin(inclina) * math.cos(giro),
                  D * math.cos(inclina)),
        rotation=(inclina, 0, giro))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = quadro
    cam.data.clip_start, cam.data.clip_end = 10.0, 1100.0
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
    cena.render.film_transparent = True            # o mapa é que põe o fundo
    cena.render.image_settings.file_format = "PNG"
    cena.render.image_settings.color_mode = "RGBA"
    cena.view_settings.view_transform = os.environ.get("CENA_COR", "AgX")
    try:
        cena.view_settings.look = os.environ.get("CENA_LOOK", "AgX - Medium High Contrast")
    except Exception:
        pass
    return cena


def mastros_em_pixeis(cena, cam):
    """os mastros da cena, em píxeis da imagem BRUTA.

    `world_to_camera_view` devolve 0..1 no quadro da câmara — é a mesma conta que
    o render faz, portanto não há nada a adivinhar sobre a projeção. O y vem de
    baixo para cima e a imagem conta de cima para baixo, daí o `1 - v`.
    """
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector
    saida = []
    for mx, my, mz, malt in P.MASTROS_CENA:
        u, v, _d = world_to_camera_view(cena, cam, Vector((mx, my, mz)))
        # o tamanho do pano, em píxeis: dois pontos a distância `malt` em Z
        u2, v2, _ = world_to_camera_view(cena, cam, Vector((mx, my, mz + malt)))
        saida.append({"x": round(u * LADO, 1), "y": round((1 - v) * LADO, 1),
                      "alt_px": round(abs(v2 - v) * LADO, 1)})
    return saida


def bocas_em_pixeis(cena, cam):
    """as bocas dos portões, em píxeis da imagem BRUTA, com o rumo no mapa"""
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector
    saida = []
    for bx, by, bz, rumo in P.PORTOES_CENA:
        u, v, _d = world_to_camera_view(cena, cam, Vector((bx, by, bz)))
        saida.append({"x": round(u * LADO, 1), "y": round((1 - v) * LADO, 1),
                      "rumo": round(math.degrees(rumo) % 360, 1)})
    return saida


# ── ISTO SO CORRE QUANDO O FICHEIRO E O PROGRAMA ─────────────────────────────
# Sem esta guarda, IMPORTAR o `cozer` para reaproveitar o `construir` punha a
# cozer as 24 aldeias — vinte minutos de render que ninguem pediu. Aconteceu ao
# escrever o `sondar_3d.py`. Um modulo que se quer reutilizar nao pode ter
# trabalho ao nivel do ficheiro.
if __name__ == "__main__":
    t0 = time.time()
    DESTINO = os.path.join(os.getcwd(), "assets", "sprites")
    os.makedirs(DESTINO, exist_ok=True)
    cidades = [n for n in NOMES if n in REDE["c"]]
    if not cidades:
        cidades = [c for c in REDE["c"] if c not in DE_FORA]

    feitas = 0
    for cidade in cidades:
        perfil = REDE["c"][cidade]["t"]
        quadro = construir(perfil, cidade=cidade)
        cena = cena_pronta(quadro)
        nome = "aldeia_" + cidade
        bruto = os.path.join(DESTINO, "_bruto_" + nome + ".png")
        cena.render.filepath = bruto
        bpy.ops.render.render(write_still=True)
        with open(os.path.splitext(bruto)[0] + "_quadro.json", "w", encoding="utf-8") as f:
            json.dump({"lado_px": LADO, "metros_do_quadro": quadro,
                       "isometria": {"inclinacao_graus": 60, "giro_graus": 45},
                       "mastros": mastros_em_pixeis(cena, cena.camera),
                       "bocas": bocas_em_pixeis(cena, cena.camera),
                       "destino": os.path.join(DESTINO, nome + ".png")}, f, indent=2)
        feitas += 1
        print("SONDA bruto %-24s %-8s %5.1f m  %d mastro(s)"
              % (nome, perfil, quadro, len(P.MASTROS_CENA)), flush=True)
    print("SONDA %d peca(s) em %.1f s — falta correr o recortar_sprite.py"
          % (feitas, time.time() - t0))
