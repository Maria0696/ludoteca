-- Quitar una saga del apartado Sagas no la quita de la ficha: sus juegos (y los que no tienes) se ocultan allí
-- y conservan su saga. Traer las vuelve a proponer.
alter table public.games add column if not exists saga_hidden boolean not null default false;
alter table public.saga_extras add column if not exists hidden boolean not null default false;
