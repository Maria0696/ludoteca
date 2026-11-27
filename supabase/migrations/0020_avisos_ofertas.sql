-- Notificaciones de ofertas: dos veces al día, una tarea de GitHub llama a la app con una clave propia; la app mira los
-- precios de los deseos con objetivo y manda una notificación al móvil si alguno baja a él
-- (ver docs/superpowers/specs/2026-11-27-avisos-ofertas-design.md). Como en las copias automáticas (0018), aquí solo se
-- guarda la huella SHA-256 de la clave, con un «insert» aparte que no queda en el repositorio.

-- Los dispositivos donde la propietaria ha activado los avisos (la suscripción de su navegador).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "solo la propietaria" on public.push_subscriptions;
create policy "solo la propietaria" on public.push_subscriptions for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_owner()))
  with check (owner_id = (select auth.uid()) and (select public.is_owner()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- La huella de la clave de los avisos. Una sola fila, sin políticas: solo la usan las funciones de abajo.
create table if not exists public.alerts_key (
  id boolean primary key default true check (id),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.alerts_key enable row level security;
revoke all on public.alerts_key from anon, authenticated;

create or replace function public.clave_de_avisos_valida(clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.alerts_key
    where key_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(clave, ''), 'UTF8')), 'hex')
  );
$$;
revoke all on function public.clave_de_avisos_valida(text) from public, anon, authenticated;

-- Los ids de la propietaria (normalmente uno).
create or replace function public.ids_de_la_propietaria()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(u.id), '{}')
  from auth.users u
  join public.app_owner o on lower(u.email) = lower(o.email);
$$;
revoke all on function public.ids_de_la_propietaria() from public, anon, authenticated;

-- Los deseos que vigilar (propios, con objetivo y enlazados a alguna tienda) y dónde avisar.
create or replace function public.deseos_vigilados(clave text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owners uuid[];
begin
  if not public.clave_de_avisos_valida(clave) then
    raise exception 'clave no válida' using errcode = '28000';
  end if;
  owners := public.ids_de_la_propietaria();
  return jsonb_build_object(
    'wishes', coalesce((
      select jsonb_agg(to_jsonb(w)) from public.wishlist w
      where w.owner_id = any (owners) and not w.demo and w.target_price is not null
        and (w.eshop_nsuid is not null or w.steam_app_id is not null)
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.push_subscriptions s where s.owner_id = any (owners)
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.deseos_vigilados(text) from public;
grant execute on function public.deseos_vigilados(text) to anon, authenticated;

-- Apunta los precios nuevos: `cambios` es [{id, prices}], el historial entero de cada deseo.
create or replace function public.apuntar_precios(clave text, cambios jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.clave_de_avisos_valida(clave) then
    raise exception 'clave no válida' using errcode = '28000';
  end if;
  if jsonb_typeof(cambios) <> 'array' then
    raise exception 'cambios no válidos' using errcode = '22023';
  end if;
  update public.wishlist w
  set prices = c.value -> 'prices', updated_at = now()
  from jsonb_array_elements(cambios) c
  where w.id = (c.value ->> 'id')::uuid
    and jsonb_typeof(c.value -> 'prices') = 'array'
    and w.owner_id = any (public.ids_de_la_propietaria());
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.apuntar_precios(text, jsonb) from public;
grant execute on function public.apuntar_precios(text, jsonb) to anon, authenticated;

-- Quita una suscripción que el servicio de notificaciones da por caducada (404 o 410).
create or replace function public.quitar_suscripcion(clave text, endpoint text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.clave_de_avisos_valida(clave) then
    raise exception 'clave no válida' using errcode = '28000';
  end if;
  delete from public.push_subscriptions s where s.endpoint = quitar_suscripcion.endpoint;
end;
$$;
revoke all on function public.quitar_suscripcion(text, text) from public;
grant execute on function public.quitar_suscripcion(text, text) to anon, authenticated;
