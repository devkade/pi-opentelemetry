# Documentation Standard

## Scope

이 저장소의 문서는 다음만 관리한다.

- OTel 관측 구조/정책
- 운영 진단 절차
- 문서 자체의 유지보수 규칙

구현 코드에서 자동 생성 가능한 산출물(예: generated reports)은 기본적으로 버전 관리하지 않는다.

## Source of Truth Rules

- Privacy/Redaction의 단일 SoT: `docs/privacy-redaction.md`
- 운영 명령/런북의 단일 SoT: `docs/operations.md`
- 관측 모델/이벤트 매핑의 단일 SoT: `docs/otel-architecture.md`

AGENTS/README에는 요약과 링크만 유지한다.

## Execution-state Rules (`PLAN.md` / `PROGRESS.md`)

- `PLAN.md`는 현재 작업 상태(의도된 work state)의 단일 SoT다.
- `PROGRESS.md`는 append-only 실행 이력 로그다.
- 상태 변경(owner/status/next action)은 반드시 `PLAN.md`에 반영한다.
- 상태 변경 근거(무엇을/언제/누가/결과)는 `PROGRESS.md`에 로그로 남긴다.
- `PROGRESS.md`를 현재 보드처럼 수정/재정렬하지 않는다.

## Writing Rules

- 비자명한 결정(제약, 정책, 예외)만 기록한다.
- 일반적인 엔지니어링 상식은 중복 기록하지 않는다.
- 문서 간 정책 중복을 피하고 링크로 연결한다.

## Structure Rules

- 진입점 문서: `README.md`, `AGENTS.md`
- 상세 문서: `docs/*`
- 진입점에서 활성 문서까지 가능하면 2 hops 이내

## Change Rules

문서 변경 시 다음을 함께 검토한다.

1. 링크 무결성
2. 정책 충돌 여부
3. dead/orphan 문서 발생 여부
4. 신규 정책의 SoT 위치 지정 여부

## Review Cadence

- 기능/정책 변경 PR마다 문서 동기화 여부 확인
- 분기별 1회 문서 정리:
  - 중복 정책 제거
  - stale 문서 업데이트 또는 삭제
