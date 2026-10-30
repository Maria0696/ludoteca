# Ludoteca

Tu biblioteca personal de videojuegos: colección, copias, lista de deseos, listas propias, «¿A qué juego?» y estadísticas. Next.js 16 + TypeScript, pensada para Vercel (plan Hobby) y Supabase (plan gratuito).

## Qué incluye la primera versión

- **Biblioteca**: alta en cuatro campos (título, plataforma, formato y estado) con aviso de duplicados que propone «añadir otra copia». Búsqueda, pestañas por plataforma, filtros por estado, formato, género y favoritos, y orden por título, añadido, valoración o última partida. Vista de carátulas agrupada por separadores o lista compacta con cambio de estado en línea.
- **Ficha**: estado con un toque, «He jugado hoy», favorito, 100 %, valoración, horas, fechas, notas, géneros y etiquetas, duración de sesión y total, modos y tipo de experiencia. Copias con edición, formato, disponibilidad, compra y estantería (caja, carátula completa o por imprimir, enlace, ubicación, préstamo). Carátula desde el catálogo, un enlace o un archivo.
- **Modelo**: un juego (la obra) tiene varias copias (los ejemplares). Las estadísticas cuentan títulos y copias por separado. Una copia digital con caja decorativa sigue siendo digital.
- **Lista de deseos**: plataforma, prioridad, precio objetivo, notas, historial de precios a mano y «Ya lo tengo», que pasa el deseo a la biblioteca conservando sus datos.
- **¿A qué juego?**: reglas explicables, sin IA. Respeta la plataforma, la disponibilidad (las copias prestadas no cuentan), la partida (nueva o continuar), la compañía y el tipo de experiencia. Compara tu tiempo con lo que dura una sesión, no con el juego entero. Explica cada propuesta y los datos que faltan. Puedes descartar y pedir otras.
- **Inicio**: continuar lo que juegas, acceso rápido a «¿A qué juego?», añadidos recientemente, los pendientes que más esperan y un resumen.
- **Estadísticas**: títulos, copias, estados, plataformas, formatos, terminados este año, horas y gasto, indicando cuándo faltan datos.
- **Listas propias**, **copia de seguridad JSON** (importar valida el archivo y te deja decidir cada coincidencia) y **datos de demostración** marcados y retirables de una vez. Los juegos de demostración se ilustran con obras de dominio público; sus créditos están en Ajustes.
- **Diseño «Sala de proyección»**: oscuro y cinematográfico, con el arte del juego a pantalla completa en Inicio, selector de carátulas, pósters que reaccionan al ratón y transiciones; respeta la preferencia de movimiento reducido. Detalles en [DESIGN.md](DESIGN.md).
- **Deshacer** al cambiar un estado o eliminar algo; confirmación antes de borrar un juego.

## Ejecutarla en tu ordenador

Requisitos: Node.js 20.9 o superior (probado con Node 24).

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:3000. Sin variables de entorno funciona en **modo local**: los datos se guardan solo en ese navegador, y la app lo indica en la barra superior y en Inicio.

## Servicios externos

| Servicio | Para qué | Coste | ¿Obligatorio? |
| --- | --- | --- | --- |
| GitHub | Guardar el código | Gratis | Sí, para desplegar en Vercel |
| Vercel (Hobby) | Alojar la app | Gratis | Sí |
| Supabase (Free) | Base de datos, inicio de sesión y sincronización entre dispositivos | Gratis | Sí, para usarla en Vercel con tus datos a salvo |
| IGDB (vía Twitch) | Buscar carátulas, géneros y duración | Gratis para uso no comercial | No: todo se puede escribir a mano |

Las variables están documentadas en [.env.example](.env.example). Las claves privadas (`IGDB_CLIENT_SECRET`) solo se usan en el servidor.

### 1. Subir el código a GitHub

1. Crea un repositorio **privado** vacío en GitHub llamado `ludoteca`, sin README.
2. En la carpeta del proyecto, sustituye `TU-USUARIO` por tu usuario de GitHub:

```bash
git add -A
```

```bash
git commit -m "Primera versión de la biblioteca"
```

```bash
git remote add origin https://github.com/TU-USUARIO/ludoteca.git
```

```bash
git push -u origin main
```

### 2. Crear la base de datos en Supabase

1. Crea un proyecto en https://supabase.com, en la región de la UE más cercana.
2. En **SQL Editor**, pega el contenido de [supabase/migrations/0001_biblioteca.sql](supabase/migrations/0001_biblioteca.sql). **Cambia en la última línea `tu-correo@ejemplo.com` por tu correo** y ejecútalo. Crea las tablas y la seguridad por filas: solo la cuenta de ese correo puede leer o escribir.
3. En **Authentication → Users → Add user**, crea tu usuario con ese correo y una contraseña (marca «Auto confirm user»).
4. En **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up**, para que nadie más pueda registrarse.
5. En **Project Settings → API** copia la URL del proyecto y la clave *publishable* (o *anon*).

En el plan gratuito, Supabase pausa los proyectos que pasan una semana sin actividad. Se reactivan desde su panel y no se pierde nada.

### 3. Claves de IGDB (opcional)

1. Necesitas una cuenta de Twitch con la verificación en dos pasos activada.
2. En https://dev.twitch.tv/console/apps registra una aplicación: en *OAuth Redirect URL* pon `http://localhost` y en el tipo de cliente elige **Confidential**.
3. Pulsa **New Secret** y apunta el *Client ID* y el *Client Secret*.

IGDB es gratuito para uso no comercial según el acuerdo de desarrolladores de Twitch, con un límite de 4 peticiones por segundo. La app indica la fuente al mostrar resultados.

### 4. Desplegar en Vercel

1. En https://vercel.com, pulsa **Add New → Project** e importa el repositorio de GitHub. El preajuste de Next.js sirve tal cual.
2. En **Environment Variables** añade `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OWNER_EMAIL` y, si los tienes, `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`.
3. Despliega. La URL será del tipo `https://ludoteca-xxxx.vercel.app`.

En producción, si falta la configuración de Supabase, la app no se abre en modo local: muestra «Configuración pendiente», para que nadie pueda usarla desde tu URL.

### Acceso solo para ti

Hay tres capas, de fuera hacia dentro:

1. **Vercel Authentication** (recomendado, gratis en Hobby): en **Settings → Deployment Protection**, activa Vercel Authentication. Según la documentación actual de Vercel, la protección *Standard* restringe las URL generadas `*.vercel.app` (también la de producción) y deja fuera solo los dominios propios; la opción *All Deployments* lo protege todo. Después, abre la URL en una ventana privada para comprobar que pide iniciar sesión en Vercel.
2. **Inicio de sesión de la app**: `proxy.ts` envía a «Entrar» a quien no tenga sesión o no sea `OWNER_EMAIL`, y las rutas de API lo vuelven a comprobar.
3. **Base de datos**: la seguridad por filas de Supabase solo deja leer y escribir a la cuenta registrada en `app_owner`, aunque alguien consiguiera otra sesión.

## Usarla

- **Añadir juego** (botón lima) desde cualquier pantalla. Si el título ya existe, propone añadir otra copia.
- Toca una carátula para abrir la ficha. Todo se guarda solo al salir de cada campo.
- En **Ajustes**: exporta una copia de seguridad, impórtala, carga o retira los datos de demostración y comprueba si el catálogo está conectado.

## Comprobaciones

```bash
npm run check
```

Ejecuta los tipos, el lint y la compilación de producción.

```bash
npx playwright test
```

Ejecuta las pruebas de extremo a extremo con el Chrome instalado. Necesita haber compilado antes (`npm run check` o `npx next build`). Cada prueba usa un navegador limpio en modo local, así que no toca tus datos. La prueba de acceso arranca otra instancia con un Supabase falso para comprobar que sin sesión no se entra en ninguna pantalla ni en la API.

## Estructura

- `src/lib`: modelo, recomendaciones, estadísticas, filtros, copia de seguridad y almacenamiento (local en IndexedDB o Supabase).
- `src/app`: pantallas (`/`, `/biblioteca`, `/juego/[id]`, `/deseos`, `/que-juego`, `/estadisticas`, `/listas`, `/ajustes`, `/entrar`) y la ruta del catálogo.
- `src/components`: armazón, carátulas, alta de juegos y campos.
- `supabase/migrations`: esquema y seguridad de la base de datos.
- `PRODUCT.md` y `DESIGN.md`: producto y sistema visual.

## Para más adelante

Diario y sesiones de juego, objetivos y resumen anual, préstamos ampliados, vista de estantería por lomos, seguimiento automático de precios, importación desde otras plataformas (verificando antes qué permite cada una) e instalación como aplicación.
