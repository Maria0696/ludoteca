# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Next.js (App Router) + TypeScript, desplegado en Vercel (plan Hobby). Base de datos y autenticación en Supabase (Postgres con Row Level Security, Auth y Storage, plan gratuito). Modo local en el navegador cuando no hay credenciales, identificado como tal. La propietaria sugirió Next.js con TypeScript; el resto lo elige el agente por ser gratuito, compatible con Vercel y fácil de mantener.

## Users

Una sola persona: la propietaria, que colecciona videojuegos físicos y digitales en varias plataformas. Abre la app en el ordenador para mantener la colección y en el móvil para consultar, cambiar un estado o decidir a qué jugar, a veces con su pareja. No hay más usuarios ni roles.

## Product Purpose

Biblioteca personal de videojuegos: guardar los juegos que tiene, organizar la colección, mantener una lista de deseos y responder a «¿a qué juego ahora?». Éxito: la usa de verdad a diario porque añadir, encontrar y actualizar un juego es más rápido que no hacerlo, y le gusta entrar en ella.

## Positioning

No es un catálogo público ni una red social: es su estantería. Distingue el juego (la obra) de las copias que posee (plataforma, edición, formato, procedencia), y entiende las cajas decorativas con carátula impresa de juegos digitales que pone en su estantería física. Recomienda solo desde su propia biblioteca, con reglas explicables y sin IA de pago.

## Operating Context

- Uso personal, privado: acceso solo para la propietaria, con inicio de sesión y autorización en servidor y en datos (confirmado).
- Escritorio y móvil por igual; acciones frecuentes: buscar, añadir un juego, cambiar su estado, elegir qué jugar.
- Sesiones de juego en solitario o acompañada; tiempo disponible variable por sesión.
- Colección física en estantería: cajas, carátulas impresas, ubicación, préstamos.
- Empieza desde cero, sin importar datos de otra app (confirmado).

## Capabilities and Constraints

- Interfaz en español de España.
- Áreas: Inicio, Biblioteca, Lista de deseos, ¿A qué juego?, Estadísticas, ajustes con copia de seguridad JSON.
- Modelo: juego ≠ copia. Varias copias por título; estadísticas sin ambigüedad entre títulos y copias.
- Alta de un juego con pocos campos; el resto se completa después.
- Metadatos y carátulas desde una fuente externa con clave en servidor; siempre editables a mano.
- Datos de demostración separados de la colección real y retirables.
- Servicios gratuitos cuando sean adecuados; mantenimiento sencillo.
- Sin dominio propio ni lanzamiento público inicialmente.
- Mejoras posteriores (no en la v1): diario y sesiones, objetivos y resumen anual, préstamos ampliados, vista de lomos, seguimiento de precios, importaciones de otras plataformas, instalación como app.

## Brand Commitments

Nombre: «Ludoteca», elegido por la propietaria por ser descriptivo (confirmado; sustituye al nombre de trabajo «Sala de los Menesteres»). Las carátulas y el arte de cada juego son los protagonistas. Tras ver la primera versión, la propietaria pidió más dinamismo y estética, y eligió como referencias Apple TV o Netflix y Steam o PlayStation: oscura, cinematográfica y con movimiento (confirmado). Sin recursos «gamer» gratuitos.

## Evidence on Hand

Ninguna colección real todavía. Toda muestra es de demostración y debe marcarse como tal. No inventar estadísticas, precios ni datos de la propietaria.

## Product Principles

1. La carátula manda: nada tapa la portada; plataforma y estado se leen junto a ella.
2. Lo frecuente, a un toque: buscar, añadir, cambiar estado y elegir qué jugar nunca están a más de una acción.
3. Cada cifra dice lo que mide y si está incompleta.
4. Honestidad: lo pendiente o local se muestra como tal; nada se sobrescribe en silencio.
5. Rápido de mantener: pocos campos obligatorios, todo corregible a mano.

## Accessibility & Inclusion

Navegación completa por teclado con foco visible, contraste AA, etiquetas accesibles, objetivos táctiles cómodos y respeto a `prefers-reduced-motion`.
