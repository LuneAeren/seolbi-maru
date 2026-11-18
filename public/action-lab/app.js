const $ = selector => document.querySelector(selector);
const key = 'seolbi-action-request-v1';
let csrf = '', catalog, busy = false, pending = '', calls = 0;
const h = (tag, text, cls) => {const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node;};
function remember(id) {pending = id; try {if (id) sessionStorage.setItem(key, id); else sessionStorage.removeItem(key);} catch {} $('#status').disabled = !pending || busy;}
function locking(value) {busy = value; document.querySelectorAll('.action button').forEach(button => button.disabled = busy || button.dataset.available !== 'true'); $('#status').disabled = busy || !pending; $('#confirm').disabled = busy; $('#cancel').disabled = busy;}
async function api(path, body) {
  calls++; $('#calls').textContent = calls + '회';
  const response = await fetch(path, {method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
    headers: body === undefined ? {} : {'Content-Type': 'application/json', 'X-CSRF-Token': csrf}, body: body === undefined ? undefined : JSON.stringify(body)});
  if (response.status === 401 || response.status === 403) {const error = new Error('로그인·권한·데모 변경 허용 설정을 확인해주세요. 요청을 자동 재전송하지 않습니다.'); throw error;}
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('로그인 페이지 또는 예상하지 못한 응답입니다. 사내 인증 연결을 확인해주세요.');
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || '요청을 처리하지 못했습니다.');
  return value;
}
function show(value) {
  const result = $('#result'); result.replaceChildren(h('span', value.state, 'state ' + value.state), h('h3', value.label), h('p', value.message));
  if (value.result) {
    result.append(h('p', value.result.summary)); const list = h('dl');
    for (const item of value.result.items) list.append(h('dt', item.label), h('dd', item.value)); result.append(list);
  }
  if (value.state === 'prepared') {
    const controls = h('div', undefined, 'review-actions');
    if (value.requiresConfirmation) {const review = h('button', '내용 다시 검토'); review.addEventListener('click', () => {if (!busy) openReview(value);}); controls.append(review);}
    const stop = h('button', '준비 요청 취소'); stop.addEventListener('click', () => void cancel()); controls.append(stop); result.append(controls);
  }
  result.append(h('div', '요청 ID · ' + value.requestId, 'request-id')); remember(value.requestId);
}
function error(value) {$('#error').textContent = value.message || '통신 오류입니다. 처리 상태를 확인해주세요.';}
async function execute(confirm) {
  locking(true); $('#error').textContent = '';
  try {show(await api('/api/actions/' + pending + '/execute', {confirm}));}
  catch (e) {error(e); $('#result').replaceChildren(h('h3', '결과 확인 필요'), h('p', '새 변경 요청을 만들지 말고, 처리 상태 확인을 눌러주세요.'));}
  finally {locking(false);}
}
async function choose(action) {
  if (busy) return;
  // A previous uncertain/running request must be checked before creating a new operation.
  locking(true); $('#error').textContent = '';
  try {
    if (pending) {
      const previous = await api('/api/actions/' + pending); show(previous);
      if (['running', 'uncertain', 'prepared'].includes(previous.state)) throw new Error('이전 요청을 먼저 확인·취소해주세요. 결과 불명확 상태는 사내 원천 기록 확인이 필요합니다.');
    }
    const value = await api('/api/actions/prepare', {actionId: action.id, input: {deviceId: $('#device').value}}); show(value);
    if (value.requiresConfirmation) {
      openReview(value);
    } else {await execute(false);}
  } catch (e) {error(e);} finally {locking(false);}
}
function openReview(value) {
  $('#review-content').replaceChildren(h('strong', value.label + ' / ' + value.deviceId), h('p', '실제 시스템이 아닌 가짜 인계 메모에 확인 기록을 남깁니다.'), h('p', '실행 전 취소할 수 있습니다. 실행 후 오류가 나면 결과부터 확인합니다.'));
  $('#review').showModal();
}
$('#confirm').addEventListener('click', async () => {$('#review').close(); await execute(true);});
async function cancel() {if (!pending || busy) return; locking(true); try {show(await api('/api/actions/' + pending + '/cancel', {}));} catch (e) {error(e);} finally {locking(false);}}
$('#cancel').addEventListener('click', async () => {$('#review').close(); await cancel();});
$('#review').addEventListener('cancel', event => {event.preventDefault(); $('#review').close(); void cancel();});
$('#status').addEventListener('click', async () => {locking(true); try {show(await api('/api/actions/' + pending));} catch (e) {error(e);} finally {locking(false);}});
async function start() {
  try {
    const bootstrap = await api('/api/bootstrap'); csrf = bootstrap.csrf;
    catalog = await api('/api/actions/catalog'); $('#mode').textContent = catalog.demo ? '가짜 데이터 데모' : '사내 연결 미설정';
    for (const device of catalog.devices) {const option = h('option', device); option.value = device; $('#device').append(option);}
    for (const action of catalog.actions) {
      const row = h('div', undefined, 'action'), text = h('div'); text.append(h('h3', action.label), h('p', action.service.serviceName + ' · ' + (catalog.demo ? '가짜 승인 상태: ' : '') + action.service.label), h('p', action.available ? (action.mutates ? '내용 확인 후 기록 · 데모 변경' : '가짜 결과만 조회') : action.reason));
      const button = h('button', action.mutates ? '내용 검토' : '조회'); button.type = 'button'; button.dataset.available = String(action.available); button.disabled = !action.available;
      button.setAttribute('aria-label', action.label + (action.mutates ? ' 내용 검토' : ' 실행')); button.addEventListener('click', () => void choose(action)); row.append(text, button); $('#actions').append(row);
    }
    try {pending = sessionStorage.getItem(key) || '';} catch {}
    if (pending) {try {show(await api('/api/actions/' + pending));} catch {remember('');}}
  } catch (e) {error(e); $('#mode').textContent = '연결 확인 필요';}
}
void start();
