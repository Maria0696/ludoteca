# Copias de seguridad automáticas

## Para qué

Que la biblioteca de la propietaria quede guardada sola, cada día y fuera de Supabase, para recuperarla si el proyecto se pierde o un fallo estropea datos, sin depender de acordarse de exportar.

En el plan gratuito de Supabase no hay copias que pueda recuperar ella.

## Decidido con la propietaria

- **Dónde:** en GitHub, como archivo de la tarea («Actions»), conservado **90 días** (opción A).
- **Formato:** el mismo de la copia manual (`createBackup`), para recuperarla con «Copiar desde tu copia de seguridad».
- **Acceso de GitHub:** sin la llave maestra de Supabase ni su contraseña. Una función de Supabase que solo lee sus datos para la copia, con una clave propia; en Supabase se guarda solo su huella.
- **Avisos:** si una noche falla, GitHub avisa por correo.
- **En la app:**
  - Ajustes enseña la fecha de la última copia automática;
  - el aviso de Inicio calla mientras la última automática tenga menos de 2 días.
- **Solo modo nube:** en modo local sigue la copia manual.

## Formas consideradas

- **Elegida:** tarea nocturna de GitHub → ruta de la app con la clave → función de Supabase que comprueba la huella y devuelve los datos.
- La llave `service_role` en GitHub: lee y borra todo; demasiado poder para un secreto.
- Iniciar sesión con su email y contraseña desde GitHub: la contraseña viviría en GitHub.
- Una tarea programada dentro de Supabase: la copia se quedaría en el mismo sitio del que protege.

## Cómo

1. **Migración `0018_copias_automaticas.sql`.** La aplica ella en el panel.
   - **`backup_key`:** una fila, con la huella SHA-256 de la clave. Con RLS y sin políticas, nadie la lee desde la API.
   - **`backup_runs`:** una fila con la fecha de la última copia. La propietaria la lee con su sesión.
   - **`copia_de_seguridad(clave)`:** `security definer`.
     - Si la huella coincide, devuelve `{games, copies, wishlist, saga_extras, year_wraps}` como filas, solo las de la propietaria (`app_owner`).
     - Si no, lanza un error.
     - La puede ejecutar el rol anónimo: la protege la clave.
   - **`copia_hecha(clave)`:** con la misma comprobación, apunta la fecha en `backup_runs`.
2. **`POST /api/copia-de-seguridad`** con `Authorization: Bearer <clave>`.
   - Llama a la función.
   - Convierte las filas con el mismo código que usa la app al cargar (`libraryFromRows`, que sale de `SupabaseRepository.load`).
   - Responde la copia con `createBackup`.
   - Respuestas de error: sin Supabase configurado, 404; sin clave o con clave mala, 401; Supabase no responde, 502.
3. **`.github/workflows/copia-automatica.yml`**, cada noche (~4:00 hora de Madrid) y a mano.
   1. Pide la copia a la ruta de producción.
   2. Comprueba que es una copia válida.
   3. La sube como archivo `ludoteca-AAAA-MM-DD.json`, conservado 90 días.
   4. Llama a `copia_hecha`.
   - Secretos: `COPIA_CLAVE` (nuevo), `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (ya existen) y `APP_URL` (nuevo, la dirección de producción).
4. **App:**
   - Ajustes («Partida guardada»): «Última copia automática: hoy / hace N días», en modo nube.
   - El aviso de Inicio no sale si la automática tiene menos de 2 días.

## La clave

- La genera el agente con 32 bytes aleatorios y la guarda con `gh secret set`, sin que salga por pantalla.
- La propietaria pega en el panel un `insert` con su huella.
- Para cambiarla basta con repetir los dos pasos.

## Pruebas

- **Unitarias:**
  - `libraryFromRows` convierte filas al modelo, y su copia se lee con `parseBackup`;
  - la decisión del aviso de Inicio con y sin copia automática reciente.
- **e2e:**
  - en modo local la ruta responde 404;
  - con Supabase configurado (proyecto `acceso`): sin clave, 401; con clave pero Supabase caído, 502; y nunca redirige a «Entrar».
- **Lo que no se puede probar en local:**
  - la función de Supabase y la tarea de GitHub;
  - se comprueban lanzando la tarea a mano tras aplicar la migración.
