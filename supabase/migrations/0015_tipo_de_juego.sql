-- Qué es cada juego (juego base, DLC, expansión, remake, remaster, colección, edición…) y de cuál, si es DLC,
-- expansión o edición de otro. Lo trae IGDB y se puede cambiar a mano.
alter table public.games add column if not exists game_type text check (char_length(game_type) <= 40);
alter table public.games add column if not exists base_game text check (char_length(base_game) <= 200);
alter table public.saga_extras add column if not exists game_type text check (char_length(game_type) <= 40);
