-- Anuario: los años congelados, uno por año. «data» es el resumen tal como era al cerrarlo (ver computeYear).
create table if not exists public.year_wraps (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year integer not null check (year between 1970 and 2200),
  data jsonb not null,
  frozen_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, year)
);

-- La misma seguridad que el resto: cada fila es de quien la crea y solo la propietaria lee o escribe.
alter table public.year_wraps enable row level security;
drop policy if exists "solo la propietaria" on public.year_wraps;
create policy "solo la propietaria" on public.year_wraps for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_owner()))
  with check (owner_id = (select auth.uid()) and (select public.is_owner()));

create index if not exists year_wraps_owner_id_idx on public.year_wraps (owner_id);

revoke all on public.year_wraps from anon;
grant select, insert, update, delete on public.year_wraps to authenticated;
