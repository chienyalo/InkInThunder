'use strict';
(function(){
const W=1600,H=1100,PAPER='#eee4ce';
function randomFrom(seed){let h=2166136261;for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function catmull(a,b,c,d,t){const t2=t*t,t3=t2*t;return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3)}
function sample(control){const points=[];for(let j=0;j<control.length-1;j++){const a=control[Math.max(0,j-1)],b=control[j],c=control[j+1],d=control[Math.min(control.length-1,j+2)];const steps=Math.max(9,Math.ceil(Math.hypot(c.x-b.x,c.y-b.y)/2.3));for(let k=0;k<steps;k++){const t=k/steps;points.push({x:catmull(a.x,b.x,c.x,d.x,t),y:catmull(a.y,b.y,c.y,d.y,t),p:clamp(catmull(a.p,b.p,c.p,d.p,t),.035,1.25)})}}points.push({...control[control.length-1]});return points}
class CursiveBrush{
constructor(){this.strokes=[];this.paper=null;this.config=null;this.total=0;this.buildCount=0}
build(config){this.config={...config};let r=randomFrom(config.seed);const vigor=config.vigor/100,space=config.space/100;this.strokes=[];let elapsed=0,group=null,pathIndex=0,anchorY=0;
const add=(control,width,wet,join=false)=>{const points=sample(control);let length=0;for(let i=0;i<points.length;i++){const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,n=Math.hypot(dx,dy)||1;points[i].nx=-dy/n;points[i].ny=dx/n;const speed=Math.hypot(points[i].x-prev.x,points[i].y-prev.y);length+=speed;points[i].radius=width*points[i].p*(.98+.02*Math.sin(i*.43+width))*clamp(1.09-speed*.03,.88,1.1)}const duration=clamp(length/(join?800:680),.055,.55);const stroke={id:group+':'+(join?'join':pathIndex++),group,anchorY,points,width,wet,join,phase:r()*50,start:elapsed,duration,end:elapsed+duration};elapsed+=duration+(join?0:.008);for(const point of points)point.wet=wet;this.strokes.push(stroke);return stroke};
const lines=['風起雲湧','山河入夢','墨走風雷','萬象生意','水月清心'];
for(let col=0;col<lines.length;col++){r=randomFrom(config.seed+':column:'+col);const x=W-232-col*(226+space*48)+(r()-.5)*28;let y=95+r()*44,previous=null,ink=.98;
for(let row=0;row<lines[col].length;row++){r=randomFrom(config.seed+':glyph:'+col+':'+row);group=col+':'+row;pathIndex=0;const char=lines[col][row],glyph=window.cursiveGlyphs[char];const cellH=Math.min((194+r()*53)*(1.1-space*.2)*(col===2&&row===0?1.12:1),H-100-y),h=cellH*glyph.height/.85;const w=h*(.87+r()*.35)*(1+vigor*.09);const leaning=(r()-.5)*(.14+vigor*.34),cx=x+(r()-.5)*40+Math.sin(row*1.5+col)*18,cy=y+(cellH-h)*.2;anchorY=cy;const paths=glyph.paths.map(path=>path.map(q=>({x:cx+q[0]*w+(q[1]-.5)*h*leaning,y:cy+q[1]*h,p:q[2]})));
if(previous){const enabled=r()<.44+vigor*.32;const start=paths[0][0];add([{...previous,p:.045},{x:previous.x+(r()-.5)*30,y:previous.y+(start.y-previous.y)*.45,p:.12},{x:start.x-7,y:start.y-12,p:.08},{...start,p:.035}],1.65,config.wet/100*.8,true).skip=!enabled}
for(const path of paths){const stroke=add(path,h*glyph.width*(.7+vigor*.6),clamp(config.wet/100*ink*(.89+r()*.17),.12,1));previous=stroke.points[stroke.points.length-1]}
ink*=.86;if(row===2)ink=1;y+=cellH+12+space*23;
}elapsed+=.18;
}
this.total=elapsed;this.paper=this.makePaper(config.seed);this.buildCount++;
}
replan(config,time){
 const next=new CursiveBrush();next.build(config);const lookup=new Map(next.strokes.map(s=>[s.id,s]));
 const active=this.strokes.find(s=>time>=s.start&&time<s.end);const activeGroup=active?.group;
 const offsets=new Map();
 for(const s of this.strokes){if(s.end<=time||s.group===activeGroup)continue;const col=s.group.split(':')[0];if(!offsets.has(col)){const candidate=lookup.get(s.id);if(candidate)offsets.set(col,s.anchorY-candidate.anchorY)}}
 const fit=new Map();for(const [col,offset] of offsets){const pending=this.strokes.filter(s=>s.end>time&&s.group!==activeGroup&&s.group.split(':')[0]===col);let max=0;for(const old of pending){const s=lookup.get(old.id);if(s)for(const p of s.points)max=Math.max(max,p.y+offset)}const origin=pending[0]?.anchorY||0;fit.set(col,{origin,scale:max>H-65?Math.max(.2,(H-65-origin)/(max-origin)):1})}
 const widthRatio=(.7+config.vigor/100*.6)/(.7+this.config.vigor/100*.6);
 for(let k=0;k<this.strokes.length;k++){
  const old=this.strokes[k],candidate=lookup.get(old.id);if(old.end<=time||!candidate)continue;
  if(old.group===activeGroup){
   const frozen=time>old.start?Math.floor(old.points.length*clamp((time-old.start)/old.duration,0,1)):0;
   for(let i=frozen;i<old.points.length;i++){const point=old.points[i],blend=clamp((i-frozen)/24,0,1);point.radius*=1+(widthRatio-1)*blend;point.wet+=(candidate.wet-point.wet)*blend}
   continue;
  }
  const offset=offsets.get(old.group.split(':')[0])||0;
  const columnFit=fit.get(old.group.split(':')[0])||{origin:0,scale:1};
  for(const point of candidate.points){point.y=columnFit.origin+(point.y+offset-columnFit.origin)*columnFit.scale;point.radius*=Math.sqrt(columnFit.scale)}
  for(let i=0;i<candidate.points.length;i++){const a=candidate.points[Math.max(0,i-1)],b=candidate.points[Math.min(candidate.points.length-1,i+1)],n=Math.hypot(b.x-a.x,b.y-a.y)||1;candidate.points[i].nx=-(b.y-a.y)/n;candidate.points[i].ny=(b.x-a.x)/n}
  candidate.anchorY=columnFit.origin+(candidate.anchorY+offset-columnFit.origin)*columnFit.scale;candidate.start=old.start;candidate.duration=old.duration;candidate.end=old.end;
  this.strokes[k]=candidate;
 }
 this.config={...config};
}
makePaper(seed){const c=document.createElement('canvas');c.width=W;c.height=H;const p=c.getContext('2d'),r=randomFrom(seed+'paper');p.fillStyle=PAPER;p.fillRect(0,0,W,H);const tint=p.createLinearGradient(0,0,W,H);tint.addColorStop(0,'#ac803810');tint.addColorStop(.5,'#ffffff08');tint.addColorStop(1,'#9a723516');p.fillStyle=tint;p.fillRect(0,0,W,H);for(let i=0;i<85000;i++){p.globalAlpha=.018+r()*.045;p.fillStyle=i%3?'#7e693c':'#ffffff';p.fillRect(r()*W,r()*H,.4+r()*1.7,.4+r()*.9)}p.globalAlpha=1;return c}
outline(ctx,points,extra=0){ctx.beginPath();for(let i=0;i<points.length;i++){const q=points[i],rad=q.radius+extra;i?ctx.lineTo(q.x+q.nx*rad,q.y+q.ny*rad):ctx.moveTo(q.x+q.nx*rad,q.y+q.ny*rad)}for(let i=points.length-1;i>=0;i--){const q=points[i],rad=q.radius+extra;ctx.lineTo(q.x-q.nx*rad,q.y-q.ny*rad)}ctx.closePath()}
stroke(ctx,s,fraction=1){if(s.skip)return;const n=Math.max(0,Math.floor(s.points.length*clamp(fraction,0,1)));if(n<2)return;const points=s.points.slice(0,n);ctx.save();this.outline(ctx,points,.5);ctx.globalAlpha=.13;ctx.fillStyle='#373025';ctx.fill();this.outline(ctx,points);ctx.globalAlpha=.94;ctx.fillStyle=s.join?'#40392a':'#26231c';ctx.fill();this.outline(ctx,points);ctx.clip();
for(let strand=0;strand<5;strand++){const offset=-.74+strand*.37;ctx.beginPath();let down=false;for(let i=0;i<points.length;i++){const q=points[i],dryness=1-q.wet;const threshold=Math.sin(i*.14+s.phase+strand*1.8)*.5+.5;const exposed=threshold<dryness*.57&&q.radius>1.3;if(exposed){const x=q.x+q.nx*q.radius*offset,y=q.y+q.ny*q.radius*offset;if(down)ctx.lineTo(x,y);else ctx.moveTo(x,y);down=true}else down=false}ctx.globalAlpha=.78;ctx.lineWidth=.52*(1+.2*Math.sin(strand));ctx.strokeStyle=PAPER;ctx.stroke()}
ctx.restore()}
seal(ctx){ctx.save();ctx.translate(144,804);ctx.rotate(-.025);ctx.fillStyle='#a34230';ctx.globalAlpha=.88;ctx.fillRect(-22,-22,44,44);ctx.strokeStyle=PAPER;ctx.lineWidth=1.6;ctx.strokeRect(-18,-18,36,36);ctx.font="18px 'Songti TC',serif";ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=PAPER;ctx.fillText('風',0,0);const r=randomFrom(this.config.seed+'seal');ctx.globalAlpha=.65;for(let i=0;i<75;i++)ctx.fillRect(-22+r()*44,-22+r()*44,.6+r()*1.5,.6+r()*1.5);ctx.restore()}
draw(target,t=this.total){const ctx=target.getContext('2d');ctx.setTransform(target.width/W,0,0,target.width/W,0,0);ctx.clearRect(0,0,W,H);ctx.drawImage(this.paper,0,0);for(const stroke of this.strokes){if(t<=stroke.start)break;this.stroke(ctx,stroke,(t-stroke.start)/stroke.duration)}if(t>=this.total*.98)this.seal(ctx)}
}
window.CursiveBrush=CursiveBrush;
})();
