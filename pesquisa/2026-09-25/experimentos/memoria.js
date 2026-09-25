// Depois de um ataque que FALHOU contra X: o Rei volta a X? com mais forca? ganha?
const {carregar,reexec}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const path=require("path");
for(const f of process.argv.slice(2)){
  const P=carregar(f); const nomes={}; for(const l of["A","B"]){const m=new RegExp("Rei "+l+" \\(openrouter:([^)]+)\\)").exec(P.txt); nomes[l]=m[1].split("/")[1].replace(":free","").slice(0,16);}
  const falhas={A:[],B:[]}, st={}; for(const l of["A","B"]) st[l]={falhas:0,volta:0,maior:0,menorOuIgual:0,ganhou:0,repete2:0};
  reexec(P,(g,t,fase)=>{ if(fase!=="pre") return;
    for(const ev of g.log.filter(e=>e.turno===g.turno&&e.tipo==="combate")){
      const l=ev.atacante;
      // um ataque de l a X: fecha as falhas pendentes em X
      for(const fl of falhas[l].filter(x=>x.alvo===ev.alvoId&&!x.fechada&&t-x.t<=4)){ fl.fechada=true; const S=st[l]; S.volta++;
        if(ev.FatkEf>fl.ef) S.maior++; else S.menorOuIgual++; if(ev.vencedor==="atacante") S.ganhou++; else S.repete2++; }
      if(ev.vencedor==="defensor"){falhas[l].push({alvo:ev.alvoId,t,ef:ev.FatkEf}); st[l].falhas++;}
    }});
  console.log(path.basename(f).slice(9));
  for(const l of["A","B"]){const S=st[l]; console.log(`  ${nomes[l].padEnd(16)} falhas ${S.falhas} | voltou ao mesmo alvo em <=4 turnos: ${S.volta} | com MAIS forca efetiva: ${S.maior}, com igual ou menos: ${S.menorOuIgual} | a volta ganhou: ${S.ganhou}, falhou de novo: ${S.repete2}`);}
}
