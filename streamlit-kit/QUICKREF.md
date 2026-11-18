# Streamlit 사내 빠른 참고

공식 문서를 2026-11-18에 확인한 **자체 요약**이다. 공식 문서 원문 전체를 복제하거나 웹사이트를 오프라인 미러링한 자료는 아니다. 문서 사이트의 당시 기본 API 표시는 1.67.0이었지만 회사 설치 버전은 모른다. 최신 인자·기능을 기존 앱에 무조건 복사하지 않는다.

| 원하는 것 | 먼저 볼 API | 적용 원칙 |
| --- | --- | --- |
| 추이 | `st.line_chart(data,x=...,y=...)` | 날짜 순서·집계 단위를 먼저 고정 |
| 설비별 비교 | `st.bar_chart` | 합계/평균과 단위를 명시 |
| 두 수치의 관계 | `st.scatter_chart` | 인과·예측으로 해석하지 않음 |
| 실제 집계값 확인 | `st.dataframe` | 그래프와 같은 필터/집계 결과를 표시 |
| 여러 필터를 한 번에 적용 | `st.form`, `st.form_submit_button` | 매 입력마다 비싼 처리를 반복하는 부담을 줄임 |
| 사용자 선택 유지 | `st.session_state` | 사용자 세션의 UI 상태, 비밀·권한 판정과 구분 |
| JSON/명세/예제 내려받기 | `st.download_button` | form 밖에 두고 실제 자료 반출 규칙 준수 |
| 반복되는 조회/변환 | `st.cache_data` | 권한 범위·원천 버전·필터를 캐시 키에 포함 |
| DB 연결 같은 재사용 자원 | `st.cache_resource` | 연결의 thread safety·인증 범위를 회사에서 확인 |

Streamlit은 일반적으로 상호작용 시 스크립트를 다시 실행하므로, 비싼 조회/집계를 위젯 처리와 분리한다. form은 관련 입력을 묶어 제출할 수 있다. [공식 실행 흐름](https://docs.streamlit.io/develop/api-reference/execution-flow), [form](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form)

캐시를 추가할 때 동일 함수 결과가 사용자 간 공유될 수 있음을 고려한다. 인증/부서/리소스 검사는 캐시 조회 전에 수행하고, 데이터 범위가 다른 사용자가 같은 캐시 키로 섞이지 않게 한다. 부서·권한 정책 버전·원천 스냅샷 버전·필터 등 비밀이 아닌 범위 식별자를 사용한다. 토큰이나 쿠키를 로그·다운로드·캐시에 저장하지 않는다. 이름 앞 `_`로 권한 관련 인자를 해시에서 제외하는 편법은 사용하지 않는다. 캐시 TTL/상한·갱신·만료 표시를 정하고 실제 작업 기록 쓰기에는 캐시를 적용하지 않는다. [cache_data 공식 문서](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.cache_data)

처음에는 기본 차트 API를 사용한다. 정교한 축·다중 계열이 필요하면 회사에 이미 승인/설치된 Altair/Plotly 등의 버전을 확인하고 해당 레시피만 추가한다. 인터랙티브 차트가 필요하다는 이유로 외부 CDN이나 새 패키지를 자동 설치하지 않는다. [차트 목록](https://docs.streamlit.io/develop/api-reference/charts), [line](https://docs.streamlit.io/develop/api-reference/charts/st.line_chart), [bar](https://docs.streamlit.io/develop/api-reference/charts/st.bar_chart), [scatter](https://docs.streamlit.io/develop/api-reference/charts/st.scatter_chart)

제공 config는 `[browser] gatherUsageStats=false`, 루프백 주소, CORS/XSRF 보호를 유지한다. 실행 디렉터리/버전에 따라 config 적용 위치를 확인한다. `.streamlit/config.toml`을 읽도록 키트 폴더에서 실행한다. 실제 사내 공유는 기존 SSO/프록시 담당자가 연결한다. 연결 문제를 해결하려고 CORS/XSRF/TLS 검증을 끄지 않는다. 이 설정만으로 OS·패키지·플러그인의 모든 외부 통신 부재가 증명되지는 않는다. [설정과 usage stats](https://docs.streamlit.io/develop/concepts/configuration/options), [config.toml](https://docs.streamlit.io/develop/api-reference/configuration/config.toml)

인터넷이 없을 때는 `inspect_environment.py --docstrings`로 **설치된 라이브러리의 실제 API**를 먼저 읽는다. 예제 코드와 함수 서명이 다르면 사내 설치 버전을 기준으로 수정한다. 새 API를 있다고 가정하거나 호환 문제를 자동 업그레이드로 해결하지 않는다.

사내 AI에게 한 번에 줄 정보는 **예제 번호 / 현재 버전 / 열·자료형·단위 / 필터 / 집계 / 잘못된 값 처리 / 바꾸면 안 되는 기능 / 가짜 예시 / 합격 기준**이다. 이는 언어 모델을 인터넷에 연결하는 기능이 아니라 설명을 재사용 가능한 명세로 바꾸는 방법이다.
