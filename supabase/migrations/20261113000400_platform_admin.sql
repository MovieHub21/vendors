-- Platform administration: explicit admin membership, support inbox and tamper-resistant action history.

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  added_at   timestamptz not null default now(),
  added_by   uuid references auth.users (id) on delete set null
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;
grant select on public.platform_admins to service_role;

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  reason      text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id, created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_audit_log to service_role;

create table if not exists public.support_requests (
  id                 uuid primary key default gen_random_uuid(),
  requester_user_id  uuid references auth.users (id) on delete set null,
  name               text not null check (char_length(btrim(name)) between 1 and 120),
  email              text not null check (char_length(email) <= 254),
  topic              text not null check (char_length(topic) between 1 and 80),
  message            text not null check (char_length(btrim(message)) between 5 and 5000),
  status             text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_note         text not null default '' check (char_length(admin_note) <= 2000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  resolved_at        timestamptz
);
create index if not exists support_requests_status_created_idx on public.support_requests (status, created_at desc);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon, authenticated;
grant select, insert on public.support_requests to service_role;

-- All RPCs are callable only by the Edge Function service role and still check explicit admin membership.
create or replace function public.admin_platform_metrics(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'vendors', (select count(*) from public.stores),
    'published_stores', (select count(*) from public.stores where is_published and status = 'active'),
    'suspended_stores', (select count(*) from public.stores where status = 'suspended'),
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active' and current_period_end > now()),
    'expired_subscriptions', (select count(*) from public.subscriptions where status <> 'active' or current_period_end <= now()),
    'orders_this_month', (select count(*) from public.orders where created_at >= date_trunc('month', now())),
    'payments_last_30_days', (select count(*) from public.payments where created_at >= now() - interval '30 days'),
    'open_support_requests', (select count(*) from public.support_requests where status in ('open', 'in_progress'))
  );
end;
$$;

create or replace function public.admin_search_vendors(p_actor uuid, p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  store_id uuid, owner_id uuid, store_name text, slug text, category text, store_status text,
  is_published boolean, store_created_at timestamptz, full_name text, email text,
  subscription_status text, plan_code text, current_period_end timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return query
    select s.id, s.owner_id, s.name, s.slug, s.category, s.status, s.is_published, s.created_at,
           coalesce(pr.full_name, ''), u.email::text, sub.status, sub.plan_code, sub.current_period_end
      from public.stores s
      join auth.users u on u.id = s.owner_id
      left join public.profiles pr on pr.id = s.owner_id
      left join public.subscriptions sub on sub.owner_id = s.owner_id
     where coalesce(p_search, '') = ''
        or s.name ilike '%' || p_search || '%'
        or s.slug ilike '%' || p_search || '%'
        or s.category ilike '%' || p_search || '%'
        or coalesce(pr.full_name, '') ilike '%' || p_search || '%'
        or coalesce(u.email, '') ilike '%' || p_search || '%'
     order by s.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.admin_set_store_status(p_actor uuid, p_store_id uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.stores;
  previous_status text;
begin
  if not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('active', 'suspended') or char_length(btrim(coalesce(p_reason, ''))) < 5 or char_length(p_reason) > 1000 then
    raise exception 'invalid_admin_action' using errcode = '22023';
  end if;
  select status into previous_status from public.stores where id = p_store_id for update;
  if not found then raise exception 'store_not_found' using errcode = 'P0002'; end if;
  update public.stores set status = p_status where id = p_store_id returning * into target;
  if not found then raise exception 'store_not_found' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, reason, details)
  values (p_actor, case when p_status = 'suspended' then 'store_suspended' else 'store_reactivated' end,
          'store', target.id::text, btrim(p_reason), jsonb_build_object('store_name', target.name, 'slug', target.slug, 'previous_status', previous_status, 'status', target.status));
  return jsonb_build_object('store_id', target.id, 'status', target.status);
end;
$$;

create or replace function public.admin_update_support_request(p_actor uuid, p_request_id uuid, p_status text, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket public.support_requests;
  previous_status text;
begin
  if not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('open', 'in_progress', 'resolved', 'closed') or char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'invalid_admin_action' using errcode = '22023';
  end if;
  select status into previous_status from public.support_requests where id = p_request_id for update;
  if not found then raise exception 'support_request_not_found' using errcode = 'P0002'; end if;
  update public.support_requests
     set status = p_status,
         admin_note = coalesce(p_note, ''),
         resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
         updated_at = now()
   where id = p_request_id returning * into ticket;
  if not found then raise exception 'support_request_not_found' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, reason, details)
  values (p_actor, 'support_request_updated', 'support_request', ticket.id::text,
          case when btrim(coalesce(p_note, '')) = '' then 'Support request status updated' else btrim(p_note) end,
          jsonb_build_object('previous_status', previous_status, 'status', ticket.status));
  return jsonb_build_object('id', ticket.id, 'status', ticket.status, 'updated_at', ticket.updated_at);
end;
$$;

revoke all on function public.admin_platform_metrics(uuid) from public, anon, authenticated;
revoke all on function public.admin_search_vendors(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_set_store_status(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_update_support_request(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_platform_metrics(uuid) to service_role;
grant execute on function public.admin_search_vendors(uuid, text, integer, integer) to service_role;
grant execute on function public.admin_set_store_status(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_update_support_request(uuid, uuid, text, text) to service_role;
