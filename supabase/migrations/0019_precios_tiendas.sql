-- Precios de la lista de deseos que la app mira sola: el código de cada deseo en el eShop de Nintendo España y en
-- Steam. El precio normal y el fin de la oferta van dentro de cada precio apuntado (prices, jsonb), sin columnas nuevas.
alter table public.wishlist add column if not exists eshop_nsuid text check (eshop_nsuid ~ '^\d{14}$');
alter table public.wishlist add column if not exists steam_app_id integer check (steam_app_id > 0);
