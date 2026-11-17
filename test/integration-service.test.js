import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHmac} from 'node:crypto';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/security.js';
import {toPlanCards} from '../reference-kit/plan-cards.js';

async function setup(t, {write = false, role = 'assigner', production = false} = {}) {
  const user = production ? 'engineer-a' : 'demo-engineer';
  const config = {mode: production ? 'production' : 'demo', origin: 'http://127.0.0.1:0',
    dataFile: ':memory:', allowedSiteHosts: [], integrationWritable: write,
    integrationRoles: {[user]: role}, secret: 'test-only'.repeat(5), users: [user], proxies: ['127.0.0.1']};
  const app = createApp(config), server = app.listen(0, '127.0.0.1');
  await once(server, 'listening'); config.origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); app.locals.store.close();});
  let cookie = '', csrf = '';
  async function request(path, method = 'GET', body, headers = {}) {
    const url = path.startsWith('/api/') ? path : '/api/integration' + path;
    const signed = {};
    if (production) {
      const stamp = String(Date.now()); signed['X-Portal-User'] = user; signed['X-Portal-Time'] = stamp;
      signed['X-Portal-Signature'] = createHmac('sha256', config.secret).update(`${user}\n${stamp}\n${method}\n${url}`).digest('hex');
    }
    const response = await fetch(config.origin + url, {method,
      headers: {Cookie: cookie, Origin: config.origin, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json', ...signed, ...headers},
      body: body === undefined ? undefined : JSON.stringify(body)});
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }
  csrf = (await (await request('/api/bootstrap')).json()).csrf;
  const workspace = async () => (await request('/workspace')).json();
  return {request, workspace, config, user, app};
}

test('integration is read-only by default, rejects forged roles and production cannot enable writes', async t => {
  const c = await setup(t);
  assert.equal((await c.request('/tasks', 'POST', {role: 'assigner', version: 1, records: []}, {'X-Role': 'assigner'})).status, 403);
  assert.equal((await (await c.request('/capabilities')).json()).writable, false);
  const p = await setup(t, {production: true});
  assert.equal((await p.workspace()).version, 0);
  assert.equal(p.app.locals.store.list('ref:integration').length, 0);
  assert.equal((await p.request('/store/demo', 'POST', {version: 0, data: {title: '가짜', content: ''}, reason: '시험'})).status, 403);
  assert.throws(() => readConfig({APP_MODE: 'production', REFERENCE_SERVICE_WRITE: '1'}));
  assert.throws(() => readConfig({REFERENCE_SERVICE_ROLES: '{bad'}));
  assert.throws(() => readConfig({REFERENCE_SERVICE_ROLES: '{"user":"admin"}'}));
});

test('day-plan validates input and staff filter only projects a full unchanged plan', async t => {
  const c = await setup(t), before = await c.workspace(), day = before.data.day;
  const full = await (await c.request('/day-plan?date=' + day)).json();
  const selected = await (await c.request('/day-plan?date=' + day + '&staff=A')).json();
  assert.deepEqual(selected.assignments, full.assignments.filter(item => item.personId === 'A'));
  assert.deepEqual(selected.cards.filter(card => card.status === 'proposed').map(card => card.taskId), selected.assignments.map(item => item.taskId));
  assert.equal(selected.schemaVersion, 1); assert.match(selected.inputHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(await c.workspace(), before);
  const blocked = toPlanCards({...full, unassigned: [{taskId: 'blocked', title: '가짜 미배정', reason: '필요 역량 미충족'}]}, {tasks: [{id: 'blocked', equipment: 'MC-DEMO'}], staffIds: ['nobody']});
  assert.deepEqual(blocked.cards, [{taskId: 'blocked', title: '가짜 미배정', equipment: 'MC-DEMO', status: 'unassigned', reasonCode: 'UNASSIGNED', reason: '필요 역량 미충족', person: null, time: null}]);
  for (const query of ['date=2026-02-30', 'date=' + day + '&staff=unknown', 'date=' + day + '&staff=A&staff=B', 'date=' + day + '&includeOverdue=yes']) {
    assert.equal((await c.request('/day-plan?' + query)).status, 400);
  }
});

test('trusted role map protects assigner actions; operators record checks and completion exactly once', async t => {
  const c = await setup(t, {write: true}); let w = await c.workspace();
  const day = w.data.day;
  c.config.integrationRoles[c.user] = 'viewer';
  assert.equal((await c.request('/plan/commit', 'POST', {version: w.version, date: day, role: 'assigner'}, {'X-Role': 'assigner'})).status, 403);
  c.config.integrationRoles[c.user] = 'operator';
  assert.equal((await c.request('/staff', 'PUT', {version: w.version, staff: w.data.staff[0]})).status, 403);
  c.config.integrationRoles[c.user] = 'assigner';
  assert.equal((await c.request('/plan/commit', 'POST', {version: w.version, date: day}, {'X-CSRF-Token': 'forged'})).status, 403);
  assert.equal((await c.request('/plan/commit', 'POST', {version: w.version, date: day})).status, 200);
  w = await c.workspace(); const task = w.data.tasks.find(item => item.status === 'scheduled');
  c.config.integrationRoles[c.user] = 'operator';
  const taskUrl = '/tasks/' + encodeURIComponent(task.id);
  assert.equal((await c.request(taskUrl + '/complete', 'POST', {version: w.version})).status, 400);
  assert.equal((await c.workspace()).version, w.version);
  for (const item of w.data.checklists[task.id].items) {
    const response = await c.request(taskUrl + '/checks/' + item.id, 'POST', {version: w.version, done: true, actor: 'spoof'});
    assert.equal(response.status, 200); w = await c.workspace();
  }
  assert.equal((await c.request(taskUrl + '/complete', 'POST', {version: w.version})).status, 200);
  w = await c.workspace(); assert.equal(w.data.informs.length, 1); assert.equal(w.data.informs[0].actor, c.user);
  assert.equal((await c.request(taskUrl + '/complete', 'POST', {version: w.version})).status, 200);
  assert.equal((await c.workspace()).data.informs.length, 1);
});

test('document CAS has one winner and historical versions/revert preserve audit history', async t => {
  const c = await setup(t, {write: true, role: 'operator'});
  const write = (version, content) => c.request('/store/handover', 'POST', {version, data: {title: '가짜 인계', content}, reason: '검수'});
  assert.equal((await write(0, '원본')).status, 200);
  const results = await Promise.all([write(1, '수정 A'), write(1, '수정 B')]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await (await c.request('/store/handover?version=1')).json()).data.content, '원본');
  assert.equal((await c.request('/store/handover/revert', 'POST', {version: 1, targetVersion: 1, reason: '충돌'})).status, 409);
  const reverted = await (await c.request('/store/handover/revert', 'POST', {version: 2, targetVersion: 1, reason: '이전 값 복원'})).json();
  assert.equal(reverted.version, 3); assert.equal(reverted.data.content, '원본');
  const history = await (await c.request('/store/handover/history')).json();
  assert.equal(history.length, 3); assert.ok(history.every(item => item.actor === c.user));
  assert.equal((await c.request('/store/handover?version=-1')).status, 400);
});

test('import and macro routes validate atomically and repeat generation is idempotent', async t => {
  const c = await setup(t, {write: true}); let w = await c.workspace(); const day = w.data.day;
  const task = {...w.data.tasks[0], title: '가짜 신규 반입'};
  assert.equal((await c.request('/tasks', 'POST', {version: w.version, records: [task, null]})).status, 400);
  assert.deepEqual(await c.workspace(), w);
  assert.equal((await c.request('/tasks', 'POST', {version: w.version, records: [task]})).status, 200);
  assert.equal((await c.request('/tasks', 'POST', {version: w.version, records: [task]})).status, 409);
  w = await c.workspace();
  const created = await (await c.request('/macros', 'POST', {version: w.version, task: {...task, title: '가짜 반복'}, everyDays: 3, anchorDay: day, throughDay: day})).json();
  assert.equal(created.result.added, 1); w = await c.workspace();
  const run = await (await c.request('/macros/' + encodeURIComponent(created.result.macro.id) + '/run', 'POST', {version: w.version, from: day, to: day})).json();
  assert.equal(run.result.added, 0); assert.equal(run.result.duplicates, 1);
});

test('ingestion accepts only supplied complete snapshots and keeps last good equipment on failure', async t => {
  const c = await setup(t, {write: true}); const stamp = new Date().toISOString();
  const snapshot = {complete: true, rejectedCount: 0, readCount: 1, observedAt: stamp,
    records: [{sourceId: 'DEMO1', title: '가짜 설비', area: '가짜 구역', status: '운전', observedAt: stamp}]};
  assert.equal((await c.request('/ingestion/hue', 'POST', {snapshot})).status, 200);
  const saved = c.app.locals.store.get('hue:DEMO1', 'equipment');
  assert.equal((await c.request('/ingestion/hue', 'POST', {snapshot: {...snapshot, complete: false}})).status, 400);
  assert.deepEqual(c.app.locals.store.get('hue:DEMO1', 'equipment'), saved);
  assert.equal((await c.request('/ingestion/hue', 'POST', {snapshot, url: 'https://external.invalid'})).status, 400);
  assert.equal((await c.request('/ingestion/hue', 'POST', {snapshot: {...snapshot, records: [null]}})).status, 400);
  assert.deepEqual(c.app.locals.store.get('hue:DEMO1', 'equipment'), saved);
});
