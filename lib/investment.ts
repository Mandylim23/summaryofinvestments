export type Account = { id: string; name: string; institution: string | null };
export type Security = { id: string; name: string; ticker: string | null; asset_type: string | null; current_price: number | null; price_as_of: string | null };
export type Transaction = { id: string; account_id: string; security_id: string; txn_date: string; txn_type: "buy" | "sale"; quantity: number; unit_price: number; fees: number; notes: string | null; created_at?: string; accounts?: Account; securities?: Security };
export type Position = { account: Account; security: Security; units: number; cost: number; avg: number; realized: number; market: number | null; unrealized: number | null };

export function calculatePositions(rows: Transaction[], accounts: Account[], securities: Security[]): Position[] {
  const grouped = new Map<string, Transaction[]>();
  for (const row of [...rows].sort((a,b) => a.txn_date.localeCompare(b.txn_date) || (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id))) {
    const key = `${row.account_id}:${row.security_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.entries()].map(([key, txns]) => {
    const [accountId, securityId] = key.split(":");
    const account = accounts.find(x => x.id === accountId)!;
    const security = securities.find(x => x.id === securityId)!;
    let units = 0, cost = 0, realized = 0;
    for (const t of txns) {
      if (t.txn_type === "buy") { units += Number(t.quantity); cost += Number(t.quantity) * Number(t.unit_price) + Number(t.fees); }
      else {
        const avg = units ? cost / units : 0;
        realized += (Number(t.unit_price) - avg) * Number(t.quantity) - Number(t.fees);
        units -= Number(t.quantity); cost -= avg * Number(t.quantity);
        if (Math.abs(units) < 1e-8) { units = 0; cost = 0; }
      }
    }
    const avg = units > 0 ? cost / units : 0;
    const market = security.current_price == null ? null : units * Number(security.current_price);
    return { account, security, units, cost, avg, realized, market, unrealized: market == null ? null : market - cost };
  }).filter(p => p.units > 0 || Math.abs(p.realized) > 1e-8).sort((a,b) => a.security.name.localeCompare(b.security.name));
}
