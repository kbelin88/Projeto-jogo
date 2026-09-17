# montanhas.py - esculpe montanhas num campo de alturas. So numpy.
#
#   python ferramentas/cena/montanhas.py        -> _saida/montanhas_prova.png
#
# Usado pelo `exportar_mapa.py` (MONTANHAS=1) e corre sozinho para PROVA: um
# relevo sombreado dos estilos, lado a lado, em segundos -- sem esperar o forno.
#
# ── PORQUE NAO SENOS ────────────────────────────────────────────────────────
# A primeira versao fazia as arestas com somas de senos. Saiu um cone liso com
# riscas regulares e uma cordilheira de salsichas: o seno repete, e uma montanha
# que repete le-se como maquina. Aqui o ruido e de VALOR (uma grelha de numeros
# ao acaso, interpolada), em oitavas, com a posicao TORCIDA por outro ruido --
# e isso que dobra as cristas e faz esporoes em vez de raios.
import math

import numpy as np


def ruido_valor(x, y, escala, semente):
    """ruido de valor suave em [0, 1]; x, y em metros (arrays que se difundem)"""
    rng = np.random.default_rng(semente)
    N = 257
    tab = rng.random((N, N)).astype(np.float32)
    fx = np.asarray(x, dtype=np.float32) / escala + 1000.3
    fy = np.asarray(y, dtype=np.float32) / escala + 1000.7
    fx, fy = np.broadcast_arrays(fx, fy)
    ix, iy = np.floor(fx).astype(np.int64), np.floor(fy).astype(np.int64)
    tx, ty = fx - ix, fy - iy
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)
    a = tab[iy % N, ix % N]
    b = tab[iy % N, (ix + 1) % N]
    c = tab[(iy + 1) % N, ix % N]
    d = tab[(iy + 1) % N, (ix + 1) % N]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(x, y, escala, semente, oitavas=5, ganho=0.5):
    tot, amp, soma = 0.0, 1.0, 0.0
    for k in range(oitavas):
        soma = soma + amp * ruido_valor(x, y, escala / (2.0 ** k), semente + 17 * k)
        tot += amp
        amp *= ganho
    return soma / tot


def cristas(x, y, escala, semente, oitavas=5):
    """ruido de cristas: cada oitava pesa mais onde a anterior ja era crista"""
    soma, peso, tot, amp = 0.0, 1.0, 0.0, 1.0
    for k in range(oitavas):
        n = ruido_valor(x, y, escala / (2.0 ** k), semente + 31 * k)
        r = 1.0 - np.abs(2.0 * n - 1.0)
        r = r * r
        soma = soma + r * amp * peso
        peso = np.clip(r * 1.6, 0.0, 1.0)
        tot += amp
        amp *= 0.5
    return soma / tot


def _suave(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def forma(estilo, dx, dy, raio, semente=1):
    """altura (m) de uma montanha centrada em (0, 0); dx, dy em metros.

    Perfil CONCAVO -- (1 - r)^2 -- como as montanhas a serio: ingreme no alto,
    o pe a espraiar-se em rampa. O perfil convexo (cupula) da uma colina.
    """
    # a posicao TORCIDA: e isto que tira o ar de compasso ao contorno e as cristas
    # ⚠ a torcao nao pode passar de ~1/4 do raio: com 0,7 a posicao dobrava sobre
    # si propria e o terreno fazia PAREDOES -- o pico saiu uma cunha (medido na
    # prova em perspetiva de 17/09)
    wx = (fbm(dx, dy, raio * 0.6, semente + 101, 3) - 0.5) * raio * 0.28
    wy = (fbm(dx, dy, raio * 0.6, semente + 202, 3) - 0.5) * raio * 0.28
    qx, qy = dx + wx, dy + wy
    if estilo == "pico":
        r = np.clip(np.hypot(qx, qy) / raio, 0.0, 1.0)
        base = (1.0 - r) ** 2
        # esporoes: as cristas decidem por onde a massa desce -- sao elas que
        # fazem a montanha, e nao o cone
        cr = cristas(qx, qy, raio * 0.38, semente, 4)
        cume = (1.0 - r) ** 5                     # o bico do alto
        return 240.0 * (base * (0.30 + 0.85 * cr) + 0.45 * cume) / 1.25
    if estilo == "serra":
        r = np.clip(np.hypot(qx / 1.6, qy) / raio, 0.0, 1.0)
        base = (1.0 - r) ** 1.5
        cr = cristas(qx, qy, raio * 0.45, semente + 5, 4)
        f = fbm(qx, qy, raio * 0.3, semente + 9, 3)
        return 165.0 * base * (0.35 + 0.55 * cr + 0.25 * f)
    if estilo == "cordilheira":
        ang = 0.6
        ux, uy = math.cos(ang), math.sin(ang)
        ao_longo = qx * ux + qy * uy
        travessa = -qx * uy + qy * ux
        comp = raio * 1.6
        larg = raio * 0.8
        ta = np.clip(np.abs(ao_longo) / comp, 0.0, 1.0)
        tt = np.clip(np.abs(travessa) / larg, 0.0, 1.0)
        env = (1.0 - tt) ** 2.2 * (1.0 - ta * ta)
        cr = cristas(qx, qy, raio * 0.36, semente + 13, 4)
        # os cumes: um ruido lento ao longo do eixo decide onde sobe e onde e colo
        cumes = ruido_valor(ao_longo, 0 * ao_longo + 50.0, raio * 0.3, semente + 21)
        return 230.0 * env * (0.25 + 0.65 * cr) * (0.55 + 0.6 * cumes)
    raise ValueError(estilo)


ESTILOS = [("pico", 330.0), ("serra", 300.0), ("cordilheira", 300.0)]


def hillshade(h, passo, az=315, alt=40):
    gy, gx = np.gradient(h, passo)
    sl = np.pi / 2 - np.arctan(np.hypot(gx, gy))
    asp = np.arctan2(-gx, gy)
    a, e = np.radians(az), np.radians(alt)
    return np.clip(np.sin(e) * np.sin(sl) + np.cos(e) * np.cos(sl) * np.cos(a - asp), 0, 1)


if __name__ == "__main__":
    import os
    from PIL import Image
    passo = 5.0
    L = 1500
    xs = np.arange(-L / 2, L / 2, passo)
    X, Y = np.meshgrid(xs, -xs)
    telas = []
    for i, (nome, raio) in enumerate(ESTILOS):
        h = forma(nome, X, Y, raio, semente=3 + i)
        declive = np.degrees(np.arctan(np.hypot(*np.gradient(h, passo))))
        print("%-12s max %5.0f m  declive p50 %4.1f p95 %4.1f  rocha(>34) %4.1f%%"
              % (nome, h.max(), np.percentile(declive[h > 5], 50),
                 np.percentile(declive[h > 5], 95), 100 * (declive[h > 5] > 34).mean()))
        s = hillshade(h, passo)
        cor = np.stack([s * 0.55 + 0.25 * (h / 250), s * 0.62 + 0.1, s * 0.45], -1)
        rocha = declive > 34
        cor[rocha] = np.stack([s, s * 0.95, s * 0.9], -1)[rocha] * 0.9
        telas.append((np.clip(cor, 0, 1) * 255).astype(np.uint8))
    img = np.concatenate(telas, axis=1)
    img = np.repeat(np.repeat(img, 2, 0), 2, 1)
    saida = os.path.join("ferramentas", "cena", "_saida", "montanhas_prova.png")
    Image.fromarray(img).save(saida)
    print("->", saida)
