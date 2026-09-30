# Data Model

## accounts
| Field | Type | Notes |
|------|------|-------|
| id | uuid | PK |
| user_id | uuid | nullable (lock-down later) |
| name | text | e.g. "HSBC Investment Account" |
| institution | text | bank/broker name |
| created_at | timestamptz | default now() |

## securities
| Field | Type | Notes |
|------|------|-------|
| id | uuid | PK |
| user_id | uuid | nullable |
| name | text | "ABC Mutual Fund" |
| ticker | text | symbol or code |
| asset_type | text | equity / bond / fund / etc. |
| current_price | numeric | latest market price (manual entry in v1) |
| price_as_of | date | date of current_price |
| created_at | timestamptz | default now() |

## transactions
| Field | Type | Notes |
|------|------|-------|
| id | uuid | PK |
| user_id | uuid | nullable |
| account_id | uuid | FK → accounts |
| security_id | uuid | FK → securities |
| txn_date | date | transaction date |
| txn_type | text | 'buy' or 'sale' |
| quantity | numeric | units bought/sold |
| unit_price | numeric | price per unit |
| fees | numeric | brokerage/fees (default 0) |
| notes | text | optional |
| created_at | timestamptz | default now() |

**Derived (not stored, computed server-side):**
- units_held = sum(buy qty) − sum(sale qty)
- avg_cost = total cost of buys / units bought
- realized_pnl = (sale_price − avg_cost) × sale_qty − fees
- unrealized_pnl = (current_price − avg_cost) × units_held

## Relationships
- accounts 1—N transactions
- securities 1—N transactions
- positions derived from transactions per security+account

## RLS / permissions (v1)
- All tables: permissive read/write (demo-first).
- Lock-down sprint: `auth.uid() = user_id` on all.

## Statement imports
- `statement_imports` stores team-scoped statement metadata, SHA-256 deduplication hash, currency, date range, credit/debit totals, and importing user. The original CSV is not persisted.
- `statement_entries` stores parsed transaction rows, category, optional security/quantity/price/fees for trade review, and a link to the resulting portfolio transaction.
- `transactions.statement_entry_id` prevents the same statement row from being recorded twice.

Statement CSV parsing is deterministic and client-side; users review and map columns before saving. AI confidence and extraction fields remain a later enhancement.
