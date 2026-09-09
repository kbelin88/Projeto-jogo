# exportar_mapa.py — o mapa inteiro, como MALHA, para o navegador.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/exportar_mapa.py -- [px_textura]
#
# ── A DECISAO DE ARQUITETURA ─────────────────────────────────────────────────
# Nao sai UMA cena com o mapa todo dentro. Saem DUAS coisas:
#
#   pecas.glb    a biblioteca: cada prototipo UMA vez, na origem
#   mapa3d.json  onde fica cada copia: peca, posicao, rotacao, escala
#
# O navegador junta as duas com `InstancedMesh` — uma malha na memoria, milhares
# de matrizes. Exportar o mapa inteiro como geometria daria a mesma casa
# repetida trezentas vezes e milhoes de triangulos unicos; assim, 22 aldeias e
# 380 bosques custam o que custa a maior peca.
#
# E o mesmo principio que ja governa o forno: uma malha partilhada, muitas
# copias. So que agora quem instancia e o WebGL em vez do Cycles.
#
# ── A ESCALA, E UMA CORRECAO QUE ELA TRAZ ────────────────────────────────────
# O mapa 2D desenha TODAS as aldeias com a mesma largura em celulas (3,8), seja
# a peca de 85 m ou a de 117 m — ou seja, comprime a grande e estica a pequena.
# Em metros isso nao existe: ha uma escala so. Uma capital passa a ser
# VISIVELMENTE maior que uma aldeia pequena, que e como devia ter sido sempre.
import json
import math
import os
import re
import subprocess
import sys
import time

import bpy
import numpy as np

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402
import cozer as C                                          # noqa: E402

ARGS = [int(a) for a in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
        if a.isdigit()]
TEX_PX = ARGS[0] if ARGS else 512
SAIDA = os.path.join(os.getcwd(), "sonda3d")

# viewBox do mapa -> metros. Vem da aldeia media: 98,9 m de peca desenhados em
# 3,8 celulas de 13,23 unidades. Um numero so, e o mapa inteiro obedece-lhe.
DIV = 1429.0 / 108.0
M_POR_VB = 98.9 / (3.8 * DIV)
# ── ONDE A ILHA COMECA E ACABA, E PORQUE NAO E O RETANGULO DO VIEWBOX ───────
# O viewBox do mapa mede 1429 x 886. A ARTE da ilha nao: com a escala do jogo
# (1,17613, ancorada no topo, `xMidYMin slice`), os 1215 x 864 pixeis da imagem
# dao 1429 x 1016 unidades -- e mais ALTA que a caixa, e o excesso e cortado em
# baixo. E o que "slice" quer dizer.
#
# Eu tinha esticado a mascara de terra para caber nos 886, o que a COMPRIMIU
# 13% na vertical e arrastou todo o sul para norte. O resultado: Faro, Cordoba,
# Murcia e Girona caiam na agua -- e eu tinha diagnosticado isso como um
# desacordo de LIMIARES entre duas leituras do alfa. Era falso. O limiar nao
# tinha nada a ver: a mascara estava na proporcao errada.
#
# A licao e a de sempre neste projeto: quando duas coisas nao batem certo, o
# suspeito nao e o valor, e o SISTEMA DE COORDENADAS.
IB_OX, IB_OY, IB_LARG = 130.0, 144.0, 1429.0
IB_ALT = 864.0 * 1.17613                     # a altura da ARTE, nao da caixa


def em_metros(vx, vy):
    """viewBox do jogo -> metros da cena. O y do ecra desce; o da cena sobe.

    A origem e o CENTRO DA IMAGEM, e nao o centro do viewBox: o que tem de
    coincidir e a mascara de terra com as cidades, e a mascara vem da imagem.
    """
    return ((vx - IB_OX - IB_LARG / 2) * M_POR_VB,
            -(vy - IB_OY - IB_ALT / 2) * M_POR_VB)


t0 = time.time()
os.makedirs(SAIDA, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
P._mats.clear(); P.LIXO = None

REDE = C.REDE
MATA = json.load(open(os.path.join(os.getcwd(), "assets/sprites/mata.json"), encoding="utf-8"))

copias = []
protos = {}          # nome curto -> receita (para reconstruir)
legiveis = {}        # nome curto -> assinatura legivel (so para se ler o JSON)
bocas, centros, mastros = {}, {}, {}


def juntar(reg, dx, dy, cid=None, giro=0.0):
    """passa um registo de colocacoes de coordenadas da PECA para as do MAPA.

    Guarda tambem a que aldeia pertence cada copia: e por isso que, mais
    abaixo, se pode levantar uma povoacao inteira ate a altura do seu patamar
    sem ter de adivinhar quais das 1128 pecas sao dela.
    """
    c, s = math.cos(giro), math.sin(giro)
    for r in reg:
        x, y, z = r["p"]
        copias.append({"peca": r["peca"], "p": [round(dx + x * c - y * s, 2),
                                                round(dy + x * s + y * c, 2),
                                                round(z, 2)],
                       "rz": round(r["rz"] + giro, 4), "e": r["e"], "_cid": cid})


# ── as aldeias ──────────────────────────────────────────────────────────────
# ── LISBOA E BARCELONA ENTRAM ───────────────────────────────────────────────
# Ficaram de fora da fornada 2D em 07/09 porque a peca da capital nao
# convencia como sprite. Aqui isso custa QUATRO ESTRADAS: lisboa-santarem,
# evora-lisboa, barcelona-tarragona e barcelona-girona simplesmente nao
# existiam, e uma rede com buracos e pior do que uma peca imperfeita -- ainda
# mais quando e por ela que as tropas andam.
# Se a capital continuar a nao convencer em 3D, troca-se a PECA. Nao se apaga
# a cidade.
cidades = list(REDE["c"])
for cid in cidades:
    perfil = REDE["c"][cid]["t"]
    P.registar(True)
    C.construir(perfil, cidade=cid)      # limpa a cena e monta a povoacao
    reg = P.REGISTO
    P.registar(False)
    # NAO se guarda o objeto: a proxima cidade chama `read_factory_settings` e
    # ele morre. Guarda-se a RECEITA, que e texto, e no fim reconstroi-se a
    # biblioteca de uma vez numa cena limpa.
    for ob in list(P.LIXO.objects if P.LIXO else []):
        nome = re.sub(r"\.\d{3}$", "", ob.name)
        if nome not in protos and ob.get("receita"):
            protos[nome] = ob["receita"]
            legiveis[nome] = ob.get("assinatura", nome)
    vx, vy = REDE["c"][cid]["x"], REDE["c"][cid]["y"]
    mx, my = em_metros(vx, vy)
    juntar(reg, mx, my, cid)
    # AS BOCAS, ja em metros do mapa. Sao elas que dizem onde uma estrada
    # encosta -- e a mesma correcao que o mapa 2D levou: acabar na PORTA, e nao
    # a desaparecer por baixo da peca.
    bocas[cid] = [{"p": [round(mx + bx, 2), round(my + by, 2)],
                   "rumo": round(rumo, 4)}
                  for bx, by, _bz, rumo in P.PORTOES_CENA]
    centros[cid] = [round(mx, 2), round(my, 2)]
    # OS MASTROS. A bandeira nao e assada -- e a unica coisa da aldeia que muda
    # quando ela troca de dono, e assar 22 aldeias x N Reis era o que este
    # projeto ja tinha decidido nao fazer. O forno grava ONDE fica o mastro; a
    # cor e de quem for dono, e um setimo Rei custa zero.
    mastros[cid] = [[round(mx + a, 2), round(my + b, 2), round(zz, 2), round(h, 2)]
                    for a, b, zz, h in P.MASTROS_CENA]
    print("SONDA %-11s %-8s %3d pecas" % (cid, perfil, len(reg)), flush=True)

print("SONDA %d aldeias, %d copias, %d prototipos distintos"
      % (len(cidades), len(copias), len(protos)))
print("SONDA escala: 1 unidade de viewBox = %.3f m  ->  o mapa mede %.0f x %.0f m"
      % (M_POR_VB, IB_LARG * M_POR_VB, IB_ALT * M_POR_VB))

# ── os bosques ──────────────────────────────────────────────────────────────
# HIERARQUICO, e nao achatado. Ha 380 manchas e cada uma tem umas 25 arvores:
# achatar dava 9 mil linhas de JSON. Assim saem os SEIS arranjos (as arvores de
# cada tipo de bosque, em coordenadas do bosque) e as 380 transformacoes. O
# navegador compoe as duas — a mesma conta que o mapa ja faz com os sprites.
import cozer_mata as CM                                        # noqa: E402

bosques = []
for i, (nome, quantas, raio, folhosas) in enumerate(CM.BOSQUES):
    P.registar(True)
    CM.construir(nome, quantas, raio, folhosas, 40 + i * 7)
    reg = P.REGISTO
    P.registar(False)
    for ob in list(P.LIXO.objects if P.LIXO else []):
        n = re.sub(r"\.\d{3}$", "", ob.name)
        if n not in protos and ob.get("receita"):
            protos[n] = ob["receita"]
            legiveis[n] = ob.get("assinatura", n)
    bosques.append([{"peca": r["peca"], "p": r["p"], "rz": r["rz"], "e": r["e"]}
                    for r in reg])
    print("SONDA bosque %s: %d arvores" % (nome, len(reg)), flush=True)

manchas = []
for m in MATA:
    mx, my = em_metros(m["x"], m["y"])
    manchas.append({"b": m["s"], "p": [round(mx, 1), round(my, 1)],
                    "e": round(m["e"] * M_POR_VB * DIV * 1.95 / ((14 + 5) * 2.3), 3)})
print("SONDA %d manchas de mata sobre %d arranjos" % (len(manchas), len(bosques)))
for b in bosques:
    for r in b:
        if r["peca"] not in {c["peca"] for c in copias}:
            pass
usadas_mata = {r["peca"] for b in bosques for r in b}

# ── a biblioteca ────────────────────────────────────────────────────────────
# Uma cena limpa, cada peca UMA vez, na origem. E daqui que sai o `pecas.glb`
# que o navegador carrega uma vez e instancia mil vezes.
bpy.ops.wm.read_factory_settings(use_empty=True)
P._mats.clear(); P.LIXO = None
cena = bpy.context.scene.collection
# AS TROPAS entram na biblioteca sem estarem em `copias`: nao ha nenhuma
# COLOCADA no mapa, porque quem as coloca e o jogo, a cada turno. O que sai
# daqui e so a peca; onde ela vai parar e assunto do motor.
TROPAS = {"lanceiro": (P.proto_lanceiro, ()),
          "arqueiro": (P.proto_arqueiro, ()),
          "cavaleiro": (P.proto_cavaleiro, ())}
usadas = sorted({c["peca"] for c in copias} | usadas_mata)
feitas, faltam = [], []
for nome in usadas:
    receita = protos.get(nome)
    if not receita:
        faltam.append(nome)
        continue
    fn, args, kw = json.loads(receita)
    ob = getattr(P, fn)(*args, **kw)
    for col in list(ob.users_collection):
        col.objects.unlink(ob)
    ob.name = nome                      # o nome E a chave do mapa3d.json
    # A MALHA TAMBEM. O glTF guarda o nome do OBJETO num no e o da MALHA noutro,
    # e a malha herda o nome da primitiva que lhe deu origem ("Cube.005"). Do
    # lado do navegador, quem tem `.isMesh` e a malha — e 19 das 22 pecas nao
    # eram encontradas por causa disso. Batizar as duas resolve dos dois lados.
    ob.data.name = nome
    cena.objects.link(ob)
    feitas.append(nome)
for nome, (fn, args) in TROPAS.items():
    ob = fn(*args)
    for col in list(ob.users_collection):
        col.objects.unlink(ob)
    ob.name = ob.data.name = nome
    cena.objects.link(ob)
    feitas.append(nome)
print("SONDA tropas: %s" % ", ".join(TROPAS))
if faltam:
    print("SONDA AVISO: sem receita para %s" % faltam)

terra = np.load(os.path.join(os.getcwd(), "ferramentas/cena/_terra.npy"))
FUNDO = 18.0          # quanto a margem desce abaixo do nivel da terra
th, tw = terra.shape
LX, LY = IB_LARG * M_POR_VB, IB_ALT * M_POR_VB
px, py = LX / tw, LY / th

# ── NADA NA AGUA ────────────────────────────────────────────────────────────
# Havia aldeias e bosques a boiar. Nao e um erro de posicao: e um DESACORDO de
# mascaras. O `espalhar_mata.py` decide "isto e terra" com o alfa da arte a
# 0,70 na resolucao cheia; o chao daqui decide com o mesmo alfa reduzido e a
# 0,43. Duas leituras da mesma imagem, e as duas legitimas -- so nao concordam
# na beira, que e exatamente onde isto se ve.
#
# Corrigir a jusante (empurrar as pecas para dentro) seria mexer no mapa por
# causa de uma malha. Corrige-se a montante: quem manda e ONDE AS PECAS ESTAO,
# e o chao e obrigado a existir por baixo delas. Uma aldeia numa peninsula
# passa a TER a peninsula.
def carimbar_terra(mx, my, raio_m):
    i0 = max(0, int((mx + LX / 2 - raio_m) / px))
    i1 = min(tw - 1, int((mx + LX / 2 + raio_m) / px))
    j0 = max(0, int((LY / 2 - my - raio_m) / py))
    j1 = min(th - 1, int((LY / 2 - my + raio_m) / py))
    for j in range(j0, j1 + 1):
        for i in range(i0, i1 + 1):
            cx = (i + 0.5) * px - LX / 2
            cy = LY / 2 - (j + 0.5) * py
            if (cx - mx) ** 2 + (cy - my) ** 2 <= raio_m * raio_m:
                terra[j, i] = True


# AS ALDEIAS MANDAM, A MATA OBEDECE. Sao dois casos e nao um:
#   * uma aldeia esta onde o mapa do jogo diz que esta -- e uma coordenada do
#     `world-iberia.js`, e o motor conta com ela. Se o chao nao chega la, o
#     errado e o chao: carimba-se terra por baixo.
#   * um bosque e decoracao. Carimbar terra por baixo de um bosque ao largo faz
#     uma ILHOTA com tres arvores, que e pior do que nao ter o bosque.
#     Esse tira-se.
antes_terra = int(terra.sum())
for cid, c in centros.items():
    carimbar_terra(c[0], c[1], C.PERFIS[REDE["c"][cid]["t"]]["raio"] + 26.0)
print("SONDA chao carimbado sob as aldeias: %d -> %d celulas (+%.1f%%)"
      % (antes_terra, int(terra.sum()),
         (terra.sum() - antes_terra) / max(antes_terra, 1) * 100))


def em_terra(mx, my):
    i = int((mx + LX / 2) / px)
    j = int((LY / 2 - my) / py)
    return 0 <= i < tw and 0 <= j < th and bool(terra[j, i])


antes_mata = len(manchas)
manchas = [m for m in manchas if em_terra(*m["p"])]
print("SONDA mata: %d manchas, %d fora de terra removidas"
      % (len(manchas), antes_mata - len(manchas)))


# ── O RELEVO ────────────────────────────────────────────────────────────────
# O `terreno.py` ja desenhava um campo de alturas para o render da ilha: nove
# serras ancoradas a cidades reais, cinco rios, uma meseta. Ate agora o jogo
# so via a COR que saia dele. Aqui usa-se a altura ela propria.
#
# ── DUAS DECISOES, E AS DUAS FORAM MEDIDAS ──────────────────────────────────
# 1. O CAMPO TEM DE SER BORRADO. Foi desenhado para COLORIR uma imagem, onde o
#    declive vira sombra e o grao fino e detalhe. Como geometria, esse mesmo
#    grao vira falesia: medido em cru, o declive no percentil 95 era de 77
#    graus e a ilha parecia papel amarrotado. Com um borrao de caixa de 18
#    celulas (90 m) desce a 34 graus -- que e serra, e ja se anda la.
#
#      raio   p50    p95    max
#         0   21,7   72,7   86,2
#         4   21,0   63,3   79,5
#        10   19,5   54,5   67,8
#        18   17,1   45,1   58,0   <- escolhido, com 150 m
#        30   16,8   33,9   48,9
#
# 2. 150 m DE AMPLITUDE NUM MAPA DE 2,8 KM e exagero de proposito, como a
#    largura das estradas: a Ibéria a serio tem 3400 m em 900 km, e a essa
#    escala nao se via nada. O que se quer e que a serra LEIA como serra.
ALTURA_MAX = 150.0
RAIO_BORRAO = 18


def _caixa(a, r):
    """borrao de caixa separavel, por somas acumuladas: O(1) por pixel.

    Feito a mao porque o Blender nao traz PIL nem scipy, e porque um borrao de
    90 m com um estencil de 5 pontos levaria milhares de passagens.
    """
    if r < 1:
        return a
    for eixo in (0, 1):
        a = np.swapaxes(a, 0, eixo)
        pad = np.pad(a, ((r + 1, r), (0, 0)), mode="edge")
        acum = np.cumsum(pad, axis=0)
        a = (acum[2 * r + 1:] - acum[:-(2 * r + 1)]) / (2 * r + 1)
        a = np.swapaxes(a, 0, eixo)
    return a
# o campo vem ja na grelha do chao (o preparador guarda-o assim, de proposito):
# reamostrar aqui obrigaria a arrastar o PIL para dentro do Blender, que nao o
# tem, e a ter DUAS reamostragens da mesma coisa a discordarem na beira -- que
# foi exatamente o bug das aldeias na agua.
relevo = np.load(os.path.join(os.getcwd(), "ferramentas/cena/_altura.npy"))
assert relevo.shape == terra.shape, (
    "o relevo e a mascara de terra tem de vir na MESMA grelha: %s vs %s"
    % (relevo.shape, terra.shape))
relevo = _caixa(relevo.astype(np.float32), RAIO_BORRAO)
relevo = relevo / max(float(relevo[terra].max()), 1e-6) * ALTURA_MAX


def altura_em(mx, my):
    """a altura do terreno num ponto, em metros, com interpolacao bilinear.

    Bilinear e nao "a celula mais proxima": com 5 m de grelha, uma tropa a
    andar saltaria degraus de 5 m em 5 m, e uma aldeia assentaria num patamar
    visivelmente desalinhado do chao a volta.
    """
    # ── SEM O MEIO ────────────────────────────────────────────────────────
    # Estava aqui um `- 0.5`, que trata `relevo[j][i]` como a altura do CENTRO
    # da celula. Mas a malha do chao poe o vertice (i,j) no CANTO, com essa
    # mesma altura -- as duas leituras estavam desencontradas meia celula na
    # diagonal, 3,5 m no chao, que numa encosta de 33 graus da mais de 2 m de
    # erro. A estrada ficava enterrada por baixo da colina e reaparecia do
    # outro lado.
    #
    # A analise numerica nao apanhou isto porque REPETIA o mesmo erro: media
    # com a mesma funcao que o produzia. Foi levantar a fita 3 m no navegador,
    # ver as falhas fecharem-se todas, e so entao procurar onde estavam os 3 m.
    fi = (mx + LX / 2) / px
    fj = (LY / 2 - my) / py
    i0 = max(0, min(tw - 2, int(math.floor(fi))))
    j0 = max(0, min(th - 2, int(math.floor(fj))))
    u, v = min(max(fi - i0, 0.0), 1.0), min(max(fj - j0, 0.0), 1.0)
    return float((relevo[j0, i0] * (1 - u) + relevo[j0, i0 + 1] * u) * (1 - v)
                 + (relevo[j0 + 1, i0] * (1 - u) + relevo[j0 + 1, i0 + 1] * u) * v)


# ── O PATAMAR DE CADA ALDEIA ────────────────────────────────────────────────
# Uma aldeia numa encosta fica com metade da muralha enterrada e a outra metade
# no ar: as pecas sao rigidas e o chao nao e. Entao o chao cede. Aplana-se um
# disco a altura do centro, com uma RAMPA a volta para nao ficar um patamar
# recortado -- e a mesma ideia do `patamar()` que o `relevo.py` ja fazia na
# peca, agora feita no mapa.
patamares = {}
for cid, c in centros.items():
    h = altura_em(c[0], c[1])
    patamares[cid] = h
    raio = C.PERFIS[REDE["c"][cid]["t"]]["raio"] + 20.0
    # A RAMPA E LARGA de proposito. Com 1,9 raios via-se um DISCO a volta de
    # cada aldeia, como se ela estivesse pousada num prato. Com 3,6 a
    # transicao dilui-se na encosta e a aldeia parece ter sido construida
    # onde o terreno ja era plano -- que e como se constroi uma aldeia.
    rampa = raio * 3.6
    i0 = max(0, int((c[0] + LX / 2 - rampa) / px))
    i1 = min(tw - 1, int((c[0] + LX / 2 + rampa) / px))
    j0 = max(0, int((LY / 2 - c[1] - rampa) / py))
    j1 = min(th - 1, int((LY / 2 - c[1] + rampa) / py))
    for j in range(j0, j1 + 1):
        for i in range(i0, i1 + 1):
            # o canto, pela mesma razao: e onde a malha poe o vertice
            dx = i * px - LX / 2 - c[0]
            dy = LY / 2 - j * py - c[1]
            d = math.hypot(dx, dy)
            if d > rampa:
                continue
            k = 1.0 if d <= raio else (rampa - d) / (rampa - raio)
            k = k * k * (3 - 2 * k)                    # suaviza as pontas
            relevo[j, i] = relevo[j, i] * (1 - k) + h * k
# O RELEVO FINAL VAI PARA DISCO. Nao e para o jogo: e para se poder medir
# contra ele. Ao investigar a estrada tapada eu reconstrui o campo de alturas
# fora daqui e esqueci-me dos patamares das aldeias -- e a analise acusou 59 m
# de erro que nao existiam. Quem quiser medir, mede contra o que SAIU, nao
# contra uma reconstrucao.
np.save(os.path.join(os.getcwd(), "ferramentas/cena/_relevo_final.npy"), relevo)

_gy, _gx = np.gradient(relevo, px)
_d = np.degrees(np.arctan(np.hypot(_gx, _gy)))[terra]
print("SONDA relevo: %.0f m de amplitude, declive p50 %.1f / p95 %.1f graus, "
      "%d patamares de aldeia" % (relevo[terra].max() - relevo[terra].min(),
                                  np.percentile(_d, 50), np.percentile(_d, 95),
                                  len(patamares)))

# ── e agora tudo assenta ────────────────────────────────────────────────────
for c in copias:
    c["p"][2] = round(c["p"][2] + patamares.get(c.get("_cid", ""), 0.0), 2)
for m in manchas:
    m["z"] = round(altura_em(m["p"][0], m["p"][1]), 2)

# ── AS ESTRADAS ─────────────────────────────────────────────────────────────
# Uma fita de geometria por troco, pousada um palmo acima do chao. Duas coisas
# que o mapa 2D aprendeu a duras penas e que se herdam aqui de graca:
#
#   * a estrada acaba na BOCA do portao que aponta para o rumo dela, e nao no
#     centro da aldeia -- senao desaparece por baixo da peca sem se ligar a nada;
#   * a meia-largura VARIA ao longo do caminho. Uma faixa de largura constante
#     le-se como fita adesiva por melhor que seja a cor.
#
# O rumo das bocas foi gravado em graus do MAPA, portanto aqui e so escolher a
# mais alinhada -- a mesma conta que o canvas ja faz.
def boca_para(cid, rumo_alvo):
    melhor, dif = None, 999.0
    for b in bocas.get(cid, []):
        d = abs(((math.degrees(b["rumo"]) - rumo_alvo + 540) % 360) - 180)
        if d < dif:
            dif, melhor = d, b
    return melhor["p"] if melhor and dif <= 46 else None


# A LARGURA NAO E A DO MAPA 2D. La a estrada tem 0,70 de celula porque e
# INFORMACAO num quadro visto de cima, e um mapa de jogo exagera as estradas de
# proposito. Convertido a escala, isso davam 36 m -- uma auto-estrada ao lado de
# casas de 7 m. Aqui manda o chao: 18 m de ponta a ponta, larga o suficiente
# para se ver de cima e estreita o suficiente para nao ser ridicula ao pe de uma
# porta. E a primeira vez que as duas coisas tem de bater certo ao mesmo tempo.
LARG_ESTRADA = 9.0                            # meia-largura, em metros
# as curvas autorais, ja em metros da cena. O `via` do world-iberia esta em
# coordenadas do viewBox, que e onde o desenho 2D vive.
VIA_DE = {}
for _e in REDE.get("e", []):
    if _e.get("via"):
        VIA_DE[tuple(sorted((_e["de"], _e["para"])))] = em_metros(*_e["via"][0])
verts, faces, uvs = [], [], []
LADRILHO = 24.0      # metros de estrada por repeticao da textura
trocos = 0
eixos = []            # o CAMINHO de cada troco, para as tropas o seguirem
LIGACOES = []
for a, viz in REDE["v"].items():
    for b in viz:
        if a < b and a in centros and b in centros:
            LIGACOES.append((a, b))
for a, b in LIGACOES:
    ax, ay = centros[a]
    bx, by = centros[b]
    rumo = math.degrees(math.atan2(by - ay, bx - ax))
    p0 = boca_para(a, rumo) or [ax, ay]
    p1 = boca_para(b, (rumo + 180) % 360) or [bx, by]
    # e ENTRA 6 m para dentro da boca. Acabar exatamente na porta deixa uma
    # costura visivel entre a fita e a peca; entrando um pouco, a estrada passa
    # por baixo do portao e a juncao desaparece.
    dx0, dy0 = p1[0] - p0[0], p1[1] - p0[1]
    L0 = math.hypot(dx0, dy0) or 1.0
    p0 = [p0[0] - dx0 / L0 * 6.0, p0[1] - dy0 / L0 * 6.0]
    p1 = [p1[0] + dx0 / L0 * 6.0, p1[1] + dy0 / L0 * 6.0]
    comp = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    if comp < 1:
        continue
    # ── UM PONTO A CADA 5 M, e nao a cada 18 ────────────────────────────
    # A fita e reta entre vertices. Com 18 m de passo, ao passar uma crista ela
    # corta o cabeco em linha reta e o terreno sai POR CIMA dela -- medido, ate
    # 0,56 m, em 1,2% do percurso. Nao se via como um erro de altura: via-se
    # como a estrada a desaparecer nas subidas e a voltar depois, que foi
    # exatamente como o Lucas o descreveu.
    #
    # 5 m e o passo da propria grelha do terreno: abaixo disso nao ha o que
    # seguir. Custa 3x as faces de uma malha que tinha 857 -- nada.
    N = max(8, int(comp / 5))
    base = len(verts)
    eixo = []
    andado, ant = 0.0, None
    # ── A CURVA E A DO MAPA, NAO UMA INVENTADA AQUI ─────────────────────
    # Antes esta fita serpenteava com dois senos escolhidos a olho. Ficava
    # bonita e discordava do desenho 2D: as duas vistas punham a mesma estrada
    # em sitios diferentes, e um exercito a meio do caminho aparecia em pontos
    # que nao eram o mesmo ponto. Agora dobra pelo `via` do world-iberia --
    # o mesmo que o canvas usa -- e so lhe fica um bracejar pequeno por cima,
    # que e o que tira o ar de regua sem mentir sobre o traçado.
    ctl = VIA_DE.get(tuple(sorted((a, b))))
    for i in range(N + 1):
        t = i / N
        cx = p0[0] + (p1[0] - p0[0]) * t
        cy = p0[1] + (p1[1] - p0[1]) * t
        if ctl:
            # Bezier de segundo grau pelas duas bocas, com o ponto de controlo
            # levado para a mesma banda: a curva passa por onde o desenho passa
            cx = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * ctl[0] + t * t * p1[0]
            cy = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * ctl[1] + t * t * p1[1]
        # e as PONTAS FICAM QUIETAS: se o bracejar chegasse ao fim, a estrada
        # nascia ao lado da porta em vez de nela
        k = min(1.0, min(i, N - i) / (N * 0.24))
        desvio = math.sin(t * comp * 0.019 + 1.1) * comp * 0.007 * k
        nx, ny = -(p1[1] - p0[1]) / comp, (p1[0] - p0[0]) / comp
        cx += nx * desvio
        cy += ny * desvio
        # ── O ADRO ───────────────────────────────────────────────────────
        # A estrada ALARGA nos ultimos 30 m antes do portao. Uma fita de largura
        # constante a encostar a uma muralha corta a direito e fica com ar de
        # fita colada -- e era isso o "nao esta bem encaixado". Um caminho a
        # serio abre-se onde as carrocas manobram para entrar, e e essa abertura
        # que faz a estrada PERTENCER a aldeia em vez de lhe tocar.
        borda = min(t * comp, (1 - t) * comp)
        adro = 1.0 + 0.85 * max(0.0, 1.0 - borda / 30.0) ** 1.6
        w = LARG_ESTRADA * adro * (0.5 + 0.09 * math.sin(t * 21 + comp)
                                   + 0.06 * math.sin(t * 47))
        # ── CADA BEIRA COM A SUA ALTURA ─────────────────────────────────
        # A estrada acompanha o terreno, mas a altura do EIXO nao serve para as
        # duas beiras: numa encosta de traves uma delas voa e a outra
        # enterra-se, e num adro de 33 m de largo isso da um degrau que se ve.
        # Cada canto pergunta a sua propria altura.
        ex1, ey1 = cx + nx * w, cy + ny * w
        ex2, ey2 = cx - nx * w, cy - ny * w
        verts.append((ex1, ey1, altura_em(ex1, ey1) + 0.45))
        verts.append((ex2, ey2, altura_em(ex2, ey2) + 0.45))
        # ── E CADA VERTICE LEVA O SEU UV ─────────────────────────────────
        # Sem UV nao ha textura possivel: uma fita so tem cor. O `u` anda com
        # a estrada (metros percorridos a dividir pelo ladrilho) e o `v`
        # atravessa-a de beira a beira. Assim um ladrilho de terra batida
        # repete-se AO LONGO do caminho e nunca de traves, que e como se ve
        # numa estrada de verdade -- e alargar no adro estica o desenho para
        # os lados em vez de o cortar.
        if i:
            andado += math.dist((cx, cy), ant)
        ant = (cx, cy)
        uvs.append((andado / LADRILHO, 1.0))
        uvs.append((andado / LADRILHO, 0.0))
        # o EIXO leva a altura do centro, que e por onde as tropas andam --
        # nao a de nenhuma das beiras
        eixo.append([round(cx, 1), round(cy, 1), round(altura_em(cx, cy) + 0.5, 1)])
    for i in range(N):
        faces.append((base + 2 * i, base + 2 * i + 1,
                      base + 2 * i + 3, base + 2 * i + 2))
    eixos.append({"de": a, "para": b, "pts": eixo})
    trocos += 1
estradas = P._novo(P._malha("estradas", verts, faces, "caminho", bisel=0), "caminho")
_uv = estradas.data.uv_layers.new(name="UVMap")
for _p in estradas.data.polygons:
    for _li in _p.loop_indices:
        _uv.data[_li].uv = uvs[estradas.data.loops[_li].vertex_index]
for col in list(estradas.users_collection):
    col.objects.unlink(estradas)
cena.objects.link(estradas)
estradas.name = estradas.data.name = "estradas"
print("SONDA estradas: %d trocos, %d faces, %.1f m de largura, %d com curva autoral"
      % (trocos, len(faces), LARG_ESTRADA * 2, len(VIA_DE)))

# ── O CHAO, COM A FORMA DA ILHA ─────────────────────────────────────────────
# Uma grelha sobre o retangulo do mapa, da qual se apagam as faces que caem na
# agua. E a primeira vez que a terra tem BORDA em vez de um desfoque de alfa:
# a fronteira entre a agua e a terra passa a ser geometria, e nao um esbatido
# de 16 pixeis por cima de um PNG.
#
# A mascara vem do alfa da propria ilha (`_terra.npy`), portanto a costa e
# EXATAMENTE a que o jogo ja usa — nao ha duas ilhas com formas diferentes.
# ── A COSTA DEIXA DE SER UMA ESCADA ─────────────────────────────────────────
# A malha e uma grelha, portanto a linha de agua sai aos degraus de 5 m. Subir
# a resolucao resolveria e quadruplicaria as faces por uma coisa que so se ve
# na beira.
#
# Em vez disso EMPURRAM-SE os vertices da beira para a linha verdadeira. O alfa
# da arte e continuo -- entre 0 e 1, nao so terra ou agua -- e a fronteira e
# onde ele vale 0,43. Para cada vertice perto dessa fronteira, anda-se ao longo
# do gradiente ate la chegar. A topologia nao muda, o numero de faces nao muda,
# e o degrau desaparece.
LIMIAR = 110 / 255.0
alfa_c = np.load(os.path.join(os.getcwd(), "ferramentas/cena/_alfa.npy"))
ga_y, ga_x = np.gradient(alfa_c)


def encostar(vi, vj):
    """(x, y) do vertice (vi, vj) da grelha, puxado para a linha de agua"""
    x = vi * px - LX / 2
    y = LY / 2 - vj * py
    i = min(max(vi, 0), tw - 1)
    j = min(max(vj, 0), th - 1)
    a = float(alfa_c[j, i])
    if not (LIMIAR - 0.34 < a < LIMIAR + 0.34):
        return x, y                       # longe da agua: fica onde esta
    gx, gy = float(ga_x[j, i]), float(ga_y[j, i])
    g2 = gx * gx + gy * gy
    if g2 < 1e-9:
        return x, y
    passo = (LIMIAR - a) / g2             # em celulas, ao longo do gradiente
    passo = max(-1.4, min(1.4, passo))    # nunca mais de uma celula e meia
    return x + gx * passo * px, y - gy * passo * py


verts, faces = [], []
indice = {}
for j in range(th):
    for i in range(tw):
        if not terra[j, i]:
            continue
        canto = []
        for di, dj in ((0, 0), (1, 0), (1, 1), (0, 1)):
            ch = (i + di, j + dj)
            if ch not in indice:
                indice[ch] = len(verts)
                ex, ey = encostar(i + di, j + dj)
                verts.append((ex, ey,
                              float(relevo[min(j + dj, th - 1), min(i + di, tw - 1)])))
            canto.append(indice[ch])
        faces.append(tuple(canto))
        # ── A MARGEM ────────────────────────────────────────────────────────
        # Sem isto a ilha e uma FOLHA: a terra e o mar encontram-se no mesmo
        # plano e a costa nao se le como costa, le-se como uma mudanca de cor.
        # Onde a celula ao lado e agua, desce-se uma parede ate abaixo do mar.
        # E a diferenca entre um mapa pintado e uma ilha que tem margem.
        for (di, dj), (a, b) in (((-1, 0), ((0, 0), (0, 1))),
                                 ((1, 0), ((1, 1), (1, 0))),
                                 ((0, -1), ((1, 0), (0, 0))),
                                 ((0, 1), ((0, 1), (1, 1)))):
            vi, vj = i + di, j + dj
            if 0 <= vi < tw and 0 <= vj < th and terra[vj, vi]:
                continue                                   # tem terra ao lado
            topo = []
            for ddi, ddj in (a, b):
                ch = (i + ddi, j + ddj)
                if ch not in indice:
                    indice[ch] = len(verts)
                    ex, ey = encostar(i + ddi, j + ddj)
                    verts.append((ex, ey,
                                  float(relevo[min(j + ddj, th - 1),
                                               min(i + ddi, tw - 1)])))
                topo.append(indice[ch])
            fundo = []
            for ddi, ddj in (b, a):
                ex, ey = encostar(i + ddi, j + ddj)
                verts.append((ex, ey, -FUNDO))
                fundo.append(len(verts) - 1)
            faces.append((topo[0], topo[1], fundo[0], fundo[1]))
chao = P._novo(P._malha("chao", verts, faces, "relva", bisel=0), "relva")
for col in list(chao.users_collection):
    col.objects.unlink(col.objects.get(chao.name) or chao)
cena.objects.link(chao)
chao.name = "chao"
print("SONDA chao: %d faces de %.0f x %.0f m, ilha de %.0f x %.0f m"
      % (len(faces), px, py, LX, LY))

# ── O FORNO DAS PECAS ───────────────────────────────────────────────────────
# Ate aqui as pecas viajavam com a cor CHAPADA da paleta, porque o glTF nao
# leva os nossos materiais: sao grafos de nos, com a textura mapeada por
# coordenada de OBJETO (a geometria nasce por codigo e nunca foi desdobrada) e
# a cor misturada em modo COLOR.
#
# Agora desdobra-se cada peca e assa-se nela DUAS coisas:
#   * a COR ja resolvida -- a fotografia com o nosso tom por cima;
#   * a OCLUSAO -- o escurecido dos cantos e dos encostos.
# E multiplicam-se uma pela outra numa textura so.
#
# A oclusao vem daqui e nao do navegador por medicao: em tempo real o SSAO
# valeu ~3% de escurecimento; assada no Cycles, 37% dos pixeis ficam abaixo de
# 200. E custa zero a desenhar.
#
# ASSA-SE SO O QUE NAO TEM DIRECAO. O sol continua a ser calculado ao vivo --
# um sol assado colava a sombra de uma hora do dia a peca para sempre, e a peca
# aparece no mapa virada para qualquer lado.
def assar_peca(ob, px, amostras):
    import numpy as _np
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.010)
    bpy.ops.object.mode_set(mode="OBJECT")

    def alvo(nome):
        im = bpy.data.images.new(nome, px, px, alpha=False)
        for m in ob.data.materials:
            if not m or not m.use_nodes:
                continue
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.image = im
            n.select = True
            m.node_tree.nodes.active = n
        return im

    ce = bpy.context.scene
    ce.render.bake.use_pass_direct = False
    ce.render.bake.use_pass_indirect = False
    ce.render.bake.use_pass_color = True
    ce.render.bake.margin = 6
    cor = alvo("cor_" + ob.name)
    bpy.ops.object.bake(type="DIFFUSE")
    oc = alvo("ao_" + ob.name)
    bpy.ops.object.bake(type="AO")

    a = _np.empty(px * px * 4, dtype=_np.float32); cor.pixels.foreach_get(a)
    b = _np.empty(px * px * 4, dtype=_np.float32); oc.pixels.foreach_get(b)
    b[3::4] = 1.0
    # a oclusao entra SUAVIZADA. Crua escurece de mais e a peca fica encardida;
    # aqui vale 70%.
    a *= (0.30 + 0.70 * b)
    a = _np.clip(a, 0.0, 1.0)

    # ── A CODIFICACAO sRGB E FEITA AQUI, A MAO ──────────────────────────────
    # O forno escreve valores LINEARES no tampao. O que viaja no glTF e um PNG
    # de 8 bits que o navegador le como sRGB -- e a conversao entre os dois nao
    # aconteceu: medido, as texturas chegavam com luminancia 20 em 255, que e
    # exatamente o valor linear da paleta escrito em cru. Tudo preto.
    # Converte-se aqui e marca-se a imagem como Non-Color, para mais ninguem
    # lhe tocar.
    #
    # E o espaco de cor E DEFINIDO ANTES de escrever os pixeis: mudar o espaco
    # de cor de uma imagem RECARREGA-A e deita fora o que la estivesse. Este
    # projeto ja perdeu meio dia com isso, noutra ferramenta.
    rgb = a.reshape(-1, 4)[:, :3]
    baixo = rgb <= 0.0031308
    rgb[:] = _np.where(baixo, rgb * 12.92,
                       1.055 * _np.power(_np.maximum(rgb, 1e-8), 1 / 2.4) - 0.055)
    a = a.reshape(-1)
    a[3::4] = 1.0
    cor.colorspace_settings.name = "Non-Color"
    cor.pixels.foreach_set(_np.clip(a, 0.0, 1.0))
    cor.update()
    bpy.data.images.remove(oc)

    m = bpy.data.materials.new("assado_" + ob.name)
    m.use_nodes = True
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = cor
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.88
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    # UM MATERIAL SO por peca. Alem da cor, isto colapsa as 3 a 5 primitivas do
    # glTF numa: menos chamadas de desenho, e o carregador do lado do navegador
    # deixa de ter de as juntar.
    ob.data.materials.clear()
    ob.data.materials.append(m)


if os.environ.get("ASSAR", "1") == "1":
    ce = bpy.context.scene
    bpy.ops.preferences.addon_enable(module="cycles")
    ce.render.engine = "CYCLES"
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
            ce.cycles.device = "GPU"
            break
    ce.cycles.samples = 24
    mundo = bpy.data.worlds.new("forno")
    ce.world = mundo
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    t_forno = time.time()
    for nome in feitas:
        ob = bpy.context.scene.objects.get(nome)
        if ob:
            assar_peca(ob, 512, 24)
    print("SONDA %d pecas assadas em %.1f s" % (len(feitas), time.time() - t_forno),
          flush=True)

# as texturas descem antes de viajar (ver a medicao em SONDAGEM_3D)
for im in bpy.data.images:
    if im.size[0] > TEX_PX:
        im.scale(TEX_PX, TEX_PX)
# e a cor achata-se na paleta, porque o glTF nao leva os nossos grafos de nos
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    cor = P.COR.get(m.name[2:]) if bsdf else None
    if cor is None:
        continue
    for lig in list(bsdf.inputs["Base Color"].links):
        m.node_tree.links.remove(lig)
    bsdf.inputs["Base Color"].default_value = cor

tris = 0
for ob in bpy.context.scene.objects:
    if ob.type == "MESH":
        ob.data.calc_loop_triangles()
        tris += len(ob.data.loop_triangles)
alvo = os.path.join(SAIDA, "pecas.glb")
bpy.ops.export_scene.gltf(filepath=alvo, export_format="GLB", export_apply=True,
                          export_yup=True, export_cameras=False, export_lights=False)
print("SONDA biblioteca: %d pecas, %d triangulos, %.1f MB"
      % (len(feitas), tris, os.path.getsize(alvo) / 1e6))

with open(os.path.join(SAIDA, "mapa3d.json"), "w", encoding="utf-8") as f:
    json.dump({"m_por_vb": round(M_POR_VB, 4),
               "mapa_m": [round(IB_LARG * M_POR_VB), round(IB_ALT * M_POR_VB)],
               "pecas": {n: legiveis.get(n, n) for n in feitas}, "copias": copias,
               "arranjos": bosques, "manchas": manchas,
               "estradas": eixos, "tropas": list(TROPAS),
               # o NOME e o TAMANHO de cada povoacao, para o mapa poder
               # rotula-las sem ter de ir buscar o world-iberia outra vez
               "aldeias": {c: {"p": centros[c],
                               "z": round(patamares.get(c, 0.0), 2),
                               "t": REDE["c"][c]["t"],
                               "nome": REDE["c"][c].get("nome", c)}
                           for c in centros},
               "mastros": {c: [[m[0], m[1], round(m[2] + patamares.get(c, 0.0), 2),
                                m[3]] for m in ms]
                           for c, ms in mastros.items()}}, f, separators=(",", ":"))
print("SONDA -> sonda3d/mapa3d.json  (%.0f KB)  em %.1f s"
      % (os.path.getsize(os.path.join(SAIDA, "mapa3d.json")) / 1024, time.time() - t0))
