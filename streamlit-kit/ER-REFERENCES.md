# 선그래프·ER 맵 표현 레퍼런스

기존 사내 사이트의 X/Y 좌표·DB·SSO·원천 값은 유지한다. 이 자료는 **화면을 고른 뒤 번호로 수정 요청을 전달하는 참고 묶음**이다. 좌표 수집기나 새 ER 계산기를 이식하는 작업이 아니다.

## 먼저 화면 고르기

Express 실행 후 [ER·선그래프 모음](http://127.0.0.1:4317/er-reference/)을 연다. 서버 없이 `er-previews/index.html`을 직접 열어도 된다. GitHub에서는 아래 SVG를 눌러 볼 수 있다. HTML은 실제 Streamlit UI가 아닌 정적 참고 화면이다.

| 번호 | 표현 | 참고 그림 |
| --- | --- | --- |
| ER-01 | 측정값 중심 맵 | [SVG](er-previews/ER-01.svg) |
| ER-02 | 맵과 측정점 목록 | [SVG](er-previews/ER-02.svg) |
| ER-03 | 미측정 구분 맵 | [SVG](er-previews/ER-03.svg) |
| ER-04 | 두 웨이퍼 나란히 비교 | [SVG](er-previews/ER-04.svg) |
| ER-05 | 여러 웨이퍼 요약 | [SVG](er-previews/ER-05.svg) |
| ER-06 | 선택점 상세 보기 | [SVG](er-previews/ER-06.svg) |
| LINE-01 | 한 계열에 집중 | [SVG](er-previews/LINE-01.svg) |
| LINE-02 | 두 계열 겹쳐 비교 | [SVG](er-previews/LINE-02.svg) |
| LINE-03 | 계열별 분리 비교 | [SVG](er-previews/LINE-03.svg) |
| LINE-04 | 추이와 선택값 상세 | [SVG](er-previews/LINE-04.svg) |

각 번호마다 HTML·SVG·JSON·수정 요청서 `.md`·참고 `.py`가 있다. 예를 들어 ER-04를 골랐다면 `ER-04.svg`, `ER-04.json`, `ER-04.md`를 사내 AI에게 함께 전달한다. `.py`는 가짜 SVG 표현을 Streamlit에 표시하는 예제이며 기존 앱을 자동 변경하지 않는다. ER-06과 LINE-04의 선택 상태도 정적 예시다. 클릭 선택·hover·연계 필터는 사내 그래프 라이브러리에 맞게 구현하고 검증해야 한다.

> ER-04처럼 웨이퍼 두 개를 나란히 보여줘. 기존 X/Y 좌표와 원천 ER 값, 로그인·DB 연결은 유지해줘. 노치는 9시로 고정하고 두 맵의 색상 범위와 X/Y 축 비율을 맞춰줘. 현재 쓰는 보간·단위·균일도 계산 규칙은 변경하지 말고, 선택한 두 맵만 생성해줘. 수정 파일과 검증 결과를 알려줘.

또는 “LINE-03처럼 계열을 분리하되 같은 축 범위를 쓰고 기존 설비·기간 필터는 유지해줘”처럼 요청한다. 회사 데이터·주소·환경 보고서는 회사 안에서만 사용한다.

## 정해진 것과 미정인 것

- ER 맵은 원형 웨이퍼이며 **노치는 9시 방향**이다. 기존 좌표가 다른 기준이면 먼저 회사 좌표계와 표시 방향을 대조한다. 숫자 X/Y를 임의 회전·반전하지 않는다.
- 샘플은 임의로 만든 정규화 좌표 13개다. 실제 측정 위치·웨이퍼 크기·사내 샘플링 패턴이 아니다. 선그래프도 가짜 측정 순서 12개다.
- 색상/축 범위 90~110은 예제 비교용이다. 실제 공정 규격·단위·알람 기준으로 사용하지 않는다. 실제 범위는 기존 앱의 승인된 규칙을 따른다.
- **ER 단위·공간 보간·균일도 계산식은 미정**이다. JSON에는 단위/균일도를 null, 보간을 not_requested로 남겼다. 새 보간이나 계산식을 추가하지 않는다. 기존 사내 계산 결과를 유지한다.
- 정적 예제는 측정 위치만 색으로 표시한다. 빈 공간의 색을 추정하지 않는다. 미측정은 회색 X로 구분하며 0과 다르다. 선그래프의 누락 구간도 이어 채우지 않는다. 이는 표현 참고이며 기존 결측 처리 정책을 무단 교체하지 않는다.

## Streamlit에서 참고 화면 보기

회사에 이미 승인·설치된 환경에서만 실행한다. 패키지 설치나 업그레이드는 포함하지 않는다.

```powershell
cd streamlit-kit
python inspect_environment.py
python -m streamlit run er_reference_app.py
```

`selectbox`로 고른 표현 하나만 SVG로 생성한다. 숨겨진 탭 10개를 한꺼번에 렌더링하지 않는다. SVG 표시에는 `st.image`를 사용한다. 실제 회사 버전에서 지원하는지 먼저 확인한다. [Streamlit st.image 공식 문서](https://docs.streamlit.io/develop/api-reference/media/st.image)

Plotly가 이미 승인·설치된 경우에만 선택 체크박스로 단일 맵 예제를 볼 수 있다. `plotly_single_map_example(points, coordinate_radius, color_range)`는 figure 딕셔너리를 반환하며 **기존 좌표계의 반경과 승인된 색상 범위를 필수로 받는다**. 입력 X/Y를 보존하고 원 밖/중복 위치는 임의로 자르거나 평균내지 않고 오류로 돌린다. 중심이 (0,0)인 직교좌표를 가정하는 참고 함수다. 기존 사내 좌표의 원점·축 방향·중복점 의미가 다르면 연결 전에 그 차이를 검토한다. 실제 측정점에 normalized 반경 1을 무조건 적용하지 않는다.

X/Y의 단위 길이가 같도록 `scaleanchor`와 `scaleratio`를 설정하고 비교 맵은 같은 색상 범위를 사용한다. 회사의 설치 버전에 맞춰 표현부만 옮긴다. [Plotly 축 문서](https://plotly.com/python/axes/), [색상 범위 문서](https://plotly.com/python/colorscales/), [Streamlit Plotly 문서](https://docs.streamlit.io/develop/api-reference/charts/st.plotly_chart)

## 최적화할 때 사내 AI에게 줄 순서

1. 데이터 읽기 → 변환 → figure 생성 → 화면 렌더링 시간을 나눠 측정한다. 현재 처리 시간과 반복 실행 횟수를 먼저 기록한다. 데이터 내용을 로그에 남기지 않는다.
2. 현재 선택한 설비·기간·웨이퍼만 생성한다. 탭을 숨겼다는 이유로 생성 비용이 사라졌다고 판단하지 않는다. 탭 계산 방식과 지연 실행 API는 설치 버전에 따라 확인한다. 버전을 모르면 선택값에 따른 조건 분기를 사용한다. [현재 탭 문서](https://docs.streamlit.io/develop/api-reference/layout/st.tabs), [1.50 탭 문서](https://docs.streamlit.io/1.50.0/develop/api-reference/layout/st.tabs)
3. 기존 좌표 형상·검증된 정규화 결과를 재사용할 수 있는지 확인한다. 캐시는 사용자·부서 권한 범위, 원천 스냅샷 버전, 설비·기간 필터를 구분하고 승인된 갱신 규칙을 따른다. 인증정보를 캐시 키/출력에 넣지 않는다. 무작정 사용자 간 공유 캐시를 추가하지 않는다.
4. 많은 웨이퍼는 먼저 작은 요약을 보여주고 선택한 것만 상세 생성한다. 표시 점 수를 줄이거나 보간·집계 규칙을 바꾸는 최적화는 별도 합의 없이 하지 않는다.
5. 전후 처리 시간과 메모리를 같은 조건에서 비교하고 값·점 위치·9시 노치·축 비율·색상 범위·미측정 표시가 보존되는지 확인한다. 이 키트에는 실제 회사 성능 개선 수치가 없다.

## 파일과 검증 범위

`er_reference.py`는 가짜 그림·명세·요청서와 선택적인 Plotly 단일 맵 딕셔너리 예제다. `build_er_preview.py`는 정적 파일을 다시 만들고 `test_er_reference.py`는 표준 라이브러리 회귀 검사다. 기존 일반 차트 6종은 `previews/`와 `app.py`에 보존한다.

현재 개발 PC에는 Streamlit/Plotly가 없다. **실제 Streamlit 위젯·Plotly 렌더링/hover·사내 버전 호환은 미검증**이다. 검증한 것은 Python 로직/문법, 브라우저의 정적 표현 10종, 로컬 파일 응답이다. 이번 ER 화면의 브라우저 다운로드 완료 확인은 연결 문제로 중단되어 미검증으로 기록했다. 설치·업그레이드·회사 DB 접속은 하지 않았다. 상세 기록은 [검수 결과](../docs/VERIFICATION.md)와 [브라우저 확인 범위](../docs/ER-BROWSER-CHECKS.json)에 있다.
