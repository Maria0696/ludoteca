"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { SeriesResponse } from "@/lib/catalog";
import type { Game } from "@/lib/model";
import { storyOf } from "@/lib/sagas";
import { useLibrary } from "@/lib/store";

const DONE = "ludoteca:limpieza-sagas-un-juego";
const BATCH = 50;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function done(): boolean {
  try {
    return window.localStorage.getItem(DONE) === "1";
  } catch {
    return false;
  }
}

function markDone() {
  try {
    window.localStorage.setItem(DONE, "1");
  } catch {
    // Sin almacenamiento, se repite la próxima vez: no cambia nada que ya esté bien.
  }
}

/**
 * Una vez por dispositivo: los juegos que están en una saga que en IGDB es un solo juego (Ocarina of Time y su
 * remake) pasan a la saga que IGDB da ahora; si no da otra, se quedan como están. Solo se tocan esas: las sagas puestas a mano se quedan. Si IGDB no
 * responde, se deja para otra vez, sin avisar.
 */
export function useSagaCleanup() {
  const { state, library, actions } = useLibrary();
  const started = useRef(false);

  useEffect(() => {
    if (state !== "ready" || started.current || done()) return;
    started.current = true;
    const games = library.games.filter((g) => g.igdbId != null && storyOf(g));
    void (async () => {
      const fixes: { id: string; patch: Partial<Game> }[] = [];
      try {
        for (let i = 0; i < games.length; i += BATCH) {
          const part = games.slice(i, i + BATCH);
          const res = await fetch("/api/catalogo/series", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ igdbIds: part.map((g) => g.igdbId) }),
          });
          const body = (await res.json()) as SeriesResponse;
          // Sin saber qué series son un solo juego (IGDB no lo dio), se deja para otra vez.
          if (!body.ok || !body.single) return;
          for (const g of part) {
            const single = body.single[String(g.igdbId)] ?? [];
            if (!single.some((name) => same(name, g.saga!))) continue;
            // Solo si IGDB da otra: la saga de la ficha no se quita nunca.
            const next = body.sagas[String(g.igdbId)];
            if (next && !same(next, g.saga!)) fixes.push({ id: g.id, patch: { saga: next, sagaOrder: null } });
          }
        }
      } catch {
        return;
      }
      markDone();
      if (!fixes.length) return;
      actions.updateGames(fixes);
      toast(`${fixes.length === 1 ? "1 juego cambia" : `${fixes.length} juegos cambian`} de saga: la que tenía${fixes.length === 1 ? "" : "n"} era solo ese juego y sus versiones.`);
    })();
  }, [state, library.games, actions]);
}
