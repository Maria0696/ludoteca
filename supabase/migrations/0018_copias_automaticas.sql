-- Copias automáticas: cada noche, una tarea de GitHub pide la copia con una clave propia
-- (ver docs/superpowers/specs/2026-11-27-copias-automaticas-design.md). Aquí no se guarda la clave, solo su huella
-- SHA-256: aunque alguien leyera la base de datos, no podría sacarla. Se pone con un «insert» aparte, fuera de este
-- archivo, para que la huella no quede en el repositorio.

-- La huella de la clave. Una sola fila.
create table if not exists public.backup_key (
  id boolean primary key default true check (id),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.backup_key enable row level security;
-- Sin políticas: nadie la lee ni la cambia desde la API. Solo la usan las funciones de abajo.
revoke all on public.backup_key from anon, authenticated;

-- Cuándo se hizo la última copia. Una sola fila; la propietaria la lee para Ajustes y el aviso de Inicio.
create table if not exists public.backup_runs (
  id boolean primary key default true check (id),
  last_at timestamptz not null
);
alter table public.backup_runs enable row level security;
drop policy if exists "la propietaria la lee" on public.backup_runs;
create policy "la propietaria la lee" on public.backup_runs for select to authenticated using ((select public.is_owner()));
revoke all on public.backup_runs from anon, authenticated;
grant select on public.backup_runs to authenticated;

-- Si la clave es la buena. Solo la llaman las funciones de abajo.
create or replace function public.clave_de_copia_valida(clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.backup_key
    where key_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(clave, ''), 'UTF8')), 'hex')
  );
$$;
revoke all on function public.clave_de_copia_valida(text) from public, anon, authenticated;

-- La copia: las filas de la propietaria de cada tabla, solo con la clave. La tarea de GitHub la llama sin sesión
-- (a través de la app), así que la puede ejecutar el rol anónimo: la protege la clave.
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
    'year_wraps', coalesce((select jsonb_agg(to_jsonb(t)) from public.year_wraps t where t.owner_id = any (owners)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.copia_de_seguridad(text) from public;
grant execute on function public.copia_de_seguridad(text) to anon, authenticated;

-- Apunta que la copia de esta noche ya está guardada. También solo con la clave.
create or replace function public.copia_hecha(clave text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.clave_de_copia_valida(clave) then
    raise exception 'clave no válida' using errcode = '28000';
  end if;
  insert into public.backup_runs (id, last_at) values (true, now())
  on conflict (id) do update set last_at = excluded.last_at;
end;
$$;
revoke all on function public.copia_hecha(text) from public;
grant execute on function public.copia_hecha(text) to anon, authenticated;
