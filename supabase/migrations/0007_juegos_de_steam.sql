-- Número del juego en Steam: permite volver a importar sin duplicar y actualizar las horas.
alter table public.games add column if not exists steam_app_id integer;
