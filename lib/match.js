const initial = () => ({nameA:'Летово',nameB:'Школа 2109',a:0,b:0,setsA:0,setsB:0,setNo:1,serve:'A',phoenixSide:'A',elapsed:0,startedAt:null,revision:0,history:[],recent:[]});
const fields=['nameA','nameB','a','b','setsA','setsB','setNo','serve','phoenixSide'];
function change(s,action,value,now=Date.now()) {
  const snapshot=()=>{s.history.push(Object.fromEntries(fields.map(k=>[k,s[k]])));s.history=s.history.slice(-100)};
  const toggle=()=>{s.serve=s.serve==='A'?'B':'A'};
  if(['plusA','plusB','minusA','minusB'].includes(action)) {
    const t=action.endsWith('A')?'A':'B',k=t.toLowerCase();
    snapshot();if(action.startsWith('plus')){s[k]++;s.serve=t}else s[k]=Math.max(0,s[k]-1);
  } else if(action==='undo'){const old=s.history.pop();if(old)Object.assign(s,old)}
  else if(action==='serveSwap'){snapshot();toggle()}
  else if(action==='resetScore'){snapshot();s.a=0;s.b=0}
  else if(action==='swapSides'){snapshot();[s.a,s.b]=[s.b,s.a];[s.nameA,s.nameB]=[s.nameB,s.nameA];[s.setsA,s.setsB]=[s.setsB,s.setsA];s.phoenixSide=s.phoenixSide==='A'?'B':'A';toggle()}
  else if(action==='timerToggle'){if(s.startedAt!==null){s.elapsed+=Math.max(0,now-s.startedAt);s.startedAt=null}else s.startedAt=now}
  else if(action==='timerReset'){s.elapsed=0;s.startedAt=null}
  else if(action==='endSet'){if(s.a===s.b)throw Error('При равном счёте нельзя завершить сет');snapshot();s[s.a>s.b?'setsA':'setsB']++;s.a=0;s.b=0;s.setNo++}
  else if(/^set(Plus|Minus)[AB]$/.test(action)){snapshot();const k='sets'+action.slice(-1);s[k]=Math.max(0,s[k]+(action.includes('Plus')?1:-1))}
  else if(action==='setNoPlus'||action==='setNoMinus'){snapshot();s.setNo=Math.max(1,s.setNo+(action==='setNoPlus'?1:-1))}
  else if(action==='newMatch'){const fresh=initial();Object.assign(s,fresh,{nameA:s.nameA,nameB:s.nameB,phoenixSide:s.phoenixSide,revision:s.revision,recent:s.recent})}
  else if(action==='renameA'||action==='renameB'){if(typeof value!=='string'||!value.trim()||value.length>60)throw Error('Название: от 1 до 60 символов');snapshot();s['name'+action.slice(-1)]=value.trim()}
  else throw Error('Неизвестная команда');
  s.revision++;return s;
}
function publicState(s){const {history,recent,...state}=s;return state}
module.exports={initial,change,publicState};
