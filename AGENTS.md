# pi-opentelemetry

Pi usage observability extension project.

## Essentials

- 관측 범위는 **Trace + Metrics + Diagnostics**를 모두 포함한다.
- 기본 Privacy 프로파일은 **detailed-with-redaction** 이다.
- 상세 payload를 수집하되, 민감정보 마스킹은 필수다.
- 메트릭은 저카디널리티를 유지하고, 상세 문맥은 trace 중심으로 기록한다.
- 운영 진단 명령어(`/otel-status`, `/otel-open-trace`)는 기본 기능으로 유지한다.
- 작업 실행 전 `PLAN.md` → `PROGRESS.md` 순서로 확인해 현재 goal/owner/blocker/next action을 파악한다.

## Documents

- 작업 계획/상태: [PLAN.md](PLAN.md), [PROGRESS.md](PROGRESS.md)
- 문서 인덱스: [docs/index.md](docs/index.md)
- OTel 구조/이벤트 매핑: [docs/otel-architecture.md](docs/otel-architecture.md)
- Privacy/Redaction 정책: [docs/privacy-redaction.md](docs/privacy-redaction.md)
- 운영/진단 가이드: [docs/operations.md](docs/operations.md)
- 문서 관리 표준: [docs/metadoc.md](docs/metadoc.md)
