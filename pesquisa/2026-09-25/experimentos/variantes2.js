const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const {politica,duelo}=require("./variantes.js");
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
// ESPALHA: imita o LLM -- cada aldeia divide a guarnicao em fatias pequenas por varios alvos
function espalha(fatias){return function(visao){const base=politica({k:1.5,retaguarda:"reforca"})(visao);
  const out=[]; for(const e of base.envios){const alvo=visao.alvos.find(a=>a.id===e.destinoId); if(!alvo){out.push(e);continue;}
    // manda so 1/fatias da tropa (o resto fica em casa) -- ataques pequenos
    const t={}; for(const k in e.tropas) t[k]=Math.ceil(e.tropas[k]/fatias); out.push({origemId:e.origemId,destinoId:e.destinoId,tropas:t});}
  return {construir:base.construir,envios:out};};}
const N=+process.argv[2]||200; const seeds=[...Array(N).keys()].map(i=>i+1000);
const V={
 "burro":E.jogadorBurro,
 "k1.5 ataca":politica({k:1.5,retaguarda:"ataca"}),
 "k1.5 PARADA":politica({k:1.5,retaguarda:"parada"}),
 "k1.5 REFORCA":politica({k:1.5,retaguarda:"reforca"}),
 "k3.0 REFORCA":politica({k:3.0,retaguarda:"reforca"}),
 "REFORCA mas manda 1/2":espalha(2),
 "REFORCA mas manda 1/3":espalha(3),
};
const nomes=Object.keys(V); const M={};
for(const a of nomes){M[a]={}; for(const b of nomes){ if(a===b){M[a][b]="  -  ";continue;}
  if(M[b]&&M[b][a]&&M[b][a]!=="  -  "){M[a][b]=(100-parseFloat(M[b][a])).toFixed(0).padStart(4)+"%";continue;}
  const x=duelo(V[a],V[b],seeds), y=duelo(V[b],V[a],seeds); M[a][b]=(100*(x.w.A+y.w.B)/(2*N)).toFixed(0).padStart(4)+"%";}}
console.log("taxa de vitoria da LINHA contra a COLUNA ("+(2*N)+" jogos por par, lados trocados)");
console.log("".padEnd(24)+nomes.map((x,i)=>("c"+i).padStart(6)).join(""));
nomes.forEach((a,i)=>console.log(("c"+i+" "+a).padEnd(24)+nomes.map(b=>M[a][b].padStart(6)).join("")));
