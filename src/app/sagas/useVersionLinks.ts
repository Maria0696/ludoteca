"use client";

import { useEffect, useRef } from "react";
import type { VersionsResponse } from "@/lib/catalog";
import type { Game, SagaExtra } from "@/lib/model";
import type { Story } from "@/lib/sagas";
import { useLibrary } from "@/lib/store";

const BATCH = 50;
type Types = NonNullable<Extract<VersionsResponse, { ok: true }>["types"]>;

/**
 * Con una saga abierta, pregunta a IGDB lo que aún no se sabe de sus juegos (tuyos o no): de cuál es versión cada uno
 * (0 si de ninguno) y qué es (juego base, DLC…). Solo rellena huecos: lo que ella haya decidido no se toca. Si IGDB
 * no responde, se deja para otra vez, sin avisar.
 */
export function useVersionLinks(story: Story | null) {
  const { actions } = useLibrary();
  const asked = useRef(new Set<number>());

  useEffect(() => {
    if (!story) return;
    const unknown = (x: Game | SagaExtra) => x.igdbId != null && (x.versionOf == null || x.gameType == null) && !asked.current.has(x.igdbId);
    const games = story.games.filter(unknown);
    const extras = story.extras.filter(unknown);
    const ids = [...new Set([...games, ...extras].map((x) => x.igdbId!))];
    if (!ids.length) return;
    for (const id of ids) asked.current.add(id);
    void (async () => {
      const originals: Record<string, number> = {};
      const types: Types = {};
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
          Object.assign(types, body.types ?? {});
        }
      } catch {
        for (const id of ids) asked.current.delete(id);
        return;
      }
      /** Lo que IGDB sabe de este y aún le falta. */
      const fill = (x: Game | SagaExtra): Partial<Game> => {
        const key = String(x.igdbId);
        const patch: Partial<Game> = {};
        if (x.versionOf == null && key in originals) patch.versionOf = originals[key];
        const type = types[key];
        if (x.gameType == null && type?.gameType) patch.gameType = type.gameType;
        return patch;
      };
      const gamePatches = games.flatMap((g) => {
        const patch = fill(g);
        const type = types[String(g.igdbId)];
        if (patch.gameType && !g.baseGame && type?.baseGame) patch.baseGame = type.baseGame;
        return Object.keys(patch).length ? [{ id: g.id, patch }] : [];
      });
      const extraPatches = extras.flatMap((x) => {
        const { versionOf, gameType } = fill(x);
        const patch: Partial<SagaExtra> = {};
        if (versionOf != null) patch.versionOf = versionOf;
        if (gameType) patch.gameType = gameType;
        return Object.keys(patch).length ? [{ id: x.id, patch }] : [];
      });
      if (gamePatches.length) actions.updateGames(gamePatches);
      if (extraPatches.length) actions.updateExtras(extraPatches);
    })();
  }, [story, actions]);
}
