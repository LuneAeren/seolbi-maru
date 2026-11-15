# 01 · 메일·엑셀 → 정규화한 업무

입구: `parseMailText` 또는 기존 `parseFile`의 행 → `validateTask` → `importTasks`.

회사 메일/엑셀 어댑터는 `title, equipment, day, minutes, skill, level, priority, earliest, deadline, source`를 반환한다. 실제 회사 메일 본문을 외부 AI로 보내지 않는다. 모호한 메일은 후보 상태로 남기고 담당자가 필드를 확인하게 한다.

원본의 날짜·시작 가능·마감 조건을 별도 값으로 전달한다. 제목의 ‘교대 전’ 같은 문구에서 시간을 임의 추정하지 않는다. 재반입 중복은 정규화한 필드의 해시로 제외한다. 수정·취소 메일의 원천 ID와 버전 규칙은 별도로 추가한다.

합격 조건: 한글·앞자리 0 보존, 필수 열 누락 거절, 잘못된 행 하나가 있으면 전체 반입 보류, 재반입 중복 제외, 미래 날짜는 오늘 배정에서 제외. `fixtures/오늘업무-샘플.csv`로 확인한다.
