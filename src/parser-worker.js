import { parentPort, workerData } from 'node:worker_threads';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import yauzl from 'yauzl';
const { filename, encoding, limits } = workerData;
const buffer = Buffer.from(workerData.buffer);
function check(condition, message) { if (!condition) throw new Error(message); }
async function inspectZip() {
  await new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
    if (error) return reject(new Error('올바른 XLSX 압축 형식이 아닙니다.'));
    let total = 0, entries = 0, done = false;
    const bad = message => { if (done) return; done = true; zip.close(); reject(new Error(message)); };
    zip.on('error', () => bad('XLSX 압축 파일이 손상되었습니다.'));
    zip.on('entry', entry => {
      const name = entry.fileName;
      if (++entries > 600 || (entry.generalPurposeBitFlag & 1) || name.includes('..') || name.startsWith('/') || /vba|externalLinks|embeddings|\.bin$/i.test(name)) return bad('매크로·외부 연결·포함 개체 또는 과도하게 복잡한 XLSX는 지원하지 않습니다.');
      if (name.endsWith('/')) return zip.readEntry();
      if (!/\.(xml|rels)$/i.test(name)) return bad('표 데이터 이외의 파일이 포함된 XLSX는 지원하지 않습니다.');
      total += entry.uncompressedSize;
      if (total > 32 * 1024 * 1024 || entry.uncompressedSize > 16 * 1024 * 1024 || entry.uncompressedSize > Math.max(entry.compressedSize, 1) * 250) return bad('압축 해제 크기가 너무 큽니다. 표를 나누어 올려주세요.');
      zip.openReadStream(entry, (err, stream) => {
        if (err) return bad('XLSX 내용을 읽을 수 없습니다.');
        let count = 0; const chunks = [];
        stream.on('data', chunk => { count += chunk.length; if (count > entry.uncompressedSize || count > 16 * 1024 * 1024) { stream.destroy(); bad('압축 크기 검증에 실패했습니다.'); } else chunks.push(chunk); });
        stream.on('error', () => bad('XLSX 압축 데이터가 올바르지 않습니다.'));
        stream.on('end', () => { if (done) return; const xml = Buffer.concat(chunks).toString('utf8'); if (/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']/i.test(xml)) return bad('외부 참조 또는 외부 링크가 포함된 XLSX는 반입할 수 없습니다.'); zip.readEntry(); });
      });
    });
    zip.on('end', () => { if (!done) { done = true; resolve(); } });
    zip.readEntry();
  }));
}
function table(name, values) {
  while (values.length && values.at(-1).every(x => x === '')) values.pop();
  check(values.length > 0, '표에 머리글이 없습니다.');
  const columns = values[0].map(x => x.trim()), rows = values.slice(1);
  check(columns.length > 0 && columns.length <= limits.columns && new Set(columns).size === columns.length && columns.every(x => x && x.length <= 100), '첫 행에는 중복 없는 열 이름이 필요합니다. 최대 50열입니다.');
  check(rows.length <= limits.rows && rows.length * columns.length <= limits.cells, '최대 30,000행·500,000셀까지 반입할 수 있습니다.');
  for (const row of rows) { check(row.length <= columns.length, '머리글보다 열이 많은 행이 있습니다.'); while (row.length < columns.length) row.push(''); check(row.every(x => x.length <= limits.cellLength && !x.includes('\u0000')), '셀 길이 또는 문자 제한을 초과했습니다.'); }
  return { name, columns, rows };
}
try {
  let sheets, formulaCount = 0;
  if (/\.csv$/i.test(filename)) {
    const content = new TextDecoder(encoding, { fatal: true }).decode(buffer);
    let values;
    try { values = parse(content, { bom: true, skip_empty_lines: true, max_record_size: 400000, cast: false, relax_column_count: false }); } catch { throw new Error('CSV의 인코딩·따옴표·행별 열 수를 확인해주세요.'); }
    sheets = [table('CSV', values)];
  } else {
    check(buffer.readUInt32LE(0) === 0x04034b50, '올바른 XLSX 파일이 아닙니다.');
    await inspectZip();
    const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
    check(book.worksheets.length > 0 && book.worksheets.length <= 10, '시트는 1~10개까지만 지원합니다.');
    sheets = book.worksheets.filter(sheet => sheet.actualRowCount > 0).map(sheet => {
      check(sheet.rowCount <= limits.rows + 1 && sheet.columnCount <= limits.columns, '시트의 행·열 수가 허용 범위를 초과했습니다.');
      const width = sheet.columnCount, values = [];
      sheet.eachRow({ includeEmpty: true }, row => {
        const cells = [];
        for (let col = 1; col <= width; col++) {
          const cell = row.getCell(col), value = cell.value;
          if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) { formulaCount++; cells.push('=' + (value.formula || value.sharedFormula)); }
          else if (value instanceof Date) cells.push(value.toISOString());
          else if (value && typeof value === 'object' && 'richText' in value) cells.push(value.richText.map(x => x.text).join(''));
          else if (value === null || value === undefined) cells.push('');
          else if (typeof value === 'object') cells.push(String(value.text || value.error || ''));
          else if (typeof value === 'number' && /^0{2,}$/.test(cell.numFmt || '')) cells.push(String(value).padStart(cell.numFmt.length, '0'));
          else cells.push(String(value));
        }
        values.push(cells);
      });
      return table(sheet.name, values);
    });
    check(sheets.length > 0 && sheets.reduce((n, s) => n + s.rows.length * s.columns.length, 0) <= limits.cells, '전체 시트의 셀 수가 허용 범위를 초과했습니다.');
  }
  parentPort.postMessage({ sheets, warnings: formulaCount ? [`수식 ${formulaCount}개를 실행하지 않고 텍스트로 반입했습니다.`] : [] });
} catch (e) { parentPort.postMessage({ error: /CSV|XLSX|시트|표|셀|열|행|머리글|압축|외부|파일/.test(e.message) ? e.message.slice(0, 180) : '파일을 읽을 수 없습니다. 형식과 인코딩을 확인해주세요.' }); }
