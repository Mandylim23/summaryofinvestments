# Intelligence Layer

## Messy inputs (later)
Bank/ broker statement PDFs or CSVs. Unstructured line items: date, description, amount, type.

## Auto-structure schema (later)
```json
{
  "transaction_drafts": [
    {
      "txn_date": "2024-03-15",
      "security_name": "ABC Fund",
      "txn_type": "buy",
      "quantity": 100,
      "unit_price": 10.50,
      "fees": 5.00,
      "source": "statement-pdf",
      "confidence": 0.92,
      "review_status": "unreviewed"
    }
  ]
}
```

## Events to track
- Transaction created / edited / deleted.
- Position recalculated.
- Report viewed / exported (later).
- Statement parsed (later).

## Scoring rules (v1 — rule-based, no AI)
- **Realized P&L per sale** = (unit_price − avg_cost_at_sale) × quantity − fees.
- **Unrealized P&L** = (current_price − avg_cost) × units_held.
- **Total cost basis** = sum of buy (qty × unit_price + fees).
- **Total market value** = units_held × current_price.
- **Win/loss flag** = realized_pnl >= 0 ? 'gain' : 'loss'.

## What gets ranked
- Securities by absolute realized P&L.
- Securities by unrealized P&L %.
- Accounts by total gains/losses.

## v1 vs later
- **v1:** all scoring is pure arithmetic. No AI.
- **Later:** bank statement → draft extraction with confidence scores, review workflow, auto-tagging.