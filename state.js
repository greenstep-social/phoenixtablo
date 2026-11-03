const crypto=require('node:crypto');
const {initial,change,publicState}=require('../lib/match');
const KEY='phoenix:match:v2';
const CAS="local old=redis.call('GET',KEYS[1]); if (old or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
async function redis(command){
  const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL;
  const token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)throw Error('DB_NOT_CONFIGURED');
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw Error('DB_UNAVAILABLE');const data=await response.json();if(data.error)throw Error('DB_UNAVAILABLE');return data.result;
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('CDN-Cache-Control','no-store');
  const reply=(status,data)=>res.status(status).json(data);
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return reply(405,{error:'Метод не поддерживается'})}
  try{
    if(req.method==='GET'){const raw=await redis(['GET',KEY]);return reply(200,{state:publicState(raw?JSON.parse(raw):initial()),serverNow:Date.now()})}
    const secret=process.env.SCOREBOARD_ADMIN_TOKEN;
    if(!secret)return reply(503,{error:'Добавьте SCOREBOARD_ADMIN_TOKEN в Vercel и выполните Redeploy'});
    const expected=Buffer.from('Bearer '+secret),got=Buffer.from(req.headers.authorization||'');
    if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return reply(401,{error:'Неверный пароль пульта'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'Требуется JSON'});
    let body=req.body;if(typeof body==='string'){if(body.length>2048)return reply(413,{error:'Слишком большой запрос'});try{body=JSON.parse(body)}catch{return reply(400,{error:'Неверный JSON'})}}
    if(!body||typeof body.action!=='string'||typeof body.id!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(body.id))return reply(400,{error:'Неверная команда'});
    for(let attempt=0;attempt<8;attempt++){
      const raw=await redis(['GET',KEY]);const s=raw?JSON.parse(raw):initial();
      if(s.recent.includes(body.id))return reply(200,{state:publicState(s),serverNow:Date.now()});
      try{change(s,body.action,body.value)}catch(e){return reply(400,{error:e.message})}
      s.recent.push(body.id);s.recent=s.recent.slice(-200);
      const ok=await redis(['EVAL',CAS,'1',KEY,raw||'',JSON.stringify(s)]);
      if(ok===1)return reply(200,{state:publicState(s),serverNow:Date.now()});
    }
    return reply(409,{error:'Одновременное изменение. Повторите отправку.'});
  }catch(e){return reply(503,{error:e.message==='DB_NOT_CONFIGURED'?'Не найдены переменные базы. Проверьте подключение Upstash к Production и выполните Redeploy.':'Нет связи с базой. Повторите отправку через несколько секунд.'})}
};
