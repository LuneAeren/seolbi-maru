import express from 'express';
import {createHash} from 'node:crypto';
import {sampleWorkspace,importTasks,parseMailText,previewPlan,commitPlan,checkItem,completeTask,updateStaff,equipmentHistory,handover,saveDailyNote,scheduleTask} from './workflows.js';
import {parseFile,LIMITS} from '../src/tables.js';
import {fail} from '../src/core.js';
export function referenceRouter(store,{mode='demo'}={}){
  const router=express.Router();
  router.use((req,_res,next)=>{if(mode!=='demo'&&!['GET','HEAD'].includes(req.method))return next(Object.assign(new Error('운영 환경의 레퍼런스 쓰기는 비활성입니다. 사내 권한 규칙을 적용해 선택한 기능을 이식해주세요.'),{status:403}));next();});
  const id='reference-workspace-v1';
  function workspace(){try{return store.get(id,'ref:workspace');}catch(error){if(error.status!==404)throw error;const data=mode==='demo'?sampleWorkspace():{day:'',staff:[],tasks:[],bookings:[],checklists:{},informs:[],events:[]};return store.save('ref:workspace',id,data,0,'system','레퍼런스 공간 초기화');}}
  function mutate(req,operation,reason){const current=workspace();if(req.body.version!==current.version)fail(409,'다른 변경이 있습니다. 화면을 다시 불러온 뒤 검토해주세요.','VERSION_CONFLICT');const copy=structuredClone(current.data);const result=operation(copy);const entity=store.save('ref:workspace',id,copy,current.version,req.actor,reason);return{version:entity.version,data:entity.data,result};}
  router.post('/reset',(req,res)=>res.json(mutate(req,s=>{const fresh=sampleWorkspace(req.body.day);for(const key of Object.keys(s))delete s[key];Object.assign(s,fresh);return{reset:true};},'가짜 예제 공간 다시 시작')));
  router.get('/workspace',(_req,res)=>{const w=workspace();res.json({version:w.version,data:w.data});});
  router.post('/tasks', (req,res)=>res.json(mutate(req,s=>importTasks(s,req.body.records),'업무 가져오기')));
  router.post('/mail', (req,res)=>res.json(mutate(req,s=>importTasks(s,parseMailText(req.body.text)),'메일 본문 업무 반입')));
  router.post('/import/preview',express.raw({type:'application/octet-stream',limit:LIMITS.bytes}),async(req,res)=>{
    const parsed=await parseFile(req.body,String(req.query.filename||''),String(req.query.encoding||'utf-8'));
    const sheet=parsed.sheets[Number(req.query.sheet||0)];if(!sheet)fail(400,'시트를 확인해주세요.');
    const map={작업명:'title',설비:'equipment',예정일:'day',예상분:'minutes',역량:'skill',필요레벨:'level',우선순위:'priority',시작가능:'earliest',마감:'deadline'};
    for(const name of ['작업명','설비','예정일','예상분','역량','필요레벨','우선순위'])if(!sheet.columns.includes(name))fail(400,`업무 표에 '${name}' 열이 필요합니다.`);
    if(sheet.rows.length>2000)fail(400,'업무 반입은 최대 2,000행입니다.');
    const records=sheet.rows.map(row=>{const task={source:'표 파일 반입'};sheet.columns.forEach((c,i)=>{if(map[c])task[map[c]]=row[i];});return task;});
    const temporary={tasks:[]};importTasks(temporary,records);
    res.json({records:temporary.tasks.map(({id,status,sourceKey,...data})=>data),warnings:parsed.warnings,count:temporary.tasks.length});
  });
  router.post('/plan/preview',(req,res)=>{const current=workspace();if(req.body.version!==current.version)fail(409,'입력 자료가 변경됐습니다. 새로 불러와주세요.','VERSION_CONFLICT');const result=previewPlan(current.data,req.body.day,req.body.includeOverdue===true);res.json({version:current.version,...result,inputHash:createHash('sha256').update(JSON.stringify(current.data)).digest('hex')});});
  router.post('/plan/commit',(req,res)=>res.json(mutate(req,s=>commitPlan(s,req.body.day,req.body.includeOverdue===true),'배정 초안 검토 후 일정 확정')));
  router.put('/staff',(req,res)=>res.json(mutate(req,s=>updateStaff(s,req.body.staff),'담당자 역량·배정 가중치 수정')));
  router.post('/check',(req,res)=>res.json(mutate(req,s=>checkItem(s,{...req.body,actor:req.actor}),'작업 체크리스트 기록')));
  router.post('/complete',(req,res)=>res.json(mutate(req,s=>completeTask(s,{taskId:req.body.taskId,actor:req.actor}),'업무 완료·인폼 자동 생성')));
  router.put('/daily-note',(req,res)=>res.json(mutate(req,s=>saveDailyNote(s,{day:req.body.day,text:req.body.text,actor:req.actor}),'날짜별 업무 메모 저장')));
  router.post('/schedule',(req,res)=>res.json(mutate(req,s=>scheduleTask(s,{...req.body,actor:req.actor}),'업무 일정 직접 지정·변경')));
  router.get('/history',(req,res)=>res.json(equipmentHistory(workspace().data,String(req.query.equipment||'').slice(0,80))));
  router.get('/handover',(req,res)=>res.json(handover(workspace().data,String(req.query.day||''))));
  return router;
}
