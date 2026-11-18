# 사내 사이트를 열지 않고 포털에서 동작하기 · v0.7.0

후속 확인: 공식 API가 있으며 서비스마다 별도 신청이 필요하다. 기본 방식은 승인된 API별 연결이며 [서비스별 승인 가이드](SERVICE-API-APPLICATIONS.md)를 함께 읽는다.

검토일: 2026-11-18. 실제 사내 SSO·대상 사이트·API는 확인하지 않았다. 회사 주소·쿠키·토큰·HAR·실제 업무 자료는 사용하지 않았다.

## 추천하는 구조

대상 사이트 전체를 iframe/WebView로 계속 실행하는 대신, **필요한 업무 동작을 명시적인 API로 연결**한다.

```text
포털 버튼 → 같은 출처의 Express API → 승인된 사내 대상 API → 작은 JSON 결과 → 포털 카드
```

버튼의 화면 좌표나 CSS 선택자를 보내는 방식이 아니다. 예를 들어 '설비 요약 조회', '보고서 요약 조회', '인계 메모 확인 기록'처럼 의미가 정해진 동작 ID를 보낸다. 대상 API가 제공하고 승인한 기능만 연결한다. 초기에는 조회 1개를 먼저 옮긴다. 결재·설비 제어 같은 동작은 이 데모의 예시 대상이 아니다.

이 구조는 다른 사이트의 전체 화면·스크립트·타이머를 계속 실행할 필요를 줄일 수 있다. 실제 CPU·메모리 감소량은 현재 임베딩 방식과 대상 사이트에 따라 달라진다. 현재 프로젝트에서 확인한 것은 데모 iframe 0개·자동 폴링 없음이며, 실제 회사 사이트 대비 성능 수치는 측정하지 않았다.

## 조건별 선택

| 사내에서 확인한 조건 | 선택할 방식 | 남는 조건 |
| --- | --- | --- |
| 공식 내부 API + 서버에서 사용할 사용자 위임 인증 가능 | **추천: Express BFF/동작 게이트웨이** | 대상 API의 사용자·리소스 권한 검사와 사내 네트워크 허용 |
| 공식 API가 브라우저 세션만 지원하고 대상 담당자가 CORS/CSRF 협조 가능 | 브라우저 → 승인된 내부 API 직접 호출 | 정확한 origin 허용, 쿠키/SameSite/브라우저 정책, 대상 CSRF, 포털 CSP의 승인된 내부 connect-src |
| API는 없지만 대상 코드 수정 가능 | 가벼운 연동 API 신설이 우선. 필요하면 postMessage 전용 연동 페이지 | 대상 담당자의 코드·인증·임베딩 정책 협조 |
| API도 없고 대상 코드도 수정 불가 | 포털만 수정해서 범용 버튼 실행을 보장할 수 없음 | 필요한 순간만 원본 열기, 또는 회사 승인하의 확장/RPA 검토 |

일반 웹페이지는 다른 origin의 iframe DOM을 읽어 버튼을 직접 클릭할 수 없다. CORS는 다른 출처 HTTP 응답 접근을 정하는 체계이며 타 사이트 DOM 조작 권한을 주지 않는다. frame-ancestors/X-Frame-Options 등 대상의 임베딩 정책도 포털에서 임의로 무력화하지 않는다. 같은 회사 SSO로 로그인했다는 사실만으로 두 사이트가 같은 origin이 되거나 Express 서버에 대상 사이트 세션이 생기는 것도 아니다. [MDN 동일 출처](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy), [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)

## SSO는 별도로 확인한다

| 확인 사항 | 이유 |
| --- | --- |
| OIDC/OAuth, SAML, Windows 통합 인증, 애플리케이션 쿠키 중 무엇인지 | 브라우저 로그인과 서버의 API 인증 경로가 서로 다를 수 있음 |
| 대상 API가 사용자 위임을 지원하는지 | 포털 사용자의 실제 권한으로 호출해야 함 |
| 대상 API의 audience/scope·권한·리소스 범위·부서 제한 | 포털 로그인 성공을 대상 API 권한으로 대신하지 않음 |
| 세션 만료·추가 로그인·MFA 발생 시 처리 | 로그인 HTML/리다이렉트를 성공 결과로 표시하지 않음 |
| API의 idempotency key·요청 상태 조회 지원 | 통신이 끊겨도 중복 업무를 생성하지 않기 위함 |

Entra ID를 쓰고 대상 API가 지원한다면 OAuth OBO 같은 사용자 위임 방식이 후보가 된다. 이는 **회사 SSO가 Entra라는 가정이 아니며**, SAML 쿠키를 그대로 OBO 토큰으로 쓸 수 있다는 뜻도 아니다. Windows 통합 인증이나 세션 기반이라면 사내 인증 담당자가 지원하는 위임/게이트웨이 규약을 확인한다. 서버가 브라우저의 Windows 로그인 자격이나 대상 쿠키를 자동으로 상속한다고 가정하지 않는다. [Microsoft OBO 공식 문서](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow)

브라우저의 쿠키를 추출해서 서버에 복사하거나 여러 사용자가 하나의 관리자 계정을 공유하는 연결부는 제공하지 않는다. 계정 암호·세션 쿠키·토큰을 프런트엔드, Git, 로그, localStorage에 넣지 않는다. 토큰/비밀 관리와 갱신은 회사가 승인한 서버 방식으로 구현한다.

## 이번 저장소에서 동작하는 예제

`/action-lab/`는 다른 사이트로 이동하지 않고 가짜 조회와 확인 기록을 수행한다. **실제 사내 API 호출·SSO·웹사이트 클릭 자동화는 구현하지 않았다.** production에서는 모든 동작의 디스패치를 비활성으로 둔다.

| 파일 | 역할 |
| --- | --- |
| `reference-kit/action-gateway.js` | 허용된 동작·설비·역할·입력, 검토, 요청 상태, 중복 디스패치 방지 |
| `reference-kit/action-router.js` | `/api/actions` HTTP 연결부, 상위 인증·CSRF 재사용 |
| `public/action-lab/` | 16px 데스크톱 버튼·검토·결과·수동 상태 확인 UI |
| `test/action-gateway.test.js` | 권한·잘못된 URL 입력·중복·시간 초과·재시작·CSRF 검사 |
| `reference-kit/recipes/13-internal-actions.md` | 실제 사내 이식 순서 |

### API

모든 요청은 포털과 같은 출처다. POST에는 기존 세션 쿠키와 `/api/bootstrap`에서 받은 CSRF 토큰이 필요하다. 클라이언트는 URL·HTTP 메서드·헤더·쿠키·CSS 선택자·스크립트를 보낼 수 없다. POST 본문은 기존 상위 파서 제한 내에서 추가로 4KiB를 검사한다.

| 경로 | 의미 |
| --- | --- |
| GET `/api/actions/catalog` | 동작 ID·이름·권한/연결 상태·데모 설비 목록 |
| POST `/api/actions/prepare` | `{actionId,input:{deviceId}}` → 검토할 requestId와 2분 만료 시각 |
| POST `/api/actions/:id/execute` | `{confirm:true}` 변경 동작 명시 확인, 조회는 `{}` 가능 |
| GET `/api/actions/:id` | 해당 사용자의 요청 상태·정제된 결과, 다른 사용자 요청은 404 |
| POST `/api/actions/:id/cancel` | 실행 전 prepared만 취소 |

동작은 `equipment.read`, `report.preview`, `handover.acknowledge` 세 개다. 조회는 viewer/operator/assigner, 확인 기록은 operator/assigner에 데모 쓰기 허용까지 필요하다. 실제 리소스 범위 검증은 현재의 MC-DEMO-01~03 허용 목록을 사내 권한 검사로 교체해야 한다.

### 상태와 중복 처리

```text
prepared → running → succeeded
    ├→ cancelled        └→ uncertain
    └→ expired
```

- 검토한 입력은 서버에 저장하며 execute에서 다른 입력을 받지 않는다. 실행 직전에 역할·연결 상태를 다시 확인한다.
- 영속 저장소 CAS로 running을 먼저 기록한 뒤 서버가 등록한 함수 하나를 호출한다. 같은 requestId는 다시 디스패치하지 않고 기존 처리 상태/결과를 반환한다.
- timeout·연결 오류·불완전 응답은 uncertain이다. upstream이 이미 처리했을 수 있으므로 자동 재시도하지 않는다. AbortSignal은 종료 요청일 뿐, 원천 변경이 취소됐다는 증거가 아니다.
- 다른 프로세스/재시작 시 running 요청은 디스패치 마감 시각까지 기다린 뒤 결과 미확인으로 바꾼다. 현재 구현은 timeout + 5초 여유다. 일찍 unknown으로 바꿔 정상 실행과 충돌하지 않게 한다.
- 준비 ID는 같은 사용자에게만 유효하다. 상태 요청은 별도 검토 ID/토큰을 외부로 보내지 않는다. UI는 requestId만 탭의 sessionStorage에 보관하고 새로고침 시 상태를 읽는다. 쿠키·SSO 토큰·실제 자료를 저장하지 않는다.
- **같은 ID의 중복 전송 방지**이며 원천 시스템의 exactly-once 보장이 아니다. 사용자가 새 ID로 같은 업무를 만들거나 원천이 idempotency key를 지원하지 않는 경우의 업무 중복까지 해결하지 않는다. 실제 변경 기능은 원천의 업무 키·idempotency·결과 조회·대사 규약까지 연결한 후 제공한다.
- uncertain은 운영자의 원천 확인/대사 전 자동으로 해제하지 않는다. 현재 데모는 재시작 후 대기·미확인 처리까지 구현하며 실제 원천 대사/수동 해결 API는 제공하지 않는다.
- 데모 보관 한도는 사용자당 200개다. 무제한 작업 큐나 운영용 보관/정리 서비스가 아니다.

## 실제 내부 API 어댑터 계약

```js
async function approvedAction({actor, input, idempotencyKey, signal}) {
  // 회사 안에서만 구현한다:
  // 1. actor의 대상 API 사용자 위임과 input의 설비/문서 권한을 검증한다.
  // 2. 서버가 고정한 내부 호스트·경로·메서드로만 호출한다.
  // 3. idempotencyKey와 signal, 연결/응답 제한을 적용한다.
  // 4. 401/403, 로그인 HTML, 3xx를 처리하고 자동 로그인/변경 재시도를 하지 않는다.
  // 5. 승인된 최소 필드만 결과로 돌려준다.
  return {summary: '처리 결과 요약', items: [{label: '결과', value: '확인할 값'}]};
}
```

이 함수에 실제 HTTP 구현·토큰·주소를 외부에서 채우지 않는다. 원본 게이트웨이는 mode=demo일 때만 가짜 어댑터를 호출한다. 사내 담당자는 이 예제의 승인·권한·트랜잭션·감사 규칙을 기존 v-etch 서버에 이식하고, 별도로 검토된 운영 연결부를 만든다. 기존 레퍼런스의 production 차단을 편의상 해제하지 않는다.

사내 내부 주소라는 이유로 임의 URL 프록시를 만들지 않는다. 허용 목적지·포트·고정 경로·DNS/IP 해석·리다이렉트·TLS·시간/응답 크기·서버 egress를 함께 제한한다. 목적지가 내부망이므로 모든 사설 IP를 무조건 막는 예제를 복사하지 말고 **승인된 내부 목적지**를 명시적으로 허용한다. 나머지 목적지는 거절한다. TLS 인증서 검증을 끄거나 외부 중계 서버를 추가하지 않는다. [OWASP SSRF 방지 지침](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## 대안: 대상 담당자가 제공하는 postMessage 브리지

API를 직접 열기 어렵고 대상이 협조할 수 있을 때만 쓴다. 대상이 전체 SPA 대신 가벼운 연동 전용 페이지를 제공하고, 포털이 그 페이지 한 개와 명시적인 메시지를 주고받는다. 대상은 자기 origin에서 자신의 로그인과 CSRF 규칙으로 업무 함수를 수행한다. 부모 포털이 iframe 버튼을 직접 누르는 방식이 아니다.

메시지 규약 예:

```js
{
  protocol: 'internal-actions/v1',
  requestId: '서버에서 준비한 고유 요청 ID',
  actionId: '담당자가 허용한 동작 ID',
  input: {deviceId: '사내에서 권한을 확인할 설비 키'}
}
```

양쪽 모두 정확한 targetOrigin을 사용한다. 수신 측은 event.origin과 event.source, protocol, 요청 ID, 허용 동작과 입력을 검사한다. '*'·임의 스크립트/선택자·HTML 실행·토큰 전달을 사용하지 않는다. 메시지 수신은 서버의 사용자/리소스 권한이나 CSRF를 대신하지 않는다. 준비/완료 핸드셰이크·타임아웃·중복 처리도 필요하다. 대상의 frame-ancestors 허용 및 브라우저 쿠키 정책이 맞아야 한다. 지원이 없으면 CORS를 바꿔도 이 브리지가 저절로 생기지 않는다. [MDN postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

이 브리지의 실제 구현은 대상 담당자가 만들어야 하므로 이번 배포에는 실행 가능한 범용 브리지·확장 프로그램·RPA를 넣지 않았다. 숨긴 iframe 전체 앱은 여전히 자원을 쓸 수 있으므로 리소스 해결책으로 제시하지 않는다.

## 사내 AI가 확인할 순서

1. 포털 안에서 열어두는 사이트별로 '조회/보고서/등록/완료' 목적과 현재 동시 로딩 수를 기록한다.
2. 공식 API 문서·지원 인증 방식·대상 소유자 협조 여부를 사내에서 확인한다. 승인된 자기 업무 동작 1개를 내부 개발자 도구에서 관찰할 수 있지만 HAR·쿠키·토큰·실제 본문을 외부로 내보내지 않는다.
3. 조회 1개부터 같은 출처 BFF에 연결한다. 정상 응답, 권한 없음, 세션 만료, 로그인 HTML/리다이렉트, timeout을 검증한다.
4. 실제 사이트/동작별 메모리·CPU·요청 수를 전후 같은 조건으로 측정한다. 단순히 iframe을 안 보이게 한 결과와 구분한다.
5. 원천이 idempotency·결과 확인을 지원하는 변경 동작만 검토 후 확장한다. 불명확한 결과를 성공으로 추정하거나 자동 재실행하지 않는다.
6. 변환 파일·인증/권한 연결·통과 테스트·실측 성능·미구현 부분을 보고한다.

회사에서 필요한 정보는 대상 사이트의 API 유무, 대표 동작 2~3개, 코드 수정/협조 가능 여부, 사용자 위임 규약이다. 아직 이 정보가 없으므로 현재 문서와 코드는 안전한 비교·이식 레퍼런스까지다.
