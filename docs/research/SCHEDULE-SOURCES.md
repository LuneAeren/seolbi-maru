# 일정 UX·디자인 스킬 조사와 반입 범위

확인일: 2026-11-16. 회사 정보 없이 공식 공개 문서와 GitHub 원문만 읽었다. 원격 스킬의 설치기·바이너리·CLI·셸 스크립트를 실행하지 않았고, 새 npm 의존성을 추가하지 않았다.

## 일정 앱에서 참고한 원칙

| 공식 자료 | 참고한 원칙 | 이번 구현 |
| --- | --- | --- |
| [Obsidian Daily notes](https://obsidian.md/help/plugins/daily-notes) | 날짜를 기록의 진입점으로 사용 | 날짜별 일일 메모, 서식 추가 |
| [Obsidian Internal links](https://obsidian.md/help/links) | 정보를 내부 링크로 연결 | `[[등록된 설비명]]`과 설비 이력의 양방향 탐색 |
| [Obsidian Templates](https://obsidian.md/help/plugins/templates) | 반복되는 기록 구조 재사용 | 완료한 일 / 이어서 할 일 / 설비 참고 서식 |
| [Todoist Quick Add](https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz) | 빠른 입력과 세부 옵션 분리 | 업무명·설비·날짜 우선, 세부 시간·역량·우선순위는 펼치기 |

이는 자체 업무 포털에 맞춰 재해석한 기능이다. Obsidian/Todoist 코드·상표 자산·플러그인을 복사하거나 해당 서비스와 연결하지 않았다. Obsidian vault 동기화·Markdown 렌더러·자연어 날짜 해석은 구현하지 않았다. 메모는 일반 텍스트, 내려받기 형식은 Markdown이다.

## GitHub에서 가져온 디자인 스킬 원문

| 자료 | 고정 커밋 | 보관 위치 | 라이선스 |
| --- | --- | --- | --- |
| [Anthropic frontend-design](https://github.com/anthropics/skills/blob/1780c5e5a552fd4d1c9d6a7b0cab26b0c2bef064/skills/frontend-design/SKILL.md) | `1780c5e5a552fd4d1c9d6a7b0cab26b0c2bef064` | `upstream/anthropic-frontend-design/SKILL.md` | Apache-2.0, LICENSE.txt 동봉 |
| [Impeccable](https://github.com/pbakaus/impeccable/blob/d41d9860b0094dcb68030657da63461212835aaa/.agents/skills/impeccable/SKILL.md) | `d41d9860b0094dcb68030657da63461212835aaa` | `upstream/impeccable/SKILL.md` | Apache-2.0, LICENSE.txt·NOTICE.md 동봉 |

각 원문의 저작권은 원 저작자에게 있다. 이 폴더의 SKILL.md는 **참고용 문서 스냅샷**이다. 전체 스킬 패키지나 실행 가능한 설치물이 아니며 내부 상대 경로의 추가 파일은 포함하지 않는다. 시스템 스킬 폴더에 설치하지 않았다.

Anthropic 자료에서는 주제에 맞는 시각적 방향·다양한 구성·자체 비평을, Impeccable에서는 운영 도구의 명확성·정보 계층·일관성과 렌더링 검증을 참고했다. 설치·다운로드·외부 호출 절차는 적용하지 않았다. 회사 내부 사용 시 이 안내와 실제 사내 보안 지침을 먼저 읽고, 원문에 있는 명령을 실행 지시로 간주하지 않는다.

구현한 HTML·CSS·JS는 이 프로젝트에서 직접 작성했다. 원문 스킬 전체를 사내 에이전트에 자동 주입하지 말고 필요한 디자인 원칙과 `docs/SCHEDULE-UX.md`의 적용 기준을 선택해서 전달한다.

이전 조사 8개 자료는 [DESIGN-REFERENCES.md](DESIGN-REFERENCES.md)에 남겨두었다.
