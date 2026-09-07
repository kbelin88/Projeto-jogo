#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
servir.py — servidor local do Arena dos Reis.

POR QUE ISTO EXISTE
Abrir o index.html com dois cliques usa o esquema file://, que o navegador
trata como "origem nenhuma" e vigia de perto: um arquivo local podendo ler
outros arquivos locais seria um buraco de seguranca. O preco e que varias
coisas simplesmente nao funcionam:

  - fetch/XHR de arquivo local: BLOQUEADO (por isso os ajustes tiveram de
    virar um .js que declara global, em vez de um .json);
  - canvas: desenhar uma imagem local "tinge" (taints) o canvas e qualquer
    getImageData estoura (por isso o mar foi amostrado offline);
  - baixar um .js: o Chrome avisa que "pode danificar o dispositivo";
  - localStorage: as vezes limitado.

Servindo a MESMA pasta por http://localhost o navegador passa a tratar o jogo
como um site normal e nada disso se aplica. De quebra, este servidor aceita
um POST para gravar os ajustes do editor direto no disco — o botao "salvar"
passa a salvar de verdade, sem baixar arquivo nenhum.

COMO USAR
    python servir.py
e abrir o endereco que ele imprimir. Ctrl+C para parar.
Nao instala nada: usa so a biblioteca padrao.
"""
import http.server
import json
import os
import re
import socketserver
import webbrowser

PORTA = 8000
RAIZ = os.path.dirname(os.path.abspath(__file__))
# Unico arquivo que o navegador pode gravar. Lista fechada de proposito: o
# servidor escuta em localhost, mas nao ha motivo para aceitar caminho livre.
GRAVAVEIS = {"mapa-ajustes.js"}


class Manipulador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=RAIZ, **kw)

    def end_headers(self):
        # o jogo muda o tempo todo durante o desenvolvimento: sem cache
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _ok_json(self, obj):
        corpo = json.dumps(obj).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            dados = json.loads(self.rfile.read(n).decode("utf-8")) if n else {}
        except Exception:                           # noqa: BLE001
            self.send_error(400, "corpo invalido")
            return
        try:
            if self.path == "/salvar-mapa":
                nome = dados.get("arquivo", "")
                if nome not in GRAVAVEIS:
                    self.send_error(403, "arquivo nao permitido")
                    return
                with open(os.path.join(RAIZ, nome), "w", encoding="utf-8", newline="\n") as f:
                    f.write(dados.get("texto", ""))
                self._ok_json({"ok": True, "arquivo": nome})
                print("  gravado: " + nome)
                return
            if self.path == "/checkpoint":
                # AUTO-SAVE por turno: anexa o .txt da partida no disco (pasta
                # checkpoints/), sobrevive a crash. Nome fechado a partida_*.txt, sem
                # barras nem '..' -> impossivel escapar da pasta. modo 'novo' cria/zera,
                # qualquer outro ANEXA.
                nome = dados.get("arquivo", "")
                if not re.match(r"^partida_[A-Za-z0-9._-]+\.txt$", nome):
                    self.send_error(403, "nome de checkpoint invalido")
                    return
                pasta = os.path.join(RAIZ, "checkpoints")
                os.makedirs(pasta, exist_ok=True)
                modo = "w" if dados.get("modo") == "novo" else "a"
                with open(os.path.join(pasta, nome), modo, encoding="utf-8", newline="\n") as f:
                    f.write(dados.get("texto", ""))
                self._ok_json({"ok": True})
                if modo == "w":
                    print("  checkpoint iniciado: checkpoints/" + nome)
                return
            if self.path == "/marcas":
                # ── O CADERNO DE MARCAS ──────────────────────────────────
                # Dizer por escrito "a estrada de Toledo esta mal encaixada do
                # lado direito" e lento e ambiguo; apontar no mapa nao e. Aqui
                # chega o que o Lucas rabiscou por cima do jogo: as marcas em
                # COORDENADAS DO MAPA (para eu saber a que aldeia ou estrada
                # pertencem) e uma imagem do ecra (para eu VER o que ele viu).
                # Os dois juntos, porque nenhum dos dois chega sozinho.
                pasta = os.path.join(RAIZ, "marcas")
                os.makedirs(pasta, exist_ok=True)
                sel = dados.get("marcas") or []
                carimbo = re.sub(r"[^0-9]", "", str(dados.get("quando", "")))[:14] or "sem-data"
                base = os.path.join(pasta, "marcas-" + carimbo)
                import base64

                def gravar_png(caminho, url):
                    if not str(url).startswith("data:image/png;base64,"):
                        return None
                    with open(caminho, "wb") as g:
                        g.write(base64.b64decode(url.split(",", 1)[1]))
                    return os.path.basename(caminho)

                # UM RECORTE POR MARCA, e nao so o print do ecra. O ecra mostra
                # o ultimo sitio onde ele esteve; o recorte mostra CADA defeito
                # com o zoom que ele escolheu para o ver. O `foto` sai do JSON
                # depois de gravado — sao ~40 KB de base64 cada e o ficheiro de
                # texto tem de continuar legivel.
                for i, m in enumerate(sel):
                    nome = gravar_png(base + "-%d.png" % (i + 1), m.pop("foto", ""))
                    if nome:
                        m["recorte"] = nome
                with open(base + ".json", "w", encoding="utf-8", newline=chr(10)) as f:
                    json.dump({"quando": dados.get("quando"),
                               "nota": dados.get("nota", ""),
                               "legenda": dados.get("legenda", {}),
                               "marcas": sel}, f, ensure_ascii=False, indent=1)
                gravar_png(base + ".png", dados.get("imagem") or "")
                self._ok_json({"ok": True, "ficheiro": os.path.basename(base)})
                print("  marcas gravadas: marcas/%s.json (%d marca(s))"
                      % (os.path.basename(base), len(sel)))
                return
            self.send_error(404, "rota desconhecida")
        except Exception as e:                      # noqa: BLE001
            self.send_error(500, str(e))

    def log_message(self, fmt, *args):
        pass                                        # silencia o log de cada GET


class Servidor(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    url = "http://localhost:%d/index.html" % PORTA
    print("Arena dos Reis servindo em " + url)
    print("pasta: " + RAIZ)
    print("o botao 'salvar' do editor de mapa grava direto em mapa-ajustes.js")
    print("Ctrl+C para parar\n")
    try:
        webbrowser.open(url)
    except Exception:                               # noqa: BLE001
        pass
    with Servidor(("127.0.0.1", PORTA), Manipulador) as s:
        try:
            s.serve_forever()
        except KeyboardInterrupt:
            print("\nparado.")
