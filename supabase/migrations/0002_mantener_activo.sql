-- Ludoteca: consulta mínima para que el plan gratuito no pause el proyecto.
-- Supabase pausa los proyectos gratuitos con poca actividad en 7 días.
-- La tarea de GitHub «Mantener Supabase activo» llama a esta función
-- varias veces al día. Solo devuelve 1: no lee ninguna tabla ni dato.

create or replace function public.ping()
returns integer
language sql
stable
set search_path = ''
as $$
  select 1;
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
