// Smoke12modulos.js — O QUE SAIU DO index.html TEM DE CONTINUAR LIGADO.
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Um modulo extraido falha de uma maneira especialmente traicoeira: o
// adaptador no `index.html` tem um esboco de reserva para quando o ficheiro nao
// carrega (um `<script src>` que da 404 falha em SILENCIO -- ja custou um dia a
// este projeto com o `mapa-ajustes.js`). Com o esboco no lugar, o jogo abre,
// nada estoura, a suite fica verde... e a ferramenta deixou de existir.
//
// Este teste confere as duas pontas de cada modulo: o ficheiro existe e
// exporta o que promete, e o `index.html` carrega-o E alimenta-o.
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const jogo = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");

let falhas = 0;
const conferir = (ok, msg) => {
  if (!ok) { falhas++; console.error("FALHOU: " + msg); } else console.log("ok: " + msg);
};

// ── marcas.js — o caderno de marcas ────────────────────────────────────────
conferir(fs.existsSync(path.join(RAIZ, "marcas.js")), "marcas.js esta no sitio");
const Marcas = require(path.join(RAIZ, "marcas.js"));
conferir(typeof Marcas.criar === "function", "marcas.js exporta criar()");

const cad = Marcas.criar();
for (const nome of ["sincronizar", "MARC", "desenharMarcas3D", "marcarFim",
                    "marcarMover", "vbParaMetros"]) {
  conferir(cad[nome] !== undefined, "o caderno devolve `" + nome + "`");
}
conferir(Array.isArray(cad.MARC.marcas) && cad.MARC.ligado === false,
  "o caderno nasce desligado e com a mesa limpa");

// o modulo nao pode depender de um DOM para ser CARREGADO (o Node nao tem um);
// se a barra nao montar, ele avisa e segue -- uma ferramenta de diagnostico
// nunca pode derrubar o jogo
conferir(/caderno de marcas indisponivel/.test(
  fs.readFileSync(path.join(RAIZ, "marcas.js"), "utf8")),
  "o caderno avisa em vez de estourar quando nao ha DOM");

// ── e o index.html tem de o carregar E alimentar ───────────────────────────
conferir(/<script src="marcas\.js"><\/script>/.test(jogo),
  "o index.html carrega o marcas.js");
conferir(/Marcas\.criar\(\)/.test(jogo), "e cria o caderno");
conferir(/function sincronizarMarcas\(\)/.test(jogo)
      && /sincronizarMarcas\(\);/.test(jogo),
  "e entrega-lhe o mapa e o estado (sincronizarMarcas, chamada no draw)");
conferir(/var _cad =/.test(jogo),
  "o caderno esta em `var`: o draw() corre antes desta linha e `const` seria "
  + "um ReferenceError na zona morta temporal");

// ── e os smokes que fazem eval do index tem de o carregar tambem ───────────
// senao correm com o esboco de reserva e deixam de cobrir uma linha do caderno
for (const t of ["Race.js", "Smoke.js", "Smoke2.js", "Smoke3duelo.js", "Smoke4pausa.js"]) {
  const src = fs.readFileSync(path.join(__dirname, t), "utf8");
  conferir(/global\.Marcas = require/.test(src), t + " carrega o marcas.js");
}

if (falhas) { console.error("\n" + falhas + " falha(s)"); process.exit(1); }
console.log("\nSmoke12modulos: o que saiu do index.html continua ligado");
