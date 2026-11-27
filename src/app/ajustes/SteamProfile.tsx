"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { SteamLibraryResponse } from "@/lib/steam";
import { useLibrary } from "@/lib/store";
import styles from "./settings.module.css";

/**
 * En «Traer juegos»: el perfil de Steam con el que la app mira tus logros. Se guarda con la biblioteca (también se
 * guarda solo al importar de Steam). Para que Steam dé los logros, los «Detalles de juego» del perfil tienen que ser
 * públicos.
 */
export function SteamProfile() {
  const { library, actions } = useLibrary();
  const steamId = library.settings.steamId;
  const [profile, setProfile] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/steam", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perfil: profile }) });
      const data = (await res.json()) as SteamLibraryResponse;
      if (!data.ok) setProblem(data.message);
      else {
        actions.setSteamId(data.steamId);
        setProfile("");
        toast("Perfil de Steam guardado: tus logros se mirarán al abrir la app.");
      }
    } catch {
      setProblem("No se ha podido conectar. Comprueba tu conexión y vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.steamProfile} aria-label="Tu perfil de Steam" onSubmit={save}>
      <h3>Tu perfil de Steam, para los logros</h3>
      {steamId ? (
        <p className={styles.steamSaved}>
          Guardado: <span className="num">{steamId}</span>
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => actions.setSteamId(null)}>
            Quitar
          </button>
        </p>
      ) : (
        <div className={styles.steamField}>
          <input
            className="input"
            aria-label="Perfil de Steam"
            placeholder="steamcommunity.com/id/tu-nombre"
            autoComplete="off"
            spellCheck={false}
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            maxLength={300}
          />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Comprobando…" : "Guardar"}
          </button>
        </div>
      )}
      {problem && (
        <p className={styles.steamProblem} role="alert">
          {problem}
        </p>
      )}
      <p className={styles.note}>
        Para que Steam dé tus logros: en tu perfil de Steam → Editar perfil → Privacidad, pon «Detalles de juego» en Público.
      </p>
    </form>
  );
}
