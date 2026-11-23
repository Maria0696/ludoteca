-- El precio de una copia puede no ser un importe: regalo, gratis (promociones), en un pack con otro juego o no saberse.
alter table public.copies add column if not exists price_kind text check (price_kind in ('regalo', 'gratis', 'pack', 'desconocido'));
-- Con qué juego venía en el pack, escrito a mano.
alter table public.copies add column if not exists bundle_with text;
