export const HEROES = [
 {id:'beef',name:'巨无霸',title:'重装队长',color:'#efb544',hp:160,speed:250,damage:24,rate:.25,skill:'双层堡垒',detail:'高生命 · 重型芝士弹',skillText:'展开护盾并发动穿透齐射'},
 {id:'spicy',name:'麦辣鸡腿堡',title:'烈焰先锋',color:'#f06942',hp:110,speed:290,damage:16,rate:.14,skill:'辣焰风暴',detail:'高射速 · 灼烧弹幕',skillText:'释放覆盖前方的辣椒弹幕'},
 {id:'fish',name:'麦香鱼',title:'深海游侠',color:'#6bcbb7',hp:100,speed:330,damage:20,rate:.22,skill:'潮汐跃迁',detail:'高机动 · 二段跳',skillText:'全屏潮汐冲击并短暂无敌'},
 {id:'chicken',name:'麦香鸡',title:'酥脆工程师',color:'#c5a6ed',hp:125,speed:275,damage:19,rate:.23,skill:'脆皮无人机',detail:'均衡 · 自动追击',skillText:'召唤自动锁敌的脆皮无人机'}
];
export const STAGES = [
 {id:1,name:'落日薯条街',en:'SUNSET STRIP',tag:'街区 / 突围',color:'#e8a454',sky:['#344c67','#f6ac6a'],boss:'暴走油锅蟹',bossHp:850,drop:'薯条散射器',dropText:'普通射击新增两枚斜向薯条弹',width:4400},
 {id:2,name:'极冻配送站',en:'DEEP FREEZE',tag:'冷库 / 渗透',color:'#6fd0d0',sky:['#173849','#4f9caa'],boss:'冰霜奶昔机甲',bossHp:1150,drop:'蛋挞护盾',dropText:'每 10 秒获得一次免伤护盾',width:4800},
 {id:3,name:'午夜熔炉核心',en:'MIDNIGHT CORE',tag:'厨房 / 决战',color:'#dd78ab',sky:['#251b40','#9a466b'],boss:'黑椒熔炉暴君',bossHp:1600,drop:'金拱门核心',dropText:'通关纪念：恢复城市的美味能量',width:5200}
];
export const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export function platformsFor(stage){
 const p=[{x:0,y:470,w:stage.width,h:90,ground:true}];
 for(let x=480,i=0;x<stage.width-900;x+=560,i++) {p.push({x,y:350-(i%2)*55,w:180,h:22}); if(i%2===0)p.push({x:x+240,y:265,w:130,h:20});}
 return p;
}
export function moveBody(body,dt,platforms){
 const oldBottom=body.y+body.h;
 body.x+=body.vx*dt;body.vy+=1500*dt;body.y+=body.vy*dt;body.grounded=false;
 if(body.vy>=0)for(const p of platforms){if(body.x+body.w>p.x&&body.x<p.x+p.w&&oldBottom<=p.y+1&&body.y+body.h>=p.y){body.y=p.y-body.h;body.vy=0;body.grounded=true;break;}}
}
export function createRun(heroIndex=0,stageIndex=0,inventory=[]){
 const hero=HEROES[heroIndex],stage=STAGES[stageIndex];
 const enemies=[];
 for(let x=720,i=0;x<stage.width-850;x+=300,i++)enemies.push({x,y:i%3===2?260:426,w:42,h:44,hp:55+stageIndex*15,maxHp:55+stageIndex*15,type:i%3,baseX:x,phase:i,shot:1+i%3,dead:false});
 return {heroIndex,hero,stageIndex,stage,inventory:[...inventory],player:{x:80,y:390,w:48,h:68,vx:0,vy:0,grounded:false,coyote:0,jumpBuffer:0,hp:hero.hp,facing:1,jumps:0,inv:0,shield:0},platforms:platformsFor(stage),enemies,bullets:[],hostile:[],particles:[],coins:[],time:0,score:0,camera:0,shootCd:0,skillCd:0,drone:0,droneCd:0,boss:null,bossDead:false,drop:null,status:'playing',message:'向右突围，找到失控的能量核心',messageTime:4};
}
export function damagePlayer(run,amount){
 const p=run.player;if(p.inv>0||run.status!=='playing')return false;
 if(p.shield>0){p.shield=0;p.inv=.7;return false;}
 p.hp=Math.max(0,p.hp-amount);p.inv=1.1;if(p.hp===0)run.status='dead';return true;
}
export function claimDrop(run){
 if(!run.drop||run.status!=='playing')return false;
 if(!run.inventory.includes(run.stage.id))run.inventory.push(run.stage.id);
 run.drop=null;run.status='clear';return true;
}
