import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalizeSettings,signalState,signalSummary} from '../public/home-designs/settings.js';

test('corrupt and untrusted preferences retain safe defaults and ignore unknown fields',()=>{
 for(const input of [null,42,'20',[],{font:'20',density:'tiny',motion:'yes',start:'https://example.invalid',main:0,unknown:true}]){
  assert.deepEqual(normalizeSettings(input),{...defaults});
 }
 const result=normalizeSettings({font:20,density:'compact',motion:false,start:'업무',focus:true});
 assert.equal(result.font,20);assert.equal(result.motion,false);assert.equal(result.start,'업무');
 assert.equal(result.focus,true);assert.equal(result.density,'compact');
 assert.deepEqual(normalizeSettings(null),{...defaults});
});

test('preference normalization always leaves at least one equipment group visible',()=>{
 const result=normalizeSettings({main:false,chamber:false,lp:false});
 assert.equal(result.main,true);assert.equal(result.chamber,false);assert.equal(result.lp,false);
 assert.equal(normalizeSettings({main:false,chamber:false,lp:true}).main,false);
});

test('unknown and missing equipment signals are never counted as normal',()=>{
 for(const value of [undefined,null,'','running','미확인',false])assert.equal(signalState(value),'미확인');
 const counts=signalSummary([{signals:{main:'정상',chamberA:'점검',chamberB:'정지',lp1:'unexpected'}},{signals:null}]);
 assert.deepEqual(counts,{정상:1,점검:1,정지:1,미확인:7});
});
