-- Juegos de una saga que no tienes: los metes a mano (buscándolos en IGDB) para verlos en su sitio del mapa.
create table if not exists public.saga_extras (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  series text not null check (char_length(series) between 1 and 200),
  igdb_id integer,
  title text not null check (char_length(title) between 1 and 200),
  cover_url text,
  release_date date,
  series_order integer check (series_order between 1 and 10000),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La misma seguridad que el resto: cada fila es de quien la crea y solo la propietaria lee o escribe.
alter table public.saga_extras enable row level security;
drop policy if exists "solo la propietaria" on public.saga_extras;
create policy "solo la propietaria" on public.saga_extras for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_owner()))
  with check (owner_id = (select auth.uid()) and (select public.is_owner()));

create index if not exists saga_extras_owner_id_idx on public.saga_extras (owner_id);

revoke all on public.saga_extras from anon;
grant select, insert, update, delete on public.saga_extras to authenticated;
