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

-- 5) Istege bagli sifirlama (TUM kullanicilar icin)
-- Portfoy/sahip olunan varliklar ve bot islemlerini sifirlar.
-- Gerekirse bu satirlarin yorumunu kaldirip bir kez calistirin:
-- delete from public.positions;
-- delete from public.bot_trades;
-- update public.bot_state
-- set state = '{"cash":0,"initialCash":0,"positions":[],"trades":[],"equityHistory":[],"lastRunAt":null}'::jsonb,
--     updated_at = now();
