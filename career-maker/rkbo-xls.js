"use strict";
window.RKBOXls=(()=>{
 const hitter=["G","AVG","OBP","SLG","AB","H","2B","3B","HR","R","RBI","BB","K","SB","CS"];
 const pitcher=["ERA","W","L","SV","BS","G","GS","CG","SHO","IP","K","BB","H","2B","3B","HR","SB","CS","BK","WP","R","ER","AVG","OBP","SLG"];
 const teams=new Set(["DOO","HAN","KIA","LG","LOT","NC","SAM","SSG","KT","KIW","SK"]);
 const map={SS:"YEAR",S:"SV",H2B:"2B",H3B:"3B"};
 const has=x=>x!==undefined&&x!==null&&String(x).trim()!=="";
 function fullName(n){n=String(n||"").trim();const m=n.match(/^(.*?)\s*,\s*(.*)$/);return(m?(m[2]+" "+m[1]):n).replace(/\s+/g," ").trim()}
 function keyName(n){return fullName(n).normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]/g,"")}
 function outs(v){const n=Number(v);if(!Number.isFinite(n))return null;const ip=Math.floor(n+1e-7),f=Math.round((n-ip)*100);if(f===0)return ip*3;if([30,33,34].includes(f))return ip*3+1;if([66,67,70].includes(f))return ip*3+2;return null}
 function numeric(v,key){if(!has(v))return null;if(key==="IP")return outs(v);const n=Number(v);return Number.isFinite(n)?n:null}
 function same(a,b,kind){const keys=kind==="pitcher"?pitcher:hitter;return keys.every(k=>{const aa=numeric(a?.[k],k),bb=numeric(b?.[k],k);return aa!==null&&bb!==null&&Math.abs(aa-bb)<0.000001})}
 function parse(fileBytes){
  if(!window.XLSX)throw Error("XLS 파일 처리 모듈을 읽지 못했습니다.");
  const wb=XLSX.read(fileBytes,{type:"array",cellDates:false});
  const results=[];
  for(const sheet of wb.SheetNames){
   const ws=wb.Sheets[sheet];if(!ws||!ws["!ref"])continue;
   const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:false});
   const idx=rows.findIndex(r=>r?.some(x=>String(x||"").trim().toUpperCase()==="NAME")&&r?.some(x=>String(x||"").trim().toUpperCase()==="SS"));
   if(idx<0)continue;
   const cols={};rows[idx].forEach((h,i)=>{h=String(h||"").trim().toUpperCase();h=map[h]||h;if(cols[h]===undefined)cols[h]=i});
   const kind=cols.ERA!==undefined?"pitcher":"batter";
   if([cols.TEAM,cols.YEAR,cols.NAME,cols.G].some(x=>x===undefined))continue;
   for(let i=idx+1;i<rows.length;i++){
    const row=rows[i];if(!row)continue;
    const season=Number(row[cols.YEAR]);
    if(!Number.isInteger(season)||season<1||season>200||!has(row[cols.NAME]))continue;
    const s={};
    for(const k of (kind==="pitcher"?pitcher:hitter))if(cols[k]!==undefined&&has(row[cols[k]]))s[k]=String(row[cols[k]]).trim();
    if(!has(s.G))continue;
    const t=String(row[cols.TEAM]||"").trim().toUpperCase();
    results.push({kind,year:1950+season,team:teams.has(t)?t:null,name:fullName(row[cols.NAME]),stats:s});
   }
  }
  if(!results.length)throw Error("Team / Ss / Name 열이 포함된 RKBO 기록 탭을 찾을 수 없습니다.");
  return results;
 }
 function group(rows){
  const m=new Map();
  for(const r of rows){
   const id="xls:"+r.kind+":"+keyName(r.name);
   if(!m.has(id))m.set(id,{id,kind:r.kind,name:r.name,number:"",team:null,seasons:{},career:null,last3:null,latestYear:0,aliases:[],source:"RKBO.xls"});
   const p=m.get(id);
   if(p.seasons[r.year]&&!same(p.seasons[r.year].stats,r.stats,r.kind)){p.conflicts??=[];p.conflicts.push(r.year);continue}
   p.seasons[r.year]={year:r.year,team:r.team,stats:r.stats};
   if(r.year>=p.latestYear){p.latestYear=r.year;p.team=r.team||p.team;p.name=r.name}
  }
  return [...m.values()];
 }
 function match(g,all){
  const votes=new Map();
  for(const p of Object.values(all)){
   if(p.kind!==g.kind||p.id===g.id||!p.seasons)continue;
   let good=0;
   for(const [year,row] of Object.entries(g.seasons)){
    const other=p.seasons[year];
    if(other&&same(row.stats,other.stats,g.kind))good++;
   }
   if(good)votes.set(p.id,good);
  }
  if(!votes.size)return {id:null,why:"none"};
  const best=Math.max(...votes.values()),w=[...votes].filter(([,v])=>v===best);
  return w.length===1?{id:w[0][0],why:"exact",seasons:best}:{id:null,why:"ambiguous"};
 }
 function merge(a,b){
  if(!a)return {...b,aliases:[b.name]};
  const combined={...a.seasons};let conflicts=0;
  for(const [year,r] of Object.entries(b.seasons)){
   if(combined[year]&&!same(combined[year].stats,r.stats,b.kind)){conflicts++;continue}
   combined[year]={...combined[year],...r,team:r.team||combined[year]?.team||null,stats:{...combined[year]?.stats,...r.stats}};
  }
  const newer=Number(b.latestYear)>Number(a.latestYear)||(Number(b.latestYear)===Number(a.latestYear)&&b.id.startsWith("xls:")&&!a.id.startsWith("xls:"));
  return {...a,seasons:combined,name:newer?b.name:a.name,team:newer?(b.team||a.team):(a.team||b.team),
   number:a.number||b.number||"",latestYear:Math.max(a.latestYear||0,b.latestYear||0),
   career:a.career||b.career,last3:a.last3||b.last3,
   hhLatestYear:Math.max(a.hhLatestYear||0,b.hhLatestYear||0),
   aliases:[...new Set([a.name,b.name,...(a.aliases||[]),...(b.aliases||[])])],_conflicts:(a._conflicts||0)+conflicts};
 }
 function reconcile(current,groups){
  const result={...current};const info={linked:0,created:0,ambiguous:0,conflicts:0,aliases:[]};
  for(const g of groups){
   // Do not allow synthetic XLS identities to replace a uniquely matched HHRecord identity.
   const direct=result[g.id],candidates=Object.fromEntries(Object.entries(result).filter(([,v])=>v.id&&!v.id.startsWith("xls:")));
   const m=match(g,candidates);
   if(m.why==="ambiguous"){info.ambiguous++;continue}
   const target=m.id||g.id;
   const old=result[target]||direct;
   const before=old?old._conflicts||0:0;
   const merged=merge(old,g);merged.id=target;result[target]=merged;
   info.conflicts+=merged._conflicts-before;
   if(m.id){info.linked++;if(old?.name!==g.name)info.aliases.push(old.name+" ↔ "+g.name)}
   else if(!direct)info.created++;
   if(m.id&&g.id!==target)delete result[g.id];
  }
  return {players:result,info};
 }
 function seasonSummary(p,period){
  const rows=Object.values(p.seasons||{}).sort((a,b)=>a.year-b.year);
  const chosen=period==="last3"?rows.slice(-3):rows;
  if(!chosen.length)return {};
  const keys=p.kind==="pitcher"?pitcher:hitter,res={};
  const skip=new Set(["ERA","AVG","OBP","SLG","IP"]);
  for(const k of keys){
   if(skip.has(k)||chosen.some(r=>numeric(r.stats[k],k)===null))continue;
   res[k]=chosen.reduce((t,r)=>t+Number(r.stats[k]),0);
  }
  if(p.kind==="batter"){
   if(res.H!=null&&res.AB>0)res.AVG=(res.H/res.AB).toFixed(3);
   if(res.AB>0&&chosen.every(r=>numeric(r.stats.TB,"TB")!==null))res.SLG=(chosen.reduce((x,r)=>x+Number(r.stats.TB),0)/res.AB).toFixed(3);
   if(res.AB>0&&chosen.every(r=>["HBP","SF"].every(k=>numeric(r.stats[k],k)!==null))&&res.H!=null&&res.BB!=null){
    const hbp=chosen.reduce((x,r)=>x+Number(r.stats.HBP),0),sf=chosen.reduce((x,r)=>x+Number(r.stats.SF),0);
    res.OBP=((res.H+res.BB+hbp)/(res.AB+res.BB+hbp+sf)).toFixed(3);
   }
  }else if(chosen.every(r=>numeric(r.stats.IP,"IP")!==null)){
   const out=chosen.reduce((x,r)=>x+outs(r.stats.IP),0);
   res.IP=Math.floor(out/3)+"."+["00","33","67"][out%3];
   if(res.ER!=null&&out)res.ERA=(res.ER*27/out).toFixed(2);
  }
  return res;
 }
 function summary(p,period){
  if(!p)return {};
  const years=Object.keys(p.seasons||{}).map(Number);
  const max=Math.max(0,...years);
  if(p.hhLatestYear===max&&p.hhLatestYear&&p[period==="last3"?"last3":"career"])return p[period==="last3"?"last3":"career"];
  return seasonSummary(p,period);
 }
 return {parse,group,match,reconcile,merge,same,outs,summary};
})();