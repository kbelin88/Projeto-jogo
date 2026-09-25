// verificar-replay.js — ESTE REPLAY PODE SER GRAVADO?
//
// Uso:  node ferramentas/verificar-replay.js <partida.replay.json> [seed]
//
// ── PORQUE EXISTE ───────────────────────────────────────────────────────────
// Os defeitos do replay apareciam na gravacao, um de cada vez, e cada um custava
// uma volta: o Lucas via, descrevia, e so entao se media. Isto corre ANTES de
// gravar e diz, com a MESMA conta que o ecra usa (`posicaoRota` +
// `planoDoTurno` + a identidade da `ponte3d.js`), tudo o que ja sabemos medir:
//
//   atravessamentos   colunas inimigas que passam uma pela outra sem lutar
//   identidades       duas colunas com a MESMA identidade no desenho -- o mapa
//                     mistura-lhes as posicoes (o bug Valencia-Murcia, 25/09)
//   saltos            uma coluna que anda num instante mais do que pode andar
//   costuras          onde uma coluna acaba um turno e onde comeca o seguinte
//   coladas           duas colunas INIMIGAS no mesmo troco, mais perto que o
//                     alcance (30), sem estarem a lutar -- "marcham juntas" (o T31
//                     da P1 de 23/09). Com o alcance no motor (25/09) nao existe;
//                     em replays antigos pode existir, e entao nao se grava.
//   empilhadas        duas caixas quase no mesmo ponto (informativo: do mesmo
//                     rei e normal; inimigas fora de luta, nao)
//
// Os quatro primeiros tem de dar 0. Sai com codigo 1 se algum nao der.
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const E = require(path.join(RAIZ, "engine.js"));
const { planoDoTurno, chaveMarcha, idsDesenho } = require(path.join(RAIZ, "ponte3d.js"));
const { cruzamentosDoTurno, desenhoDoTurno } = require(path.join(RAIZ, "ferramentas", "medir-cruzamentos.js"));

const PASSOS = 60;
const PERTO = 12;          // unidades do mapa: duas caixas "empilhadas"

function verificar(rep, seed) {
  const st = E.criarEstadoInicial(Object.assign({}, E.CONFIG, { seed: seed || rep.seed || 1 }));
  const nome = (id) => (st.aldeias.find((a) => a.id === id) || {}).nome || id;
  const out = { quadros: rep.frames.length, combatesEstrada: 0, atravessamentos: [], identidades: [],
                saltos: [], costuras: [], coladas: [], empilhadasInimigas: 0, empilhadasMesmoRei: 0, semId: 0 };
  const alcance = E.CONFIG.alcanceEstrada || 30;
  const jaColadas = new Set();
  let fimAnterior = null;
  for (let i = 0; i + 1 < rep.frames.length; i++) {
    const fr = rep.frames[i], prox = rep.frames[i + 1];
    st.aldeias = fr.aldeias;
    const evs = (prox.eventos || []).filter((e) => e.tipo === "combate_estrada");
    out.combatesEstrada += evs.length;
    const movs = fr.movimentos || [];
    // a identidade que o MAPA usa: a mesma funcao da ponte3d.js
    const ids = idsDesenho(movs, fr.turno);
    const idDe = new Map(movs.map((m, j) => [m, ids[j]]));
    const idDesenho = (m) => idDe.get(m);
    out.semId += movs.filter((m) => m.id == null).length;
    const vistos = new Map();
    for (const m of movs) {
      const k = idDesenho(m);
      if (vistos.has(k)) out.identidades.push({ turno: prox.turno, id: k });
      vistos.set(k, m);
    }
    for (const x of cruzamentosDoTurno(st, movs, evs, desenhoDoTurno(evs))) out.atravessamentos.push(Object.assign(x, { turno: prox.turno }));
    const plano = planoDoTurno(evs);
    const onde = (m, r) => {
      if (!plano.visivel(chaveMarcha(m), r)) return null;
      const f = plano.f(chaveMarcha(m), r);
      const p = E.posicaoRota(st, Object.assign({}, m, { turnosRestantes: m.turnosRestantes - f }));
      return p ? { x: p.x, y: p.y, f, troco: Math.min(p.aId, p.bId) + "-" + Math.max(p.aId, p.bId) } : null;
    };
    // costura: o fim do turno anterior tem de ser o comeco deste
    if (fimAnterior) {
      for (const m of movs) {
        const a = fimAnterior.get(idDesenho(m)), b = onde(m, 0);
        if (a && b && Math.hypot(a.x - b.x, a.y - b.y) > 2) {
          out.costuras.push({ turno: fr.turno, id: idDesenho(m), d: +Math.hypot(a.x - b.x, a.y - b.y).toFixed(1) });
        }
      }
    }
    // saltos: medidos na unidade do MOTOR (fracao do turno), nao em pixeis --
    // a marcha anda pelo custo da estrada, e num troco barato e comprido uma
    // coluna rapida cobre muitos pixeis num instante sem saltar nada. Um passo
    // normal e 1/PASSOS/(parte do turno em movimento) <= ~0,035; a vencedora a
    // fechar a folga na pausa anda ate 0,05. Acima de 0,08, ou para tras, e salto.
    const prev = new Map();
    for (let s = 0; s <= PASSOS; s++) {
      const r = s / PASSOS, pts = [];
      for (const m of movs) {
        const q = onde(m, r);
        if (!q) continue;
        const k = idDesenho(m);
        const ant = prev.get(k);
        if (ant) {
          const df = q.f - ant.f;
          if (df > 0.08 || df < -1e-9) {
            out.saltos.push({ turno: prox.turno, id: k, r: +r.toFixed(2), df: +df.toFixed(3) });
          }
        }
        prev.set(k, q);
        pts.push({ m, q });
      }
      // quem esta a lutar AGORA (a menos de 0,06 de turno de uma luta sua):
      // perto de outra coluna nesse momento e normal -- e a luta, ou um encontro
      // de tres no mesmo instante. Fora disso, inimigas coladas e defeito.
      const re = plano.motor(r);
      const aLutar = new Set();
      for (const e of evs) {
        if (Math.abs(re - e.sEncontro) > 0.06) continue;
        aLutar.add(e.atkId != null ? "#" + e.atkId : e.atacante + ":" + e.atkOrigemId + ">" + e.atkDestinoId);
        aLutar.add(e.defId != null ? "#" + e.defId : e.defensor + ":" + e.defOrigemId + ">" + e.defDestinoId);
      }
      for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
        const A = pts[a], B = pts[b];
        const dist = Math.hypot(A.q.x - B.q.x, A.q.y - B.q.y);
        if (A.m.dono !== B.m.dono && A.q.troco === B.q.troco && dist < alcance - 1
            && !aLutar.has(chaveMarcha(A.m)) && !aLutar.has(chaveMarcha(B.m))) {
          const k = prox.turno + "|" + [idDesenho(A.m), idDesenho(B.m)].sort().join("&");
          if (!jaColadas.has(k)) { jaColadas.add(k); out.coladas.push({ turno: prox.turno, a: idDesenho(A.m), b: idDesenho(B.m), dist: +dist.toFixed(1) }); }
        }
        if (dist >= PERTO) continue;
        if (pts[a].m.dono === pts[b].m.dono) out.empilhadasMesmoRei++; else out.empilhadasInimigas++;
      }
    }
    fimAnterior = new Map();
    for (const m of movs) { const q = onde(m, 1); if (q) fimAnterior.set(idDesenho(m), q); }
  }
  out.nome = nome;
  return out;
}

function rotaPx(st, cam) {
  let d = 0;
  for (let i = 0; i + 1 < (cam || []).length; i++) {
    const a = E.aldeiaPorId(st, cam[i]), b = E.aldeiaPorId(st, cam[i + 1]);
    if (a && b) d += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return d;
}

module.exports = { verificar };
if (require.main !== module) return;

const arq = process.argv[2];
if (!arq) { console.error("uso: node ferramentas/verificar-replay.js <partida.replay.json> [seed]"); process.exit(2); }
const rep = JSON.parse(fs.readFileSync(arq, "utf8"));
const r = verificar(rep, parseInt(process.argv[3], 10));
const linha = (nome, lista) => {
  const n = lista.length;
  console.log(`  ${n === 0 ? "OK " : "XX "} ${nome.padEnd(18)} ${n}`);
  for (const x of lista.slice(0, 4)) console.log("        " + JSON.stringify(x));
  return n;
};
console.log(`\n${path.basename(arq)} — ${r.quadros} quadros, ${r.combatesEstrada} combates de estrada`);
if (r.semId) console.log(`  (replay de antes de 25/09: ${r.semId} marchas sem id do motor -- identidade reconstruida)`);
let falhas = 0;
falhas += linha("atravessamentos", r.atravessamentos);
falhas += linha("identidades", r.identidades);
falhas += linha("saltos", r.saltos);
falhas += linha("costuras", r.costuras);
falhas += linha("coladas", r.coladas);
console.log(`  ..  empilhadas (amostras): ${r.empilhadasMesmoRei} do mesmo rei, ${r.empilhadasInimigas} inimigas`);
console.log(falhas ? `\nNAO GRAVAR: ${falhas} defeito(s).` : "\nPODE GRAVAR: nenhum defeito medido.");
process.exit(falhas ? 1 : 0);
