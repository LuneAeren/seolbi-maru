import {readFile, mkdir, mkdtemp, writeFile, copyFile} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Export only release-manifest entries. Never traverse data/ or copy user uploads.
const root = fileURLToPath(new URL('../', import.meta.url));
const manifestBytes = await readFile(join(root, 'docs/SOURCE-MANIFEST.json'));
const manifest = JSON.parse(manifestBytes);
const selected = manifest.files.filter(file => !file.path.startsWith('fixtures/'));
for (const file of selected) {
  const path = resolve(root, file.path);
  if (!path.startsWith(root) || file.path.split('/').some(part => ['data', 'node_modules', '.git'].includes(part)) || /(^|\/)\.env($|\.)/.test(file.path) && file.path !== '.env.example') throw new Error('Unsafe manifest path: ' + file.path);
  if (createHash('sha256').update(await readFile(path)).digest('hex') !== file.sha256) throw new Error('Release file differs from manifest: ' + file.path);
}
for (const required of ['reference-kit/router.js', 'reference-kit/service-router.js', 'src/security.js', 'src/store.js', 'src/ingestion.js', 'test/integration-service.test.js', 'reference-kit/action-gateway.js', 'reference-kit/action-router.js', 'test/action-gateway.test.js', 'public/action-lab/index.html', 'public/action-lab/app.js', 'public/action-lab/styles.css', 'docs/INTERNAL-ACTIONS.md', 'reference-kit/service-access.js', 'test/service-access.test.js', 'streamlit-kit/app.py', 'streamlit-kit/chart_core.py', 'streamlit-kit/inspect_environment.py', 'streamlit-kit/previews/index.html', 'streamlit-kit/README.md']) {
  if (!selected.some(file => file.path === required)) throw new Error('Required transfer file missing: ' + required);
}
for (let number = 1; number <= 15; number++) {
  const prefix = 'reference-kit/recipes/' + String(number).padStart(2, '0') + '-';
  if (!selected.some(file => file.path.startsWith(prefix) && file.path.endsWith('.md'))) throw new Error('Missing recipe: ' + prefix);
}
await mkdir(join(root, 'data'), {recursive: true});
const destination = await mkdtemp(join(root, 'data/SeolbiMaru-Ref-'));
for (const file of selected) {
  const target = join(destination, file.path); await mkdir(dirname(target), {recursive: true}); await copyFile(join(root, file.path), target);
}
await mkdir(join(destination, 'docs'), {recursive: true});
await writeFile(join(destination, 'docs/SOURCE-MANIFEST.json'), manifestBytes);
await writeFile(join(destination, 'EXPORT-MANIFEST.json'), JSON.stringify({version: manifest.version, files: selected}, null, 2) + '\n');
await writeFile(join(destination, 'EXPORT-NOTES.md'), '# SeolbiMaru-Ref\n\nRead docs/VETCH-HANDOFF.md first. This export contains the listed release source, routes, recipes, tests and previews. fixtures/ files are deliberately omitted; scripts/make-fixtures.js generates synthetic examples. No data/, node_modules/, real uploads or credentials are copied. SOURCE-MANIFEST describes the full release; EXPORT-MANIFEST describes this filtered transfer.\n');
console.log(JSON.stringify({destination, version: manifest.version, files: selected.length}));
