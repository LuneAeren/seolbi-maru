const $ = s => document.querySelector(s);
const icons = { home:'M3 10 12 3l9 7v10H3z M9 20v-7h6v7', equipment:'M4 4h16v12H4z M8 20h8 M12 16v4 M8 8h2 M14 8h2 M8 12h8', info:'M4 4h16v13H8l-4 4z M8 8h8 M8 12h5', folder:'M3 6h7l2 2h9v12H3z', link:'M9 15l6-6 M8 17l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0 M16 7l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0', clock:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', plus:'M12 5v14 M5 12h14', refresh:'M20 7a9 9 0 1 0 1 8 M20 2v5h-5', arrow:'M5 12h14 M14 7l5 5-5 5', chevron:'M9 5l7 7-7 7', check:'M5 12l4 4L19 6', pause:'M8 5v14 M16 5v14', tool:'M14 6l4 4 M4 20l11-11 M14 3a5 5 0 0 0 7 7', alert:'M12 3 2 21h20z M12 9v5 M12 17v1', close:'M6 6l12 12 M18 6 6 18', edit:'M15 4l5 5 M4 20l1-6L16 3l5 5L10 19z', download:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4', star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6' };
function icon(name) { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('class','icon'); svg.setAttribute('aria-hidden','true'); const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',icons[name]||icons.folder);svg.append(p);return svg; }
function h(tag, attrs = {}, ...children) { const e = document.createElement(tag); for (const [k,v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(),v); else if (k === 'class') e.className=v; else if (k === 'value') e.value=v; else if (k === 'disabled') e.disabled=Boolean(v); else if (k === 'checked') e.checked=Boolean(v); else if (v !== undefined && v !== null) e.setAttribute(k,String(v)); } for (const child of children.flat(Infinity)) if(child!==null && child!==undefined && child!==false) e.append(child instanceof Node ? child : document.createTextNode(String(child))); return e; }
const button = (label, action, cls='', glyph) => h('button',{type:'button',class:cls,onClick:action},h('span',{class:'button-content'},glyph?icon(glyph):null,label));
const fmt = value => value ? new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date(value)) : '기록 없음';
const shortTime = value => value ? new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date(value)) : '—';
let toastTimer;
function toast(message){ const e=$('#toast');e.textContent=message;e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.hidden=true,4000); }
const state={view:new URLSearchParams(location.search).get('view')||'today',data:{},filters:{status:'',area:'',q:'',sort:'attention'},selectedEquipmentId:null,boot:null};
async function api(url,options={}) {
  const headers={...options.headers};
  if(options.body&&typeof options.body!=='object')headers['Content-Type']||='application/json';
  if(options.method&&!['GET','HEAD'].includes(options.method))headers['X-CSRF-Token']=state.boot.csrf;
  const res=await fetch(url,{...options,headers,credentials:'same-origin'});
  if(!res.ok){
    let body;try{body=await res.json();}catch{body={error:'서버 응답을 확인할 수 없습니다.'};}
    if(body.code==='CSRF_REJECTED'){
      try{const renewed=await fetch('/api/bootstrap',{credentials:'same-origin'});if(renewed.ok){state.boot=await renewed.json();body.error='보안 세션이 갱신됐습니다. 입력 내용은 유지됩니다. 같은 버튼을 다시 눌러주세요.';}}catch{}
    }
    const error=new Error(body.error);error.status=res.status;error.code=body.code;throw error;
  }
  return res;
}
const json=async(url,options)=> (await api(url,options)).json();
const send=(url,method,body)=>json(url,{method,body:JSON.stringify(body)});
async function load(){ const values=await Promise.all(['equipment','info','note','dataset','site'].map(kind=>json(`/api/entities/${kind}`))); ['equipment','info','note','dataset','site'].forEach((kind,i)=>state.data[kind]=values[i]); state.boot.sources=await json('/api/sources'); }
const labelMap={today:'오늘 업무',equipment:'설비현황',info:'설비 인폼',materials:'업무자료',sites:'업무사이트',history:'변경 이력'};
function navigate(view){state.view=labelMap[view]?view:'today';state.filters={status:'',area:'',q:'',sort:'attention'};history.replaceState(null,'',state.view==='today'?'/':`/?view=${state.view}`);render();}
function nav(){ const n=$('#navigation');n.replaceChildren(); for(const [view,glyph]of [['today','home'],['equipment','equipment'],['info','info'],['materials','folder'],['sites','link'],['history','clock']]){if(view==='history')n.append(h('div',{class:'nav-divider'}));const a=h('a',{href:view==='today'?'/':`/?view=${view}`,class:`nav-item ${state.view===view?'active':''}`,'aria-current':state.view===view?'page':null,onClick:e=>{e.preventDefault();navigate(view);}},icon(glyph),labelMap[view]);if(view==='info')a.append(h('span',{class:'nav-count'},state.data.info?.length||0));n.append(a);} $('#source-mini').replaceChildren(...state.boot.sources.filter(x=>x.id!=='demo').map(s=>h('div',{class:'source-mini-row'},h('span',{class:'dot'}),s.name,h('small',{},'연결 대기')))); }
function heading(title,subtitle,actions=[],date=false){const d=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}).format(new Date());return h('div',{class:'page-heading'},h('div',{},date?h('div',{class:'date-label'},d):null,h('h1',{},title),h('p',{class:'subtitle'},subtitle)),h('div',{class:'heading-actions'},...actions));}
function panelTitle(title,count,action){return h('div',{class:'panel-heading'},h('h2',{},title,count!==undefined?h('span',{class:'count'},count):null),action);}
function badge(status){return h('span',{class:`status ${{운전:'running',정지:'stopped',점검:'maintenance'}[status]||''}`},h('span',{class:'dot'}),status);}
function notice(message,type=''){return h('div',{class:`notice ${type}`},icon(type==='error'?'alert':'shield'),message);}
function render(){nav();$('#breadcrumb').textContent=`워크스페이스 / ${labelMap[state.view]||'오늘 업무'}`;$('#identity').replaceChildren(h('span',{class:'avatar'},state.boot.mode==='demo'?'DE':'ME'),state.boot.mode==='demo'?'데모 엔지니어':state.boot.user);$('#mode-badge').textContent=state.boot.mode==='demo'?'샘플 데이터 · 데모':'사내 계정 연결';$('#footer-status').textContent=state.boot.mode==='demo'?'실제 설비 미연결 · 한국 시간 기준':'사내 서버 · 한국 시간 기준'; const main=$('#main'); main.replaceChildren(); main.classList.remove('desktop-workspace'); if(state.view==='today')renderToday(main);else if(state.view==='equipment')renderEquipment(main);else if(state.view==='info')renderInfo(main);else if(state.view==='materials')renderMaterials(main);else if(state.view==='sites')renderSites(main);else renderHistory(main); }
async function refresh(){try{await load();render();toast('화면의 서버 자료를 새로 불러왔습니다.');}catch(e){toast(e.message);}}
function shownStatus(e){return Date.now()-Date.parse(e.data.observedAt)>(state.boot.staleAfterMinutes||30)*60000?'확인불가':e.data.status;}
function metrics(){const eq=state.data.equipment;return h('div',{class:'metrics'},...[['운전','운전 중 설비','check',''],['정지','정지 설비','pause','red'],['점검','점검 중 설비','tool','amber'],['확인불가','상태 확인 필요','alert','gray']].map(([status,title,glyph,cls])=>h('button',{class:`metric ${cls} ${state.filters.status===status?'active':''}`,type:'button','data-status':status,'aria-pressed':state.filters.status===status,onClick:()=>{state.filters.status=state.filters.status===status?'':status;render();}},h('div',{class:'metric-top'},title,h('span',{class:'metric-icon'},icon(glyph))),h('div',{class:'metric-number'},eq.filter(x=>shownStatus(x)===status).length,h('small',{},'대')),h('div',{class:'metric-caption'},status==='확인불가'?`미수집 또는 ${state.boot.staleAfterMinutes||30}분 이상 경과`:`전체 ${eq.length}대 중 · 상태별 보기`))));}
function renderToday(main){
  main.classList.add('desktop-workspace');
  const date=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}).format(new Date());
  main.append(heading('오늘 업무 한눈에 보기',`${date} · 설비현황과 인수인계를 한 화면에서 확인하세요.`,[
    button('연동 상태',()=>modal('데이터 연동 상태',sourcePanel()),'','shield'),
    button('새로고침',refresh,'','refresh'),button('인폼 등록',()=>editEntity('info'),'primary','plus')
  ]));
  if(state.boot.mode==='demo')main.append(h('div',{class:'demo-strip'},h('span',{class:'demo-indicator'}),'샘플 데이터',h('span',{class:'muted'},'실제 설비 미연결 · Hue / Splunk 연결 대기'),h('span',{class:'grow'}),h('span',{},`전체 ${state.data.equipment.length}대`)));
  main.append(metrics(),equipmentWorkspace(true),quickDock());
}
function quickDock(){
  return h('section',{class:'quick-dock','aria-label':'자주 쓰는 업무사이트'},h('strong',{},'업무 바로가기'),
    ...state.data.site.slice(0,4).map(s=>h('a',{href:s.data.url},icon('link'),s.data.title,icon('chevron'))),
    button('전체 보기',()=>navigate('sites'),'text-button'));
}
function equipmentWorkspace(today){
  const inspector=h('aside',{class:'equipment-inspector',id:'equipment-inspector','aria-label':'선택한 설비 상세'});
  const workspace=h('div',{class:'equipment-workspace'},equipmentPanel(today),inspector);
  queueMicrotask(()=>refreshInspector());
  return workspace;
}
function refreshInspector(){
  const root=$('#equipment-inspector');if(!root)return;
  const visible=filteredEquipment();
  let e=visible.find(e=>e.id===state.selectedEquipmentId)||visible[0];
  if(!e){root.replaceChildren(h('div',{class:'inspector-empty'},icon('equipment'),h('h2',{},'설비를 선택해주세요'),h('p',{},'검색 조건을 바꾸면 다른 설비를 볼 수 있습니다.')));return;}
  state.selectedEquipmentId=e.id;
  document.querySelectorAll('.equipment-table tbody tr').forEach(row=>row.setAttribute('aria-selected',String(row.dataset.equipment===e.id)));
  const d=e.data,infos=activeInfos().filter(i=>!i.data.equipmentId||i.data.equipmentId===e.id),notes=state.data.note.filter(i=>i.data.equipmentId===e.id);
  root.replaceChildren(
    h('div',{class:'inspector-heading'},h('span',{class:'eyebrow'},'선택 설비'),button('상세 열기',()=>showEquipment(e),'text-button','arrow')),
    h('div',{class:'inspector-overview'},h('div',{class:'flex'},h('span',{class:'equipment-code grow'},e.id),badge(shownStatus(e))),h('h2',{},d.title),h('p',{class:'muted'},d.area),
      h('dl',{class:'inspector-facts'},h('div',{},h('dt',{},'데이터 출처'),h('dd',{},d.source)),h('div',{},h('dt',{},'기준 시각'),h('dd',{},fmt(d.observedAt)))),
      shownStatus(e)!==d.status?notice(`기준 시각 경과 · 이전 상태 ${d.status}`,'warning'):null),
    h('div',{class:'inspector-scroll'},
      h('div',{class:'inspector-section-title'},h('h3',{},'관련 인폼'),h('span',{class:'count'},infos.length)),
      infos.length?infos.slice(0,3).map(i=>h('article',{class:'inspector-info'},h('div',{class:'info-meta'},h('span',{class:'tag'},i.data.category)),button(i.data.title,()=>showInfo(i),'inspector-info-title'),h('p',{},i.data.body))):h('p',{class:'small muted'},'등록된 인폼이 없습니다.'),
      h('div',{class:'inspector-section-title'},h('h3',{},'작업 메모'),button('추가',()=>editEntity('note',null,e.id),'text-button','plus')),
      notes.length?notes.map(n=>h('article',{class:'inspector-note'},h('div',{class:'flex'},h('span',{class:'tag'},n.data.category),button('편집',()=>editEntity('note',n),'text-button')),h('strong',{},n.data.title),h('p',{},n.data.body))):h('div',{class:'note-empty'},'작성된 메모가 없습니다.',h('span',{},'확인한 내용이나 다음 작업을 남겨보세요.'))),
    h('div',{class:'inspector-actions'},button('작업 메모 작성',()=>editEntity('note',null,e.id),'primary full','edit'))
  );
}
function filteredEquipment(){
  const q=state.filters.q.toLowerCase(),order={'확인불가':0,'정지':1,'점검':2,'운전':3};
  const records=state.data.equipment.filter(e=>(!state.filters.status||shownStatus(e)===state.filters.status)&&(!state.filters.area||e.data.area===state.filters.area)&&(!q||[e.id,e.data.title,e.data.area].some(x=>x.toLowerCase().includes(q))));
  return records.sort((a,b)=>state.filters.sort==='name'?a.data.title.localeCompare(b.data.title,'ko'):state.filters.sort==='recent'?b.data.observedAt.localeCompare(a.data.observedAt):order[shownStatus(a)]-order[shownStatus(b)]||a.id.localeCompare(b.id));
}
function activeInfos(){const now=Date.now();return state.data.info.filter(x=>Date.parse(x.data.effectiveAt)<=now&&(!x.data.expiresAt||Date.parse(x.data.expiresAt)>now));}
function infoItem(item){return h('div',{class:'info-item'},h('div',{class:'info-meta'},h('span',{class:'tag'},item.data.category),fmt(item.updatedAt)),h('button',{class:'info-title',onClick:()=>showInfo(item)},item.data.title),h('p',{},item.data.body));}
function sourcePanel(){
  const rows=state.boot.sources.map(s=>h('tr',{},
    h('td',{},s.name),
    h('td',{},h('span',{class:'source-state'},s.state==='sample'?'샘플':s.state==='disabled'?'미연결':s.state==='ok'?'정상':s.state==='error'?'갱신 실패':s.state)),
    h('td',{},fmt(s.lastSuccess)),h('td',{},s.count===null?'—':`${s.count}건`)));
  const head=h('thead',{},h('tr',{},...['데이터 출처','상태','최종 반영','건수'].map(x=>h('th',{},x))));
  return h('section',{class:'panel section-gap'},panelTitle('연동 상태',undefined,h('span',{class:'small muted'},'최종 정상 반영 기준')),
    h('div',{class:'table-scroll'},h('table',{class:'source-table'},head,h('tbody',{},rows))));
}
function renderEquipment(main){
  main.classList.add('desktop-workspace');
  main.append(heading('설비현황','표에서 설비를 선택하면 오른쪽에 관련 인폼과 작업 메모가 표시됩니다.',[button('설비 등록',()=>editEntity('equipment'),'primary','plus')]),metrics(),equipmentWorkspace(false));
}
function equipmentPanel(today){
  const wrap=h('section',{class:'panel equipment-list-panel'}),tbody=h('tbody'),counter=h('span'),empty=h('div',{class:'empty',hidden:true},'검색 조건에 맞는 설비가 없습니다.');
  wrap.append(panelTitle('설비별 현황',state.data.equipment.length,h('span',{class:'small muted'},'행 선택 → 오른쪽 상세')));
  const search=h('input',{type:'search',placeholder:'설비명 · 번호 검색  /','aria-label':'설비 검색',value:state.filters.q});
  const area=h('select',{'aria-label':'설비 구역'},h('option',{value:''},'전체 구역'),...[...new Set(state.data.equipment.map(e=>e.data.area))].sort().map(a=>h('option',{value:a},a)));area.value=state.filters.area;
  const status=h('select',{'aria-label':'설비 상태'},h('option',{value:''},'전체 상태'),...state.boot.statuses.map(s=>h('option',{value:s},s)));status.value=state.filters.status;
  const sort=h('select',{'aria-label':'설비 정렬'},h('option',{value:'attention'},'확인 필요 우선'),h('option',{value:'name'},'설비명순'),h('option',{value:'recent'},'최근 기준순'));sort.value=state.filters.sort||'attention';
  function update(){
    const records=filteredEquipment();
    tbody.replaceChildren(...records.map(e=>h('tr',{'data-equipment':e.id,'aria-selected':String(e.id===state.selectedEquipmentId),onClick:()=>{state.selectedEquipmentId=e.id;refreshInspector();}},
      h('td',{class:'equipment-number'},e.id),
      h('td',{},h('button',{class:'row-open','aria-label':`${e.data.title} ${e.id}`,onClick:()=>{state.selectedEquipmentId=e.id;refreshInspector();}},h('span',{class:'equipment-name'},e.data.title))),
      h('td',{},e.data.area),h('td',{},badge(shownStatus(e))),
      h('td',{class:'muted'},fmt(e.data.observedAt)),h('td',{},icon('chevron')))));
    document.querySelectorAll('.metric[data-status]').forEach(m=>{const active=m.dataset.status===state.filters.status;m.setAttribute('aria-pressed',String(active));m.classList.toggle('active',active);});
    counter.textContent=`검색 결과 ${records.length}대 / 전체 ${state.data.equipment.length}대`;empty.hidden=records.length>0;refreshInspector();
  }
  search.addEventListener('input',()=>{state.filters.q=search.value;update();});
  for(const [control,key]of [[area,'area'],[status,'status'],[sort,'sort']])control.addEventListener('change',()=>{state.filters[key]=control.value;update();});
  const reset=button('초기화',()=>{state.filters={status:'',area:'',q:'',sort:'attention'};render();},'text-button');
  wrap.append(h('div',{class:'toolbar equipment-toolbar'},h('div',{class:'search'},icon('search'),search),area,status),h('div',{class:'table-subtoolbar'},counter,h('div',{class:'flex'},reset,sort)));
  const head=h('thead',{},h('tr',{},...['설비번호','설비명','구역','현재 상태','기준 시각',''].map(label=>h('th',{},label))));
  const scroll=h('div',{class:'table-scroll equipment-table-scroll'},h('table',{class:'equipment-table'},head,tbody),empty);
  wrap.append(scroll,h('div',{class:'table-foot'},h('span',{},'기준 경과 데이터는 확인불가로 구분'),h('span',{class:'keyboard-hint'},'/ 검색 · 행 선택으로 상세 확인')));
  update();return wrap;
}
let closeGuard=null;
function closeDialog(){if(closeGuard)closeGuard();else $('#dialog').close();}
function modal(title,body,actions=[]){closeGuard=null;$('#dialog').classList.toggle('wide-dialog',title.includes('점검표')||Boolean(body.querySelector('.editor-wrap')));const dialog=$('#dialog');$('#dialog-content').replaceChildren(h('div',{class:'dialog-header'},h('h2',{id:'dialog-title'},title),button('닫기',closeDialog,'quiet','close')),h('div',{class:'dialog-body'},body),actions.length?h('div',{class:'dialog-footer'},actions):null);if(!dialog.open)dialog.showModal();return dialog;}
function showEquipment(e){const d=e.data;const body=h('div',{},h('div',{class:'meta-line'},h('span',{},e.id),badge(shownStatus(e)),h('span',{},`버전 ${e.version}`)),h('div',{class:'detail-grid'},...[["구역",d.area],["출처",d.source],["기준 시각",fmt(d.observedAt)]].map(([k,v])=>h('div',{class:'detail-fact'},k,h('strong',{},v)))),h('p',{class:'detail-text'},d.summary||'등록된 설비 설명이 없습니다.'));body.append(h('h3',{class:'section-title'},'설비 인폼'));const infos=activeInfos().filter(x=>x.data.equipmentId===e.id||!x.data.equipmentId);body.append(...infos.map(x=>h('div',{class:'detail-info'},h('strong',{},x.data.title),h('p',{},x.data.body))));body.append(h('div',{class:'flex section-title'},h('h3',{class:'grow'},'작업 메모'),button('메모 추가',()=>editEntity('note',null,e.id),'','plus')));const notes=state.data.note.filter(x=>x.data.equipmentId===e.id);body.append(...notes.map(x=>h('div',{class:'detail-info'},h('div',{class:'flex'},h('strong',{class:'grow'},x.data.title),h('span',{class:'tag'},x.data.category),button('편집',()=>editEntity('note',x),'text-button')),h('p',{},x.data.body))));if(!notes.length)body.append(h('p',{class:'small muted'},'아직 작성된 메모가 없습니다.'));modal(d.title,body,[button('변경 이력',()=>showHistory(e)),['hue','splunk'].includes(d.source)?button('작업 메모 추가',()=>editEntity('note',null,e.id),'primary','plus'):button('설비 정보 편집',()=>editEntity('equipment',e),'primary','edit')]);}
function showInfo(e){modal(e.data.title,h('div',{},h('div',{class:'meta-line'},h('span',{class:'tag'},e.data.category),fmt(e.updatedAt),e.updatedBy),h('p',{class:'detail-text'},e.data.body),h('p',{class:'helper'},`적용: ${fmt(e.data.effectiveAt)} · 만료: ${e.data.expiresAt?fmt(e.data.expiresAt):'지정 없음'}`)),[button('변경 이력',()=>showHistory(e)),button('편집',()=>editEntity(e.kind,e),'primary','edit')]);}
function field(label,type,value='',options){let input;if(type==='textarea')input=h('textarea',{},value);else if(type==='select')input=h('select',{},...options.map(o=>h('option',{value:typeof o==='string'?o:o[0]},typeof o==='string'?o:o[1])));else input=h('input',{type,value,required:!label.includes('선택')});input.value=value;return {node:h('label',{class:'field'},h('span',{class:'field-label'},label),input),input};}
function inlineError(container,error){let e=container.querySelector('.inline-error');if(!e){e=h('div',{class:'inline-error',role:'alert'});container.prepend(e);}e.textContent=error.message;}
function localDate(iso){const date=new Date(iso||Date.now());return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function editEntity(kind,entity=null,equipmentId=''){
  const d=entity?.data||{},form=h('form',{}),fields={};
  const add=(key,label,type='text',value='',options)=>{const f=field(label,type,value,options);fields[key]=f.input;form.append(f.node);};
  add('title','제목','text',d.title||'');fields.title.maxLength=150;
  if(kind==='equipment'){
    add('area','구역','text',d.area||''); add('status','상태','select',d.status||'확인불가',state.boot.statuses);add('observedAt','기준 시각 (이 PC 시간)','datetime-local',localDate(d.observedAt));add('source','출처','text',d.source||'수동 입력');add('summary','설명 (선택)','textarea',d.summary||'');
  }else if(kind==='site'){
    add('category','분류','text',d.category||'공통');add('url','사내 주소','text',d.url||'');form.append(h('p',{class:'helper'},'상대 경로 또는 운영자가 허용한 사내 호스트만 등록할 수 있습니다.'));add('description','설명 (선택)','textarea',d.description||'');
  }else if(kind==='dataset'){
    add('category','분류','text',d.category||'공통');add('description','설명 (선택)','textarea',d.description||'');
  }else{
    add('category',kind==='note'?'처리 상태':'분류','select',d.category||(kind==='note'?'미완료':'인폼'),kind==='note'?['미완료','진행 중','완료']:['인폼','점검','인수인계','자료','기타']);
    add('body','내용 (선택)','textarea',d.body||'');add('equipmentId','연결 설비 (선택)','select',d.equipmentId||equipmentId,[['','공통'],...state.data.equipment.map(e=>[e.id,e.data.title])]);add('effectiveAt','적용 시각 (이 PC 시간)','datetime-local',localDate(d.effectiveAt));add('expiresAt','만료 시각 (선택, 이 PC 시간)','datetime-local',d.expiresAt?localDate(d.expiresAt):'');fields.expiresAt.required=false;
  }
  add('reason','변경 사유','text',entity?'내용 수정':'새 자료 등록');fields.reason.maxLength=300;
  const save=button('저장',()=>form.requestSubmit(),'primary','check');
  form.addEventListener('submit',async ev=>{ev.preventDefault();save.disabled=true;try{const data={};for(const [key,input]of Object.entries(fields))if(key!=='reason')data[key]=input.value;for(const key of ['effectiveAt','expiresAt','observedAt'])if(data[key])data[key]=new Date(data[key]).toISOString();const body={data,reason:fields.reason.value,version:entity?.version};await send(`/api/entities/${kind}${entity?'/'+entity.id:''}`,entity?'PUT':'POST',body);$('#dialog').close();await load();render();toast('저장했습니다.');}catch(e){inlineError(form,e);}finally{save.disabled=false;}});
  modal(`${entity?'편집':'등록'} · ${{equipment:'설비',site:'업무사이트',info:'설비 인폼',note:'작업 메모',dataset:'자료 정보'}[kind]}`,form,[entity?button('삭제',()=>deleteEntity(entity),'danger'):null,button('취소',()=>$('#dialog').close()),save].filter(Boolean));
}
function deleteEntity(e){const body=h('div',{},h('p',{},`“${e.data.title}” 자료를 삭제 상태로 바꿉니다. 변경 이력에서 복구할 수 있습니다.`));const reason=field('삭제 사유','text','자료 정리');body.append(h('div',{class:'spaced'},reason.node));modal('자료 삭제',body,[button('취소',()=>$('#dialog').close()),button('삭제',async()=>{try{await send(`/api/entities/${e.kind}/${e.id}`,'DELETE',{version:e.version,reason:reason.input.value});$('#dialog').close();await load();render();toast('삭제했습니다. 변경 이력에서 복구할 수 있습니다.');}catch(error){inlineError(body,error);}},'danger')]);}
function renderInfo(main){main.append(heading('설비 인폼','설비별 안내와 인수인계 사항을 공유하세요.',[button('인폼 등록',()=>editEntity('info'),'primary','plus')]));const filter=h('select',{'aria-label':'인폼 범위'},h('option',{value:'active'},'현재 적용 중'),h('option',{value:'all'},'전체 인폼'));const list=h('section',{class:'panel spaced'});function update(){const records=filter.value==='all'?state.data.info:activeInfos();list.replaceChildren(...records.map(e=>h('article',{class:'big-info'},h('div',{class:'meta-line'},h('span',{class:'tag'},e.data.category),e.data.equipmentId?state.data.equipment.find(x=>x.id===e.data.equipmentId)?.data.title||'연결 설비 없음':'공통',fmt(e.updatedAt)),h('h3',{class:'spaced'},e.data.title),h('p',{},e.data.body),h('div',{class:'flex'},h('span',{class:'grow small muted'},e.updatedBy),button('이력',()=>showHistory(e),'text-button'),button('편집',()=>editEntity('info',e),'text-button','edit')))));if(!records.length)list.append(h('div',{class:'empty'},'등록된 인폼이 없습니다.'));}filter.addEventListener('change',update);main.append(h('div',{class:'toolbar'},filter),list);update();}
function renderMaterials(main){main.append(heading('업무자료','CSV·엑셀을 표로 살펴보고 필요한 내용을 편집하세요.',[button('파일 가져오기',showImport,'primary','plus')]));const wrap=h('section',{class:'panel'});wrap.append(panelTitle('공유 자료',state.data.dataset.length));const input=h('input',{type:'search',placeholder:'제목 또는 분류 검색','aria-label':'자료 검색'});const tbody=h('tbody');function update(){const q=input.value.toLowerCase();const records=state.data.dataset.filter(e=>[e.data.title,e.data.category].some(x=>x.toLowerCase().includes(q)));tbody.replaceChildren(...records.map(e=>h('tr',{},h('td',{},h('button',{class:'row-open',onClick:()=>openEditor(e)},h('span',{class:'equipment-name'},e.data.title),h('span',{class:'equipment-id'},e.data.description||'설명 없음'))),h('td',{},h('span',{class:'tag'},e.data.category)),h('td',{},`${e.data.rowCount.toLocaleString()}행 · ${e.data.columns.length}열`),h('td',{},`v${e.version}`),h('td',{class:'muted'},fmt(e.updatedAt)),h('td',{},button('표 열기',()=>openEditor(e),'text-button'),button('정보',()=>editEntity('dataset',e),'text-button')))));}input.addEventListener('input',update);wrap.append(h('div',{class:'toolbar'},h('div',{class:'search'},icon('search'),input)),h('div',{class:'table-scroll'},h('table',{},h('thead',{},h('tr',{},...['자료명','분류','크기','버전','최근 수정',''].map(x=>h('th',{},x)))),tbody)));if(!state.data.dataset.length)wrap.append(h('div',{class:'empty'},'파일을 가져와 첫 업무자료를 등록하세요.'));main.append(wrap);update();}
function favoriteIds(){try{return JSON.parse(localStorage.getItem('seolbi-favorites')||'[]');}catch{return [];}}
function renderSites(main){main.append(heading('업무사이트','자주 쓰는 사내 시스템으로 빠르게 이동하세요.',[button('사이트 등록',()=>editEntity('site'),'primary','plus')]));const fav=favoriteIds(),grid=h('div',{class:'link-grid'});for(const e of [...state.data.site].sort((a,b)=>Number(fav.includes(b.id))-Number(fav.includes(a.id)))){const star=button(fav.includes(e.id)?'즐겨찾기 해제':'즐겨찾기',()=>{const next=fav.includes(e.id)?fav.filter(id=>id!==e.id):[...fav,e.id];try{localStorage.setItem('seolbi-favorites',JSON.stringify(next));render();}catch{toast('이 브라우저에서 개인 설정을 저장할 수 없습니다.');}},`quiet ${fav.includes(e.id)?'star':''}`,'star');grid.append(h('article',{class:'link-card'},h('div',{class:'link-card-header'},h('span',{class:'metric-icon'},icon('link')),h('h3',{},e.data.title)),h('span',{class:'tag'},e.data.category),h('p',{class:'spaced'},e.data.description),h('div',{class:'link-actions'},h('a',{class:'inline-link',href:e.data.url},'사이트 열기 ↗'),button('편집',()=>editEntity('site',e),'text-button','edit')),star));}if(!state.data.site.length)grid.append(h('div',{class:'empty'},'등록된 업무사이트가 없습니다.'));main.append(grid);}
async function showHistory(entity){const body=h('div',{},h('p',{class:'helper'},'최대 최근 100개 버전 · 이전 버전 복구도 새 변경 이력으로 남습니다.'));modal(`${entity.data.title} · 변경 이력`,body);try{const records=await json(`/api/entities/${entity.kind}/${entity.id}/history`);const reason=field('복구 사유','text','이전 버전 복구');body.append(h('div',{class:'spaced'},reason.node),h('div',{class:'history-list'},...records.map(r=>h('div',{class:'history-item'},h('span',{class:'badge-count'},`v${r.version}`),h('div',{class:'grow'},h('strong',{},r.reason,r.deleted?' · 삭제':''),h('p',{},`${fmt(r.at)} · ${r.actor}`)),r.version!==entity.version&&!r.deleted?button('이 버전 복구',async()=>{try{await send(`/api/entities/${entity.kind}/${entity.id}/restore`,'POST',{version:entity.version,targetVersion:r.version,reason:reason.input.value});$('#dialog').close();await load();render();toast('이전 버전으로 복구했습니다.');}catch(e){inlineError(body,e);}}):h('span',{class:'small muted'},r.version===entity.version?'현재 버전':'')))));}catch(e){inlineError(body,e);}}
async function renderHistory(main){
  main.append(heading('변경 이력','공유 자료의 변경 내역을 확인하고 삭제된 자료를 복구하세요.'));
  const body=h('section',{class:'panel'},h('div',{class:'loading'},'이력을 불러오고 있습니다…'));main.append(body);
  try{
    const groups=await Promise.all(['equipment','info','note','site','dataset'].map(kind=>json(`/api/entities/${kind}?deleted=1`)));
    if(state.view!=='history')return;
    const rows=groups.flat().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(e=>h('tr',{},
      h('td',{},e.data.title,e.deleted?h('span',{class:'deleted-label'},' · 삭제됨'):null),h('td',{},e.kind),h('td',{},`v${e.version}`),h('td',{},e.updatedBy),h('td',{},fmt(e.updatedAt)),h('td',{},button('이력 보기',()=>showHistory(e),'text-button'))));
    const head=h('thead',{},h('tr',{},...['대상','종류','버전','수정자','수정 시각',''].map(x=>h('th',{},x))));
    body.replaceChildren(h('div',{class:'table-scroll'},h('table',{},head,h('tbody',{},rows))));
  }catch(e){body.replaceChildren(notice(e.message,'error'));}
}
async function openEditor(entity){
  const changes=new Map();let version=entity.version,page=1,query='',current=null,locked=false;
  const body=h('div'),status=h('span',{class:'unsaved'},'저장된 공유본'),errbox=h('div'),tableWrap=h('div',{class:'editor-wrap'}),pager=h('div',{class:'table-foot'});
  const search=h('input',{type:'search',placeholder:'표 안에서 검색','aria-label':'표 내용 검색'}),reason=h('input',{type:'text',value:'표 데이터 수정',placeholder:'변경 사유','aria-label':'표 변경 사유',maxlength:300});
  const save=button('공유본 저장',async()=>{save.disabled=true;try{const result=await send(`/api/datasets/${entity.id}/rows`,'PATCH',{version,changes:[...changes.values()],reason:reason.value});version=result.version;entity=result;changes.clear();locked=false;await draw();await load();render();toast('공유본을 저장했습니다.');}catch(e){inlineError(errbox,e);if(e.status===409){locked=true;updateStatus();}}finally{save.disabled=locked||!changes.size;}},'primary','check');
  const updateStatus=()=>{status.textContent=locked?'수정 충돌 · 최신 자료를 다시 열어주세요':changes.size?`미저장 ${changes.size}개 셀`:`공유본 v${version}`;save.disabled=locked||!changes.size;};
  async function draw(){const result=await json(`/api/datasets/${entity.id}/rows?page=${page}&q=${encodeURIComponent(query)}`);current=result;if(changes.size&&result.version!==version){locked=true;inlineError(errbox,new Error('다른 사용자가 수정했습니다. 입력 내용은 이 화면에 유지됩니다. 최신 자료를 다시 열어 비교해주세요.'));}else if(!changes.size)version=result.version;tableWrap.replaceChildren(h('table',{class:'editor'},h('thead',{},h('tr',{},h('th',{},'#'),...result.data.columns.map(c=>h('th',{},c)))),h('tbody',{},...result.rows.map(row=>h('tr',{},h('td',{class:'row-number'},row.index+1),...row.cells.map((value,col)=>{const key=`${row.index}:${col}`,input=h('input',{type:'text',value:changes.get(key)?.value??value,'aria-label':`${row.index+1}행 ${result.data.columns[col]}`,maxlength:8000,disabled:locked});const cell=h('td',{class:changes.has(key)?'changed':''},input);input.addEventListener('input',()=>{if(input.value===value)changes.delete(key);else changes.set(key,{row:row.index,col,value:input.value});cell.classList.toggle('changed',changes.has(key));updateStatus();});return cell;}))))));pager.replaceChildren(h('span',{},`${result.total.toLocaleString()}행 · ${result.page}/${result.pages}페이지`),h('div',{class:'table-footer-actions'},button('이전',()=>{page--;draw().catch(e=>inlineError(errbox,e));}),button('다음',()=>{page++;draw().catch(e=>inlineError(errbox,e));})));pager.querySelectorAll('button')[0].disabled=page<=1;pager.querySelectorAll('button')[1].disabled=page>=result.pages;updateStatus();}
  async function exportFile(format){try{const res=changes.size?await api(`/api/datasets/${entity.id}/export`,{method:'POST',body:JSON.stringify({version,changes:[...changes.values()],format})}):await api(`/api/datasets/${entity.id}/download/${format}?version=${version}`);await saveBlob(res,`${entity.data.title}.${format}`);toast(changes.size?'현재 수정본을 파일로 받았습니다. 공유본은 바뀌지 않았습니다.':'파일을 내려받았습니다.');}catch(e){inlineError(errbox,e);}}
  search.addEventListener('change',()=>{query=search.value;page=1;draw().catch(e=>inlineError(errbox,e));});
  body.append(notice('새 파일 다운로드는 공유본을 바꾸지 않습니다. CSV는 수식 실행 방지를 위해 일부 값에 작은따옴표가 붙을 수 있습니다. XLSX는 문자열로 저장합니다.'),errbox,h('div',{class:'editor-toolbar'},search,status,button('최신 자료 다시 열기',()=>confirmDiscard(()=>json(`/api/entities/dataset/${entity.id}`).then(openEditor).catch(e=>toast(e.message))))),tableWrap,pager,h('div',{class:'editor-toolbar spaced'},reason));
  const actions=[button('변경 이력',()=>confirmDiscard(()=>showHistory(entity))),button('CSV 다운로드',()=>exportFile('csv'),'','download'),button('엑셀 다운로드',()=>exportFile('xlsx'),'','download'),save];if(entity.data.originalId)actions.unshift(button('원본 다운로드',async()=>{try{await saveBlob(await api(`/api/datasets/${entity.id}/download/original`),entity.data.title+'.'+(entity.data.sheet==='CSV'?'csv':'xlsx'));}catch(e){inlineError(errbox,e);}}));function installClose(){closeGuard=()=>confirmDiscard(()=>$('#dialog').close());}
  function confirmDiscard(next){if(!changes.size){closeGuard=null;next();return;}modal('미저장 수정 확인',h('p',{},'저장하지 않은 수정 내용이 있습니다. 현재 수정본을 파일로 내려받거나 공유본에 저장한 뒤 나갈 수 있습니다.'),[button('계속 편집',()=>{modal(entity.data.title,body,actions);installClose();}),button('수정 버리고 계속',()=>{closeGuard=null;next();},'danger')]);}
  modal(entity.data.title,body,actions);installClose();try{await draw();}catch(e){inlineError(errbox,e);}
}
async function saveBlob(res,name){const blob=await res.blob(),url=URL.createObjectURL(blob),a=h('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showImport(){
  const body=h('div'),file=h('input',{type:'file',accept:'.csv,.xlsx','aria-label':'가져올 CSV 또는 엑셀 파일'}),encoding=field('CSV 인코딩','select','utf-8',[['utf-8','UTF-8'],['euc-kr','한국어 Windows (CP949 / EUC-KR)']]);
  const area=h('div',{class:'import-area'},icon('folder'),h('h3',{class:'spaced'},'업무자료를 가져오세요'),h('p',{},'CSV · XLSX / 파일당 최대 5MB'),file);body.append(area,encoding.node,notice('원본은 서버에 보관합니다. 매크로·외부 링크·포함 개체는 지원하지 않으며, 회사에서 승인한 파일만 사용하세요.'));
  const next=button('검증 및 미리보기',async()=>{if(!file.files[0]){inlineError(body,new Error('파일을 선택해주세요.'));return;}next.disabled=true;try{const f=file.files[0];if(f.size>state.boot.limits.bytes)throw new Error('5MB 이하 파일을 선택해주세요.');const res=await json(`/api/imports?filename=${encodeURIComponent(f.name)}&encoding=${encoding.input.value}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:f});previewImport(res);}catch(e){inlineError(body,e);next.disabled=false;}},'primary','arrow');modal('파일 가져오기',body,[button('취소',()=>$('#dialog').close()),next]);
}
function previewImport(draft){const body=h('div'),title=field('자료 제목','text',draft.filename.replace(/\.(csv|xlsx)$/i,'')),category=field('분류','text','업무자료'),sheetSelect=field('시트 선택','select','0',draft.sheets.map((s,i)=>[String(i),`${s.name} · ${s.rowCount.toLocaleString()}행`])),mapping=h('div',{class:'mapping'}),preview=h('div',{class:'editor-wrap'});let columnInputs=[];function update(){const sheet=draft.sheets[Number(sheetSelect.input.value)];columnInputs=sheet.columns.map(c=>h('input',{type:'text',value:c,maxlength:100,'aria-label':`열 이름 ${c}`}));mapping.replaceChildren(...columnInputs.map((input,i)=>h('label',{class:'field'},h('span',{class:'field-label'},`원본: ${sheet.columns[i]}`),input)));preview.replaceChildren(h('table',{},h('thead',{},h('tr',{},...sheet.columns.map(c=>h('th',{},c)))),h('tbody',{},...sheet.rows.map(row=>h('tr',{},...row.map(x=>h('td',{},x)))))));}sheetSelect.input.addEventListener('change',update);body.append(notice('전체 파일 검증을 통과했습니다. 표시된 미리보기는 첫 10행입니다. 사용할 시트와 열 이름을 확인해주세요.'),...draft.warnings.map(w=>notice(w,'warning')),h('div',{class:'form-row'},title.node,category.node),sheetSelect.node,h('h3',{class:'section-title'},'열 이름 매핑'),mapping,h('h3',{class:'section-title'},'원본 미리보기'),preview);const commit=button('자료 등록',async()=>{commit.disabled=true;try{const entity=await send(`/api/imports/${draft.id}/commit`,'POST',{sheet:Number(sheetSelect.input.value),title:title.input.value,category:category.input.value,columns:columnInputs.map(i=>i.value.trim())});await load();state.view='materials';render();openEditor(entity);toast('자료를 등록했습니다.');}catch(e){inlineError(body,e);commit.disabled=false;}},'primary','check');modal('반입 미리보기',body,[button('취소',()=>$('#dialog').close()),commit]);update();}
$('#dialog').addEventListener('cancel',event=>{if(closeGuard){event.preventDefault();closeGuard();}});

function applyTextSize(value){
  const size=['16','18','20'].includes(value)?value:'16';document.documentElement.dataset.textSize=size;$('#text-size').value=size;
}
try{applyTextSize(localStorage.getItem('seolbi-text-size')||'16');}catch{applyTextSize('16');}
$('#text-size').addEventListener('change',event=>{applyTextSize(event.target.value);try{localStorage.setItem('seolbi-text-size',event.target.value);}catch{}});
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!$('#dialog').open&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){const input=$('input[type="search"]');if(input){event.preventDefault();input.focus();}}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&$('#dialog').open&&$('#dialog .editor-wrap')){event.preventDefault();const save=[...$('#dialog').querySelectorAll('button')].find(b=>b.textContent.trim()==='공유본 저장');if(save&&!save.disabled)save.click();}
});

try{state.boot=await json('/api/bootstrap');await load();render();}catch(e){$('#main').replaceChildren(heading('업무 공간에 연결하지 못했습니다.','사내 인증 또는 서버 상태를 확인해주세요.'),notice(e.message,'error'),button('다시 시도',()=>location.reload(),'primary','refresh'));$('#mode-badge').textContent='연결 확인 필요';}
