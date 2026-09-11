// Run with: node --test tests/puff.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){
  const elements={},skinButtons=['classic','bubble','star','airship'].map(s=>({dataset:{skin:s},setAttribute(){}}));
  const ctx=new Proxy({}, {get:(t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}});
  const el=id=>elements[id]??={textContent:'',hidden:false,disabled:false,style:{},getContext:()=>ctx,getBoundingClientRect:()=>({width:390,height:680}),addEventListener(){},setAttribute(){},blur(){},append(){},replaceChildren(){},showModal(){this.open=true},close(){this.open=false}};
  const memory=new Map();
  const sandbox={document:{hidden:false,createElement:()=>el(Math.random()),querySelector:()=>null,getElementById:el,querySelectorAll:()=>skinButtons,documentElement:{style:{setProperty(){}}},addEventListener(){}},window:{addEventListener(){},matchMedia:()=>({matches:false}),PuffAds:{isAvailable:()=>false}},ResizeObserver:class{observe(){}},devicePixelRatio:1,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},requestAnimationFrame(){},performance:{now:()=>1000},crypto:{getRandomValues:a=>a.fill(1234)},HTMLButtonElement:class{},setTimeout,clearTimeout,AbortController,console};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/levels.js'),'utf8'),sandbox);
  const source=fs.readFileSync(path.join(__dirname,'../dist/game.js'),'utf8');
  vm.runInContext(source+`\nglobalThis.t={difficulty,start,startRanked,levelBreak,renderWorld,tick,die,draw,addGate,buySkin,primaryAction,requestRevive,requestTriple,continueFlight,get:()=>({state,y,vy,r,score,points,shield,unlocked,selectedStage,crowns,ranked,reviveUsed,revived,runHelium,tripleUsed,best,bagData:JSON.parse(JSON.stringify(bagData)),gates,activeSinceAd,completedRuns}),set:(v)=>{if(v.score!==undefined)score=v.score;if(v.y!==undefined)y=v.y;if(v.gates!==undefined)gates=v.gates;if(v.runHelium!==undefined)runHelium=v.runHelium;if(v.balance!==undefined)bagData.balance=v.balance;if(v.activeSinceAd!==undefined)activeSinceAd=v.activeSinceAd;},cancel:()=>adController?.abort()};`,sandbox);
  return {g:sandbox.t,el,sandbox,memory};
}
function gate(x=10,extra={}){return {x,base:340,center:340,gap:230,amplitude:0,phase:0,closest:Infinity,passed:false,shielded:false,token:null,wind:0,...extra}}
function die(g){g.die();for(let i=0;i<100;i++)g.tick(1/120);assert.equal(g.get().state,'over')}
test('all stages contain exactly 20 gates, independent of bonus points',()=>{
  const {g}=setup();g.start();
  for(let i=1;i<=60;i++){
    g.set({y:340,gates:[gate(10,{closest:3})]});g.tick(1/120);
    assert.equal(g.get().score,i);assert.equal(g.get().points,i*3);
    assert.equal(g.get().state,i%20===0?'level':'playing');
    if(i%20===0){g.continueFlight();for(let n=0;n<181;n++)g.tick(1/120)}
  }
});
test('near miss awards once; ordinary and shielded passage do not get bonus',()=>{
  for(const [closest,shielded,expected] of [[3,false,3],[12,false,1],[2,true,1]]){
    const {g}=setup();g.start();g.set({gates:[gate(10,{closest,shielded})]});g.tick(1/120);g.tick(1/120);assert.equal(g.get().points,expected);assert.equal(g.get().score,1);
  }
});
test('helium drop banks once; skins deduct once and preserve balance on insufficient funds',()=>{
  const {g}=setup();g.start();g.set({gates:[gate(390*.26+65,{token:{taken:false,offset:0}})]});g.tick(1/120);g.tick(1/120);assert.equal(g.get().runHelium,1);assert.equal(g.get().bagData.balance,1);die(g);
  assert.equal(g.buySkin('star'),false);g.set({balance:40});assert.equal(g.buySkin('star'),true);assert.equal(g.get().bagData.balance,0);assert.equal(g.buySkin('star'),true);assert.equal(g.get().bagData.balance,0);
});
test('reward skipped or unavailable grants nothing; completed revive gets frozen 3s countdown and 2s shield',async()=>{
  const {g,sandbox}=setup();g.start();die(g);await g.requestRevive();assert.equal(g.get().reviveUsed,false);
  sandbox.window.PuffAds={isAvailable:()=>true,showRewarded:async()=>({completed:false})};await g.requestRevive();assert.equal(g.get().reviveUsed,false);
  sandbox.window.PuffAds.showRewarded=async()=>({completed:true});await g.requestRevive();assert.equal(g.get().state,'countdown');assert.equal(g.get().shield,2);
  const yy=g.get().y;for(let i=0;i<350;i++)g.tick(1/120);assert.equal(g.get().y,yy);assert.equal(g.get().shield,2);
  for(let i=0;i<12;i++)g.tick(1/120);assert.equal(g.get().state,'playing');assert(g.get().shield>1.9);
  g.set({gates:[gate(80,{base:190,center:190,gap:100})]});g.tick(1/120);assert.equal(g.get().state,'playing');
  for(let i=0;i<260;i++)g.tick(1/120);if(g.get().state==='playing')die(g);else for(let i=0;i<100;i++)g.tick(1/120);
  assert.equal(g.get().state,'over');await g.requestRevive();assert.equal(g.get().state,'over');assert.equal(g.get().revived,true);
});
test('cancelled or duplicate rewarded requests cannot duplicate helium',async()=>{
  const {g,sandbox}=setup();g.start();g.set({runHelium:4,balance:4});die(g);
  let complete;sandbox.window.PuffAds={isAvailable:()=>true,showRewarded:()=>new Promise(r=>complete=r)};
  const pending=g.requestTriple();await g.requestTriple();g.cancel();await pending;complete({completed:true});await Promise.resolve();assert.equal(g.get().bagData.balance,4);assert.equal(g.get().tripleUsed,false);
  sandbox.window.PuffAds.showRewarded=async()=>({completed:true});await g.requestTriple();await g.requestTriple();assert.equal(g.get().bagData.balance,12);assert.equal(g.get().tripleUsed,true);
});
test('forced interstitial only after fifth completed attempt and at least 180s active play',async()=>{
  const {g,sandbox}=setup();let ads=0;sandbox.window.PuffAds={isAvailable:()=>true,showInterstitial:async()=>{ads++;return {shown:true}}};g.start();
  for(let i=1;i<=5;i++){die(g);if(i===5)g.set({activeSinceAd:181});await g.primaryAction();assert.equal(ads,i===5?1:0)}
  for(let i=0;i<5;i++){die(g);await g.primaryAction()}assert.equal(ads,1);
});
test('level 1 guarantees six moving gates and three winds, and generation stops at 20',()=>{
  const {g}=setup();g.start();for(let i=0;i<30;i++)g.addGate();
  const gates=g.get().gates;assert.equal(gates.length,20);
  assert.deepEqual(Array.from(gates.filter(x=>x.wind),x=>x.ordinal),[8,14,19]);
  assert.equal(gates.filter(x=>x.amplitude>0).length,6);
  for(const gg of gates){assert(gg.base-gg.amplitude-gg.gap/2>82);assert(gg.base+gg.amplitude+gg.gap/2<628)}
  g.draw(1000);
});
test('difficulty increases materially: speed, gap, hazard motion and wind',()=>{
  const {g}=setup();const first=g.difficulty(0,1),second=g.difficulty(1,1),third=g.difficulty(2,1);
  assert(second.speed>first.speed);assert(third.speed>second.speed);
  assert(second.gap<first.gap);assert(third.gap<second.gap);
  assert(second.amplitude>first.amplitude);assert(second.windForce>first.windForce);
  assert(g.difficulty(0,16).speed>first.speed);assert(g.difficulty(0,16).gap<first.gap);
});
test('a wind zone visibly changes the flight trajectory',()=>{
  const calm=setup().g,breezy=setup().g;
  for(const [g,wind] of [[calm,0],[breezy,1]]){
    g.start();g.set({gates:[gate(390*.26+145,{wind,windForce:150,windWidth:190})]});
    for(let i=0;i<60;i++)g.tick(1/120);
    assert.equal(g.get().state,'playing');
  }
  assert(breezy.get().y-calm.get().y>10);
});
test('new levels generate their own hazards; all level shapes stay in bounds',()=>{
  const {g}=setup();g.start();
  for(let stage=0;stage<100;stage++){
    g.set({score:stage*20,gates:[]});for(let i=0;i<20;i++)g.addGate();
    const gates=g.get().gates;assert.equal(gates.length,20);assert(gates.every(x=>x.stage===stage));
    if(stage>0){assert(gates.filter(x=>x.amplitude>0).length>=13);assert(gates.some(x=>x.wind));}
    for(const gg of gates){assert(gg.base-gg.amplitude-gg.gap/2>82);assert(gg.base+gg.amplitude+gg.gap/2<628)}
  }
});

test('all 100 courses have distinct names, fixed 20-gate lengths, and a finite ending',()=>{
  const {g,sandbox,el,memory}=setup();g.start();
  const levels=sandbox.PuffLevels.levels;assert.equal(levels.length,100);assert.equal(new Set(levels.map(x=>x.name)).size,100);
  const routes=new Set();
  for(let stage=0;stage<100;stage++){
    g.set({score:stage*20,gates:[]});for(let i=0;i<20;i++)g.addGate();
    routes.add(JSON.stringify(g.get().gates.map(x=>[x.base,x.gap,x.wind,x.amplitude])));
    g.set({score:(stage+1)*20});g.levelBreak();
    assert.equal(g.get().unlocked,Math.min(100,stage+2));
    assert.equal(g.get().state,stage===99?'complete':'level');
  }
  assert.equal(routes.size,100);assert.equal(g.addGate(),false);assert.equal(g.get().crowns.length,100);
  assert.equal(JSON.parse(memory.get('puff-journey-v1')).unlocked,100);assert.equal(el('level').textContent,'LEVEL 100 / 100');
  g.start(99);assert.equal(g.get().score,1980);assert.equal(g.get().ranked,false);g.renderWorld();
});
test('journey restarts at the current checkpoint and never inflates the ranked record',async()=>{
  const {g}=setup();g.start();g.set({score:20});g.levelBreak();g.continueFlight();for(let i=0;i<181;i++)g.tick(1/120);die(g);
  assert.equal(g.get().best,0);await g.primaryAction();assert.equal(g.get().score,20);assert.equal(g.get().ranked,false);
});
test('ranked flight always starts at one and cannot revive',async()=>{
  const {g,sandbox}=setup();sandbox.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({token:'test',name:'SunnyPuff'})});
  await g.startRanked();assert.equal(g.get().ranked,true);assert.equal(g.get().score,0);
  die(g);sandbox.window.PuffAds={isAvailable:()=>true,showRewarded:async()=>({completed:true})};await g.requestRevive();assert.equal(g.get().revived,false);
});
