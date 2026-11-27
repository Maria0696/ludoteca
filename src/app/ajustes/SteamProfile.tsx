"use client";

import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SteamLibraryResponse } from "@/lib/steam";
import { useLibrary } from "@/lib/store";
import styles from "./settings.module.css";

type Summary = { name: string; avatar: string | null; gamesVisible: boolean };

const PRIVACY = "en tu perfil de Steam → Editar perfil → Privacidad, pon «Detalles de juego» en Público.";

/** El número de perfil abreviado: los cuatro primeros y los cuatro últimos. */
const short = (id: string) => `${id.slice(0, 4)}…${id.slice(-4)}`;

/** Tu nombre, tu avatar y si Steam deja ver tus juegos; `null` mientras llega o si Steam no responde. */
function useSteamSummary(steamId: string | null): Summary | null {
  const [state, setState] = useState<{ id: string; summary: Summary | null } | null>(null);
  useEffect(() => {
    if (!steamId) return;
    let alive = true;
    fetch(`/api/logros/perfil?steamId=${steamId}`)
      .then((res) => res.json())
      .then((data: { ok: boolean } & Partial<Summary>) => {
        if (alive) setState({ id: steamId, summary: data.ok && data.name ? { name: data.name, avatar: data.avatar ?? null, gamesVisible: data.gamesVisible !== false } : null });
      })
      .catch(() => {
        if (alive) setState({ id: steamId, summary: null });
      });
    return () => {
      alive = false;
    };
  }, [steamId]);
  return state?.id === steamId ? state.summary : null;
}

/**
 * En «Traer juegos»: el perfil de Steam con el que la app mira tus logros, en una tarjeta con tu nombre y tu avatar.
 * Se guarda con la biblioteca (también se guarda solo al importar de Steam). Para que Steam dé los logros, los
 * «Detalles de juego» del perfil tienen que ser públicos: la tarjeta lo avisa si no lo son.
 */
export function SteamProfile() {
  const { library, actions } = useLibrary();
  const steamId = library.settings.steamId;
  const summary = useSteamSummary(steamId);
  const [editing, setEditing] = useState(false);
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
        setEditing(false);
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
      {steamId && !editing ? (
        <div className={styles.steamCard}>
          {summary?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar servido por Steam
            <img className={styles.steamAvatar} src={summary.avatar} alt="" width={64} height={64} />
          ) : (
            <span className={`${styles.steamAvatar} ${styles.steamAvatarBlank}`} aria-hidden>
              <UserRound size={32} />
            </span>
          )}
          <div className={styles.steamWho}>
            <b>{summary?.name ?? "Perfil de Steam"}</b>
            <span className="num">{short(steamId)}</span>
            {summary &&
              (summary.gamesVisible ? (
                <span className={styles.steamOk}>Logros de Steam: activados</span>
              ) : (
                <span className={styles.steamWarn}>Steam no deja ver tus juegos: {PRIVACY}</span>
              ))}
          </div>
          <div className={styles.steamActions}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setEditing(true);
                setProblem(null);
              }}
            >
              Cambiar
            </button>
            <button type="button" className="btn btn-sm btn-quiet" onClick={() => actions.setSteamId(null)}>
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <>
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
            {editing && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setEditing(false);
                  setProblem(null);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
          <p className={styles.note}>Para que Steam dé tus logros: {PRIVACY}</p>
        </>
      )}
      {problem && (
        <p className={styles.steamProblem} role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}
