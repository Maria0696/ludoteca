-- Ficha técnica de cada juego: la trae el catálogo y se puede corregir a mano.
alter table public.games
  add column if not exists summary text,
  add column if not exists developer text,
  add column if not exists saga text,
  add column if not exists release_date date,
  add column if not exists age_rating text;
