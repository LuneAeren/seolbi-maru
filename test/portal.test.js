import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import ExcelJS from 'exceljs';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/security.js';
import { createStore } from '../src/store.js';
import { parseFile, csvOutput, xlsxOutput } from '../src/tables.js';
import { safeSite } from '../src/core.js';
import { applySnapshot } from '../src/ingestion.js';

async function setup(t, production = false) {
  const config = { mode: production?'production':'demo', origin:'http://127.0.0.1:0', secret:'a'.repeat(40), users:['engineer-a'], proxies:['127.0.0.1','::ffff:127.0.0.1'], allowedSiteHosts:['internal.invalid'], dataFile:':memory:' };
  const app=createApp(config), server=app.listen(0,'127.0.0.1');await once(server,'listening');config.origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));app.locals.store.close();});
  let cookie='',csrf='';
  async function request(path,method='GET',body,extra={}){
    const headers={Cookie:cookie,...extra};
    if(production&&!headers.omitAuth){const stamp=String(Date.now());headers['X-Portal-User']='engineer-a';headers['X-Portal-Time']=stamp;headers['X-Portal-Signature']=createHmac('sha256',config.secret).update(`engineer-a\n${stamp}\n${method}\n${path}`).digest('hex');}
    delete headers.omitAuth;
    if(method!=='GET'){headers.Origin=config.origin;headers['X-CSRF-Token']=csrf;if(!Buffer.isBuffer(body))headers['Content-Type']='application/json';}
    const res=await fetch(config.origin+path,{method,headers,body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body)});
    if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
    return res;
  }
  const boot=await request('/api/bootstrap');const bootstrap=await boot.json();csrf=bootstrap.csrf;
  return{config,app,request,bootstrap,get cookie(){return cookie;},get csrf(){return csrf;}};
}
test('demo bootstrap, CSP, sample and disabled connectors',async t=>{const c=await setup(t);assert.equal(c.bootstrap.mode,'demo');assert.equal(c.bootstrap.sources.filter(s=>s.state==='disabled').length,2);const r=await c.request('/');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);assert.match(r.headers.get('content-security-policy'),/script-src-attr 'none'/);const eq=await(await c.request('/api/entities/equipment')).json();assert.equal(eq.length,16);assert.equal(eq.filter(e=>e.data.status==='확인불가').length,1);});
test('CSRF, origin and forged identity rejection',async t=>{const c=await setup(t);const r=await fetch(c.config.origin+'/api/entities/info',{method:'POST',headers:{'Content-Type':'application/json',Cookie:c.cookie,Origin:'https://attacker.invalid','X-Portal-User':'admin'},body:'{}'});assert.equal(r.status,403);const b=await(await c.request('/api/bootstrap','GET',undefined,{'X-Portal-User':'admin'})).json();assert.equal(b.user,'demo-engineer');});
test('production configuration fails closed and production identity needs a valid signature',async t=>{assert.throws(()=>readConfig({APP_MODE:'production'}));assert.throws(()=>readConfig({NODE_ENV:'production',APP_MODE:'demo'}));assert.throws(()=>readConfig({APP_MODE:'demo',HOST:'0.0.0.0'}));const c=await setup(t,true);assert.equal((await c.request('/api/entities/info','GET',undefined,{omitAuth:true,'X-Portal-User':'engineer-a'})).status,401);assert.equal((await(await c.request('/api/entities/equipment')).json()).length,0);});
test('version conflict, history, soft delete and restore preserve data',async t=>{const c=await setup(t);let e=await(await c.request('/api/entities/note','POST',{data:{title:'메모',body:'첫 값',category:'미완료'},reason:'신규'})).json();assert.equal(e.version,1);const path=`/api/entities/note/${e.id}`;let changed=await c.request(path,'PUT',{version:1,data:{...e.data,body:'수정 값'},reason:'점검 결과'});assert.equal(changed.status,200);const conflict=await c.request(path,'PUT',{version:1,data:{...e.data,body:'잘못 덮어쓰기'},reason:'동시 저장'});assert.equal(conflict.status,409);assert.equal((await(await c.request(path)).json()).data.body,'수정 값');assert.equal((await c.request(path,'DELETE',{version:2,reason:'삭제 시험'})).status,200);assert.equal((await c.request(path)).status,404);assert.equal((await c.request(path+'/restore','POST',{version:3,targetVersion:1,reason:'원복'})).status,200);e=await(await c.request(path)).json();assert.equal(e.version,4);assert.equal(e.data.body,'첫 값');assert.equal((await(await c.request(path+'/history')).json()).length,4);});
test('CSV quote/newline/Korean/leading-zero preservation, malformed and path rejection',async()=>{const data={columns:['설비번호','내용'],rows:[['000123','한글, "인폼"\n두 줄'],['000124','정상']]};const parsed=await parseFile(Buffer.from(csvOutput(data)),'자료.csv');assert.deepEqual(parsed.sheets[0].rows,data.rows);await assert.rejects(()=>parseFile(Buffer.from('a,b\nx,y,z'),'bad.csv'));assert.throws(()=>parseFile(Buffer.from('a\nb'),'../escape.csv'));await assert.rejects(()=>parseFile(Buffer.from('중복,중복\n1,2'),'duplicate.csv'));});
test('XLSX sheet selection, typed string export and formulas are never evaluated',async()=>{const data={columns:['번호','값'],rows:[['000123','=WEBSERVICE("https://external.invalid")']]};const buf=await xlsxOutput(data);const parsed=await parseFile(buf,'자료.xlsx');assert.deepEqual(parsed.sheets[0].rows,data.rows);const book=new ExcelJS.Workbook();const s=book.addWorksheet('수식');s.addRow(['번호','수식']);s.addRow(['001',{formula:'1+1',result:2}]);book.addWorksheet('다음').addRows([['내용'],['두 번째 시트']]);const result=await parseFile(Buffer.from(await book.xlsx.writeBuffer()),'수식.xlsx');assert.equal(result.sheets.length,2);assert.equal(result.sheets[0].rows[0][1],'=1+1');assert.equal(result.warnings.length,1);});
test('XLSX external relationships and unrecognized files are rejected',async()=>{const book=new ExcelJS.Workbook();const s=book.addWorksheet('외부');s.addRow(['링크']);s.addRow([{text:'외부',hyperlink:'https://external.invalid'}]);const bytes=Buffer.from(await book.xlsx.writeBuffer());await assert.rejects(()=>parseFile(bytes,'외부.xlsx'));await assert.rejects(()=>parseFile(Buffer.from('not a zip'),'bad.xlsx'));});
test('import, cell patch, unsaved export, conflict and original preservation',async t=>{const c=await setup(t);const raw=Buffer.from('\ufeff번호,내용\r\n000123,첫 값');const imp=await c.request('/api/imports?filename=sample.csv','POST',raw,{'Content-Type':'application/octet-stream'});assert.equal(imp.status,201);const draft=await imp.json();const entity=await(await c.request(`/api/imports/${draft.id}/commit`,'POST',{title:'반입 자료',sheet:0,columns:['설비번호','인폼']})).json();assert.equal(entity.data.rowCount,1);const id=entity.id;const exp=await c.request(`/api/datasets/${id}/export`,'POST',{version:1,changes:[{row:0,col:1,value:'다운로드만'}],format:'csv'});assert.match(await exp.text(),/다운로드만/);let rows=await(await c.request(`/api/datasets/${id}/rows`)).json();assert.equal(rows.rows[0].cells[1],'첫 값');const patch=await c.request(`/api/datasets/${id}/rows`,'PATCH',{version:1,changes:[{row:0,col:1,value:'공유 수정'}],reason:'셀 수정'});assert.equal(patch.status,200);assert.equal((await c.request(`/api/datasets/${id}/rows`,'PATCH',{version:1,changes:[{row:0,col:1,value:'덮기'}],reason:'충돌'})).status,409);const stale=await c.request(`/api/datasets/${id}/export`,'POST',{version:1,changes:[{row:0,col:1,value:'내 수정 보관'}],format:'csv'});assert.match(await stale.text(),/내 수정 보관/);const original=await c.request(`/api/datasets/${id}/download/original`);assert.deepEqual(Buffer.from(await original.arrayBuffer()),raw);});
test('formula injection defense and link allowlist',()=>{assert.match(csvOutput({columns:['값'],rows:[['=1+1'],['  @SUM(1)'],['-12']]}),/'=1\+1/);assert.equal(safeSite('/?view=info'), '/?view=info');assert.equal(safeSite('https://internal.invalid/work',['internal.invalid']),'https://internal.invalid/work');for(const value of ['javascript:alert(1)','https://external.invalid','//external.invalid','/\\external.invalid'])assert.throws(()=>safeSite(value,[]));});
test('SQLite persistence across restart and 20 concurrent saves have one winner',async t=>{const dir=await mkdtemp(join(tmpdir(),'seolbi-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'portal.sqlite');let store=createStore(path);const saved=store.create('note',{title:'보존'},'engineer');store.close();store=createStore(path);assert.equal(store.get(saved.id,'note').data.title,'보존');store.close();const c=await setup(t);const e=await(await c.request('/api/entities/site')).json();const results=await Promise.all(Array.from({length:20},(_,i)=>c.request(`/api/entities/site/${e[0].id}`,'PUT',{version:e[0].version,data:{...e[0].data,title:`수정 ${i}`},reason:'동시 수정'})));assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,19);});
test('approximately 2MB CSV is accepted without data truncation',async()=>{const raw=Buffer.from('설비번호,점검내용,결과,비고\r\n'+Array.from({length:18000},(_,i)=>`${String(i).padStart(6,'0')},${'가짜 설비 점검 자료 '.repeat(4)},양호,테스트 데이터\r\n`).join(''));assert.ok(raw.length>=2*1024*1024);const parsed=await parseFile(raw,'large.csv');assert.ok(parsed.sheets[0].rows.length>10000);assert.equal(parsed.sheets[0].rows[0][0],'000000');});

test('source validation and atomic replacement preserve the last good snapshot on failure',()=>{
  const store=createStore(':memory:');
  const at=new Date().toISOString();
  const row={sourceId:'A001',title:'가짜 설비',area:'구역 A',status:'운전',observedAt:at};
  applySnapshot(store,'hue',{complete:true,readCount:1,rejectedCount:0,observedAt:at,records:[row]});
  assert.equal(store.get('hue:A001','equipment').data.status,'운전');
  assert.throws(()=>applySnapshot(store,'hue',{complete:false,records:[]}));
  assert.equal(store.get('hue:A001','equipment').data.status,'운전');
  assert.equal(store.meta('sources').find(s=>s.id==='hue').state,'error');
  applySnapshot(store,'hue',{complete:true,readCount:1,rejectedCount:0,observedAt:at,records:[{...row,sourceId:'A002',status:'점검'}]});
  assert.throws(()=>store.get('hue:A001','equipment'));
  assert.equal(store.get('hue:A002','equipment').data.status,'점검');
  store.close();
});
