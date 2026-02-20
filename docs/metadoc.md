# Documentation Standard

## Scope

Documentation in this repository covers only the following:

- OTel observability architecture/policies
- operational diagnostics procedures
- documentation maintenance rules

Outputs that can be generated automatically from implementation code (e.g. generated reports) are not versioned by default.

## Source of Truth Rules

- Single SoT for Privacy/Redaction: `docs/privacy-redaction.md`
- Single SoT for operational commands/runbooks: `docs/operations.md`
- Single SoT for observability model/event mapping: `docs/otel-architecture.md`

Keep only summaries and links in AGENTS/README.

## Execution-state Rules (`PLAN.md` / `PROGRESS.md`)

- `PLAN.md` is the single SoT for current work state (intended state).
- `PROGRESS.md` is an append-only execution history log.
- State changes (owner/status/next action) must be reflected in `PLAN.md`.
- Evidence for state changes (what/when/who/result) must be logged in `PROGRESS.md`.
- Do not edit/reorder `PROGRESS.md` as if it were a current task board.

## Writing Rules

- Record only non-obvious decisions (constraints, policies, exceptions).
- Do not duplicate common engineering knowledge.
- Avoid policy duplication across documents; connect via links.

## Structure Rules

- Entry-point docs: `README.md`, `AGENTS.md`
- Detailed docs: `docs/*`
- Keep navigation from entry points to active docs within 2 hops when possible

## Change Rules

When changing docs, review the following together:

1. link integrity
2. policy conflicts
3. dead/orphan document creation
4. SoT placement for any new policy

## Review Cadence

- Verify documentation sync for every feature/policy change PR
- Run quarterly doc maintenance:
  - remove duplicated policies
  - update or delete stale documents
