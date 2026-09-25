const {carregar,reexec}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const path=require("path");
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
for(const f of process.argv.slice(2)){
  const P=carregar(f); const nomes={}; for(const l of["A","B"]){const m=new RegExp("Rei "+l+" \\(openrouter:([^)]+)\\)").exec(P.txt); nomes[l]=m[1].split("/")[1].replace(":free","");}
  const acc={A:{casa:0,ociosa:0,ini:0,tot:0,turnos:0},B:{casa:0,ociosa:0,ini:0,tot:0,turnos:0}};
  let partida=null; const serie={A:[],B:[]};
  reexec(P,(g,t,fase)=>{
    if(fase!=="pre") return;
    if(!partida){partida={};for(const l of["A","B"]){const cap=g.aldeias.find(a=>a.capital&&a.dono===l);partida[l]=new Set([cap.id,...g.estradas.adj[cap.id]]);}}
    for(const l of["A","B"]){
      const minhas=E.aldeiasDe(g,l); if(!minhas.length) continue;
      const tr=g.movimentos.filter(m=>m.dono===l).reduce((s,m)=>s+n(m.tropas),0);
      let casa=0,ociosa=0,ini=0;
      for(const a of minhas){const k=n(a.tropas);casa+=k;
        const viz=g.estradas.adj[a.id]; if(viz.every(v=>{const b=g.aldeias.find(x=>x.id===v);return b.dono===l;})) ociosa+=k;
        if(partida[l].has(a.id)) ini+=k;}
      const tot=casa+tr; if(!tot) continue;
      const A=acc[l]; A.turnos++; A.tot+=tot; A.casa+=casa; A.ociosa+=ociosa; A.ini+=ini;
      serie[l].push(Math.round(100*ociosa/tot));
    }
  });
  // ataques do log
  const re=/^COMBATE \[(\d+)\][^:]*: atacante ([AB]) Fatk=(\d+) \(ef (\d+)\) Fdef=(\d+) \(ef (\d+)\).*-> vence (atacante|defensor)/gm; let m; const at={A:[],B:[]};
  while((m=re.exec(P.txt))) at[m[2]].push({ef:+m[4],def:+m[6],ok:m[7]==="atacante"});
  const fim=/=== FIM === turno (\d+) \| resultado: (\S+)/.exec(P.txt);
  console.log(`\n${path.basename(f).slice(9)}  | vencedor: ${fim?fim[2]:"?"}`);
  for(const l of["A","B"]){const A=acc[l], a=at[l]; const falhas=a.filter(x=>!x.ok); const med=v=>{v=v.slice().sort((x,y)=>x-y);return v.length?v[v.length>>1]:"-"};
    console.log(`  ${l} ${nomes[l].padEnd(28)} forca media ${(A.tot/A.turnos).toFixed(0).padStart(4)} | OCIOSA (aldeia so com vizinhas proprias) ${(100*A.ociosa/A.tot).toFixed(0)}% | nas aldeias de partida ${(100*A.ini/A.tot).toFixed(0)}% | ataques ${a.length}, falharam ${falhas.length} (${(100*falhas.length/a.length).toFixed(0)}%) | ataque mediano ef ${med(a.map(x=>x.ef))} vs def ${med(a.map(x=>x.def))} | razao mediana ${med(a.map(x=>x.ef/Math.max(1,x.def))).toFixed?med(a.map(x=>x.ef/Math.max(1,x.def))).toFixed(2):"-"}`);
    console.log(`     ociosa% por turno: ${serie[l].join(" ")}`);
  }
}
