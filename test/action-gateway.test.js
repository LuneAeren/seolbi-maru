import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createStore} from '../src/store.js';
import {createActionGateway, demoActionAdapters} from '../reference-kit/action-gateway.js';
import {createApp} from '../src/app.js';

const input = {deviceId: 'MC-DEMO-01'};
function setup(t, options = {}) {
  const store = createStore(':memory:'); t.after(() => store.close());
  const roles = {alice: 'operator', bob: 'viewer'};
  const settings = {mode: 'demo', writable: true, roles, adapters: demoActionAdapters(store), ...options};
  return {store, roles, settings, gateway: createActionGateway(store, settings)};
}

test('action catalog has fixed IDs and fields; no URL, selector, cookies or arbitrary resource accepted', t => {
  const {gateway} = setup(t);
  for (const payload of [
    {actionId: 'equipment.read', input, url: 'https://external.invalid'},
    {actionId: 'equipment.read', input: {...input, cookie: 'secret'}},
    {actionId: 'equipment.read', input: {deviceId: 'not-approved'}},
    {actionId: 'javascript:click()', input}
  ]) assert.throws(() => gateway.prepare('alice', payload), error => [400,404].includes(error.status));
  assert.throws(() => gateway.prepare('bob', {actionId: 'handover.acknowledge', input}), {status: 403});
  assert.equal(gateway.catalog('bob').actions.find(action => action.id === 'equipment.read').available, true);
});

test('production dispatch and demo writes default to disabled; permission checked again at execute', async t => {
  const {store, roles, settings, gateway} = setup(t);
  const prod = createActionGateway(store, {...settings, mode: 'production'});
  assert.ok(prod.catalog('alice').actions.every(action => !action.available));
  assert.throws(() => prod.prepare('alice', {actionId: 'equipment.read', input}), {status: 503});
  const readonly = createActionGateway(store, {...settings, writable: false});
  assert.throws(() => readonly.prepare('alice', {actionId: 'handover.acknowledge', input}), {status: 403});
  const prepared = gateway.prepare('alice', {actionId: 'handover.acknowledge', input});
  roles.alice = 'viewer';
  await assert.rejects(() => gateway.execute('alice', prepared.requestId, {confirm: true}), {status: 403});
  assert.throws(() => gateway.status('bob', prepared.requestId), {status: 404});
});

test('mutations require review, can cancel before dispatch and expire without execution', async t => {
  let now = 1000000;
  const {gateway, store} = setup(t, {clock: () => now});
  const prepared = gateway.prepare('alice', {actionId: 'handover.acknowledge', input});
  await assert.rejects(() => gateway.execute('alice', prepared.requestId, {confirm: false}), {status: 400});
  assert.equal(gateway.cancel('alice', prepared.requestId).state, 'cancelled');
  assert.equal((await gateway.execute('alice', prepared.requestId, {confirm: true})).state, 'cancelled');
  const expired = gateway.prepare('alice', {actionId: 'handover.acknowledge', input}); now += 120001;
  assert.equal((await gateway.execute('alice', expired.requestId, {confirm: true})).state, 'expired');
  assert.equal(store.list('ref:demo-receipt').length, 0);
});

test('concurrent and repeated dispatches share a durable request and a single demo receipt', async t => {
  const {gateway, store} = setup(t);
  const prepared = gateway.prepare('alice', {actionId: 'handover.acknowledge', input});
  const values = await Promise.all(Array.from({length: 10}, () => gateway.execute('alice', prepared.requestId, {confirm: true})));
  assert.ok(values.every(value => value.state === 'succeeded'));
  assert.equal(store.list('ref:demo-receipt').length, 1);
  const other = createActionGateway(store, {mode: 'demo', writable: true, roles: {alice:'operator'}, adapters: demoActionAdapters(store)});
  assert.equal((await other.execute('alice', prepared.requestId, {confirm: true})).state, 'succeeded');
  assert.equal(store.list('ref:demo-receipt').length, 1);
});

test('timeout or bad adapter output stays uncertain, hides secrets and never auto-retries', async t => {
  let calls = 0;
  const {gateway} = setup(t, {timeoutMs: 5, adapters: {'equipment.read': async () => {calls++; return new Promise(() => {});}}});
  const prepared = gateway.prepare('alice', {actionId: 'equipment.read', input});
  const result = await gateway.execute('alice', prepared.requestId, {});
  assert.equal(result.state, 'uncertain');
  assert.equal((await gateway.execute('alice', prepared.requestId, {})).state, 'uncertain');
  assert.equal(calls, 1);
  const {gateway: bad} = setup(t, {adapters: {'equipment.read': async () => {throw new Error('upstream-secret-cookie');}}});
  const request = bad.prepare('alice', {actionId: 'equipment.read', input});
  assert.ok(!JSON.stringify(await bad.execute('alice', request.requestId, {})).includes('upstream-secret'));
  const {gateway: safe} = setup(t, {adapters: {'equipment.read': async () => ({summary: '<b>text only</b>', items: [], token: 'do-not-return'})}});
  const safeRequest = safe.prepare('alice', {actionId: 'equipment.read', input});
  assert.ok(!JSON.stringify(await safe.execute('alice', safeRequest.requestId, {})).includes('do-not-return'));
});

test('another process cannot dispatch a running ID and restart recovery waits for deadline', async t => {
  let now = 1000000, calls = 0, release;
  const adapter = async () => {calls++; return new Promise(resolve => {release = resolve;});};
  const {gateway, store, settings} = setup(t, {clock: () => now, adapters: {'equipment.read': adapter}});
  const request = gateway.prepare('alice', {actionId: 'equipment.read', input});
  const running = gateway.execute('alice', request.requestId, {});
  await new Promise(resolve => setImmediate(resolve));
  const other = createActionGateway(store, settings);
  assert.equal((await other.execute('alice', request.requestId, {})).state, 'running');
  assert.equal(calls, 1);
  now += 9000;
  assert.equal(other.status('alice', request.requestId).state, 'uncertain');
  release({summary: 'late result', items: []});
  assert.equal((await running).state, 'uncertain');
  assert.equal(calls, 1);
});

test('HTTP gateway inherits CSRF, limits input, exposes no iframe and executes local reads', async t => {
  const config = {mode: 'demo', origin: 'http://127.0.0.1:0', dataFile: ':memory:', allowedSiteHosts: []};
  const app = createApp(config), server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  config.origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); app.locals.store.close();});
  const bootstrap = await fetch(config.origin + '/api/bootstrap'), cookie = bootstrap.headers.get('set-cookie').split(';')[0], {csrf} = await bootstrap.json();
  const post = (path, data, token = csrf) => fetch(config.origin + '/api/actions' + path, {method: 'POST', headers: {Cookie: cookie, Origin: config.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': token}, body: JSON.stringify(data)});
  assert.equal((await post('/prepare', {actionId: 'equipment.read', input}, 'bad')).status, 403);
  assert.equal((await post('/prepare', {actionId: 'equipment.read', input: {deviceId: 'x'.repeat(5000)}})).status, 413);
  const prepared = await (await post('/prepare', {actionId: 'equipment.read', input})).json();
  assert.equal((await (await post('/' + prepared.requestId + '/execute', {})).json()).state, 'succeeded');
  const page = await fetch(config.origin + '/action-lab/', {headers: {Cookie: cookie}});
  assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /frame-src 'none'/);
  assert.doesNotMatch(await page.text(), /<iframe\b/i);
});
