"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { isSupabaseConfigured } from "@/lib/config";
import { getBrowserSupabase } from "@/lib/supabase/client";
import styles from "./entrar.module.css";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "acceso" ? "Esta cuenta no tiene acceso a la biblioteca." : null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) return;
    setPending(true);
    setError(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "El correo o la contraseña no coinciden."
          : `No se pudo iniciar sesión: ${error.message}`,
      );
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <BrandMark />
        </div>
        <h1>Entrar en tu biblioteca</h1>
        {!isSupabaseConfigured ? (
          <p className="notice">
            Esta copia de la app no tiene la sincronización configurada. Abre la página de inicio para usar el modo local.
          </p>
        ) : (
          <form onSubmit={submit} className={styles.form} noValidate>
            <div className="field">
              <label htmlFor="email">Correo</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="notice is-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-ink" type="submit" disabled={pending || !email || !password}>
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
