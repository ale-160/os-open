import {HEROES,STAGES,createRun,moveBody,overlap,damagePlayer,claimDrop} from './engine.mjs';
const ASSET_BASE='https://public.ale160.com/burger/assets',ASSET_VERSION='20261026b',assetUrl=f=>`${ASSET_BASE}/${f}?v=${ASSET_VERSION}`;
const $=id=>document.getElementById(id), W=1100,H=560;
const ctx=$('game').getContext('2d'), preview=$('preview').getContext('2d');
const keys=new Set(),pressed=new Set(),backgrounds=STAGES.map((s,i)=>{const im=new Image();im.src=assetUrl(`stage-${i+1}.webp`);return im;});
let selected=0,run=null,mode='lobby',last=0,sound=false,audio=null,unlocked=0,shake=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{unlocked=Math.min(2,Math.max(0,Number(JSON.parse(localStorage.getItem('burger-commando-save'))?.unlocked)||0));}catch{}
function beep(freq=400,length=.05,type='square',volume=.025){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+length);}catch{}}
function rounded(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function text(c,t,x,y,size=14,color='#fff',align='left',weight=600){c.fillStyle=color;c.font=`${weight} ${size}px "Segoe UI","Microsoft YaHei",sans-serif`;c.textAlign=align;c.fillText(t,x,y);}
function burger(c,x,y,scale,hero=HEROES[0],t=0,face=1,walk=false,inv=false){
 c.save();c.translate(x,y);c.scale(scale*face,scale);if(inv)c.globalAlpha=.55+Math.sin(t*35)*.3;
 const swing=walk?Math.sin(t*17)*8:0;
 ellipse(c,0,36,32,6,'#10141e50');
 rounded(c,-20,20+swing,16,16,5,'#332b35','#171923');rounded(c,4,20-swing,16,16,5,'#332b35','#171923');
 rounded(c,-40,-1,14,29,6,hero.color,'#272333');rounded(c,27,-4,14,23,6,hero.color,'#272333');
 rounded(c,-32,-4,64,32,11,'#d88b3d','#272333');
 rounded(c,-34,0,68,11,5,hero.id==='fish'?'#e6bf6b':hero.id==='spicy'?'#a14d32':'#6c3c2c','#272333');
 rounded(c,-34,-8,68,10,3,'#f5cd5e','#272333');
 c.fillStyle='#86a54d';c.beginPath();c.moveTo(-35,-12);for(let i=0;i<8;i++)c.lineTo(-35+i*10,-6-(i%2)*6);c.lineTo(35,-18);c.closePath();c.fill();
 c.fillStyle='#e7a24c';c.strokeStyle='#272333';c.lineWidth=2.5;c.beginPath();c.moveTo(-35,-15);c.bezierCurveTo(-36,-54,36,-54,35,-15);c.closePath();c.fill();c.stroke();
 c.fillStyle='#ffdc8b';for(let i=0;i<8;i++){c.save();c.translate(-23+(i%4)*15,-24-Math.floor(i/4)*11);c.rotate(i*.6);c.fillRect(-2,-1,5,2);c.restore();}
 rounded(c,-33,-20,66,9,3,hero.color);c.fillStyle=hero.color;c.beginPath();c.moveTo(-29,-17);c.lineTo(-47,-27);c.lineTo(-44,-13);c.fill();
 rounded(c,-16,-11,11,16,4,'#fff5dc');rounded(c,9,-11,11,16,4,'#fff5dc');rounded(c,-10,-8,5,10,2,'#242333');rounded(c,15,-8,5,10,2,'#242333');
 rounded(c,26,6,37,12,3,'#414752','#171923');rounded(c,53,4,16,16,2,hero.color,'#171923');rounded(c,32,16,10,10,2,'#31333e');
 if(hero.id==='beef'){rounded(c,-24,11,45,6,2,'#f3d27b');}
 if(hero.id==='fish'){c.strokeStyle='#9ae0d4';c.lineWidth=3;c.beginPath();c.arc(0,-3,26,Math.PI,Math.PI*2);c.stroke();}
 if(hero.id==='chicken'){rounded(c,-25,3,12,14,3,'#cab0ef');}
 c.restore();
}
function fries(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);for(let i=0;i<5;i++)rounded(c,-16+i*7,-33-(i%2)*6,5,35,1,'#ffce65','#a57630');c.fillStyle='#e4624c';c.beginPath();c.moveTo(-22,-10);c.lineTo(22,-10);c.lineTo(16,24);c.lineTo(-16,24);c.closePath();c.fill();text(c,'F',0,15,21,'#ffe4a1','center',900);c.restore();}
function enemy(c,e,t){c.save();c.translate(e.x+e.w/2,e.y+e.h/2);const bounce=Math.sin(t*6+e.phase)*2;
 if(e.type===2){c.translate(0,bounce);ellipse(c,0,-3,22,16,'#9e77c3');c.fillStyle='#665483';c.beginPath();c.moveTo(-28,-2);c.lineTo(-40,-13);c.lineTo(-34,10);c.fill();rounded(c,-12,12,24,8,3,'#725792');}
 else {rounded(c,-21,-22+bounce,42,40,10,e.type===1?'#c3bd88':'#a8b46c','#27303a');for(let i=0;i<3;i++){c.strokeStyle=e.type===1?'#9a9261':'#6e8d50';c.beginPath();c.moveTo(-15+i*14,-18);c.lineTo(-15+i*14,12);c.stroke();}rounded(c,-24,13,15,9,3,'#29303d');rounded(c,9,13,15,9,3,'#29303d');}
 rounded(c,-12,-7,8,11,2,'#faf0c4');rounded(c,6,-7,8,11,2,'#faf0c4');rounded(c,-11,-5,4,6,1,'#292435');rounded(c,7,-5,4,6,1,'#292435');c.strokeStyle='#292435';c.lineWidth=3;c.beginPath();c.moveTo(-14,-12);c.lineTo(-4,-8);c.moveTo(15,-12);c.lineTo(4,-8);c.stroke();if(e.type===1)rounded(c,14,1,24,11,3,'#706f69','#252c32');c.restore();}
function bossDraw(c,b,t,stageIndex){c.save();c.translate(b.x+b.w/2,b.y+b.h/2);const color=['#c26a45','#83c8cb','#a05e95'][stageIndex];
 if(stageIndex===0){for(let side of [-1,1]){c.strokeStyle='#d98c4d';c.lineWidth=12;for(let i=0;i<3;i++){c.beginPath();c.moveTo(side*50,15+i*9);c.lineTo(side*(88+i*9),42+i*5);c.lineTo(side*(102+i*8),72);c.stroke();}rounded(c,side*100-15,-50+Math.sin(t*4)*7,34,56,12,color,'#2e2734');}rounded(c,-65,-47,130,100,20,color,'#2e2734');rounded(c,-70,-51,140,22,5,'#e3a15d','#2e2734');for(let i=0;i<6;i++)rounded(c,-50+i*19,-44,6,11,2,'#ffcb73');}
 else if(stageIndex===1){rounded(c,-59,-60,118,126,16,color,'#273744');rounded(c,-70,-72,140,24,6,'#c7e9d9','#273744');rounded(c,-48,65,32,18,5,'#437a8e');rounded(c,20,65,32,18,5,'#437a8e');rounded(c,-85,-25,25,72,8,'#89bfca','#273744');rounded(c,60,-25,25,72,8,'#89bfca','#273744');rounded(c,-28,20,56,30,4,'#324a61');text(c,'ICE',0,41,16,'#a4edee','center');}
 else{rounded(c,-72,-65,144,140,18,color,'#2b213a');rounded(c,-60,-91,35,35,4,'#444052');rounded(c,25,-91,35,35,4,'#444052');rounded(c,-48,8,96,50,10,'#342235','#201b30');for(let i=0;i<5;i++)rounded(c,-36+i*16,16,8,32,2,'#f69b5e');rounded(c,-99,-20,29,90,8,color,'#2b213a');rounded(c,70,-20,29,90,8,color,'#2b213a');}
 rounded(c,-38,-27,28,26,5,'#fff0bf');rounded(c,12,-27,28,26,5,'#fff0bf');rounded(c,-22,-22,9,18,2,'#302333');rounded(c,16,-22,9,18,2,'#302333');c.strokeStyle='#33223b';c.lineWidth=7;c.beginPath();c.moveTo(-42,-38);c.lineTo(-9,-28);c.moveTo(43,-38);c.lineTo(10,-28);c.stroke();c.restore();}
function scenery(c,stage,camera,t,image=true){
 const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,stage.sky[0]);g.addColorStop(1,stage.sky[1]);c.fillStyle=g;c.fillRect(0,0,W,H);
 const im=backgrounds[stage.id-1];if(image&&im.complete&&im.naturalWidth){const ih=H,iw=im.width/im.height*ih;const offset=(camera*.12)%iw;c.drawImage(im,-offset,0,iw,ih);c.drawImage(im,iw-offset,0,iw,ih);c.fillStyle='#19202a30';c.fillRect(0,0,W,H);}
 else{ellipse(c,850-camera*.06,110,70,70,stage.id===1?'#ffd39a':'#b5dcce50');
 for(let i=-1;i<10;i++){const x=i*170-(camera*.22)%170;const h=120+(Math.sin(i*8.3)+1)*75;rounded(c,x,400-h,145,h,4,stage.id===1?'#4e5265':'#243c52');for(let j=0;j<4;j++)for(let k=0;k<3;k++)rounded(c,x+18+j*31,418-h+k*33,13,18,1,stage.id===1?'#c28b72':'#68a0ab60');}
 }
 for(let i=-1;i<8;i++){const x=i*290-(camera*.52)%290;rounded(c,x,310,230,160,5,stage.id===1?'#624d50':stage.id===2?'#31566a':'#4b3757','#293141');rounded(c,x+10,325,210,22,3,stage.color);for(let j=0;j<3;j++)rounded(c,x+17+j*67,365,54,82,3,'#293747','#baaa8c55');if(stage.id===1){c.fillStyle='#c26b50';c.beginPath();c.moveTo(x,344);c.lineTo(x+230,344);c.lineTo(x+245,367);c.lineTo(x-15,367);c.fill();for(let j=0;j<7;j++)rounded(c,x+j*34,344,16,23,0,'#e6b780');}else for(let j=0;j<3;j++)rounded(c,x+28+j*60,282,14,28,2,'#7a8d93');}
 c.fillStyle='#17202a44';c.fillRect(0,0,W,H);c.fillStyle='#33333d';c.fillRect(0,470,W,90);c.fillStyle=stage.color;c.fillRect(0,470,W,5);c.fillStyle='#181e2c';c.fillRect(0,476,W,9);
 for(let x=-camera%100;x<W;x+=100){c.fillStyle='#45434a';c.fillRect(x,515,60,4);}
}
function burst(x,y,color,n=10){for(let i=0;i<n;i++)run.particles.push({x,y,vx:(Math.random()-.5)*240,vy:(Math.random()-.8)*220,life:.35+Math.random()*.3,max:.6,color,size:2+Math.random()*4});}
function shoot(){const r=run,p=r.player;if(r.shootCd>0)return;r.shootCd=r.hero.rate;const spread=r.inventory.includes(1)?[-.17,0,.17]:[0];for(const a of spread)r.bullets.push({x:p.x+p.w/2+p.facing*36,y:p.y+31,w:18,h:7,vx:p.facing*730,vy:Math.sin(a)*730,damage:r.hero.damage,life:1.55,color:r.hero.color});beep(330+Math.random()*120,.035,'square',.012);}
function skill(){const r=run,p=r.player;if(r.skillCd>0)return;r.skillCd=8;r.message=r.hero.skill;r.messageTime=1.7;beep(680,.2,'sawtooth',.035);if(r.hero.id==='beef'){p.inv=2.5;p.shield=1;for(let i=0;i<9;i++)r.bullets.push({x:p.x+25,y:p.y+20,w:30,h:12,vx:p.facing*(600+i*35),vy:(i-4)*55,damage:40,life:2,color:'#ffe19b',pierce:true});}else if(r.hero.id==='spicy'){for(let i=0;i<15;i++){const a=(i-7)*.1;r.bullets.push({x:p.x+25,y:p.y+25,w:22,h:10,vx:p.facing*Math.cos(a)*680,vy:Math.sin(a)*680,damage:35,life:1.6,color:'#ff8b55'});}}else if(r.hero.id==='fish'){p.inv=2;for(const e of r.enemies)if(!e.dead&&Math.abs(e.x-p.x)<650){e.hp-=100;burst(e.x,e.y,'#9aede0');}if(r.boss)r.boss.hp-=140;burst(p.x,p.y,'#8ff4e4',35);}else{r.drone=7;r.droneCd=0;}}
function enemyShot(x,y,speed=220,angle=null){const p=run.player,a=angle??Math.atan2(p.y+30-y,p.x+24-x);run.hostile.push({x,y,w:13,h:13,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:5});}
function bossUpdate(dt){const r=run,b=r.boss;if(!b||b.hp<=0)return;
 b.timer+=dt;b.y=300+Math.sin(r.time*2)*7;
 if(b.timer>b.interval-.7)b.warning=true;
 if(b.timer>b.interval){b.timer=0;b.warning=false;b.cycle++;const dx=r.player.x-b.x;
 if(r.stageIndex===0){for(let i=-1;i<=1;i++)enemyShot(b.x,b.y+55,250,Math.PI+i*.22);if(b.cycle%2===0)enemyShot(b.x,b.y+120,310,Math.PI);}
 else if(r.stageIndex===1){for(let i=-2;i<=2;i++)enemyShot(b.x,b.y+60,220,Math.PI+i*.23);if(b.cycle%3===0)for(let i=0;i<5;i++)run.hostile.push({x:b.x-200-i*150,y:90,w:18,h:24,vx:0,vy:210,life:4});}
 else{for(let i=-3;i<=3;i++)enemyShot(b.x,b.y+55,270,Math.PI+i*.18);if(b.cycle%2===0){r.hostile.push({x:b.x-20,y:446,w:52,h:22,vx:-320,vy:0,life:5});}}
 beep(120,.18,'sawtooth',.025);
 }
 if(overlap(r.player,b))damagePlayer(r,22);
}
function update(dt){const r=run,p=r.player;r.time+=dt;r.shootCd=Math.max(0,r.shootCd-dt);r.skillCd=Math.max(0,r.skillCd-dt);p.inv=Math.max(0,p.inv-dt);r.messageTime=Math.max(0,r.messageTime-dt);shake=Math.max(0,shake-dt*22);
 if(r.inventory.includes(2)&&Math.floor(r.time/10)>Math.floor((r.time-dt)/10))p.shield=1;
 const left=keys.has('KeyA')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight');p.vx=(right?1:0)*r.hero.speed-(left?1:0)*r.hero.speed;if(p.vx)p.facing=Math.sign(p.vx);
 p.coyote=p.grounded?.1:Math.max(0,p.coyote-dt);p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);
 if(pressed.has('Space')||pressed.has('KeyW')||pressed.has('ArrowUp'))p.jumpBuffer=.12;
 if(p.jumpBuffer>0&&(p.coyote>0||(r.hero.id==='fish'&&p.jumps<2))){p.vy=-590;p.jumps++;p.grounded=false;p.coyote=0;p.jumpBuffer=0;beep(480,.07,'sine');}
 if(keys.has('KeyJ'))shoot();if(pressed.has('KeyK'))skill();
 moveBody(p,dt,r.platforms);if(p.grounded)p.jumps=0;
 const min=r.boss&&!r.bossDead?r.stage.width-1050:0;p.x=Math.max(min,Math.min(r.stage.width-p.w,p.x));
 for(const e of r.enemies){if(e.dead)continue;if(e.hp<=0){e.dead=true;r.score+=100;burst(e.x+20,e.y+15,'#f6ce75',15);r.coins.push({x:e.x,y:e.y,w:18,h:18});beep(180,.05);continue;}if(Math.abs(e.x-p.x)>900)continue;
 if(e.type===0)e.x+=Math.sign(p.x-e.x)*55*dt;else if(e.type===2){e.x=e.baseX+Math.sin(r.time*1.5+e.phase)*85;e.y=260+Math.sin(r.time*2+e.phase)*40;}
 e.shot-=dt;if(e.shot<0&&Math.abs(e.x-p.x)<650){if(e.type>0)enemyShot(e.x,e.y+20,175+r.stageIndex*20);e.shot=2.1+r.stageIndex*-.2;}
 if(overlap(p,e)&&damagePlayer(r,14)){burst(p.x,p.y,'#f4876c');if(!reduced)shake=5;}}
 for(const b of r.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const e of r.enemies){if(!e.dead&&e.hp>0&&overlap(b,e)&&b.life>0){e.hp-=b.damage;b.life=0;burst(b.x,b.y,'#ffe6a0',4);}}
 if(r.boss&&r.boss.hp>0&&overlap(b,r.boss)&&b.life>0){r.boss.hp-=b.damage;b.life=0;burst(b.x,b.y,'#ffcf85',4);}}
 r.bullets=r.bullets.filter(b=>b.life>0);
 for(const b of r.hostile){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(overlap(p,b)&&b.life>0){if(damagePlayer(r,12+r.stageIndex*2)){burst(p.x,p.y,'#f4876c');if(!reduced)shake=6;}b.life=0;}}r.hostile=r.hostile.filter(b=>b.life>0);
 r.coins=r.coins.filter(c=>{if(overlap(p,c)){r.score+=25;p.hp=Math.min(r.hero.hp,p.hp+5);beep(820,.06,'sine');return false;}return true;});
 if(r.drone>0){r.drone-=dt;r.droneCd-=dt;const target=r.enemies.find(e=>!e.dead&&Math.abs(e.x-p.x)<700)??(r.boss?.hp>0?r.boss:null);if(target&&r.droneCd<=0){r.droneCd=.22;const x=p.x-35,y=p.y-36,a=Math.atan2(target.y+20-y,target.x+20-x);r.bullets.push({x,y,w:13,h:7,vx:Math.cos(a)*750,vy:Math.sin(a)*750,damage:22,life:1.5,color:'#d3b6ff'});}}
 if(!r.boss&&!r.bossDead&&p.x>r.stage.width-1050){r.boss={x:r.stage.width-320,y:300,w:160,h:170,hp:r.stage.bossHp,maxHp:r.stage.bossHp,timer:0,cycle:0,interval:2.1-r.stageIndex*.15,warning:false};r.message=`警报：${r.stage.boss}！`;r.messageTime=3;r.enemies.forEach(e=>{if(e.x<p.x-500)e.dead=true;});}
 bossUpdate(dt);
 if(r.boss&&r.boss.hp<=0&&!r.bossDead){r.bossDead=true;r.score+=1500;r.hostile=[];r.drop={x:r.boss.x+30,y:415,w:55,h:55};burst(r.boss.x+70,r.boss.y+60,r.stage.color,55);r.message=`靠近领取 ${r.stage.drop}`;r.messageTime=20;beep(900,.3,'triangle');}
 if(r.drop&&overlap({x:p.x-12,y:p.y-12,w:p.w+24,h:p.h+24},r.drop)){claimDrop(r);unlocked=Math.max(unlocked,Math.min(2,r.stageIndex+1));try{localStorage.setItem('burger-commando-save',JSON.stringify({unlocked}));}catch{}showEnd();}
 for(const q of r.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=450*dt;q.life-=dt;}r.particles=r.particles.filter(q=>q.life>0);
 r.camera=Math.max(0,Math.min(r.stage.width-W,p.x-W*.32));pressed.clear();
 if(r.status==='dead')showEnd();
}
function render(){const r=run,p=r.player;ctx.save();if(shake&&!reduced)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);scenery(ctx,r.stage,r.camera,r.time);
 ctx.save();ctx.translate(-r.camera,0);for(const pl of r.platforms){if(pl.ground)continue;rounded(ctx,pl.x,pl.y,pl.w,pl.h,4,'#665455','#232837');rounded(ctx,pl.x,pl.y,pl.w,5,2,r.stage.color);for(let i=0;i<pl.w;i+=30)rounded(ctx,pl.x+i+5,pl.y+8,17,5,1,'#312b3b');}
 for(const c of r.coins){ellipse(ctx,c.x+9,c.y+9+Math.sin(r.time*5)*4,9,10,'#ffd578');text(ctx,'+',c.x+9,c.y+14+Math.sin(r.time*5)*4,14,'#76542b','center');}
 for(const e of r.enemies)if(!e.dead&&Math.abs(e.x-r.camera)<W+100){enemy(ctx,e,r.time);if(e.hp<e.maxHp){rounded(ctx,e.x,e.y-10,e.w,4,2,'#212333');rounded(ctx,e.x,e.y-10,e.w*e.hp/e.maxHp,4,2,'#e8a369');}}
 if(r.boss&&!r.bossDead){bossDraw(ctx,r.boss,r.time,r.stageIndex);if(r.boss.warning){text(ctx,'!  攻击预警',r.boss.x+80,r.boss.y-45,16,'#ffb090','center',900);ctx.strokeStyle='#ff8b6c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.boss.x+80,r.boss.y+70,115,0,Math.PI*2);ctx.stroke();}}
 for(const b of r.bullets){rounded(ctx,b.x,b.y,b.w,b.h,3,b.color);ctx.fillStyle='#fff3cd';ctx.fillRect(b.x+3,b.y+2,8,2);}
 for(const b of r.hostile){ellipse(ctx,b.x+b.w/2,b.y+b.h/2,b.w/2+3,b.h/2+3,'#ff826c55');rounded(ctx,b.x,b.y,b.w,b.h,4,'#ff876b');}
 burger(ctx,p.x+24,p.y+37,.9,r.hero,r.time,p.facing,Math.abs(p.vx)>0,p.inv>0);
 if(p.shield>0){ctx.strokeStyle='#ffe8a5';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x+24,p.y+32,43,49,0,0,Math.PI*2);ctx.stroke();}
 if(r.drone>0){const dx=p.x-35,dy=p.y-36+Math.sin(r.time*6)*5;rounded(ctx,dx-13,dy-8,26,16,5,'#cdb4e9','#302b42');ctx.strokeStyle='#e5d6fa';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(dx-24,dy-13);ctx.lineTo(dx+24,dy-13);ctx.stroke();ellipse(ctx,dx+5,dy,4,4,'#34344d');}
 if(r.drop){const d=r.drop;ellipse(ctx,d.x+27,d.y+20,42+Math.sin(r.time*5)*4,42,'#ffdb7944');if(r.stageIndex===0)fries(ctx,d.x+27,d.y+22,.8);else{ellipse(ctx,d.x+27,d.y+22,25,19,'#c78e4a');ellipse(ctx,d.x+27,d.y+17,20,13,'#ffe5a1');if(r.stageIndex===2)text(ctx,'★',d.x+27,d.y+26,26,'#a75c32','center');}text(ctx,r.stage.drop,d.x+27,d.y-30,13,'#fff0ba','center');}
 for(const q of r.particles){ctx.globalAlpha=Math.max(0,q.life/q.max);ctx.fillStyle=q.color;ctx.fillRect(q.x,q.y,q.size,q.size);}ctx.globalAlpha=1;ctx.restore();ctx.restore();hud();}
function hud(){const r=run,p=r.player;rounded(ctx,20,18,245,72,8,'#171e2be6','#ffffff20');text(ctx,r.hero.name,34,42,15,'#fff2d8');text(ctx,`${Math.ceil(p.hp)} / ${r.hero.hp}`,250,42,12,'#ffc65b','right');rounded(ctx,34,53,216,10,4,'#41404b');rounded(ctx,34,53,216*p.hp/r.hero.hp,10,4,r.hero.color);text(ctx,r.skillCd>0?`绝技冷却 ${r.skillCd.toFixed(1)}s`:'K  绝技就绪',34,79,10,'#d0cfcd');text(ctx,`SCORE  ${String(r.score).padStart(6,'0')}`,W-25,35,15,'#fff1d5','right',800);text(ctx,`MISSION 0${r.stage.id}   /   ${Math.floor(r.time/60)}:${String(Math.floor(r.time%60)).padStart(2,'0')}`,W-25,57,11,'#e5d8c8','right');
 if(r.boss&&!r.bossDead){rounded(ctx,330,20,440,45,6,'#1c202ce8');text(ctx,r.stage.boss,550,38,12,'#ffe5d0','center');rounded(ctx,345,47,410,7,3,'#4a3d48');rounded(ctx,345,47,410*Math.max(0,r.boss.hp)/r.boss.maxHp,7,3,'#e87d6a');}
 else{rounded(ctx,400,27,300,4,2,'#ffffff30');rounded(ctx,400,27,300*Math.min(1,p.x/(r.stage.width-350)),4,2,r.stage.color);text(ctx,r.stage.en,550,49,10,'#fff1db','center');}
 if(r.messageTime>0){const msg=r.message;ctx.font='600 15px "Microsoft YaHei"';const width=Math.min(650,ctx.measureText(msg).width+45);rounded(ctx,(W-width)/2,105,width,38,6,'#17202cdd','#ffe5a333');text(ctx,msg,W/2,130,15,'#fff0cb','center');}
}
function setOverlay(tag,title,desc,action,fn){$('overlay-tag').textContent=tag;$('overlay-title').textContent=title;$('overlay-description').textContent=desc;$('overlay-action').textContent=action;$('overlay-action').onclick=fn;$('overlay').classList.remove('hidden');$('live-status').textContent=title;}
function pause(){if(mode!=='playing')return;mode='paused';keys.clear();pressed.clear();setOverlay('TAKE A BREATHER','补给时间',`当前分数 ${run.score} · 准备好就继续出发。`,'继续作战 →',resume);}
function resume(){if(mode!=='paused')return;mode='playing';$('overlay').classList.add('hidden');$('game').focus();last=performance.now();}
function showEnd(){if(mode!=='playing')return;mode='end';keys.clear();if(run.status==='dead'){setOverlay('MISSION FAILED','这口有点烫。','重新集结，保留已获得的配件，再挑战当前街区。','重新挑战 →',()=>startRun(run.stageIndex,run.inventory));}else if(run.stageIndex===2){setOverlay('ALL MISSIONS COMPLETE','美味，全部夺回！',`获得金拱门核心 · 总分 ${run.score}。四位英雄都值得再来一局。`,'返回英雄大厅 →',lobby);}else{setOverlay('MISSION COMPLETE',`${run.stage.drop} 到手！`,`${run.stage.dropText}。下一区域：${STAGES[run.stageIndex+1].name}`,'装备并前往下一关 →',()=>{const score=run.score;startRun(run.stageIndex+1,run.inventory);run.score=score;});}render();}
function startRun(stageIndex=0,inventory=[]){run=createRun(selected,stageIndex,inventory);mode='playing';$('lobby').classList.add('hidden');$('play').classList.remove('hidden');$('overlay').classList.add('hidden');$('mission-label').textContent=`MISSION 0${stageIndex+1} / ${run.stage.en}`;$('mission-name').textContent=run.stage.name;$('inventory-label').textContent=`配件：${inventory.length?inventory.map(i=>STAGES[i-1].drop).join(' + '):'尚未获得'}`;keys.clear();pressed.clear();$('game').focus();last=performance.now();}
function lobby(){mode='lobby';run=null;keys.clear();$('play').classList.add('hidden');$('lobby').classList.remove('hidden');$('continue').classList.toggle('hidden',!unlocked);drawPreview();}
function selectHero(i){selected=i;document.querySelectorAll('.hero-card').forEach((el,j)=>{el.classList.toggle('selected',i===j);el.setAttribute('aria-pressed',String(i===j));el.querySelector('.hero-check').textContent=i===j?'✓ 已选择':'';});$('selected-summary').innerHTML=`<b>${HEROES[i].name} / ${HEROES[i].title}</b><span>${HEROES[i].detail}</span>`;drawPreview();}
function setup(){HEROES.forEach((hero,i)=>{const b=document.createElement('button');b.className='hero-card';b.style.setProperty('--hero-color',hero.color);b.style.setProperty('--hero-tint',hero.color+'35');b.innerHTML=`<div class="hero-art"><span class="hero-index">0${i+1} / ${hero.id.toUpperCase()}</span><span class="hero-check"></span><canvas width="280" height="150" aria-hidden="true"></canvas></div><div class="hero-info"><span class="role">${hero.title}</span><h3>${hero.name}</h3><p>${hero.detail}</p><p>绝技 / ${hero.skill}</p><div class="stats" aria-label="生命 ${hero.hp}">${[0,1,2,3,4,5].map(n=>`<i class="${n<Math.round(hero.hp/28)?'filled':''}"></i>`).join('')}</div></div>`;b.onclick=()=>selectHero(i);$('heroes').append(b);const c=b.querySelector('canvas').getContext('2d');burger(c,137,91,1.3,hero);});
 STAGES.forEach((s,i)=>{const card=document.createElement('div');card.className='stage-card';card.style.setProperty('--stage-color',s.color);card.style.setProperty('--stage-image',`url('${assetUrl(`stage-${i+1}.webp`)}')`);card.innerHTML=`<span class="stage-number">0${i+1}</span><p class="eyebrow">0${i+1} / ${s.en}</p><h3>${s.name}</h3><p>Boss / ${s.boss}<br>战利品 / ${s.drop}</p>`;$('stages').append(card);});selectHero(0);$('continue').classList.toggle('hidden',!unlocked);
 $('start').onclick=()=>startRun();$('continue').onclick=()=>startRun(unlocked,Array.from({length:unlocked},(_,i)=>i+1));$('pause').onclick=()=>mode==='paused'?resume():pause();$('back').onclick=lobby;$('sound').onclick=()=>{sound=!sound;$('sound').textContent=`音效：${sound?'开':'关'}`;$('sound').setAttribute('aria-pressed',String(sound));beep();};$('help').onclick=()=>{pause();$('help-dialog').showModal();};$('close-help').onclick=()=>$('help-dialog').close();$('concept-toggle').onclick=()=>$('concepts').classList.toggle('hidden');
 document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(mode!=='playing')return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);pressed.add(b.dataset.key);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>keys.delete(b.dataset.key));});
}
function drawPreview(){const c=preview;c.save();c.scale(1,480/560);scenery(c,STAGES[0],280,0);fries(c,560,405,1.5);burger(c,375,425,1.7,HEROES[selected]);enemy(c,{x:735,y:410,w:42,h:44,type:0,phase:0},0);enemy(c,{x:865,y:385,w:42,h:44,type:1,phase:1},0);for(let i=0;i<3;i++)rounded(c,500+i*77,405-i*2,23,8,3,'#ffdb83');c.restore();}
window.addEventListener('keydown',e=>{if($('help-dialog').open)return;if(mode==='playing'||mode==='paused'){if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyD','KeyJ','KeyK','Escape','KeyP'].includes(e.code))e.preventDefault();if((e.code==='Escape'||e.code==='KeyP')&&!e.repeat){mode==='playing'?pause():resume();return;}if(mode==='playing'){if(!keys.has(e.code))pressed.add(e.code);keys.add(e.code);}}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
for(const im of backgrounds)im.onload=()=>{if(mode==='lobby')drawPreview();};
let accumulator=0;
function frame(now){const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;if(mode==='playing'){accumulator+=dt;while(accumulator>=1/60&&mode==='playing'){update(1/60);accumulator-=1/60;}render();}else accumulator=0;requestAnimationFrame(frame);}setup();requestAnimationFrame(frame);
// Read-only diagnostics used by the browser smoke test; no gameplay cheats.
window.burgerDiagnostics=()=>({mode,selected,unlocked,stage:run?.stage.id,status:run?.status,hp:run?.player.hp,x:run?.player.x,y:run?.player.y,score:run?.score,enemies:run?.enemies.filter(e=>!e.dead).length,inventory:run?.inventory,skillCd:run?.skillCd});
