-- SellSharp · 0000 · shared helpers
-- Safe to re-run. Run the migration files in filename order in the Supabase SQL Editor.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
