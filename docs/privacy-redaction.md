# Privacy & Redaction Policy

## Default Profile

The default value is **detailed-with-redaction**.

Goals:

- Preserve debugging and tracking quality
- Enforce prevention of sensitive-data leakage to external OTLP backends

## Profiles

### 1) strict
- Do not send payload bodies
- Send only metadata such as length/success/duration

### 2) detailed-with-redaction (**default**)
- Send payload summaries or partial payload bodies
- Enforce masking of sensitive data
- Apply length limits and record a truncated flag

### 3) detailed-unsafe (prohibited)
- Send detailed payloads without masking
- Prohibited in production/shared environments

## Mandatory Redaction Rules

### Key-based masking
Mask these keys (case-insensitive) and closely related variants.

- `token`
- `api_key`
- `secret`
- `password`
- `authorization`
- `cookie`
- `session`
- `private_key`

### Value-pattern masking
Mask values that match the following patterns.

- JWT (`xxx.yyy.zzz` format)
- OpenAI/other API key prefixes (e.g. `sk-`)
- Long base64-like strings
- PEM/private key blocks (`-----BEGIN ... PRIVATE KEY-----`)

### Path denylist (skip payload capture)
Skip payload body capture for these paths/extensions.

- `.env`, `.env.*`
- `*.pem`, `*.key`, `*.p12`
- `id_rsa`, `id_ed25519`
- files that store credentials/tokens

## Payload Limits

Even in detailed mode, unlimited payload transmission is prohibited.

- Default max payload: **32KB**
- On overflow:
  - truncate content
  - set `payload.truncated=true`
  - record `payload.original_bytes`

## Allowed vs Disallowed in Telemetry

### Allowed
- tool name
- success/failure
- duration
- token/cost usage
- redacted payload preview/body (within limits)

### Disallowed
- raw secret values
- unmasked auth headers
- private key/cert bodies

## Verification Requirements

Minimum pre-release checks:

1. redaction unit tests (key/value/path each)
2. known-secret fixture leak test
3. truncate behavior test when max length is exceeded
4. strict/detailed profile switch test
