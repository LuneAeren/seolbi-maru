import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {planDay,validDay,minuteOfDay} from '../reference-kit/planner.js';
import {sampleWorkspace,parseMailText,importTasks,commitPlan,checkItem,completeTask,equipmentHistory,handover,makeChecklist} from '../reference-kit/workflows.js';
import {createApp} from '../src/app.js';
const day='2026-11-15';
const person=(id,weight=1)=>({id,name:'가짜 '+id,weight,maxMinutes:240,skills:{기계:3},windows:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]});
const task=(id,extra={})=>({id,title:'가짜 업무 '+id,equipment:'MC-'+id,day,minutes:60,skill:'기계',level:3,priority:3,earliest:'09:00',deadline:'17:00',status:'pending',...extra});
test('weights affect allocation while hard capacity and qualification remain enforced',()=>{const result=planDay({day,tasks:Array.from({length:6},(_,i)=>task(String(i))),staff:[person('A'),person('B',2)]});assert.equal(result.assignments.length,6);assert.equal(result.loads.find(p=>p.id==='A').minutes,120);assert.equal(result.loads.find(p=>p.id==='B').minutes,240);assert.ok(result.loads.every(p=>p.minutes<=p.capacity));assert.deepEqual(result,planDay({day,tasks:Array.from({length:6},(_,i)=>task(String(i))),staff:[person('A'),person('B',2)]}));});
test('equipment conflict, person calendar, lunch break and deadline are respected',()=>{const workers=[person('A'),person('B')];const result=planDay({day,staff:workers,tasks:[task('1',{equipment:'SAME'}),task('2',{equipment:'SAME'})],bookings:[{id:'meeting',personId:'A',day,start:'09:00',end:'10:00',equipment:''}]});assert.equal(result.assignments.length,2);const[a,b]=result.assignments;assert.ok(minuteOfDay(a.end)<=minuteOfDay(b.start)||minuteOfDay(b.end)<=minuteOfDay(a.start));for(const assignment of result.assignments)assert.ok(!(assignment.start<'13:00'&&assignment.end>'12:00'));const impossible=planDay({day,staff:[person('A')],tasks:[task('3',{minutes:180,earliest:'10:30',deadline:'14:00'})]});assert.equal(impossible.unassigned.length,1);});
test('missing qualification and daily overload return explicit unassigned reasons',()=>{const result=planDay({day,staff:[person('A')],tasks:[task('1',{level:5}),...Array.from({length:5},(_,i)=>task('x'+i))]});assert.equal(result.assignments.length,4);assert.equal(result.unassigned.length,2);assert.match(result.unassigned.find(t=>t.taskId==='1').reason,/역량/);});
test('today filtering and explicit overdue inclusion do not accidentally include future jobs',()=>{const tasks=[task('past',{day:'2026-11-14'}),task('today'),task('future',{day:'2026-11-16'})];assert.equal(planDay({day,tasks,staff:[person('A')]}).assignments.length,1);assert.equal(planDay({day,tasks,staff:[person('A')],includeOverdue:true}).assignments.length,2);});
test('structured mail parsing, duplicate exclusion and all-or-nothing validation',()=>{const body=`작업: 센서 확인\n설비: MC-99\n예정일: ${day}\n예상분: 45\n역량: 전기\n필요레벨: 2\n우선순위: 3`;const rows=parseMailText(body);assert.equal(rows[0].equipment,'MC-99');const state=sampleWorkspace(day);assert.equal(importTasks(state,rows).added,1);assert.equal(importTasks(state,rows).duplicates,1);const count=state.tasks.length;assert.throws(()=>importTasks(state,[rows[0],{...rows[0],minutes:-10}]));assert.equal(state.tasks.length,count);assert.throws(()=>parseMailText('보통 문장을 자동으로 추측하면 안 됩니다.'));});
test('confirming a plan creates linked checklists and completion creates exactly one inform',()=>{const state=sampleWorkspace(day),plan=commitPlan(state,day);assert.ok(plan.assignments.length);const id=plan.assignments[0].taskId;assert.equal(state.checklists[id].items.length,3);assert.throws(()=>completeTask(state,{taskId:id,actor:'tester'}));for(const item of state.checklists[id].items)checkItem(state,{taskId:id,itemId:item.id,done:true,comment:'가짜 점검 기록',actor:'tester'});const inform=completeTask(state,{taskId:id,actor:'tester'});assert.equal(completeTask(state,{taskId:id,actor:'tester'}).id,inform.id);assert.equal(state.informs.filter(i=>i.taskId===id).length,1);assert.throws(()=>checkItem(state,{taskId:id,itemId:'before',done:false,actor:'tester'}));assert.ok(equipmentHistory(state,inform.equipment).some(e=>e.type==='체크 완료'));assert.equal(handover(state,day).informs.length,1);assert.ok(equipmentHistory(state,'MC-107').length);});
test('invalid day and invalid weights fail validation',()=>{for(const value of ['2026-99-10','2026-02-30','x'])assert.throws(()=>validDay(value));assert.throws(()=>planDay({day,tasks:[task('1')],staff:[{...person('A'),weight:0}]}));});
test('reference API shares auth/CSRF/version protection and preserves main CSP',async t=>{
 const config={mode:'demo',origin:'http://127.0.0.1:0',dataFile:':memory:',allowedSiteHosts:[]};const app=createApp(config),server=app.listen(0,'127.0.0.1');await once(server,'listening');config.origin=`http://127.0.0.1:${server.address().port}`;t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));app.locals.store.close();});
 const bootRes=await fetch(config.origin+'/api/bootstrap');const cookie=bootRes.headers.get('set-cookie').split(';')[0],boot=await bootRes.json();
 const request=(path,body)=>fetch(config.origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:config.origin,'X-CSRF-Token':boot.csrf,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const w=await(await request('/api/reference/workspace')).json();const preview=await request('/api/reference/plan/preview',{version:w.version,day:w.data.day});assert.equal(preview.status,200);const before=await(await request('/api/reference/workspace')).json();assert.equal(before.data.bookings.length,w.data.bookings.length);
 assert.equal((await request('/api/reference/plan/commit',{version:w.version,day:w.data.day})).status,200);assert.equal((await request('/api/reference/plan/commit',{version:w.version,day:w.data.day})).status,409);
 const reset=await request('/api/reference/reset',{version:w.version+1,day:w.data.day});assert.equal(reset.status,200);assert.equal((await reset.json()).data.tasks.every(t=>t.status==='pending'),true);
 const main=await request('/');const gallery=await request('/design-lab/');assert.match(main.headers.get('content-security-policy'),/frame-src 'none'/);assert.match(gallery.headers.get('content-security-policy'),/frame-src 'self'/);assert.match(gallery.headers.get('content-security-policy'),/frame-ancestors 'self'/);
 for(const key of ['01-ledger','02-midnight','03-briefing','04-cobalt','05-sage','06-signal','07-blueprint','08-pearl'])assert.equal((await request('/design-lab/'+key+'.html')).status,200);
});

test('equipment-specific checklist wins and templates are frozen into each task',()=>{
 const t=task('one',{equipment:'MC-1'}),templates=[{id:'skill',skill:'기계',items:[{id:'a',label:'역량 기본 항목'}]},{id:'specific',equipment:'MC-1',items:[{id:'b',label:'설비 전용 항목'}]}];
 const list=makeChecklist(t,templates);assert.equal(list.templateId,'specific');templates[1].items[0].label='원본 수정';assert.equal(list.items[0].label,'설비 전용 항목');
});
test('duplicate people/task IDs are rejected and overdue work retains original date in handover',()=>{
 assert.throws(()=>planDay({day,tasks:[task('one')],staff:[person('A'),person('A')]}));
 assert.throws(()=>planDay({day,tasks:[task('one'),task('one')],staff:[person('A')]}));
 const state=sampleWorkspace(day);state.tasks=[task('old',{day:'2026-11-14'})];state.bookings=[];commitPlan(state,day,true);assert.equal(state.tasks[0].day,'2026-11-14');assert.equal(state.tasks[0].plannedDay,day);assert.equal(handover(state,day).outstanding.length,1);
});

test('production reference writes stay disabled even for authenticated department members',async t=>{
 const {createHmac}=await import('node:crypto');const secret='s'.repeat(40),user='engineer-a';
 const config={mode:'production',origin:'http://127.0.0.1:0',dataFile:':memory:',secret,users:[user],proxies:['127.0.0.1','::ffff:127.0.0.1'],allowedSiteHosts:[]};
 const app=createApp(config),server=app.listen(0,'127.0.0.1');await once(server,'listening');config.origin=`http://127.0.0.1:${server.address().port}`;t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));app.locals.store.close();});
 function auth(method,path){const at=String(Date.now());return{'X-Portal-User':user,'X-Portal-Time':at,'X-Portal-Signature':createHmac('sha256',secret).update(`${user}\n${at}\n${method}\n${path}`).digest('hex')};}
 const response=await fetch(config.origin+'/api/bootstrap',{headers:auth('GET','/api/bootstrap')});const cookie=response.headers.get('set-cookie').split(';')[0],boot=await response.json();
 const path='/api/reference/reset';const blocked=await fetch(config.origin+path,{method:'POST',headers:{...auth('POST',path),Cookie:cookie,Origin:config.origin,'X-CSRF-Token':boot.csrf,'Content-Type':'application/json'},body:JSON.stringify({version:1,day})});assert.equal(blocked.status,403);
});
