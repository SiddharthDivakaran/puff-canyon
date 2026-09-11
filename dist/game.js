const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const LEVEL_GATES = 20, TOTAL_LEVELS = 100, GATE_WIDTH = 49, NEAR_MISS_PX = 8;
const courses=globalThis.PuffLevels;
let selectedStage=0, unlocked=1, crowns=[], ranked=false, rankedSession=null, rankResult=null, rankPosting=null, runStartStage=0;
try {const progress=JSON.parse(localStorage.getItem('puff-journey-v1')||'null');if(progress){unlocked=Math.max(1,Math.min(100,Math.floor(Number(progress.unlocked))||1));selectedStage=unlocked-1;crowns=(progress.crowns||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<100)}}catch{}
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let W=960, H=680, state='ready', held=false, y=340, vy=0, r=21, stretch=1;
let generatedGates=0, lastWind=0;
let gates=[], score=0, points=0, clock=0, spawn=0, last=0, acc=0, seed=1;
let sound=true, audio=null, particles=[], floating=[], diedAt=0;
let deathAge=0, burstKind=0, burstX=0, burstY=0, deathMessage=null;
let messageBag=[], effectBag=[], lastMessage=-1, lastEffect=-1;
let countdown=0, countdownTotal=1.5, shield=0, wind=0, revived=false, reviveUsed=false;
let runHelium=0, tripleUsed=false, runId=0, runCounted=false, completedRuns=0;
let activeSinceAd=0, adBusy=false, adController=null, adTimeout=null, adReturnState='over';
let bagData={balance:0,owned:['classic'],selected:'classic'}, best=0;
const skinPrices={classic:0,bubble:20,star:40,airship:60};
const skinNames={classic:'Classic',bubble:'Bubble',star:'Foil star',airship:'Hot air'};
try {
  best=Math.max(0,Number(localStorage.getItem('puff-ranked-best-v5'))||0);
  sound=localStorage.getItem('puff-sound')!=='false';
  const saved=JSON.parse(localStorage.getItem('puff-collection-v1')||'null');
  if(saved){bagData.balance=Math.max(0,Math.floor(Number(saved.balance)||0));bagData.owned=[...new Set(['classic',...(Array.isArray(saved.owned)?saved.owned:[]).filter(s=>s in skinPrices)])];bagData.selected=bagData.owned.includes(saved.selected)?saved.selected:'classic'}
} catch {}
const failures=[['Pop goes the Puff!','That gap was playing hard to get.'],['Air today. Gone tomorrow.','A little less puff next time?'],['Well, that escalated.','Up was good. Too much up was ambitious.'],['A tiny pop. A big dream.','Your next great flight is one tap away.'],['Puff has left the chat.','Rejoining in three… two…'],['Too fabulous to fit.','Try shrinking before the next squeeze.'],['Gravity: 1. Puff: 0.','Time for a rematch.'],['Unexpected confetti!','We meant to do that. Probably.'],['A brief air-ruption.','Keep the dream inflated.'],['One puff too far.','So close. Shall we go again?']];
function levelIndex(){return Math.min(99,Math.floor(score/LEVEL_GATES))}
function theme(){return courses.get(levelIndex()).palette}
function saveCollection(){try{localStorage.setItem('puff-collection-v1',JSON.stringify(bagData))}catch{}updateCollection()}
function updateCollection(){
  $('wallet').textContent=`◆ ${bagData.balance} helium`;
  document.querySelectorAll('[data-skin]').forEach(button=>{
    const skin=button.dataset.skin, owned=bagData.owned.includes(skin);
    button.textContent=`${skinNames[skin]} · ${skin===bagData.selected?'Equipped':owned?'Equip':skinPrices[skin]+' ◆'}`;
    button.setAttribute('aria-pressed',String(skin===bagData.selected));
    button.disabled=adBusy||(!owned&&bagData.balance<skinPrices[skin]);
  });
}
function buySkin(skin){
  if(adBusy||!['ready','over','complete'].includes(state)||!(skin in skinPrices))return false;
  if(!bagData.owned.includes(skin)){
    if(bagData.balance<skinPrices[skin])return false;
    bagData.balance-=skinPrices[skin];bagData.owned.push(skin);
  }
  bagData.selected=skin;saveCollection();$('shopNote').textContent=`${skinNames[skin]} equipped. Your flight physics stay the same.`;tone(740);return true;
}
function rand(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}
function pickBag(kind,total){
  let bag=kind==='message'?messageBag:effectBag;
  if(!bag.length){
    bag=Array.from({length:total},(_,i)=>i);
    for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]]}
    const previous=kind==='message'?lastMessage:lastEffect;
    if(total>1&&bag.at(-1)===previous)[bag[0],bag[total-1]]=[bag[total-1],bag[0]];
    if(kind==='message')messageBag=bag;else effectBag=bag;
  }
  const chosen=bag.pop();if(kind==='message')lastMessage=chosen;else lastEffect=chosen;return chosen;
}
function audioContext(){
  if(!sound)return null;
  try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});return audio}catch{return null}
}
function tone(freq,dur=.1,delay=0){
  const a=audioContext();if(!a)return;
  try{const start=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.17,start);g.gain.exponentialRampToValueAtTime(.001,start+dur);o.connect(g);g.connect(a.destination);o.start(start);o.stop(start+dur)}catch{}
}
function melody(notes){notes.forEach((n,i)=>tone(n,.16,i*.09))}
function burstSound(){
  const a=audioContext();if(!a)return;
  try{
    const length=Math.floor(a.sampleRate*.14),buffer=a.createBuffer(1,length,a.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3);
    const source=a.createBufferSource(),gain=a.createGain();source.buffer=buffer;gain.gain.setValueAtTime(.4,a.currentTime);source.connect(gain);gain.connect(a.destination);source.start();
    const o=a.createOscillator(),g=a.createGain();o.frequency.setValueAtTime(350,a.currentTime);o.frequency.exponentialRampToValueAtTime(60,a.currentTime+.15);g.gain.setValueAtTime(.16,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.16);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.16);
  }catch{tone(120,.15)}
}
function soundLabel(){$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-label',sound?'Disable sound':'Enable sound');$('sound').setAttribute('aria-pressed',String(sound))}
function updateHud(){
  document.documentElement.style.setProperty('--accent',theme().accent);$('world').textContent=challengeLabel();
  $('score').textContent=String(score-runStartStage*20).padStart(2,'0');$('best').textContent=String(best).padStart(2,'0');
  $('level').textContent='LEVEL '+String(levelIndex()+1).padStart(2,'0')+' / 100';
  $('dots').textContent=`${score===2000?20:score%LEVEL_GATES} / ${LEVEL_GATES} gates`;
  $('points').textContent=`${points} points${ranked?' · ranked':revived?' · assisted':''}`;
  $('difficulty').textContent=`${['Breezy','Playful','Brisk','Wild','Expert'][courses.get(levelIndex()).rating-1]} ${'◆'.repeat(courses.get(levelIndex()).rating)}`;
  $('levelProgress').value=score===2000?20:score%20;
  $('journeyProgress').textContent=`${crowns.length} / 100 cleared`; $('runHelium').textContent=`◆ ${runHelium} helium`;
}
function resize(){
  const box=canvas.getBoundingClientRect(),oldW=W;W=H*box.width/box.height;
  const shift=(W-oldW)*.26;gates.forEach(g=>g.x+=shift);
  const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(box.width*d);canvas.height=Math.round(box.height*d);
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  if(state==='playing'||state==='countdown')pause();
}
function show(title,message,button,pill){
  $('title').textContent=title;$('message').textContent=message;$('start').textContent=button+' ↗';$('pill').textContent=pill;
  $('overlay').hidden=false;$('rewards').hidden=true;$('wardrobe').hidden=!['over','ready','complete'].includes(state);$('rankedStart').hidden=!['over','ready','complete'].includes(state);$('postStatus').hidden=!ranked||!['over','complete'].includes(state);$('rankedHint').hidden=!['over','ready','complete'].includes(state);$('postRetry').hidden=true;
}
function adAvailable(kind){try{return window.PuffAds?.isAvailable(kind)===true}catch{return false}}
function updateRewards(){
  const showRewards=state==='over';$('rewards').hidden=!showRewards;
  $('revive').disabled=adBusy||ranked||reviveUsed||!adAvailable('revive');
  $('triple').disabled=adBusy||tripleUsed||runHelium===0||!adAvailable('helium');
  $('revive').textContent=ranked?'No revives in ranked flight':reviveUsed?'Second chance used':'Inflate & Resume (Ad)';
  $('triple').textContent=tripleUsed?'Helium tripled':'Watch Ad to 3× Helium';
  $('rewardNote').textContent=(!adAvailable('revive')&&!adAvailable('helium'))?'Rewarded ads are unavailable right now. Fly again for free.':`One revive and one helium bonus per run. ${runHelium} helium collected.`;
}
function showResults(){
  state='over';show(deathMessage.title,`${score-runStartStage*20} gates · ${points} points · ${runHelium} helium. ${deathMessage.text}`,'Fly again',deathMessage.pill);
  updateRewards();updateCollection();
  if(ranked)postRankedScore();
}

function start(stage=selectedStage,isRanked=false){
  if(adBusy)return;
  ranked=isRanked;runStartStage=ranked?0:Math.max(0,Math.min(unlocked-1,stage));rankResult=null;
  if(!ranked)rankedSession=null;
  $('postStatus').textContent='';$('postStatus').hidden=true;$('postRetry').hidden=true;$('rankedStart').hidden=true;$('rankedHint').hidden=true;
  runId++;state='playing';held=false;y=H/2;vy=0;r=21;stretch=1;score=runStartStage*20;points=0;clock=0;generatedGates=score;lastWind=0;gates=[];particles=[];floating=[];spawn=.65;
  deathMessage=null;reviveUsed=false;revived=false;tripleUsed=false;runHelium=0;runCounted=false;shield=0;wind=0;
  seed=7919+runStartStage*104729;acc=0;
  $('overlay').hidden=true;$('landingAd').hidden=true;$('wardrobe').hidden=true;$('pause').disabled=false;$('pause').textContent='Pause Ⅱ';
  $('status').textContent='Hold to rise · Release to fall';updateHud();tone(420);
}
function saveJourney(){try{localStorage.setItem('puff-journey-v1',JSON.stringify({unlocked,crowns}))}catch{}}
function levelBreak(){
  const cleared=Math.floor(score/20)-1;
  if(!crowns.includes(cleared))crowns.push(cleared);
  unlocked=Math.max(unlocked,Math.min(100,cleared+2));selectedStage=Math.min(99,cleared+1);saveJourney();
  state=score===2000?'complete':'level';held=false;vy=0;gates=[];spawn=.65;wind=0;lastWind=0;
  seed=7919+levelIndex()*104729;
  if(score===2000){
    if(ranked&&!revived&&score>best){best=score;try{localStorage.setItem('puff-ranked-best-v5',String(best))}catch{}}
    show('The sky is yours!',`100 levels conquered. ${points} points in this flight. Come back for a new record.`,'Fly again','A HUNDRED LITTLE VICTORIES');
    if(ranked)postRankedScore();
  }else{
    const next=courses.get(levelIndex()),d=difficulty();
    show(`Level ${cleared+1} cleared!`,`${next.palette.name} · ${next.title}. ${next.label}. ${Math.round(d.speed)} speed · ${Math.round(d.gap)} gap.`,'Next level',`NEXT: LEVEL ${next.number} / 100 · ${['BREEZY','PLAYFUL','BRISK','WILD','EXPERT'][next.rating-1]}`);
  }
  updateHud();$('pause').disabled=true;melody([523,659,784,1047]);
}
function continueFlight(seconds=1.5){state='countdown';held=false;countdown=countdownTotal=seconds;acc=0;$('overlay').hidden=true;$('wardrobe').hidden=true;$('pause').disabled=true}
function pause(){
  if(!['playing','countdown'].includes(state))return;
  state='paused';held=false;show('Take a breather.','Your flight is waiting exactly where you left it.','Keep flying','PAUSED');$('pause').disabled=false;$('pause').textContent='Resume ▷';
}
function floatText(text,x,yy,color='#fff3a4'){floating.push({text,x,y:yy,life:1.3,color})}
function die(){
  if(state!=='playing')return;
  state='burst';held=false;deathAge=0;burstX=W*.26;burstY=y;burstKind=pickBag('effect',4);diedAt=performance.now();
  const isBest=ranked&&!revived&&score>best;
  if(isBest){best=score;try{localStorage.setItem('puff-ranked-best-v5',String(best))}catch{}}
  const phrase=failures[pickBag('message',failures.length)];
  deathMessage={title:phrase[0],text:phrase[1],pill:revived?'ASSISTED FLIGHT':isBest?'NEW PERSONAL BEST!':'ONE MORE TRY?'};
  const colors=[theme().ball,theme().cap,theme().accent,'#ffffff','#ff65a8'];
  for(let i=0;i<(reduced?10:42);i++){const a=i/42*Math.PI*2,v=burstKind===2?140:110+Math.random()*190;particles.push({x:burstX,y:burstY,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(burstKind===1?150:0),life:1.4,color:colors[i%colors.length],angle:a,size:4+Math.random()*5})}
  burstSound();updateHud();$('pause').disabled=true;$('status').textContent=phrase[1];
}
async function runAd(kind){
  if(adBusy||!adAvailable(kind))return false;
  adBusy=true;adReturnState=state;state='ad';held=false;const originalRun=runId;
  $('start').disabled=true;$('cancelAd').hidden=false;$('rewards').hidden=true;$('wardrobe').hidden=true;
  $('title').textContent='Ad break';$('message').textContent='Your flight is paused. You can cancel if the ad does not load.';$('overlay').hidden=false;
  adController=new AbortController();const controller=adController;
  let result=false;
  try{
    const operation=kind==='interstitial'?window.PuffAds.showInterstitial({signal:controller.signal}):window.PuffAds.showRewarded(kind,{signal:controller.signal});
    const cancelled=new Promise(resolve=>controller.signal.addEventListener('abort',()=>resolve(null),{once:true}));
    adTimeout=setTimeout(()=>controller.abort(),45000);
    const response=await Promise.race([operation,cancelled]);
    result=!controller.signal.aborted&&originalRun===runId&&(kind==='interstitial'?response?.shown===true:response?.completed===true);
  }catch{}finally{
    clearTimeout(adTimeout);adController=null;adBusy=false;state=adReturnState;$('start').disabled=false;$('cancelAd').hidden=true;
  }
  if(result)activeSinceAd=0;return result;
}
function applyRevive(){
  if(ranked||reviveUsed||state!=='over')return false;
  reviveUsed=true;revived=true;held=false;vy=0;r=21;stretch=1;wind=0;particles=[];floating=[];
  const x=W*.26;
  // Move only upcoming obstacles; retain their sequence and earned score.
  gates=gates.filter(g=>!g.passed);const first=gates[0];
  if(first){const shift=Math.max(0,x+240-first.x);gates.forEach(g=>{g.x+=shift;g.closest=Infinity;g.shielded=false});y=first.center;}else y=H/2;
  y=Math.max(150,Math.min(H-120,y));spawn=Math.max(spawn,1.5);shield=2;
  continueFlight(3);updateHud();return true;
}
async function requestRevive(){
  if(ranked||state!=='over'||reviveUsed||adBusy)return;
  if(await runAd('revive'))applyRevive();else{showResults();$('rewardNote').textContent='Ad not completed or unavailable. Your second chance is still unused.'}
}
async function requestTriple(){
  if(state!=='over'||tripleUsed||runHelium===0||adBusy)return;
  if(await runAd('helium')){tripleUsed=true;bagData.balance+=runHelium*2;saveCollection();}
  showResults();if(tripleUsed)$('rewardNote').textContent=`${runHelium*3} helium banked from this run. Bonus claimed once.`;
}
async function primaryAction(){
  if(adBusy)return;
  audioContext();
  if(state==='paused'||state==='level'){continueFlight();$('pause').textContent='Pause Ⅱ';return}
  if(state==='over'||state==='complete'){
    if(!runCounted){completedRuns++;runCounted=true}
    if(completedRuns%5===0&&activeSinceAd>=180)await runAd('interstitial');
    if(ranked){await startRanked();return}
    start(state==='complete'?0:levelIndex());
  }else if(state==='ready')start();
}
function difficulty(stage=levelIndex(),ordinal=score%LEVEL_GATES+1){return courses.difficulty(stage,ordinal)}
function challengeLabel(){
  const c=courses.get(levelIndex());
  return `${c.palette.name} · ${c.title}`;
}
function addGate(){
  // Do not pre-generate next-level gates at the previous level's difficulty.
  if(score>=2000||generatedGates>=(levelIndex()+1)*LEVEL_GATES)return false;
  const stage=levelIndex(),ordinal=generatedGates%LEVEL_GATES+1,d=difficulty(stage,ordinal);
  const hazard=courses.hazard(stage,ordinal),moving=hazard.moving,windy=hazard.wind;
  const amplitude=moving?d.amplitude:0,margin=d.gap/2+amplitude+18;
  const low=82+margin,high=H-52-margin,mid=(low+high)/2;
  const range=Math.min(85,(high-low)/2),previous=gates.at(-1)?.base??mid;
  const course=courses.get(stage),pattern=course.pattern;
  const direction=course.world%2?-1:1;
  let target=mid+pattern[(ordinal-1+course.world)%pattern.length]*range*direction;
  target+=(rand()-.5)*12;
  const base=Math.max(low,Math.min(high,previous+Math.max(-95,Math.min(95,target-previous))));
  const g={x:W+50,base,center:base,gap:d.gap,phase:rand()*Math.PI*2,amplitude,
    frequency:d.frequency,stage,ordinal,passed:false,closest:Infinity,shielded:false};
  g.token=rand()<.65?{offset:(rand()<.5?-1:1)*(d.gap/2-42),taken:false}:null;
  g.wind=windy;
  g.windForce=d.windForce;g.windWidth=Math.min(245,190+stage*.5);
  generatedGates++;gates.push(g);return true;
}
function tick(dt){
  particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.angle+=dt*4;if(burstKind===1)p.vy+=400*dt}
  floating=floating.filter(f=>f.life>0);for(const f of floating){f.life-=dt;if(!reduced)f.y-=dt*28}
  if(state==='burst'){deathAge+=dt;if(deathAge>=(reduced?.2:.75))showResults();return}
  if(state==='countdown'){if(document.hidden)return;countdown-=dt;if(countdown<=0){state='playing';$('pause').disabled=false;tone(700)}return}
  if(state!=='playing')return;
  clock+=dt;activeSinceAd+=dt;shield=Math.max(0,shield-dt);
  const d=difficulty(),speed=d.speed,x=W*.26;
  spawn-=dt;if(spawn<=0){addGate();spawn=d.interval}
  for(const g of gates){g.x-=speed*dt;g.center=g.base+Math.sin(clock*(g.frequency??.9)+g.phase)*g.amplitude}
  const zone=gates.find(g=>g.wind&&x>g.x-(g.windWidth??190)-25&&x<g.x-25);wind=zone?zone.wind*(zone.windForce??150):0;
  if(wind&&wind!==lastWind)floatText(wind<0?'↑ UPDRAFT':'↓ DOWNDRAFT',W/2,165,'#a4fcff');lastWind=wind;
  if(wind)$('status').textContent=wind<0?'↑ Updraft · release a little earlier':'↓ Downdraft · hold a little longer';
  else if(shield>0)$('status').textContent='Second chance shield · '+shield.toFixed(1)+'s';
  else $('status').textContent=courses.get(levelIndex()).label+' · Hold ↑ Release ↓';
  r+=((held?30:17)-r)*Math.min(1,dt*7);
  const desiredStretch=reduced?1:held?1.13:vy>30?.93:1;
  stretch+=(desiredStretch-stretch)*Math.min(1,dt*11);
  vy+=((held?-510:430)+wind)*dt;vy*=Math.exp(-1.8*dt);vy=Math.max(-190,Math.min(190,vy));y+=vy*dt;
  if(y-r<86||y+r>H-55){if(shield>0){y=Math.max(86+r,Math.min(H-55-r,y));vy=0}else{die();return}}
  for(const g of gates){
    const top=g.center-g.gap/2,bot=g.center+g.gap/2;
    // Match the pipe caps as well as the bodies in the collision geometry.
    const nearX=Math.max(g.x-4,Math.min(x,g.x+GATE_WIDTH+4)),dx=x-nearX;
    const collides=dx*dx+Math.max(0,y-top)**2<r*r||dx*dx+Math.max(0,bot-y)**2<r*r;
    if(collides&&shield<=0){die();return}
    if(x+r>g.x-4&&x-r<g.x+GATE_WIDTH+4){
      g.closest=Math.min(g.closest,y-r-top,bot-y-r);
      if(shield>0)g.shielded=true;
    }
    if(g.token&&!g.token.taken){
      const tx=g.x-65,ty=g.center+g.token.offset;
      if(Math.hypot(x-tx,y-ty)<r+8){g.token.taken=true;runHelium++;bagData.balance++;saveCollection();floatText('+1 helium',x,y-r-18);tone(1020,.07);updateHud()}
    }
    if(!g.passed&&g.x+GATE_WIDTH+4<x-r){
      g.passed=true;score++;points++;
      if(!g.shielded&&g.closest>=0&&g.closest<NEAR_MISS_PX){points+=2;floatText('+2 Close Shave!',x+25,y-r-24,theme().accent);melody([800,1040])}else tone(610);
      updateHud();if(score%LEVEL_GATES===0){levelBreak();return}
    }
  }
  gates=gates.filter(g=>g.x>-80);
}
function rect(x,yy,w,h,rad,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,yy,Math.max(0,w),Math.max(0,h),rad);ctx.fill()}
function drawBalloon(t,palette){
  const px=W*.26,py=state==='ready'?H*.63+(reduced?0:Math.sin(t/650)*12):y;
  ctx.save();ctx.translate(px,py);
  if(shield>0){ctx.strokeStyle='#b6ffff';ctx.lineWidth=3;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(0,0,r+12,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
  ctx.rotate(Math.max(-.18,Math.min(.18,vy/900)));ctx.scale(1/Math.sqrt(stretch),stretch);
  ctx.shadowBlur=reduced?0:22;ctx.shadowColor='#d2ff7845';
  const skin=bagData.selected,grad=ctx.createRadialGradient(-r*.35,-r*.4,1,0,0,r*1.2);
  grad.addColorStop(0,skin==='bubble'?'#f0ffff':skin==='star'?'#fffbe0':palette.shine);grad.addColorStop(1,skin==='bubble'?'#60cee5':skin==='star'?'#ffbf36':palette.ball);
  ctx.fillStyle=grad;ctx.beginPath();
  if(skin==='star'){
    for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.58:r*1.1;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();
  }else ctx.ellipse(0,0,r,r*1.06,0,0,Math.PI*2);
  ctx.fill();ctx.shadowBlur=0;
  if(skin==='bubble'){ctx.strokeStyle='#fff9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-2,-2,r*.78,3.7,5.3);ctx.stroke()}
  if(skin==='airship'){ctx.strokeStyle=palette.gate;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,r*.46,r,0,0,Math.PI*2);ctx.stroke();rect(-7,r+11,14,8,2,'#d89b60')}
  else {ctx.fillStyle=skin==='star'?'#ffd152':palette.ball;ctx.beginPath();ctx.moveTo(0,r);ctx.lineTo(-4,r+7);ctx.lineTo(4,r+7);ctx.fill()}
  ctx.strokeStyle='#d0e7b5';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(0,r+7);ctx.bezierCurveTo(-9,r+17,8,r+25,-2,r+36);ctx.stroke();
  ctx.fillStyle='#233c33';for(const xx of [-6,7]){ctx.beginPath();ctx.ellipse(xx,-1,2.1,3,0,0,Math.PI*2);ctx.fill()}
  ctx.strokeStyle='#233c33';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(1,4,4,0,Math.PI);ctx.stroke();ctx.restore();
}
function draw(t){
  ctx.clearRect(0,0,W,H);const palette=theme(),bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,palette.top);bg.addColorStop(1,palette.bottom);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;
  for(let x=-(clock*15)%60;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let yy=20;yy<H;yy+=60){ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(W,yy);ctx.stroke()}
  for(let i=0;i<25;i++){const px=((i*127.1-clock*16)%(W+60)+W+60)%(W+60)-30;ctx.fillStyle='#bfe6d533';ctx.beginPath();ctx.arc(px,110+(i*71)%470,i%3+1,0,Math.PI*2);ctx.fill()}
  rect(0,79,W,3,0,'#b0d5df55');rect(0,H-52,W,3,0,'#b0d5df55');
  for(const g of gates){
    if(g.wind){
      const width=g.windWidth??190,left=g.x-width-25,right=g.x-25;
      const active=W*.26>left&&W*.26<right;
      rect(left,91,width,H-148,9,active?'#76edff45':'#76edff25');
      ctx.save();ctx.beginPath();ctx.rect(left,91,width,H-148);ctx.clip();
      ctx.strokeStyle=active?'#bfffffcc':'#bfffff80';ctx.lineWidth=2;
      for(let col=0;col<4;col++)for(let j=0;j<8;j++){
        const xx=left+25+col*55,yy=100+((j*80+(reduced?0:clock*g.wind*95))%560+560)%560;
        ctx.beginPath();ctx.moveTo(xx,yy-g.wind*18);ctx.lineTo(xx,yy+g.wind*10);ctx.lineTo(xx-5,yy+g.wind*4);ctx.moveTo(xx,yy+g.wind*10);ctx.lineTo(xx+5,yy+g.wind*4);ctx.stroke();
      }
      ctx.restore();ctx.fillStyle='#eaffff';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillText(g.wind<0?'↑ UPDRAFT':'↓ DOWNDRAFT',(left+right)/2,118);
    }
    const top=g.center-g.gap/2,bot=g.center+g.gap/2;
    rect(g.x,82,GATE_WIDTH,top-82,9,palette.gate);rect(g.x,bot,GATE_WIDTH,H-52-bot,9,palette.gate);
    rect(g.x+8,89,5,top-100,3,'#ffffff55');rect(g.x+8,bot+10,5,H-74-bot,3,'#ffffff55');
    rect(g.x-4,top-17,GATE_WIDTH+8,17,5,palette.cap);rect(g.x-4,bot,GATE_WIDTH+8,17,5,palette.cap);
    if(g.amplitude){ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText('↕',g.x+24,top-29)}
    if(g.token&&!g.token.taken){
      const tx=g.x-65,ty=g.center+g.token.offset;
      ctx.save();ctx.translate(tx,ty);ctx.rotate(Math.PI/4);ctx.shadowBlur=reduced?0:14;ctx.shadowColor='#ffe169';ctx.fillStyle='#ffe169';ctx.fillRect(-6,-6,12,12);ctx.shadowBlur=0;ctx.fillStyle='#fffbdc';ctx.fillRect(-3,-3,4,4);ctx.restore();
    }
  }
  if(!['over','burst','ad'].includes(state))drawBalloon(t,palette);
  for(const p of particles){
    ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,p.life));ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=p.color;
    if(burstKind===0){ctx.beginPath();ctx.arc(0,0,p.size,0,Math.PI*2);ctx.fill()}
    else if(burstKind===3){ctx.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5,rr=j%2?p.size*.4:p.size;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();ctx.fill()}
    else ctx.fillRect(-p.size/2,-p.size/2,p.size,burstKind===1?p.size*2:p.size);ctx.restore();
  }
  if(state==='burst'&&burstKind===2&&!reduced){ctx.strokeStyle=palette.accent;ctx.lineWidth=5;ctx.globalAlpha=Math.max(0,1-deathAge);ctx.beginPath();ctx.arc(burstX,burstY,25+deathAge*180,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
  for(const f of floating){ctx.globalAlpha=Math.min(1,Math.max(0,f.life));ctx.fillStyle=f.color;ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.shadowColor='#10203d';ctx.shadowBlur=4;ctx.fillText(f.text,Math.max(85,Math.min(W-85,f.x)),Math.max(140,f.y));ctx.shadowBlur=0;ctx.globalAlpha=1}
  if(state==='countdown'){
    ctx.strokeStyle='#ffffff35';ctx.lineWidth=5;ctx.beginPath();ctx.arc(W/2,H/2,46,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=palette.accent;ctx.beginPath();ctx.arc(W/2,H/2,46,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,countdown/countdownTotal));ctx.stroke();
    ctx.fillStyle='#ffffff';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.fillText(String(Math.ceil(countdown)),W/2,H/2+13);
    ctx.font='14px sans-serif';ctx.fillText(shield>0?'Second chance · 2s shield':'Get ready',W/2,H/2+78);
  }
  if(state==='playing'&&clock<3){ctx.fillStyle='#ffffffd0';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText(held?'Release to shrink ↓':'Hold to rise ↑',W*.26,Math.min(H-90,y+r+65))}
}
async function api(path,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});
    if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('Leaderboard is not available on this copy of Puff. Use the public game link.');
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not reach the leaderboard.');return data;
  }finally{clearTimeout(timer)}
}
async function startRanked(){
  if(adBusy||!['ready','over','complete'].includes(state))return;
  const previous=state;state='connecting';$('start').disabled=true;$('rankedStart').disabled=true;
  $('message').textContent='Connecting your ranked flight…';
  try{
    const session=await api('/api/runs',{});rankedSession=session;start(0,true);
    $('status').textContent=`Flying as ${session.name}`;
    if(document.hidden)pause();
  }catch(error){
    state=previous;
    if(previous==='over')showResults();
    $('message').textContent=error.name==='AbortError'?'Connection timed out. Try ranked again or choose a journey level.':error.message;
  }finally{$('start').disabled=false;$('rankedStart').disabled=false}
}
async function postRankedScore(){
  if(!ranked||!rankedSession||revived||rankPosting===runId||rankResult?.saved)return;
  const activeRun=runId;
  if(score===0){$('postStatus').hidden=false;$('postStatus').textContent=`${rankedSession.name} · Clear a gate to join the board.`;return}
  rankPosting=activeRun;$('postStatus').hidden=false;$('postStatus').textContent='Saving your ranked flight…';$('postRetry').hidden=true;
  try{
    const result=await api('/api/scores',{token:rankedSession.token,gates:score,points,assisted:false});
    if(activeRun===runId){rankResult=result;$('postStatus').textContent=`Saved as ${rankedSession.name}. Open Leaderboard to compare flights.`}
  }catch{
    if(activeRun===runId){$('postStatus').textContent='Score upload failed. Your flight is here until you fly again.';$('postRetry').hidden=false}
  }finally{if(rankPosting===activeRun)rankPosting=null}
}
function renderWorld(){
  const world=Math.max(0,Math.min(9,Number($('worldSelect').value)||0));
  $('worldDescription').textContent=`${courses.worlds[world].name} · Levels ${world*10+1}–${world*10+10}`;
  $('levelGrid').replaceChildren();
  for(const course of courses.levels.slice(world*10,world*10+10)){
    const button=document.createElement('button'),done=crowns.includes(course.index),locked=course.number>unlocked;
    button.className='level-tile';button.disabled=locked;
    button.setAttribute('aria-label',`Level ${course.number}: ${course.title}. ${done?'Cleared':locked?'Locked':'Available'}`);
    if(course.index===selectedStage)button.setAttribute('aria-current','step');
    const number=document.createElement('strong'),name=document.createElement('span'),badge=document.createElement('small');
    number.textContent=String(course.number).padStart(2,'0');name.textContent=course.title;badge.textContent=done?'✓ Cleared':locked?'Locked':'Ready to fly';
    button.append(number,name,badge);button.onclick=()=>{selectedStage=course.index;$('mapDialog').close();audioContext();start(selectedStage)};
    $('levelGrid').append(button);
  }
}
function openPanel(id){if(adBusy||state==='connecting'||state==='burst')return;pause();held=false;$(id).showModal()}
async function loadBoard(){
  $('boardStatus').textContent='Loading flights…';$('boardTable').hidden=true;$('myFlight').textContent='';$('boardRefresh').disabled=true;
  try{
    const data=await api('/api/leaderboard');if(!Array.isArray(data.rows))throw new Error('Leaderboard is unavailable.');
    $('boardRows').replaceChildren();
    data.rows.forEach((entry,index)=>{
      const tr=document.createElement('tr');
      for(const value of [index+1,entry.name,entry.gates,entry.points]){const td=document.createElement('td');td.textContent=String(value);tr.append(td)}
      $('boardRows').append(tr);
    });
    $('boardTable').hidden=data.rows.length===0;$('boardStatus').textContent=data.rows.length?'Top 50 · Best flight per browser':'No flights yet. Start a ranked flight to set the first score.';
    if(data.mine)$('myFlight').textContent=`You: ${data.mine.name} · ${data.mine.gates} gates · ${data.mine.points} points`;
  }catch(error){$('boardStatus').textContent=error.name==='AbortError'?'Leaderboard timed out. Try Refresh scores.':error.message}
  finally{$('boardRefresh').disabled=false}
}
$('rankedStart').onclick=startRanked;$('postRetry').onclick=postRankedScore;
$('mapOpen').onclick=()=>{openPanel('mapDialog');$('worldSelect').value=String(Math.floor(selectedStage/10));renderWorld()};
$('mapClose').onclick=()=>$('mapDialog').close();$('worldSelect').onchange=renderWorld;
$('boardOpen').onclick=()=>{openPanel('boardDialog');if($('boardDialog').open)loadBoard()};
$('boardClose').onclick=()=>$('boardDialog').close();$('boardRefresh').onclick=loadBoard;
for(const [index,world] of courses.worlds.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=`${index+1}. ${world.name}`;$('worldSelect').append(option)}
$('start').onclick=()=>{primaryAction();$('start').blur()};
$('pause').onclick=()=>{if(state==='paused')continueFlight();else pause()};
$('sound').onclick=()=>{sound=!sound;soundLabel();try{localStorage.setItem('puff-sound',String(sound))}catch{}if(sound)tone(650);else if(audio)audio.suspend().catch(()=>{})};
$('revive').onclick=requestRevive;$('triple').onclick=requestTriple;$('cancelAd').onclick=()=>adController?.abort();
document.querySelectorAll('[data-skin]').forEach(button=>button.onclick=()=>buySkin(button.dataset.skin));
canvas.addEventListener('pointerdown',e=>{e.preventDefault();audioContext();if(state==='playing'){held=true;canvas.setPointerCapture(e.pointerId)}});
window.addEventListener('pointerup',()=>held=false);window.addEventListener('pointercancel',()=>held=false);
window.addEventListener('blur',()=>{held=false;pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLButtonElement||document.querySelector('dialog[open]'))return;
  if(e.code==='Escape'||e.code==='KeyP'){if(state==='playing'||state==='countdown')pause();else if(state==='paused')continueFlight();return}
  if(e.code!=='Space'&&e.code!=='ArrowUp')return;e.preventDefault();if(e.repeat)return;
  if(state==='ready'||state==='over'||state==='complete'||state==='paused'||state==='level')primaryAction();
  if(state==='playing'){held=true;audioContext()}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='ArrowUp')held=false});
function frame(t){const dt=Math.min((t-last)/1000||0,.05);last=t;acc+=dt;while(acc>=1/120){tick(1/120);acc-=1/120}draw(t);requestAnimationFrame(frame)}
new ResizeObserver(resize).observe(canvas);soundLabel();score=selectedStage*20;runStartStage=selectedStage;updateHud();updateCollection();$('start').textContent=`Fly level ${selectedStage+1} ↗`;resize();requestAnimationFrame(frame);
const context=document.modelContext;
if(context?.registerTool){try{Promise.resolve(context.registerTool({name:'get_puff_run',description:'Read current Puff run, stage, points and device-local helium.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({state,gatesCleared:score,level:levelIndex()+1,gatesPerLevel:LEVEL_GATES,points,runHelium,deviceBest:best,heliumBalance:bagData.balance,revived})})).catch(()=>{})}catch{}}
