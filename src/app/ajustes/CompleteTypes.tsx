"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { TypesResponse } from "@/lib/catalog";
import type { Game } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import styles from "./settings.module.css";

const BATCH = 50;
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Trae de IGDB el tipo (juego base, DLC, remake…) de los juegos enlazados que aún no lo tienen. Lo puesto a mano se queda. */
export function CompleteTypes() {
  const { library, actions } = useLibrary();
  const [busy, setBusy] = useState(false);
  const missing = library.games.filter((g) => g.igdbId != null && !g.gameType);
  if (!missing.length) return null;

  async function complete() {
    setBusy(true);
    try {
      const types: Extract<TypesResponse, { ok: true }>["types"] = {};
      for (let i = 0; i < missing.length; i += BATCH) {
        const res = await fetch("/api/catalogo/tipos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ igdbIds: missing.slice(i, i + BATCH).map((g) => g.igdbId) }),
        });
        const body = (await res.json()) as TypesResponse;
        if (!body.ok) {
          toast.error(body.message);
          return;
        }
        Object.assign(types, body.types);
      }
      const patches = missing.flatMap((g): { id: string; patch: Partial<Game> }[] => {
        const found = types[String(g.igdbId)];
        return found?.gameType ? [{ id: g.id, patch: { gameType: found.gameType, baseGame: g.baseGame ?? found.baseGame } }] : [];
      });
      if (patches.length) actions.updateGames(patches);
      toast(patches.length ? `Tipo completado en ${count(patches.length, "juego", "juegos")}` : "IGDB no tiene el tipo de esos juegos.");
    } catch {
      toast.error("No se pudo consultar el catálogo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.note}>
      <button type="button" className="btn" disabled={busy} onClick={() => void complete()}>
        <Search aria-hidden />
        {busy ? "Completando…" : `Completar el tipo desde IGDB (${count(missing.length, "juego", "juegos")})`}
      </button>
      <p>Juego base, DLC, remake, remaster… Solo rellena los que no lo tienen; lo que hayas puesto a mano se queda.</p>
    </div>
  );
}
