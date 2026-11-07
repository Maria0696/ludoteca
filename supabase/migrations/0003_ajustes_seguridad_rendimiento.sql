-- Ludoteca: ajustes recomendados por los avisos de Supabase.

-- 1. Supabase crea al iniciar el proyecto rls_auto_enable(), que activa la
--    seguridad por filas en cada tabla nueva. Solo debe ejecutarse como
--    disparador de eventos, así que nadie necesita permiso para llamarla
--    desde la API (el disparador sigue funcionando sin ese permiso).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 2. Las reglas comprueban quién eres una sola vez por consulta y no en
--    cada fila: (select ...) hace que Postgres lo calcule al principio.
do $$
declare t text;
begin
  foreach t in array array['games', 'copies', 'wishlist', 'lists'] loop
    execute format('drop policy if exists "solo la propietaria" on public.%I', t);
    execute format(
      'create policy "solo la propietaria" on public.%I for all to authenticated
         using (owner_id = (select auth.uid()) and (select public.is_owner()))
         with check (owner_id = (select auth.uid()) and (select public.is_owner()))', t);
  end loop;
end $$;

-- 3. Índices para filtrar por propietaria y para borrar en cascada.
create index if not exists games_owner_id_idx on public.games (owner_id);
create index if not exists copies_owner_id_idx on public.copies (owner_id);
create index if not exists wishlist_owner_id_idx on public.wishlist (owner_id);
create index if not exists lists_owner_id_idx on public.lists (owner_id);
