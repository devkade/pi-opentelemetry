# OTel Architecture

## Scope

이 프로젝트는 Pi Coding Agent의 다음 관측을 제공한다.

1. **Trace**: 세션/턴/툴 실행의 인과관계와 지연 원인 분석
2. **Metrics**: 사용량·비용·성능 추세 분석
3. **Diagnostics**: 현재 수집 파이프라인 상태 점검

## High-level Flow

Pi Extension Events  
→ Trace/Metrics Processor  
→ OTLP Export (HTTP)  
→ OpenTelemetry Collector  
→ Backend (Jaeger/Tempo + Prometheus/Grafana)

권장: traces/metrics endpoint를 분리해 운영한다.

- traces: `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- metrics: `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`
- fallback: `OTEL_EXPORTER_OTLP_ENDPOINT`

## Trace Model

권장 span 계층:

- `pi.session`
  - `pi.agent`
    - `pi.turn`
      - `pi.tool:<tool-name>`

권장 이벤트:

- `input`
- `tool_call`
- `tool_result`
- `turn_end`
- `agent_end`
- `model_select`
- `session_compact`

핵심 원칙:

- tool span은 `tool_call` 시작 시 생성, `tool_result`에서 종료
- orphan span(중간 종료 누락)은 종료 시점에 강제 종료 + 오류 상태 표시
- payload 기록은 Privacy 정책을 따른다 (참조: [privacy-redaction.md](./privacy-redaction.md))

## Metrics Model

### Counters

- `pi.session.count`
- `pi.turn.count`
- `pi.tool_call.count`
- `pi.tool_result.count`
- `pi.prompt.count`
- `pi.token.usage` (`type=input|output|cache_read|cache_write`)
- `pi.cost.usage` (`type=input|output|cache_read|cache_write`)

### Histograms

- `pi.session.duration` (s)
- `pi.turn.duration` (s)
- `pi.tool.duration` (s)

## Event → Telemetry Mapping

| Pi Event | Trace | Metrics |
|---|---|---|
| `session_start` | `pi.session` span start | `pi.session.count += 1` |
| `input` | session span event `input` | `pi.prompt.count += 1` |
| `agent_start` | `pi.agent` span start | - |
| `turn_start` | `pi.turn` span start | `pi.turn.count += 1` |
| `tool_call` | `pi.tool:*` span start + `tool_call` event | `pi.tool_call.count += 1` |
| `tool_result` | tool span event + tool span end | `pi.tool_result.count += 1`, `pi.tool.duration.record(...)` |
| `turn_end` | turn span end | `pi.turn.duration.record(...)`, token/cost 누적 |
| `agent_end` | agent span end | - |
| `session_shutdown` | session span end | `pi.session.duration.record(...)` |

## Cardinality Policy

메트릭 라벨은 다음만 기본 허용:

- `provider`, `model`, `tool.name`, `success`, `type`

기본 비허용(고카디널리티):

- raw prompt
- raw command
- session/file path 원문

필요한 상세 문맥은 trace attribute/event로 분리 기록한다.

## Harness Tracking Extensions (Planned)

개인 하네스 실험 추적을 위해 다음 속성 확장을 허용한다.

- `harness.run_id`
- `harness.scenario_id`
- `harness.variant`
- `harness.dataset_id`

원칙:

- 메트릭에는 저카디널리티 파생값만 기록
- 상세 실험 맥락은 trace에 기록
