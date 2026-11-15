export function seed(store) {
  if (store.meta('seeded')) return;
  const now = Date.now();
  const areaNames = ['가공 A구역', '가공 B구역', '조립 구역', '검사 구역'];
  const names = ['정밀 가공기', '세정 장치', '이송 장치', '검사 장치'];
  for (let i = 0; i < 16; i++) {
    const id = `DEMO-${String(i + 1).padStart(3, '0')}`;
    const status = i === 3 || i === 11 ? '정지' : i === 6 || i === 9 ? '점검' : i === 14 ? '확인불가' : '운전';
    store.save('equipment', id, { title: `${names[i % 4]} ${String(i + 1).padStart(2, '0')}`, area: areaNames[Math.floor(i / 4)], status, observedAt: new Date(now - (i === 14 ? 7200000 : i * 60000)).toISOString(), source: '가짜 데이터', summary: status === '정지' ? '상태 확인과 담당자 메모가 필요한 샘플 설비입니다.' : status === '점검' ? '예방 점검 진행 예시입니다.' : '' }, 0, 'demo-engineer', '데모 자료 생성');
  }
  const items = [
    ['세정 장치 점검 인폼', '필터 점검 후 담당자가 상태를 확인해주세요. 회사 업무자료가 아닌 샘플입니다.', 'DEMO-004', '점검'],
    ['교대 인수인계 안내', '주요 설비 상태와 미완료 작업을 확인하고 다음 담당자에게 메모를 남겨주세요.', '', '인수인계'],
    ['검사 기준 자료 갱신', '새로 등록한 자료는 원본과 표 데이터를 비교한 뒤 공유본으로 저장해주세요.', 'DEMO-012', '자료'],
    ['정기 점검 일정 확인', '점검 일정과 설비별 준비 사항을 확인하는 예시 인폼입니다.', 'DEMO-007', '점검']
  ];
  for (const [title, body, equipmentId, category] of items) store.create('info', { title, body, equipmentId, category, effectiveAt: new Date(now).toISOString(), expiresAt: '' }, 'demo-engineer');
  store.create('note', { title: '부품 교체 이력 확인', body: '직전 작업 이력을 확인하고 결과를 기록해주세요.', equipmentId: 'DEMO-004', category: '미완료', effectiveAt: new Date(now).toISOString(), expiresAt: '' }, 'demo-engineer');
  for (const [title, description, category, url] of [['설비 이력 시스템', '설비별 작업 이력과 점검 결과', '설비 관리', '/?view=equipment'], ['업무 표준 자료', '표준과 점검표를 찾는 자료실', '업무자료', '/?view=materials'], ['교대 인수인계', '인폼과 작업 메모 확인', '협업', '/?view=info'], ['설비현황 대시보드', '설비 상태를 한눈에 확인', '설비 관리', '/']]) store.create('site', { title, description, category, url, equipmentId: '' }, 'demo-engineer');
  store.create('dataset', { title: '설비 점검표 · 샘플', category: '점검표', description: '가짜 설비 자료로 표 편집과 다운로드를 확인하세요.', columns: ['설비번호', '점검항목', '점검결과', '비고'], rows: [['DEMO-001', '외관 상태', '양호', ''], ['DEMO-004', '필터 상태', '확인 필요', '담당자 확인'], ['DEMO-007', '윤활 상태', '점검 중', '']], originalId: '', sheet: '점검표' }, 'demo-engineer');
  store.meta('sources', [{ id: 'demo', name: '샘플 데이터', state: 'sample', lastSuccess: new Date(now).toISOString(), count: 16, message: '실제 설비와 연결되지 않았습니다.' }, { id: 'hue', name: 'Hue', state: 'disabled', lastSuccess: null, count: null, message: '사내에서 승인된 연결부를 구현해주세요.' }, { id: 'splunk', name: 'Splunk', state: 'disabled', lastSuccess: null, count: null, message: '사내에서 승인된 연결부를 구현해주세요.' }]);
  store.meta('seeded', true);
}
