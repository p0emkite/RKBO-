"use strict";
const $=id=>document.getElementById(id);
let championMap={};
const TEAM={
 DOO:["두산 베어스","#003468","DOOSAN BEARS"],HAN:["한화 이글스","#ea580c","HANWHA EAGLES"],
 KIA:["KIA 타이거즈","#cc1129","KIA TIGERS"],LG:["LG 트윈스","#c30434","LG TWINS"],
 LOT:["롯데 자이언츠","#62aedb","LOTTE GIANTS"],NC:["NC 다이노스","#c59f79","NC DINOS"],
 SAM:["삼성 라이온즈","#006db8","SAMSUNG LIONS"],SSG:["SSG 랜더스","#c9203b","SSG LANDERS"],KT:["KT 위즈","#383838","KT WIZ"],KIW:["키움 히어로즈","#8a1232","KIWOOM HEROES"],SK:["SK 와이번스","#ed7731","SK WYVERNS"],
 KT:["KT 위즈","#35343d","KT WIZ"],KIW:["키움 히어로즈","#820024","KIWOOM HEROES"],
 SK:["SK 와이번스","#ea8042","SK WYVERNS"]};
const LONG_TO_CODE=Object.fromEntries(Object.entries(TEAM).map(([k,v])=>[v[2].toUpperCase(),k]));
const labelMap={ERA:"방어율",W:"승",L:"패",SV:"세",BS:"블론",G:"경기수",GS:"선발",CG:"완투",SHO:"완봉",IP:"이닝",K:"삼진",BB:"볼넷",H:"안타","2B":"2루타","3B":"3루타",HR:"홈런",R:"득점",RBI:"타점",AVG:"타율",OBP:"출루율",SLG:"장타율",AB:"타수",SB:"도루",CS:"도실",HBP:"사구",GIDP:"병살",IBB:"고의4구",SF:"희비",SH:"희타",TB:"루타",BK:"보크",WP:"폭투",HB:"사구",ER:"자책점",HLD:"홀드",QS:"QS","#Pitch":"투구수"};
const batCols=["G","AVG","OBP","SLG","OPS","AB","H","2B","3B","HR","R","RBI","BB","K","SB","CS"];
const pitCols=["ERA","W","L","SV","BS","G","GS","CG","SHO","IP","K","BB","H","2B","3B","HR","SB","CS","BK","WP","R","ER","AVG","OBP","SLG","HLD","QS"];
const DB_NAME="rkbo-career-maker";let players={},photo=null,logos={},selectedId="",rawZipYears=[];
function report(message){$("importProgress").textContent=message;}
function strip(v){return String(v||"").replace(/<[^>]*>/g,"").replace(/&nbsp;/ig," ").replace(/&amp;/ig,"&").trim();}
function parseTable(source) {
 const loc=source.indexOf("Stats By Season");
 if(loc<0)return null;
 const end=source.indexOf("</table>",loc);
 if(end<0)return null;
 const part=source.slice(loc,end);
 const rows=[];
 for(const match of part.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)(?=<tr(?:\s[^>]*)?>|<\/table>|$)/gi)){
  const cells=Array.from(match[1].matchAll(/<td\b[^>]*>([\s\S]*?)(?=<\/td>|<\/tr>|<tr|$)/gi),m=>strip(m[1]));
  if(cells.length)rows.push(cells);
 }
 // HTML input contains missing </tr> tags in its summary rows; the regex above still separates records.
 const header=rows.find(row=>row[0]==="Year");
 if(!header||header.length<8)return null;
 const kind=header.includes("ERA")?"pitcher":"batter", headers=header.slice(1);
 const seasons={};let career=null,last3=null;
 for(const row of rows) {
  const year=String(row[0]||"").match(/^((?:19|20)\d{2})\s*(?:\(([^)]*)\))?/);
  const stats={};headers.forEach((h,i)=>{if(row[i+1]!=null&&row[i+1]!=="")stats[h]=row[i+1]});
  if(year) {
   const level=(year[2]||"").toUpperCase();
   if(["A","AA","AAA"].includes(level))continue; // do not include minor-league rows in ML career
   const y=Number(year[1]),team=TEAM[level]?level:null;
   seasons[y]={year:y,team,stats};
  } else if(row[0]==="ML Career")career=stats;
  else if(row[0]==="Last 3")last3=stats;
 }
 return {kind,headers,seasons,career,last3};
}
function inferSeasonCode(raw){ // If the HHRecord is 2010 with user-facing RKBO season 60, this is a league-specific mapping.
 return raw;
}
function parsePlayerFile(text,path){
 const n=text.match(/<title>(.*?) Player Card<\/title>/i);
 const id=path.match(/p_(\d+)\.htm$/i);
 const main=parseTable(text);
 if(!id||!n||!main)return null;
 const teamLong=text.match(/<b>Team:<\/b>\s*([^<]+)/i);
 const number=text.match(/<b>Number:<\/b>\s*([^<]+)/i);
 const currentTeam=LONG_TO_CODE[(teamLong?.[1]||"").trim().toUpperCase()]||null;
 const latestYear=Math.max(0,...Object.keys(main.seasons).map(Number));
 if(latestYear&&currentTeam&&!main.seasons[latestYear].team)main.seasons[latestYear].team=currentTeam;
 return {id:id[1],name:strip(n[1]),number:strip(number?.[1]),team:currentTeam,kind:main.kind,seasons:main.seasons,career:main.career,last3:main.last3,latestYear,hhLatestYear:latestYear,source:"HHRecord player page"};
}
function mergeRecord(old,p){
 if(!old)return p;
 if(old.kind!==p.kind)return old;
 const newer=p.latestYear>=old.latestYear;
 const seasons={...old.seasons};
 for(const [year,rec] of Object.entries(p.seasons)){
  const prev=seasons[year];
  seasons[year]={...prev,...rec,team:rec.team||prev?.team||null,stats:rec.stats};
 }
 return {...old,...(newer?{name:p.name,number:p.number,team:p.team||old.team,career:p.career||old.career,last3:p.last3||old.last3,latestYear:p.latestYear}:{}),seasons};
}
let idb;
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore("data");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function store(){if(!idb)return;return new Promise((resolve,reject)=>{const tr=idb.transaction("data","readwrite");tr.objectStore("data").put(players,"players");tr.oncomplete=resolve;tr.onerror=()=>reject(tr.error)})}
async function restore(){idb=await openDb();return new Promise((resolve,reject)=>{const tr=idb.transaction("data","readonly");const q=tr.objectStore("data").get("players");q.onsuccess=()=>{players=q.result||{};resolve()};q.onerror=()=>reject(q.error)})}
async function importZip(file){
 if(!window.JSZip){report("ZIP 해제 모듈을 로딩할 수 없습니다. 인터넷 연결을 확인하세요.");return}
 $("zipInput").disabled=true;
 try{
  report("ZIP 해제 중: "+file.name);
  const zip=await JSZip.loadAsync(file),files=Object.keys(zip.files).filter(x=>/^(?:.*\/)?Results\/Players\/p_\d+\.htm$/i.test(x));
  if(!files.length)throw Error("Results/Players/p_숫자.htm 파일을 찾지 못했습니다.");
  let valid=0,fail=0;const incoming={};
  for(let i=0;i<files.length;i++){
   try{
    const txt=await zip.files[files[i]].async("string");
    const p=parsePlayerFile(txt,files[i]);
    if(!p){fail++;continue}
    incoming[p.id]=mergeRecord(incoming[p.id],p);valid++;
   }catch(e){fail++}
   if(i%20===0){report("선수 기록 추출 중 "+(i+1)+"/"+files.length);await new Promise(r=>setTimeout(r,0))}
  }
  if(!valid)throw Error("읽을 수 있는 선수 기록이 없습니다.");
  for(const p of Object.values(incoming)){
    // Resolve XLS-first imports: move an exact-matched provisional XLS player to the stable HHRecord ID.
    const xlsOnly=Object.fromEntries(Object.entries(players).filter(([key])=>key.startsWith("xls:")));
    const matched=window.RKBOXls?.match(p,xlsOnly);
    if(matched?.id&&!players[p.id]){
      const restored=RKBOXls.merge(p,players[matched.id]);restored.id=p.id;
      delete players[matched.id];players[p.id]=restored;
    }else players[p.id]=mergeRecord(players[p.id],p);
    players[p.id].hhLatestYear=Math.max(players[p.id].hhLatestYear||0,p.latestYear||0);
   }
  await store();populate();report("완료: "+valid+"명 처리"+(fail?" · "+fail+"개 파일 분석 실패":"")+" · DB 총 "+Object.keys(players).length+"명");
 }catch(e){console.error(e);report("불러오기 실패: "+e.message)}finally{$("zipInput").disabled=false}
}
function toText(name){return TEAM[name]?.[0]||"소속 구단 미확인"}
function availableTeams(){return [...new Set(Object.values(players).map(p=>p.team).filter(Boolean))].sort()}
function populate(){
 const prev=$("teamSelect").value;
 $("teamSelect").replaceChildren(new Option("전체 구단","ALL"),...availableTeams().map(t=>new Option(toText(t),t)));
 $("teamSelect").value=availableTeams().includes(prev)?prev:"ALL";
 $("dbStatus").textContent=Object.keys(players).length.toLocaleString()+"명 저장";
 updatePlayerList();
}
function updatePlayerList(){
 const team=$("teamSelect").value,q=$("playerSearch").value.trim().toLowerCase();
 const list=Object.values(players).filter(p=>(team==="ALL"||p.team===team)&&(p.name.toLowerCase().includes(q)||p.id.includes(q))).sort((a,b)=>a.name.localeCompare(b.name));
 $("playerSelect").replaceChildren(new Option(list.length?list.length+"명 중 선수 선택":"검색 결과 없음",""),...list.map(p=>new Option(p.name+" · "+toText(p.team)+" · "+(p.kind==="pitcher"?"투수":"타자"),p.id)));
 if(list.some(p=>p.id===selectedId))$("playerSelect").value=selectedId;else{selectedId="";$("playerSelect").value=""}
 draw();
}
function roundedRect(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill()}
function text(ctx,str,x,y,opt={}){ctx.fillStyle=opt.color||"#122139";ctx.font=(opt.bold?"700 ":"500 ")+(opt.size||23)+"px Arial, 'Malgun Gothic',sans-serif";ctx.textAlign=opt.align||"left";ctx.textBaseline="middle";ctx.fillText(String(str),x,y,opt.max||1e4)}
function fmt(s,key){
 const v=s?.[key];
 if(key==="OPS")return s?.OBP!=null&&s?.SLG!=null?(Number(s.OBP)+Number(s.SLG)).toFixed(3):"—";
 if(v==null||v==="")return "—";
 if(["AVG","OBP","SLG"].includes(key))return Number(v).toFixed(3).replace(/^0\./,".");
 if(key==="ERA")return Number(v).toFixed(2);
 if(key==="IP"){
  const [whole,frac="0"]=String(v).split(".");
  return whole+(frac==="33"?".1":frac==="67"?".2":frac==="00"||frac==="0"?"":("."+frac));
 }
 return String(v);
}
function computeFA(p){
 const s=p.career||{}; if(p.kind==="batter"){
  const a=Number(s.AVG||0),o=Number(s.OBP||0),sl=Number(s.SLG||0),ab=Number(s.AB||0);
  const n=Number(a>=.3)+Number(o-a>=.08)+Number(sl-a>=.18);
  return ab>=750?n>=2?"A":n===1?"B":"C":"C";
 }
 const games=Number(s.G||0),starts=Number(s.GS||0),ip=Number(s.IP||0);
 const starter=games>0&&starts/games>=.3;
 const n=Number(Number(s.AVG||1)<=.24)+Number(Number(s.OBP||1)<=.29)+Number(Number(s.SLG||1)<=.34);
 return ip>=(starter?300:120)?(n>=2?"A":n===1?"B":"C"):"C";
}
function drawImageContain(ctx,img,x,y,w,h,zoom,dx,dy){
 const ratio=Math.min(w/img.width,h/img.height);
 const ww=img.width*ratio*zoom,hh=img.height*ratio*zoom;
 ctx.drawImage(img,x+(w-ww)/2+dx,y+(h-hh)/2+dy,ww,hh);
}
async function fetchLogo(team){
 if(!team||logos[team]!==undefined)return;
 logos[team]=null;
 const img=new Image();img.onload=()=>{logos[team]=img;draw()};img.onerror=()=>{logos[team]=false;draw()};
 img.src="../logos/"+team+".webp";
}
function draw(){
 if(window.RKBOCard){const p=players[selectedId];const data=RKBOCard.draw({canvas:$("cardCanvas"),p,teamInfo:TEAM,image:photo,logos,wins:championMap,gradient:$("bgStyle").value==="gradient",color2:$("bgColor2").value,angle:$("bgAngle").value,photoZoom:$("zoom").value,photoX:$("offsetX").value,photoY:$("offsetY").value,fa:$("faCheck").checked,faGrade:$("faGrade").value||computeFA(p||{kind:"batter"})});$("downloadBtn").disabled=!p;$("playerInfo").textContent=p?("선수 ID "+p.id+" · "+toText(p.team)+" · "+Object.keys(p.seasons||{}).length+"시즌 · FA "+computeFA(p)+" · 우승 "+data.won+"회"):"선수를 선택하세요.";$("previewDescription").textContent=p?p.name+" · "+Object.keys(p.seasons||{}).length+"시즌":"선수를 선택하세요.";$("kindBadge").textContent=p?.kind==="pitcher"?"PITCHER":p?"BATTER":"CAREER";if(p)Object.values(p.seasons||{}).forEach(r=>fetchLogo(r.team));return;}
 const canvas=$("cardCanvas"),ctx=canvas.getContext("2d");
 const p=players[selectedId],list=p?Object.values(p.seasons||{}).sort((a,b)=>a.year-b.year):[];
 const cols=p?(p.kind==="pitcher"?pitCols:batCols):batCols;
 const rowH=49,top=590,rows=list.length+2;
 canvas.width=1640;canvas.height=Math.max(850,top+(rows+1)*rowH+75);
 const W=canvas.width,H=canvas.height;ctx.fillStyle="#f8fbff";ctx.fillRect(0,0,W,H);
 const theme=TEAM[p?.team]||["RKBO","#153b66","RKBO LEAGUE"];const tc=theme[1];
 ctx.fillStyle=tc;ctx.fillRect(0,0,W,36);ctx.fillStyle="#07172c";ctx.fillRect(0,36,W,500);
 ctx.fillStyle="#fff";ctx.globalAlpha=.05;
 for(let i=-200;i<W+300;i+=140){ctx.save();ctx.translate(i,150);ctx.rotate(-.4);ctx.fillRect(0,0,50,490);ctx.restore()}ctx.globalAlpha=1;
 text(ctx,"RKBO  /  CAREER RECORD",68,95,{bold:true,size:24,color:"#adc5e3"});
 text(ctx,p?theme[2]:"RKBO CAREER STUDIO",68,154,{bold:true,size:36,color:"#fff"});
 if(p){
  fetchLogo(p.team);
  if(logos[p.team] instanceof Image)ctx.drawImage(logos[p.team],W-200,68,128,128);
  text(ctx,(p.number?"#"+p.number+"  ":"")+p.name,68,247,{bold:true,size:61,max:790,color:"#fff"});
  text(ctx,(p.kind==="pitcher"?"PITCHER":"BATTER")+"   •   "+list.length+" SEASONS",70,312,{bold:true,size:23,color:"#a9c4df"});
  const faOn=$("faCheck").checked,grade=$("faGrade").value||computeFA(p);
  if(faOn){roundedRect(ctx,70,351,176,50,8,"#263c58");text(ctx,"FA  "+grade+"등급",87,377,{bold:true,size:25,color:grade==="A"?"#ffdf4e":"#fff"})}
  if(photo){
   ctx.save();ctx.beginPath();ctx.rect(975,40,455,496);ctx.clip();
   drawImageContain(ctx,photo,975,54,455,460,Number($("zoom").value)/100,Number($("offsetX").value),Number($("offsetY").value));ctx.restore();
  }else{
   roundedRect(ctx,1080,170,320,260,18,"#21334a");text(ctx,"UPLOAD PNG",1240,302,{align:"center",size:26,color:"#9ab3d6",bold:true});
  }
 } else {text(ctx,"SEASON DATABASE",70,249,{bold:true,size:65,color:"#fff"});text(ctx,"HHRecord ZIP을 업로드한 뒤 선수를 선택하세요.",70,320,{size:25,color:"#a9c4df"})}
 ctx.fillStyle=tc;ctx.fillRect(0,536,W,54);text(ctx,p?"정규 시즌 통산 기록  /  REGULAR SEASON":"SEASON-BY-SEASON CAREER RECORD",68,563,{color:"#fff",size:24,bold:true});
 const startX=32,endX=W-32,tableWidth=endX-startX,labelW=160;
 const cw=(tableWidth-labelW)/cols.length;
 ctx.fillStyle="#e0e8f2";ctx.fillRect(startX,top,tableWidth,rowH);
 text(ctx,"시즌 / 구단",startX+16,top+rowH/2,{bold:true,size:17});
 cols.forEach((key,i)=>text(ctx,key==="OPS"?"OPS":key,startX+labelW+(i+.5)*cw,top+rowH/2,{bold:true,size:Math.min(19,cw*.38),align:"center"}));
 const entries=p?[...list.map(row=>({...row,label:(row.year-1950)+"차"})),{label:"LAST 3",team:null,stats:p.last3||{}},{label:"ML 통산",team:null,stats:p.career||{}}]:[];
 entries.forEach((rec,i)=>{
  const y=top+(i+1)*rowH,total=i>=list.length;
  ctx.fillStyle=total?(i===list.length?"#d8e4f3":"#bed4ec"):i%2?"#f0f4fa":"#fff";ctx.fillRect(startX,y,tableWidth,rowH);
  if(!total&&rec.team){ctx.fillStyle=TEAM[rec.team]?.[1]||tc;ctx.fillRect(startX,y,9,rowH)}
  text(ctx,rec.label,startX+18,y+rowH/2,{bold:true,size:total?19:18});
  if(!total)text(ctx,rec.team||"—",startX+116,y+rowH/2,{size:17,align:"center",color:rec.team?"#233951":"#8997aa"});
  cols.forEach((key,j)=>text(ctx,fmt(rec.stats,key),startX+labelW+(j+.5)*cw,y+rowH/2,{size:Math.min(18,cw*.37),align:"center",bold:total}));
  ctx.fillStyle="#dae2eb";ctx.fillRect(startX,y+rowH-1,tableWidth,1);
 });
 text(ctx,"RKBO CAREER MAKER   •   STATS FROM HHRECORD",W-32,H-34,{size:17,align:"right",color:"#8497af"});
 $("downloadBtn").disabled=!p;
 $("playerInfo").textContent=p?"선수 ID "+p.id+" · "+toText(p.team)+" · 등번호 "+(p.number||"미확인")+" · "+list.length+"시즌 · 최근 시즌 "+(p.latestYear||"—")+"차 · FA 계산 등급 "+computeFA(p):"선수를 선택하면 시즌별 기록과 ML Career가 자동 표시됩니다.";
 $("previewDescription").textContent=p?p.name+" · 총 "+list.length+"개 ML 시즌 · "+(p.kind==="pitcher"?"투수":"타자"):"데이터를 가져온 뒤 선수를 선택하세요.";
 $("kindBadge").textContent=p?.kind==="pitcher"?"PITCHER":p?"BATTER":"CAREER";
}
async function init(){
 try{await restore();try{championMap=JSON.parse(localStorage.getItem("rkbo-champions")||"{}")}catch(e){championMap={}}; $("champions").value=Object.entries(championMap).sort((a,b)=>Number(a[0])-Number(b[0])).map(([a,b])=>a+","+b).join("\n");populate();report("브라우저 DB 준비 완료 · HHRecord ZIP을 업로드할 수 있습니다.")}catch(e){report("브라우저 저장소를 열지 못했습니다: "+e.message)}
 for(const id of ["teamSelect","playerSearch"])$(id).addEventListener(id==="playerSearch"?"input":"change",updatePlayerList);
 $("playerSelect").addEventListener("change",()=>{selectedId=$("playerSelect").value;photo=null;$("photoInput").value="";$("faCheck").checked=false;$("faGrade").disabled=true;draw()});
 $("xlsInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{report("RKBO XLS 읽는 중...");const parsed=RKBOXls.parse(await file.arrayBuffer());const result=RKBOXls.reconcile(players,RKBOXls.group(parsed));players=result.players;await store();populate();report("XLS "+parsed.length+"개 기록 · 연결 "+result.info.linked+"명 · 신규 "+result.info.created+"명 · 중복·충돌 "+result.info.conflicts+"건 · 판정 보류 "+result.info.ambiguous+"명");}catch(e){console.error(e);report("XLS 불러오기 실패: "+e.message)}e.target.value=""});
 for(const id of ["bgStyle","bgColor2","bgAngle"])$(id).addEventListener("change",draw);
 $("saveChampions").onclick=()=>{const obj={};let errors=[];for(const line of $("champions").value.split(/\r?\n/)){if(!line.trim()||line.trim().startsWith("#"))continue;const m=line.trim().match(/^(\d+)\s*[,;\t]\s*(DOO|HAN|KIA|LG|LOT|NC|SAM|SSG|KT|KIW|SK)$/i);if(!m){errors.push(line);continue}obj[Number(m[1])]=m[2].toUpperCase()}if(errors.length){report("우승팀 입력 형식 오류: "+errors.slice(0,3).join(" / "));return}championMap=obj;localStorage.setItem("rkbo-champions",JSON.stringify(championMap));report("우승 시즌 "+Object.keys(obj).length+"개 저장");draw()};
 $("zipInput").addEventListener("change",async e=>{if(e.target.files[0])await importZip(e.target.files[0]);e.target.value=""});
 $("photoInput").addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;const object=URL.createObjectURL(file),img=new Image();img.onload=()=>{photo=img;URL.revokeObjectURL(object);draw()};img.onerror=()=>{URL.revokeObjectURL(object);report("PNG 이미지를 읽을 수 없습니다.")};img.src=object});
 for(const id of ["zoom","offsetX","offsetY"])$(id).addEventListener("input",()=>{$(id+"Val").textContent=$(id).value+(id==="zoom"?"%":"");draw()});
 $("resetPhoto").onclick=()=>{for(const id of ["zoom","offsetX","offsetY"]){$(id).value=id==="zoom"?100:0;$(id+"Val").textContent=$(id).value+(id==="zoom"?"%":"")}draw()};
 $("faCheck").onchange=()=>{$("faGrade").disabled=!$("faCheck").checked;if($("faCheck").checked&&!$("faGrade").value)$("faGrade").value=computeFA(players[selectedId]||{kind:"batter"});draw()};
 $("faGrade").onchange=draw;
 $("downloadBtn").onclick=()=>{const p=players[selectedId];if(!p)return;const a=document.createElement("a");a.href=$("cardCanvas").toDataURL("image/png");a.download="RKBO_Career_"+p.name.replace(/[^a-zA-Z0-9가-힣_-]/g,"_")+".png";a.click()};
 $("exportDb").onclick=()=>{const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),players})],{type:"application/json"});const a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download="RKBO_Career_DB_"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 $("importDb").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const payload=JSON.parse(await f.text());if(payload.schema!==1||!payload.players||typeof payload.players!=="object")throw Error("지원되지 않는 백업입니다.");for(const p of Object.values(payload.players)){if(p&&p.id&&p.seasons&&p.kind)players[p.id]=mergeRecord(players[p.id],p)}await store();populate();report("백업 복원 완료: "+Object.keys(players).length+"명")}catch(err){report("복원 실패: "+err.message)}e.target.value=""};
 $("resetDb").onclick=async()=>{if(!confirm("이 브라우저의 RKBO 선수 DB를 모두 지울까요?"))return;players={};await store();selectedId="";populate();report("DB 초기화 완료")};
 draw();
}
document.addEventListener("DOMContentLoaded",init);
