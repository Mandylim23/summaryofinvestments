# Test Plan

## v1 success scenario (manual)
1. Open app (no login) → Dashboard shows seed summary cards.
2. Go to **Transactions** → see seeded rows.
3. Click **Add Transaction** → type: buy, date: 2024-01-05, account: HSBC, security: ABC Fund, qty: 100, unit price: 10, fees: 0. Save.
4. Add another → type: sale, date: 2024-02-10, qty: 40, unit price: 12, fees: 0. Save.
5. Go to **Positions** → ABC Fund: 60 units held, cost basis $600, realized P&L = +$80.
6. Go to **P&L Summary** → total realized +$80, unrealized = (current_price − $10) × 60.
7. Go to **Balance Sheet** → cost of investments and market value shown.
8. Refresh page → all data persists.

## Empty states
- Delete all transactions → Positions page shows "No positions yet. Add a buy transaction to start."
- P&L Summary shows $0 across all metrics with helper text.
- Dashboard shows zero-state cards.

## Error states
- Submit transaction form with qty = 0 → validation error, no DB write.
- Submit sale with qty > units_held → show warning, block submit.
- Network failure on save → error toast, form retains input.

## Edge cases
- Buy then sell all units → position shows 0 units, realized P&L only.
- Security with no current price → unrealized P&L shows "Set current price".
- Multiple buys at different prices → avg_cost correctly weighted.
- Fees included in buy → cost basis includes fees.