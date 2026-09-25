// Variantes do jogador-base para medir o que VALE mecanicamente (sem LLM).
// Todas constroem igual ao burro; so muda a politica de envio.
const E=require(require("path").join(__dirname,"..","..","..","engine.js"));
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
function prever(cfg,tropas,alvo){ // mesma conta do motor (preverCombate), com counter e terreno
  const est={config:cfg}; const a=Object.assign({},alvo); if(a.dono===null&&!a.tipo) a.tipo=E.tipoDominante(est,a.tropas);
  return E.preverCombate(est,tropas,a);
}
function politica(opt){
  // opt: {k: margem ef/def exigida, retaguarda: 'ataca'|'reforca'|'parada', acumula: bool}
  return function(visao){
    const base=E.jogadorBurro(visao); const cfg=visao.config;
    const shim={config:cfg,estradas:{adj:visao.estradas,custo:visao.estradasCusto||null},aldeias:visao.minhas.concat(visao.alvos)};
    const meu=new Set(visao.minhas.map(a=>a.id));
    const rota=(a,b)=>{const c=E.caminhoEntre(shim,a,b);return c?E.pesoRota(shim,c):Infinity;};
    const ehRet=a=>visao.estradas[a.id].every(v=>meu.has(v));
    const fronteiras=visao.minhas.filter(a=>!ehRet(a));
    const envios=[];
    for(const a of visao.minhas){ const k=n(a.tropas); if(!k) continue;
      if(ehRet(a)){
        if(opt.retaguarda==="parada") continue;
        if(opt.retaguarda==="reforca"&&fronteiras.length){ // leva tudo para a fronteira mais proxima
          let best=null,bd=Infinity; for(const f of fronteiras){const d=rota(a.id,f.id); if(d<bd){bd=d;best=f;}}
          envios.push({origemId:a.id,destinoId:best.id,tropas:Object.assign({},a.tropas)}); continue;}
      }
      // ataca o alvo mais proximo vencivel com margem k (previsao com counter)
      let best=null,bd=Infinity;
      for(const t of visao.alvos){ const p=prever(cfg,a.tropas,t); if(p.FatkEf < opt.k*p.FdefEf || !p.atacanteVence) continue;
        const d=rota(a.id,t.id); if(d<bd){bd=d;best=t;} }
      if(best) envios.push({origemId:a.id,destinoId:best.id,tropas:Object.assign({},a.tropas)});
    }
    return {construir:base.construir,envios};
  };
}
function duelo(decA,decB,seeds){
  let w={A:0,B:0,emp:0}, turnos=0;
  for(const s of seeds){const r=E.rodarPartida(Object.assign({},E.CONFIG,{seed:s}),{A:decA,B:decB},{maxTurnos:120}); turnos+=r.turnos; if(r.vencedor==="A")w.A++; else if(r.vencedor==="B")w.B++; else w.emp++;}
  return {w,turnos:turnos/seeds.length};
}
module.exports={politica,duelo};
if(require.main===module){
  const N=+process.argv[2]||100; const seeds=[...Array(N).keys()].map(i=>i+1);
  const V={
    "burro (base)":E.jogadorBurro,
    "k1.0 retag.ataca":politica({k:1.0,retaguarda:"ataca"}),
    "k1.5 retag.ataca":politica({k:1.5,retaguarda:"ataca"}),
    "k2.0 retag.ataca":politica({k:2.0,retaguarda:"ataca"}),
    "k1.5 retag.PARADA":politica({k:1.5,retaguarda:"parada"}),
    "k1.5 retag.REFORCA":politica({k:1.5,retaguarda:"reforca"}),
    "k2.0 retag.REFORCA":politica({k:2.0,retaguarda:"reforca"}),
  };
  const ref=V["burro (base)"];
  for(const nome in V){ if(nome==="burro (base)") continue;
    const a=duelo(V[nome],ref,seeds), b=duelo(ref,V[nome],seeds);
    const vit=a.w.A+b.w.B, der=a.w.B+b.w.A, emp=a.w.emp+b.w.emp;
    console.log(`${nome.padEnd(22)} vs burro: vence ${(100*vit/(2*N)).toFixed(1)}% | perde ${(100*der/(2*N)).toFixed(1)}% | empate ${emp} | turnos medios ${((a.turnos+b.turnos)/2).toFixed(1)}`);
  }
}
