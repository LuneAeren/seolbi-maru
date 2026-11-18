import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import '../public/ui-brief/core.js';
const C=globalThis.UIBrief;
test('UI brief preserves stable IDs and distinguishes layout coordinates from wafer data',()=>{
 const before=C.initial(),after=C.clone(before);after.blocks[0].x=40;after.blocks[0].w=900;after.blocks[0].note='선택한 조건만 조회';
 const p=C.packet(after,before);assert.equal(p.layout.blocks[0].id,before.blocks[0].id);assert.equal(p.layout.blocks[0].x,40);assert.match(p.coordinateSystem,/측정 좌표와 무관/);assert.equal(p.imageIncluded,false);assert.deepEqual(p.unconfirmed,['ER unit','spatial interpolation','uniformity formula']);assert.match(C.markdown(after,before),/x: 30 → 40/);assert.equal(before.blocks[0].x,30);
});
test('UI brief import clamps geometry and rejects malformed, duplicate or oversized sketches',()=>{
 const s=C.initial();s.blocks[0].x=99999;s.blocks[0].y=-10;assert.equal(C.normalize(s).blocks[0].x,60);assert.equal(C.normalize(s).blocks[0].y,0);
 for(const invalid of [null,{version:2,blocks:[]},{version:1,blocks:Array(31).fill(s.blocks[0])},{...s,blocks:[s.blocks[0],s.blocks[0]]},{...s,blocks:[{...s.blocks[0],x:NaN}]},{...s,strokes:[[[1,2,3]]]},{...s,strokes:Array(51).fill([])}])assert.throws(()=>C.normalize(invalid));
});
test('UI brief generated HTML escapes user content and has no executable scripts or remote assets',()=>{
 const s=C.initial();s.title='</title><script>alert(1)</script>';s.blocks[0].note='<img src=x onerror=alert(1)>';s.blocks[0].color='red; background:url(https://example.com)';
 const html=C.htmlExport(s,C.initial());assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('https://example.com'));assert.ok(html.includes("default-src 'none'"));assert.ok(html.includes('data-ui-id="b-er"'));
});
test('UI brief standalone script hash matches its content and contains no runtime network path',async()=>{
 const standalone=await readFile(new URL('../ui-brief-kit/UI-통역-노트.html',import.meta.url),'utf8');const script=standalone.match(/<script>([\s\S]*)<\/script>/)[1];assert.ok(standalone.includes('sha256-'+createHash('sha256').update(script).digest('base64')));assert.ok(!/<(?:script|link)[^>]+(?:src|href)=/.test(standalone));
 for(const file of ['core.js','app.js']){const source=await readFile(new URL('../public/ui-brief/'+file,import.meta.url),'utf8');assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/.test(source));}
});

test('UI brief network-isolation headers are scoped and portal headers remain unchanged',async t=>{
 const {createApp}=await import('../src/app.js');const {once}=await import('node:events');
 const config={mode:'demo',origin:'http://127.0.0.1:0',secret:'z'.repeat(40),users:[],proxies:[],allowedSiteHosts:[],dataFile:':memory:'};const app=createApp(config),server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;config.origin=origin;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));app.locals.store.close();});
 const ui=await fetch(origin+'/ui-brief/');assert.equal(ui.status,200);const csp=ui.headers.get('content-security-policy');assert.match(csp,/connect-src 'none'/);assert.match(csp,/img-src 'self' blob:/);assert.match(csp,/script-src 'self';/);assert.match(csp,/frame-src 'none'/);
 const portal=await fetch(origin+'/');assert.equal(portal.status,200);assert.match(portal.headers.get('content-security-policy'),/connect-src 'self'/);assert.ok(!portal.headers.get('content-security-policy').includes("'unsafe-inline'"));
});
