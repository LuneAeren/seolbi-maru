/* Local, deterministic UI description. No image recognition or network calls. */
(function(root){
'use strict';
const W=1000,H=640;
const TYPES={er:'ER 맵',line:'선그래프',table:'데이터 테이블',filter:'필터 바',kpi:'요약 카드',sidebar:'사이드바',header:'상단 바',detail:'상세 패널',button:'버튼',region:'사용자 영역'};
const TERMS=[
 ['sidebar','사이드바','Sidebar','화면 옆에서 메뉴와 카테고리를 고르는 영역','왼쪽에 고정하고 접고 펼칠 수 있게'],
 ['header','상단 바','Header / App bar','제목과 공통 동작을 배치하는 상단 영역','제목은 왼쪽, 주요 동작은 오른쪽에'],
 ['filter','필터 바','Filter bar','기간·설비·상태로 표시 대상을 좁히는 영역','선택 조건을 그래프 위에 모아서 표시'],
 ['kpi','요약 카드','KPI card','한 가지 중요한 수량·상태를 요약하는 카드','오늘 업무 수량과 단위를 크게 표시'],
 ['table','데이터 테이블','Data table','행과 열로 값을 비교하는 표','열 제목을 고정하고 정렬·필터 제공'],
 ['detail','상세 패널','Detail panel','선택한 항목의 자세한 내용을 보는 영역','선택한 측정점의 ID·좌표·값을 표시'],
 ['detail','드로어','Drawer','화면 가장자리에서 열고 닫는 보조 패널','항목을 누르면 오른쪽에서 상세 열기'],
 ['detail','모달','Modal dialog','배경 작업을 잠시 멈추고 확인하는 대화상자','저장 전 변경 내용을 확인하고 취소 가능하게'],
 ['region','탭','Tabs','같은 위치에서 관련 화면을 전환하는 묶음','맵과 추이를 탭으로 전환'],
 ['region','아코디언','Accordion','필요한 구역만 펼쳐 보는 접이식 목록','세부 조건은 접어 두고 필요할 때 펼치기'],
 ['region','툴팁','Tooltip','대상 위에서 짧은 설명을 보여주는 보조 표시','단위나 계산 기준을 짧게 설명'],
 ['region','토스트','Toast','작업 결과를 잠깐 알려주는 비차단 메시지','저장 결과를 알리고 화면 작업을 이어가기'],
 ['region','빈 상태','Empty state','조회 결과가 없을 때 다음 행동을 안내하는 표시','데이터 없음과 조회 실패를 구분'],
 ['region','스켈레톤','Skeleton','로딩 중 콘텐츠 위치를 예고하는 자리 표시','조회 중인 영역에만 로딩 표시'],
 ['region','분할 화면','Split view','목록과 상세 등을 나란히 보여주는 배치','왼쪽 60% 맵, 오른쪽 40% 표'],
 ['button','주요 버튼','Primary action','화면에서 가장 중요한 실행 버튼','한 화면에 주요 동작을 하나만 강조']
];
const clone=v=>JSON.parse(JSON.stringify(v));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
function num(v,min,max){if(typeof v!=='number'||!Number.isFinite(v))throw Error('위치와 크기는 유한한 숫자여야 합니다.');return Math.max(min,Math.min(max,Math.round(v)));}
function normalize(input){
 if(!input||input.version!==1||!Array.isArray(input.blocks)||input.blocks.length>30)throw Error('지원하는 배치 JSON이 아닙니다. 영역은 최대 30개입니다.');
 const ids=new Set();
 const blocks=input.blocks.map(b=>{
  if(!b||!Object.hasOwn(TYPES,b.type)||typeof b.id!=='string'||!/^b-[a-z0-9-]{1,64}$/.test(b.id)||ids.has(b.id))throw Error('영역 종류와 고유 ID를 확인하세요.');ids.add(b.id);
  const w=num(b.w,100,W),h=num(b.h,50,H),x=num(b.x,0,W-w),y=num(b.y,0,H-h);
  return {id:b.id,type:b.type,title:str(b.title,100)||TYPES[b.type],x,y,w,h,note:str(b.note,1000),color:/^#[0-9a-f]{6}$/i.test(b.color)?b.color:'#3b7f80',font:[16,18,20].includes(b.font)?b.font:16};
 });
 if(input.strokes!==undefined&&(!Array.isArray(input.strokes)||input.strokes.length>50))throw Error('스케치는 최대 50획입니다.');
 const strokes=(input.strokes||[]).map(s=>{if(!Array.isArray(s)||s.length>500)throw Error('스케치 점 수를 확인하세요.');return s.map(p=>{if(!Array.isArray(p)||p.length!==2)throw Error('스케치 좌표를 확인하세요.');return [num(p[0],0,W),num(p[1],0,H)];});});
 return {version:1,title:str(input.title,100)||'나의 화면 요청',width:W,height:H,notes:str(input.notes,3000),blocks,strokes};
}
function initial(blank=false){return normalize({version:1,title:blank?'새 화면 구상':'설비 분석 화면',notes:'기존 X/Y 좌표·원천 값·로그인·DB 연결은 유지. ER 맵 노치는 9시 고정. 단위·보간·균일도 계산은 변경하지 않음.',strokes:[],blocks:blank?[]:[
 {id:'b-filter',type:'filter',title:'설비·기간 필터',x:30,y:20,w:940,h:60,note:'기존 설비·기간 조건을 그대로 연결'},
 {id:'b-er',type:'er',title:'웨이퍼 ER 맵',x:30,y:100,w:540,h:330,note:'9시 노치. 기존 측정 좌표와 값을 유지'},
 {id:'b-table',type:'table',title:'측정점 목록',x:590,y:100,w:380,h:330,note:'맵에서 선택한 측정점과 연계'},
 {id:'b-line',type:'line',title:'ER 추이',x:30,y:450,w:600,h:160,note:'선택한 설비의 기존 추이 데이터'},
 {id:'b-detail',type:'detail',title:'선택점 상세',x:650,y:450,w:320,h:160,note:'ID·좌표·원본 값을 표시'}
 ]});}
function diff(state,baseline){const now=normalize(state),old=normalize(baseline),rows=[];for(const b of now.blocks){const before=old.blocks.find(x=>x.id===b.id);if(!before){rows.push('추가: '+b.id+' / '+b.title);continue;}const changes=[];for(const key of ['type','title','x','y','w','h','note','color','font'])if(b[key]!==before[key])changes.push(key+': '+before[key]+' → '+b[key]);if(changes.length)rows.push(b.id+' / '+changes.join('; '));}for(const b of old.blocks)if(!now.blocks.some(x=>x.id===b.id))rows.push('제거: '+b.id+' / '+b.title);if(now.title!==old.title)rows.push('화면 제목 변경');if(now.notes!==old.notes)rows.push('전체 요구사항 변경');if(JSON.stringify(now.strokes)!==JSON.stringify(old.strokes))rows.push('자유 스케치 변경: 의미는 이름·메모를 기준으로 확인');return rows;}
function packet(state,baseline){const s=normalize(state);return {format:'ui-brief/1',interpretation:'사용자가 지정한 영역 이름과 메모. 이미지 자동 인식 결과가 아님.',coordinateSystem:'화면 배치 전용 1000×640; 웨이퍼 측정 좌표와 무관',layout:s,changes:diff(s,baseline),preserve:['existing source values','existing measurement coordinates','SSO and DB','9 oclock ER notch'],unconfirmed:['ER unit','spatial interpolation','uniformity formula'],imageIncluded:false};}
function markdown(state,baseline){const p=packet(state,baseline),s=p.layout;return ['# UI 변경 요청: '+s.title,'','## 해석 원칙','사용자가 배치하고 이름·메모를 붙인 명세입니다. 사진/손그림 자동 인식 결과가 아닙니다.','좌표는 화면 배치용 1000×640입니다. 웨이퍼 측정 X/Y를 바꾸는 지시가 아닙니다.','배경으로 올린 이미지는 포함되지 않습니다. 이미지 없이도 해석할 수 있도록 영역 이름·메모를 확인하세요.','','## 전체 요구사항',s.notes||'(미입력)','','## 화면 영역',...s.blocks.map((b,i)=>[`${i+1}. ${b.title} [${b.id}]`,`   종류: ${TYPES[b.type]} / ${b.type}`,`   왼쪽 ${b.x/10}%, 위 ${Math.round(b.y/H*1000)/10}%, 너비 ${b.w/10}%, 높이 ${Math.round(b.h/H*1000)/10}%`,`   배치 단위: x=${b.x}, y=${b.y}, w=${b.w}, h=${b.h}; 글자=${b.font}px; 강조색=${b.color}`,`   요청: ${b.note||'(세부 동작 미지정)'}`].join('\n')),'','## 시작 배치 대비 변경',...(p.changes.length?p.changes.map(x=>'- '+x):['- 변경 없음']),'','## 자유 스케치',`${s.strokes.length}획. 기하 좌표만으로 동작이나 의미를 추측하지 마세요. 영역의 이름과 메모를 우선합니다.`,'','## 구현 조건','기존 원천 값·측정 좌표·SSO/DB 연결을 유지합니다. ER 노치는 9시 고정입니다.','ER 단위·보간·균일도 계산은 미정이므로 추가/변경하지 않습니다.','선택 영역의 메모에 상세 동작이 없으면 완성된 기능으로 추정하지 않습니다.','Streamlit은 설치 버전에서 지원하는 열/컨테이너로 배치를 옮기고 검증합니다. HTML을 운영 화면에 그대로 주입하지 않습니다.','수정 파일·유지한 연결·검증 결과·미구현을 구분해 보고합니다.',''].join('\n');}
function previewMarkup(b){
 if(b.type==='er'){const pts=[[150,100],[150,55],[195,100],[150,145],[105,100],[90,45],[210,45],[90,155],[210,155]];return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 205"><circle cx="150" cy="100" r="88" fill="#edf4f4" stroke="#a4bfc0" stroke-width="2"/><path d="M 60 91 L 72 100 L 60 109" fill="white" stroke="#789b9c" stroke-width="2"/>'+pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="12" fill="${['#3b8081','#5b9e95','#8abc97'][i%3]}"/>`).join('')+'<text x="15" y="105" fill="#5b7678" font-family="sans-serif" font-size="15">9시</text><text x="150" y="202" text-anchor="middle" fill="#6d8484" font-family="sans-serif" font-size="14">가짜 배치 · 원천 좌표 미변경</text></svg>';}
 if(b.type==='line')return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 110"><path d="M 20 15 V 90 H 480 M20 50 H480" fill="none" stroke="#d5e2e3"/><polyline points="20,72 70,40 120,50 170,25 220,42 270,35 320,65 370,50 420,60 480,30" fill="none" stroke="#3b8081" stroke-width="3"/><text x="470" y="107" text-anchor="end" font-size="14" fill="#6d8484">가짜 추이</text></svg>';
 return '';
}
function htmlExport(state,baseline){const s=normalize(state);const cards=s.blocks.map(b=>`<section data-ui-id="${b.id}" data-ui-type="${b.type}" aria-label="${escape(b.title)}" style="left:${b.x/10}%;top:${b.y/H*100}%;width:${b.w/10}%;height:${b.h/H*100}%;font-size:${b.font}px;border-top:3px solid ${b.color}"><strong>${escape(b.title)}</strong>${previewMarkup(b)}<p>${escape(b.note)}</p></section>`).join('');const strokes=s.strokes.map(points=>'<polyline fill="none" stroke="#bc8b4e" stroke-width="3" points="'+points.map(p=>p.join(',')).join(' ')+'"/>').join('');return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+escape(s.title)+'</title><style>body{margin:24px;background:#f3f5f4;color:#213c3d;font:16px/1.6 sans-serif}h1{font-size:24px}article{position:relative;width:100%;min-width:700px;aspect-ratio:1000/640;background:white;border:1px solid #cedcdb}section{position:absolute;box-sizing:border-box;padding:12px;border:1px solid #cbdcda;border-radius:8px;background:#fff;overflow:auto}section svg{display:block;width:100%;height:65%;max-height:240px}p{white-space:pre-wrap}article>svg{position:absolute;width:100%;height:100%;pointer-events:none}pre{white-space:pre-wrap;font:14px/1.7 monospace;background:white;padding:20px}</style><h1>'+escape(s.title)+'</h1><p>UI 통역 노트 · 사용자가 지정한 배치와 메모 · 이미지 자동 인식 아님'+'</p><article>'+cards+'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640">'+strokes+'</svg></article><h2>AI용 명세</h2><pre>'+escape(markdown(s,baseline))+'</pre></html>';}
root.UIBrief={W,H,TYPES,TERMS,clone,escape,normalize,initial,diff,packet,markdown,previewMarkup,htmlExport};
})(typeof window==='undefined'?globalThis:window);
