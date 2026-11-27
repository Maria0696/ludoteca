-- Logros de Steam (ver docs/superpowers/specs/2026-11-27-logros-steam-design.md): los logros de cada juego de la
-- biblioteca, tal como se miraron la última vez, y el perfil de Steam para mirarlos. La app los pide a Steam una vez al
-- día; aquí solo se guardan.

-- Los logros de un juego: una fila por juego, con la lista entera en `items`.
create table if not exists public.achievements (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id uuid not null unique references public.games (id) on delete cascade,
  steam_app_id integer not null check (steam_app_id > 0),
  total integer not null default 0 check (total >= 0),
  unlocked integer not null default 0 check (unlocked >= 0 and unlocked <= total),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists achievements_owner_idx on public.achievements (owner_id);

-- Ajustes que viajan con la biblioteca: una fila por propietaria. De momento, el perfil de Steam (17 cifras).
create table if not exists public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  steam_id text check (steam_id ~ '^\d{17}$'),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['achievements', 'user_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo la propietaria" on public.%I', t);
    execute format(
      'create policy "solo la propietaria" on public.%I for all to authenticated
         using (owner_id = (select auth.uid()) and (select public.is_owner()))
         with check (owner_id = (select auth.uid()) and (select public.is_owner()))', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- La copia automática (0018) trae también los logros y el perfil.
create or replace function public.copia_de_seguridad(clave text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owners uuid[];
begin
  if not public.clave_de_copia_valida(clave) then
    raise exception 'clave no válida' using errcode = '28000';
  end if;
  select coalesce(array_agg(u.id), '{}') into owners
  from auth.users u
  join public.app_owner o on lower(u.email) = lower(o.email);
  return jsonb_build_object(
    'games', coalesce((select jsonb_agg(to_jsonb(t)) from public.games t where t.owner_id = any (owners)), '[]'::jsonb),
    'copies', coalesce((select jsonb_agg(to_jsonb(t)) from public.copies t where t.owner_id = any (owners)), '[]'::jsonb),
    'wishlist', coalesce((select jsonb_agg(to_jsonb(t)) from public.wishlist t where t.owner_id = any (owners)), '[]'::jsonb),
    'saga_extras', coalesce((select jsonb_agg(to_jsonb(t)) from public.saga_extras t where t.owner_id = any (owners)), '[]'::jsonb),
    'year_wraps', coalesce((select jsonb_agg(to_jsonb(t)) from public.year_wraps t where t.owner_id = any (owners)), '[]'::jsonb),
    'achievements', coalesce((select jsonb_agg(to_jsonb(t)) from public.achievements t where t.owner_id = any (owners)), '[]'::jsonb),
    'user_settings', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_settings t where t.owner_id = any (owners)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.copia_de_seguridad(text) from public;
grant execute on function public.copia_de_seguridad(text) to anon, authenticated;
