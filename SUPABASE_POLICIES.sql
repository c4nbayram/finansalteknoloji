-- Finansal Teknolojiler - Supabase RLS / Storage policy düzeltmeleri
-- SQL Editor'da çalıştırın.

-- 1) Admin kontrolü için yardımcı fonksiyon
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) edu_posts RLS
alter table public.edu_posts enable row level security;

-- Table privileges (RLS'den önce gerekli)
grant usage on schema public to anon, authenticated;
grant select on public.edu_posts to anon, authenticated;
grant insert, update, delete on public.edu_posts to authenticated;

drop policy if exists edu_posts_select_published_or_admin on public.edu_posts;
drop policy if exists edu_posts_select_published on public.edu_posts;
drop policy if exists edu_posts_select_admin on public.edu_posts;
drop policy if exists edu_posts_insert_admin on public.edu_posts;
drop policy if exists edu_posts_update_admin on public.edu_posts;
drop policy if exists edu_posts_delete_admin on public.edu_posts;

create policy edu_posts_select_published
on public.edu_posts
for select
to anon, authenticated
using (published_at is not null);

create policy edu_posts_select_admin
on public.edu_posts
for select
to authenticated
using (public.is_admin());

create policy edu_posts_insert_admin
on public.edu_posts
for insert
to authenticated
with check (public.is_admin());

create policy edu_posts_update_admin
on public.edu_posts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy edu_posts_delete_admin
on public.edu_posts
for delete
to authenticated
using (public.is_admin());

-- İsteğe bağlı: mevcut kullanıcıyı admin yapmak için
-- (kendi kullanıcı id'nizi auth.users'dan alıp çalıştırın)
-- update public.profiles set role = 'admin' where id = 'YOUR_USER_UUID';

-- 3) Storage: blog-covers için güvenli policy seti
-- Not: "blog-covers" bucket public ise SELECT policy gerekmez.
-- Public URL'ler çalışır, ancak storage.objects üstünden geniş listeleme açılmaz.
update storage.buckets
set public = true
where id = 'blog-covers';

-- Eğer daha önce geniş SELECT policy açtıysanız kaldırın
drop policy if exists "Public read all objects" on storage.objects;
drop policy if exists "Anyone can read objects" on storage.objects;
drop policy if exists "Authenticated can read all objects" on storage.objects;
drop policy if exists "storage_objects_select_all" on storage.objects;

drop policy if exists "blog-covers insert admin" on storage.objects;
drop policy if exists "blog-covers update admin" on storage.objects;
drop policy if exists "blog-covers delete admin" on storage.objects;

create policy "blog-covers insert admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'blog-covers'
  and public.is_admin()
);

create policy "blog-covers update admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'blog-covers'
  and public.is_admin()
)
with check (
  bucket_id = 'blog-covers'
  and public.is_admin()
);

create policy "blog-covers delete admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'blog-covers'
  and public.is_admin()
);

-- 4) bot_trades: kullanici kendi islemlerini gorsun, admin tumunu gorebilsin
alter table public.bot_trades enable row level security;

grant select, insert on public.bot_trades to authenticated;

drop policy if exists bot_trades_select_own_or_admin on public.bot_trades;
drop policy if exists bot_trades_insert_own on public.bot_trades;

create policy bot_trades_select_own_or_admin
on public.bot_trades
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy bot_trades_insert_own
on public.bot_trades
for insert
to authenticated
with check (user_id = auth.uid());

-- 5) watchlist: her kullanıcının favorileri ayrı tutulur
alter table public.watchlist enable row level security;
grant select, insert, update, delete on public.watchlist to authenticated;

drop policy if exists watchlist_select_own_or_admin on public.watchlist;
drop policy if exists watchlist_insert_own on public.watchlist;
drop policy if exists watchlist_update_own_or_admin on public.watchlist;
drop policy if exists watchlist_delete_own_or_admin on public.watchlist;

create policy watchlist_select_own_or_admin
on public.watchlist
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy watchlist_insert_own
on public.watchlist
for insert
to authenticated
with check (user_id = auth.uid());

create policy watchlist_update_own_or_admin
on public.watchlist
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

create policy watchlist_delete_own_or_admin
on public.watchlist
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- 6) notes: kullanıcıya ve seçilen yatırım aracına bağlı kişisel notlar
-- 6) positions: her kullanicinin portfoy pozisyonlari ayridir
alter table public.positions enable row level security;
grant select, insert, update, delete on public.positions to authenticated;

drop policy if exists positions_select_own_or_admin on public.positions;
drop policy if exists positions_insert_own on public.positions;
drop policy if exists positions_update_own_or_admin on public.positions;
drop policy if exists positions_delete_own_or_admin on public.positions;

create policy positions_select_own_or_admin
on public.positions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy positions_insert_own
on public.positions
for insert
to authenticated
with check (user_id = auth.uid());

create policy positions_update_own_or_admin
on public.positions
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

create policy positions_delete_own_or_admin
on public.positions
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- 7) portfolio_wallets: satis sonrasi nakit ve cekim bakiyesi
create table if not exists public.portfolio_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cash_balance numeric not null default 0 check (cash_balance >= 0),
  withdrawn_total numeric not null default 0 check (withdrawn_total >= 0),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_wallets enable row level security;
grant select, insert, update, delete on public.portfolio_wallets to authenticated;

drop policy if exists portfolio_wallets_select_own_or_admin on public.portfolio_wallets;
drop policy if exists portfolio_wallets_insert_own on public.portfolio_wallets;
drop policy if exists portfolio_wallets_update_own_or_admin on public.portfolio_wallets;
drop policy if exists portfolio_wallets_delete_own_or_admin on public.portfolio_wallets;

create policy portfolio_wallets_select_own_or_admin
on public.portfolio_wallets
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy portfolio_wallets_insert_own
on public.portfolio_wallets
for insert
to authenticated
with check (user_id = auth.uid());

create policy portfolio_wallets_update_own_or_admin
on public.portfolio_wallets
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

create policy portfolio_wallets_delete_own_or_admin
on public.portfolio_wallets
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- 8) pending_limit_orders: limit emirler kullanici bazli bekletilir
create table if not exists public.pending_limit_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id text not null,
  symbol text not null,
  label text not null,
  market text not null,
  quantity numeric not null check (quantity > 0),
  limit_price numeric not null check (limit_price > 0),
  commission_rate numeric not null default 0 check (commission_rate >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_limit_orders_user_id
  on public.pending_limit_orders(user_id, created_at desc);

alter table public.pending_limit_orders enable row level security;
grant select, insert, update, delete on public.pending_limit_orders to authenticated;

drop policy if exists pending_limit_orders_select_own_or_admin on public.pending_limit_orders;
drop policy if exists pending_limit_orders_insert_own on public.pending_limit_orders;
drop policy if exists pending_limit_orders_update_own_or_admin on public.pending_limit_orders;
drop policy if exists pending_limit_orders_delete_own_or_admin on public.pending_limit_orders;

create policy pending_limit_orders_select_own_or_admin
on public.pending_limit_orders
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy pending_limit_orders_insert_own
on public.pending_limit_orders
for insert
to authenticated
with check (user_id = auth.uid());

create policy pending_limit_orders_update_own_or_admin
on public.pending_limit_orders
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

create policy pending_limit_orders_delete_own_or_admin
on public.pending_limit_orders
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- 9) notes: kullanıcıya ve seçilen yatırım aracına bağlı kişisel notlar
alter table public.notes enable row level security;
grant select, insert, update, delete on public.notes to authenticated;

drop policy if exists notes_select_own_or_admin on public.notes;
drop policy if exists notes_insert_own on public.notes;
drop policy if exists notes_update_own_or_admin on public.notes;
drop policy if exists notes_delete_own_or_admin on public.notes;

create policy notes_select_own_or_admin
on public.notes
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy notes_insert_own
on public.notes
for insert
to authenticated
with check (user_id = auth.uid());

create policy notes_update_own_or_admin
on public.notes
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

create policy notes_delete_own_or_admin
on public.notes
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- 10) price_alerts: kullanıcıya ve seçilen yatırım aracına bağlı alarmlar
alter table public.price_alerts enable row level security;
grant select, insert, update, delete on public.price_alerts to authenticated;

drop policy if exists price_alerts_select_own_or_admin on public.price_alerts;
drop policy if exists price_alerts_insert_own on public.price_alerts;
drop policy if exists price_alerts_update_own_or_admin on public.price_alerts;
drop policy if exists price_alerts_delete_own_or_admin on public.price_alerts;

create policy price_alerts_select_own_or_admin
on public.price_alerts
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy price_alerts_insert_own
on public.price_alerts
for insert
to authenticated
with check (user_id = auth.uid());

create policy price_alerts_update_own_or_admin
on public.price_alerts
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

create policy price_alerts_delete_own_or_admin
on public.price_alerts
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- 11) Istege bagli sifirlama (TUM kullanicilar icin)
-- Portfoy/sahip olunan varliklar ve bot islemlerini sifirlar.
-- Gerekirse bu satirlarin yorumunu kaldirip bir kez calistirin:
-- delete from public.positions;
-- delete from public.bot_trades;
-- update public.bot_state
-- set state = '{"cash":0,"initialCash":0,"positions":[],"trades":[],"equityHistory":[],"lastRunAt":null}'::jsonb,
--     updated_at = now();

-- 12) profiles: kullanici kendi kaydini gorur/gunceller, admin tum kayitlari gorur
alter table if exists public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;

drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;
drop policy if exists profiles_delete_admin on public.profiles;

create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_own_or_admin
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
)
with check (
  id = auth.uid()
  or public.is_admin()
);

create policy profiles_delete_admin
on public.profiles
for delete
to authenticated
using (public.is_admin());

-- 13) support_tickets: kullanici kendi taleplerini, admin tum talepleri gorur/yonetir
alter table if exists public.support_tickets enable row level security;
grant select, insert, update, delete on public.support_tickets to authenticated;

drop policy if exists support_tickets_select_own_or_admin on public.support_tickets;
drop policy if exists support_tickets_insert_own on public.support_tickets;
drop policy if exists support_tickets_update_own_or_admin on public.support_tickets;
drop policy if exists support_tickets_delete_own_or_admin on public.support_tickets;

create policy support_tickets_select_own_or_admin
on public.support_tickets
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy support_tickets_insert_own
on public.support_tickets
for insert
to authenticated
with check (user_id = auth.uid());

create policy support_tickets_update_own_or_admin
on public.support_tickets
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

create policy support_tickets_delete_own_or_admin
on public.support_tickets
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- 14) login_history: kullanici kendi gecmisini gorur, admin tumunu gorur
alter table if exists public.login_history enable row level security;
grant select, insert, delete on public.login_history to authenticated;

drop policy if exists login_history_select_own_or_admin on public.login_history;
drop policy if exists login_history_insert_own_or_null on public.login_history;
drop policy if exists login_history_delete_admin on public.login_history;

create policy login_history_select_own_or_admin
on public.login_history
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy login_history_insert_own_or_null
on public.login_history
for insert
to authenticated
with check (
  user_id is null
  or user_id = auth.uid()
);

create policy login_history_delete_admin
on public.login_history
for delete
to authenticated
using (public.is_admin());

-- 15) activity_logs: kullanici kendi aktivitelerini, admin tum aktiviteleri gorur
alter table if exists public.activity_logs enable row level security;
grant select, insert, delete on public.activity_logs to authenticated;

drop policy if exists activity_logs_select_own_or_admin on public.activity_logs;
drop policy if exists activity_logs_insert_own_or_null on public.activity_logs;
drop policy if exists activity_logs_delete_admin on public.activity_logs;

create policy activity_logs_select_own_or_admin
on public.activity_logs
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy activity_logs_insert_own_or_null
on public.activity_logs
for insert
to authenticated
with check (
  user_id is null
  or user_id = auth.uid()
);

create policy activity_logs_delete_admin
on public.activity_logs
for delete
to authenticated
using (public.is_admin());

-- 16) bot_wallet_transfers: bot cüzdan giriş/çıkış kayıtları (kullanıcı bazlı)
create table if not exists public.bot_wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  source text not null check (source in ('portfolio_cash', 'external_topup', 'portfolio_withdraw')),
  amount numeric not null check (amount > 0),
  fee_amount numeric not null default 0 check (fee_amount >= 0),
  net_amount numeric not null check (net_amount >= 0),
  currency text not null default 'USD',
  quote_pair text,
  quote_mode text check (quote_mode in ('bid', 'ask', 'mid')),
  exchange_rate numeric,
  converted_amount numeric,
  note text,
  created_at timestamptz not null default now()
);

alter table public.bot_wallet_transfers
  add column if not exists quote_pair text,
  add column if not exists quote_mode text,
  add column if not exists exchange_rate numeric,
  add column if not exists converted_amount numeric;

create index if not exists idx_bot_wallet_transfers_user_created_at
  on public.bot_wallet_transfers(user_id, created_at desc);

alter table if exists public.bot_wallet_transfers enable row level security;
grant select, insert, delete on public.bot_wallet_transfers to authenticated;

drop policy if exists bot_wallet_transfers_select_own_or_admin on public.bot_wallet_transfers;
drop policy if exists bot_wallet_transfers_insert_own on public.bot_wallet_transfers;
drop policy if exists bot_wallet_transfers_delete_own_or_admin on public.bot_wallet_transfers;

create policy bot_wallet_transfers_select_own_or_admin
on public.bot_wallet_transfers
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy bot_wallet_transfers_insert_own
on public.bot_wallet_transfers
for insert
to authenticated
with check (user_id = auth.uid());

create policy bot_wallet_transfers_delete_own_or_admin
on public.bot_wallet_transfers
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);
