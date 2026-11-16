import {createHash} from 'node:crypto';
import {planDay,validateTask,validateStaff,validDay,minuteOfDay,timeOfDay,PlannerError} from './planner.js';
const requireValue=(ok,message)=>{if(!ok)throw new PlannerError(message);};
export const todayKST=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Seoul'}).format(new Date());
const keyFor=t=>createHash('sha256').update(JSON.stringify([t.day,t.title,t.equipment,t.minutes,t.skill,t.level,t.priority,t.earliest,t.deadline])).digest('hex').slice(0,24);
export function sampleWorkspace(day=todayKST()){
  const windows=[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}];
  const staff=[['A','기계',4,1.2],['B','전기',4,1],['C','제어',5,.9],['D','검사',4,1]].map(([id,skill,level,weight])=>({id,name:'엔지니어 '+id,weight,maxMinutes:360,active:true,skills:{기계:2,전기:2,제어:1,검사:2,운영:3,[skill]:level},windows:structuredClone(windows)}));
  const raw=[['정기 PM · 구동부 점검','MC-104',90,'기계',3,4],['센서 보정','MC-203',60,'전기',3,3],['간헐 알람 원인 확인','MC-107',120,'제어',4,5],['필터 교체','MC-101',45,'기계',2,2],['검사 결과 검토','MC-202',60,'검사',2,2],['교대 전 상태 확인','MC-301',30,'운영',2,2],['단자 체결 확인','MC-204',60,'전기',2,3],['고급 제어 조정','MC-108',90,'제어',5,4]];
  const tasks=raw.map(([title,equipment,minutes,skill,level,priority],i)=>({id:'TASK-'+String(i+1).padStart(3,'0'),...validateTask({title,equipment,minutes,skill,level,priority,day,source:i%2?'메일 예시':'엑셀 예시'}),status:'pending',sourceKey:'sample-'+i}));
  return{day,staff,tasks,templates:[{id:'sample-MC104',equipment:'MC-104',skill:'기계',items:[{id:'identify',label:'샘플: 설비 호기와 작업 범위 확인'},{id:'inspect',label:'샘플: 점검 대상 항목 확인'},{id:'result',label:'샘플: 작업 결과 기록'},{id:'handover',label:'샘플: 인계할 내용 확인'}]}],bookings:[{id:'meeting:A',title:'가짜 아침 회의',personId:'A',day,start:'09:00',end:'09:30',equipment:'',minutes:30,status:'meeting'}],checklists:{},informs:[],events:[{id:'legacy-1',equipment:'MC-107',at:new Date().toISOString(),type:'과거 작업 기록',text:'인폼이 없는 과거 기록 예시 · 센서 배선 점검',actor:'샘플 엔지니어'}]};
}
export function importTasks(state,records){requireValue(Array.isArray(records)&&records.length>0&&records.length<=2000,'한 번에 1~2,000개 업무를 가져올 수 있습니다.');requireValue(state.tasks.length+records.length<=2000,'데모 업무는 최대 2,000개입니다.');let added=0,duplicates=0;const seen=new Set(state.tasks.flatMap(t=>[t.sourceKey,keyFor(t)]));const validated=records.map(validateTask);for(const task of validated){const sourceKey=keyFor(task);if(seen.has(sourceKey)){duplicates++;continue;}seen.add(sourceKey);state.tasks.push({id:'task:'+sourceKey,...task,sourceKey,status:'pending'});added++;}return{added,duplicates};}
export function parseMailText(input){requireValue(typeof input==='string'&&input.length>0&&input.length<=100000,'메일 본문은 100,000자 이내로 입력해주세요.');const labels={작업:'title',작업명:'title',설비:'equipment',예정일:'day',예상분:'minutes',역량:'skill',필요레벨:'level',우선순위:'priority',시작가능:'earliest',마감:'deadline'};return input.split(/\n\s*---+\s*\n/).filter(b=>b.trim()).map(block=>{const row={source:'메일 본문'};for(const line of block.split(/\r?\n/)){const m=line.match(/^\s*([^:：]+)[:：]\s*(.*)$/);if(m&&labels[m[1].trim()])row[labels[m[1].trim()]]=m[2].trim();}return validateTask(row);});}
export function previewPlan(state,day,includeOverdue=false){return planDay({tasks:state.tasks,staff:state.staff,bookings:state.bookings,day,includeOverdue});}
export function commitPlan(state,day,includeOverdue=false){const plan=previewPlan(state,day,includeOverdue);requireValue(plan.assignments.length>0,'배정할 수 있는 새 업무가 없습니다.');for(const booking of plan.assignments){state.bookings.push(booking);const task=state.tasks.find(t=>t.id===booking.taskId);task.status='scheduled';task.plannedDay=day;state.checklists[task.id]=makeChecklist(task,state.templates||[]);event(state,task.equipment,'일정 확정',`${task.title} / ${booking.personName} / ${booking.start}~${booking.end}`);}return plan;}
export function makeChecklist(task,templates=[]){
  const template=templates.find(t=>t.equipment===task.equipment)||templates.find(t=>!t.equipment&&t.skill===task.skill);
  const items=template?template.items:[{id:'before',label:'작업 전 설비·안전 조건 확인'},{id:'perform',label:task.skill+' 작업 수행과 결과 확인'},{id:'after',label:'작업 후 설비 상태·인계 사항 기록'}];
  requireValue(Array.isArray(items)&&items.length>0&&items.length<=30&&new Set(items.map(i=>i.id)).size===items.length&&items.every(i=>typeof i.id==='string'&&i.id.length>0&&i.id.length<=80&&typeof i.label==='string'&&i.label.length>0&&i.label.length<=300),'체크리스트 템플릿을 확인해주세요.');
  return{taskId:task.id,templateId:template?.id||'default:'+task.skill,items:items.map(i=>({id:i.id,label:i.label,done:false,comment:''})),completed:false};
}
function event(state,equipment,type,text,actor='demo-engineer'){state.events.push({id:'evt:'+state.events.length+':'+Date.now(),equipment,type,text,actor,at:new Date().toISOString()});if(state.events.length>10000)state.events=state.events.slice(-10000);}
export function checkItem(state,{taskId,itemId,done,comment='',actor}){const task=state.tasks.find(t=>t.id===taskId),list=state.checklists[taskId];requireValue(task&&list,'일정에 확정된 업무를 선택해주세요.');requireValue(!list.completed,'완료된 체크리스트는 잠겨 있습니다. 수정 업무를 별도로 생성해주세요.');const item=list.items.find(i=>i.id===itemId);requireValue(item&&typeof done==='boolean'&&typeof comment==='string'&&comment.length<=2000,'체크 항목과 메모를 확인해주세요.');item.done=done;item.comment=comment;task.status='in-progress';event(state,task.equipment,done?'체크 완료':'체크 해제',`${task.title} / ${item.label}${comment?' / '+comment:''}`,actor);return list;}
export function completeTask(state,{taskId,actor}){const task=state.tasks.find(t=>t.id===taskId),list=state.checklists[taskId];requireValue(task&&list,'확정된 업무를 찾을 수 없습니다.');const existing=state.informs.find(i=>i.taskId===taskId);if(existing)return existing;requireValue(list.items.every(i=>i.done),'모든 체크 항목을 확인한 뒤 완료할 수 있습니다.');const booking=state.bookings.find(b=>b.taskId===taskId);const inform={id:'inform:'+taskId,taskId,equipment:task.equipment,title:task.title+' · 작업 완료',personName:booking.personName,at:new Date().toISOString(),summary:list.items.map(i=>`✓ ${i.label}${i.comment?' — '+i.comment:''}`).join('\n'),actor};state.informs.push(inform);list.completed=true;task.status='completed';booking.status='completed';event(state,task.equipment,'인폼 생성',inform.title,actor);return inform;}
export function updateStaff(state,input){validateStaff(input);const index=state.staff.findIndex(p=>p.id===input.id);requireValue(index>=0,'담당자를 찾을 수 없습니다.');state.staff[index]=structuredClone(input);return input;}
export function equipmentHistory(state,equipment){return state.events.filter(e=>e.equipment===equipment).sort((a,b)=>b.at.localeCompare(a.at));}
export function handover(state,day){validDay(day);const tasks=state.tasks.filter(t=>(t.plannedDay||t.day)===day),ids=new Set(tasks.map(t=>t.id));return{day,completed:tasks.filter(t=>t.status==='completed'),outstanding:tasks.filter(t=>t.status!=='completed'),informs:state.informs.filter(i=>ids.has(i.taskId)),partial:Object.values(state.checklists).filter(c=>ids.has(c.taskId)&&!c.completed).map(c=>({taskId:c.taskId,done:c.items.filter(i=>i.done).length,total:c.items.length}))};}

/** Daily notes stay plain text; [[equipment]] only resolves known internal equipment. */
export function saveDailyNote(state,{day,text,actor}){
 validDay(day);requireValue(typeof text==='string'&&text.length<=20000,'일일 메모는 20,000자 이내입니다.');
 const notes=state.dailyNotes||{};requireValue(Object.hasOwn(notes,day)||Object.keys(notes).length<730,'데모 일일 메모는 최대 730일입니다.');
 const known=new Set(state.tasks.map(t=>t.equipment));
 const equipment=[...new Set([...text.matchAll(/\[\[([^\]\n]{1,80})\]\]/g)].map(m=>m[1]).filter(e=>known.has(e)))];
 state.dailyNotes=notes;notes[day]={day,text,equipment,actor,updatedAt:new Date().toISOString()};return notes[day];
}
export function scheduleTask(state,{taskId,personId,day,start,actor}){
 const task=state.tasks.find(t=>t.id===taskId),person=state.staff.find(p=>p.id===personId);
 requireValue(task&&person,'업무와 담당자를 확인해주세요.');requireValue(task.status!=='completed','완료된 작업의 일정은 변경할 수 없습니다.');validDay(day);
 const begin=minuteOfDay(start),finish=begin+task.minutes;requireValue(finish<1440,'자정을 넘는 일정은 지원하지 않습니다.');
 requireValue(begin>=minuteOfDay(task.earliest)&&finish<=minuteOfDay(task.deadline),'원천 업무의 시작 가능·마감 시각 안에서 선택해주세요.');
 const other=state.bookings.filter(b=>b.taskId!==taskId);
 const plan=planDay({tasks:[{...task,status:'pending',day,earliest:start,deadline:timeOfDay(finish)}],staff:[person],bookings:other,day});
 requireValue(plan.assignments.length===1,'역량·하루 용량·근무/휴게·사람/설비 중복을 확인해주세요.');
 const booking={...plan.assignments[0],status:task.status==='in-progress'?'in-progress':'scheduled'};
 const checklist=state.checklists[task.id]||makeChecklist(task,state.templates||[]);
 state.bookings=[...other,booking];task.status=booking.status;task.plannedDay=day;state.checklists[task.id]=checklist;
 event(state,task.equipment,'일정 직접 지정',`${task.title} / ${person.name} / ${day} ${start}–${booking.end}`,actor);return booking;
}
