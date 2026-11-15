import { statuses, date, text, fail } from './core.js';
/** Validated whole-source snapshots only. The caller supplies data from an approved
 * internal adapter; this module never fetches a URL. Manual records are retained.
 */
export function applySnapshot(store, source, snapshot, actor = 'internal-sync') {
  if (!['hue', 'splunk'].includes(source)) fail(400, '허용되지 않은 데이터 출처입니다.');
  const at = new Date().toISOString();
  const sources = store.meta('sources') || ['hue', 'splunk'].map(id => ({ id, name: id === 'hue' ? 'Hue' : 'Splunk', state: 'disabled', lastSuccess: null, count: null }));
  const old = sources.find(s => s.id === source);
  try {
    if (!snapshot || snapshot.complete !== true || snapshot.rejectedCount !== 0 || !Array.isArray(snapshot.records) || !snapshot.records.length || snapshot.records.length > 30000 || snapshot.readCount !== snapshot.records.length) fail(400, '완전한 수집 결과인지 확인할 수 없어 기존 정상본을 유지했습니다.');
    const observedAt = date(snapshot.observedAt), ids = new Set();
    const records = snapshot.records.map(record => {
      const key = text(record.sourceId, '원천 설비 키', 80);
      if (!/^[A-Za-z0-9_-]+$/.test(key) || ids.has(key) || !statuses.includes(record.status)) fail(400, '설비 키·중복·상태 검증에 실패했습니다.');
      ids.add(key);
      return { id: `${source}:${key}`, data: { title: text(record.title, '설비명', 150), area: text(record.area, '구역', 80), status: record.status, observedAt: date(record.observedAt), source, summary: text(record.summary || '', '설명', 2000, false), sourceKey: key } };
    });
    const nextStatus = { ...old, id: source, name: source === 'hue' ? 'Hue' : 'Splunk', state: 'ok', lastAttempt: at, lastSuccess: at, observedAt, count: records.length, readCount: snapshot.readCount, rejectedCount: 0, message: '검증된 전체 스냅샷' };
    store.replaceSource(source, records, actor, sources.filter(s => s.id !== source).concat(nextStatus));
    return nextStatus;
  } catch (error) {
    store.meta('sources', sources.filter(s => s.id !== source).concat({ ...old, id: source, name: source === 'hue' ? 'Hue' : 'Splunk', state: 'error', lastAttempt: at, message: '수집 검증 실패 · 직전 정상본 유지' }));
    throw error;
  }
}
