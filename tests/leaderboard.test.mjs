import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{PuffLeaderboard} from '../worker/index.mjs';

function setup(){
  const db=new DatabaseSync(':memory:');
  const sql={exec(query,...params){const rows=db.prepare(query).all(...params);return {toArray:()=>rows}}};
  const board=new PuffLeaderboard({storage:{sql}});
  const env={LEADERBOARD:{idFromName:()=> 'board',get:()=>board},ASSETS:{fetch:()=>new Response('game')}};
  let cookie='';
  async function request(path,body,extra={}){
    const headers={...(body?{'Content-Type':'application/json',Origin:'https://puff.example'}:{}),...(cookie?{Cookie:cookie}:{}),...extra};
    const response=await worker.fetch(new Request('https://puff.example'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);
    if(response.headers.has('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  return {request,db,board,env};
}
test('real SQLite persists a shared leaderboard, keeps the best score, and deduplicates uploads',async()=>{
  const {request,db,board}=setup();
  assert.deepEqual((await request('/api/leaderboard')).data.rows,[]);
  const run=(await request('/api/runs',{})).data;
  db.prepare('UPDATE runs SET started=?').run(Date.now()-60000);
  const payload={token:run.token,gates:20,points:24,assisted:false};
  assert.equal((await request('/api/scores',payload)).data.saved,true);
  assert.equal((await request('/api/scores',{...payload,gates:25,points:27})).data.duplicate,true);
  const boardResponse=await request('/api/leaderboard');
  assert.equal(boardResponse.data.rows[0].gates,20);assert.equal(boardResponse.data.mine.name,run.name);
  const second=(await request('/api/runs',{})).data;
  assert.equal((await request('/api/scores',{token:second.token,gates:1,points:1,assisted:false})).status,200);
  assert.equal((await request('/api/leaderboard')).data.rows[0].gates,20);
  const other=await board.fetch(new Request('https://puff.example/api/leaderboard',{headers:{'X-Puff-Owner':'0123456789abcdef0123456789abcdef'}}));
  const data=await other.json();assert.equal(data.rows[0].gates,20);assert.equal(data.mine,null);
  assert(db.prepare('EXPLAIN QUERY PLAN SELECT name,gates,points FROM scores ORDER BY gates DESC,points DESC,achieved ASC LIMIT 50').all().some(r=>r.detail.includes('idx_scores_rank')));
  db.close();
});
test('rejects cross-origin writes, impossible scores, another player token and expired runs',async()=>{
  const {request,db}=setup();
  assert.equal((await request('/api/runs',{}, {Origin:'https://evil.example'})).status,403);
  const {token}=(await request('/api/runs',{})).data;
  const base={token,gates:100,points:100,assisted:false};
  assert.equal((await request('/api/scores',base)).status,400);
  for(const change of [{gates:2001},{gates:-1},{gates:1,points:4},{assisted:true},{points:1.2}])assert.equal((await request('/api/scores',{...base,...change})).status,400);
  assert.equal((await request('/api/scores',{...base,gates:1,points:1},{Cookie:'puff_player=0123456789abcdef0123456789abcdef','X-Puff-Owner':'forged'})).status,410);
  db.prepare('UPDATE runs SET expires=0').run();
  assert.equal((await request('/api/scores',{...base,gates:1,points:1})).status,410);db.close();
});
test('rate limits repeated ranked starts and serves gameplay without a database',async()=>{
  const {request,db,env}=setup();
  for(let i=0;i<15;i++)assert.equal((await request('/api/runs',{})).status,200);
  assert.equal((await request('/api/runs',{})).status,429);
  assert.equal(await (await worker.fetch(new Request('https://puff.example/'),env)).text(),'game');
  assert.equal((await worker.fetch(new Request('https://puff.example/api/leaderboard'),{})).status,503);db.close();
});
