-- Ludoteca: esquema inicial.
-- Ejecuta este archivo en el editor SQL de Supabase (o con `supabase db push`).
-- Después, sustituye el correo de la última instrucción por el tuyo.

-- Propietaria única. Las políticas solo dejan pasar a la persona cuyo
-- correo figura aquí, aunque alguien más llegara a tener una cuenta.
create table if not exists public.app_owner (
  email text primary key
);
alter table public.app_owner enable row level security;
-- Sin políticas: nadie puede leerla ni cambiarla desde la API pública.

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_owner
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create table if not exists public.games (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  cover_url text,
  backdrop_url text,
  igdb_id integer,
  genres text[] not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'pendiente'
    check (status in ('pendiente', 'jugando', 'pausado', 'completado', 'abandonado')),
  completed_100 boolean not null default false,
  favorite boolean not null default false,
  rating numeric(3, 1) check (rating between 0 and 10),
  hours_played numeric(8, 1) check (hours_played >= 0),
  notes text,
  started_at date,
  finished_at date,
  last_played_at date,
  modes text[] not null default '{}',
  moods text[] not null default '{}',
  session_minutes integer check (session_minutes between 1 and 1440),
  length_hours numeric(8, 1) check (length_hours >= 0),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.copies (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  platform text not null,
  edition text,
  format text not null check (format in ('fisico', 'digital')),
  availability text not null default 'comprado' check (availability in ('comprado', 'prestado', 'suscripcion')),
  subscription_service text,
  acquired_at date,
  price_paid numeric(8, 2) check (price_paid >= 0),
  store text,
  has_case boolean,
  has_full_artwork boolean,
  artwork_print_pending boolean,
  artwork_url text,
  shelf_location text,
  lent_to text,
  lent_at date,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists copies_game_id_idx on public.copies (game_id);

create table if not exists public.wishlist (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  cover_url text,
  igdb_id integer,
  platform text,
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  target_price numeric(8, 2) check (target_price >= 0),
  notes text,
  genres text[] not null default '{}',
  prices jsonb not null default '[]',
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lists (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  game_ids uuid[] not null default '{}',
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seguridad por filas: cada registro pertenece a quien lo crea y solo la
-- propietaria registrada en app_owner puede leer o escribir.
do $$
declare t text;
begin
  foreach t in array array['games', 'copies', 'wishlist', 'lists'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo la propietaria" on public.%I', t);
    execute format(
      'create policy "solo la propietaria" on public.%I for all to authenticated
         using (owner_id = auth.uid() and public.is_owner())
         with check (owner_id = auth.uid() and public.is_owner())', t);
  end loop;
end $$;

-- Permisos explícitos para la Data API: solo usuarios con sesión iniciada
-- llegan a las tablas (y la seguridad por filas decide qué filas ven).
-- Las visitas anónimas no reciben ningún permiso. Así funciona aunque el
-- proyecto no exponga las tablas nuevas automáticamente.
revoke all on public.games, public.copies, public.wishlist, public.lists, public.app_owner from anon;
revoke all on public.app_owner from authenticated;
grant select, insert, update, delete on public.games, public.copies, public.wishlist, public.lists to authenticated;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- Cambia este correo por el de tu cuenta antes de ejecutar.
insert into public.app_owner (email) values ('tu-correo@ejemplo.com')
on conflict do nothing;
