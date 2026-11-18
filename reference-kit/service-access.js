/** Provider approval metadata is supplied by a trusted server-side process, never the browser.
 * These three services are synthetic examples; no addresses or credentials are included.
 */
export const actionServices = Object.freeze([
  {id: 'equipment', name: '가짜 설비 API', actions: ['equipment.read']},
  {id: 'reports', name: '가짜 보고서 API', actions: ['report.preview']},
  {id: 'handover', name: '가짜 인계 API', actions: ['handover.acknowledge']}
]);
const labels = Object.freeze({not_requested:'미신청',pending:'심사 중',approved:'승인',rejected:'반려',revoked:'회수',expired:'만료',unavailable:'승인 정보 확인 불가'});
export function serviceAccess(grants, serviceId, actionId, now = Date.now()) {
  const service = actionServices.find(item => item.id === serviceId);
  if (!service || !service.actions.includes(actionId)) return {serviceId, state:'unavailable',label:labels.unavailable,allowed:false};
  const grant = grants && Object.hasOwn(grants,serviceId) ? grants[serviceId] : undefined;
  let state = grant === undefined ? 'not_requested' : grant && Object.hasOwn(labels,grant.state) ? grant.state : 'unavailable';
  if (state === 'approved') {
    const expiry = typeof grant.expiresAt === 'string' ? Date.parse(grant.expiresAt) : NaN;
    if (!Number.isFinite(expiry) || !Number.isFinite(now) || !Array.isArray(grant.allowedActions) || grant.allowedActions.some(id => !service.actions.includes(id))) state = 'unavailable';
    else if (expiry <= now) state = 'expired';
    else if (!grant.allowedActions.includes(actionId)) state = 'unavailable';
  }
  return {serviceId,serviceName:service.name,state,label:labels[state],allowed:state==='approved'};
}
export function demoServiceGrants(allApproved = false) {
  return Object.fromEntries(actionServices.map(service => [service.id, {
    state: allApproved || service.id==='equipment' ? 'approved' : service.id==='reports' ? 'pending' : 'not_requested',
    expiresAt:'2099-01-01T00:00:00Z',allowedActions:[...service.actions]
  }]));
}
