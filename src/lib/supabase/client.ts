import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "../config";
import { keepaliveFetch } from "./keepalive";

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  // Los guardados terminan aunque se cierre la app justo después (ver keepalive.ts).
  client ??= createBrowserClient(supabaseUrl, supabaseKey, { global: { fetch: keepaliveFetch((input, init) => fetch(input, init)) } });
  return client;
}
