# relevo.py — o terreno da cena, e a pergunta "que altura tens aqui?"
#
# Não se corre sozinho: é importado pelo `aldeias.py`.
#
# ── O ERRO QUE ISTO CORRIGE ───────────────────────────────────────────────────
# A primeira cena usava o modificador Displace do Blender com uma textura de
# nuvens. Ficou bonita e completamente errada: o chão ondulava até 14 m e as
# casas, a estrada, os campos e duas mil árvores estavam todos a z = 0. Metade
# flutuava no ar, metade estava enterrada.
#
# A causa é estrutural, não um esquecimento: uma textura procedural do Blender
# vive DENTRO do Blender, e o Python que coloca as casas não tem como lhe
# perguntar quanto vale num ponto. Então o terreno passa a ser gerado AQUI, em
# numpy, e a malha é construída a partir do mesmo vetor de alturas que responde
# ao `altura(x, y)`. Uma fonte de verdade, como no motor do jogo.
#
# ── E O QUE ISSO DESTRANCA ────────────────────────────────────────────────────
# Tendo a altura em mãos, dá para fazer o que qualquer jogo de estratégia faz e
# que se nota sem se saber porquê: APLANAR. Uma aldeia assenta num patamar; uma
# estrada corta a encosta em vez de a subir e descer. Sem isso, uma paliçada
# construída numa encosta fica com metade das estacas no ar.
import math

import numpy as np


class Terreno:
    def __init__(self, larg, comp, celula=2.0, semente=1, amplitude=13.0):
        self.larg, self.comp = larg, comp
        self.nx = int(larg / celula) + 1
        self.ny = int(comp / celula) + 1
        self.x0, self.y0 = -larg / 2, -comp / 2
        self.dx = larg / (self.nx - 1)
        self.dy = comp / (self.ny - 1)
        self.rng = np.random.default_rng(semente)
        self.H = self._base() * amplitude
        self.X = self.x0 + np.arange(self.nx) * self.dx
        self.Y = self.y0 + np.arange(self.ny) * self.dy
        self.GX, self.GY = np.meshgrid(self.X, self.Y)

    # ---- geração ------------------------------------------------------------
    def _esticar(self, g, ny, nx):
        """amplia uma grelha grossa com interpolação suave (sem PIL: o Python do
        Blender não a traz garantidamente)"""
        h, w = g.shape
        yi = np.linspace(0, h - 1, ny)
        xi = np.linspace(0, w - 1, nx)
        y0 = np.floor(yi).astype(int)
        x0 = np.floor(xi).astype(int)
        y1 = np.minimum(y0 + 1, h - 1)
        x1 = np.minimum(x0 + 1, w - 1)
        fy = (yi - y0)[:, None]
        fx = (xi - x0)[None, :]
        fy = fy * fy * (3 - 2 * fy)                  # suaviza as juntas
        fx = fx * fx * (3 - 2 * fx)
        a, b = g[np.ix_(y0, x0)], g[np.ix_(y0, x1)]
        c, d = g[np.ix_(y1, x0)], g[np.ix_(y1, x1)]
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

    def _base(self):
        saida = np.zeros((self.ny, self.nx), dtype=np.float32)
        peso = 0.0
        for k, celulas in enumerate((3, 6, 12, 26, 52)):
            g = self.rng.random((celulas, celulas + 2)).astype(np.float32)
            saida += self._esticar(g, self.ny, self.nx) * (0.55 ** k)
            peso += 0.55 ** k
        h = saida / peso
        return (h - h.mean()) * 2.0

    # ---- a pergunta ---------------------------------------------------------
    def altura(self, x, y):
        """altura do terreno num ponto qualquer, por interpolação bilinear"""
        u = np.clip((x - self.x0) / self.dx, 0, self.nx - 1.001)
        v = np.clip((y - self.y0) / self.dy, 0, self.ny - 1.001)
        i, j = int(u), int(v)
        fu, fv = u - i, v - j
        H = self.H
        return float((H[j, i] * (1 - fu) + H[j, i + 1] * fu) * (1 - fv)
                     + (H[j + 1, i] * (1 - fu) + H[j + 1, i + 1] * fu) * fv)

    # ---- aplanar ------------------------------------------------------------
    def patamar(self, cx, cy, raio, borda=14.0):
        """aplana um disco: é onde a aldeia vai assentar.

        Sem isto uma paliçada numa encosta fica com metade das estacas no ar e a
        outra metade enterrada. Todo o jogo de estratégia aplana o chão debaixo
        de uma construção, e nota-se sem se saber porquê.
        """
        d = np.hypot(self.GX - cx, self.GY - cy)
        dentro = d < raio + borda
        if not dentro.any():
            return
        alvo = float(self.H[d < raio].mean()) if (d < raio).any() else self.altura(cx, cy)
        w = np.clip((raio + borda - d) / borda, 0, 1)
        w = w * w * (3 - 2 * w)
        self.H = self.H * (1 - w) + alvo * w
        return alvo

    def fosso(self, cx, cy, raio, largura=8.0, fundo=2.6):
        """cava um anel à volta da muralha.

        O fosso faz duas coisas ao mesmo tempo: diz que aquilo é defendido, e
        obriga a estrada a entrar por UM sítio só. Sem ele uma muralha lê-se como
        uma cerca alta — o que a distingue de uma cerca é o que está por baixo.
        """
        d = np.hypot(self.GX - cx, self.GY - cy)
        w = np.clip(1.0 - np.abs(d - raio) / (largura / 2), 0, 1)
        w = w * w * (3 - 2 * w)
        self.H = self.H - w * fundo
        return w

    def corredor(self, pts, largura=9.0, borda=16.0, alisar=7):
        """abre caminho: o terreno cede ao longo da polilinha, seguindo um perfil
        já alisado. É a diferença entre uma estrada que corta a encosta e uma
        que anda aos solavancos por cima dela."""
        px = np.array([p[0] for p in pts], dtype=np.float32)
        py = np.array([p[1] for p in pts], dtype=np.float32)
        pz = np.array([self.altura(x, y) for x, y in pts], dtype=np.float32)
        for _ in range(alisar):                       # média móvel: o perfil da via
            pz[1:-1] = (pz[:-2] + 2 * pz[1:-1] + pz[2:]) / 4.0
        d2 = np.full(self.H.shape, 1e9, dtype=np.float32)
        zz = np.zeros_like(self.H)
        for i in range(len(pts) - 1):
            ax, ay, az = px[i], py[i], pz[i]
            bx, by, bz = px[i + 1], py[i + 1], pz[i + 1]
            vx, vy = bx - ax, by - ay
            L2 = max(vx * vx + vy * vy, 1e-6)
            t = np.clip(((self.GX - ax) * vx + (self.GY - ay) * vy) / L2, 0.0, 1.0)
            dd = np.hypot(self.GX - (ax + t * vx), self.GY - (ay + t * vy))
            melhor = dd < d2
            d2 = np.where(melhor, dd, d2)
            zz = np.where(melhor, az + (bz - az) * t, zz)
        w = np.clip((largura + borda - d2) / borda, 0, 1)
        w = w * w * (3 - 2 * w)
        self.H = self.H * (1 - w) + zz * w
        return [(x, y, float(z)) for x, y, z in zip(px, py, pz)]

    # ---- a malha ------------------------------------------------------------
    def malha(self):
        """os vértices e as faces, em numpy e já achatados.

        MEDIDO, e o número não é o que eu esperava. Para 205 920 vértices:
            listas com dois `for` em Python .... 0,20 s   +  from_pydata 0,24 s
            arrays em numpy .................... 0,01 s   +  foreach_set 0,10 s
        Quatro vezes mais rápido, mas em segundos absolutos é quase nada — eu
        tinha escrito aqui que a versão antiga custava dez segundos e ESTAVA
        ERRADO, era palpite. O gargalo desta cena está noutro sítio (ver o
        cabeçalho do uma_aldeia.py). Fica a via a granel porque é a certa e
        porque escala, não porque tenha salvo a tarde.
        """
        co = np.empty((self.ny * self.nx, 3), dtype=np.float32)
        co[:, 0] = self.GX.ravel()
        co[:, 1] = self.GY.ravel()
        co[:, 2] = self.H.ravel()
        j, i = np.meshgrid(np.arange(self.ny - 1), np.arange(self.nx - 1), indexing="ij")
        k = (j * self.nx + i).ravel()
        quads = np.stack([k, k + 1, k + self.nx + 1, k + self.nx], axis=1)
        return co, quads.astype(np.int32)

    def declive(self, x, y, passo=3.0):
        """quanto o chão inclina num ponto — para não plantar árvores na falésia"""
        a = self.altura(x + passo, y) - self.altura(x - passo, y)
        b = self.altura(x, y + passo) - self.altura(x, y - passo)
        return math.hypot(a, b) / (2 * passo)
