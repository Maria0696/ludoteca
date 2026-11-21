-- Juegos sin final (Mario Kart, Stardew…): no se completan, se juegan. Cambia la ficha, ¿A qué juego? y Estadísticas.
alter table public.games add column if not exists endless boolean not null default false;
