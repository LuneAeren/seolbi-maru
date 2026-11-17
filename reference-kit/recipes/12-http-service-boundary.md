# 12. HTTP 서비스 경계와 권한

기존 01~11 레시피를 보존하고 HTTP 연결·권한·CAS·검증을 한 경계에 모은 예제다. `../../docs/INTEGRATION-API.md`의 경로 표와 `../service-router.js`를 함께 읽는다.

1. 부모 Express 앱에서 기존 사내 인증·부서 확인 → same-origin/CSRF → 제한된 JSON 파서 순서로 미들웨어를 둔다. 인증 결과를 서버가 `req.actor`에 넣는다.
2. `integrationRouter(store,{mode,writable,roles})`를 `/api/integration`에 연결한다. 초기값은 writable=false, 미등록 역할 viewer다. 임의 헤더·body 역할을 사용하지 않는다.
3. 먼저 workspace/day-plan GET만 연결한다. `planner.js`의 입력 스키마에 맞춰 기존 업무·인원·일정을 변환한다. staff 필터로 재배정하지 않는다.
4. `plan-cards.js`의 카드 스키마를 화면에 연결하고 미배정 사유를 그대로 표시한다. 프런트엔드는 카드만으로 실제 일정을 생성하지 않는다.
5. 각 쓰기 작업을 사내 권한 표·DB 트랜잭션에 연결한다. 현재 예제의 production 쓰기 차단은 유지하고 회사의 별도 승인된 운영 라우터에서 적용을 검토한다.
6. workspace는 복제본에 검증/변경 후 CAS 저장한다. 실패 시 변경을 저장하지 않는다. 문서는 version=0 생성, 이후 같은 버전 동시 저장은 1개 성공·나머지 409다. 복원은 새 버전을 추가한다.
7. ingestion은 URL을 받지 않는다. 기존 사내 어댑터가 완전한 스냅샷을 전달하고 `applySnapshot`이 원자적으로 반영한다. 잘못된 스냅샷은 설비 정상본을 덮어쓰지 않는다.
8. `test/integration-service.test.js`와 기존 test 전체를 실행한다. 가짜 역할 헤더, 기본 403, 운영 403, CSRF, version409, 체크 미완료, 반복 중복, 잘못된 스냅샷을 검증한다.

입력 version과 서버 역할은 서로 다른 검증이다. CAS를 통과해도 쓰기 권한이 생기지 않는다. 실제 v-etch의 담당자/설비 범위, SSO 규약, DB 드라이버는 확인하지 않았으므로 이 코드를 운영에 그대로 공개하지 않는다. 회사 주소·자료를 Git에 추가하거나 원격 AI로 전송하지 않는다.
