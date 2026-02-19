# PLAN

Last updated: 2026-02-19

## 1) Mission

`pi-opentelemetry`를 **npm 배포 가능한 Pi package**로 구현한다.

필수 범위:
- Trace + Metrics + Diagnostics 통합
- Privacy 기본값: `detailed-with-redaction`
- 개인 하네스(run/scenario/variant) 확장 가능한 구조

## 2) Success Criteria (MVP)

- extension 로딩 후 `session -> agent -> turn -> tool` trace 생성 확인
- 사용량/토큰/비용/지연 메트릭 export 확인
- `/otel-status`, `/otel-open-trace` 정상 동작
- redaction 테스트 통과 및 known-secret 누출 없음
- exporter 실패 시 agent 동작 비차단 보장

## 3) Execution Conventions

- 이 파일은 **의도된 작업 상태의 단일 SoT**다.
- 상태값: `todo | active | blocked | done`
- 모든 active/blocked task는 `owner`와 `next action`을 가져야 한다.
- 상태/소유자/다음 작업 변경 시 `PROGRESS.md`에 근거 로그를 남긴다.

## 4) Task Board (Authoritative)

| ID | Task | Owner | Status | Priority | Depends On | Next Action |
|---|---|---|---|---|---|---|
| D-001 | Documentation architecture bootstrap (README/AGENTS/docs) | primary-agent | done | P0 | - | 완료 |
| D-002 | Execution-state protocol 정렬 (PLAN/PROGRESS 역할 분리) | primary-agent | done | P0 | D-001 | append-only 규칙 유지 |
| T-001 | Package scaffold (`package.json`, `tsconfig`, `src/index.ts`) | primary-agent | done | P0 | D-002 | 완료 (`/otel-status`, `/otel-open-trace` bootstrap command smoke 확인) |
| T-002 | Config + Privacy engine (`strict`, `detailed-with-redaction`) | primary-agent | done | P0 | T-001 | 완료 (`src/config.ts`, `src/privacy/*`, redaction/payload tests 통과) |
| T-003 | Metrics pipeline (meter/exporter/collector) | primary-agent | done | P0 | T-001 | 완료 (`src/metrics/*`, counter/histogram/status 수집 동작) |
| T-004 | Trace pipeline (tracer/span lifecycle) | primary-agent | done | P0 | T-001, T-002 | 완료 (`src/trace/*`, span lifecycle/orphan 정리 및 payload 정책 반영) |
| T-005 | Diagnostics commands (`/otel-status`, `/otel-open-trace`) | primary-agent | done | P1 | T-003, T-004 | 완료 (상태 출력/trace URL 생성 및 오픈 처리) |
| T-006 | Hardening (tests/docs/collector example) | primary-agent | done | P1 | T-002, T-003, T-004, T-005 | 완료 (Vitest 23개, README 보강, `examples/otel-collector.yaml`) |
| T-007 | Release packaging (`files` allowlist + publish check) | primary-agent | done | P1 | T-006 | 완료 (`release:check` 통과, tarball 14 files로 최소화) |
| T-008 | npm publish 실행 | primary-agent | blocked | P1 | T-007 | `npm login` 후 `npm publish --access public` 실행 |

## 5) Active Blockers

- B-001: npm registry 인증 부재 (`npm whoami` -> 401 Unauthorized). 배포 전 `npm login` 필요.

## 6) Handoffs

- 현재 활성 handoff 없음

## 7) Decision Lock-ins (Resolved)

- O-001 (resolved): 패키지명은 `pi-opentelemetry`로 고정한다.
- O-002 (resolved): `session.id`는 **metrics 라벨에 포함하지 않는다**. (trace/context에서만 사용)
- O-003 (resolved): 기본 payload max bytes는 **32KB(32768)** 로 고정한다.

## 8) Global Next Action

- `T-008` 해제: `npm login`으로 인증 후 `npm publish --access public` 실행
