-- En el mapa de una saga, las versiones del mismo juego (remaster, remake, edición…) van dentro de la parada del
-- original, y cada parada tiene su marca: principal (número), opcional (estrella) o DLC (pieza de puzle).
-- version_of: número de IGDB del original (0 = parada propia, decidido); saga_role: main, optional o dlc.
alter table public.games add column if not exists saga_role text check (saga_role in ('main', 'optional', 'dlc'));
alter table public.games add column if not exists version_of integer check (version_of >= 0);
alter table public.saga_extras add column if not exists saga_role text check (saga_role in ('main', 'optional', 'dlc'));
alter table public.saga_extras add column if not exists version_of integer check (version_of >= 0);
