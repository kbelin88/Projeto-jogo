// tabela-modelos.js — constroi a TABELA DA ARENA a partir do dump da OpenRouter.
//
// Entrada:  modelos_free_openrouter.txt (dump gerado do /api/v1/models)
//           + resultados_arena.json (o que JA foi medido em partida, escrito a mao)
// Saida:    MODELOS_ARENA.md  (tabela legivel, para o repo e futuramente o site)
//           modelos_arena.json (a MESMA coisa em dados, para o site consumir)
//
// PRINCIPIO: a coluna "apto" nao e opiniao — sai de regras explicitas sobre o que
// o jogo precisa (texto->texto, contexto e saida suficientes). Um modelo de audio
// ou um classificador de seguranca sao free e inuteis aqui, e a tabela tem de
// dizer isso em vez de o proximo humano descobrir gastando cota.
//
// Uso: node ferramentas/tabela-modelos.js [dump.txt] [resultados.json]
"use strict";
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
const dumpPath = process.argv[2] || path.join(RAIZ, "modelos_free_openrouter.txt");
const resPath  = process.argv[3] || path.join(RAIZ, "resultados_arena.json");

// ---------- 1. parse do dump ----------
const txt = fs.readFileSync(dumpPath, "utf8");
const geradoEm = (/^Gerado em:\s*(.+)$/m.exec(txt) || [, "?"])[1].trim();
const blocos = txt.split(/^-{80,}$/m).slice(1);
const num = (s) => { const m = /([\d.,]+)/.exec(s || ""); return m ? Number(m[1].replace(/[.,]/g, "")) : null; };
const campo = (b, r) => { const m = new RegExp("^" + r + ":\\s*(.+)$", "m").exec(b); return m ? m[1].trim() : null; };

const modelos = [];
for (const b of blocos) {
  const id = campo(b, "ID \\(usar no jogo\\)");
  if (!id) continue;
  const rac = campo(b, "Reasoning/thinking") || "";
  modelos.push({
    id,
    nome: campo(b, "Nome") || id,
    provider: id.split("/")[0],
    criado: campo(b, "Criado em"),
    ctx: num(campo(b, "Context length")),
    maxOut: num(campo(b, "Max completion")),
    modalidade: campo(b, "Modalidade") || "?",
    tokenizer: (campo(b, "Tokenizer") || "?").trim(),
    racMandatorio: /mandatorio=true/.test(rac),
    racPadrao: /ativo-por-padrao=true/.test(rac),
    racSuportado: /reasoning/.test(campo(b, "Parametros suportados") || "") || /suportado/.test(rac),
    esforcos: (/esforcos=([^,]*(?:,[^,]*)*?),\s*default=/.exec(rac) || [, null])[1],
    descricao: (campo(b, "Descricao") || "").slice(0, 160),
  });
}

// ---------- 2. aptidao para a Arena: regras explicitas, nao gosto ----------
// O jogo manda UM prompt de texto e espera UM JSON de texto. O prompt cresce ate
// ~11k chars (~4k tokens) e a resposta precisa caber o raciocinio + o JSON.
const MIN_CTX = 32000, MIN_OUT = 4096;
for (const m of modelos) {
  const r = [];
  if (!/->\s*text/.test(m.modalidade)) r.push("nao produz texto");
  if (/audio/.test(m.modalidade.split("->")[1] || "")) r.push("saida de audio");
  if (m.ctx != null && m.ctx < MIN_CTX) r.push(`contexto ${m.ctx} < ${MIN_CTX}`);
  if (m.maxOut != null && m.maxOut < MIN_OUT) r.push(`saida max ${m.maxOut} < ${MIN_OUT}`);
  if (/content-safety|guard|moderation/i.test(m.id)) r.push("classificador, nao joga");
  if (/^openrouter\//.test(m.id)) r.push("router: escolhe outro modelo por baixo, nao e sujeito de benchmark");
  m.motivosInapto = r;
  m.apto = r.length === 0;
}

// ---------- 3. junta o que JA foi medido em partida ----------
let medidos = {};
try { medidos = JSON.parse(fs.readFileSync(resPath, "utf8")); }
catch (e) { console.error("(sem resultados_arena.json — tabela sai so com o catalogo)"); }
for (const m of modelos) m.arena = medidos[m.id] || null;
// modelos medidos que NAO estao mais no catalogo free (morreram) entram como fantasmas
for (const id of Object.keys(medidos)) {
  if (id.startsWith("_")) continue;            // chaves de nota do JSON, nao sao modelos
  if (modelos.some((m) => m.id === id)) continue;
  modelos.push({ id, nome: medidos[id].nome || id, provider: id.split("/")[0], foraDoCatalogo: true,
    apto: false, motivosInapto: ["fora do catalogo free em " + geradoEm.slice(0, 10)],
    modalidade: "?", tokenizer: "?", arena: medidos[id] });
}

// ---------- 4. saida ----------
const fmt = (n) => n == null ? "?" : (n >= 1000 ? Math.round(n / 1000) + "k" : String(n));
const est = (m) => m.arena ? (m.arena.estado || "TESTADO") : (m.foraDoCatalogo ? "MORTO" : (m.apto ? "não testado" : "inapto"));
const ordem = (m) => (m.arena ? 0 : m.apto ? 1 : 2);
modelos.sort((a, b) => ordem(a) - ordem(b) || (b.ctx || 0) - (a.ctx || 0) || a.id.localeCompare(b.id));

const L = [];
L.push("# Tabela da Arena — modelos free da OpenRouter");
L.push("");
L.push(`Gerada por \`ferramentas/tabela-modelos.js\` a partir de \`${path.basename(dumpPath)}\` (dump de **${geradoEm}**)`);
L.push(`e de \`resultados_arena.json\` (o que foi medido em partida). **Não edite à mão** — edite o JSON e regenere.`);
L.push("");
L.push(`Catálogo: **${modelos.filter((m) => !m.foraDoCatalogo).length} modelos free**, dos quais **${modelos.filter((m) => m.apto).length} são aptos** a jogar a Arena.`);
L.push("");
L.push("**Critério de aptidão** (regra, não gosto): produz texto, contexto ≥ " + fmt(MIN_CTX) +
       ", saída máxima ≥ " + fmt(MIN_OUT) + ", não é classificador nem router.");
L.push("");
L.push("## Aptos e já medidos em partida");
L.push("");
L.push("| modelo | ctx | saída | racioc. | partidas | vit. | atq/unid | counter (inim.) | latência med. | formato | nota |");
L.push("|---|---|---|---|---|---|---|---|---|---|---|");
const temPartida = (x) => x.arena && !x.foraDoCatalogo && Number(x.arena.partidas) > 0;
const soSondado = (x) => x.arena && !x.foraDoCatalogo && !(Number(x.arena.partidas) > 0);
for (const m of modelos.filter(temPartida)) {
  const a = m.arena;
  L.push(`| \`${m.id}\` | ${fmt(m.ctx)} | ${fmt(m.maxOut)} | ${m.racMandatorio ? "obrig." : m.racPadrao ? "padrão" : m.racSuportado ? "opc." : "não"} | ${a.partidas ?? "?"} | ${a.vitorias ?? "?"} | ${a.atqUnidade ?? "?"} | ${a.counterInimigo ?? "?"} | ${a.latenciaMediana ?? "?"} | ${a.formato ?? "?"} | ${a.nota ?? ""} |`);
}
L.push("");
L.push("## Sondados (1 turno), ainda sem partida");
L.push("");
L.push("Passaram — ou falharam — a sonda barata de 1 turno. A sonda mede **disponibilidade e formato**;");
L.push("não mede latência de partida nem estabilidade ao longo de 30 turnos (ver a legenda).");
L.push("");
L.push("| modelo | ctx | saída | racioc. | veredito | latência (sonda) | formato | nota |");
L.push("|---|---|---|---|---|---|---|---|");
for (const m of modelos.filter(soSondado)) {
  const a = m.arena;
  L.push(`| \`${m.id}\` | ${fmt(m.ctx)} | ${fmt(m.maxOut)} | ${m.racMandatorio ? "obrig." : m.racPadrao ? "padrão" : m.racSuportado ? "opc." : "não"} | ${a.estado ?? "?"} | ${a.latenciaMediana ?? "?"} | ${a.formato ?? "?"} | ${a.nota ?? ""} |`);
}
L.push("");
L.push("## Aptos, ainda não sondados");
L.push("");
L.push("| modelo | ctx | saída | racioc. | modalidade | criado | descrição |");
L.push("|---|---|---|---|---|---|---|");
if (!modelos.some((x) => x.apto && !x.arena)) L.push("| — | | | | | | _nenhum: os aptos do catálogo já foram todos sondados_ |");
for (const m of modelos.filter((x) => x.apto && !x.arena)) {
  L.push(`| \`${m.id}\` | ${fmt(m.ctx)} | ${fmt(m.maxOut)} | ${m.racMandatorio ? "obrig." : m.racPadrao ? "padrão" : m.racSuportado ? "opc." : "não"} | ${m.modalidade} | ${m.criado || "?"} | ${(m.descricao || "").slice(0, 90)} |`);
}
L.push("");
L.push("## Inaptos e mortos (não gaste cota aqui)");
L.push("");
L.push("| modelo | por quê |");
L.push("|---|---|");
for (const m of modelos.filter((x) => !x.apto)) L.push(`| \`${m.id}\` | ${m.motivosInapto.join("; ")} |`);
L.push("");
L.push("---");
L.push("");
L.push("## Legenda das colunas medidas");
L.push("");
L.push("- **atq/unid** — ataque médio por unidade construída: `(1·lanceiros + 2·arqueiros + 4·cavaleiros) / total`.");
L.push("  Correlação +0.80 com aldeias finais em 10 lados de 5 partidas de 17/08; o lado com o valor maior venceu 6 de 6.");
L.push("  **Em 18/08 a regra falhou 2 vezes em 3**: o Lightning venceu o espelho com 1.08 contra 1.71, e o");
L.push("  `nano-12b-v2-vl` perdeu com 3.29 contra 1.55. A leitura de 17/08 fica em aberto, não confirmada.");
L.push("- **counter (inim.)** — taxa de counter **só contra o inimigo**. A taxa contra neutras mede leitura de");
L.push("  tabela (guarnição de um tipo só); contra o inimigo mede estratégia (exército misto que muda por turno).");
L.push("- **latência med.** — mediana de segundos por turno. É o custo real em free-tier, não o dólar.");
L.push("- **formato** — degrau 0/1: emite JSON válido e usa ids reais? `ok` / o modo de falha observado.");
L.push("- **sonda ≠ partida** — em 18/08 dois modelos passaram a sonda de 1 turno e desmentiram-na em partida:");
L.push("  `laguna-s-2.1` (5 s na sonda, 181 s de mediana em jogo, com degeneração) e `nemotron-nano-12b-v2-vl`");
L.push("  (5.6 s na sonda, 19 de 30 turnos válidos). Um veredito de sonda é uma licença para jogar, não uma nota.");
fs.writeFileSync(path.join(RAIZ, "MODELOS_ARENA.md"), L.join("\n") + "\n");
fs.writeFileSync(path.join(RAIZ, "modelos_arena.json"), JSON.stringify({ geradoEm, criterio: { MIN_CTX, MIN_OUT }, modelos }, null, 2));
console.log(`MODELOS_ARENA.md + modelos_arena.json: ${modelos.length} modelos (${modelos.filter((m) => m.apto).length} aptos, ${modelos.filter((m) => m.arena).length} medidos)`);
