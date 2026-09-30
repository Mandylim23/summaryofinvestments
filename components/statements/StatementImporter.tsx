"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Account, Security } from "@/lib/investment";
import {
  buildStatementRows,
  detectColumns,
  parseCsv,
  StatementCategory,
  StatementColumns,
  StatementRow,
} from "@/lib/statement-csv";

type ImportRecord = {
  id: string;
  account_id: string;
  file_name: string;
  currency_code: string;
  row_count: number;
  period_start: string | null;
  period_end: string | null;
  total_credits: number;
  total_debits: number;
  created_at: string;
};
type EntryRecord = StatementRow & {
  id: string;
  import_id: string;
  security_id: string | null;
  quantity: number | null;
  unit_price: number | null;
  fees: number;
  transaction_id: string | null;
};
type Props = {
  teamId: string;
  accounts: Account[];
  securities: Security[];
  userEmail: string | null;
  canWrite: boolean;
  isDemo: boolean;
  onApplied: () => void;
};

const categoryLabels: Record<StatementCategory, string> = {
  investment_buy: "Investment purchase",
  investment_sale: "Investment sale",
  income: "Income",
  fee: "Bank / broker fee",
  transfer: "Transfer",
  other: "Other",
};
const categoryOptions = Object.entries(categoryLabels) as [StatementCategory, string][];
const currency = (amount: number, currencyCode = "MYR") => new Intl.NumberFormat("en-MY", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(amount);

export function StatementImporter({ teamId, accounts, securities, userEmail, canWrite, isDemo, onApplied }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [fileName, setFileName] = useState("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [columns, setColumns] = useState<StatementColumns>({ date: -1, description: -1, amount: -1, debit: -1, credit: -1, balance: -1 });
  const [accountId, setAccountId] = useState("");
  const [newAccount, setNewAccount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("MYR");

  const parsed = useMemo(() => {
    if (!grid.length || columns.date < 0 || columns.description < 0 || (columns.amount < 0 && (columns.debit < 0 || columns.credit < 0))) return { entries: [], skipped: 0 };
    return buildStatementRows(grid, columns, true);
  }, [grid, columns]);

  async function loadImports(selectId?: string) {
    const { data, error: queryError } = await supabase.from("statement_imports")
      .select("id,account_id,file_name,currency_code,row_count,period_start,period_end,total_credits,total_debits,created_at")
      .eq("team_id", teamId).order("created_at", { ascending: false });
    if (queryError) { setError(queryError.message); return; }
    const loaded = (data ?? []) as ImportRecord[];
    setImports(loaded);
    const id = selectId ?? selectedId;
    if (id && loaded.some((item) => item.id === id)) await loadEntries(id);
    else if (loaded[0]) { setSelectedId(loaded[0].id); await loadEntries(loaded[0].id); }
    else { setSelectedId(""); setEntries([]); }
  }

  async function loadEntries(importId: string) {
    const { data, error: queryError } = await supabase.from("statement_entries")
      .select("id,import_id,row_number,txn_date,description,amount,balance,category,security_id,quantity,unit_price,fees,transaction_id")
      .eq("team_id", teamId).eq("import_id", importId).order("txn_date", { ascending: false }).order("row_number");
    if (queryError) { setError(queryError.message); return; }
    setEntries((data ?? []) as EntryRecord[]);
  }

  useEffect(() => { if (!isDemo && userEmail) void loadImports(); }, [teamId, isDemo, userEmail]);

  async function chooseFile(file?: File) {
    setError(""); setNotice(""); setGrid([]); setFileName("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Please export your bank statement as a CSV file first. PDF statements are not supported yet."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("This CSV is over 10 MB. Export a shorter statement period and try again."); return; }
    const rows = parseCsv(await file.text());
    if (rows.length < 2 || rows.length > 5001) { setError(rows.length > 5001 ? "A single import can contain at most 5,000 rows." : "This CSV does not contain a header and transaction rows."); return; }
    const detected = detectColumns(rows[0]);
    setGrid(rows); setFileName(file.name); setColumns(detected);
  }

  function updateColumn(name: keyof StatementColumns, value: string) {
    setColumns((current) => ({ ...current, [name]: value === "" ? -1 : Number(value) }));
  }

  async function importStatement() {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!userEmail) throw new Error("Sign in to import a bank statement into a team workspace.");
      if (!canWrite) throw new Error("Your team role is view-only. Ask a team admin to import statements.");
      if (!parsed.entries.length) throw new Error("Map the date, description, and amount columns before importing.");
      if ((!accountId || accountId === "__new__") && !newAccount.trim()) throw new Error("Choose an investment account or enter a new account name.");
      if (parsed.entries.length > 5000) throw new Error("A single import can contain at most 5,000 transactions.");

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Your sign-in session has expired. Sign in again and retry.");
      let resolvedAccountId = accountId === "__new__" ? "" : accountId;
      if (!resolvedAccountId && newAccount.trim()) {
        const { data, error: accountError } = await supabase.from("accounts").insert({ team_id: teamId, name: newAccount.trim(), institution: null })
          .select("id").single();
        if (accountError || !data) throw new Error(accountError?.message ?? "Could not create the investment account.");
        resolvedAccountId = data.id;
      }

      const digest = await crypto.subtle.digest("SHA-256", await gridToBytes(grid));
      const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const dates = parsed.entries.map((entry) => entry.txn_date).sort();
      const totalCredits = parsed.entries.reduce((sum, entry) => sum + Math.max(entry.amount, 0), 0);
      const totalDebits = parsed.entries.reduce((sum, entry) => sum + Math.max(-entry.amount, 0), 0);
      const { data: importRow, error: importError } = await supabase.from("statement_imports").insert({
        team_id: teamId,
        account_id: resolvedAccountId,
        file_name: fileName,
        file_hash: hash,
        currency_code: currencyCode,
        row_count: parsed.entries.length,
        period_start: dates[0],
        period_end: dates.at(-1),
        total_credits: totalCredits,
        total_debits: totalDebits,
        created_by: user.id,
      }).select("id").single();
      if (importError || !importRow) {
        if (importError?.code === "23505") throw new Error("This exact statement has already been imported into this team.");
        throw new Error(importError?.message ?? "Could not save the statement summary.");
      }

      const payload = parsed.entries.map((entry) => ({ ...entry, team_id: teamId, import_id: importRow.id }));
      for (let offset = 0; offset < payload.length; offset += 250) {
        const { error: rowsError } = await supabase.from("statement_entries").insert(payload.slice(offset, offset + 250));
        if (rowsError) {
          await supabase.from("statement_imports").delete().eq("id", importRow.id).eq("team_id", teamId);
          throw new Error(`Statement summary could not be saved: ${rowsError.message}`);
        }
      }
      setGrid([]); setFileName(""); setNewAccount("");
      setNotice(`Imported ${parsed.entries.length} transactions${parsed.skipped ? `; skipped ${parsed.skipped} unrecognized rows` : ""}.`);
      await loadImports(importRow.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import this statement.");
    } finally { setBusy(false); }
  }

  async function updateEntry(entry: EntryRecord, patch: Partial<EntryRecord>) {
    if (!canWrite) return;
    setError("");
    const { error: updateError } = await supabase.from("statement_entries").update(patch).eq("id", entry.id).eq("team_id", teamId);
    if (updateError) { setError(updateError.message); return; }
    setEntries((current) => current.map((row) => row.id === entry.id ? { ...row, ...patch } : row));
  }

  async function recordTrade(entry: EntryRecord) {
    if (!canWrite || entry.transaction_id) return;
    if (!entry.security_id || !entry.quantity || entry.quantity <= 0 || entry.unit_price == null || entry.unit_price < 0) {
      setError("Choose a security and enter its quantity and unit price before recording this trade."); return;
    }
    if ((entry.category === "investment_buy" && entry.amount >= 0) || (entry.category === "investment_sale" && entry.amount <= 0)) {
      setError("The trade type does not match the cash direction in this statement. Check the row category."); return;
    }
    setBusy(true); setError("");
    try {
      const selected = imports.find((item) => item.id === entry.import_id);
      if (!selected) throw new Error("Statement import not found.");
      const { data: transaction, error: transactionError } = await supabase.from("transactions").insert({
        team_id: teamId,
        account_id: selected.account_id,
        security_id: entry.security_id,
        txn_date: entry.txn_date,
        txn_type: entry.category === "investment_buy" ? "buy" : "sale",
        quantity: entry.quantity,
        unit_price: entry.unit_price,
        fees: entry.fees ?? 0,
        notes: `Imported from ${selected.file_name}`,
        statement_entry_id: entry.id,
      }).select("id").single();
      if (transactionError || !transaction) throw new Error(transactionError?.message ?? "Could not create a portfolio transaction.");
      const { error: linkError } = await supabase.from("statement_entries").update({ transaction_id: transaction.id }).eq("id", entry.id).eq("team_id", teamId);
      if (linkError) throw new Error(`Transaction was recorded, but its statement row could not be linked: ${linkError.message}`);
      setEntries((current) => current.map((row) => row.id === entry.id ? { ...row, transaction_id: transaction.id } : row));
      setNotice("Investment transaction recorded. Portfolio totals have been refreshed.");
      onApplied();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record this trade."); }
    finally { setBusy(false); }
  }

  const selectedImport = imports.find((item) => item.id === selectedId);
  const categoryTotals = useMemo(() => categoryOptions.map(([category, label]) => ({
    category,
    label,
    amount: entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.amount, 0),
    count: entries.filter((entry) => entry.category === category).length,
  })).filter((item) => item.count > 0), [entries]);

  return <section className="statement-workspace">
    {isDemo && <div className="demo-banner"><span>Statement imports are private to a team workspace.</span><a href={userEmail ? "/teams/new" : "/auth/sign-in"}>{userEmail ? "Create your team" : "Sign in to create your team"} →</a></div>}
    {!isDemo && userEmail && !canWrite && <div className="alert-error"><span>!</span><div>This team is view-only for you. Ask an owner or admin to import a statement.</div></div>}
    {error && <div className="alert-error"><span>!</span><div>{error}</div><button onClick={() => setError("")}>×</button></div>}
    {notice && <div className="toast">✓ &nbsp;{notice}</div>}

    {canWrite && <section className="panel statement-upload-panel">
      <div className="panel-heading"><div><h2>Import a bank statement</h2><p>Upload a CSV export to summarize cash activity for an investment account.</p></div></div>
      <div className="statement-upload-form">
        <label className="statement-file-label">Statement CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0])}/></label>
        <label>Investment account<select value={accountId} onChange={(event) => { setAccountId(event.target.value); setNewAccount(""); }}>
          <option value="">Choose an account</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
          <option value="__new__">＋ Add a new account</option>
        </select></label>
        {accountId === "__new__" && <label>New account name<input value={newAccount} onChange={(event) => setNewAccount(event.target.value)} placeholder="e.g. Maybank Investment"/></label>}
        <label>Statement currency<select value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)}>{["MYR", "USD", "SGD", "GBP", "EUR", "AUD", "JPY", "HKD"].map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
      </div>

      {grid.length > 0 && <div className="statement-preview">
        <div className="statement-preview-heading"><div><b>{fileName}</b><small>{parsed.entries.length.toLocaleString()} recognized rows · {parsed.skipped} skipped</small></div></div>
        <div className="statement-mapping">
          <label>Date column<select value={columns.date} onChange={(event) => updateColumn("date", event.target.value)}>{columnOptions(grid[0])}</select></label>
          <label>Description column<select value={columns.description} onChange={(event) => updateColumn("description", event.target.value)}>{columnOptions(grid[0])}</select></label>
          <label>Amount column<select value={columns.amount} onChange={(event) => updateColumn("amount", event.target.value)}>{columnOptions(grid[0])}</select></label>
          <label>Debit column<select value={columns.debit} onChange={(event) => updateColumn("debit", event.target.value)}>{columnOptions(grid[0])}</select></label>
          <label>Credit column<select value={columns.credit} onChange={(event) => updateColumn("credit", event.target.value)}>{columnOptions(grid[0])}</select></label>
          <label>Balance column<select value={columns.balance} onChange={(event) => updateColumn("balance", event.target.value)}>{columnOptions(grid[0])}</select></label>
        </div>
        {parsed.entries.length > 0 && <div className="table-wrap statement-table-wrap"><table><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th>AMOUNT</th><th>BALANCE</th></tr></thead><tbody>{parsed.entries.slice(0, 8).map((entry) => <tr key={entry.row_number}><td>{entry.txn_date}</td><td>{entry.description}</td><td>{categoryLabels[entry.category]}</td><td className={entry.amount >= 0 ? "positive-text" : "negative-text"}>{currency(entry.amount, currencyCode)}</td><td>{entry.balance == null ? "—" : currency(entry.balance, currencyCode)}</td></tr>)}</tbody></table></div>}
        <div className="statement-preview-footer"><span>Summary is generated from the mapped amount column. Raw CSV file is not stored.</span><button className="button button-primary" disabled={busy || !parsed.entries.length} onClick={() => void importStatement()}>{busy ? "Importing…" : "Import and summarize"}</button></div>
      </div>}
    </section>}

    <div className="statement-history-layout">
      <section className="panel table-panel statement-history-panel">
        <div className="panel-heading"><div><h2>Imported statements <span className="heading-count">{imports.length}</span></h2><p>Saved summaries for this team</p></div></div>
        {imports.length ? <div className="statement-import-list">{imports.map((item) => <button className={`statement-import-item ${selectedId === item.id ? "active" : ""}`} key={item.id} onClick={() => { setSelectedId(item.id); void loadEntries(item.id); }}>
          <span className="statement-import-icon">▤</span><span className="statement-import-meta"><b>{item.file_name}</b><small>{periodLabel(item.period_start, item.period_end)} · {item.row_count} rows</small></span><b className="statement-import-total">{currency(Number(item.total_credits) - Number(item.total_debits), item.currency_code)}</b>
        </button>)}</div> : <div className="empty-state"><div className="empty-icon">▤</div><b>No statements imported yet.</b><span>Upload a CSV statement to see its summary here.</span></div>}
      </section>

      {selectedImport && <section className="statement-detail">
        <div className="metric-grid statement-metrics">
          <div className="metric-card"><div className="metric-top"><span>Money in</span><i>↙</i></div><b className="metric-value">{currency(Number(selectedImport.total_credits), selectedImport.currency_code)}</b><div className="metric-foot">Statement credits</div></div>
          <div className="metric-card"><div className="metric-top"><span>Money out</span><i>↗</i></div><b className="metric-value">{currency(Number(selectedImport.total_debits), selectedImport.currency_code)}</b><div className="metric-foot">Statement debits</div></div>
          <div className="metric-card"><div className="metric-top"><span>Net cash flow</span><i>⌁</i></div><b className="metric-value">{currency(Number(selectedImport.total_credits) - Number(selectedImport.total_debits), selectedImport.currency_code)}</b><div className="metric-foot">{entries.length} statement lines · {selectedImport.currency_code}</div></div>
        </div>
        <section className="panel statement-breakdown"><div className="panel-heading"><div><h2>Activity breakdown</h2><p>Amounts are grouped by statement category.</p></div></div>
          <div className="statement-category-list">{categoryTotals.map((item) => <div className="statement-category-row" key={item.category}><span>{item.label}<small>{item.count} {item.count === 1 ? "transaction" : "transactions"}</small></span><b className={item.amount >= 0 ? "positive-text" : "negative-text"}>{currency(item.amount, selectedImport.currency_code)}</b></div>)}</div>
        </section>
        <section className="panel table-panel statement-entries-panel"><div className="panel-heading"><div><h2>Statement transactions <span className="heading-count">{entries.length}</span></h2><p>Classify rows and record investment trades to update positions.</p></div></div>
          <div className="table-wrap statement-table-wrap"><table><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th>AMOUNT</th><th>SECURITY</th><th>QUANTITY</th><th>UNIT PRICE</th><th>FEES</th><th/></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}>
            <td>{entry.txn_date}</td><td className="statement-description">{entry.description}</td>
            <td><select disabled={!canWrite || Boolean(entry.transaction_id)} value={entry.category} onChange={(event) => void updateEntry(entry, { category: event.target.value as StatementCategory })}>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
            <td className={entry.amount >= 0 ? "positive-text" : "negative-text"}>{currency(Number(entry.amount), selectedImport.currency_code)}</td>
            {entry.category === "investment_buy" || entry.category === "investment_sale" ? <>
              <td><select aria-label={`Security for statement row ${entry.row_number}`} disabled={!canWrite || Boolean(entry.transaction_id)} value={entry.security_id ?? ""} onChange={(event) => void updateEntry(entry, { security_id: event.target.value || null })}><option value="">Select security</option>{securities.map((security) => <option value={security.id} key={security.id}>{security.name}{security.ticker ? ` (${security.ticker})` : ""}</option>)}</select></td>
              <td><input aria-label={`Quantity for statement row ${entry.row_number}`} disabled={!canWrite || Boolean(entry.transaction_id)} type="number" min="0.00000001" step="any" value={entry.quantity ?? ""} onChange={(event) => setEntries((current) => current.map((row) => row.id === entry.id ? { ...row, quantity: event.target.value === "" ? null : Number(event.target.value) } : row))} onBlur={() => void updateEntry(entry, { quantity: entry.quantity })}/></td>
              <td><input aria-label={`Unit price for statement row ${entry.row_number}`} disabled={!canWrite || Boolean(entry.transaction_id)} type="number" min="0" step="any" value={entry.unit_price ?? ""} onChange={(event) => setEntries((current) => current.map((row) => row.id === entry.id ? { ...row, unit_price: event.target.value === "" ? null : Number(event.target.value) } : row))} onBlur={() => void updateEntry(entry, { unit_price: entry.unit_price })}/></td>
              <td><input aria-label={`Fees for statement row ${entry.row_number}`} disabled={!canWrite || Boolean(entry.transaction_id)} type="number" min="0" step="any" value={entry.fees ?? 0} onChange={(event) => setEntries((current) => current.map((row) => row.id === entry.id ? { ...row, fees: Math.max(0, Number(event.target.value) || 0) } : row))} onBlur={() => void updateEntry(entry, { fees: entry.fees })}/></td>
              <td>{entry.transaction_id ? <span className="status-pill positive">Recorded</span> : <button className="button button-small button-light" disabled={!canWrite || busy} onClick={() => void recordTrade(entry)}>Record trade</button>}</td>
            </> : <td colSpan={5} className="muted-cell">No portfolio trade action</td>}
          </tr>)}</tbody></table></div>
        </section>
      </section>}
    </div>
  </section>;
}

function columnOptions(headers: string[]) {
  return <><option value={-1}>Not mapped</option>{headers.map((value, index) => <option value={index} key={`${index}-${value}`}>{value || `Column ${index + 1}`}</option>)}</>;
}

function periodLabel(start: string | null, end: string | null) {
  if (!start && !end) return "Period unavailable";
  if (start === end) return start;
  return `${start ?? "…"} – ${end ?? "…"}`;
}

async function gridToBytes(rows: string[][]): Promise<ArrayBuffer> {
  const encoded = new TextEncoder().encode(rows.map((row) => row.join("\u001f")).join("\u001e"));
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
}
