// ============================================================
//  Smoke6rede.js — RESILIENCIA DE REDE em free-tier (17/08)
// ------------------------------------------------------------
//  Rodar:  node testes_arena/Smoke6rede.js
//
//  Porque existe: tres partidas de 17/08 morreram sem que o jogo tivesse
//  qualquer defeito. O endpoint :free do glm-5.2 e servido por UM provedor com
//  pool compartilhado e devolveu 429 com Retry-After 5s; o cliente adivinhava a
//  espera por backoff exponencial, gastava 6 tentativas antes do pool liberar, e
//  o erro de rede parava a partida inteira no turno 1.
//
//  O que este smoke tranca:
//   - o cliente HONRA o Retry-After (header e retry_after_seconds do corpo);
//   - insiste MAX_TENT_OR vezes num throttle, e nem uma vez num erro que nao e
//     throttle (um 400 tem de falhar de imediato);
//   - ha teto por espera (nao dorme 10 minutos porque o provedor pediu);
//   - existe retentativa no nivel do TURNO, e ela repete a CHAMADA e nunca o
//     PARSE: um JSON quebrado continua sem segunda chance, porque esse e o
//     degrau 0 que o benchmark mede;
//   - a retentativa aborta se o run mudou (nao ressuscita partida antiga);
//   - o log DIZ o throttle recuperado e a retentativa gasta. Um modelo free que
//     precisa de 5 tentativas por turno nao pode parecer igual a um que responde
//     de primeira.
//
//  Roda com um fetch FALSO: nao toca na rede, nao gasta cota, nao precisa chave.
// ============================================================
const fs=require("fs");
const path=require("path");
const html=fs.readFileSync(path.join(__dirname, "..", "index.html"),"utf8");
let falhas=0; const ok=(n,c,d)=>{ if(!c) falhas++; console.log(`  [${c?"OK ":"XX "}] ${n}${d?" -> "+d:""}`); };

const src=html.match(/const MAX_TENT_OR = \d+;[\s\S]*?\n  \}\n/)[0];
ok("extraiu gerarOpenRouter (com MAX_TENT_OR)", !!src);

let esperas=[], chamadas=0, plano=[];
const sandbox={
  espera:(ms)=>{ esperas.push(ms); return Promise.resolve(); },
  ultimoEnvioOR:0, throttlesUltimaChamada:0, tempLLM:0, maxTokensLLM:32000,
  openrouterKey:"k", OPENROUTER_URL:"http://x",
  msUltimaChamada:null, tokensUltimaChamada:null, finishUltimaChamada:null,
  finishNativoUltimaChamada:null, erroUltimaChamada:null, modoRacUltimaChamada:null,
  Date, JSON, Number, Math, isFinite,
  fetch: async ()=>{ const p=plano[chamadas++] || {ok:true};
    if(p.ok) return { ok:true, json: async()=>({choices:[{message:{content:'{"construir":[],"envios":[]}'},finish_reason:"stop"}],usage:{prompt_tokens:10,completion_tokens:5}}) };
    return { ok:false, status:p.status, headers:{get:(h)=>h==="retry-after"?p.retryAfter:null}, text: async()=>p.corpo||"" };
  },
};
const fab=new Function(...Object.keys(sandbox), src+"; return gerarOpenRouter;");
const run=async(pl)=>{ chamadas=0; esperas=[]; plano=pl; sandbox.throttlesUltimaChamada=0;
  const g=fab(...Object.values(sandbox));
  try { const r=await g("prompt","m"); return {ok:true, r}; } catch(e){ return {ok:false, erro:e.message}; } };

(async()=>{
  // 1. dois 429 com Retry-After 5 no HEADER, depois sucesso
  let r=await run([{ok:false,status:429,retryAfter:"5"},{ok:false,status:429,retryAfter:"5"},{ok:true}]);
  ok("recupera de 2x 429 e devolve resposta", r.ok);
  ok("honrou o Retry-After do header (>=5000ms)", esperas.every(e=>e>=5000), JSON.stringify(esperas));

  // 2. 429 com retry_after_seconds no CORPO (foi o caso real do glm-5.2)
  const corpoReal='{"error":{"code":429,"metadata":{"retry_after_seconds":5,"provider_name":"Decart"}}}';
  r=await run([{ok:false,status:429,corpo:corpoReal},{ok:true}]);
  ok("le retry_after_seconds do CORPO quando nao ha header", r.ok && esperas[0]>=5000, JSON.stringify(esperas));

  // 3. teto de 45s por espera
  r=await run([{ok:false,status:429,corpo:'{"retry_after_seconds":600}'},{ok:true}]);
  ok("respeita o teto de 45s por espera", esperas[0]===45000, String(esperas[0]));

  // 4. insiste 9 vezes e so entao desiste
  r=await run(Array.from({length:20},()=>({ok:false,status:429,retryAfter:"1"})));
  ok("desiste na 9a tentativa (MAX_TENT_OR)", !r.ok && chamadas===9, `chamadas=${chamadas} erro=${(r.erro||"").slice(0,40)}`);

  // 5. erro que NAO e throttle nao insiste
  r=await run([{ok:false,status:400,corpo:"bad"}]);
  ok("HTTP 400 falha de imediato (nao e throttle)", !r.ok && chamadas===1, `chamadas=${chamadas}`);

  // 6. a retentativa de TURNO existe e nao repete o parse
  ok("existe deliberarComRetentativa", /async function deliberarComRetentativa/.test(html));
  ok("o passoTurnoDuelo usa a versao com retentativa",
     /deliberarComRetentativa\("A"[\s\S]{0,200}deliberarComRetentativa\("B"/.test(html));
  ok("so repete em erroRede (nunca em JSON invalido)",
     /d\.kind !== "erroRede"\) return d/.test(html));
  ok("aborta se o run mudou (nao ressuscita partida antiga)",
     (html.match(/if \(runId !== meuRun\) return "abort";/g)||[]).length>=3);
  ok("o log registra throttle recuperado", /THROTTLE: " \+ dt\.throttles/.test(html));
  ok("o log registra retentativa de turno", /RETENTATIVA DE TURNO: " \+ r\.retentativas/.test(html));
  console.log(falhas? `\nSMOKE 6 FALHOU: ${falhas} checagem(ns)`:"\nSmoke6rede: todos ok");
  process.exit(falhas?1:0);
})();
