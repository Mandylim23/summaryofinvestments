-- Add team tenancy while keeping only the legacy demo tenant publicly readable.
-- All tenant writes and all non-demo reads require authenticated membership.
begin;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, is_demo)
);
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  token_hash text not null unique,
  role text not null default 'member' check (role in ('admin','member','viewer')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.teams, public.team_members, public.team_invites to authenticated;

alter table public.accounts add column if not exists team_id uuid;
alter table public.securities add column if not exists team_id uuid;
alter table public.transactions add column if not exists team_id uuid;
alter table public.accounts add column if not exists is_demo boolean not null default false;
alter table public.securities add column if not exists is_demo boolean not null default false;
alter table public.transactions add column if not exists is_demo boolean not null default false;

insert into public.teams(id,name,slug,is_demo)
values ('d0000000-0000-0000-0000-000000000001','SP Holdings','sp-holdings-demo',true)
on conflict (id) do nothing;
update public.accounts set team_id='d0000000-0000-0000-0000-000000000001',is_demo=true where team_id is null;
update public.securities set team_id='d0000000-0000-0000-0000-000000000001',is_demo=true where team_id is null;
update public.transactions set team_id='d0000000-0000-0000-0000-000000000001',is_demo=true where team_id is null;
alter table public.accounts alter column team_id set not null;
alter table public.securities alter column team_id set not null;
alter table public.transactions alter column team_id set not null;

create unique index if not exists accounts_team_id_id_key on public.accounts(team_id,id);
create unique index if not exists securities_team_id_id_key on public.securities(team_id,id);
create index if not exists team_members_user_id_idx on public.team_members(user_id);
create index if not exists team_invites_team_email_idx on public.team_invites(team_id,email) where accepted_at is null;
create index if not exists accounts_team_id_idx on public.accounts(team_id);
create index if not exists securities_team_id_idx on public.securities(team_id);
create index if not exists transactions_team_date_idx on public.transactions(team_id,txn_date desc);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='accounts_team_fk') then
    alter table public.accounts add constraint accounts_team_fk foreign key(team_id,is_demo) references public.teams(id,is_demo) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='securities_team_fk') then
    alter table public.securities add constraint securities_team_fk foreign key(team_id,is_demo) references public.teams(id,is_demo) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='transactions_team_fk') then
    alter table public.transactions add constraint transactions_team_fk foreign key(team_id,is_demo) references public.teams(id,is_demo) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='transactions_account_team_fk') then
    alter table public.transactions add constraint transactions_account_team_fk foreign key(team_id,account_id) references public.accounts(team_id,id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='transactions_security_team_fk') then
    alter table public.transactions add constraint transactions_security_team_fk foreign key(team_id,security_id) references public.securities(team_id,id) on delete cascade not valid;
  end if;
end $$;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.team_members tm where tm.team_id=target_team_id and tm.user_id=(select auth.uid())) $$;
revoke all on function public.is_team_member(uuid) from public;
grant execute on function public.is_team_member(uuid) to authenticated;

create or replace function public.create_team(team_name text, team_slug text)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if length(trim(team_name)) not between 1 and 120 then raise exception 'Invalid team name'; end if;
  if team_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Invalid team slug'; end if;
  insert into public.teams(name,slug,created_by) values(trim(team_name),team_slug,uid) returning id into new_id;
  insert into public.team_members(team_id,user_id,role) values(new_id,uid,'owner');
  return new_id;
end $$;
revoke all on function public.create_team(text,text) from public;
grant execute on function public.create_team(text,text) to authenticated;

-- Invite email delivery uses configured Supabase Auth SMTP; only a SHA-256 token
-- hash is stored. The raw token must only be sent to the invited email address.
create or replace function public.create_team_invite(target_team_id uuid, invite_email text, invite_role text, invite_token_hash text)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare uid uuid := auth.uid(); invite_id uuid; verified_at timestamptz;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select email_confirmed_at into verified_at from auth.users where id=uid;
  if verified_at is null then raise exception 'Verified email required'; end if;
  if not exists(select 1 from public.team_members m where m.team_id=target_team_id and m.user_id=uid and m.role in ('owner','admin')) then raise exception 'Team administrator required'; end if;
  if invite_role not in ('admin','member','viewer') then raise exception 'Invalid invite role'; end if;
  if invite_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invite token'; end if;
  insert into public.team_invites(team_id,email,token_hash,role,invited_by)
    values(target_team_id,lower(trim(invite_email)),invite_token_hash,invite_role,uid)
    returning id into invite_id;
  return invite_id;
end $$;
revoke all on function public.create_team_invite(uuid,text,text,text) from public;
grant execute on function public.create_team_invite(uuid,text,text,text) to authenticated;

create or replace function public.accept_team_invite(invite_token_hash text)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare uid uuid := auth.uid(); verified_email text; verified_at timestamptz; invite public.team_invites%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select lower(trim(email)), email_confirmed_at into verified_email, verified_at from auth.users where id=uid;
  if verified_at is null or verified_email = '' then raise exception 'Sign in with a verified email to accept this invitation'; end if;
  select * into invite from public.team_invites i where i.token_hash=invite_token_hash and i.accepted_at is null and i.expires_at>now() for update;
  if not found then raise exception 'Invitation is invalid, expired, or already used'; end if;
  if invite.email <> verified_email then raise exception 'Signed-in email does not match the invitation'; end if;
  insert into public.team_members(team_id,user_id,role) values(invite.team_id,uid,invite.role) on conflict(team_id,user_id) do nothing;
  update public.team_invites set accepted_at=now() where id=invite.id;
  return invite.team_id;
end $$;
revoke all on function public.accept_team_invite(text) from public;
grant execute on function public.accept_team_invite(text) to authenticated;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
drop policy if exists teams_member_read on public.teams;
create policy teams_member_read on public.teams for select to authenticated using(public.is_team_member(id));
drop policy if exists teams_owner_update on public.teams;
create policy teams_owner_update on public.teams for update to authenticated
using(exists(select 1 from public.team_members m where m.team_id=id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
with check(exists(select 1 from public.team_members m where m.team_id=id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated using(public.is_team_member(team_id));
drop policy if exists team_invites_read_admin on public.team_invites;
create policy team_invites_read_admin on public.team_invites for select to authenticated
using(exists(select 1 from public.team_members m where m.team_id=team_invites.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

-- Public users can read demo rows only; demo remains immutable through the API.
drop policy if exists "accounts_v1_read" on public.accounts;
drop policy if exists "accounts_v1_write" on public.accounts;
drop policy if exists "securities_v1_read" on public.securities;
drop policy if exists "securities_v1_write" on public.securities;
drop policy if exists "transactions_v1_read" on public.transactions;
drop policy if exists "transactions_v1_write" on public.transactions;
drop policy if exists accounts_demo_read on public.accounts;
drop policy if exists accounts_team_access on public.accounts;
drop policy if exists accounts_team_read on public.accounts; drop policy if exists accounts_team_insert on public.accounts; drop policy if exists accounts_team_update on public.accounts; drop policy if exists accounts_team_delete on public.accounts;
drop policy if exists securities_demo_read on public.securities;
drop policy if exists securities_team_access on public.securities;
drop policy if exists securities_team_read on public.securities; drop policy if exists securities_team_insert on public.securities; drop policy if exists securities_team_update on public.securities; drop policy if exists securities_team_delete on public.securities;
drop policy if exists transactions_demo_read on public.transactions;
drop policy if exists transactions_team_access on public.transactions;
drop policy if exists transactions_team_read on public.transactions; drop policy if exists transactions_team_insert on public.transactions; drop policy if exists transactions_team_update on public.transactions; drop policy if exists transactions_team_delete on public.transactions;
create policy accounts_demo_read on public.accounts for select to anon,authenticated using(is_demo and team_id='d0000000-0000-0000-0000-000000000001');
create policy accounts_team_read on public.accounts for select to authenticated using(public.is_team_member(team_id) and not is_demo);
create policy accounts_team_insert on public.accounts for insert to authenticated with check(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=accounts.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member')));
create policy accounts_team_update on public.accounts for update to authenticated using(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=accounts.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member'))) with check(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=accounts.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member')));
create policy accounts_team_delete on public.accounts for delete to authenticated using(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=accounts.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member')));

create policy securities_demo_read on public.securities for select to anon,authenticated using(is_demo and team_id='d0000000-0000-0000-0000-000000000001');
create policy securities_team_read on public.securities for select to authenticated using(public.is_team_member(team_id) and not is_demo);
create policy securities_team_insert on public.securities for insert to authenticated with check(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=securities.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member')));
create policy securities_team_update on public.securities for update to authenticated using(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=securities.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member'))) with check(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=securities.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member')));
create policy securities_team_delete on public.securities for delete to authenticated using(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=securities.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member')));

create policy transactions_demo_read on public.transactions for select to anon,authenticated using(is_demo and team_id='d0000000-0000-0000-0000-000000000001');
create policy transactions_team_read on public.transactions for select to authenticated using(public.is_team_member(team_id) and not is_demo);
create policy transactions_team_insert on public.transactions for insert to authenticated with check(public.is_team_member(team_id) and not is_demo
  and exists(select 1 from public.team_members m where m.team_id=transactions.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member'))
  and exists(select 1 from public.accounts a where a.id=transactions.account_id and a.team_id=transactions.team_id and not a.is_demo)
  and exists(select 1 from public.securities s where s.id=transactions.security_id and s.team_id=transactions.team_id and not s.is_demo));
create policy transactions_team_update on public.transactions for update to authenticated using(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=transactions.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member'))) with check(public.is_team_member(team_id) and not is_demo
  and exists(select 1 from public.team_members m where m.team_id=transactions.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member'))
  and exists(select 1 from public.accounts a where a.id=transactions.account_id and a.team_id=transactions.team_id and not a.is_demo)
  and exists(select 1 from public.securities s where s.id=transactions.security_id and s.team_id=transactions.team_id and not s.is_demo));
create policy transactions_team_delete on public.transactions for delete to authenticated using(public.is_team_member(team_id) and not is_demo and exists(select 1 from public.team_members m where m.team_id=transactions.team_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','member')));
commit;
