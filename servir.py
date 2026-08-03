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

    def do_POST(self):
        if self.path != "/salvar-mapa":
            self.send_error(404, "rota desconhecida")
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            dados = json.loads(self.rfile.read(n).decode("utf-8"))
            nome = dados.get("arquivo", "")
            if nome not in GRAVAVEIS:
                self.send_error(403, "arquivo nao permitido")
                return
            with open(os.path.join(RAIZ, nome), "w", encoding="utf-8", newline="\n") as f:
                f.write(dados.get("texto", ""))
            corpo = json.dumps({"ok": True, "arquivo": nome}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
            print("  gravado: " + nome)
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
