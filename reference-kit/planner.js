/** Deterministic assignment reference. No network or AI calls. All times use KST. */
export class PlannerError extends Error { constructor(message){super(message);this.status=400;} }
const requireValue=(ok,message)=>{if(!ok)throw new PlannerError(message);};
export const minuteOfDay=time=>{requireValue(typeof time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(time),'시각은 HH:mm 형식이어야 합니다.');const[h,m]=time.split(':').map(Number);return h*60+m;};
export const timeOfDay=minutes=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
export function validDay(day){requireValue(typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day,'유효한 날짜가 필요합니다.');return day;}
export function validateTask(input){
  const title=String(input.title||'').trim(),equipment=String(input.equipment||'').trim(),skill=String(input.skill||'').trim();
  requireValue(title.length>0&&title.length<=150&&equipment.length>0&&equipment.length<=80&&skill.length>0&&skill.length<=40,'업무명·설비·필요 역량을 확인해주세요.');
  const minutes=Number(input.minutes),level=Number(input.level),priority=Number(input.priority);
  requireValue(Number.isInteger(minutes)&&minutes>=5&&minutes<=480&&Number.isInteger(level)&&level>=1&&level<=5&&Number.isInteger(priority)&&priority>=1&&priority<=5,'예상분은 5~480, 역량·우선순위는 1~5의 정수입니다.');
  const earliest=input.earliest||'09:00',deadline=input.deadline||'17:00';requireValue(minuteOfDay(earliest)<minuteOfDay(deadline),'시작 가능 시각은 마감보다 빨라야 합니다.');
  const location=String(input.location||'').trim(),details=String(input.details||'');requireValue(location.length<=150&&details.length<=4000,'장소는 150자, 상세 내용은 4,000자 이내입니다.');
  return{title,equipment,skill,minutes,level,priority,location,details,day:validDay(input.day),earliest,deadline,source:String(input.source||'직접 입력').slice(0,100)};
}
export function validateStaff(input){
  requireValue(input&&typeof input.id==='string'&&input.id.length<=80&&typeof input.name==='string'&&input.name.trim().length>0&&input.name.length<=80,'담당자 식별자와 이름을 확인해주세요.');
  requireValue(Number.isFinite(input.weight)&&input.weight>=0.1&&input.weight<=3&&Number.isInteger(input.maxMinutes)&&input.maxMinutes>=0&&input.maxMinutes<=720,'가중치는 0.1~3, 하루 용량은 0~720분입니다.');
  requireValue((input.active===undefined||typeof input.active==='boolean'),'활성 여부는 true 또는 false입니다.');
  requireValue(input.skills&&!Array.isArray(input.skills)&&Object.keys(input.skills).length<=20&&Object.entries(input.skills).every(([key,v])=>key.length<=40&&Number.isInteger(v)&&v>=0&&v<=5),'역량은 0~5 정수입니다.');
  requireValue(Array.isArray(input.windows)&&input.windows.length<=8,'근무 가능 구간을 확인해주세요.');
  const windows=input.windows.map(w=>({start:minuteOfDay(w.start),end:minuteOfDay(w.end)})).sort((a,b)=>a.start-b.start);
  requireValue(windows.every((w,i)=>w.start<w.end&&(!i||windows[i-1].end<=w.start)),'근무 구간은 겹치지 않는 시작·종료 시각이어야 합니다.');
  return structuredClone(input);
}
const overlaps=(start,end,other)=>start<minuteOfDay(other.end)&&end>minuteOfDay(other.start);
export function planDay({tasks,staff,bookings=[],day,includeOverdue=false}){
  validDay(day);requireValue(Array.isArray(tasks)&&tasks.length<=2000&&Array.isArray(staff)&&staff.length<=100,'업무·인원 수가 허용 범위를 초과했습니다.');
  staff.forEach(validateStaff);
  requireValue(new Set(staff.map(p=>p.id)).size===staff.length,'담당자 ID가 중복되었습니다.');
  requireValue(tasks.every(t=>typeof t.id==='string'&&t.id.length>0&&t.id.length<=200)&&new Set(tasks.map(t=>t.id)).size===tasks.length,'업무 ID가 없거나 중복되었습니다.');
  requireValue(Array.isArray(bookings)&&bookings.length<=10000,'기존 일정은 최대 10,000개입니다.');
  tasks.forEach(validateTask);
  const occupied=bookings.filter(b=>b.day===day).map(b=>{requireValue(minuteOfDay(b.start)<minuteOfDay(b.end),'기존 일정의 시작·종료 시각을 확인해주세요.');return structuredClone(b);});
  const load=Object.fromEntries(staff.map(p=>[p.id,occupied.filter(b=>b.personId===p.id).reduce((n,b)=>n+minuteOfDay(b.end)-minuteOfDay(b.start),0)]));
  const already=new Set(bookings.filter(b=>b.taskId).map(b=>b.taskId));
  const targets=tasks.filter(t=>t.status==='pending'&&!already.has(t.id)&&(t.day===day||(includeOverdue&&t.day<day))).map(t=>({...t,...validateTask(t)})).sort((a,b)=>b.priority-a.priority||a.deadline.localeCompare(b.deadline)||b.level-a.level||a.id.localeCompare(b.id));
  const assignments=[],unassigned=[];
  for(const task of targets){
    const qualified=staff.filter(p=>p.active!==false&&(p.skills[task.skill]||0)>=task.level);
    if(!qualified.length){unassigned.push({taskId:task.id,title:task.title,reason:'필요 역량을 충족하는 담당자가 없습니다.'});continue;}
    const candidates=[];
    for(const person of qualified){
      if(load[person.id]+task.minutes>person.maxMinutes)continue;
      let slot;
      for(const w of person.windows){
        const begin=Math.max(minuteOfDay(w.start),minuteOfDay(task.earliest)),end=Math.min(minuteOfDay(w.end),minuteOfDay(task.deadline));
        for(let start=begin;start+task.minutes<=end;start+=5){
          if(!occupied.some(b=>(b.personId===person.id||b.equipment===task.equipment)&&overlaps(start,start+task.minutes,b))){slot={start,end:start+task.minutes};break;}
        }
        if(slot)break;
      }
      if(slot)candidates.push({person,slot,score:load[person.id]/Math.max(1,person.maxMinutes*person.weight)+((person.skills[task.skill]||0)-task.level)*0.03});
    }
    candidates.sort((a,b)=>a.score-b.score||a.slot.start-b.slot.start||a.person.id.localeCompare(b.person.id));
    if(!candidates.length){unassigned.push({taskId:task.id,title:task.title,reason:'하루 용량·휴게·기존 일정·설비 중복·마감 조건 안에 빈 시간이 없습니다.'});continue;}
    const winner=candidates[0],booking={id:'booking:'+task.id,taskId:task.id,title:task.title,equipment:task.equipment,personId:winner.person.id,personName:winner.person.name,day,start:timeOfDay(winner.slot.start),end:timeOfDay(winner.slot.end),minutes:task.minutes,status:'scheduled',explanation:`${task.skill} ${winner.person.skills[task.skill]} ≥ ${task.level}; 가중치 ${winner.person.weight}; 배정 후 ${load[winner.person.id]+task.minutes}/${winner.person.maxMinutes}분`};
    occupied.push(booking);assignments.push(booking);load[winner.person.id]+=task.minutes;
  }
  return{day,includeOverdue,assignments,unassigned,loads:staff.map(p=>({id:p.id,name:p.name,minutes:load[p.id],capacity:p.maxMinutes,weight:p.weight})),rules:'우선순위 → 마감 → 필요 역량 순으로 처리. 적격자 중 현재 부하/(하루 용량×가중치)와 초과 역량 패널티를 비교. 가중치로 용량·시간·역량 제한을 넘지 않음.'};
}
