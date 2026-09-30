# Tasks — Sprints

## Sprint 1 — Core transaction engine (DB + CRUD)
**Goal:** Finance staff can add, view, edit, delete buy/sale transactions.
- [ ] Create Supabase tables: `accounts`, `securities`, `transactions` + seed data.
- [ ] `lib/data/` queries: list transactions, insert, update, delete.
- [ ] Transactions page: data table with all fields, filter by account + date range.
- [ ] Transaction form: type, date, account, security, qty, unit_price, fees, notes.
- [ ] Inline add/edit/delete; confirm on delete.
- [ ] Account + Security selectors (create-on-the-fly if missing).
- [ ] Empty state, loading state, error state handled.
- [ ] Responsive sidebar nav.
**DoD:** User adds a buy and a sale transaction; both appear in the table; refresh persists them.

## Sprint 2 — Positions & P&L (derived) ← **v1 functional milestone**
**Goal:** App shows positions, realized/unrealized P&L from stored transactions.
- [ ] Server-side position calc: units_held, avg_cost, realized_pnl, unrealized_pnl.
- [ ] Positions page: per security — units, cost basis, current value, unrealized P&L.
- [ ] Current price input on securities (manual update).
- [ ] P&L summary page: total realized, total unrealized, net P&L, gain/loss flags.
- [ ] Dashboard: summary cards (total cost, market value, net P&L) + recent transactions.
- [ ] Filter positions by account.
**DoD:** Add buy 100 @ $10, sale 40 @ $12 → see realized gain $80, 60 units held, unrealized P&L at current price. One screen. *(Success scenario usable — app first works end-to-end.)*

## Sprint 3 — Balance sheet + polish
**Goal:** Balance sheet view and overall polish.
- [ ] Balance sheet page: cost of investments vs current market value per account.
- [ ] Date-range filter across all views.
- [ ] Export table to CSV.
- [ ] Loading/empty/error states on every page.
- [ ] Number formatting (currency, decimals).
**DoD:** Balance sheet shows total cost and market value; all pages handle empty data gracefully.

## Sprint 4 — Lock it down (auth + RLS)
**Goal:** Per-user data isolation.
- [ ] Supabase Auth: signup/login.
- [ ] `user_id` populated on insert.
- [ ] RLS: `auth.uid() = user_id` on all tables.
- [ ] Replace permissive v1 policies.
- [ ] Redirect unauthenticated to login.
**DoD:** User A cannot see User B's transactions.

## Later
- Bank statement upload + AI extraction → transaction drafts.
- Draft review workflow + audit logs.
- Dividend/interest transaction types.
- Multi-currency.
- Report export to accounting systems.

## Gantt
```
Sprint 1: DB + transaction CRUD          ████
Sprint 2: Positions + P&L (v1 milestone)  ████
Sprint 3: Balance sheet + polish          ████
Sprint 4: Auth + RLS lock-down            ████
Later:     AI parsing, dividends, export  ~~~~
```