// ============================================================
//  test_peca6_estradas.js — FASE MOTOR #1: MOVIMENTO POR ESTRADAS
// ------------------------------------------------------------
//  Rodar:  node testes/test_peca6_estradas.js
//
//  Regra: exercitos seguem a rede de ESTRADAS = MST (conectividade) + os k
//  vizinhos mais proximos (atalhos). Menor caminho por Dijkstra (grafo tem
//  ciclos); tempo de viagem soma os trechos da rota, nao a reta. Sem rede
//  (estado sintetico) cai na reta — preserva a Peca 3.
// ============================================================
"use strict";
const Engine = require("../engine.js");
const CONFIG = Engine.CONFIG;

let falhas = 0;
function checa(nome, cond, detalhe) {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`  [${ok ? "OK " : "XX "}] ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}
const adjacentes = (adj, a, b) => (adj[a] || []).includes(b);

// ---------------------------------------------------------
//  A) A rede e CONEXA e mais rica que uma arvore (tem atalhos).
// ---------------------------------------------------------
console.log("A) Rede de estradas: conexa, simetrica e mais rica que arvore:");
{
  const g = Engine.gerarTeatro(Object.assign({}, CONFIG, { seed: 1 }));
  const adj = g.estradas.adj;
  const n = g.aldeias.length;
  let grau = 0;
  for (const a of g.aldeias) grau += (adj[a.id] || []).length;
  checa("mais arestas que uma arvore (> n-1)", grau / 2 > n - 1, `${grau / 2} arestas vs n-1=${n - 1}`);
  let sim = true;
  for (const a of g.aldeias) for (const b of adj[a.id]) if (!adj[b].includes(a.id)) sim = false;
  checa("adjacencia simetrica", sim);
  const vis = new Set([0]); const fila = [0];
  while (fila.length) { const u = fila.shift(); for (const v of adj[u]) if (!vis.has(v)) { vis.add(v); fila.push(v); } }
  checa("conexa (BFS do id 0 alcanca as " + n + ")", vis.size === n, `${vis.size}`);
}

// ---------------------------------------------------------
//  B) Determinismo: mesma seed -> mesma rede.
// ---------------------------------------------------------
console.log("\nB) Determinismo da rede:");
{
  const a1 = JSON.stringify(Engine.gerarTeatro(Object.assign({}, CONFIG, { seed: 7 })).estradas.adj);
  const a2 = JSON.stringify(Engine.gerarTeatro(Object.assign({}, CONFIG, { seed: 7 })).estradas.adj);
  checa("seed 7 gera a MESMA rede", a1 === a2);
}

// ---------------------------------------------------------
//  C) Menor caminho (Dijkstra): valido; atalhos encurtam vs MST pura.
// ---------------------------------------------------------
console.log("\nC) Menor caminho entre aldeias (Dijkstra):");
{
  const g = Engine.gerarTeatro(Object.assign({}, CONFIG, { seed: 1 }));
  const adj = g.estradas.adj;
  const cam = Engine.caminhoEntre(g, 0, 1); // capital A -> capital B
  checa("caminho comeca em 0 e termina em 1", cam[0] === 0 && cam[cam.length - 1] === 1, cam.join(">"));
  let validos = true;
  for (let i = 0; i + 1 < cam.length; i++) if (!adjacentes(adj, cam[i], cam[i + 1])) validos = false;
  checa("passos consecutivos sao vizinhos na rede", validos);
  const reta = Engine.distancia(g.aldeias.find((a) => a.id === 0), g.aldeias.find((a) => a.id === 1));
  checa("rota >= reta (triangulo)", Engine.distanciaRota(g, cam) >= reta - 1e-9);
  // atalhos encurtam: a rota A->B na rede rica <= na MST pura (k=0)
  const gMst = { aldeias: g.aldeias, estradas: Engine.construirEstradas(g.aldeias, 0) };
  const rica = Engine.distanciaRota(g, cam);
  const mst = Engine.distanciaRota(gMst, Engine.caminhoEntre(gMst, 0, 1));
  checa("rede rica encurta vs MST pura", rica <= mst + 1e-9, `rica ${rica.toFixed(1)} vs mst ${mst.toFixed(1)}`);
}

// ---------------------------------------------------------
//  D) enviarExercito roteia pela estrada (jogo real, mundo v2).
// ---------------------------------------------------------
console.log("\nD) enviarExercito segue a estrada (integracao):");
{
  const g = Engine.criarEstadoInicial(CONFIG);          // front-end usa esta via
  checa("criarEstadoInicial tem rede de estradas", !!(g.estradas && g.estradas.adj));
  const rota = Engine.caminhoEntre(g, 0, 1);
  const mov = Engine.enviarExercito(g, 0, 1, { lanceiro: 1 }); // capital A -> capital B
  checa("mov.caminho == caminho da rede", JSON.stringify(mov.caminho) === JSON.stringify(rota), mov.caminho.join(">"));
  const dRota = Engine.distanciaRota(g, rota);
  const dReta = Engine.distancia(g.aldeias.find((a) => a.id === 0), g.aldeias.find((a) => a.id === 1));
  checa("rota >= reta (triangulo)", dRota >= dReta - 1e-9, `rota ${dRota.toFixed(1)} vs reta ${dReta.toFixed(1)}`);
  checa("turnos = ceil(distRota/passo)", mov.turnosTotal === Engine.turnosPorDist(g, dRota, { lanceiro: 1 }));
}

// ---------------------------------------------------------
//  E) ROTEAMENTO MUDA O TEMPO: 0->2 tem de passar por 1 (mais que a reta).
//     0:(0,0)A  1:(10,0)  2:(5,8) ; rede caminho 0-1-2 (2 nao liga direto em 0)
// ---------------------------------------------------------
console.log("\nE) Roteamento pela estrada custa mais que a reta:");
{
  const mk = (id, x, y, dono) => ({ id, x, y, nome: "V" + id, dono: dono || null, capital: false,
    tipo: null, recursos: { madeira: 0, ferro: 0 },
    tropas: { lanceiro: id === 0 ? 50 : 0, arqueiro: 0, cavaleiro: 0 }, construindo: [] });
  const e = { config: CONFIG, turno: 0, log: [], movimentos: [],
    aldeias: [mk(0, 0, 0, "A"), mk(1, 10, 0, null), mk(2, 5, 8, null)],
    estradas: { adj: { 0: [1], 1: [0, 2], 2: [1] } } };
  const mov = Engine.enviarExercito(e, 0, 2, { lanceiro: 1 });
  checa("caminho 0->2 passa por 1", JSON.stringify(mov.caminho) === JSON.stringify([0, 1, 2]), mov.caminho.join(">"));
  const tReta = Engine.turnosViagem(e, e.aldeias[0], e.aldeias[2], { lanceiro: 1 }); // ceil(9.43/6)=2
  checa("turnos pela rota (4) > turnos pela reta (2)", mov.turnosTotal > tReta, `rota ${mov.turnosTotal} vs reta ${tReta}`);
}

// ---------------------------------------------------------
//  F) FALLBACK: estado SEM rede -> reta (preserva Peca 3).
// ---------------------------------------------------------
console.log("\nF) Sem rede -> reta (fallback):");
{
  const mk = (id, x, y, dono) => ({ id, x, y, nome: "V" + id, dono: dono || null, capital: false,
    tipo: null, recursos: { madeira: 0, ferro: 0 },
    tropas: { lanceiro: id === 0 ? 50 : 0, arqueiro: 0, cavaleiro: 0 }, construindo: [] });
  const e = { config: CONFIG, turno: 0, log: [], movimentos: [],
    aldeias: [mk(0, 0, 0, "A"), mk(1, 0, 20, null)] }; // sem estradas
  const mov = Engine.enviarExercito(e, 0, 1, { lanceiro: 1 });
  checa("caminho fallback = [origem, destino]", JSON.stringify(mov.caminho) === JSON.stringify([0, 1]));
  checa("turnos = reta ceil(20/6)=4", mov.turnosTotal === 4, `${mov.turnosTotal}`);
}

console.log("");
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✔" : `RESULTADO: ${falhas} FALHA(S) ✘`);
process.exit(falhas === 0 ? 0 : 1);
