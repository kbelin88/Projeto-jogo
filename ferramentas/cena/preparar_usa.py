# preparar_usa.py — a terra, o mar e o relevo do mapa dos EUA, na grelha do forno.
#
#   python ferramentas/cena/preparar_usa.py            (Python do sistema: numpy, scipy, PIL)
#
# Le dados REAIS (fora do git, em ferramentas/cena/dados_usa/). Para os voltar a ter:
#   curl -g -o etopo_usa.nc "https://upwell.pfeg.noaa.gov/erddap/griddap/etopo180.nc?altitude[(22):1:(53)][(-130):1:(-65)]"
#   curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
#   (e o mesmo para ne_50m_lakes.geojson e ne_50m_rivers_lake_centerlines.geojson)
#   etopo_usa.nc                          altimetria ETOPO1 da NOAA, 1 minuto de arco
#   ne_50m_admin_0_countries.geojson      a fronteira dos EUA   (Natural Earth, dominio publico)
#   ne_50m_lakes.geojson                  os lagos
#   ne_50m_rivers_lake_centerlines.geojson  os rios
#
# e escreve em ferramentas/cena/usa/, na MESMA grelha e com os MESMOS nomes que o forno le
# (o `mapa_ativo.py` aponta-o para la com MAPA=usa):
#   _terra.npy        bool     onde ha chao
#   _alfa.npy         0..1     a mesma mascara com a beira suave (a costa recorta-se por ela)
#   _altura.npy    0..1     o chao FINAL de desenho que o forno le (vales nas estradas, costa a descer)
#   _altura_serras.npy 0..1  o relevo de desenho antes dos vales, 1 = o cume mais alto
#   _vale.npy         0..1     o chao do vale: por onde vao as estradas e assentam as aldeias
#   _seco.npy         0..1     quao seco e o sitio (0 floresta humida, 1 deserto) — para os biomas
#   _neve.npy         0..1     os cumes de desenho acima da linha de neve
#   _serra.npy        0..1     onde ha serra (o `cristas.py` esculpiu ali; o chao pintado da-lhe rocha e neve)
#   _altura_cortada.npy  o chao com as serras ja cortadas pelas estradas, antes das cristas (a prova do `cristas.py`)
#   _grelha.json      a grelha (origem, celula, tamanho), os rios e os lagos em unidades do mapa
#   _sudoeste_peso.npy   0..1  o planalto do Grand Canyon e o vale das mesas (o `sudoeste.py`)
#   _sudoeste_pegada.npy bool  as celulas debaixo das mesas (o forno nao pousa pedras ali)
#   pesquisa/usa-relevo.png   a prova: o mapa visto de cima, com a rede por cima
#   sonda3d/usa_sudoeste.json o canyon e as mesas para a bancada (`usa.html`), a mesma geometria do forno
#
# ── A ILHA ───────────────────────────────────────────────────────────────────
# Decisao do Lucas (11/11): os EUA sao uma ILHA, so os 48 estados, como a
# Iberia. O Canada e o Mexico sao mar. Tres consequencias, tratadas aqui:
#   1. os Grandes Lagos deixam de ser lagos: ficam baias do mar do norte;
#   2. a fronteira do paralelo 49 seria uma costa tracada a regua. Onde a terra
#      acaba numa FRONTEIRA (e nao numa costa a serio) a beira e ondulada por
#      ruido de baixa frequencia. A costa verdadeira nao e tocada;
#   3. estradas que em linha reta passam pelo Canada ou por cima de um golfo
#      (Buffalo-Detroit, Tampa-Tallahassee...) tem de levar `via`. Este
#      preparador MEDE quanta agua cada estrada pisa e diz quais.
#
# ── O RELEVO DE DESENHO NAO E A ALTITUDE ─────────────────────────────────────
# A altitude real nao serve tal e qual: Denver esta a 1600 m e parece plana, e
# o Oeste inteiro saia um planalto com as montanhas mal a assomar. O que o olho
# le como "montanha" e a altura ACIMA DO QUE ESTA A VOLTA. Entao:
#     relevo = pouco da base regional (o pais sobe para oeste, mas devagar)
#            + muito do que sobressai da base (as serras)
# Mesma licao da ilha da Iberia: o peso esta na encosta, nao na cota.
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
from scipy.io import netcdf_file

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DADOS = os.path.join(RAIZ, "ferramentas", "cena", "dados_usa")
CENA = os.path.join(RAIZ, "ferramentas", "cena", "usa")      # a pasta de trabalho do MAPA=usa
os.makedirs(CENA, exist_ok=True)

# ---- a projecao: a MESMA do world-usa.js ------------------------------------
UN = 64.0
COS38 = math.cos(math.radians(38.0))
def x_de(lon): return (lon + 125.0) * COS38 * UN
def y_de(lat): return (49.5 - lat) * UN

# ---- a grelha: a MESMA celula do forno da Iberia (1429 unidades em 572 celulas)
CEL = 1429.0 / 572.0                       # unidades do mapa por celula (~4,9 m)
LON0, LON1, LAT0, LAT1 = -126.0, -66.0, 24.0, 50.2   # 1 grau de mar a toda a volta
X0, Y0 = x_de(LON0), y_de(LAT1)
TW = int(round((x_de(LON1) - X0) / CEL))
TH = int(round((y_de(LAT0) - Y0) / CEL))
jj, ii = np.mgrid[0:TH, 0:TW]
LON = (X0 + (ii + 0.5) * CEL) / (COS38 * UN) - 125.0
LAT = 49.5 - (Y0 + (jj + 0.5) * CEL) / UN
print("grelha %d x %d (%.0f mil celulas), celula %.3f unidades" % (TW, TH, TW * TH / 1000, CEL))


def ruido(semente, escala, oitavas=4):
    """ruido de valor suave, 0..1, por oitavas de grelhas aleatorias ampliadas"""
    rng = np.random.default_rng(semente)
    tot = np.zeros((TH, TW), np.float32)
    amp, soma = 1.0, 0.0
    for o in range(oitavas):
        e = max(2.0, escala / (2 ** o))
        gh, gw = int(TH / e) + 3, int(TW / e) + 3
        g = rng.random((gh, gw)).astype(np.float32)
        z = ndi.zoom(g, (TH / (gh - 2), TW / (gw - 2)), order=3)[:TH, :TW]
        tot += z * amp
        soma += amp
        amp *= 0.5
    tot /= soma
    return (tot - tot.min()) / (tot.max() - tot.min())


# ---- 1. a altimetria ---------------------------------------------------------
nc = netcdf_file(os.path.join(DADOS, "etopo_usa.nc"), "r", mmap=False)
elat = nc.variables["latitude"][:].astype(np.float64)
elon = nc.variables["longitude"][:].astype(np.float64)
ealt = nc.variables["altitude"][:].astype(np.float32)
nc.close()
if elat[0] > elat[-1]:
    elat, ealt = elat[::-1], ealt[::-1]
# a grelha e ~2,3x mais grossa do que o ETOPO: alisar antes de amostrar, senao e ruido
ealt_s = ndi.gaussian_filter(ealt, 1.0)
cj = (LAT - elat[0]) / (elat[1] - elat[0])
ci = (LON - elon[0]) / (elon[1] - elon[0])
ALT = ndi.map_coordinates(ealt_s, [cj, ci], order=1, mode="nearest").astype(np.float32)
print("altitude real na grelha: %.0f a %.0f m" % (ALT.min(), ALT.max()))

# ---- 2. a fronteira e os lagos -------------------------------------------------
SS = 3                                     # sobreamostragem do rasterizador


def rasterizar(aneis_por_poligono):
    """lista de poligonos, cada um [exterior, buraco, buraco...] em lon/lat -> 0..1 na grelha"""
    im = Image.new("L", (TW * SS, TH * SS), 0)
    d = ImageDraw.Draw(im)
    for aneis in aneis_por_poligono:
        for k, anel in enumerate(aneis):
            pts = [((x_de(lo) - X0) / CEL * SS, (y_de(la) - Y0) / CEL * SS) for lo, la in anel]
            if len(pts) >= 3:
                d.polygon(pts, fill=255 if k == 0 else 0)
    a = np.asarray(im, np.float32) / 255.0
    return a.reshape(TH, SS, TW, SS).mean(axis=(1, 3))


def poligonos(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return list(geom["coordinates"])


paises = json.load(open(os.path.join(DADOS, "ne_50m_admin_0_countries.geojson"), encoding="utf-8"))
eua = [f for f in paises["features"] if f["properties"].get("ADMIN") == "United States of America"]
assert len(eua) == 1, "nao achei os EUA no Natural Earth"
US = rasterizar(poligonos(eua[0]["geometry"])) > 0.5

lagos = json.load(open(os.path.join(DADOS, "ne_50m_lakes.geojson"), encoding="utf-8"))
GRANDES = {"Lake Superior", "Lake Michigan", "Lake Huron", "Lake Erie", "Lake Ontario"}
pol_lagos = []
for f in lagos["features"]:
    if f["properties"].get("name") in GRANDES:
        pol_lagos += poligonos(f["geometry"])
LAGO = rasterizar(pol_lagos) > 0.5
print("Grandes Lagos: %d poligonos, %d celulas" % (len(pol_lagos), int(LAGO.sum())))

TERRA_REAL = (ALT > 0.0) & ~LAGO           # chao a serio, de qualquer pais
# ── TERRA ABAIXO DO NIVEL DO MAR ─────────────────────────────────────────────
# "Altitude > 0" chama mar ao vale do Salton Sea (-70 m), que pelo lado do
# Mexico se liga ao golfo da California: abria um braco de mar ate meio caminho
# entre San Diego e Phoenix, e a estrada pisava-o. O Vale da Morte fecha-se
# sozinho mais abaixo (e um charco); este nao. (lat0, lat1, lon0, lon1)
ATERROS = [(32.3, 34.3, -116.7, -114.6)]
for la0, la1, lo0, lo1 in ATERROS:
    TERRA_REAL |= US & (LAT > la0) & (LAT < la1) & (LON > lo0) & (LON < lo1) & ~LAGO
ESTRANGEIRO = TERRA_REAL & ~US             # Canada e Mexico

# a fronteira ondulada: desloca-se a mascara dos EUA por um campo de ruido, mas
# SO perto de terra estrangeira. Longe dela a beira e a costa verdadeira.
AMP = 7.0                                  # celulas (~35 m): chega para matar a regua
dx = (ruido(11, 46) - 0.5) * 2 * AMP
dy = (ruido(12, 46) - 0.5) * 2 * AMP
US_ond = ndi.map_coordinates(US.astype(np.float32), [jj + dy, ii + dx], order=1, mode="nearest") > 0.5
perto_fronteira = ndi.distance_transform_edt(~ESTRANGEIRO) < AMP * 2.5
US_final = np.where(perto_fronteira, US_ond, US)
TERRA = TERRA_REAL & US_final
# so a ilha grande e as ilhas com tamanho de aldeia; os salpicos saem
rot, n = ndi.label(TERRA)
tam = ndi.sum(TERRA, rot, range(1, n + 1))
manter = [k + 1 for k, t in enumerate(tam) if t >= 400]
TERRA = np.isin(rot, manter)
# e os charcos: agua cercada de terra mais pequena do que isto fecha-se
rot, n = ndi.label(~TERRA)
tam = ndi.sum(~TERRA, rot, range(1, n + 1))
for k, t in enumerate(tam):
    if t < 250:
        TERRA[rot == k + 1] = True
print("terra: %d celulas (%.1f%% da grelha), %d ilhas" % (int(TERRA.sum()), TERRA.mean() * 100, len(manter)))

ALFA = ndi.gaussian_filter(TERRA.astype(np.float32), 1.1)

# ---- 3. o relevo de desenho -----------------------------------------------------
alt = np.where(TERRA_REAL, np.maximum(ALT, 0.0), 0.0)
# a base regional: o que esta a volta, a ~60 celulas (300 m de jogo, uns 2,5 graus)
peso = ndi.gaussian_filter(TERRA_REAL.astype(np.float32), 60.0) + 1e-6
base = ndi.gaussian_filter(alt, 60.0) / peso
saliente = alt - base                       # serras > 0, vales < 0
K_BASE, K_SERRA, K_VALE = 0.30, 1.00, 0.45
relevo = K_BASE * base + np.where(saliente > 0, K_SERRA * saliente, K_VALE * saliente)
relevo = np.maximum(relevo, 0.0)
# a compressao do topo: sem ela um unico cume (Rainier, Whitney) manda na escala
# e o resto do pais fica raso. Raiz acima do joelho.
JOELHO = np.percentile(relevo[TERRA], 97.0)
relevo = np.where(relevo > JOELHO, JOELHO + (relevo - JOELHO) ** 0.80, relevo)
# ── O GRAO REAL NAO SERVE DE GEOMETRIA (medido na bancada, 11/11) ───────────
# A grelha tem ~4 km reais por celula e o cume vai ficar a centenas de metros
# de jogo: uma crista real de 20 km de largo sao 5 celulas, e com o exagero
# vertical virava uma AGULHA. A 1.a volta da bancada (borrao 1,2) era uma
# floresta de espigoes. E a licao da Iberia outra vez ("o campo tem de ser
# borrado"), e resolve-se da mesma maneira: medir o declive e escolher.
# O que se perde em grao volta depois, no forno, como rocha e textura.
M_CEL = CEL * 98.9 / (3.8 * 1429.0 / 108.0)
print()
print("declive do relevo de desenho (graus), por borrao e por altura do cume:")
print("  borrao   cume    p50    p95    max")
for sg in (1.2, 2.5, 4.0, 5.5, 7.0):
    r_ = ndi.gaussian_filter(relevo, sg)
    r_ = r_ / r_[TERRA].max()
    for hm in (220.0, 300.0):
        gy_, gx_ = np.gradient(r_ * hm, M_CEL)
        dg = np.degrees(np.arctan(np.hypot(gx_, gy_)))[TERRA]
        print("  %5.1f   %4.0f   %5.1f  %5.1f  %5.1f" % (sg, hm, np.percentile(dg, 50), np.percentile(dg, 95), dg.max()))
BORRAO = float(os.environ.get("BORRAO", "5.5"))
relevo = ndi.gaussian_filter(relevo, BORRAO)
NORMA = relevo[TERRA].max()
ALTURA = np.where(TERRA, relevo / NORMA, 0.0).astype(np.float32)
# o CHAO DO VALE: so a base regional, sem serra nenhuma. E por onde vao as
# estradas e onde assentam as aldeias -- as serras sobem ao lado, nao por baixo.
VALE = np.where(TERRA, np.minimum(ndi.gaussian_filter(K_BASE * base, 6.0) / NORMA, ALTURA), 0.0).astype(np.float32)

# ---- 4. secura e neve (a materia dos biomas; a pintura vem depois) --------------
# (M3, 12/11) A CHUVA REAL: a precipitacao anual do WorldClim 2.1 (`biomas_usa.py`).
# Ate aqui a secura era inventada com tres regras de geografia (leste do 98 chove,
# oeste do 104 nao, a costa do Pacifico e humida) e saia uma parede reta no
# meridiano 98 -- o defeito 2 da M1.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import biomas_usa as BI
CHUVA = BI.chuva(LON, LAT)
print("chuva real: Seattle %.0f, Phoenix %.0f, Omaha %.0f, Miami %.0f mm/ano" % tuple(
    CHUVA[int((y_de(la) - Y0) / CEL), int((x_de(lo) - X0) / CEL)]
    for lo, la in [(-122.3, 47.6), (-112.1, 33.4), (-96.0, 41.3), (-80.2, 25.8)]))
SECO = np.where(TERRA, ndi.gaussian_filter(BI.secura(CHUVA), 2.0), 0.0).astype(np.float32)
# a linha de neve desce para norte: 3300 m no Novo Mexico, 2300 m no Montana
linha = 3300.0 - (LAT - 33.0) * 62.0
NEVE = np.where(TERRA, np.clip((ALT - linha) / 450.0, 0.0, 1.0), 0.0).astype(np.float32)

# ---- 5. a rede por cima: aldeias em terra? estradas a seco? ----------------------
rede = json.loads(subprocess.check_output(
    ["node", "-e", "const U=require('./world-usa.js');console.log(JSON.stringify({c:U.CIDADES,e:U.ESTRADAS}))"],
    cwd=RAIZ))
cid = {c["id"]: c for c in rede["c"]}
dist_mar = ndi.distance_transform_edt(TERRA) * CEL          # unidades ate a agua


def cel(x, y):
    return int((y - Y0) / CEL), int((x - X0) / CEL)


print("\nALDEIAS: distancia a agua (unidades) e relevo de desenho")
molhadas = []
for c in rede["c"]:
    j, i = cel(c["x"], c["y"])
    if not TERRA[j, i]:
        molhadas.append(c["id"])
    c["_mar"], c["_alt"] = float(dist_mar[j, i]), float(ALTURA[j, i])
print("  na agua: %s" % (", ".join(molhadas) or "nenhuma"))
print("  a menos de 40 da agua: %s" % ", ".join(
    "%s %.0f" % (c["id"], c["_mar"]) for c in rede["c"] if 0 < c["_mar"] < 40))
print("  as 6 mais altas: %s" % ", ".join(
    "%s %.2f" % (c["id"], c["_alt"]) for c in sorted(rede["c"], key=lambda c: -c["_alt"])[:6]))


def pontos_da_estrada(e, n=200):
    pts = [(cid[e["de"]]["x"], cid[e["de"]]["y"])] + [tuple(v) for v in e.get("via", [])] + \
          [(cid[e["para"]]["x"], cid[e["para"]]["y"])]
    seg = [math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) for k in range(len(pts) - 1)]
    tot = sum(seg)
    out = []
    for q in range(n + 1):
        s = tot * q / n
        k = 0
        while k < len(seg) - 1 and s > seg[k]:
            s -= seg[k]
            k += 1
        t = s / seg[k] if seg[k] else 0.0
        out.append((pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t))
    return out


print("\nESTRADAS: quanto pisam agua, e a subida maxima do relevo de desenho")
na_agua = []
for e in rede["e"]:
    ps = pontos_da_estrada(e)
    molh = sum(1 for (x, y) in ps if not TERRA[cel(x, y)]) / len(ps)
    hs = [float(ALTURA[cel(x, y)]) for (x, y) in ps]
    e["_agua"], e["_cume"] = molh, max(hs)
    if molh > 0.02:
        na_agua.append(e)
for e in sorted(na_agua, key=lambda e: -e["_agua"]):
    print("  %-16s - %-16s %4.0f%% na agua" % (e["de"], e["para"], e["_agua"] * 100))
print("  estradas com agua: %d de %d" % (len(na_agua), len(rede["e"])))
print("  as 6 que mais sobem: %s" % ", ".join(
    "%s-%s %.2f" % (e["de"], e["para"], e["_cume"]) for e in sorted(rede["e"], key=lambda e: -e["_cume"])[:6]))

# ---- 6. os rios (so os grandes; o tracado fino e do forno) -------------------------
rios_ne = json.load(open(os.path.join(DADOS, "ne_50m_rivers_lake_centerlines.geojson"), encoding="utf-8"))
RIOS = []
for f in rios_ne["features"]:
    g = f["geometry"]
    if not g:
        continue
    linhas = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
    for ln in linhas:
        pts = [(x_de(lo), y_de(la)) for lo, la in ln]
        dentro = [p for p in pts if X0 <= p[0] < X0 + TW * CEL and Y0 <= p[1] < Y0 + TH * CEL and TERRA[cel(*p)]]
        if len(dentro) >= 4:
            RIOS.append({"nome": f["properties"].get("name") or "", "pts": [[round(x, 1), round(y, 1)] for x, y in dentro]})
print("\nrios dentro da ilha: %d tracos (%s...)" % (
    len(RIOS), ", ".join(sorted({r["nome"] for r in RIOS if r["nome"]})[:14])))

# ---- 6b. o chao FINAL de desenho: vales nas estradas, costa a descer ao mar -------
# (calculado antes de gravar e de pintar: a neve e a cor seguem ESTE chao, e nao
# a altitude real -- senao pintava-se neve no fundo do vale por onde a estrada
# passa, que na realidade era um cume)
im_e = Image.new("L", (TW, TH), 0)
de = ImageDraw.Draw(im_e)
for e in rede["e"]:
    de.line([((x - X0) / CEL, (y - Y0) / CEL) for x, y in pontos_da_estrada(e, 120)], fill=255, width=1)
for c in rede["c"]:
    x, y = (c["x"] - X0) / CEL, (c["y"] - Y0) / CEL
    r = 14 if c["papel"] == "capital" else 10
    de.ellipse([x - r, y - r, x + r, y + r], fill=255)
d_estr = ndi.distance_transform_edt(np.asarray(im_e) == 0)          # celulas ate a estrada
PROT, FADE = 16.0, 22.0                                             # ~80 m protegidos, ~110 m de transicao
t = np.clip((d_estr - PROT) / FADE, 0.0, 1.0)
solta = t * t * (3 - 2 * t)                                         # 0 na estrada, 1 longe
leito = VALE                                                        # por onde a estrada vai: o chao do vale
alt_b = leito + (ALTURA - leito) * solta

# ---- 6c. as SERRAS (M2): a massa e a real, a forma desenha-se --------------------
# O corte acima (a serra a subir do vale em 110 m a partir da estrada) e o que
# fazia das Rochosas tendas lisas: no Oeste a rede so deixa serra no meio de
# cada malha, e o que se via era a rampa do corte. O `cristas.py` troca-o por
# uma lomba baixa mais cumes INTEIROS, cada um do tamanho do espaco livre.
# `CRISTAS=0` volta ao corte (para comparar).
np.save(os.path.join(CENA, "_altura_cortada.npy"), alt_b.astype(np.float32))
d_mar_c = ndi.distance_transform_edt(TERRA)
SERRA = np.zeros(ALTURA.shape, np.float32)
if os.environ.get("CRISTAS", "1") != "0":
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import cristas as CR                                    # noqa: E402
    _rel = {}
    _lisa = (alt_b / alt_b[TERRA].max()).astype(np.float32)
    # o caracter: alpino a oeste do meridiano 103 (Rochosas, Sierra, Cascatas),
    # gasto a leste do 97 (Apalaches, Ozarks): macicos redondos em vez de picos
    CARACTER = (0.45 + 0.55 * np.clip((-97.0 - LON) / 6.0, 0.0, 1.0)).astype(np.float32)
    alt_b, SERRA = CR.esculpir(ALTURA, VALE, TERRA, d_estr, d_mar_c, relato=_rel, caracter=CARACTER)
    _fator = float(alt_b[TERRA].max())
    alt_b = np.where(TERRA, alt_b / _fator, 0.0).astype(np.float32)
    VALE = (VALE / _fator).astype(np.float32)          # na mesma escala do chao final (a neve le-o)
    print("\nserras: %d cumes (%d picos, %d macicos); altura p50/p90/max %s m; raio p10/p50/max %s m; %.1f%% da terra"
          % (_rel["cumes"], _rel["picos"], _rel["macicos"], "/".join("%.0f" % v for v in _rel["altura_m"]),
             "/".join("%.0f" % v for v in _rel["raio_m"]), _rel["serra_pct"]))
    print("declive (graus), corte antigo -> serras desenhadas")
    print("   cume   onde        p50          p95          max")
    for _nome, _onde in (("tudo", None), ("serra", SERRA > 0.5)):
        for (hm, a50, a95, amx), (_h, b50, b95, bmx) in zip(
                CR.declives(_lisa, TERRA, M_CEL, onde=_onde), CR.declives(alt_b, TERRA, M_CEL, onde=_onde)):
            print("   %4.0f   %-6s  %4.1f -> %4.1f  %4.1f -> %4.1f  %4.1f -> %4.1f"
                  % (hm, _nome, a50, b50, a95, b95, amx, bmx))
    # a prova de que a estrada continua no chao do vale: quanto sobe o chao acima dele, NA estrada
    _na = (d_estr < 1.5) & TERRA
    print("   na estrada, o chao fica %.2f m acima do vale no pior ponto (cume a 300 m)"
          % (float((alt_b - _lisa)[_na].max()) * 300.0))
# ---- 6d. o SUDOESTE (M2, 12/11): o planalto do Grand Canyon e o vale das mesas -----
# O canyon e as mesas sao malhas proprias (`sudoeste.py`, cozidas pelo forno);
# aqui o relevo so lhes faz a cama: o planalto plano a 85 m onde o canyon se
# corta, o vale das mesas a mesma altura, e o talude de cascalho de cada mesa.
# Os cumes da serra que ali estavam (as Rochosas do sul do Utah) sobem para la
# do planalto. `SUDOESTE=0` volta ao relevo de antes (para comparar).
SW_PESO = np.zeros(ALTURA.shape, np.float32)
SW_PEGADA = np.zeros(ALTURA.shape, bool)
if os.environ.get("SUDOESTE", "1") != "0":
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import sudoeste as SW                                    # noqa: E402
    _rs = {}
    alt_b, SW_PESO, SW_PEGADA = SW.no_relevo(alt_b, TERRA, d_estr, relato=_rs)
    SERRA = (SERRA * (1.0 - SW_PESO)).astype(np.float32)
    _cy = SW.canyon(alt_b * SW.H_REF)
    _folga_c = float(d_estr[np.clip(_cy["v"][:, 1].round().astype(int), 0, TH - 1),
                            np.clip(_cy["v"][:, 0].round().astype(int), 0, TW - 1)].min())
    print("\nsudoeste: planalto e vale em %.1f%% da terra; folga as estradas (celulas, a zona protegida "
          "e 16): canyon %.1f, taludes das mesas %.1f" % (_rs["peso_pct"] * TW * TH / TERRA.sum(), _folga_c,
                                                        _rs["folga_mesas_cel"]))
    if min(_folga_c, _rs["folga_mesas_cel"]) < 16.0:
        raise SystemExit("o sudoeste entra na zona protegida de uma estrada")
costa = np.clip(d_mar_c / 9.0, 0.0, 1.0) ** 0.7
alt_b = alt_b * costa
fundo_b = -np.clip(ndi.distance_transform_edt(~TERRA) / 30.0, 0.0, 1.0) * 0.06
alt_b = np.where(TERRA, np.maximum(alt_b, 0.0015), fundo_b)
# a neve e do cume de DESENHO: acima de 62% do cume mais alto no sul, 50% no norte
linha_n = 0.62 - (LAT - 33.0) * 0.008
NEVE = np.where(TERRA, np.clip((alt_b - linha_n) / 0.12, 0.0, 1.0), 0.0).astype(np.float32)
print("neve: %.2f%% da terra" % (float((NEVE > 0.5).sum()) / TERRA.sum() * 100))
np.save(os.path.join(CENA, "_chao.npy"), alt_b.astype(np.float32))
# o que o FORNO le (os mesmos nomes da Iberia): `_altura.npy` e o chao final de
# desenho, 0..1, sem o fundo do mar; `_prado.npy` e a frescura do pasto (1 = humido)
np.save(os.path.join(CENA, "_altura.npy"), np.where(TERRA, np.clip(alt_b, 0.0, 1.0), 0.0).astype(np.float32))
np.save(os.path.join(CENA, "_prado.npy"), np.where(TERRA, 1.0 - SECO, 0.5).astype(np.float32))

# ---- 7. gravar ---------------------------------------------------------------------
np.save(os.path.join(CENA, "_terra.npy"), TERRA)
np.save(os.path.join(CENA, "_alfa.npy"), ALFA.astype(np.float32))
np.save(os.path.join(CENA, "_altura_serras.npy"), ALTURA)
np.save(os.path.join(CENA, "_vale.npy"), VALE)
np.save(os.path.join(CENA, "_seco.npy"), SECO)
np.save(os.path.join(CENA, "_neve.npy"), NEVE)
# (M3) os pesos dos biomas, um por nome (`biomas_usa.NOMES`), em float16 (12 x 0,8 M celulas)
BIOMAS = BI.pesos(CHUVA, LON, LAT, np.where(TERRA, SERRA, 0.0), NEVE, TERRA)
np.savez_compressed(os.path.join(CENA, "_biomas.npz"), **{k: v.astype(np.float16) for k, v in BIOMAS.items()})
np.save(os.path.join(CENA, "_chuva.npy"), CHUVA)
print("biomas: " + ", ".join("%s %.1f%%" % (k, float(v[TERRA].mean()) * 100) for k, v in BIOMAS.items()))
np.save(os.path.join(CENA, "_serra.npy"), np.where(TERRA, SERRA, 0.0).astype(np.float32))   # 1 = serra (o `pintar_chao.py` pinta-a)
np.save(os.path.join(CENA, "_sudoeste_peso.npy"), SW_PESO)        # 1 = o planalto do canyon / o vale das mesas
np.save(os.path.join(CENA, "_sudoeste_pegada.npy"), SW_PEGADA)    # as celulas debaixo das mesas
json.dump({"x0": X0, "y0": Y0, "cel": CEL, "tw": TW, "th": TH,
           "lon": [LON0, LON1], "lat": [LAT0, LAT1], "rios": RIOS},
          open(os.path.join(CENA, "_grelha.json"), "w", encoding="utf-8"))

# ---- 8. a prova: o mapa visto de cima --------------------------------------------
# NAO e o mapa do jogo: e a planta, para se ver se a materia-prima esta certa.
ESC = 2                                    # a imagem tem o dobro da grelha
gy, gx = np.gradient(ALTURA * 60.0)        # exagero so para o sombreado
sol = np.array([-0.55, -0.62, 0.56])       # luz de noroeste
nrm = np.dstack([-gx, -gy, np.ones_like(gx)])
nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
luz = np.clip((nrm @ -sol) * -1.0 if False else (nrm[..., 0] * sol[0] + nrm[..., 1] * sol[1] + nrm[..., 2] * sol[2]), 0.0, 1.0)
luz = 0.35 + 0.95 * luz


def mistura(a, b, t):
    return a + (b - a) * t[..., None]


verde = np.array([0.33, 0.47, 0.22]); mata = np.array([0.20, 0.36, 0.18])
pradaria = np.array([0.66, 0.63, 0.36]); deserto = np.array([0.80, 0.62, 0.42]); rubro = np.array([0.72, 0.42, 0.28])
rocha = np.array([0.50, 0.46, 0.41]); neve = np.array([0.96, 0.97, 0.99])
# (M3) a cor e a dos biomas, pelos pesos
humido = np.zeros(ALTURA.shape + (3,), np.float32)
for _k, _w in BIOMAS.items():
    humido += _w[..., None] * (np.array(BI.COR_PLANTA[_k], np.float32) / 255.0)
cor = humido
decl = np.hypot(gx, gy)
cor = mistura(cor, np.broadcast_to(rocha, humido.shape), np.clip((decl - 0.55) / 0.6, 0, 1) * 0.8)
cor = mistura(cor, np.broadcast_to(neve, humido.shape), NEVE)
cor = cor * luz[..., None]
fundo = np.clip(ndi.distance_transform_edt(~TERRA) / 40.0, 0, 1)
mar = mistura(np.broadcast_to(np.array([0.30, 0.66, 0.70]), humido.shape), np.broadcast_to(np.array([0.10, 0.27, 0.42]), humido.shape), fundo)
img = np.where(TERRA[..., None], cor, mar)
im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((TW * ESC, TH * ESC), Image.LANCZOS)
d = ImageDraw.Draw(im)
P = lambda x, y: ((x - X0) / CEL * ESC, (y - Y0) / CEL * ESC)
for r in RIOS:
    d.line([P(*p) for p in r["pts"]], fill=(70, 130, 190), width=2)
for e in rede["e"]:
    ps = pontos_da_estrada(e, 60)
    d.line([P(*p) for p in ps], fill=(250, 236, 190) if e["_agua"] <= 0.02 else (255, 60, 60), width=3)
try:
    fonte = ImageFont.truetype("arial.ttf", 17)
    fonte_k = ImageFont.truetype("arialbd.ttf", 22)
except OSError:
    fonte = fonte_k = ImageFont.load_default()
for c in rede["c"]:
    x, y = P(c["x"], c["y"])
    r = 9 if c["papel"] == "capital" else 5
    d.ellipse([x - r, y - r, x + r, y + r], fill=(200, 40, 40) if c["papel"] == "capital" else (255, 255, 255), outline=(20, 20, 20), width=2)
    d.text((x + r + 3, y - 10), c["nome"], fill=(15, 15, 15), font=fonte_k if c["papel"] == "capital" else fonte,
           stroke_width=2, stroke_fill=(255, 255, 255))
saida = os.path.join(RAIZ, "pesquisa", "usa-relevo.png")
os.makedirs(os.path.dirname(saida), exist_ok=True)
im.save(saida)
print("\nprova -> %s (%d x %d)" % (saida, im.width, im.height))

# ---- 9. a bancada 3D: o relevo em bruto, para se julgar a ALTURA antes do forno ----
# `sonda3d/usa.html` le isto. NAO e o mapa do jogo (nao tem falesia, praia,
# arvores, aldeias nem estrada pintada): e a pergunta "as serras leem como
# serras, de longe e de perto?" respondida antes de cozer 100 s de cada vez.
# Duas coisas do forno entram ja, porque mudam a resposta:
#   * a estrada e a aldeia sao zona protegida: o chao a volta delas alisa-se;
#   * a costa desce ate ao mar.
M_POR_UN = 98.9 / (3.8 * 1429.0 / 108.0)       # o mesmo numero do exportar_mapa.py
SONDA = os.path.join(RAIZ, "sonda3d")
# o sudoeste na bancada: a MESMA geometria do forno, pousada na grelha da bancada
# (o PlaneGeometry parte cada quadrado pela outra diagonal, e os vertices estao a
# LX/(tw-1)); o chao desce por baixo do canyon como no forno
alt_bancada = alt_b
if os.environ.get("SUDOESTE", "1") != "0":
    _Rb = alt_b * SW.H_REF
    _cy = SW.canyon(_Rb, diagonal="anti")
    _Rb2, _nb = SW.baixar_chao(_Rb, _cy, diagonal="anti")
    print("sudoeste na bancada: %d vertices do chao desceram;" % _nb, SW.provar_costura(_Rb2, _Rb, _cy, "anti"))
    alt_bancada = np.where(_Rb2 < _Rb, _Rb2 / SW.H_REF, alt_b)
    _ms = SW.mesas(templos=_cy["templos"])
    _pes = SW.provar_pes(_Rb2, _ms, "anti")
    print("sudoeste na bancada: pes de mesa a vista: %s" % (_pes or "nenhum"))
    if _pes:
        raise SystemExit("uma mesa assenta no chao que o canyon fez descer")
    _LXb, _LYb = TW * CEL * M_POR_UN, TH * CEL * M_POR_UN

    def _para_bancada(V):
        return np.stack([-_LXb / 2 + V[:, 0] * _LXb / (TW - 1), V[:, 2],
                         -_LYb / 2 + V[:, 1] * _LYb / (TH - 1)], axis=1).round(3).ravel().tolist()
    _out = {"cume": SW.H_REF, "pecas": []}
    for _nome, _g in (("canyon", _cy), ("mesas", _ms)):
        _cor = SW.cor_por_altura(_g["v"][:, 2])
        if _nome == "canyon":
            # a aba leva a cor do chao da bancada por baixo (a do forno vem da pintura)
            _ci = np.clip(_g["v"][:, 0].round().astype(int), 0, TW - 1)
            _cj = np.clip(_g["v"][:, 1].round().astype(int), 0, TH - 1)
            _k = _g["chao"][:, None]
            _cor = _cor * (1 - _k) + np.clip(cor[_cj, _ci] / luz[_cj, _ci, None], 0, 1) * _k
        # sem indices: cada canto leva a sua normal (lisa na parede, viva na beira do degrau)
        _cant = _g["f"].ravel()
        _nrm = SW.normais_por_angulo(_g["v"], _g["f"])
        _nb3 = np.stack([_nrm[:, 0], _nrm[:, 2], -_nrm[:, 1]], axis=1)      # forno (x, y norte, z) -> bancada (x, y cima, z sul)
        _out["pecas"].append({"nome": _nome, "v": _para_bancada(_g["v"][_cant]),
                              "n": _nb3.round(3).ravel().tolist(), "cor": _cor[_cant].round(3).ravel().tolist()})
    _P, _W, _Z = _cy["rio"]
    _out["rio"] = {"v": _para_bancada(np.concatenate([_P, _Z[:, None]], axis=1)), "w": _W.round(2).tolist()}
    json.dump(_out, open(os.path.join(SONDA, "usa_sudoeste.json"), "w", encoding="utf-8"))
    print("bancada -> sonda3d/usa_sudoeste.json (%d + %d triangulos)" % (len(_cy["f"]), len(_ms["f"])))
u16 = np.clip((alt_bancada + 0.1) / 1.1 * 65535.0, 0, 65535).astype("<u2")
u16.tofile(os.path.join(SONDA, "usa_relevo.bin"))
# a cor SEM a luz (a luz e do navegador), com o mar ja pintado
tex = np.where(TERRA[..., None], np.where(TERRA[..., None], cor / luz[..., None], 0), mar)
praia = np.clip(1.0 - d_mar_c / 2.5, 0.0, 1.0)[..., None] * TERRA[..., None]
tex = tex * (1 - praia) + np.array([0.86, 0.79, 0.60]) * praia
im_t = Image.fromarray((np.clip(tex, 0, 1) * 255).astype(np.uint8)).resize((TW * 2, TH * 2), Image.BICUBIC)
im_t.save(os.path.join(SONDA, "usa_cor.jpg"), quality=92)
json.dump({
    "tw": TW, "th": TH, "cel_m": CEL * M_POR_UN, "m_por_un": M_POR_UN, "x0": X0, "y0": Y0, "cel": CEL,
    "cidades": [{"id": c["id"], "nome": c["nome"], "x": c["x"], "y": c["y"], "capital": c["papel"] == "capital",
                 "rei": c.get("dono")} for c in rede["c"]],
    "estradas": [[[round(x, 1), round(y, 1)] for x, y in pontos_da_estrada(e, 60)] for e in rede["e"]],
    "rios": [r["pts"] for r in RIOS],
}, open(os.path.join(SONDA, "usa_relevo.json"), "w", encoding="utf-8"))
print("bancada -> sonda3d/usa_relevo.bin, usa_cor.jpg, usa_relevo.json (%.0f x %.0f m)" % (TW * CEL * M_POR_UN, TH * CEL * M_POR_UN))
