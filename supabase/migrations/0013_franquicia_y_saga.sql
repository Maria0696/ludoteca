-- Franquicia y saga, cada una con su nombre: lo que se llamaba «saga» es la franquicia (Star Wars) y lo que se
-- llamaba «series», la saga (Star Wars Jedi), con su puesto en la cronología.
alter table public.games rename column saga to franchise;
alter table public.games rename column series to saga;
alter table public.games rename column series_order to saga_order;
alter table public.saga_extras rename column series to saga;
alter table public.saga_extras rename column series_order to saga_order;

-- Lo descartado a propósito se llama «Sin saga» («Sin historia» era su nombre de antes).
update public.games set saga = 'Sin saga' where lower(trim(saga)) = 'sin historia';
-- «Sin saga» como franquicia (herencia de una importación antigua) es no tener franquicia.
update public.games set franchise = null where lower(trim(franchise)) = 'sin saga';
