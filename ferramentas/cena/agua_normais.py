# agua_normais.py — as ondas do mar, como mapas de normais sem costura.
#
#   python ferramentas/cena/agua_normais.py
#
# O `exportar_mapa.py` chama-o no fim, com o `mar_costa.py`. Corre sozinho em
# segundos e nao depende do mapa.
#
# ── O QUE SAI ────────────────────────────────────────────────────────────────
#   sonda3d/agua_normal_a.png   ondulacao larga (ladrilho de ~170 m no jogo)
#   sonda3d/agua_normal_b.png   o picado do vento (ladrilho de ~47 m)
# RGB = inclinacao da superficie: R = dh/dx, G = dh/dz, 0,5 = plano, e B = 1
# (um mapa de normais comum, com o "cima" no azul). A escala esta em
# `agua_normais.json` (inclinacao maxima gravada).
#
# ── PORQUE ASSIM (plano da agua, passo C, 28/09) ─────────────────────────────
# Ate 27/09 as ondas eram tres senos: ao longe faziam um padrao periodico
# (moire) e reflexos em faixas (foto 92102). Aqui a superficie sai de um
# ESPECTRO DE OCEANO (Phillips, o metodo de Tessendorf): milhares de ondas de
# todos os tamanhos e rumos, com a energia que o vento lhes daria, somadas por
# FFT. Uma FFT e periodica por construcao: o ladrilho cose sem costura. No jogo
# as duas camadas deslizam em rumos diferentes e com ladrilhos de tamanhos
# primos entre si, para a grelha nunca se ler.
import json
import os

import numpy as np
from PIL import Image

SAIDA = os.path.join(os.getcwd(), "sonda3d")
N = 512
G = 9.81


def camada(L, vento, rumo_graus, semente, corte_curtas):
    """Declives (dh/dx, dh/dz) de um mar de ladrilho L metros, com vento de
    `vento` m/s a soprar para `rumo_graus`. `corte_curtas` (m) apaga as ondas
    mais curtas do que isso (sao as que tremem a distancia)."""
    rng = np.random.default_rng(semente)
    k1 = 2 * np.pi * np.fft.fftfreq(N, d=L / N)
    kx, kz = np.meshgrid(k1, k1)
    k = np.hypot(kx, kz)
    k[0, 0] = 1.0
    w = np.array([np.cos(np.radians(rumo_graus)), np.sin(np.radians(rumo_graus))])
    Lw = vento * vento / G                           # a maior onda que o vento faz
    cos = (kx * w[0] + kz * w[1]) / k
    P = np.exp(-1.0 / (k * Lw) ** 2) / k ** 4 * cos ** 2
    P *= np.exp(-(k * corte_curtas / (2 * np.pi)) ** 2)   # curtas, apagadas
    P[cos < 0] *= 0.07                               # contra o vento, quase nada
    P[0, 0] = 0.0
    xi = rng.normal(size=(N, N)) + 1j * rng.normal(size=(N, N))
    H = xi * np.sqrt(P / 2)
    sx = np.real(np.fft.ifft2(1j * kx * H))
    sz = np.real(np.fft.ifft2(1j * kz * H))
    return sx, sz


def gravar(nome, sx, sz):
    # a escala sai do percentil, nao do maximo: um pico raro nao achata o resto
    m = float(np.percentile(np.abs(np.concatenate([sx.ravel(), sz.ravel()])), 99.7))
    r = np.clip(0.5 + 0.5 * sx / m, 0, 1)
    g = np.clip(0.5 + 0.5 * sz / m, 0, 1)
    rgb = np.stack([r, g, np.ones_like(r)], -1)
    Image.fromarray(np.round(rgb * 255).astype(np.uint8), "RGB").save(
        os.path.join(SAIDA, nome), optimize=True)
    return m, float(np.sqrt(np.mean(sx ** 2 + sz ** 2)))


# os tamanhos dos ladrilhos no JOGO (m) vao no json: o shader le-os de la
CAMADAS = {
    "a": {"L": 170.0, "vento": 9.0, "rumo": 35.0, "semente": 11, "corte": 6.0},
    "b": {"L": 47.0, "vento": 5.0, "rumo": 110.0, "semente": 23, "corte": 1.2},
}
meta = {}
for nome, c in CAMADAS.items():
    sx, sz = camada(c["L"], c["vento"], c["rumo"], c["semente"], c["corte"])
    m, rms = gravar("agua_normal_%s.png" % nome, sx, sz)
    meta[nome] = {"ladrilho_m": c["L"], "rumo": c["rumo"], "declive_max": round(m, 5),
                  "declive_rms": round(rms, 5)}
    print("SONDA agua_normais %s: ladrilho %.0f m, declive rms %.3f (max gravado %.3f)"
          % (nome, c["L"], rms, m))
with open(os.path.join(SAIDA, "agua_normais.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f)
