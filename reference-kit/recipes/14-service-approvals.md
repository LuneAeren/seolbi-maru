# 14. 서비스별 API 승인

`docs/SERVICE-API-APPLICATIONS.md`를 읽는다. 서비스별 신청 승인·scope·유효기간과 사용자 권한/SSO 위임은 별도 조건이다. 신뢰된 서버 승인 정보만 `service-access.js`에 전달하고 미확인 시 차단한다. 준비와 실행에서 모두 검사하며 브라우저가 승인 상태를 변경할 수 없게 한다. 승인 전에는 대상 페이지 자동 클릭이나 숨긴 iframe으로 대체하지 않는다. 실제 제공자 scope와 논리 action ID를 사내에서 명시적으로 연결한다.
