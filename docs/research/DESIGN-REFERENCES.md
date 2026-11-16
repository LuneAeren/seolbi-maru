# 디자인 참고 자료 · 2026-11-15 확인

기존 회사 사이트를 교체하기 위한 프레임워크 선정이 아니라, 화면의 시각적 방향을 고르기 위한 읽기 자료다. 다음 저장소의 설명과 공개 파일을 읽고 자체 HTML·CSS·JavaScript로 8개 프로토타입을 작성했다. 원본 UI 라이브러리·설치 프로그램·CLI를 실행하거나 런타임에 포함하지 않았다. 실제 웹 화면은 외부 폰트·CDN·이미지·분석 서비스를 부르지 않는다.

전체 저장소와 확인한 커밋은 [design-sources.json](design-sources.json)에 기록했다. 아래 라이선스는 확인한 원본 또는 GitHub 메타데이터 기준이며, 이번 결과물에 해당 저장소의 구현 코드를 복사했다는 의미가 아니다.

| 자료 | 확인한 파일·내용 | 이번 비교에서 참고한 요소 | 라이선스 확인 |
| --- | --- | --- | --- |
| [Anthropic Frontend Design](https://github.com/anthropics/skills/blob/1780c5e5a552fd4d1c9d6a7b0cab26b0c2bef064/skills/frontend-design/SKILL.md) | 산업·사용자·핵심 과업을 먼저 정하고 타이포·색·레이아웃을 의도적으로 선택하는 지침 | 8안의 목적과 구조를 다르게 설계, 제목·정보 위계, 브리핑형 비교 | 해당 폴더 LICENSE.txt 원문 Apache-2.0 |
| [Vercel Web Design Guidelines](https://github.com/vercel-labs/agent-skills/blob/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/web-design-guidelines/SKILL.md) | 인터페이스 검토를 위한 스킬과 별도 원본 지침 URL | 폼 라벨, 키보드 접근, 상태와 오류 표시, 검토할 항목 구분 | 저장소 라이선스 미확인. 링크와 자체 요약만 제공 |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/d643997c82e94742dd3bee43210b0198e8bbba3d) | README의 스타일·색상·플랫폼별 디자인 지침 소개 | 스타일을 고정하지 않고 서로 다른 표면·간격·색감으로 비교 | GitHub 메타데이터 MIT |
| [Impeccable](https://github.com/pbakaus/impeccable/tree/2b86d9c07b97d4bed7de23583e1bd1e58dd2baae) | README의 디자인 비평·정리·일관성 검토 방식 | 관제형·기술 콘솔에서 강조해야 할 정보와 장식을 구분 | LICENSE 원문 Apache-2.0 |
| [Tabler](https://github.com/tabler/tabler/tree/46bd1d781a964202dc9be180da866f1feed3ccf5) | README의 대시보드·표·폼·밝은/어두운 구성 설명 | 상태 타일과 일정·업무 보드, 어두운 관제 화면 | GitHub 메타데이터 MIT |
| [IBM Carbon](https://github.com/carbon-design-system/carbon/tree/fa75d78b0d4b9e78e1e76bf3e459f4fc12eabeef) | README의 그리드·타입·테마·토큰·컴포넌트 체계 | 정렬, 표의 구조, 명확한 구분선과 기술 정보 위계 | GitHub 메타데이터 Apache-2.0 |
| [shadcn/ui](https://github.com/shadcn-ui/ui/tree/e62c9435fff729a175f38983dee73b2cb4f6a069) | README의 수정·확장이 가능한 구성 요소 접근 | 모듈 조합, 차분한 기본 표면, 작업 카드의 재사용 | GitHub 메타데이터 MIT |
| [Microsoft Fluent UI](https://github.com/microsoft/fluentui/tree/f9720c35ba893c9630f4c0389d07dc6d6fd6068d) | README의 데스크톱 웹 컴포넌트·기존 도구와 점진적 통합 설명 | 익숙한 명령 리본·속성 영역·탭, 회사 도구와의 연속성 | 루트 LICENSE 원문 MIT |

Vercel 스킬 원문에는 최신 원격 지침을 가져오는 단계가 있다. 회사에 전달할 로컬 참고 문서에는 그 외부 조회 단계를 실행 절차로 넣지 않았다. 회사 자료를 원본 저장소나 외부 서비스로 보내지 않는다.

## 8안의 설계 의도

| 번호 | 방향 | 먼저 보는 정보 | 다른 안과 다른 점 |
| --- | --- | --- | --- |
| 01 Graphite Ledger | 절제된 전문 업무 데스크 | 오늘 업무와 담당자 부하 | 세로 메뉴, 얇은 선, 넓은 표, 제한된 표면 장식 |
| 02 Midnight Operations | 어두운 관제실 | 진행·이상 업무 | 어두운 배경, 설비 타일, 하단 시간축 |
| 03 Ivory Briefing | 편집형 교대 브리핑 | 인수인계와 주의 사항 | 가로 메뉴, 종이색 표면, 세리프 제목, 구분선 중심 |
| 04 Cobalt Workbench | 데스크톱 업무 소프트웨어 | 명령과 일정·작업 표 | 파란 명령 바, 리본, 고정 속성 영역 |
| 05 Sage Workspace | 차분한 협업 공간 | 상태별 작업 카드 | 그린 톤, 칸반 보드, 2열 업무 흐름 |
| 06 Signal Board | 설비 신호 보드 | 설비별 현재 작업 상태 | 가로 메뉴, 큰 설비 격자, 분명한 상태 신호 |
| 07 Blueprint Console | 설비 맥락 탐색 | 선택한 설비 구조와 이력 | 기술 도면 같은 선과 구조도, 압축된 숫자, 네이비 |
| 08 Pearl Modular | 프리미엄 업무 포털 | 브리핑·인원·자료 모듈 | 플럼 계열, 비대칭 모듈, 차가운 백색 표면 |

각 안은 디자인 검토용 가짜 자료와 상호작용이다. 카드 선택·필터·체크·인폼 미리보기를 지원하지만 실제 업무를 배정하거나 운영 인폼을 생성하지 않는다. 실제 동작 레퍼런스는 `/reference-lab/`에서 따로 검증한다. 최종 디자인은 사용자가 선택한 요소를 조합한 뒤 기존 회사 사이트에 적용한다.

## v0.5 집중 홈 테마에 적용한 부분 (2026-11-17)

이미 보존한 Anthropic frontend-design과 Impeccable 원문에서 의도적인 시각 위계, 반복되는 요소의 일관성, 과한 장식 줄이기를 참고했다. 최신 요구에 맞춰 16개 화면의 구조를 통일하고 배경·표면·색감만 다르게 비교한다. [현재 디자인 기준](../HOME-DESIGN-BRIEF.md)을 우선한다. 스킬의 설치기·CLI·바이너리와 외부 런타임 호출은 사용하지 않았다.

사용자가 말한 애플 골든브릿지는 투명 위젯과 브리지 풍경으로 해석했다. [Apple의 macOS Tahoe 발표](https://www.apple.com/newsroom/2025/06/macos-tahoe-26-makes-the-mac-more-capable-productive-and-intelligent-than-ever/)는 투명 재질에 대한 참고 출처다. 저장소의 `bridge.svg`와 `mountain.svg`는 직접 제작한 그림이며 Apple의 공식 배경·공식 테마가 아니다. 원격 이미지·웹폰트를 런타임 자산으로 추가하지 않았다.
