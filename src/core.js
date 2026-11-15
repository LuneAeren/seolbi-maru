export class AppError extends Error {
  constructor(status, message, code = 'INVALID_INPUT') { super(message); this.status = status; this.code = code; }
}
export const fail = (status, message, code) => { throw new AppError(status, message, code); };
export function text(value, label, max = 200, required = true) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value) || (required && !value.trim())) fail(400, `${label} 값을 확인해주세요.`);
  return value.trim();
}
export const kinds = ['equipment', 'info', 'site', 'note', 'dataset'];
export const statuses = ['운전', '정지', '점검', '확인불가'];
export function safeSite(value, allowedHosts = []) {
  const raw = text(value, '주소', 1000);
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) {
    const u = new URL(raw, 'http://local.invalid');
    if (u.origin === 'http://local.invalid' && !u.username && !u.password) return raw;
  }
  let url; try { url = new URL(raw); } catch { fail(400, '올바른 사내 주소를 입력해주세요.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !allowedHosts.includes(url.host)) fail(400, '운영자가 허용한 사내 주소만 등록할 수 있습니다.');
  return url.href;
}
export function validateEntity(kind, input, config = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, '입력 형식을 확인해주세요.');
  const title = text(input.title, '제목', 150);
  if (kind === 'equipment') return { title, area: text(input.area, '구역', 80), status: statuses.includes(input.status) ? input.status : fail(400, '설비 상태를 확인해주세요.'), observedAt: date(input.observedAt), source: text(input.source || '수동 입력', '출처', 80), summary: text(input.summary || '', '설명', 2000, false) };
  if (kind === 'site') return { title, category: text(input.category || '공통', '분류', 80), url: safeSite(input.url, config.allowedSiteHosts), description: text(input.description || '', '설명', 2000, false), equipmentId: text(input.equipmentId || '', '설비', 80, false) };
  if (kind === 'info' || kind === 'note') return { title, body: text(input.body || '', '내용', 5000, false), equipmentId: text(input.equipmentId || '', '설비', 80, false), category: text(input.category || (kind === 'info' ? '인폼' : '미완료'), '분류', 80), effectiveAt: date(input.effectiveAt || new Date().toISOString()), expiresAt: input.expiresAt ? date(input.expiresAt) : '' };
  fail(400, '지원하지 않는 자료 종류입니다.');
}
export function date(value) { if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) fail(400, '날짜와 시간을 확인해주세요.'); return new Date(value).toISOString(); }
