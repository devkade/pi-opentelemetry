# Privacy & Redaction Policy

## Default Profile

기본값은 **detailed-with-redaction** 이다.

목표:

- 디버깅/트래킹 품질을 유지한다.
- 민감정보가 외부 OTLP backend로 유출되지 않도록 강제한다.

## Profiles

### 1) strict
- payload 본문 미전송
- 길이/성공여부/duration 등 메타데이터만 전송

### 2) detailed-with-redaction (**default**)
- payload 요약/본문 일부를 전송
- 민감정보는 강제 마스킹
- 길이 제한 + truncated 플래그 기록

### 3) detailed-unsafe (금지)
- 마스킹 없이 상세 payload 전송
- 운영/공유 환경에서는 사용 금지

## Mandatory Redaction Rules

### Key-based masking
다음 키(대소문자 무시)와 유사 변형은 마스킹한다.

- `token`
- `api_key`
- `secret`
- `password`
- `authorization`
- `cookie`
- `session`
- `private_key`

### Value-pattern masking
값 자체가 다음 패턴에 해당하면 마스킹한다.

- JWT (`xxx.yyy.zzz` 형태)
- OpenAI/기타 API key prefix (`sk-` 등)
- 긴 base64-like 문자열
- PEM/private key 블록 (`-----BEGIN ... PRIVATE KEY-----`)

### Path denylist (payload capture skip)
아래 경로/확장자는 payload 본문 수집을 생략한다.

- `.env`, `.env.*`
- `*.pem`, `*.key`, `*.p12`
- `id_rsa`, `id_ed25519`
- credential/token 저장 파일

## Payload Limits

상세 모드에서도 무제한 전송은 금지한다.

- 기본 최대 payload: **32KB**
- 초과 시:
  - 내용 truncate
  - `payload.truncated=true`
  - `payload.original_bytes` 기록

## Allowed vs Disallowed in Telemetry

### Allowed
- tool name
- success/failure
- duration
- token/cost usage
- redacted payload preview/body (limit 내)

### Disallowed
- 원문 비밀값
- 마스킹되지 않은 인증 헤더
- private key/cert 본문

## Verification Requirements

릴리즈 전 최소 검증:

1. redaction unit tests (key/value/path 각각)
2. known-secret fixture 유출 테스트
3. 최대 길이 초과 시 truncate 동작 테스트
4. strict/detailed profile 스위치 테스트
