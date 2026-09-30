-- Taskboard core schema. Every row belongs to the authenticated owner.
create extension if not exists pgcrypto;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Completed', 'Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id, name)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  status text not null default 'To Do' check (status in ('To Do', 'In Progress', 'Blocked', 'Done', 'Archived')),
  assignee text,
  due_date date,
  notes text,
  priority smallint not null default 3 check (priority in (1, 2, 3)),
  in_focus boolean not null default false,
  focus_note text,
  estimated_minutes integer check (estimated_minutes is null or (estimated_minutes between 15 and 480 and estimated_minutes % 15 = 0)),
  logged_minutes integer not null default 0 check (logged_minutes >= 0),
  time_block text check (time_block is null or time_block in ('Morning', 'Afternoon', 'Late')),
  paymo_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_user_id_idx on public.clients(user_id);
create index projects_user_status_idx on public.projects(user_id, status);
create index projects_client_id_idx on public.projects(client_id);
create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_user_focus_priority_idx on public.tasks(user_id, in_focus, priority) where in_focus and status not in ('Done', 'Archived');
create index tasks_paymo_id_idx on public.tasks(paymo_id) where paymo_id is not null;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

create policy "Users manage own clients" on public.clients for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own projects" on public.projects for all to authenticated using (
  user_id = auth.uid() and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
) with check (
  user_id = auth.uid() and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
);
create policy "Users manage own tasks" on public.tasks for all to authenticated using (
  user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
) with check (
  user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
);
