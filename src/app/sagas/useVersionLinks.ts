"use client";

import { useEffect, useRef } from "react";
import type { VersionsResponse } from "@/lib/catalog";
import type { Story } from "@/lib/sagas";
import { useLibrary } from "@/lib/store";

const BATCH = 50;

/**
 * Con una saga abierta, pregunta a IGDB de qué juego es versión cada uno de los suyos que aún no se sabe, y lo guarda
 * (0 si de ninguno). Lo que ella haya decidido no se toca. Si IGDB no responde, se deja para otra vez, sin avisar.
 */
export function useVersionLinks(story: Story | null) {
  const { actions } = useLibrary();
  const asked = useRef(new Set<number>());

  useEffect(() => {
    if (!story) return;
    const games = story.games.filter((g) => g.igdbId != null && g.versionOf == null && !asked.current.has(g.igdbId));
    const extras = story.extras.filter((x) => x.igdbId != null && x.versionOf == null && !asked.current.has(x.igdbId));
    const ids = [...new Set([...games, ...extras].map((x) => x.igdbId!))];
    if (!ids.length) return;
    for (const id of ids) asked.current.add(id);
    void (async () => {
      const originals: Record<string, number> = {};
      try {
        for (let i = 0; i < ids.length; i += BATCH) {
          const res = await fetch("/api/catalogo/versiones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ igdbIds: ids.slice(i, i + BATCH) }),
          });
          const body = (await res.json()) as VersionsResponse;
          if (!body.ok) throw new Error(body.message);
          Object.assign(originals, body.originals);
        }
      } catch {
        for (const id of ids) asked.current.delete(id);
        return;
      }
      const found = (id: number | null | undefined) => (id != null && String(id) in originals ? originals[String(id)] : undefined);
      const gamePatches = games.flatMap((g) => (found(g.igdbId) != null ? [{ id: g.id, patch: { versionOf: found(g.igdbId)! } }] : []));
      const extraPatches = extras.flatMap((x) => (found(x.igdbId) != null ? [{ id: x.id, patch: { versionOf: found(x.igdbId)! } }] : []));
      if (gamePatches.length) actions.updateGames(gamePatches);
      if (extraPatches.length) actions.updateExtras(extraPatches);
    })();
  }, [story, actions]);
}
