-- Rejugar un juego ya superado: las vueltas anteriores, cada una con su inicio (si se sabe) y su fin.
-- La vuelta en curso sigue en started_at / finished_at.
alter table public.games add column if not exists past_runs jsonb not null default '[]'::jsonb;
