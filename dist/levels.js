/* 100 fixed courses: ten worlds, ten distinct route recipes per world. */
(() => {
  const worlds = [
    ['Electric lagoon','#14285b','#087f96','#ff5da2','#ffb5db','#ffcd43','#4bf2df'],
    ['Sunset soda','#541879','#d74973','#36d5cd','#9ffff0','#ffe061','#ffd166'],
    ['Cosmic candy','#221359','#6139a1','#ffa444','#ffe0a1','#f56bd7','#71e6ff'],
    ['Blue raspberry','#102765','#126fd1','#a7ed48','#e2ffac','#ff856a','#ffafd2'],
    ['Mango heights','#782745','#d9772a','#9169f8','#d6c4ff','#57f5d2','#ffe175'],
    ['Neon garden','#103d56','#147958','#ed70d4','#ffb9ea','#ffcb51','#97efff'],
    ['Frosted orbit','#12234e','#267da8','#fa8b53','#ffd2b1','#95ffe8','#adeeff'],
    ['Ruby thunder','#430e49','#ab215b','#4ce5a8','#b1ffde','#ffe678','#ffd08a'],
    ['Solar drift','#43204e','#a74c2f','#58c4f6','#bef0ff','#e7ff7a','#ffdd88'],
    ['Aurora summit','#161a58','#176f86','#c385ff','#edceff','#ffda65','#67ffdb']
  ].map(([name,top,bottom,gate,cap,ball,accent])=>({name,top,bottom,gate,cap,ball,accent,shine:'#fff6d6'}));
  const routes = [
    ['First light',[-.25,0,.3,.1,-.3,-.1,.25,.45,.1,-.2], 'Rolling gaps'],
    ['Ribbon run',[-.65,-.2,.2,.65,.2,-.2], 'Sweeping slalom'],
    ['Sky steps',[-.8,-.4,0,.4,.8,.4,0,-.4], 'Climbing staircase'],
    ['Cross breeze',[-.55,.55,.25,-.25], 'Alternating currents'],
    ['Double dip',[.7,.7,-.6,-.6,0,0,.5,-.5], 'Paired turns'],
    ['Pendulum',[-.8,.8,-.4,.4,0,.65,-.65], 'Floating gates'],
    ['Switchback',[-.8,-.1,.8,.1,-.65,.65], 'Sharp reversals'],
    ['Cloud ladder',[-.9,-.45,0,.45,.9,0], 'Wind and steps'],
    ['Afterglow',[0,.7,0,-.7,.35,-.35,.8,-.8], 'Mixed rhythm'],
    ['Crown flight',[-.8,.4,-.1,.8,-.4,.1,.6,-.6], 'World finale']
  ];
  const levels = Array.from({length:100},(_,index)=>{
    const world=Math.floor(index/10),route=index%10;
    return Object.freeze({index,number:index+1,world,route,gates:20,
      name:`${worlds[world].name} · ${routes[route][0]}`,title:routes[route][0],
      label:routes[route][2],rating:Math.min(5,1+Math.floor(index/20)),
      speed:132+index*.9, gap:240-index*.68,
      amplitude:18+index*.18,frequency:.72+index*.006,
      windForce:150+index*.65,interval:2.4,pattern:routes[route][1],
      palette:{...worlds[world],top:`hsl(${[225,278,258,220,333,196,226,292,282,238][world]+route*2} 60% ${17+route*.4}%)`}
    });
  });
  function get(index){return levels[Math.max(0,Math.min(99,Math.floor(index)))]}
  function difficulty(index,ordinal=1){
    const level=get(index),phase=Math.min(3,Math.floor((ordinal-1)/5));
    return {...level,speed:level.speed+phase*3,gap:level.gap-phase*3};
  }
  function hazard(index,ordinal){
    const level=get(index);
    if(index===0)return {moving:[5,9,12,16,18,20].includes(ordinal),wind:[8,14,19].includes(ordinal)?(ordinal===14?1:-1):0};
    const moving=(ordinal+level.route) % (index<20?3:5)!==0;
    const every=index<30?4:index<70?3:2;
    const windy=ordinal>=4&&(ordinal+level.route)%every===0;
    return {moving,wind:windy?((Math.floor(ordinal/every)+level.world)%2?-1:1):0};
  }
  globalThis.PuffLevels={levels,worlds,get,difficulty,hazard};
})();
