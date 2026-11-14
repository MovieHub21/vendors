-- Explicit platform-admin hierarchy. Existing admin accounts retain full access as super admins.
alter table public.platform_admins
  add column if not exists role text not null default 'super_admin' check (role in ('super_admin', 'admin')),
  add column if not exists permissions text[] not null default '{}'::text[] check (
    permissions <@ array['overview', 'vendors', 'payments', 'support', 'activity']::text[]
  );

create index if not exists platform_admins_role_idx on public.platform_admins (role);

create or replace function public.admin_list_memberships(p_actor uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  permissions text[],
  added_at timestamptz,
  added_by uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins a where a.user_id = p_actor and a.role = 'super_admin') then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;
  return query
    select a.user_id, u.email::text, a.role, a.permissions, a.added_at, a.added_by
      from public.platform_admins a
      join auth.users u on u.id = a.user_id
     order by case when a.role = 'super_admin' then 0 else 1 end, lower(u.email);
end;
$$;

create or replace function public.admin_manage_membership(
  p_actor uuid,
  p_operation text,
  p_email text,
  p_permissions text[] default '{}'::text[],
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  target_email text;
  prior_permissions text[];
begin
  if not exists (select 1 from public.platform_admins a where a.user_id = p_actor and a.role = 'super_admin') then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;
  if p_operation is null or p_operation not in ('add', 'update_permissions', 'remove')
     or char_length(btrim(coalesce(p_reason, ''))) < 5
     or char_length(coalesce(p_reason, '')) > 1000 then
    raise exception 'invalid_admin_action' using errcode = '22023';
  end if;
  if p_operation in ('add', 'update_permissions') and (
    coalesce(cardinality(p_permissions), 0) = 0
    or not coalesce(p_permissions <@ array['overview', 'vendors', 'payments', 'support', 'activity']::text[], false)
  ) then
    raise exception 'invalid_admin_permissions' using errcode = '22023';
  end if;

  select u.id, u.email::text into target_user_id, target_email
    from auth.users u
   where lower(u.email) = lower(btrim(coalesce(p_email, '')))
   limit 1;
  if target_user_id is null then raise exception 'admin_user_not_found' using errcode = 'P0002'; end if;

  if p_operation = 'add' then
    if exists (select 1 from public.platform_admins a where a.user_id = target_user_id) then
      raise exception 'admin_already_exists' using errcode = '23505';
    end if;
    insert into public.platform_admins(user_id, role, permissions, added_by)
    values (target_user_id, 'admin', p_permissions, p_actor);
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, reason, details)
    values (p_actor, 'admin_added', 'admin', target_user_id::text, btrim(p_reason),
            jsonb_build_object('email', target_email, 'permissions', p_permissions));
    return jsonb_build_object('user_id', target_user_id, 'email', target_email, 'role', 'admin', 'permissions', p_permissions);
  end if;

  select a.permissions into prior_permissions
    from public.platform_admins a
   where a.user_id = target_user_id and a.role = 'admin'
   for update;
  if not found then raise exception 'admin_account_not_found' using errcode = 'P0002'; end if;

  if p_operation = 'update_permissions' then
    update public.platform_admins set permissions = p_permissions, added_by = p_actor where user_id = target_user_id;
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, reason, details)
    values (p_actor, 'admin_permissions_updated', 'admin', target_user_id::text, btrim(p_reason),
            jsonb_build_object('email', target_email, 'previous_permissions', prior_permissions, 'permissions', p_permissions));
    return jsonb_build_object('user_id', target_user_id, 'email', target_email, 'role', 'admin', 'permissions', p_permissions);
  end if;

  delete from public.platform_admins where user_id = target_user_id and role = 'admin';
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, reason, details)
  values (p_actor, 'admin_removed', 'admin', target_user_id::text, btrim(p_reason),
          jsonb_build_object('email', target_email, 'previous_permissions', prior_permissions));
  return jsonb_build_object('user_id', target_user_id, 'email', target_email, 'removed', true);
end;
$$;

revoke all on function public.admin_list_memberships(uuid) from public, anon, authenticated;
revoke all on function public.admin_manage_membership(uuid, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.admin_list_memberships(uuid) to service_role;
grant execute on function public.admin_manage_membership(uuid, text, text, text[], text) to service_role;
