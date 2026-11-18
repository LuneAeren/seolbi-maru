import {randomUUID, createHash} from 'node:crypto';
import {fail} from '../src/core.js';
import {serviceAccess} from './service-access.js';

const kind = 'ref:action-request';
const devices = Object.freeze(['MC-DEMO-01', 'MC-DEMO-02', 'MC-DEMO-03']);
const definitions = Object.freeze([
  {id: 'equipment.read', serviceId:'equipment', label: '설비 요약 조회', mutates: false, roles: ['viewer', 'operator', 'assigner']},
  {id: 'report.preview', serviceId:'reports', label: '보고서 요약 조회', mutates: false, roles: ['viewer', 'operator', 'assigner']},
  {id: 'handover.acknowledge', serviceId:'handover', label: '인계 메모 확인 기록', mutates: true, roles: ['operator', 'assigner']}
]);
const publicStates = new Set(['prepared', 'running', 'succeeded', 'uncertain', 'expired', 'cancelled']);
function onlyKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail(400, '허용된 JSON 필드만 입력해주세요.');
}
function inputFor(value) {
  onlyKeys(value, ['deviceId']);
  if (!devices.includes(value.deviceId)) fail(400, '등록된 데모 설비를 선택해주세요.');
  return {deviceId: value.deviceId};
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function publicRequest(entity) {
  const d = entity.data;
  return {requestId: entity.id, version: entity.version, state: publicStates.has(d.state) ? d.state : 'uncertain',
    actionId: d.actionId, deviceId: d.input.deviceId, label: d.label,
    requiresConfirmation: d.mutates, expiresAt: new Date(d.expiresAt).toISOString(),
    result: d.result || null,
    message: ({prepared: '실행 내용을 확인해주세요.', running: '처리 중입니다. 같은 요청을 다시 실행하지 않습니다.',
      succeeded: '가짜 데이터 처리가 완료됐습니다.', uncertain: '처리 결과를 확정할 수 없습니다. 원천 기록 확인 전 재실행하지 마세요.',
      expired: '요청이 만료됐습니다. 내용을 다시 확인해주세요.', cancelled: '실행 전에 취소됐습니다.'})[d.state] || '원천 확인이 필요합니다.'};
}
function safeResult(value) {
  // Project adapter output. Do not expose raw upstream responses, HTML, headers or tokens.
  if (!value || typeof value.summary !== 'string' || value.summary.length > 1000 || !Array.isArray(value.items) || value.items.length > 20) throw new Error('Invalid adapter result');
  const items = value.items.map(item => {
    if (!item || typeof item.label !== 'string' || item.label.length > 80 || typeof item.value !== 'string' || item.value.length > 300) throw new Error('Invalid adapter field');
    return {label: item.label, value: item.value};
  });
  return {summary: value.summary, items};
}

/** A local demonstration boundary, NOT a generic URL proxy or SSO implementation.
 * Adapters receive server-selected action IDs, validated fields and trusted actor only.
 * Production dispatch is deliberately disabled; no network adapter ships in this repo.
 */
export function createActionGateway(store, {mode = 'production', writable = false, roles = {},
  adapters = {}, grants = {}, clock = Date.now, timeoutMs = 3000} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5 || timeoutMs > 30000) throw new Error('Invalid action timeout');
  const inFlight = new Map();
  const roleFor = actor => Object.hasOwn(roles, actor) && ['viewer','operator','assigner'].includes(roles[actor]) ? roles[actor] : 'viewer';
  function definition(actor, id) {
    if (typeof actor !== 'string' || !actor) fail(401, '인증된 사용자가 필요합니다.');
    const action = definitions.find(item => item.id === id);
    if (!action) fail(404, '등록된 동작이 아닙니다.');
    if (!action.roles.includes(roleFor(actor))) fail(403, '이 동작의 권한이 없습니다.', 'ACTION_FORBIDDEN');
    if (mode !== 'demo' || typeof adapters[id] !== 'function') fail(503, '사내 연결부가 설정되지 않았습니다.', 'ACTION_NOT_CONNECTED');
    const access = serviceAccess(grants,action.serviceId,action.id,clock());
    if (!access.allowed) fail(403, access.serviceName + ' · ' + access.label + '：서비스별 API 승인을 확인해주세요.', 'SERVICE_NOT_APPROVED');
    if (action.mutates && !writable) fail(403, '데모 변경 동작은 기본 차단됩니다.', 'ACTION_READ_ONLY');
    return action;
  }
  function owned(actor, id) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) fail(400, '요청 ID를 확인해주세요.');
    const entity = store.get(id, kind);
    if (entity.data.actor !== actor) fail(404, '요청을 찾을 수 없습니다.');
    return entity;
  }
  function save(entity, data, actor, reason) {return store.save(kind, entity.id, data, entity.version, actor, reason);}
  function status(actor, id) {
    let entity = owned(actor, id);
    if (entity.data.state === 'prepared' && clock() >= entity.data.expiresAt) entity = save(entity, {...entity.data, state: 'expired'}, actor, '실행 전 요청 만료');
    // A persisted running request without this process's promise could have reached the target.
    if (entity.data.state === 'running' && !inFlight.has(id) && clock() >= entity.data.dispatchDeadline) entity = save(entity, {...entity.data, state: 'uncertain'}, actor, '프로세스 재시작·결과 불명확');
    return publicRequest(entity);
  }
  return {
    catalog(actor) {
      return {schemaVersion: 1, demo: mode === 'demo', devices, actions: definitions.map(action => {
        let available = true, reason = '';
        try {definition(actor, action.id);} catch (error) {available = false; reason = error.message;}
        return {id: action.id, label: action.label, mutates: action.mutates, available, reason, service:serviceAccess(grants,action.serviceId,action.id,clock())};
      })};
    },
    prepare(actor, body) {
      onlyKeys(body, ['actionId', 'input']);
      const action = definition(actor, body.actionId), input = inputFor(body.input);
      const count = store.list(kind).filter(entity => entity.data.actor === actor).length;
      if (count >= 200) fail(429, '데모 요청 보관 한도에 도달했습니다. 운영 보관·정리 정책은 사내에서 적용해주세요.');
      const at = clock(), id = randomUUID();
      const data = {actor, actionId: action.id, label: action.label, input, mutates: action.mutates,
        inputHash: digest(input), state: 'prepared', createdAt: at, expiresAt: at + 120000};
      return publicRequest(store.save(kind, id, data, 0, actor, '사용자가 검토할 동작 준비'));
    },
    status,
    cancel(actor, id) {
      const entity = owned(actor, id);
      if (entity.data.state !== 'prepared') fail(409, '실행 전 요청만 취소할 수 있습니다.');
      return publicRequest(save(entity, {...entity.data, state: 'cancelled'}, actor, '실행 전 사용자 취소'));
    },
    async execute(actor, id, body) {
      onlyKeys(body, ['confirm']);
      let entity = owned(actor, id);
      // Recheck permissions and connection when dispatching, even if a prepared ID exists.
      const action = definition(actor, entity.data.actionId);
      if (entity.data.inputHash !== digest(entity.data.input)) fail(409, '검토한 입력과 다릅니다.');
      if (entity.data.state !== 'prepared') {
        if (inFlight.has(id)) return inFlight.get(id);
        return status(actor, id);
      }
      if (clock() >= entity.data.expiresAt) return status(actor, id);
      if (action.mutates && body.confirm !== true) fail(400, '변경 내용을 확인한 뒤 실행해주세요.');
      // Durable compare-and-swap BEFORE dispatch. Another worker cannot dispatch this ID twice.
      entity = save(entity, {...entity.data, state: 'running', dispatchDeadline: clock() + timeoutMs + 5000}, actor, '중복 실행 방지·디스패치 시작');
      function finish(data, reason) {
        const current = store.get(id, kind);
        if (current.version !== entity.version || current.data.state !== 'running') return publicRequest(current);
        return publicRequest(save(entity, data, actor, reason));
      }
      let abort, timer;
      const signal = new AbortController(); abort = () => signal.abort();
      const operation = (async () => {
        try {
          const timeout = new Promise((_, reject) => {timer = setTimeout(() => {abort(); reject(new Error('Timeout'));}, timeoutMs);});
          const output = await Promise.race([Promise.resolve().then(() => adapters[action.id]({
            actor, input: structuredClone(entity.data.input), idempotencyKey: id, signal: signal.signal
          })), timeout]);
          const result = safeResult(output);
          return finish({...entity.data, state: 'succeeded', result}, '동작 결과 확인');
        } catch {
          // Timeout/connection error may occur AFTER the upstream committed. Never auto-retry.
          return finish({...entity.data, state: 'uncertain'}, '자동 재시도 없이 원천 확인 대기');
        } finally {clearTimeout(timer); inFlight.delete(id);}
      })();
      inFlight.set(id, operation);
      return operation;
    }
  };
}

export function demoActionAdapters(store) {
  return {
    'equipment.read': async ({input}) => ({summary: '가짜 설비 상태입니다.', items: [
      {label: '설비', value: input.deviceId}, {label: '메인', value: '정상'}, {label: '챔버 A', value: '점검'}, {label: 'LP', value: '정상'}]}),
    'report.preview': async ({input}) => ({summary: '가짜 보고서 요약입니다.', items: [
      {label: '설비', value: input.deviceId}, {label: '샘플 작업', value: '12건'}, {label: '미확인 기록', value: '2건'}]}),
    'handover.acknowledge': async ({actor, input, idempotencyKey}) => {
      // Fake target receipt, keyed by the same request ID. No remote website is involved.
      const id = 'demo-receipt:' + idempotencyKey;
      try {store.get(id, 'ref:demo-receipt');}
      catch (error) {if (error.status !== 404) throw error; store.save('ref:demo-receipt', id, {actor, deviceId: input.deviceId}, 0, actor, '가짜 대상 시스템 확인 영수증');}
      return {summary: '가짜 인계 메모에 확인 기록을 남겼습니다.', items: [{label: '설비', value: input.deviceId}, {label: '결과', value: '확인 기록됨'}]};
    }
  };
}
