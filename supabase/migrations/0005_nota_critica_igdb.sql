-- Media de la crítica según IGDB (de 0 a 100); la trae el catálogo.
alter table public.games
  add column if not exists critic_rating smallint check (critic_rating between 0 and 100);
