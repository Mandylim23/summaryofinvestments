# Architecture

## Stack
Next.js (App Router) + Supabase (Postgres) + Vercel. Tailwind for UI. No external services in v1.

## Build now vs later
**Now:** transaction CRUD, position derivation (server-side from transactions), P&L + balance sheet views, date/account filters, demo seed.
**Later:** auth + per-user RLS, bank statement upload + AI extraction, dividend/interest types, multi-currency, export.

## Key user flow (one action)
1. Finance staff opens **Transactions** page → clicks **Add Transaction**.
2. Form: type (buy/sale), date, account, security, quantity, unit price, fees.
3. On submit → row written to `transactions` table.
4. Positions recalc server-side: recompute units held, average cost, realized P&L for the affected security.
5. P&L summary and balance sheet update from derived positions.
6. User sees updated gains/losses on the same screen.

## Nav shell
Left sidebar (desktop) → collapses to hamburger (mobile). Sections: Dashboard, Transactions, Positions, P&L Summary, Balance Sheet. Active section highlighted. Keyboard accessible.

## Layer plan
1. **Data layer** (`lib/data/`) — all DB reads/writes; position computation as SQL views + server functions.
2. **App logic** (`lib/actions/`) — transaction create/update/delete, position recalc trigger.
3. **UI** (`app/`) — pages render from data layer; forms call actions.
4. **Intelligence** (`lib/ai/`) — later: parse bank statements into transaction drafts.

## Why core runs without AI
P&L, positions, and balance sheet are pure arithmetic over stored transactions. No AI needed for the core engine. AI is additive (statement parsing) and comes later.

## Repo structure
```
app/
  dashboard/page.tsx
  transactions/page.tsx
  positions/page.tsx
  pnl/page.tsx
  balance-sheet/page.tsx
components/
  TransactionForm.tsx
  SummaryCard.tsx
  DataTable.tsx
lib/
  data/         # queries, mutations, position calc
  actions/      # server actions
  ai/           # later
  utils/        # math helpers
__tests__/      # beside code
```

## Module map
| Module | Responsibility | Data owned | Build order |
|--------|---------------|------------|-------------|
| `transactions` | CRUD buy/sale records | `transactions` table | 1 |
| `positions` | Derive holdings & P&L from transactions | `positions` view | 2 |
| `reports` | P&L summary + balance sheet aggregation | derived from positions | 3 |
| `dashboard` | Combined overview cards | reads from all | 4 |
| `auth` (later) | Per-user isolation | RLS policies | 5 |
| `ai/parser` (later) | Bank statement → transaction drafts | `transaction_drafts` | 6 |