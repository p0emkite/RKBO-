"use strict";
window.RKBOCard=(()=>{
 const bat=[["year","시즌",48],["team","소속팀",100],["G","경기수",70],["AVG","타율",80],["OBP","출루율",80],["SLG","장타율",80],["OPS","OPS",80],["AB","타수",76],["H","안타",75],["2B","2루타",72],["3B","3루타",72],["HR","홈런",70],["R","득점",70],["RBI","타점",70],["BB","볼넷",70],["K","삼진",70],["SB","도루",70],["CS","도루 실패",90]];
 const pit=[["year","시즌",48],["team","소속팀",95],["ERA","방어율",71],["W","승",51],["L","패",51],["SV","세",51],["BS","블론",61],["G","경기",61],["GS","선발",61],["CG","완투",61],["SHO","완봉",61],["IP","투구이닝",90],["K","탈삼진",72],["BB","볼넷",72],["H","피안타",72],["2B","2루",57],["3B","3루",57],["HR","홈런",57],["SB","도루",57],["CS","도실",57],["BK","보크",57],["WP","폭투",57],["R","실점",57],["ER","자책점",72],["AVG","피안",65],["OBP","피출",65],["SLG","피장",65],["HLD","홀드",55],["QS","퀄스",55]];
 function tint(hex,f){if(!/^#[0-9a-f]{6}$/i.test(hex))return hex;const parts=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return "#"+parts.map(n=>Math.max(0,Math.min(255,Math.round(n*f))).toString(16).padStart(2,"0")).join("")}
 function bg(ctx,W,H,palette,gradient,color2,angle){
  if(gradient){
   const a=Number(angle)||0,rad=a*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad);
   const g=ctx.createLinearGradient(W/2-dx*W/2,H/2-dy*H/2,W/2+dx*W/2,H/2+dy*H/2);
   g.addColorStop(0,palette);g.addColorStop(1,color2||tint(palette,.48));ctx.fillStyle=g;
  }else ctx.fillStyle=palette;
  ctx.fillRect(0,0,W,H);
 }
 function write(ctx,val,x,y,size=19,align="center",bold=true,color="#fff",max=1000){
  ctx.font=(bold?"700 ":"500 ")+size+"px Arial, 'Malgun Gothic', sans-serif";
  ctx.textBaseline="middle";ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(String(val),x,y,max);
 }
 function rate(stat,k){
  if(k==="OPS")return stat?.OBP!=null&&stat?.SLG!=null?(Number(stat.OBP)+Number(stat.SLG)).toFixed(3):"—";
  const v=stat?.[k];if(v==null||v==="")return "—";
  if(["AVG","OBP","SLG"].includes(k))return Number(v).toFixed(3);
  if(k==="ERA")return Number(v).toFixed(2);
  if(k==="IP"){
   const n=Number(v);return Number.isFinite(n)?n.toFixed(2):String(v);
  }
  return String(v);
 }
 function draw(args){
  const {canvas,p,teamInfo={},image,logos={},wins={},gradient=false,color2="",angle=0,photoZoom=100,photoX=0,photoY=0,fa=false,faGrade=""}=args;
  const ctx=canvas.getContext("2d");const pitcher=p?.kind==="pitcher";
  const columns=pitcher?pit:bat;
  const W=pitcher?1606:1492,H0=pitcher?231:220,headH=28,rowH=29;
  const rows=Object.values(p?.seasons||{}).sort((a,b)=>a.year-b.year);
  const height=H0+headH+(rows.length+2)*rowH+3;
  canvas.width=W;canvas.height=height;
  const current=p?.team||"LG",theme=teamInfo[current]||["RKBO","#c50136","RKBO LEAGUE"],teamColor=theme[1]||"#c50136";
  ctx.fillStyle="#fff";ctx.fillRect(0,0,W,height);
  ctx.save();ctx.beginPath();ctx.rect(0,0,W,H0);ctx.clip();
  bg(ctx,W,H0,teamColor,gradient,color2,angle);
  if(image){
   const ratio=Math.min((W*.38)/image.width,(H0*1.07)/image.height)*Number(photoZoom)/100;
   const imgW=image.width*ratio,imgH=image.height*ratio;
   ctx.drawImage(image,W*.18-imgW/2+Number(photoX),H0-imgH+Number(photoY),imgW,imgH);
  }
  const midpoint=W*.505;
  const won=rows.filter(r=>r.team&&wins[r.year-1950]===r.team).length;
  if(won)write(ctx,"★".repeat(won),midpoint,17,22,"center",true,"#ffdc36");
  write(ctx,theme[2]||"RKBO",midpoint,49,34);
  write(ctx,p?("#"+(p.number||"—")+". "+p.name):"RKBO CAREER MAKER",midpoint,113,53,"center",true,"#fff",W*.54);
  write(ctx,"정규 시즌 통산 기록",midpoint,181,28);
  if(fa&&p)write(ctx,"FA    "+(faGrade||"C")+"등급",midpoint,211,18,"center",true,"#ffe000");
  const logo=logos[current];
  if(logo&&logo.complete&&logo.naturalWidth){
   const maxW=W*.21,maxH=H0*.96,ratio=Math.min(maxW/logo.naturalWidth,maxH/logo.naturalHeight);
   const w=logo.naturalWidth*ratio,h=logo.naturalHeight*ratio;
   ctx.drawImage(logo,W-47-maxW/2-w/2,(H0-h)/2,w,h);
  }
  ctx.restore();
  const tableCols=columns;
  const naturalWidth=tableCols.reduce((sum,c)=>sum+c[2],0);
  const factor=W/naturalWidth;
  const starts=[],widths=[];let next=0;
  for(const [,label,w] of tableCols){starts.push(next);widths.push(w*factor);next+=w*factor}
  ctx.fillStyle="#070707";ctx.fillRect(0,H0,W,headH);
  tableCols.forEach(([key,label],i)=>write(ctx,label,starts[i]+widths[i]/2,H0+headH/2,18,"center",true,"#fff",widths[i]-1));
  const entryRows=[
    ...rows.map(r=>({...r,title:(r.year-1950)+"차"})),
    {title:"4시즌 통산",stats:RKBOXls.summary(p,"career"),total:true},
    {title:"최근 3시즌 통산",stats:RKBOXls.summary(p,"last3"),total:true}
  ];
  // Use actual full career, not a hard-coded 4 seasons, for the total display label.
  entryRows[rows.length].title=rows.length+"시즌 통산";
  const years=new Set();
  entryRows.forEach((r,i)=>{
   const y=H0+headH+i*rowH;
   const rc=r.total?"#000":(teamInfo[r.team]?.[1]||"#31465c");
   ctx.fillStyle=rc;ctx.fillRect(0,y,W,rowH);
   ctx.fillStyle="#fff";ctx.fillRect(0,y,W,2);
   if(r.total){
    write(ctx,r.title,8+W*.04,y+16,17,"left",true,"#fff",230);
   }else{
    const rowlogo=logos[r.team]; const wYear=widths[0],wTeam=widths[1];
    write(ctx,r.title,4,y+17,17,"left",true);
    if(rowlogo&&rowlogo.complete&&rowlogo.naturalWidth){
     const ratio=Math.min(24/rowlogo.naturalWidth,22/rowlogo.naturalHeight);
     const ww=rowlogo.naturalWidth*ratio,hh=rowlogo.naturalHeight*ratio;
     ctx.drawImage(rowlogo,starts[1]+1,y+4,ww,hh);
    }
    write(ctx,r.team||"—",starts[1]+wTeam*.60,y+17,17,"center",true,"#fff");
   }
   for(let j=2;j<tableCols.length;j++)write(ctx,rate(r.stats,tableCols[j][0]),starts[j]+widths[j]/2,y+17,16,"center",true,"#fff",widths[j]-3);
   // Summary first numeric falls at position 2, matching the original layout.
  });
  ctx.fillStyle="#fff";ctx.fillRect(0,height-2,W,2);
  return {width:W,height,won};
 }
 return {draw,tint,bat,pit};
})();