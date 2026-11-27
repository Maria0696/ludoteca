# No perder cambios al cerrar rápido

## Para qué

Que un cambio no se pierda si la propietaria cierra la app, la quita del multitarea o recarga justo después de hacerlo.

En la nube, cada cambio es una petición a Supabase (0,2–0,6 s, más con mala cobertura). En modo local es una escritura en IndexedDB. Si la página se cierra a mitad, el cambio se pierde. Se vio con las pruebas de sagas (PR #112).

## Decidido

La propietaria aceptó la recomendación.

1. **Nube: guardados con `keepalive`.**
   - El cliente de Supabase del navegador usa un `fetch` que añade `keepalive: true` a las peticiones que escriben (todo lo que no sea GET ni HEAD) si su cuerpo cabe en 60 000 caracteres. El límite de `keepalive` es de 64 KB.
   - Así la petición termina aunque la página se cierre, también en iPhone.
   - Las grandes, como importar una copia, van como siempre.
2. **Aviso al cerrar o recargar mientras se guarda.**
   - Con algo pendiente (la página lleva `data-guardando`), `beforeunload` pide confirmación.
   - Lo respetan el ordenador y Android. El iPhone no lo ofrece para apps web, y allí protege el punto 1.
3. **«Guardando…» en la cabecera, solo si tarda más de 1 s.**
   - Así no parpadea en cada toque, pero con mala cobertura se ve que aún no conviene cerrar.
   - Es un `role="status"`, en la letra y los colores del chip de modo.
   - Lo dibuja un componente que observa `data-guardando`; el almacén no cambia.

## Fuera de alcance

- Guardar sin conexión para enviar después.
- Reintentar automáticamente un guardado que falla. Ya avisa y vuelve a cargar lo guardado.

## Pruebas

- **Unitarias de `keepaliveFetch`:**
  - escritura pequeña → `keepalive`;
  - escritura grande → sin él;
  - GET → intacto.
- **e2e con el guardado retrasado a propósito** (se alarga la transacción de IndexedDB):
  - «Guardando…» aparece pasado 1 s y se va al terminar;
  - `beforeunload` se cancela mientras guarda y no después;
  - con un guardado normal, «Guardando…» no llega a salir.
