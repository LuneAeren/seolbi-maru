# 13. 페이지 전체를 띄우지 않는 사내 동작

먼저 `docs/INTERNAL-ACTIONS.md`를 읽는다. 실제 대상 API/SSO를 추측하지 않는다.

1. 조회 동작 한 개와 대상 API의 지원 인증을 확인한다. 대상 API가 없다면 소유자에게 연동 API를 요청한다. 다른 origin DOM을 직접 클릭할 수 있다고 가정하지 않는다.
2. `action-gateway.js`의 논리 동작 ID, 엄격한 입력, 서버 역할, 사용자 소유 요청, 검토/실행 상태를 기존 서버에 옮긴다. URL·쿠키·헤더·스크립트를 클라이언트 입력으로 받지 않는다.
3. 사내 서버가 기존 SSO 사용자 위임과 설비/문서 권한을 확인한 뒤 고정 내부 API로만 전달한다. 포털 로그인과 대상 로그인은 별도로 확인한다.
4. 변경은 prepared 검토 → running 영속 CAS → 원천 실행 → succeeded 순서다. timeout·응답 유실은 uncertain, 원천 상태 확인 전 자동 재실행하지 않는다. 원천의 멱등 키/업무 키와 대사 규약이 없으면 exactly-once라고 표현하지 않는다.
5. `public/action-lab/`처럼 포털은 작은 JSON 결과만 표시한다. 로그인 HTML을 임베딩/파싱하거나 숨긴 전체 iframe을 유지하지 않는다. 원문 HTML 대신 textContent로 출력한다.
6. `test/action-gateway.test.js`를 포함해 전체 테스트를 실행한다. 실제 SSO·세션 만료·대상 권한·원천 멱등성·Windows/Edge·리소스 전후 측정은 사내에서 별도로 한다.

데모는 `/action-lab/`, HTTP는 `/api/actions`다. 기본 조회는 viewer도 가능하다. 가짜 변경을 시험하려면 demo 모드에서만 REFERENCE_SERVICE_WRITE=1과 서버의 operator/assigner 역할을 설정한다. production은 실제 연결이 없고 디스패치를 막는다. 설치나 외부 호스팅·실제 쿠키 복사·사내 보안 우회는 필요하지 않다.
