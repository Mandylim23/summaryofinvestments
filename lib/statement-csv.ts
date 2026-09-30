export type StatementCategory = "investment_buy" | "investment_sale" | "income" | "fee" | "transfer" | "other";

export type StatementRow = {
  row_number: number;
  txn_date: string;
  description: string;
  amount: number;
  balance: number | null;
  category: StatementCategory;
};

export type StatementColumns = {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  balance: number;
};

export function parseCsv(text: string): string[][] {
  const sample = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", "\t", ";"].map((candidate) => ({
    candidate,
    count: [...sample].filter((character) => character === candidate).length,
  })).sort((a, b) => b.count - a.count)[0]?.candidate ?? ",";
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    if (character === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      row.push(value.trim()); value = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && source[i + 1] === "\n") i += 1;
      row.push(value.trim()); value = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else value += character;
  }
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

const header = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

export function detectColumns(headers: string[]): StatementColumns {
  const names = headers.map(header);
  const find = (predicate: (value: string) => boolean) => names.findIndex(predicate);
  return {
    date: find((name) => name === "date" || name.includes("transactiondate") || name.includes("valuedate") || name.includes("posteddate")),
    description: find((name) => ["description", "details", "narrative", "particulars", "memo", "transactiondescription"].some((key) => name.includes(key))),
    amount: find((name) => name === "amount" || name === "transactionamount" || name === "netamount"),
    debit: find((name) => name === "debit" || name === "withdrawal" || name === "moneyout"),
    credit: find((name) => name === "credit" || name === "deposit" || name === "moneyin"),
    balance: find((name) => name === "balance" || name.includes("runningbalance")),
  };
}

export function parseAmount(value: string): number | null {
  let cleaned = value.trim().replace(/\s/g, "").replace(/^(RM|MYR|USD|SGD|HKD|\$|£|€)/i, "").replace(/(RM|MYR|USD|SGD|HKD|\$|£|€)$/i, "");
  if (!cleaned) return null;
  let negative = false;
  if (/\(.*\)/.test(cleaned)) { negative = true; cleaned = cleaned.slice(1, -1); }
  if (/(DR|DEBIT)$/i.test(cleaned)) { negative = true; cleaned = cleaned.replace(/(DR|DEBIT)$/i, ""); }
  if (/(CR|CREDIT)$/i.test(cleaned)) cleaned = cleaned.replace(/(CR|CREDIT)$/i, "");
  cleaned = cleaned.replaceAll(",", "").replace(/[^\d.+-]/g, "");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return null;
  return negative ? -Math.abs(amount) : amount;
}

export function parseStatementDate(value: string): string | null {
  const text = value.trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(text);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += year < 70 ? 2000 : 1900;
  // Local bank CSV exports typically use day/month/year.
  return validDate(year, Number(match[2]), Number(match[1]));
}

function validDate(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function inferCategory(description: string): StatementCategory {
  const text = description.toLowerCase();
  if (/\b(sell|sold|sale|redemption)\b/.test(text) && /\b(share|stock|fund|unit|bond|security|securities|investment|etf)\b/.test(text)) return "investment_sale";
  if (/\b(buy|bought|purchase|purchased)\b/.test(text) && /\b(share|stock|fund|unit|bond|security|securities|investment|etf)\b/.test(text)) return "investment_buy";
  if (/\b(fee|commission|charge|service charge)\b/.test(text)) return "fee";
  if (/\b(dividend|interest|salary|payroll|income)\b/.test(text)) return "income";
  if (/\b(transfer|payment|deposit|withdrawal|standing order)\b/.test(text)) return "transfer";
  return "other";
}

export function buildStatementRows(
  rows: string[][],
  columns: StatementColumns,
  hasHeader: boolean,
): { entries: StatementRow[]; skipped: number } {
  const entries: StatementRow[] = [];
  const start = hasHeader ? 1 : 0;
  let skipped = 0;
  for (let index = start; index < rows.length; index += 1) {
    const source = rows[index];
    const txn_date = parseStatementDate(source[columns.date] ?? "");
    const description = (source[columns.description] ?? "").trim().slice(0, 1000);
    let amount: number | null = null;
    if (columns.amount >= 0) amount = parseAmount(source[columns.amount] ?? "");
    else {
      const debit = columns.debit >= 0 ? parseAmount(source[columns.debit] ?? "") : null;
      const credit = columns.credit >= 0 ? parseAmount(source[columns.credit] ?? "") : null;
      amount = (credit ?? 0) - Math.abs(debit ?? 0);
      if (debit === null && credit === null) amount = null;
    }
    if (!txn_date || !description || amount === null) { skipped += 1; continue; }
    const balance = columns.balance >= 0 ? parseAmount(source[columns.balance] ?? "") : null;
    entries.push({
      row_number: index + 1,
      txn_date,
      description,
      amount,
      balance,
      category: inferCategory(description),
    });
  }
  return { entries, skipped };
}
