create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  institution text,
  created_at timestamptz not null default now()
);
alter table accounts enable row level security;
drop policy if exists "accounts_v1_read" on accounts;
create policy "accounts_v1_read" on accounts for select using (true);
drop policy if exists "accounts_v1_write" on accounts;
create policy "accounts_v1_write" on accounts for all using (true) with check (true);

create table if not exists securities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  ticker text,
  asset_type text,
  current_price numeric,
  price_as_of date,
  created_at timestamptz not null default now()
);
alter table securities enable row level security;
drop policy if exists "securities_v1_read" on securities;
create policy "securities_v1_read" on securities for select using (true);
drop policy if exists "securities_v1_write" on securities;
create policy "securities_v1_write" on securities for all using (true) with check (true);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  account_id uuid references accounts(id) on delete cascade,
  security_id uuid references securities(id) on delete cascade,
  txn_date date not null,
  txn_type text not null check (txn_type in ('buy','sale')),
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  fees numeric not null default 0 check (fees >= 0),
  notes text,
  created_at timestamptz not null default now()
);
alter table transactions enable row level security;
drop policy if exists "transactions_v1_read" on transactions;
create policy "transactions_v1_read" on transactions for select using (true);
drop policy if exists "transactions_v1_write" on transactions;
create policy "transactions_v1_write" on transactions for all using (true) with check (true);

insert into accounts (id, name, institution) values
  ('a0000000-0000-0000-0000-000000000001', 'HSBC Investment Account', 'HSBC'),
  ('a0000000-0000-0000-0000-000000000002', 'Standard Chartered Portfolio', 'Standard Chartered')
on conflict (id) do nothing;

insert into securities (id, name, ticker, asset_type, current_price, price_as_of) values
  ('b0000000-0000-0000-0000-000000000001', 'ABC Mutual Fund', 'ABCMF', 'fund', 12.50, '2024-06-01'),
  ('b0000000-0000-0000-0000-000000000002', 'XYZ Corporate Bond', 'XYZB', 'bond', 1000.00, '2024-06-01'),
  ('b0000000-0000-0000-0000-000000000003', 'Blue Chip Equity', 'BCE', 'equity', 85.00, '2024-06-01')
on conflict (id) do nothing;

insert into transactions (id, account_id, security_id, txn_date, txn_type, quantity, unit_price, fees, notes) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2024-01-05', 'buy', 100, 10.00, 0, 'Initial purchase'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2024-02-10', 'sale', 40, 12.00, 5, 'Partial sale'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '2024-01-15', 'buy', 50, 980.00, 10, 'Bond purchase'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', '2024-03-01', 'buy', 200, 80.00, 15, 'Equity buy'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', '2024-04-20', 'sale', 100, 85.00, 10, 'Equity sale at profit'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2024-03-20', 'buy', 50, 11.00, 0, 'Top-up purchase')
on conflict (id) do nothing;
