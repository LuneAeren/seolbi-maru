import express from 'express';
import {createHash} from 'node:crypto';
import {fail, text} from '../src/core.js';
import {applySnapshot} from '../src/ingestion.js';
import {validDay} from './planner.js';
import {toPlanCards} from './plan-cards.js';
import {
  sampleWorkspace, previewPlan, importTasks, commitPlan, updateStaff,
  checkItem, completeTask, createRecurringMacro, generateRecurring
} from './workflows.js';

const actions = Object.freeze({
  viewer: [],
  operator: ['check', 'complete', 'document'],
  assigner: ['check', 'complete', 'document', 'import', 'assign', 'staff', 'macro', 'ingest']
});
const workspaceId = 'integration-workspace-v1';
const workspaceKind = 'ref:integration';
const documentKind = 'ref:document';

/** Mount only AFTER trusted authentication, same-origin/CSRF and bounded JSON parsing.
 * No identity or role is read from request headers/body/query. Production stays read-only.
 */
export function integrationRouter(store, {mode = 'production', writable = false, roles = {}} = {}) {
  const router = express.Router();
  if (mode !== 'demo' && writable) throw new Error('Integration reference writes require demo mode');
  router.use((req, res, next) => {
    if (!req.actor) return next(Object.assign(new Error('인증된 사용자가 필요합니다.'), {status: 401}));
    req.integrationRole = Object.hasOwn(roles, req.actor) && Object.hasOwn(actions, roles[req.actor]) ? roles[req.actor] : 'viewer';
    if (!['GET', 'HEAD'].includes(req.method) && (mode !== 'demo' || writable !== true)) {
      return next(Object.assign(new Error('연동 레퍼런스 쓰기는 기본 차단됩니다.'), {status: 403, code: 'REFERENCE_READ_ONLY'}));
    }
    res.set('Cache-Control', 'no-store');
    next();
  });
  function permit(action) {
    return (req, _res, next) => {
      if (!actions[req.integrationRole].includes(action)) return next(Object.assign(new Error('이 역할에는 해당 변경 권한이 없습니다.'), {status: 403, code: 'ROLE_FORBIDDEN'}));
      next();
    };
  }
  function body(req) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) fail(400, 'JSON 객체 본문이 필요합니다.');
    return req.body;
  }
  function version(value, zero = true) {
    if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1)) fail(400, '정수 버전을 입력해주세요.');
    return value;
  }
  function query(req, key) {
    const value = req.query[key];
    if (value !== undefined && typeof value !== 'string') fail(400, '단일 쿼리 값을 입력해주세요.');
    return value;
  }
  function workspace() {
    try { return store.get(workspaceId, workspaceKind); }
    catch (error) {
      if (error.status !== 404) throw error;
      const data = mode === 'demo' ? sampleWorkspace() : {staff: [], tasks: [], bookings: [], checklists: {}, informs: [], events: []};
      if (mode !== 'demo') return {version: 0, data};
      return store.save(workspaceKind, workspaceId, data, 0, 'system', '별도 연동 예제 공간 초기화');
    }
  }
  function mutate(req, operation, reason) {
    const input = body(req), current = workspace();
    if (version(input.version) !== current.version) fail(409, '최신 버전으로 다시 검토해주세요.', 'VERSION_CONFLICT');
    const draft = structuredClone(current.data);
    const result = operation(draft, input);
    const saved = store.save(workspaceKind, workspaceId, draft, current.version, req.actor, reason);
    return {version: saved.version, result};
  }
  function docId(req) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(req.params.doc)) fail(400, '문서 키는 영문·숫자·밑줄·하이픈 1~80자입니다.');
    return 'integration-doc:' + req.params.doc;
  }

  router.get('/capabilities', (req, res) => res.json({
    schemaVersion: 1, role: req.integrationRole,
    writable: mode === 'demo' && writable === true,
    actions: mode === 'demo' && writable === true ? actions[req.integrationRole] : []
  }));
  router.get('/workspace', (_req, res) => {
    const current = workspace(); res.json({version: current.version, data: current.data});
  });
  router.get('/day-plan', (req, res) => {
    const day = validDay(query(req, 'date'));
    const current = workspace();
    const raw = query(req, 'staff');
    const staffIds = raw === undefined ? [] : raw.split(',');
    if (staffIds.length > 100 || new Set(staffIds).size !== staffIds.length || staffIds.some(id => !id || !current.data.staff.some(person => person.id === id))) fail(400, '등록된 담당자 ID를 중복 없이 입력해주세요.');
    const overdue = query(req, 'includeOverdue');
    if (overdue !== undefined && !['true', 'false'].includes(overdue)) fail(400, 'includeOverdue는 true 또는 false입니다.');
    const plan = previewPlan(current.data, day, overdue === 'true');
    const cards = toPlanCards(plan, {tasks: current.data.tasks, staffIds});
    res.json({
      version: current.version,
      inputHash: createHash('sha256').update(JSON.stringify(current.data)).digest('hex'),
      ...plan,
      assignments: plan.assignments.filter(item => !staffIds.length || staffIds.includes(item.personId)),
      loads: plan.loads.filter(item => !staffIds.length || staffIds.includes(item.id)),
      ...cards
    });
  });
  router.post('/tasks', permit('import'), (req, res) => res.json(mutate(req, (draft, input) => {
    if (!Array.isArray(input.records) || input.records.some(record => !record || typeof record !== 'object' || Array.isArray(record))) fail(400, '업무 records는 JSON 객체 배열이어야 합니다.');
    return importTasks(draft, input.records);
  }, '연동 예제 업무 반입')));
  router.post('/plan/commit', permit('assign'), (req, res) => res.json(mutate(req, (draft, input) => {
    if (input.includeOverdue !== undefined && typeof input.includeOverdue !== 'boolean') fail(400, 'includeOverdue는 boolean입니다.');
    return commitPlan(draft, input.date, input.includeOverdue === true);
  }, '연동 예제 서버 재계산 배정 확정')));
  router.put('/staff', permit('staff'), (req, res) => res.json(mutate(req, (draft, input) => updateStaff(draft, input.staff), '연동 예제 역량·가중치 수정')));
  router.post('/tasks/:id/checks/:item', permit('check'), (req, res) => res.json(mutate(req, (draft, input) => checkItem(draft, {
    taskId: req.params.id, itemId: req.params.item, done: input.done, comment: input.comment, actor: req.actor
  }), '연동 예제 체크 기록')));
  router.post('/tasks/:id/complete', permit('complete'), (req, res) => res.json(mutate(req, draft => completeTask(draft, {taskId: req.params.id, actor: req.actor}), '연동 예제 완료 인폼')));
  router.post('/macros', permit('macro'), (req, res) => res.json(mutate(req, (draft, input) => createRecurringMacro(draft, input), '연동 예제 반복 생성')));
  router.post('/macros/:id/run', permit('macro'), (req, res) => res.json(mutate(req, (draft, input) => {
    if (!(draft.recurringMacros || []).some(macro => macro.id === req.params.id)) fail(404, '매크로를 찾을 수 없습니다.');
    return generateRecurring(draft, input.from, input.to, req.params.id);
  }, '연동 예제 반복 기간 생성')));

  router.get('/store/:doc', (req, res) => {
    const id = docId(req), raw = query(req, 'version');
    const current = store.get(id, documentKind);
    if (raw !== undefined && !/^[1-9]\d{0,14}$/.test(raw)) fail(400, '버전을 확인해주세요.');
    const selected = raw === undefined ? current.version : version(Number(raw), false);
    res.json({doc: req.params.doc, version: selected, data: selected === current.version ? current.data : store.version(id, documentKind, selected)});
  });
  router.post('/store/:doc', permit('document'), (req, res) => {
    const id = docId(req), input = body(req);
    const data = {title: text(input.data?.title, '제목', 150), content: text(input.data?.content, '문서 내용', 20000, false)};
    const saved = store.save(documentKind, id, data, version(input.version), req.actor, input.reason);
    res.json({doc: req.params.doc, version: saved.version, data: saved.data});
  });
  router.get('/store/:doc/history', (req, res) => res.json(store.history(docId(req), documentKind)));
  router.post('/store/:doc/revert', permit('document'), (req, res) => {
    const id = docId(req), input = body(req), current = store.get(id, documentKind);
    if (version(input.version) !== current.version) fail(409, '다른 수정이 있습니다.', 'VERSION_CONFLICT');
    const saved = store.restore(id, documentKind, version(input.targetVersion, false), current.version, req.actor, input.reason);
    res.json({doc: req.params.doc, version: saved.version, data: saved.data});
  });
  router.post('/ingestion/:source', permit('ingest'), (req, res) => {
    const input = body(req);
    if (Object.keys(input).some(key => key !== 'snapshot')) fail(400, 'URL 대신 snapshot 객체만 전달해주세요.');
    res.json(applySnapshot(store, req.params.source, input.snapshot, req.actor));
  });
  return router;
}
