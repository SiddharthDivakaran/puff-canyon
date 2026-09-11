// Run with: node --test tests/puff.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){
  const elements={},skinButtons=['classic','bubble','star','airship'].map(s=>({dataset:{skin:s},setAttribute(){}}));
  const ctx=new Proxy({}, {get:(t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}});
  const el=id=>elements[id]??={textContent:'',hidden:false,disabled:false,style:{},getContext:()=>ctx,getBoundingClientRect:()=>({width:390,height:680}),addEventListener(){},setAttribute(){},blur(){}};
  const memory=new Map();
  const sandbox={document:{hidden:false,getElementById:el,querySelectorAll:()=>skinButtons,documentElement:{style:{setProperty(){}}},addEventListener(){}},window:{addEventListener(){},matchMedia:()=>({matches:false}),PuffAds:{isAvailable:()=>false}},ResizeObserver:class{observe(){}},devicePixelRatio:1,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},requestAnimationFrame(){},performance:{now:()=>1000},crypto:{getRandomValues:a=>a.fill(1234)},HTMLButtonElement:class{},setTimeout,clearTimeout,AbortController,console};
  vm.createContext(sandbox);
  const source=fs.readFileSync(path.join(__dirname,'../dist/game.js'),'utf8');
  vm.runInContext(source+`\nglobalThis.t={start,tick,die,draw,addGate,buySkin,primaryAction,requestRevive,requestTriple,continueFlight,get:()=>({state,y,vy,r,score,points,shield,reviveUsed,revived,runHelium,tripleUsed,best,bagData:JSON.parse(JSON.stringify(bagData)),gates,activeSinceAd,completedRuns}),set:(v)=>{if(v.score!==undefined)score=v.score;if(v.y!==undefined)y=v.y;if(v.gates!==undefined)gates=v.gates;if(v.runHelium!==undefined)runHelium=v.runHelium;if(v.balance!==undefined)bagData.balance=v.balance;if(v.activeSinceAd!==undefined)activeSinceAd=v.activeSinceAd;},cancel:()=>adController?.abort()};`,sandbox);
  return {g:sandbox.t,el,sandbox,memory};
}
function gate(x=10,extra={}){return {x,base:340,center:340,gap:230,amplitude:0,phase:0,closest:Infinity,passed:false,shielded:false,token:null,wind:0,...extra}}
function die(g){g.die();for(let i=0;i<100;i++)g.tick(1/120);assert.equal(g.get().state,'over')}
test('all stages contain exactly 10 gates, independent of bonus points',()=>{
  const {g}=setup();g.start();
  for(let i=1;i<=30;i++){
    g.set({y:340,gates:[gate(10,{closest:3})]});g.tick(1/120);
    assert.equal(g.get().score,i);assert.equal(g.get().points,i*3);
    assert.equal(g.get().state,i%10===0?'level':'playing');
    if(i%10===0){g.continueFlight();for(let n=0;n<181;n++)g.tick(1/120)}
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
test('forced interstitial only after fifth completed attempt and at least 120s active play',async()=>{
  const {g,sandbox}=setup();let ads=0;sandbox.window.PuffAds={isAvailable:()=>true,showInterstitial:async()=>{ads++;return {shown:true}}};g.start();
  for(let i=1;i<=5;i++){die(g);if(i===5)g.set({activeSinceAd:121});await g.primaryAction();assert.equal(ads,i===5?1:0)}
  for(let i=0;i<5;i++){die(g);await g.primaryAction()}assert.equal(ads,1);
});
test('moving gates and wind appear only in later levels and stay within vertical bounds',()=>{
  const {g}=setup();g.start();for(let i=0;i<30;i++)g.addGate();assert(g.get().gates.every(g=>g.amplitude===0&&g.wind===0));
  g.set({score:20,gates:[]});for(let i=0;i<100;i++)g.addGate();assert(g.get().gates.some(g=>g.amplitude>0));assert(g.get().gates.some(g=>g.wind));
  for(const gg of g.get().gates){assert(gg.base-gg.amplitude-gg.gap/2>82);assert(gg.base+gg.amplitude+gg.gap/2<628)}g.draw(1000);
});
