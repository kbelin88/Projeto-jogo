const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const {politica}=require("./variantes.js");
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0); const med=v=>{v=v.slice().sort((x,y)=>x-y);return v[v.length>>1]||0};
function perfil(nome,dec){const S={maior:[],tam:[],retMexe:0,ret:0,forca:[]};
  const w=(v)=>{const o=dec(v); const meu=new Set(v.minhas.map(a=>a.id));
    const tot=v.minhas.reduce((s,a)=>s+n(a.tropas),0)+(v.transito||[]).filter(m=>m.dono===v.dono).reduce((s,m)=>s+n(m.tropas),0);
    const atk=o.envios.filter(e=>!meu.has(e.destinoId)); if(atk.length){S.maior.push(Math.max(...atk.map(e=>n(e.tropas)))/Math.max(1,tot)); atk.forEach(e=>S.tam.push(n(e.tropas)));}
    const orig=new Set(o.envios.map(e=>e.origemId)); for(const a of v.minhas) if(v.estradas[a.id].every(x=>meu.has(x))){S.ret++; if(orig.has(a.id))S.retMexe++;}
    S.forca.push(tot); return o;};
  for(let s=1;s<=60;s++) E.rodarPartida(Object.assign({},E.CONFIG,{seed:s}),{A:w,B:E.jogadorBurro},{maxTurnos:120});
  console.log(`${nome.padEnd(20)} maior ataque do turno = ${(100*med(S.maior)).toFixed(0)}% do exercito | ataque mediano ${med(S.tam)} tropas | aldeias de retaguarda que mexem ${(100*S.retMexe/Math.max(1,S.ret)).toFixed(0)}% | exercito mediano ${med(S.forca)}`);}
perfil("burro",E.jogadorBurro); perfil("k1.5 REFORCA",politica({k:1.5,retaguarda:"reforca"})); perfil("k1.5 PARADA",politica({k:1.5,retaguarda:"parada"}));
