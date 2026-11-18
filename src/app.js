import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { security } from './security.js';
import { seed } from './seed.js';
import { AppError, fail, kinds, text, validateEntity } from './core.js';
import {demoServiceGrants} from '../reference-kit/service-access.js';
import {createActionGateway, demoActionAdapters} from '../reference-kit/action-gateway.js';
import {actionRouter} from '../reference-kit/action-router.js';
import { integrationRouter } from '../reference-kit/service-router.js';
import { referenceRouter } from '../reference-kit/router.js';
import { parseFile, validateTable, csvOutput, xlsxOutput, LIMITS } from './tables.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
function summary(entity) { if (entity.kind !== 'dataset') return entity; const { rows, columns, ...data } = entity.data; return { ...entity, data: { ...data, columns, rowCount: rows.length } }; }
function download(res, name, type, buffer) { const clean = name.replace(/[\r\n"\\]/g, '_'); res.set('Content-Disposition', `attachment; filename="download.${name.split('.').at(-1)}"; filename*=UTF-8''${encodeURIComponent(clean)}`); res.type(type).send(buffer); }
export function createApp(config, options = {}) {
  const app = express(), store = options.store || createStore(config.dataFile), drafts = new Map();
  if (config.mode === 'production' && store.meta('seeded')) throw new Error('Production cannot use a demo database. Set DATA_FILE to a separate production database.');
  if (config.mode === 'demo') seed(store);
  app.disable('x-powered-by'); app.set('trust proxy', false);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"], styleSrc: ["'self'"], imgSrc: ["'self'"], fontSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"], frameSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'self'"], upgradeInsecureRequests: config.mode === 'production' ? [] : null } }, strictTransportSecurity: config.mode === 'production' ? undefined : false, referrerPolicy: { policy: 'no-referrer' } }));
  app.use((req, res, next) => {
    if ((req.path.startsWith('/design-lab/') || req.path.startsWith('/schedule-designs/') || req.path.startsWith('/home-designs/'))) {
      res.set('Content-Security-Policy', res.get('Content-Security-Policy').replace("frame-src 'none'", "frame-src 'self'").replace("frame-ancestors 'none'", "frame-ancestors 'self'"));
    }
    res.set('Cache-Control', 'no-store');next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(security(config));
  app.use(express.json({ limit: '6mb', strict: true }));
  app.get('/api/bootstrap', (req, res) => res.json({ user: req.actor, csrf: req.portalSession.token, mode: config.mode, staleAfterMinutes: config.staleAfterMinutes || 30, limits: LIMITS, allowedSiteHosts: config.allowedSiteHosts, sources: sources(), statuses: ['운전', '정지', '점검', '확인불가'] }));
  function sources() { return store.meta('sources') || ['hue', 'splunk'].map(id => ({ id, name: id === 'hue' ? 'Hue' : 'Splunk', state: 'disabled', lastSuccess: null, count: null, message: '사내 연결부 미구현' })); }
  app.get('/api/sources', (_req, res) => res.json(sources()));
  app.get('/api/entities/:kind', (req, res) => { checkKind(req.params.kind); const all = store.list(req.params.kind, req.query.deleted === '1'); res.json(all.map(summary)); });
  app.get('/api/entities/:kind/:id/history', (req, res) => { checkKind(req.params.kind); res.json(store.history(req.params.id, req.params.kind)); });
  app.post('/api/entities/:kind/:id/restore', (req, res) => { checkKind(req.params.kind); protectSource(store.get(req.params.id, req.params.kind, true)); const { version, targetVersion, reason } = req.body; if (!Number.isInteger(version) || !Number.isInteger(targetVersion)) fail(400, '복구 버전을 확인해주세요.'); res.json(summary(store.restore(req.params.id, req.params.kind, targetVersion, version, req.actor, reason))); });
  app.get('/api/entities/:kind/:id', (req, res) => { checkKind(req.params.kind); res.json(summary(store.get(req.params.id, req.params.kind))); });
  app.post('/api/entities/:kind', (req, res) => { checkKind(req.params.kind); if (req.params.kind === 'dataset') fail(400, '자료는 파일 반입을 이용해주세요.'); const data = validateEntity(req.params.kind, req.body.data, config); if (req.params.kind === 'equipment') data.source = '수동 입력'; ensureEquipment(data); res.status(201).json(store.create(req.params.kind, data, req.actor, req.body.reason)); });
  app.put('/api/entities/:kind/:id', (req, res) => {
    const kind = req.params.kind; checkKind(kind); const old = store.get(req.params.id, kind); protectSource(old);
    let data;
    if (kind === 'dataset') data = { ...old.data, title: text(req.body.data?.title, '제목', 150), category: text(req.body.data?.category || '공통', '분류', 80), description: text(req.body.data?.description || '', '설명', 2000, false) };
    else { data = validateEntity(kind, req.body.data, config); if (kind === 'equipment') data.source = '수동 입력'; ensureEquipment(data); }
    res.json(summary(store.save(kind, old.id, data, req.body.version, req.actor, req.body.reason)));
  });
  app.delete('/api/entities/:kind/:id', (req, res) => { checkKind(req.params.kind); const old = store.get(req.params.id, req.params.kind); protectSource(old); res.json(summary(store.save(old.kind, old.id, old.data, req.body.version, req.actor, req.body.reason, true))); });
  function protectSource(entity) { if (entity.kind === 'equipment' && ['hue', 'splunk'].includes(entity.data.source)) fail(403, '원천 설비현황은 연결부에서 갱신합니다. 작업 메모로 보정 사항을 남겨주세요.'); }
  function checkKind(kind) { if (!kinds.includes(kind)) fail(404, '지원하지 않는 자료 종류입니다.'); }
  function ensureEquipment(data) { if (data.equipmentId) store.get(data.equipmentId, 'equipment'); }
  app.get('/api/datasets/:id/rows', (req, res) => {
    const e = store.get(req.params.id, 'dataset'), q = String(req.query.q || '').slice(0, 200).toLocaleLowerCase();
    const page = Math.max(1, Math.min(30000, Number.parseInt(req.query.page, 10) || 1));
    const matched = e.data.rows.map((cells, index) => ({ index, cells })).filter(row => !q || row.cells.some(x => x.toLocaleLowerCase().includes(q)));
    res.json({ ...summary(e), rows: matched.slice((page - 1) * 50, page * 50), page, total: matched.length, pages: Math.max(1, Math.ceil(matched.length / 50)) });
  });
  app.patch('/api/datasets/:id/rows', (req, res) => {
    const old = store.get(req.params.id, 'dataset');
    if (req.body.version !== old.version) fail(409, '다른 사용자가 먼저 수정했습니다. 최신 내용을 확인해주세요.', 'VERSION_CONFLICT');
    const changes = req.body.changes;
    if (!Array.isArray(changes) || !changes.length || changes.length > 500) fail(400, '한 번에 1~500개 셀을 저장할 수 있습니다.');
    const rows = old.data.rows.map(row => [...row]);
    for (const c of changes) { if (!Number.isInteger(c.row) || !Number.isInteger(c.col) || !rows[c.row] || c.col < 0 || c.col >= old.data.columns.length || typeof c.value !== 'string' || c.value.length > LIMITS.cellLength) fail(400, '수정할 셀을 확인해주세요.'); rows[c.row][c.col] = c.value; }
    validateTable(old.data.columns, rows);
    res.json(summary(store.save('dataset', old.id, { ...old.data, rows }, old.version, req.actor, req.body.reason)));
  });

  app.post('/api/datasets/:id/export', async (req, res) => {
    const current = store.get(req.params.id, 'dataset');
    if (!Number.isInteger(req.body.version)) fail(400, '자료 버전을 확인해주세요.');
    const old = { ...current, data: req.body.version === current.version ? current.data : store.version(current.id, 'dataset', req.body.version) };
    const changes = req.body.changes;
    if (!Array.isArray(changes) || changes.length > 500) fail(400, '한 번에 최대 500개 셀을 내려받을 수 있습니다.');
    const rows = old.data.rows.map(row => [...row]);
    for (const c of changes) { if (!Number.isInteger(c.row) || !Number.isInteger(c.col) || !rows[c.row] || c.col < 0 || c.col >= old.data.columns.length || typeof c.value !== 'string' || c.value.length > LIMITS.cellLength) fail(400, '수정한 셀을 확인해주세요.'); rows[c.row][c.col] = c.value; }
    const data = { columns: old.data.columns, rows }; validateTable(data.columns, data.rows);
    if (req.body.format === 'csv') download(res, old.data.title + '.csv', 'text/csv; charset=utf-8', csvOutput(data));
    else if (req.body.format === 'xlsx') download(res, old.data.title + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', await xlsxOutput(data));
    else fail(400, 'CSV 또는 XLSX를 선택해주세요.');
  });
  app.get('/api/datasets/:id/download/:format', async (req, res) => {
    const e = store.get(req.params.id, 'dataset'); const format = req.params.format;
    if (req.query.version && Number(req.query.version) !== e.version) fail(409, '자료가 변경되었습니다. 새로고침 후 내려받아주세요.', 'VERSION_CONFLICT');
    if (format === 'csv') download(res, `${e.data.title}.csv`, 'text/csv; charset=utf-8', csvOutput(e.data));
    else if (format === 'xlsx') download(res, `${e.data.title}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', await xlsxOutput(e.data));
    else if (format === 'original' && e.data.originalId) { const o = store.original(e.data.originalId); download(res, o.name, o.type, Buffer.from(o.bytes)); }
    else fail(404, '내려받을 파일이 없습니다.');
  });
  app.post('/api/imports', express.raw({ type: 'application/octet-stream', limit: LIMITS.bytes }), async (req, res) => {
    const filename = String(req.query.filename || ''), encoding = String(req.query.encoding || 'utf-8');
    const parsed = await parseFile(req.body, filename, encoding);
    for (const [id, draft] of drafts) if (draft.expires < Date.now()) drafts.delete(id);
    if (drafts.size >= 8 || [...drafts.values()].reduce((n, d) => n + d.size, 0) + req.body.length > 20 * 1024 * 1024) fail(429, '반입 대기 중인 파일이 많습니다. 기존 반입을 마치거나 10분 후 다시 시도해주세요.');
    const id = randomUUID(); drafts.set(id, { ...parsed, buffer: req.body, filename, user: req.actor, size: req.body.length, expires: Date.now() + 600000 });
    res.status(201).json({ id, filename, warnings: parsed.warnings, sheets: parsed.sheets.map(s => ({ name: s.name, columns: s.columns, rows: s.rows.slice(0, 10), rowCount: s.rows.length })) });
  });
  app.post('/api/imports/:id/commit', (req, res) => {
    const draft = drafts.get(req.params.id);
    if (!draft || draft.expires < Date.now() || draft.user !== req.actor) fail(404, '반입 미리보기가 만료되었습니다. 파일을 다시 올려주세요.');
    const sheet = draft.sheets[req.body.sheet || 0]; if (!sheet) fail(400, '시트를 선택해주세요.');
    const columns = req.body.columns || sheet.columns; validateTable(columns, sheet.rows);
    const title = text(req.body.title, '제목', 150), category = text(req.body.category || '공통', '분류', 80);
    const originalId = store.addOriginal(draft.filename, /xlsx$/i.test(draft.filename) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv', draft.buffer);
    try { const entity = store.create('dataset', { title, category, description: text(req.body.description || '', '설명', 2000, false), columns, rows: sheet.rows, originalId, sheet: sheet.name }, req.actor, '파일 반입'); drafts.delete(req.params.id); res.status(201).json(summary(entity)); }
    catch (error) { store.removeOriginal(originalId); throw error; }
  });
  const actionGateway = createActionGateway(store, {mode:config.mode, writable:config.integrationWritable === true, roles:config.integrationRoles, grants:config.mode === 'demo' ? demoServiceGrants() : {}, adapters:config.mode === 'demo' ? demoActionAdapters(store) : {}});
  app.use('/api/actions', actionRouter(actionGateway));
  app.use('/api/integration', integrationRouter(store, {mode:config.mode, writable:config.integrationWritable, roles:config.integrationRoles}));
  app.use('/api/reference', referenceRouter(store, {mode:config.mode}));
  app.use('/api', (_req, _res) => fail(404, '요청한 기능을 찾을 수 없습니다.'));
  app.use('/er-reference', express.static(fileURLToPath(new URL('../streamlit-kit/er-previews/', import.meta.url)), {etag:false,maxAge:0,dotfiles:'deny'}));
  app.use('/streamlit-reference', express.static(fileURLToPath(new URL('../streamlit-kit/previews/', import.meta.url)), {etag:false,maxAge:0,dotfiles:'deny'}));
  app.use(express.static(publicDir, { etag: false, maxAge: 0, dotfiles: 'deny' }));
  app.use((_req, res) => res.status(404).type('text').send('페이지를 찾을 수 없습니다.'));
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status >= 400 && status <= 599 ? status : 500).json({ error: status === 413 ? '파일 또는 요청 크기가 너무 큽니다.' : status < 500 ? error.message : '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', code: error.code || 'REQUEST_FAILED' });
  });
  app.locals.store = store; app.locals.config = config;
  return app;
}
