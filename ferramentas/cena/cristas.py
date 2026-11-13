# cristas.py -- as serras do mapa dos EUA, desenhadas sobre a massa real (fase M2, 11-12/11/2026).
#
#   python ferramentas/cena/cristas.py      -> pesquisa/2026-11-11/cristas_prova.png
#                                              (antes | depois, Rochosas e Apalaches)
#
# Usado pelo `preparar_usa.py`; corre sozinho para PROVA, em segundos, sobre as
# grelhas que o preparador ja deixou em ferramentas/cena/usa/.
#
# ── PORQUE ──────────────────────────────────────────────────────────────────
# O relevo real dos EUA entra borrado (5,5 celulas): sem o borrao as Rochosas
# eram uma floresta de agulhas (declive p95 de 76 graus). Mas o borrao da a
# cada serra o perfil de um sino, e depois o preparador CORTAVA a serra pela
# distancia as estradas (o chao sobe do vale ate a serra em 110 m). No Oeste a
# rede deixa as serras so no meio de cada malha: o que se via no mapa cozido
# era a rampa do corte -- tendas lisas de tres e quatro lados. E a 2.a e a 3.a
# tentativas da Iberia outra vez (MONTANHAS.md): "a distancia a quatro
# estradas a volta de uma celula E uma piramide".
#
# ── O QUE SE TENTOU PRIMEIRO, E FALHOU (fica registado porque ensina) ───────
#   1. esculpir a massa real (perfil concavo, aresta, barrancos) e cortar
#      depois: o corte alisava tudo outra vez (rugosidade a 4 celulas: 5,7 m
#      antes do corte, 3,8 m depois);
#   2. barrancos por ruido esticado no rumo da encosta, em 8 rumos misturados:
#      mole (a mistura faz a media de dois desenhos) e com estrelas nos colos;
#   3. barrancos por escorrencia (cada celula passa a agua aos vizinhos de
#      baixo): as encostas tem 10-25 celulas e a agua que la se junta e pouca;
#      ou nao se via nada em 3D ou a serra descia por igual;
#   4. a mesma agua a levar a posicao de origem na crista: a origem corria
#      pela crista ate ao cume e cada encosta herdava UM ponto so.
#   Tudo isto era visivel na prova de cima e INVISIVEL na bancada em barro a
#   500 m. A prova que conta e a de barro, com o sol de lado.
#
# ── O QUE SE FAZ (a 4.a tentativa da Iberia, a que funcionou) ───────────────
# A massa real decide ONDE ha serra e QUE ALTURA tem. A forma e desenhada:
#   * a LOMBA: a massa real, baixa (um terco), a subir devagar a partir das
#     estradas -- o sope, e o que liga os cumes uns aos outros;
#   * os CUMES: em cada sitio alto da massa que tenha espaco livre nasce uma
#     montanha INTEIRA (as formas do `montanhas.py`: pico com esporoes, macico
#     redondo), com o raio que o espaco aguenta e a altura que a massa real
#     ali tem, limitada pelo raio (uma montanha de 300 m nao cabe em 100 m de
#     chao: saia uma agulha). O seguinte nasce ao lado, a sobrepor-se: uma
#     serra comprida fica um MOLHO de cumes com colos entre eles.
#   As estradas nao cortam nada: cada montanha acaba antes de chegar a elas.
import math
import os
import sys

import numpy as np
from scipy import ndimage as ndi

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import montanhas as MT                                         # noqa: E402

# os botoes (por variavel de ambiente, para se iterar na bancada)
LOMBA = float(os.environ.get("CR_LOMBA", "0.42"))        # a lomba: fracao da massa real que fica como sope
MARGEM = float(os.environ.get("CR_MARGEM", "9"))         # celulas livres entre o pe da montanha e a estrada
RAIO_MIN = float(os.environ.get("CR_RAIO_MIN", "11"))    # abaixo disto nao nasce cume (seria um espigao)
RAIO_MAX = float(os.environ.get("CR_RAIO_MAX", "78"))    # celulas (~380 m)
DECLIVE = float(os.environ.get("CR_DECLIVE", "40"))      # graus: declive MEDIO maximo do cume ao pe, com o cume a 300 m
PASSO = float(os.environ.get("CR_PASSO", "0.55"))        # o cume seguinte nasce a esta fracao do raio do anterior
GANHO = float(os.environ.get("CR_GANHO", "1.25"))        # o borrao tirou altura aos cumes: devolve-se
CORPO = float(os.environ.get("CR_CORPO", "0.72"))        # < 1 engorda a encosta (menos agulha)
M_CEL = 4.914                                            # metros por celula
H_REF = 300.0                                            # a altura do cume para a qual se mede o declive


def _suave(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def esculpir(altura, vale, terra, d_estrada, d_mar, semente=7, relato=None, caracter=None):
    """altura, vale: 0..1 na grelha (o relevo real borrado e o chao do vale).
    d_estrada, d_mar: celulas ate a estrada/aldeia mais proxima e ate a agua.
    `caracter` (0..1 por celula, ou None = 1): quao ALPINA e a serra. Os
    Apalaches sao velhos e gastos -- macicos redondos em vez de picos.
    Devolve (o chao com serras, a mascara de serra 0..1). O cume mais alto NAO
    e renormalizado aqui."""
    th, tw = altura.shape
    car = np.ones((th, tw), np.float32) if caracter is None else caracter
    S = np.maximum(altura - vale, 0.0).astype(np.float32)
    ref = float(S[terra].max())
    Sg = ndi.gaussian_filter(S, 2.5)
    serra_real = _suave(0.07 * ref, 0.22 * ref, ndi.gaussian_filter(S, 6.0))   # 1 = ha serra a serio aqui

    # 1. a LOMBA. Nas planicies (onde nao ha serra) o relevo fica como era: o
    #    mesmo corte suave de sempre. Onde ha serra, so um terco dela, a subir
    #    devagar (45 celulas) a partir da estrada: e sope, nao e parede.
    perto = np.clip((d_estrada - 16.0) / 22.0, 0.0, 1.0)
    perto = perto * perto * (3 - 2 * perto)                    # o corte de sempre (planicies)
    longe = np.clip((d_estrada - 8.0) / 45.0, 0.0, 1.0)
    longe = longe * longe * (3 - 2 * longe)
    lomba = S * perto * (1.0 - serra_real) + LOMBA * S * longe * serra_real

    # 2. os CUMES
    livre = np.minimum(d_estrada - MARGEM, d_mar - 5.0).astype(np.float32)     # o raio que cabe em cada sitio
    # a pontuacao: massa alta E espaco. So a massa punha o cume colado a
    # estrada (raio minimo: espigao); so o espaco ignorava a serra real.
    pont = Sg * _suave(RAIO_MIN, RAIO_MIN + 26.0, livre) * serra_real
    pont = np.where(terra & (livre >= RAIO_MIN), pont, -1.0).astype(np.float32)
    k_declive = math.tan(math.radians(DECLIVE)) * M_CEL / H_REF   # altura (0..1) por celula de raio
    cumes = np.zeros((th, tw), np.float32)
    lista = []
    rng = np.random.default_rng(semente)
    while len(lista) < 2500:
        idx = int(np.argmax(pont))
        j, i = divmod(idx, tw)
        if pont[j, i] < 0.02 * ref:
            break
        L = float(livre[j, i])
        r = float(min(max(L, RAIO_MIN), RAIO_MAX))
        c = float(car[j, i])
        # a altura: a da massa real ali (acima da lomba), ate onde o raio deixa
        alvo = max(float(Sg[j, i]) * GANHO - float(lomba[j, i]), 0.0)
        h = min(alvo, r * k_declive)
        # o estilo: pico onde a serra e alpina e ha altura para ele; macico
        # redondo nos Apalaches e nos cumes baixos
        estilo = "pico" if (c > 0.7 and h > 0.30 * ref) else "serra"
        R = int(math.ceil(r * 1.05)) + 2
        j0, j1, i0, i1 = max(j - R, 0), min(j + R + 1, th), max(i - R, 0), min(i + R + 1, tw)
        dj, di = np.mgrid[j0:j1, i0:i1].astype(np.float32)
        dy, dx = dj - j, di - i
        if estilo == "serra":
            # o macico e alongado (1,6 : 1): roda-se ao acaso e encolhe-se para caber no raio livre
            a = float(rng.uniform(0, math.pi))
            rx = dx * math.cos(a) + dy * math.sin(a)
            ry = -dx * math.sin(a) + dy * math.cos(a)
            f = MT.forma("serra", rx, ry, r / 1.6, semente=int(rng.integers(1, 10 ** 6)))
        else:
            f = MT.forma("pico", dx, dy, r, semente=int(rng.integers(1, 10 ** 6)))
        # a torcao da forma pode empurrar a beira ate 1/4 do raio para fora: apaga-se a beira
        f = np.maximum(f, 0.0) * _suave(1.0, 0.82, np.hypot(dy, dx) / r)
        fm = float(f.max())
        if fm > 1e-6 and h > 0.02 * ref:
            # o bico do `pico` (a potencia 5 do alto) saia uma AGULHA a esta escala (1.a
            # volta em barro): a raiz engorda a encosta e deixa o cume no sitio
            cumes[j0:j1, i0:i1] = np.maximum(cumes[j0:j1, i0:i1], np.power(f / fm, CORPO) * h)
            lista.append((j, i, r, h, estilo))
        # o proximo nasce ao lado, a sobrepor-se: a serra e um molho de cumes
        apaga = np.hypot(dy, dx) < r * PASSO
        pont[j0:j1, i0:i1] = np.where(apaga, -1.0, pont[j0:j1, i0:i1])

    # 3. juntar. Os cumes assentam NA lomba (somam-se); a garantia de que nada
    #    chega a estrada e o raio livre de cada um, nao um corte por cima.
    fim = lomba + cumes
    fim = ndi.gaussian_filter(fim, 0.7)        # a costura com a celula: nenhuma aresta com a forma do triangulo
    m = np.clip(ndi.gaussian_filter((cumes > 0.02 * ref).astype(np.float32), 2.0) * 1.3, 0.0, 1.0)
    if relato is not None:
        hs = np.array([q[3] for q in lista]) / max(float(fim[terra].max()), 1e-6) * H_REF
        rs = np.array([q[2] for q in lista]) * M_CEL
        relato.update({
            "cumes": len(lista), "picos": sum(1 for q in lista if q[4] == "pico"),
            "macicos": sum(1 for q in lista if q[4] == "serra"),
            "altura_m": [float(np.percentile(hs, p)) for p in (50, 90, 100)] if len(hs) else [],
            "raio_m": [float(np.percentile(rs, p)) for p in (10, 50, 100)] if len(rs) else [],
            "serra_pct": 100.0 * float((m[terra] > 0.5).mean()),
            "lista": lista})
    return (vale + fim).astype(np.float32), m


def declives(alt01, terra, m_cel, cumes=(220.0, 300.0), onde=None):
    """[(cume, p50, p95, max)] em graus"""
    out = []
    sel = terra if onde is None else (terra & onde)
    for hm in cumes:
        gy, gx = np.gradient(alt01 * hm, m_cel)
        dg = np.degrees(np.arctan(np.hypot(gx, gy)))[sel]
        out.append((hm, float(np.percentile(dg, 50)), float(np.percentile(dg, 95)), float(dg.max())))
    return out


if __name__ == "__main__":
    from PIL import Image
    RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    U = os.path.join(RAIZ, "ferramentas", "cena", "usa")
    A = np.load(os.path.join(U, "_altura_cortada.npy"))        # como era: a massa cortada pelas estradas
    B = np.load(os.path.join(U, "_altura.npy"))                # como fica (o preparador ja correu)
    Tm = np.load(os.path.join(U, "_terra.npy"))
    m = np.load(os.path.join(U, "_serra.npy")) > 0.5
    A = A / A[Tm].max()
    for nome, c in (("antes", A), ("depois", B)):
        for hm, p50, p95, mx in declives(c, Tm, M_CEL):
            print("%-7s cume %3.0f  p50 %5.1f  p95 %5.1f  max %5.1f" % (nome, hm, p50, p95, mx))
        for hm, p50, p95, mx in declives(c, Tm, M_CEL, onde=m):
            print("%-7s cume %3.0f  SO SERRA  p50 %5.1f  p95 %5.1f  max %5.1f" % (nome, hm, p50, p95, mx))
    # dois recortes: as Rochosas (Denver fica a direita) e os Apalaches
    recortes = [(170, 350, 250, 450), (230, 370, 860, 1040)]
    sol = np.array([-0.55, 0.45, 0.70])
    sol /= np.linalg.norm(sol)
    telas = []
    for (j0, j1, i0, i1) in recortes:
        linha = []
        for c in (A, B):
            gy, gx = np.gradient(c[j0:j1, i0:i1] * 300.0, M_CEL)
            n = np.dstack([-gx, -gy, np.ones_like(gx)])
            n /= np.linalg.norm(n, axis=2, keepdims=True)
            s = 0.5 + 0.5 * (n @ sol)                       # meia-luz: nada satura
            dec = np.degrees(np.arctan(np.hypot(gx, gy)))
            cor = np.dstack([s, s, s]) * np.where(dec[..., None] > 40, [1.0, 0.86, 0.70], [0.86, 1.0, 0.80])
            linha.append((np.clip(cor, 0, 1) * 255).astype(np.uint8))
        telas.append(np.concatenate(linha, axis=1))
    w = max(t_.shape[1] for t_ in telas)
    telas = [np.pad(t_, ((0, 0), (0, w - t_.shape[1]), (0, 0))) for t_ in telas]
    img = np.concatenate(telas, axis=0)
    img = np.repeat(np.repeat(img, 3, 0), 3, 1)
    saida = os.path.join(RAIZ, "pesquisa", "2026-11-11", "cristas_prova.png")
    Image.fromarray(img).save(saida)
    print("->", saida, "(castanho = mais de 40 graus)")
