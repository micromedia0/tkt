begin;

-- Final cleanup after migrating backoffice identities to public.agents.
-- Policies must be recreated against agents before the legacy table is removed.
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and policyname like 'admin_%'
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

drop table if exists public.organization_members;

commit;
