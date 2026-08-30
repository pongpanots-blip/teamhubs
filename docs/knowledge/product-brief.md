# TeamHub Product Brief

TeamHub helps a small team (1 PM, 1 UI, 3 Devs) keep tasks ready with shared context.

## Goals

- Index internal markdown docs with RAG (top-k only — never full corpus in prompts)
- Pull relevant GitHub issues/PRs and Figma metadata
- Ask Claude for structured analysis JSON (rules candidates, gaps, conflicts, PM questions)
- Validate Claude output; Deterministic Engine decides readiness / dependency / status
- Make Owner, Requirement, BusinessRules[], and Decision Log explicit on every task
- Enforce **Assigned ≠ Working** so ownership is never mistaken for active work

## Status model

`NOT_READY` · `READY` · `ASSIGNED` · `WORKING` · `BLOCKED` · `REVIEW` · `DONE`

## Non-goals (MVP)

- Figma plugin
- Billing / multi-tenant SaaS
- Real-time collaborative editing
- Using Claude as the sole decision brain
