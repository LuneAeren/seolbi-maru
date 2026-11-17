# HTTP 연동 API · v1 / 설비마루 v0.6.0

접두사 `/api/integration`. 기존 `/api/reference`와 별도 예제 공간이다. Express의 `security(config)`와 제한된 JSON 파서 뒤에 연결한다. **신원·부서·CSRF는 부모 미들웨어**, 역할은 서버 설정 `REFERENCE_SERVICE_ROLES`가 확정한다. `X-Role`·body.actor·body.role은 권한 근거가 아니다.

## 기본값과 역할

기본은 읽기 전용이며 변경 요청은 403이다. `APP_MODE=production`에서는 쓰기를 켤 수 없다. 기존 포털의 다른 API 전체가 읽기 전용이라는 뜻은 아니다. 새 `/api/integration` 경계만 설명한다.

| 역할 | 데모 쓰기 허용 시 가능한 변경 |
| --- | --- |
| viewer / 미등록 사용자 역할 | 없음 |
| operator | 체크 기록, 완료·인폼, 공유 텍스트 문서 |
| assigner | 위 기능 + 반입, 배정 확정, 역량·가중치, 매크로, 스냅샷 |

읽기는 기존 인증·부서 제한을 통과한 사용자에게 허용한다. operator의 담당자별 소유권 제한은 구현하지 않았다. v-etch에서 사용자·설비·부서 범위를 추가해야 한다.

## 경로

| 메서드·경로 | 입력 / 응답 | 쓰기 역할 |
| --- | --- | --- |
| GET `/capabilities` | role, writable, 허용 actions | 읽기 |
| GET `/workspace` | version, data: staff/tasks/bookings/checklists 등 | 읽기 |
| GET `/day-plan?date=YYYY-MM-DD&staff=A,B` | version, inputHash, assignments, unassigned, loads, cards | 읽기 |
| POST `/tasks` | `{version,records:[작업]}` → 반입/중복 수 | assigner |
| POST `/plan/commit` | `{version,date,includeOverdue?:boolean}` → 서버 재계산 후 일정·체크리스트 생성 | assigner |
| PUT `/staff` | `{version,staff:담당자}` → 역량·가중치 검증 | assigner |
| POST `/tasks/:id/checks/:item` | `{version,done:boolean,comment?:string}` | operator/assigner |
| POST `/tasks/:id/complete` | `{version}` → 체크 완료 후 인폼 한 번 생성 | operator/assigner |
| POST `/macros` | `{version,task,everyDays,anchorDay,throughDay}` | assigner |
| POST `/macros/:id/run` | `{version,from,to}` → 해당 매크로 기간 생성, 중복 제외 | assigner |
| GET `/store/:doc?version=1` | `{doc,version,data:{title,content}}` | 읽기 |
| POST `/store/:doc` | `{version,data:{title,content},reason}` → CAS 저장, 최초 version=0 | operator/assigner |
| GET `/store/:doc/history` | 버전·작성자·시각·변경 사유, 최근 100개 | 읽기 |
| POST `/store/:doc/revert` | `{version,targetVersion,reason}` → 새 버전으로 복원 | operator/assigner |
| POST `/ingestion/:source` | `{snapshot:{complete:true,rejectedCount:0,readCount,observedAt,records}}` | assigner |

workspace 변경은 응답 version을 다음 요청에 전달한다. 오래된 version은 409, 입력 오류는 400, 권한/쓰기 차단/CSRF는 403, 없는 자원은 404다. 모든 POST/PUT에는 같은 출처 Origin, 세션 쿠키, `/api/bootstrap`에서 받은 X-CSRF-Token이 필요하다. id에 콜론이 포함되면 encodeURIComponent로 경로 조각을 인코딩한다.

`staff`는 **계산 후 화면 필터**다. 전체 인원을 대상으로 계획을 만든 후 배정 카드와 부하만 좁힌다. 미배정 카드는 모든 담당자 필터에서 남는다. `includeOverdue=true`는 명시적으로 과거 미완료를 포함하며 기본 false다. 이 GET은 미리보기이며 배정을 확정하지 않는다. 최초 `/workspace` 접근 시 데모 공간을 초기화할 수 있지만 이후 읽기는 버전을 바꾸지 않는다.

카드 한 건:

```json
{"taskId":"TASK-001","title":"가짜 점검","equipment":"MC-DEMO","status":"proposed","reasonCode":"ASSIGNABLE","reason":"규칙이 계산한 배정 설명","person":{"id":"A","name":"엔지니어 A"},"time":{"start":"09:30","end":"11:00"}}
```

미배정은 status=`unassigned`, reasonCode=`UNASSIGNED`, person/time=null과 원래 사유를 사용한다. AI가 사유를 만들어내지 않는다. 제출한 임의 카드/담당자 배정은 확정 API가 신뢰하지 않고 서버에서 다시 계산한다.

문서는 150자 제목·20,000자 일반 텍스트이며 HTML을 실행하지 않는다. CSV/XLSX 셀 편집은 기존 `/api/datasets`를 참고한다. `/ingestion`은 hue 또는 splunk 레이블만 받으며 외부 URL을 조회하지 않는다. 승인된 사내 어댑터가 이미 확보한 데이터를 본문에 전달한다. URL 프록시·메일 수집·실제 Hue/Splunk 연결·주기 실행기·스냅샷의 단조 시각 순서 보장은 포함하지 않는다. 전체 검증 실패 시 설비 정상본을 유지하고 실패 상태만 기록한다.

## 로컬 데모에서만 쓰기 시험 (Windows PowerShell)

```powershell
$env:APP_MODE='demo'
$env:REFERENCE_SERVICE_WRITE='1'
$env:REFERENCE_SERVICE_ROLES='{"demo-engineer":"assigner"}'
npm start
```

기본 루프백 127.0.0.1을 유지한다. `.env.example`은 예시이며 `npm start`가 .env를 자동으로 읽지는 않는다. 운영 모드의 쓰기 차단을 이 설정으로 해제할 수 없다. 사내 이식 시 기존 SSO가 정한 신원과 서버 권한 표를 연결하고 권한·트랜잭션·감사·동시 편집 테스트를 먼저 통과시킨다.
