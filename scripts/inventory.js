import { readFile, writeFile } from 'node:fs/promises';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const packages=[];
for(const [path,p] of Object.entries(lock.packages)){
  if(!path)continue;
  const name=path.split('node_modules/').at(-1);
  packages.push({name,version:p.version,license:p.license||'see package',integrity:p.integrity||'',installScript:Boolean(p.hasInstallScript)});
}
packages.sort((a,b)=>a.name.localeCompare(b.name));
await writeFile('docs/DEPENDENCIES.json',JSON.stringify({generatedOn:'2026-11-15',installation:'npm ci --ignore-scripts',packages},null,2)+'\n');
console.log(`Recorded ${packages.length} dependencies. Integrity pins are in package-lock.json.`);
