# gerar-rede.py — do desenho à mão para o `world-iberia.js`.
#
#   python ferramentas/gerar-rede.py            # só o relatório
#   python ferramentas/gerar-rede.py --escrever # grava o world-iberia.js
#
# ── O QUE ESTE FICHEIRO RESOLVE ──────────────────────────────────────────────
# O `rede-nova.json` diz ONDE estão as aldeias e QUAIS as estradas. Não diz
# quanto custa cada estrada — e é o custo que faz o jogo, porque é dele que
# saem os turnos de marcha e a condição de equilíbrio.
#
# ── O CUSTO NÃO É A DISTÂNCIA ────────────────────────────────────────────────
# No mapa autoral um trecho custa `distância ÷ velocidade do terreno`. Medi as
# velocidades no mapa de hoje, estrada a estrada, e são estas (píxeis de
# viewBox por unidade de custo):
#
#     costa 98 · vale 95 · planalto 73 · planicie 68 · serra 47
#
# Reaproveitá-las não é preguiça: é o que faz o mapa novo ter o MESMO andamento
# do antigo. Se eu inventasse uma escala nova, todas as partidas passariam a
# durar outro tanto de turnos e não se saberia se foi o mapa ou o modelo.
#
# ── E O TERRENO SAI DO RELEVO, NÃO DO MEU GOSTO ──────────────────────────────
# O `_relevo_final.npy` é o campo de alturas de que o mapa 3D é feito. Ando por
# cima de cada estrada, meço o que ela sobe e a que altura anda, e daí sai o
# terreno. Uma estrada é serra porque ATRAVESSA a serra — e depois é lenta por
# isso. O jogador vê a montanha e o motor cobra-a.
#
# ── O EQUILÍBRIO É POR CONSTRUÇÃO ────────────────────────────────────────────
# Cada estrada tem uma gémea (a mesma estrada entre as cidades espelho). As
# duas recebem o MESMO custo — a média das duas. Como o grafo é simétrico e os
# custos também, `rota(lisboa, X)` e `rota(barcelona, par(X))` percorrem
# caminhos espelhados com a mesma soma: `verificarEquilibrio()` dá zero porque
# não pode dar outra coisa, e não porque se afinou à mão até dar.
import io
import json
import math
import os
import subprocess
import sys

import numpy as np

RAIZ = os.getcwd()
DESENHO = os.path.join(RAIZ, "rede-nova.json")
ALVO = os.path.join(RAIZ, "world-iberia.js")

# ── a mesma geometria que o exportador do mapa 3D usa ────────────────────────
DIV = 1429.0 / 108.0
M_POR_VB = 98.9 / (3.8 * DIV)
IB_OX, IB_OY, IB_LARG = 130.0, 144.0, 1429.0
IB_ALT = 864.0 * 1.17613
relevo = np.load(os.path.join(RAIZ, "ferramentas", "cena", "_relevo_final.npy"))
terra = np.load(os.path.join(RAIZ, "ferramentas", "cena", "_terra.npy"))
th, tw = relevo.shape
LX, LY = IB_LARG * M_POR_VB, IB_ALT * M_POR_VB
pxg, pyg = LX / tw, LY / th


def mundo(vx, vy):
    return ((vx - IB_OX - IB_LARG / 2) * M_POR_VB,
            -(vy - IB_OY - IB_ALT / 2) * M_POR_VB)


def altura_em(vx, vy):
    mx, my = mundo(vx, vy)
    fi = (mx + LX / 2) / pxg
    fj = (LY / 2 - my) / pyg
    i0 = max(0, min(tw - 2, int(math.floor(fi))))
    j0 = max(0, min(th - 2, int(math.floor(fj))))
    u, v = min(max(fi - i0, 0.0), 1.0), min(max(fj - j0, 0.0), 1.0)
    a = relevo[j0][i0] * (1 - u) + relevo[j0][i0 + 1] * u
    b = relevo[j0 + 1][i0] * (1 - u) + relevo[j0 + 1][i0 + 1] * u
    return float(a * (1 - v) + b * v)


# ── A DISTANCIA A AGUA, MEDIDA DE VERDADE ────────────────────────────────────
# Uma busca num quadrado a volta do ponto satura depressa e diz "longe" para
# tudo o que passe do raio. Isto e a transformada de distancia da mascara de
# terra: cada celula fica a saber quantas celulas a separam da agua mais
# proxima, do mar ate ao meio da meseta. Uma celula sao 4,9 m.
from collections import deque                                     # noqa: E402

_agua = np.full(terra.shape, 1e9, dtype=np.float32)
_fila = deque()
for _j in range(th):
    for _i in range(tw):
        if not terra[_j][_i]:
            _agua[_j][_i] = 0.0
            _fila.append((_j, _i))
while _fila:
    _j, _i = _fila.popleft()
    for _dj, _di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        _y, _x = _j + _dj, _i + _di
        if 0 <= _y < th and 0 <= _x < tw and _agua[_y][_x] > _agua[_j][_i] + 1:
            _agua[_y][_x] = _agua[_j][_i] + 1
            _fila.append((_y, _x))


def dist_agua(vx, vy):
    mx, my = mundo(vx, vy)
    i = max(0, min(tw - 1, int((mx + LX / 2) / pxg)))
    j = max(0, min(th - 1, int((LY / 2 - my) / pyg)))
    return float(_agua[j][i])

# ── o que cada terreno vale, medido no mapa de hoje ──────────────────────────
VEL = {"costa": 98.0, "vale": 95.0, "planalto": 73.0, "planicie": 68.0,
       "serra": 47.0}


def perfil(A, B):
    """anda por cima da estrada e traz o que ela atravessa"""
    N = 60
    alt, ag = [], []
    for k in range(N + 1):
        t = k / N
        x, y = A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t
        alt.append(altura_em(x, y))
        ag.append(dist_agua(x, y))
    # a SUBIDA e o que cansa: a soma de tudo o que se sobe, e nao a diferenca
    # entre as pontas. Uma estrada que sobe e desce duas colinas e dura ainda
    # que acabe a altura a que comecou.
    return {"alt": sum(alt) / len(alt), "topo": max(alt),
            "sobe": sum(max(0.0, alt[i] - alt[i - 1]) for i in range(1, len(alt))),
            "agua": min(ag), "comp": math.dist(A, B)}


# ── OS LIMIARES SAO MEDIDOS, NAO ESCOLHIDOS ──────────────────────────────────
# Vieram da distribuicao das 39 estradas deste desenho (uma celula = 4,9 m):
#
#   altura media   min 57  quartil 62  mediana 72  quartil 79  max 123
#   subida total   min  0  quartil  4  mediana 10  quartil 24  max  87
#   agua (minimo)  min 13  quartil 18  mediana 25  quartil 60  max  94
#
# O chao desta ilha assenta aos ~57 m, portanto "alto" comeca acima disso e nao
# acima de zero. E agua a 21 celulas sao 103 m: uma estrada que passe a menos
# disso da costa VE o mar, e e uma estrada de costa.
def classificar(v):
    if v["sobe"] >= 26 or v["topo"] >= 118:
        return "serra"
    if v["agua"] <= 21:
        return "costa"
    if v["alt"] >= 76:
        return "planalto"
    if v["alt"] <= 63 and v["sobe"] <= 8:
        return "vale"
    return "planicie"

# ── ler o desenho e a tabela de gemeas ───────────────────────────────────────
# As fichas das cidades (papel, tamanho, sprite, dono, gemea) vem do ficheiro de
# hoje: o Lucas mexeu nas POSICOES e nas ESTRADAS, nao em quem e quem.
d = json.load(open(DESENHO, encoding="utf-8"))
P = {a["id"]: (a["x"], a["y"]) for a in d["aldeias"]}
NOME = {a["id"]: a["nome"] for a in d["aldeias"]}
E = sorted({tuple(sorted(e)) for e in d["estradas"]})

# as fichas vem do proprio world-iberia, em memoria: nada de ficheiros
# temporarios largados na raiz do projeto
velho = json.loads(subprocess.run(
    [os.environ.get("NODE", "node"), "-e",
     "const I=require('./world-iberia.js');"
     "console.log(JSON.stringify(I.CIDADES.map(c=>({id:c.id,nome:c.nome,lado:c.lado,"
     "papel:c.papel,tamanho:c.tamanho,sprite:c.sprite,dono:c.dono,par:c.par,"
     "desloc:c.desloc}))))"],
    capture_output=True, text=True, check=True).stdout)
FICHA = {c["id"]: c for c in velho}
PAR = {c["id"]: c["par"] for c in velho}


info = {}
for a, b in E:
    info[(a, b)] = perfil(P[a], P[b])

sem_gemea = [k for k in info if tuple(sorted((PAR[k[0]], PAR[k[1]]))) not in info]
if sem_gemea:
    print("PARAGEM: %d estrada(s) sem gemea — o equilibrio nao pode ser garantido:"
          % len(sem_gemea))
    for a, b in sem_gemea:
        print("   %s-%s  faltaria %s-%s" % (a, b, PAR[a], PAR[b]))
    sys.exit(1)

# ── A ETIQUETA E DA ESTRADA; O CUSTO E DO PAR ────────────────────────────────
# O relevo da Iberia nao e simetrico: Barcelona-Girona sobe 87 m e a gemea
# dela, Lisboa-Evora, nao sobe nada. Sao duas coisas diferentes, e mentir sobre
# isso na etiqueta so ia confundir quem lesse o ficheiro depois.
#
# Entao cada estrada leva a etiqueta do chao que ATRAVESSA, e o CUSTO e a media
# do que as duas custariam sozinhas. A etiqueta e verdade sobre a paisagem; o
# numero e verdade sobre o jogo.
#
# ⚠️ Daqui sai uma coisa que parece um erro e nao e: uma estrada de costa pode
# custar mais do que outra de costa do mesmo comprimento, porque a gemea dela
# atravessa uma serra. Quem vier "corrigir" um custo para bater com a etiqueta
# parte o equilibrio -- que e a unica razao pela qual uma vitoria neste jogo
# diz alguma coisa sobre o modelo que a ganhou.
terr = {k: classificar(v) for k, v in info.items()}
custo = {}
for k in info:
    g = tuple(sorted((PAR[k[0]], PAR[k[1]])))
    bruto = (info[k]["comp"] / VEL[terr[k]] + info[g]["comp"] / VEL[terr[g]]) / 2
    custo[k] = max(1.0, round(bruto * 2) / 2)

# ── rota e equilíbrio, com a mesma conta do jogo ─────────────────────────────
viz = {c: [] for c in P}
for (a, b), c in custo.items():
    viz[a].append((b, c))
    viz[b].append((a, c))


def rota(o, dst):
    import heapq
    D = {o: 0.0}
    fila = [(0.0, o)]
    while fila:
        cst, v = heapq.heappop(fila)
        if v == dst:
            return cst
        if cst > D.get(v, 1e18):
            continue
        for w, c in viz[v]:
            n = cst + c
            if n < D.get(w, 1e18) - 1e-12:
                D[w] = n
                heapq.heappush(fila, (n, w))
    return D.get(dst)


falhas = []
for c in P:
    a, b = rota("lisboa", c), rota("barcelona", PAR[c])
    if a is None or b is None or abs(a - b) > 1e-9:
        falhas.append("%s=%s != espelho %s=%s" % (c, a, PAR[c], b))

print("REDE: %d aldeias, %d estradas" % (len(P), len(E)))
print("terrenos:", {t: sum(1 for x in terr.values() if x == t) for t in VEL})
print("custo: min %.1f  mediana %.1f  max %.1f  |  soma %.1f"
      % (min(custo.values()), sorted(custo.values())[len(custo) // 2],
         max(custo.values()), sum(custo.values())))
print("EQUILIBRIO: %d falhas" % len(falhas))
for f in falhas[:8]:
    print("   " + f)
print("alcance total desde uma capital: %.1f turnos"
      % sum(rota("lisboa", c) for c in P))

if "--detalhe" in sys.argv:
    print()
    for (a, b) in sorted(E, key=lambda k: -custo[k]):
        v = info[(a, b)]
        print("  %-10s %-10s custo %4.1f  %-9s %5.0f px  alt %3.0f  sobe %3.0f  agua %2.0f"
              % (a, b, custo[(a, b)], terr[(a, b)], v["comp"], v["alt"],
                 v["sobe"], v["agua"]))


# ── AS CURVAS ────────────────────────────────────────────────────────────────
# Uma estrada a direito entre duas aldeias nao existe em lado nenhum: contorna
# um cabeco, segue um vale, dobra por causa de um rio. Sem isso o mapa parece
# um diagrama de metro.
#
# Uma curva de controlo ao meio chega -- e o desvio e DETERMINISTICO, tirado do
# nome do troco. Correr a ferramenta duas vezes tem de dar o mesmo ficheiro,
# senao o `git diff` enche-se de ruido a cada geracao e deixa de se ver o que
# mudou de verdade.
#
# E cada curva e CONFERIDA depois de feita: se aproximar duas estradas a menos
# de 120 m ou as puser a cruzar, tenta-se o outro lado, depois metade, e por
# fim deixa-se a direito. Uma estrada bonita que reintroduza o defeito que
# passamos uma semana a tirar nao vale nada.
import hashlib                                                    # noqa: E402


def _bezier(A, C, B, n=24):
    return [( (1-t)**2*A[0] + 2*(1-t)*t*C[0] + t*t*B[0],
              (1-t)**2*A[1] + 2*(1-t)*t*C[1] + t*t*B[1] )
            for t in (i / n for i in range(n + 1))]


def _dseg(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / L))
    return math.hypot(p[0] - (a[0] + t*dx), p[1] - (a[1] + t*dy))


def _lado(p, q, r):
    v = (q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])
    return (v > 0) - (v < 0)


def _cruzam(a, b, c, e):
    return _lado(a,b,c) != _lado(a,b,e) and _lado(c,e,a) != _lado(c,e,b)


PERTO_VB = 120.0 / M_POR_VB
PONTA_VB = 40.0


def _choca(linha, outras):
    for o in outras:
        for i in range(len(linha) - 1):
            for j in range(len(o) - 1):
                if _cruzam(linha[i], linha[i+1], o[j], o[j+1]):
                    return True
        for p in linha:
            if (math.dist(p, linha[0]) < PONTA_VB
                    or math.dist(p, linha[-1]) < PONTA_VB):
                continue
            for j in range(len(o) - 1):
                if _dseg(p, o[j], o[j+1]) < PERTO_VB:
                    return True
    return False


def curvas():
    linhas = {}
    for k in sorted(E, key=lambda k: -info[k]["comp"]):
        A, B = P[k[0]], P[k[1]]
        comp = info[k]["comp"]
        h = int(hashlib.md5((k[0] + ">" + k[1]).encode()).hexdigest()[:8], 16)
        nx, ny = -(B[1] - A[1]) / comp, (B[0] - A[0]) / comp
        base = comp * (0.030 + (h % 23) / 23.0 * 0.028)
        vizinhas = [v for kk, v in linhas.items() if not ({kk[0], kk[1]} & {k[0], k[1]})]
        escolhida = None
        for f in (1.0, -1.0, 0.5, -0.5):
            C = (A[0] + (B[0]-A[0])/2 + nx*base*f, A[1] + (B[1]-A[1])/2 + ny*base*f)
            linha = _bezier(A, C, B)
            if not _choca(linha, vizinhas):
                escolhida = (C, linha)
                break
        if escolhida is None:
            linhas[k] = [A, B]
            continue
        linhas[k] = escolhida[1]
        VIA[k] = escolhida[0]
    return linhas


VIA = {}
_linhas = curvas()
print("curvas: %d de %d estradas dobradas (as outras ficaram a direito)"
      % (len(VIA), len(E)))

# ── ESCREVER O FICHEIRO ─────────────────────────────
# Substituem-se DOIS blocos do `world-iberia.js` e mais nada: a lista das
# cidades e a das estradas. O involucro, o `MAPA`, o `rota`, o `bloqueio` e o
# `verificarEquilibrio` ficam byte a byte como estao -- e a maneira de ter a
# certeza de que a interface nao muda por descuido.
def bloco(texto, marca, novo):
    i = texto.index(marca)
    j = texto.index("\n];", i) + len("\n];")
    return texto[:i] + novo + texto[j:]


if "--escrever" in sys.argv:
    if falhas:
        print("NAO ESCREVI: o equilibrio tem falhas.")
        sys.exit(1)
    velho_txt = io.open(ALVO, encoding="utf-8", newline="").read()

    lin = []
    for c in sorted(P, key=lambda k: (FICHA[k]["lado"] != "O", rota("lisboa", k), k)):
        f = FICHA[c]
        dsl = f.get("desloc")
        lin.append(
            "  { id:%-13s nome:%-14s x:%8.1f, y:%8.1f, lado:'%s', papel:%-9s "
            "tamanho:%-11s sprite:%-16s dono:%-7s par:%-12s custoLisboa:%5.1f, "
            "custoBarcelona:%5.1f%s }," % (
                "'" + c + "',", "'" + NOME[c] + "',", P[c][0], P[c][1],
                f["lado"], "'" + f["papel"] + "',", "'" + f["tamanho"] + "',",
                "'" + f["sprite"] + "',",
                ("'%s'," % f["dono"]) if f["dono"] else "null,",
                "'" + f["par"] + "',", rota("lisboa", c), rota("barcelona", c),
                (", desloc:[%s,%s]" % (dsl[0], dsl[1])) if dsl else ""))
    cid = "const CIDADES = [\n" + "\n".join(lin) + "\n];"

    # as estradas saem AOS PARES, uma a seguir a outra, como no ficheiro que
    # veio antes: quem ler ve logo que sao espelho uma da outra
    vistas, lin = set(), []
    for k in sorted(E, key=lambda k: (custo[k], k)):
        if k in vistas:
            continue
        g = tuple(sorted((PAR[k[0]], PAR[k[1]])))
        vistas |= {k, g}
        # uma estrada entre duas gemeas (Madrid-Toledo) e a sua propria
        # gemea: emitida duas vezes, o mapa ficava com 40 estradas em vez
        # de 39 e o desenho punha duas fitas uma por cima da outra
        for a, b in ((k,) if k == g else (k, g)):
            c = VIA.get(tuple(sorted((a, b))))
            lin.append("  { de:%-13s para:%-13s custo:%5.1f, terreno:%-12s%s },"
                       % ("'" + a + "',", "'" + b + "',", custo[(a, b)],
                          "'" + terr[(a, b)] + "'",
                          (", via:[[%.1f,%.1f]]" % c) if c else ""))
    est = "const ESTRADAS = [\n" + "\n".join(lin) + "\n];"

    novo = bloco(bloco(velho_txt, "const CIDADES = [", cid),
                 "const ESTRADAS = [", est)
    novo = novo.replace(
        "// world-iberia.js - Arena dos Reis  (v2, 24 cidades / 41 estradas)",
        "// world-iberia.js - Arena dos Reis  (v3, 24 cidades / %d estradas)" % len(E))
    io.open(ALVO, "w", encoding="utf-8", newline="\n").write(novo)
    print("escrito: world-iberia.js")

    # ── E O RASCUNHO DO EDITOR TEM DE MORRER ─────────────────
    # O `index.html` aplica `IBERIA_AJUSTES.cidades` POR CIMA das coordenadas
    # do mapa. Com as posicoes novas no world-iberia e as antigas aqui, o jogo
    # punha as aldeias de volta onde estavam e ninguem perceberia porque.
    caminho_aj = os.path.join(RAIZ, "mapa-ajustes.js")
    aj = io.open(caminho_aj, encoding="utf-8", newline="").read()
    i = aj.index("  cidades: {")
    j = aj.index("  desloc: {")
    io.open(caminho_aj, "w", encoding="utf-8", newline="\n").write(
        aj[:i] + "  // VAZIOS de proposito: as posicoes e as curvas passaram a\n"
        "  // viver no world-iberia.js, gerado por ferramentas/gerar-rede.py.\n"
        "  cidades: {},\n  vias: {},\n" + aj[j:])
    print("limpo: mapa-ajustes.js (cidades e vias)")
