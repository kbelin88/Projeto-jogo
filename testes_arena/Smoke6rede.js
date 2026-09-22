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

// ── 22/09: O CLIENTE E UM SO ───────────────────────────────────────────────
// Ate aqui este smoke extraia o `gerarOpenRouter` do index.html com uma
// expressao regular e corria-o num sandbox. Corria a COPIA do browser -- e o
// `rei.js` tinha outra, que nunca recebeu a correcao do Retry-After e por isso
// nunca foi testada por ninguem. Agora ha um ficheiro, e o smoke corre ESSE.
const ClienteOR = require(path.join(__dirname, "..", "clienteor.js"));
const rei = fs.readFileSync(path.join(__dirname, "..", "rei.js"), "utf8");

let esperas = [], chamadas = 0, plano = [], tetos = {};
const fetchFalso = async () => {
  const p = plano[chamadas++] || { ok: true };
  if (p.ok) return { ok: true, json: async () => ({
    choices: [{ message: { content: '{"construir":[],"envios":[]}' }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5 } }) };
  return { ok: false, status: p.status,
           headers: { get: (h) => (h === "retry-after" ? p.retryAfter : null) },
           text: async () => p.corpo || "" };
};
// O CLIENTE DO BROWSER, com os numeros do browser: 9 tentativas, 300 ms.
const run = async (pl) => {
  chamadas = 0; esperas = []; plano = pl; tetos = {};
  const c = ClienteOR.criar({
    chave: "k", url: "http://x", maxTentativas: 9, minIntervaloMs: 0,
    maxTokens: 128000, tetoPorModelo: tetos,
    fetch: fetchFalso, espera: (ms) => { esperas.push(ms); return Promise.resolve(); },
  });
  try { const r = await c.gerar("prompt", "m"); return { ok: true, r }; }
  catch (e) { return { ok: false, erro: e.message }; }
};

(async()=>{
  // 0. os dois lados usam o MESMO ficheiro -- e a razao de este smoke valer
  //    para os dois. Se um deles voltar a ter cliente proprio, isto tem de doer.
  ok("o clienteor.js exporta criar()", typeof ClienteOR.criar === "function");
  ok("o index.html usa o clienteor.js",
     /<script src="clienteor\.js"><\/script>/.test(html) && /ClienteOR\.criar\(/.test(html));
  ok("o rei.js usa o clienteor.js",
     /require\("\.\/clienteor\.js"\)/.test(rei) && /ClienteOR\.criar\(/.test(rei));
  ok("nenhum dos dois volta a chamar o endpoint por sua conta",
     !/fetch\(OPENROUTER_URL/.test(html) && !/openrouter\.ai\/api/.test(rei));

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
  ok("respeita o teto por espera (ClienteOR.TETO_ESPERA_MS)",
     esperas[0] === ClienteOR.TETO_ESPERA_MS, String(esperas[0]));

  // 4. insiste 9 vezes e so entao desiste
  r=await run(Array.from({length:20},()=>({ok:false,status:429,retryAfter:"1"})));
  ok("desiste na 9a tentativa (MAX_TENT_OR)", !r.ok && chamadas===9, `chamadas=${chamadas} erro=${(r.erro||"").slice(0,40)}`);

  // 5. erro que NAO e throttle nao insiste
  r=await run([{ok:false,status:400,corpo:"bad"}]);
  ok("HTTP 400 falha de imediato (nao e throttle)", !r.ok && chamadas===1, `chamadas=${chamadas}`);

  // 6. a retentativa de TURNO existe e nao repete o parse
  // 29/08 — TETO AUTO-AJUSTAVEL. Pedimos max_tokens alto de proposito; um modelo
  // de contexto pequeno recusa com HTTP 400 e DIZ o limite dele. O cliente tem de
  // aprender com o erro e repetir, em vez de matar a partida — foi assim que o
  // liquid/lfm-2.5-2.6b (contexto 65536) passou a jogar.
  // ⚠️ NAO pode virar um retry generico de 400: um 400 sem essa mensagem continua
  // a falhar de imediato (o teste acima guarda isso).
  const corpo400 = JSON.stringify({error:{message:"This endpoint's maximum context length is 65536 tokens. However, you requested about 128002 tokens (2 of text input, 128000 in the completion)."}});
  r = await run([{ok:false,status:400,corpo:corpo400},{ok:true}]);
  ok("HTTP 400 de contexto: aprende o teto e REPETE (nao mata a partida)", r.ok, `chamadas=${chamadas}`);
  ok("o teto aprendido cabe no contexto do modelo e nao e ridiculo",
    tetos.m > 4096 && tetos.m < 65536,
    "teto=" + tetos.m);

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
