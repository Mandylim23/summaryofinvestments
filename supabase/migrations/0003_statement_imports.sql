begin;

create table if not exists public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  account_id uuid not null,
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  currency_code text not null default 'MYR' check (currency_code ~ '^[A-Z]{3}$'),
  row_count integer not null default 0 check (row_count >= 0),
  period_start date,
  period_end date,
  total_credits numeric not null default 0,
  total_debits numeric not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(team_id, file_hash),
  unique(team_id, id),
  constraint statement_imports_account_team_fk foreign key(team_id, account_id)
    references public.accounts(team_id, id) on delete cascade,
  check (period_start is null or period_end is null or period_start <= period_end)
);

create table if not exists public.statement_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  import_id uuid not null references public.statement_imports(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  txn_date date not null,
  description text not null,
  amount numeric not null,
  balance numeric,
  category text not null default 'other'
    check (category in ('investment_buy','investment_sale','income','fee','transfer','other')),
  security_id uuid,
  quantity numeric check (quantity is null or quantity > 0),
  unit_price numeric check (unit_price is null or unit_price >= 0),
  fees numeric not null default 0 check (fees >= 0),
  transaction_id uuid,
  created_at timestamptz not null default now(),
  unique(import_id, row_number),
  constraint statement_entries_team_import_fk foreign key(team_id, import_id)
    references public.statement_imports(team_id, id) on delete cascade,
  constraint statement_entries_team_security_fk foreign key(team_id, security_id)
    references public.securities(team_id, id) on delete set null (security_id),
  constraint statement_entries_team_transaction_fk foreign key(team_id, transaction_id)
    references public.transactions(team_id, id) on delete set null (transaction_id)
);

create unique index if not exists transactions_team_id_id_key on public.transactions(team_id, id);
create index if not exists statement_imports_team_created_idx on public.statement_imports(team_id, created_at desc);
create index if not exists statement_entries_import_date_idx on public.statement_entries(import_id, txn_date, row_number);

alter table public.transactions add column if not exists statement_entry_id uuid;
alter table public.transactions add constraint transactions_statement_entry_fk
  foreign key(statement_entry_id) references public.statement_entries(id) on delete set null;
create unique index if not exists transactions_statement_entry_id_key
  on public.transactions(statement_entry_id) where statement_entry_id is not null;

alter table public.statement_imports enable row level security;
alter table public.statement_entries enable row level security;

drop policy if exists statement_imports_member_read on public.statement_imports;
create policy statement_imports_member_read on public.statement_imports for select to authenticated
  using (public.is_team_member(team_id));
drop policy if exists statement_imports_member_insert on public.statement_imports;
create policy statement_imports_member_insert on public.statement_imports for insert to authenticated
  with check (created_by = (select auth.uid()) and exists (
    select 1 from public.team_members m where m.team_id = statement_imports.team_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin','member')
  ));
drop policy if exists statement_imports_member_delete on public.statement_imports;
create policy statement_imports_member_delete on public.statement_imports for delete to authenticated
  using (exists (
    select 1 from public.team_members m where m.team_id = statement_imports.team_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin','member')
  ));

drop policy if exists statement_entries_member_read on public.statement_entries;
create policy statement_entries_member_read on public.statement_entries for select to authenticated
  using (public.is_team_member(team_id));
drop policy if exists statement_entries_member_insert on public.statement_entries;
create policy statement_entries_member_insert on public.statement_entries for insert to authenticated
  with check (exists (
    select 1 from public.team_members m where m.team_id = statement_entries.team_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin','member')
  ));
drop policy if exists statement_entries_member_update on public.statement_entries;
create policy statement_entries_member_update on public.statement_entries for update to authenticated
  using (exists (
    select 1 from public.team_members m where m.team_id = statement_entries.team_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin','member')
  )) with check (exists (
    select 1 from public.team_members m where m.team_id = statement_entries.team_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin','member')
  ));

grant select, insert, delete on public.statement_imports to authenticated;
grant select, insert, update on public.statement_entries to authenticated;
grant select, insert, update on public.transactions to authenticated;

commit;
