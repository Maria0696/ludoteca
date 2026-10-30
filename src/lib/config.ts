/*
 * Configuración pública. Next.js inserta estas variables en el cliente
 * durante la compilación; las claves privadas nunca pasan por aquí.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * El modo local guarda los datos solo en el navegador. Se permite en
 * desarrollo y en despliegues de prueba; en producción sin Supabase la app
 * muestra la configuración pendiente en lugar de abrirse a cualquiera.
 */
export const localModeAllowed = process.env.NEXT_PUBLIC_LOCAL_MODE_ALLOWED !== "false";
