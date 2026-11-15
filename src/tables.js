import { Worker } from 'node:worker_threads';
import ExcelJS from 'exceljs';
import { fail } from './core.js';
export const LIMITS = { bytes: 5 * 1024 * 1024, rows: 30000, columns: 50, cells: 500000, cellLength: 8000 };
let active = 0;
export function parseFile(buffer, filename, encoding = 'utf-8') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > LIMITS.bytes) fail(400, '파일은 비어 있지 않은 5MB 이하 파일이어야 합니다.');
  if (!/^[^<>:"/\\|?*\x00-\x1f]{1,180}\.(csv|xlsx)$/i.test(filename)) fail(400, '안전한 파일명의 CSV 또는 XLSX만 올릴 수 있습니다.');
  if (!['utf-8', 'euc-kr'].includes(encoding)) fail(400, '지원하지 않는 인코딩입니다.');
  if (active >= 2) fail(429, '다른 파일을 처리 중입니다. 잠시 후 다시 시도해주세요.');
  active++;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parser-worker.js', import.meta.url), { workerData: { buffer, filename, encoding, limits: LIMITS }, resourceLimits: { maxOldGenerationSizeMb: 192 }, execArgv: [] });
    let settled = false;
    const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); active--; void worker.terminate(); fn(value); };
    const timer = setTimeout(() => finish(reject, Object.assign(new Error('파일 처리 시간이 초과되었습니다. 표 크기를 줄여주세요.'), { status: 400 })), 12000);
    worker.once('message', result => result.error ? finish(reject, Object.assign(new Error(result.error), { status: 400 })) : finish(resolve, result));
    worker.once('error', () => finish(reject, Object.assign(new Error('파일을 처리하지 못했습니다. 형식과 크기를 확인해주세요.'), { status: 400 })));
    worker.once('exit', () => { if (!settled) finish(reject, Object.assign(new Error('파일 처리가 중단되었습니다.'), { status: 400 })); });
  });
}
export function validateTable(columns, rows) {
  if (!Array.isArray(columns) || !columns.length || columns.length > LIMITS.columns || columns.some(x => typeof x !== 'string' || !x.trim() || x.length > 100) || new Set(columns).size !== columns.length) fail(400, '열 이름은 중복 없이 1~50개여야 합니다.');
  if (!Array.isArray(rows) || rows.length > LIMITS.rows || rows.length * columns.length > LIMITS.cells || rows.some(row => !Array.isArray(row) || row.length !== columns.length || row.some(x => typeof x !== 'string' || x.length > LIMITS.cellLength || /\u0000/.test(x)))) fail(400, '표의 행·열 수 또는 셀 값이 허용 범위를 벗어났습니다.');
}
export function csvOutput(data) {
  const escape = x => `"${(/^[\s\u0000-\u001f]*[=+\-@]/u.test(x) || /^[\t\r\n]/u.test(x) ? "'" + x : x).replaceAll('"', '""')}"`;
  return '\ufeff' + [data.columns, ...data.rows].map(row => row.map(escape).join(',')).join('\r\n');
}
export async function xlsxOutput(data) {
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('자료');
  for (const row of [data.columns, ...data.rows]) { const out = sheet.addRow(row); out.eachCell(cell => { cell.numFmt = '@'; }); }
  sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach(col => { col.width = 24; });
  return Buffer.from(await book.xlsx.writeBuffer());
}
