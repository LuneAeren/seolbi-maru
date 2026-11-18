import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceAccess,demoServiceGrants} from '../reference-kit/service-access.js';
import {createActionGateway,demoActionAdapters} from '../reference-kit/action-gateway.js';
import {createStore} from '../src/store.js';
const now=Date.parse('2026-11-18T00:00:00Z');
test('each API service requires its own approval, valid scope and non-expired metadata',()=>{
 const grants=demoServiceGrants();
 assert.equal(serviceAccess(grants,'equipment','equipment.read',now).allowed,true);
 assert.equal(serviceAccess(grants,'reports','report.preview',now).state,'pending');
 assert.equal(serviceAccess(grants,'handover','handover.acknowledge',now).state,'not_requested');
 for(const state of ['not_requested','pending','rejected','revoked','expired','bad'])assert.equal(serviceAccess({equipment:{state}},'equipment','equipment.read',now).allowed,false);
 for(const grant of [null,{}, {state:'approved'}, {state:'approved',expiresAt:'invalid',allowedActions:['equipment.read']}, {state:'approved',expiresAt:'2099-01-01',allowedActions:[]}, {state:'approved',expiresAt:'2099-01-01',allowedActions:['report.preview']}])assert.equal(serviceAccess({equipment:grant},'equipment','equipment.read',now).allowed,false);
 assert.equal(serviceAccess({equipment:{state:'approved',expiresAt:'2026-11-18T00:00:00Z',allowedActions:['equipment.read']}},'equipment','equipment.read',now).state,'expired');
 assert.equal(serviceAccess({},'unknown','equipment.read',now).allowed,false);
});
test('approval is rechecked at dispatch; another service grant or caller approval flag cannot authorize it',async t=>{
 const store=createStore(':memory:');t.after(()=>store.close());const grants=demoServiceGrants(true);
 const gateway=createActionGateway(store,{mode:'demo',writable:true,roles:{alice:'operator'},grants,adapters:demoActionAdapters(store),clock:()=>now});
 const request=gateway.prepare('alice',{actionId:'handover.acknowledge',input:{deviceId:'MC-DEMO-01'}});
 grants.handover.state='revoked';
 await assert.rejects(()=>gateway.execute('alice',request.requestId,{confirm:true}),{code:'SERVICE_NOT_APPROVED'});
 assert.equal(store.list('ref:demo-receipt').length,0);
 assert.throws(()=>gateway.prepare('alice',{actionId:'handover.acknowledge',input:{deviceId:'MC-DEMO-01'},approved:true}),{status:400});
 assert.equal(gateway.catalog('alice').actions.find(a=>a.id==='equipment.read').available,true);
 assert.equal(gateway.catalog('alice').actions.find(a=>a.id==='handover.acknowledge').available,false);
});
