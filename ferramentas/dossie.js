// dossie.js — o replay virado ROTEIRO.
//
// POR QUE EXISTE: para editar um video da Arena e preciso saber, para cada
// turno, tres coisas ao mesmo tempo — o que aconteceu no mapa, o que os dois
// reis disseram, e EM QUE SEGUNDO DA GRAVACAO isso cai. As tres estavam em
// lugares diferentes (o replay, o log, e a cabeca de quem gravou). Aqui saem
// juntas, num Markdown que se le com o video aberto ao lado.
//
// O timecode e o que faz a ferramenta valer: como o replay e deterministico e
// a cadencia e fixa, o turno N cai sempre no mesmo segundo. Marcar corte deixa
// de ser garimpo na timeline e passa a ser copiar um numero daqui.
//
// FONTE DA VERDADE: o dono de cada aldeia vem do ESTADO do motor (diferenca
// entre quadros), nao dos eventos. Os eventos entram so para dar a cor de
// COMO a aldeia caiu — quem atacou, com que tropa, com que vantagem. E a regra
// da secao 6 do CLAUDE.md: "o .txt narra, o JSON mede".
//
// USO
//   node ferramentas/dossie.js <replay.json>
//   node ferramentas/dossie.js <replay.json> --vel 4000       # 0.5x (padrao)
//   node ferramentas/dossie.js <replay.json> --saida x.md
//
// --vel e o MESMO numero do seletor de velocidade do jogo, em ms por turno:
//   16000=0.125x  8000=0.25x  5715=0.35x  4000=0.5x  2000=1x  1000=2x  500=4x
// Gravou a 0.5x? Passe 4000 e os timecodes batem com o arquivo gravado.

"use strict";

const fs = require("fs");
const path = require("path");

const TIPOS = ["lanceiro", "arqueiro", "cavaleiro"];

function args() {
  const a = process.argv.slice(2);
  const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) { o[a[i].slice(2)] = a[i + 1]; i++; }
    else o._.push(a[i]);
  }
  return o;
}

// 0:00.0 — decimo de segundo porque a 0.5x um turno dura 4 s e o corte
// interessante costuma estar no meio dele.
function tc(ms) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return m + ":" + (s - m * 60).toFixed(1).padStart(4, "0");
}

const curto = (etiqueta) =>
  String(etiqueta || "?").replace(/^[a-z]+:/, "").replace(/:free$/, "");

const placar = (quadro) => {
  const c = { A: 0, B: 0, n: 0 };
  for (const a of quadro.aldeias) {
    if (a.dono === "A") c.A++; else if (a.dono === "B") c.B++; else c.n++;
  }
  return c;
};

const tropasDe = (quadro, dono) => {
  let t = 0;
  for (const a of quadro.aldeias) {
    if (a.dono !== dono) continue;
    for (const k of TIPOS) t += (a.tropas && a.tropas[k]) || 0;
  }
  return t;
};

// Quem mudou de dono entre dois quadros. E esta a lista de conquistas — nao a
// dos eventos, que perderia uma aldeia tomada sem combate.
function trocasDeDono(ant, atu) {
  const antes = new Map(ant.aldeias.map((a) => [a.id, a.dono]));
  const saida = [];
  for (const a of atu.aldeias) {
    const de = antes.get(a.id);
    if (de === a.dono) continue;
    saida.push({ id: a.id, nome: a.nome, de, para: a.dono });
  }
  return saida;
}

function principal() {
  const opc = args();
  const alvo = opc._[0];
  if (!alvo) {
    console.error("uso: node ferramentas/dossie.js <replay.json> [--vel 4000] [--saida x.md]");
    process.exit(1);
  }
  const VEL = parseInt(opc.vel, 10) || 4000;
  const rotulo = (2000 / VEL).toFixed(3).replace(/\.?0+$/, "") + "x";
  const dados = JSON.parse(fs.readFileSync(alvo, "utf8"));
  const fr = dados.frames || [];
  if (!fr.length) { console.error("replay vazio"); process.exit(1); }

  const ult = fr[fr.length - 1];
  const nomeA = curto(ult.etiquetaA);
  const nomeB = curto(ult.etiquetaB || ult.etiqueta);
  const fim = placar(ult);
  const total = fim.A + fim.B + fim.n;
  const alvoVitoria = Math.ceil(total * 0.75);

  const L = [];
  const P = (s) => L.push(s === undefined ? "" : s);

  // ---------- cabecalho ----------
  P("# Dossie — " + path.basename(alvo).replace(/\.replay\.json$/, ""));
  P();
  P("Gerado por `ferramentas/dossie.js` a **" + rotulo + "** (" + VEL + " ms por turno).");
  P("Os timecodes valem para uma gravacao feita nessa velocidade, contando do 1o turno na tela.");
  P();
  P("| | |");
  P("|---|---|");
  P("| Rei A | " + nomeA + " |");
  P("| Rei B | " + nomeB + " |");
  P("| Turnos | " + fr.length + " |");
  P("| Duracao da imagem | " + tc(fr.length * VEL) + " |");
  P("| Placar final | **" + fim.A + " x " + fim.B + "**" + (fim.n ? " (" + fim.n + " neutras)" : "") + " |");
  P("| Limiar de dominancia | " + alvoVitoria + " de " + total + " aldeias, por 2 turnos |");
  P();

  // ---------- varredura ----------
  const linha = [];
  let liderAnt = null;
  let houveConquista = false;
  const momentos = [];

  for (let i = 0; i < fr.length; i++) {
    const q = fr[i];
    const ini = i * VEL;
    const c = placar(q);
    const trocas = i > 0 ? trocasDeDono(fr[i - 1], q) : [];
    const evs = q.eventos || [];
    const estrada = evs.filter((e) => e.tipo === "combate_estrada");
    const repelidos = evs.filter((e) => e.tipo === "combate" && !e.conquista);

    // como cada aldeia caiu, pelo evento correspondente
    const comoCaiu = new Map();
    for (const e of evs) if (e.tipo === "combate" && e.conquista) comoCaiu.set(e.alvoId, e);

    const reg = {
      i, turno: q.turno, ini, c, trocas, estrada, repelidos, comoCaiu,
      diag: q.diag || {},
      tropas: { A: tropasDe(q, "A"), B: tropasDe(q, "B") },
    };
    linha.push(reg);

    // --- momentos que viram corte ---
    const lider = c.A === c.B ? null : (c.A > c.B ? "A" : "B");
    if (i > 0 && lider && liderAnt && lider !== liderAnt) {
      momentos.push({ ini, turno: q.turno, o: "**Vira a lideranca** — Rei " + lider + " passa a frente (" + c.A + " x " + c.B + ")" });
    }
    if (lider) liderAnt = lider;

    if (trocas.length && !houveConquista) {
      houveConquista = true;
      momentos.push({ ini, turno: q.turno, o: "**Primeiro sangue** — " + trocas.map((t) => t.nome).join(", ") });
    }
    if (trocas.length >= 3) momentos.push({ ini, turno: q.turno, o: "**" + trocas.length + " aldeias trocam de mao num turno**" });
    if (estrada.length) momentos.push({ ini, turno: q.turno, o: "Combate de estrada" + (estrada.length > 1 ? " (" + estrada.length + ")" : "") + " — exercitos que se cruzam fora de aldeia" });
    if (c.A >= alvoVitoria || c.B >= alvoVitoria) momentos.push({ ini, turno: q.turno, o: "**Limiar de dominancia tocado** (" + c.A + " x " + c.B + ")" });

    // falha do modelo e conteudo, nao ruido: e o que separa isto de um jogo
    for (const lado of ["A", "B"]) {
      const d = reg.diag[lado];
      if (!d) continue;
      if (d.vazio) momentos.push({ ini, turno: q.turno, o: "Rei " + lado + " **nao ordenou nada** (resposta vazia, finish `" + (d.finish || "?") + "`)" });
      else if (d.truncado) momentos.push({ ini, turno: q.turno, o: "Rei " + lado + " teve a resposta **cortada no teto** (`" + (d.finish || "?") + "`)" });
      else if (d.formatoOk === false) momentos.push({ ini, turno: q.turno, o: "Rei " + lado + " **quebrou o formato** (JSON invalido)" });
      if ((d.rejeicoes || []).length >= 3) momentos.push({ ini, turno: q.turno, o: "Rei " + lado + " teve " + d.rejeicoes.length + " ordens **rejeitadas** pelo motor" });
    }
  }

  // ---------- momentos ----------
  P("## Momentos");
  P();
  P("A lista de onde apontar a camera. Cada linha ja tem o segundo da gravacao.");
  P();
  if (!momentos.length) P("_Nada saltou aos criterios automaticos — partida plana._");
  for (const m of momentos) P("- `" + tc(m.ini) + "` **T" + m.turno + "** — " + m.o);
  P();

  // ---------- custo de relogio ----------
  const mss = { A: [], B: [] };
  for (const r of linha) for (const lado of ["A", "B"]) {
    const d = r.diag[lado];
    if (d && d.ms) mss[lado].push(d.ms);
  }
  const mediana = (v) => {
    if (!v.length) return null;
    const s = [...v].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  P("## Custo de relogio");
  P();
  P("Quanto a partida levou para ser JOGADA (nao tem relacao com a duracao do video).");
  P();
  P("| lado | modelo | mediana por turno | pior turno |");
  P("|---|---|---|---|");
  for (const lado of ["A", "B"]) {
    const v = mss[lado];
    const nome = lado === "A" ? nomeA : nomeB;
    P("| " + lado + " | " + nome + " | " + (v.length ? (mediana(v) / 1000).toFixed(1) + " s" : "—") +
      " | " + (v.length ? (Math.max(...v) / 1000).toFixed(1) + " s" : "—") + " |");
  }
  P();

  // ---------- linha do tempo ----------
  P("## Linha do tempo");
  P();
  for (const r of linha) {
    const c = r.c;
    const dif = c.A - c.B;
    P("### T" + r.turno + " · `" + tc(r.ini) + "`–`" + tc(r.ini + VEL) + "` · " + c.A + " x " + c.B +
      (dif ? " (" + (dif > 0 ? "+" : "") + dif + ")" : " (empate)"));
    P();
    P("tropas em campo: A " + r.tropas.A + " · B " + r.tropas.B);
    P();

    if (r.trocas.length) {
      for (const t of r.trocas) {
        const e = r.comoCaiu.get(t.id);
        const deQuem = t.de === null ? "neutra" : "do Rei " + t.de;
        let como = "";
        if (e) {
          const vant = e.vantagem > 0 ? " **com o counter a favor**" : e.vantagem < 0 ? " _contra o counter_" : "";
          como = " — " + e.atkType + " " + e.Fatk + " contra " + e.defType + " " + e.Fdef +
                 " (efetivas " + e.FatkEf + " x " + e.FdefEf + ")" + vant + ", sobraram " + e.sobreviventesForca;
        }
        P("- **" + t.nome + "** (" + deQuem + ") cai para o **Rei " + t.para + "**" + como);
      }
      P();
    }
    for (const e of r.repelidos) {
      P("- assalto **repelido** em " + e.alvoNome + ": Rei " + e.atacante + " atacou com " + e.atkType + " " + e.Fatk + " e perdeu");
    }
    for (const e of r.estrada) {
      P("- **combate de estrada**: exercito de " + e.atacante + " (" + e.Fatk + ") cruza com o de " +
        e.defensor + " (" + e.Fdef + ") fora de aldeia — vence " + e.vencedorDono);
    }
    if (r.repelidos.length || r.estrada.length) P();

    for (const lado of ["A", "B"]) {
      const d = r.diag[lado];
      if (!d) continue;
      const nome = lado === "A" ? nomeA : nomeB;
      const avisos = [];
      if (d.vazio) avisos.push("resposta vazia");
      if (d.truncado) avisos.push("cortada no teto");
      if (d.formatoOk === false) avisos.push("JSON invalido");
      if ((d.rejeicoes || []).length) avisos.push(d.rejeicoes.length + " ordem(ns) rejeitada(s)");
      const selo = avisos.length ? "  [!] " + avisos.join(" · ") : "";
      P("**Rei " + lado + "** (" + nome + ")" + (d.ms ? " · " + (d.ms / 1000).toFixed(0) + " s" : "") + selo);
      P();
      if (d.depoimento) { P("> " + String(d.depoimento).replace(/\s*\n+\s*/g, " ")); P(); }
      else { P("> _(sem depoimento neste turno)_"); P(); }
      if (d.plano) { P("_plano:_ " + String(d.plano).replace(/\s*\n+\s*/g, " ")); P(); }
    }
    P("---");
    P();
  }

  const saida = opc.saida || alvo.replace(/\.replay\.json$/, "") + ".dossie.md";
  fs.writeFileSync(saida, L.join("\n"), "utf8");
  console.log("dossie: " + saida);
  console.log("  " + fr.length + " turnos · " + momentos.length + " momentos · imagem de " +
              tc(fr.length * VEL) + " a " + rotulo);
}

principal();
