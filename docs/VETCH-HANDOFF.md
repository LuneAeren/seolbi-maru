# v-etch 이식 인계 · SeolbiMaru v0.7.0

대상은 설비마루 한 저장소다. 회사 코드·데이터·주소를 반출하거나 이 저장소에 합치지 않는다. 아래 구현은 사내 SSO·DB에 붙이는 참고 예제이며 실제 v-etch 소스나 스키마를 본 상태는 아니다.

## v0.7 사내 동작 연결부

[INTERNAL-ACTIONS.md](INTERNAL-ACTIONS.md)를 먼저 읽는다. 기존 사이트 전체를 임베딩하는 대신 승인된 사내 API를 통해 필요한 기능만 호출하는 설계다. `reference-kit/action-gateway.js`, `action-router.js`, `public/action-lab/`, `test/action-gateway.test.js`, 13번 레시피를 추가했다. 실제 대상 API/SSO는 미확인이며 production 디스패치는 비활성이다. API 유무·사용자 위임·소유자 협조 여부에 따라 선택한다. 데모의 CPU/메모리 절감 수치를 실제 사내 실측으로 표현하지 않는다.

## 이미 있었던 파일과 경로 정정

| 요청된 자료 | 실제 파일 | 상태 |
| --- | --- | --- |
| 기존 HTTP 연결부 | `reference-kit/router.js` | `/api/reference`에 이미 연결. production 변경 요청 403 |
| 연계 레시피 11개 | `reference-kit/recipes/01-*.md` ~ `11-*.md` | 모두 보존. 새 12번 HTTP 경계 레시피 추가 |
| 인증·CSRF·사이트 허용 목록 | `src/security.js`, `src/core.js` | 서명 프록시 규약·부서 목록·세션·동일 출처·CSRF 예제 |
| DB 스키마·버전·이력 | `src/store.js` | SQLite entities/history/originals/meta 정의, CAS와 트랜잭션 |
| 표 파일 처리 | `src/tables.js`, `src/parser-worker.js` | CSV/XLSX 검증·반입·출력. tables.js는 DB 스키마가 아님 |
| 내부 스냅샷 반영 | `src/ingestion.js` | URL 조회 없이 받은 전체 스냅샷 검증·원자적 반영 |
| 회귀 검증 | `test/*.test.js` | 기존 테스트와 새 HTTP 연동 테스트 포함, 총 49개 |
| 최신 홈 | `public/home-designs/focus.js`, `settings.js`, `focus.css`, `catalog.js` | 공통 홈·옵니버스·16개 테마. home.js는 이전 홈 보존용 |
| 설비 배정 화면 | `public/schedule-designs/04-*.html`, `12-*.html`, `16-*.html` | 인원별 격자·배정 검토·용량 분배 참고. prototypes.js/catalog.js/CSS와 함께 사용 |
| 모든 미리보기 | `docs/previews/README.md` | 최신 테마 16개 + 이전 검수 이미지 48개 |

`fixtures/점검표-샘플.csv`, `점검표-샘플.xlsx`, `오늘업무-샘플.csv`는 이 저장소에서 작성한 가짜 데이터다. 실제 회사의 인사·결재 파일이 아니다. 인용된 '반입단가-누락', '결재표-누락' 이름의 파일은 이 저장소에 없다. 다른 추출본에 그런 파일이 있다면 이 샘플과 동일하다고 간주하지 않는다. `scripts/make-fixtures.js`, `src/seed.js`, `sampleWorkspace`를 읽어 출처를 확인할 수 있다.

## 새로 추가한 기능

1. `/api/integration` 전용 Express 연결부: 날짜별 배정 초안·작업 반입·배정 확정·가중치·체크/완료·반복 매크로·버전 문서·스냅샷 반영.
2. 기본 쓰기 차단과 서버가 정하는 viewer/operator/assigner 역할. 요청의 임의 역할·작성자는 신뢰하지 않는다.
3. `toPlanCards`: 배정 결과와 미배정 사유를 화면 카드 JSON으로 투영. 직원 필터는 전체 계산 후 적용해 배정을 바꾸지 않는다.
4. `npm run export:reference`: 릴리스 manifest의 파일만 별도 폴더로 복사하고 누락을 검사. 실행 DB·업로드·환경 파일·node_modules·fixtures 파일은 제외한다. 가짜 샘플은 생성 스크립트로 만든다.

별도 node:http 서버를 추가하지 않고 요청한 Express 기반과 기존 보안 미들웨어를 재사용했다. 패키지는 추가하지 않았다. 새 API 규격은 [HTTP API 한 장](INTEGRATION-API.md), 구현 순서는 [12번 레시피](../reference-kit/recipes/12-http-service-boundary.md)를 읽는다.

## 가져갈 때

전체 GitHub 저장소나 소스 ZIP을 가져오면 라우터·레시피·테스트·HTML·이미지가 포함된다. 순수 함수만 추출해 다시 HTTP 연결부를 빠뜨리지 않는다.

반입용 폴더를 별도로 만들려면 릴리스 루트에서:

```sh
npm run export:reference
```

`data/SeolbiMaru-Ref-...`라는 새 폴더와 `EXPORT-MANIFEST.json`이 생긴다. 복사 전에 릴리스 원문 해시를 확인하므로 회사 코드로 수정한 파일은 자동 반출하지 않고 중단한다. 이 출력 폴더는 Git에서 제외된다. 스크립트는 기존 data 폴더를 탐색하지 않는다. 패키지 자체나 임의 회사 파일을 자동 수집하지 않는다.

사내 AI에게는 다음처럼 전달한다:

> README.md → docs/VETCH-HANDOFF.md → docs/INTEGRATION-API.md → reference-kit/recipes/12-http-service-boundary.md 순으로 읽어라. 기존 v-etch 로그인·권한·DB를 유지하고 연결부만 단계적으로 이식하라. 새 API의 기본 403을 운영에서 임의 해제하지 마라. 실제 사용자 역할은 사내 서버가 확정해야 한다. tasks/staff/bookings 필드 변환을 먼저 제시하고 같은 회귀 테스트를 실행하라. 외부 URL 조회·CDN·AI API·텔레메트리·자동 업데이트를 추가하지 마라. 가짜 설비·역량·체크리스트를 실제 운영 기준으로 사용하지 마라.

현재 Node.js 24.x 기반이다. v-etch가 다른 버전을 쓰면 SQLite 저장 계층 등 호환성을 사내에서 먼저 확인한다. Windows/Edge·실제 회사 SSO·DB·권한·패킷 차단 검증은 이 저장소의 테스트 결과와 구분한다.
