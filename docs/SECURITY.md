# Security

## Secret handling
- Supabase keys: service role key in server env only (`SUPABASE_SERVICE_ROLE_KEY`), never in client. Anon key in `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client reads.
- No secrets in frontend code or client bundles.
- `.env.local` gitignored.

## Permission model
- **v1 (demo-first):** permissive RLS — all tables readable/writable without login. Seed data visible to anonymous visitors. `user_id` nullable on all tables.
- **Lock-down (later sprint):** enable `auth.uid() = user_id` on every table. Only owner sees own accounts, securities, transactions. No cross-user reads.
- Agent (when added) inherits the calling user's permissions — never elevated.

## Approved-tools rule
- Later agentic features use named tools only (`parse_bank_statement`, `confirm_drafts`, `generate_period_report`).
- No raw `run_any` / `send_any` / arbitrary SQL execution.
- Each tool has a fixed input schema and fixed output action.

## Audit principle
- Every meaningful action (create/edit/delete transaction, confirm drafts) logged with user, action, target, timestamp.
- v1: no audit table yet; added with agentic layer.
- Deletions and financial edits are always human-only.