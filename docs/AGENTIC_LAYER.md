# Agentic Layer

## v1: no automated actions
The core app has no agentic actions. All transactions are manually entered by finance staff. P&L and positions are computed deterministically.

## Later: bank statement parsing (medium risk)
- **Draftable (auto):** Extract transaction drafts from uploaded statement.
- **Executable after approval:** Finance staff reviews drafts → confirm → drafts become real `transactions` rows.
- **Risk level:** medium (creates financial data; requires human review before commit).

## Later: report generation (low risk)
- **Draftable (auto):** Generate period P&L and balance sheet text summary.
- **Executable:** auto-generate on demand; human reviews before sharing.

## Human-only actions (always)
- Delete a transaction.
- Edit a transaction's amount or price.
- Export / share reports externally.

## Named tools (later)
- `parse_bank_statement(file)` → returns drafts, never writes to `transactions`.
- `confirm_drafts(draft_ids)` → writes reviewed drafts to `transactions`.
- `generate_period_report(date_range)` → returns text summary.

## Audit-log fields (later)
`audit_logs`: id, user_id, action, tool_name, target_table, target_id, payload jsonb, created_at.

## v1 vs later
- **v1:** zero agentic actions. Manual CRUD only.
- **Later:** statement parsing, report drafting, audit logging.