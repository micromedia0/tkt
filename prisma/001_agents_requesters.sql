begin;

-- Users are requester profiles. Backoffice identities are copied to agents.
create table if not exists public.agents (
  id uuid primary key,
  auth_user_id uuid unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'agent' check (role in ('superadmin', 'agent')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.agents (id, auth_user_id, organization_id, name, email, role, active)
select om.user_id, om.user_id, om.organization_id, coalesce(u.name, u.email), u.email,
       case when om.role::text in ('ADMIN', 'SUPERADMIN') then 'superadmin' else 'agent' end,
       om.active
from public.organization_members om
join public.users u on u.id = om.user_id
on conflict (id) do update set
  organization_id = excluded.organization_id,
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.areas add column if not exists description text;
alter table public.areas add column if not exists color text;
alter table public.areas add column if not exists updated_at timestamptz not null default now();

-- Rebuild the old assignment table while preserving existing assignments.
create table if not exists public.agent_areas_new (
  agent_id uuid not null references public.agents(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, area_id)
);

insert into public.agent_areas_new (agent_id, area_id)
select aa.user_id, aa.area_id
from public.agent_areas aa
join public.agents a on a.id = aa.user_id
on conflict do nothing;

drop table if exists public.agent_areas;
alter table public.agent_areas_new rename to agent_areas;
create index if not exists agent_areas_area_id_idx on public.agent_areas(area_id);

alter table public.tickets add column if not exists requester_id uuid references public.users(id) on delete set null;
create index if not exists tickets_requester_id_idx on public.tickets(requester_id);

-- Existing ticket assignments used the old users.id. Agent ids intentionally
-- reuse that id during the migration, so old assignments keep working.
alter table public.tickets drop constraint if exists tickets_assigned_to_id_fkey;
alter table public.tickets add constraint tickets_assigned_to_id_fkey
  foreign key (assigned_to_id) references public.agents(id) on delete set null;

commit;
