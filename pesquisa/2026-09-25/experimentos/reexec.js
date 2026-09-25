// reexecuta uma partida do .txt no motor e confere contra as linhas placar
const fs=require("fs");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));
function carregar(txtPath, cfgExtra){
  const txt=fs.readFileSync(txtPath,"utf8");
  const seed=Number(/\| seed (\d+) \|/.exec(txt)[1]);
  const blocos=txt.split(/\n########## TURNO /).slice(1);
  const jog={}, placar={};
  for(const b of blocos){
    const m=/^(\d+) — Rei ([AB])/.exec(b); if(!m) continue;
    const t=+m[1], l=m[2];
    const mc=/^ordem\.construir: (.*)$/m.exec(b), me=/^ordem\.envios   : (.*)$/m.exec(b), mp=/^plano \(volta no proximo prompt\): (.*)$/m.exec(b);
    jog[t+l]={construir:mc?JSON.parse(mc[1]):[],envios:me?JSON.parse(me[1]):[],plano:mp?mp[1]:null};
    const pl=/^placar: A (\d+) ald\/tropas (\d+) \| B (\d+) ald\/tropas (\d+) \| neutras (\d+) \| transito (\d+)/m.exec(b);
    if(pl) placar[t]=pl.slice(1).map(Number);
  }
  const maxT=Math.max(...Object.keys(placar).map(Number));
  return {txt,seed,jog,placar,maxT,cfg:Object.assign({},E.CONFIG,{seed},cfgExtra||{})};
}
function reexec(P, onTurno){
  const g=E.criarEstadoInicial(P.cfg); let div=[];
  for(let t=1;t<=P.maxT;t++){
    E.tick(g);
    const pre=onTurno&&onTurno(g,t,"pre");
    const vivos=["A","B"].filter(d=>E.aldeiasDe(g,d).length);
    for(const d of vivos){const j=P.jog[t+d]; if(!j) continue; E.executarOrdem(g,d,{construir:j.construir,envios:j.envios}); E.guardarPlano(g,d,j.plano);}
    const f=d=>E.aldeiasDe(g,d).reduce((s,a)=>s+E.contarTropas(a.tropas),0);
    const meu=[E.aldeiasDe(g,"A").length,f("A"),E.aldeiasDe(g,"B").length,f("B"),E.aldeiasDe(g,null).length,g.movimentos.length];
    const ref=P.placar[t]; if(ref && ref.join()!==meu.join()) div.push(`T${t} log ${ref} motor ${meu}`);
    onTurno&&onTurno(g,t,"pos");
    if(E.checarVitoria(g)) break;
  }
  return div;
}
module.exports={carregar,reexec};
if(require.main===module){
  const extra=process.argv[3]?JSON.parse(process.argv[3]):{};
  const P=carregar(process.argv[2],extra); const d=reexec(P);
  console.log(require("path").basename(process.argv[2]),"seed",P.seed,"turnos",P.maxT,"divergencias",d.length, d.slice(0,3).join(" || "));
}
