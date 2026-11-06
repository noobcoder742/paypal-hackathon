-- Wedding Studio: one key-value table for the server (demo data, 30-day expiry).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Only the server uses it, with the service role key; row-level security stays on with no
-- policies, so the public (anon) key can't read or write anything.

create table if not exists public.kv (
  key        text primary key,
  value      jsonb not null,
  expires_at timestamptz not null
);
create index if not exists kv_expires_at on public.kv (expires_at);
alter table public.kv enable row level security;

-- Atomic counter for rate limits: adds p_by, starting a fresh window when the old one expired.
create or replace function public.kv_incr(p_key text, p_by numeric, p_ttl integer)
returns table (n numeric, expires_in integer)
language plpgsql
as $$
begin
  insert into public.kv as t (key, value, expires_at)
  values (p_key, to_jsonb(p_by), now() + make_interval(secs => p_ttl))
  on conflict (key) do update
    set value = case when t.expires_at > now() then to_jsonb((t.value)::text::numeric + p_by) else to_jsonb(p_by) end,
        expires_at = case when t.expires_at > now() then t.expires_at else now() + make_interval(secs => p_ttl) end;
  return query
    select (k.value)::text::numeric, greatest(0, ceil(extract(epoch from (k.expires_at - now()))))::integer
    from public.kv k where k.key = p_key;
end;
$$;

-- Tidy up expired rows now and then (optional; expired rows are ignored anyway).
create or replace function public.kv_cleanup() returns void language sql as $$
  delete from public.kv where expires_at < now();
$$;
