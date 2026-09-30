# Summary of Investments — PRD

## Problem
Finance staff and managers manually list every investment transaction, cost, and market value from bank statements to build a P&L and balance sheet. It is slow, error-prone, and repeated every period.

## Target user
Finance staff (daily data entry, reconciliation) and managers (review gains/losses, sign off).

## Core objects
- **Account** — an investment account (bank/broker label).
- **Security** — an investment instrument (name, ticker, type).
- **Transaction** — a buy or sale: date, type, quantity, unit price, fees, security, account.
- **Position** — derived current holding per security: units held, cost basis, current market value, unrealized P&L.

## MVP (v1) checklist
- [ ] Add / edit / delete transactions (buy, sale) with date, security, account, qty, unit price, fees.
- [ ] Auto-compute per-transaction gain/loss for sales.
- [ ] Derive current positions: units held, average cost, total cost, realized P&L, unrealized P&L.
- [ ] Investment P&L summary: total realized + unrealized gains/losses.
- [ ] Simple balance-sheet view: cost of investments vs current market value.
- [ ] Filter by account and date range.
- [ ] Demo data visible without login.

## Non-goals (v1)
- No bank statement PDF parsing.
- No multi-currency conversion.
- No user auth / per-user isolation (later sprint).
- No dividend / interest / corporate-action transaction types.
- No export to external accounting systems.

## Success criteria
A finance staff member adds a buy of 100 shares of "ABC Fund" at $10 on Jan 5 and a sale of 40 shares at $12 on Feb 10. The app shows realized gain = $80, remaining 60 shares at cost basis $600, and current market value at today's price shows unrealized P&L — all on one screen with no manual math.