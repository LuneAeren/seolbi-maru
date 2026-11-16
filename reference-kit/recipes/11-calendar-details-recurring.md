# 11. 장소·상세·매 N일 반복 생성

디자인 대상은 홈화면이며 캘린더는 별도 업무 도구다. 캘린더에는 장소·상세 내용·반복 생성 규칙을 제공한다. 이 '매크로'는 템플릿과 날짜 규칙으로 업무 카드를 생성하는 기능이며 코드·VBA·셸 스크립트를 실행하지 않는다.

## 장소와 상세

validateTask의 선택 필드: location 최대 150자, details 최대 4,000자. 일반 텍스트로 보존한다. CSV·XLSX에는 선택 열 '장소', '상세'를 사용할 수 있다. 빠른 업무 추가와 일정 지정/변경 화면에서 입력하고 선택 작업의 상세에서 읽는다.

scheduleTask는 기존 예상 시간을 유지하고 원천 시간 경계·역량·용량·충돌을 검증한 뒤 장소·상세·일정을 함께 저장한다. 오류 시 부분 변경하지 않는다. 완료된 작업의 일정 수정은 허용하지 않는다.

## 반복 생성 계약

- createRecurringMacro(state,{task,everyDays,anchorDay,throughDay}): 검증된 업무 템플릿과 기준일을 저장하고 기준일부터 throughDay까지 해당 매크로의 업무만 생성.
- previewRecurring(state,from,to): 활성 매크로의 기준일에서 N일씩 떨어진 발생일을 계산. 기존 업무와 새 업무를 구분.
- generateRecurring(state,from,to): 미리보기 규칙으로 재계산 후 아직 없는 업무만 생성. 담당자 미지정 pending 상태이며 일정 확정·배정은 별도.
- setRecurringEnabled(state,id,enabled): 이후 생성 참여를 제어. 이미 생성한 업무는 삭제하지 않음.

간격 1~365일의 정수, 한 번의 생성 기간 0~90일, 매크로 최대 50개, 한 번에 검토할 발생일 최대 500개, 전체 데모 업무 최대 2,000개다. 생성 간격은 한국 시간의 날짜를 기준으로 계산하며 기준일은 변하지 않는다. 윤년·월말을 Date의 UTC 날짜 산술로 처리해 시간대에 따른 하루 오차를 피한다.

반복 업무에는 recurringId와 원래 발생일 recurringDay를 저장한다. **(매크로 ID, 원래 발생일)은 고유**해야 한다. 개별 일정의 실행일·장소·상세를 수정해도 같은 발생일을 새로 만들지 않는다. 기존 수동 업무와 내용이 일치하면 내용 해시로도 중복을 제외한다. 작업 이식 시 DB에 유일 제약과 원자적 트랜잭션을 적용한다. source day, recurringDay, plannedDay를 혼동하지 않는다.

## API

기존 인증·CSRF·버전 보호를 유지한다. 모든 변경은 version을 받고 workspace 버전이 오래되면 409다. production 레퍼런스 쓰기는 계속 차단한다.

| 경로 | 입력 |
| --- | --- |
| POST /api/reference/recurring | version, task, everyDays, anchorDay, throughDay |
| POST /api/reference/recurring/preview | version, from, to |
| POST /api/reference/recurring/generate | version, from, to |
| PUT /api/reference/recurring/enabled | version, id, enabled |

## 실행 방식과 사내 연결

예제는 **기간을 지정해 미래 업무를 미리 생성**한다. 처음 저장 시 지정일까지 생성하고 이후 필요한 기간을 추가로 생성한다. 앱이 꺼진 동안 매일 실행되는 서버 스케줄러는 포함하지 않는다. 사내에서 상시 생성이 필요하면 승인된 Windows 작업 스케줄러/서비스가 generateRecurring을 호출하는 연결부를 추가한다. 운영 인증·권한과 DB 고유 제약을 먼저 연결하며 외부 네트워크나 외부 AI를 사용하지 않는다.

검증: 3일 간격 날짜, 월말/윤년, 재생성 중복 없음, 일정·장소 수정 후에도 중복 없음, 중지/재개, 잘못된 기간·간격 거절, 용량 초과 시 원본 유지, CSRF·오래된 버전 거절. test/recurring.test.js 참고.
