import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files = [];
for (const dir of ['src','public','scripts','test']) for (const name of await readdir(dir)) if (name.endsWith('.js')) files.push(`${dir}/${name}`);
for (const file of files) {
  const check = spawnSync(process.execPath, ['--check',file], { encoding:'utf8' });
  if (check.status !== 0) { console.error(check.stderr); process.exit(1); }
  if (!file.startsWith('src/') && !file.startsWith('public/')) continue;
  const body = await readFile(file, 'utf8');
  for (const rule of [/\beval\s*\(/, /new Function\s*\(/, /\.innerHTML\s*=/, /document\.write\s*\(/, /from ['"]node:(https?|net|tls|child_process)['"]/, /fetch\s*\(['"]https?:/]) if (rule.test(body)) throw new Error(`Disallowed runtime pattern: ${file} ${rule}`);
}
const html=await readFile('public/index.html','utf8');
if(/(?:src|href)=["']https?:/i.test(html))throw new Error('Remote asset found');
console.log(`Syntax and runtime source policy: ${files.length} files passed. This is a bounded check, not a malware guarantee.`);
