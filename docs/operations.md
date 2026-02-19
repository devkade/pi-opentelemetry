# Operations & Diagnostics

## Runtime Modes

- **Trace only**: 병목/오류 원인 분석 중심
- **Metrics only**: 비용/사용량 대시보드 중심
- **Unified (권장)**: Trace + Metrics + Diagnostics

기본 운영 모드는 Unified.

## Required Environment

```bash
# extension enable flag (프로젝트 정책에 맞게 사용)
export PI_OTEL_ENABLE=1

# traces endpoint
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

# metrics endpoint
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics

# optional auth headers
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <token>"
```

## Diagnostic Commands (Spec)

### `/otel-status`
목적: 현재 telemetry 파이프라인의 상태 확인

출력 포함 항목:

- extension enabled 여부
- active exporter 종류
- trace/metrics endpoint
- 누적 session/turn/tool/prompt 카운트
- 누적 token/cost
- 마지막 session/turn/tool duration
- privacy profile (`strict` / `detailed-with-redaction`)
- last error (있을 경우)

### `/otel-open-trace`
목적: 현재 세션 trace URL 생성/오픈

출력 포함 항목:

- trace id
- primary trace URL (Jaeger/Tempo)
- (가능한 경우) 원격 접근 URL

## Operational Checks

### Start-up checks
1. endpoint 유효성 확인
2. exporter 초기화 성공 여부 확인
3. session_start 이벤트 수집 여부 확인

### Continuous checks
1. tool_result 누락으로 orphan span이 늘지 않는지 확인
2. metrics export interval 내 정상 flush 확인
3. redaction 적용 실패 로그가 없는지 확인

## Failure Handling

- OTLP 전송 실패는 에이전트 실행을 중단시키지 않는다.
- 전송 실패는 내부 상태(`last error`) 및 로그에 기록한다.
- 일시적 실패 시 재시도는 exporter 기본 정책을 따른다.

## Suggested Dashboards

1. Usage Overview
   - sessions/day, turns/day, prompts/day
2. Cost & Tokens
   - input/output/cache tokens, daily cost
3. Tool Reliability
   - tool success rate, p95 tool duration
4. Session Quality
   - turns per session, avg session duration
