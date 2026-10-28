-- Gilyon Haarachah (YYT): run once in the Supabase SQL editor.
-- Access is only for people listed in gilyon_users.

create extension if not exists pgcrypto with schema extensions;

-- 1) Who can use the app, and their role
create table if not exists public.gilyon_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  role text not null default 'view' check (role in ('admin','view')),
  active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

-- 2) All school data in one row ('main'); changes are merged by gilyon_apply()
create table if not exists public.gilyon_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- 3) Letterhead image
create table if not exists public.gilyon_assets (
  id text primary key,
  data text not null,
  updated_at timestamptz not null default now()
);

-- 4) Claude API key for scanning (Admins only)
create table if not exists public.gilyon_secrets (
  id text primary key,
  data jsonb not null default '{}'::jsonb
);

-- 5) Audit log – everyone sees only their own changes
create table if not exists public.gilyon_audit (
  id text primary key,
  user_email text not null,
  ts bigint not null,
  data jsonb not null
);
create index if not exists gilyon_audit_user_ts on public.gilyon_audit (user_email, ts desc);

-- Signed-in person's role (null = no access)
create or replace function public.gilyon_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.gilyon_users
  where lower(email) = lower(coalesce(auth.jwt()->>'email','')) and active
  limit 1
$$;
create or replace function public.gilyon_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;

create or replace function public.gilyon_touch_login() returns void
language sql security definer set search_path = public as $$
  update public.gilyon_users set last_login = now() where lower(email) = public.gilyon_email()
$$;

-- Merges a list of changes into the data row (Admins only)
-- each op: {p:[path...], had, v?}  – had=false removes that place
create or replace function public.gilyon_apply(ops jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare d jsonb; o jsonb; v bigint; path text[]; n int; i int;
begin
  if coalesce(public.gilyon_role(),'') <> 'admin' then raise exception 'Only an Admin can change data'; end if;
  insert into public.gilyon_state (id) values ('main') on conflict (id) do nothing;
  select data, version into d, v from public.gilyon_state where id = 'main' for update;
  for o in select * from jsonb_array_elements(coalesce(ops,'[]'::jsonb)) loop
    select array_agg(x) into path from jsonb_array_elements_text(o->'p') as x;
    n := coalesce(array_length(path,1),0);
    continue when n = 0;
    for i in 1..n-1 loop
      if coalesce(jsonb_typeof(d #> path[1:i]),'') not in ('object','array') then d := jsonb_set(d, path[1:i], '{}'::jsonb, true); end if;
    end loop;
    if coalesce((o->>'had')::boolean, false) then d := jsonb_set(d, path, coalesce(o->'v','null'::jsonb), true);
    else d := d #- path; end if;
  end loop;
  v := v + 1;
  update public.gilyon_state set data = d, version = v, updated_at = now(), updated_by = public.gilyon_email() where id = 'main';
  return v;
end $$;

-- Dashboard limits: anyone with access may change them (the principal uses a View login)
create or replace function public.gilyon_set_dash(v jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare ver bigint; k text;
begin
  if public.gilyon_role() is null then raise exception 'No access'; end if;
  if jsonb_typeof(v) <> 'object' then raise exception 'Bad limits'; end if;
  for k in select jsonb_object_keys(v) loop
    if k not in ('absences','lates','low','high','change') or jsonb_typeof(v->k) <> 'number' then raise exception 'Bad limit %', k; end if;
  end loop;
  insert into public.gilyon_state (id) values ('main') on conflict (id) do nothing;
  update public.gilyon_state set data = jsonb_set(data, '{dashboardThresholds}', coalesce(data->'dashboardThresholds','{}'::jsonb) || v, true),
    version = version + 1, updated_at = now(), updated_by = public.gilyon_email()
  where id = 'main' returning version into ver;
  return ver;
end $$;
revoke all on function public.gilyon_set_dash(jsonb) from public, anon;
grant execute on function public.gilyon_set_dash(jsonb) to authenticated;

-- Admin adds a person with a password (creates their login, no email needed)
create or replace function public.gilyon_admin_create_user(new_email text, new_password text, new_role text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid; e text := lower(trim(new_email));
begin
  if coalesce(public.gilyon_role(),'') <> 'admin' then raise exception 'Only an Admin can add users'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if length(coalesce(new_password,'')) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  if new_role not in ('admin','view') then raise exception 'Unknown role'; end if;
  insert into public.gilyon_users (email, role) values (e, new_role)
    on conflict (email) do update set role = excluded.role, active = true;
  select id into uid from auth.users where lower(email) = e limit 1;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', e,
      extensions.crypt(new_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', e, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = uid;
  end if;
end $$;

-- Admin sets another person's password
create or replace function public.gilyon_admin_set_password(target_email text, new_password text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if coalesce(public.gilyon_role(),'') <> 'admin' then raise exception 'Only an Admin can set passwords'; end if;
  if length(coalesce(new_password,'')) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  if not exists (select 1 from public.gilyon_users g where lower(g.email) = lower(target_email)) then raise exception 'This person is not a user of the app'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
  where lower(email) = lower(target_email);
  if not found then raise exception 'This user has no login yet. Disable and add them again with a password.'; end if;
end $$;

revoke all on function public.gilyon_role() from public, anon;
revoke all on function public.gilyon_touch_login() from public, anon;
revoke all on function public.gilyon_apply(jsonb) from public, anon;
revoke all on function public.gilyon_admin_create_user(text, text, text) from public, anon;
revoke all on function public.gilyon_admin_set_password(text, text) from public, anon;
grant execute on function public.gilyon_role() to authenticated;
grant execute on function public.gilyon_email() to authenticated;
grant execute on function public.gilyon_touch_login() to authenticated;
grant execute on function public.gilyon_apply(jsonb) to authenticated;
grant execute on function public.gilyon_admin_create_user(text, text, text) to authenticated;
grant execute on function public.gilyon_admin_set_password(text, text) to authenticated;

revoke all on public.gilyon_users, public.gilyon_state, public.gilyon_assets, public.gilyon_secrets, public.gilyon_audit from anon;
grant usage on schema public to authenticated;
grant select, update on public.gilyon_users to authenticated;
grant select on public.gilyon_state to authenticated;
grant select, insert, update, delete on public.gilyon_assets to authenticated;
grant select, insert, update on public.gilyon_secrets to authenticated;
grant select, insert, update, delete on public.gilyon_audit to authenticated;

alter table public.gilyon_users enable row level security;
alter table public.gilyon_state enable row level security;
alter table public.gilyon_assets enable row level security;
alter table public.gilyon_secrets enable row level security;
alter table public.gilyon_audit enable row level security;

-- users: everyone sees their own row; Admins see and change everyone
drop policy if exists gilyon_users_select on public.gilyon_users;
create policy gilyon_users_select on public.gilyon_users for select to authenticated
  using (lower(email) = public.gilyon_email() or public.gilyon_role() = 'admin');
drop policy if exists gilyon_users_update on public.gilyon_users;
create policy gilyon_users_update on public.gilyon_users for update to authenticated
  using (public.gilyon_role() = 'admin') with check (public.gilyon_role() = 'admin');

-- data: every active user can read; changes only through gilyon_apply (Admins)
drop policy if exists gilyon_state_select on public.gilyon_state;
create policy gilyon_state_select on public.gilyon_state for select to authenticated
  using (public.gilyon_role() is not null);

-- letterhead: everyone reads, Admins change
drop policy if exists gilyon_assets_select on public.gilyon_assets;
create policy gilyon_assets_select on public.gilyon_assets for select to authenticated using (public.gilyon_role() is not null);
drop policy if exists gilyon_assets_write on public.gilyon_assets;
create policy gilyon_assets_write on public.gilyon_assets for all to authenticated
  using (public.gilyon_role() = 'admin') with check (public.gilyon_role() = 'admin');

-- AI key: Admins only
drop policy if exists gilyon_secrets_all on public.gilyon_secrets;
create policy gilyon_secrets_all on public.gilyon_secrets for all to authenticated
  using (public.gilyon_role() = 'admin') with check (public.gilyon_role() = 'admin');

-- audit: own rows only
drop policy if exists gilyon_audit_own on public.gilyon_audit;
create policy gilyon_audit_own on public.gilyon_audit for all to authenticated
  using (public.gilyon_role() is not null and lower(user_email) = public.gilyon_email())
  with check (public.gilyon_role() is not null and lower(user_email) = public.gilyon_email());

insert into public.gilyon_state (id) values ('main') on conflict (id) do nothing;
