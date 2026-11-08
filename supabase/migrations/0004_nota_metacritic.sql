-- Nota de Metacritic de cada juego, apuntada a mano (de 0 a 100).
alter table public.games
  add column if not exists metacritic smallint check (metacritic between 0 and 100);
