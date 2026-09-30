-- Stable external identifiers make the Paymo hierarchy safe to re-sync.
alter table public.clients add column paymo_id text unique;
alter table public.projects add column paymo_id text unique;
create index clients_paymo_id_idx on public.clients(paymo_id) where paymo_id is not null;
create index projects_paymo_id_idx on public.projects(paymo_id) where paymo_id is not null;
