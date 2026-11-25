-- Sagas: la historia de cada juego dentro de su saga (la serie de IGDB o puesta a mano)
-- y su puesto en el orden de la historia, puesto a mano (sin él, cuenta el de lanzamiento).
alter table public.games add column if not exists series text;
alter table public.games add column if not exists series_order integer;
