import { z } from "zod";
import {
  type Copy,
  type Game,
  type GameList,
  type Library,
  type WishItem,
  copySchema,
  gameSchema,
  listSchema,
  newId,
  normalizeTitle,
  nowIso,
  wishSchema,
} from "./model";

/*
 * Copia de seguridad en JSON.
 *
 * Exportar genera un archivo autocontenido. Importar valida el archivo,
 * comprueba que cada copia apunta a un juego del propio archivo y detecta
 * coincidencias con lo que ya tienes. Ninguna coincidencia se resuelve sola:
 * por defecto se mantiene lo tuyo y tú decides caso por caso.
 */

export const BACKUP_APP = "sala-de-los-menesteres";
export const BACKUP_VERSION = 1;

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  data: z.object({
    games: z.array(gameSchema),
    copies: z.array(copySchema),
    wishlist: z.array(wishSchema),
    lists: z.array(listSchema),
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export function createBackup(library: Library, options: { includeDemo?: boolean } = {}): Backup {
  const keep = <T extends { demo?: boolean }>(items: T[]) =>
    options.includeDemo ? items : items.filter((i) => !i.demo);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    data: {
      games: keep(library.games),
      copies: keep(library.copies),
      wishlist: keep(library.wishlist),
      lists: keep(library.lists),
    },
  };
}

export function backupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `sala-de-los-menesteres-${stamp}.json`;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; errors: string[] };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["El archivo no es un JSON válido."] };
  }
  if (typeof raw === "object" && raw !== null && (raw as { app?: unknown }).app !== BACKUP_APP) {
    return { ok: false, errors: ["Este archivo no es una copia de seguridad de esta biblioteca."] };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 8).map((issue) => `${describePath(issue.path)}: ${issue.message}`);
    if (parsed.error.issues.length > 8) errors.push(`Y ${parsed.error.issues.length - 8} errores más.`);
    return { ok: false, errors };
  }
  const gameIds = new Set(parsed.data.data.games.map((g) => g.id));
  const orphans = parsed.data.data.copies.filter((c) => !gameIds.has(c.gameId));
  if (orphans.length > 0) {
    return {
      ok: false,
      errors: [`${orphans.length} ${orphans.length === 1 ? "copia apunta" : "copias apuntan"} a un juego que no está en el archivo.`],
    };
  }
  return { ok: true, backup: parsed.data };
}

function describePath(path: PropertyKey[]): string {
  const names: Record<string, string> = { games: "Juego", copies: "Copia", wishlist: "Deseo", lists: "Lista" };
  const [, section, index, field] = path;
  if (typeof section === "string" && typeof index === "number") {
    return `${names[section] ?? section} n.º ${index + 1}${field ? ` (${String(field)})` : ""}`;
  }
  return path.map(String).join(".") || "Archivo";
}

export type Resolution = "mantener" | "importado" | "ambos";

export interface Conflict {
  key: string;
  kind: "juego" | "deseo" | "lista";
  reason: "mismo-id" | "mismo-titulo";
  existingLabel: string;
  incomingLabel: string;
  existingId: string;
  incomingId: string;
}

export interface ImportPlan {
  backup: Backup;
  conflicts: Conflict[];
  /** Elementos del archivo idénticos a los tuyos: no hace falta importarlos. */
  identical: number;
  newCounts: { games: number; copies: number; wishlist: number; lists: number };
}

export function planImport(current: Library, backup: Backup): ImportPlan {
  const conflicts: Conflict[] = [];
  let identical = 0;
  const gamesById = new Map(current.games.map((g) => [g.id, g]));
  const gamesByTitle = new Map(current.games.map((g) => [normalizeTitle(g.title), g]));
  const newCounts = { games: 0, copies: 0, wishlist: 0, lists: 0 };

  for (const g of backup.data.games) {
    const sameId = gamesById.get(g.id);
    if (sameId) {
      if (sameId.updatedAt === g.updatedAt) identical++;
      else conflicts.push(conflict("juego", "mismo-id", sameId.id, g.id, sameId.title, g.title));
      continue;
    }
    const sameTitle = gamesByTitle.get(normalizeTitle(g.title));
    if (sameTitle) conflicts.push(conflict("juego", "mismo-titulo", sameTitle.id, g.id, sameTitle.title, g.title));
    else newCounts.games++;
  }

  const copyIds = new Set(current.copies.map((c) => c.id));
  for (const c of backup.data.copies) if (!copyIds.has(c.id)) newCounts.copies++;

  const wishById = new Map(current.wishlist.map((w) => [w.id, w]));
  const wishByTitle = new Map(current.wishlist.map((w) => [normalizeTitle(w.title), w]));
  for (const w of backup.data.wishlist) {
    const sameId = wishById.get(w.id);
    if (sameId) {
      if (sameId.updatedAt === w.updatedAt) identical++;
      else conflicts.push(conflict("deseo", "mismo-id", sameId.id, w.id, sameId.title, w.title));
      continue;
    }
    const sameTitle = wishByTitle.get(normalizeTitle(w.title));
    if (sameTitle) conflicts.push(conflict("deseo", "mismo-titulo", sameTitle.id, w.id, sameTitle.title, w.title));
    else newCounts.wishlist++;
  }

  const listById = new Map(current.lists.map((l) => [l.id, l]));
  const listByName = new Map(current.lists.map((l) => [normalizeTitle(l.name), l]));
  for (const l of backup.data.lists) {
    const sameId = listById.get(l.id);
    if (sameId) {
      if (sameId.updatedAt === l.updatedAt) identical++;
      else conflicts.push(conflict("lista", "mismo-id", sameId.id, l.id, sameId.name, l.name));
      continue;
    }
    const sameName = listByName.get(normalizeTitle(l.name));
    if (sameName) conflicts.push(conflict("lista", "mismo-titulo", sameName.id, l.id, sameName.name, l.name));
    else newCounts.lists++;
  }

  return { backup, conflicts, identical, newCounts };
}

function conflict(
  kind: Conflict["kind"],
  reason: Conflict["reason"],
  existingId: string,
  incomingId: string,
  existingLabel: string,
  incomingLabel: string,
): Conflict {
  return { key: `${kind}:${incomingId}`, kind, reason, existingId, incomingId, existingLabel, incomingLabel };
}

export interface ImportChanges {
  games: Game[];
  copies: Copy[];
  wishlist: WishItem[];
  lists: GameList[];
}

/** Calcula qué hay que guardar según las decisiones tomadas. Sin decisión, se mantiene lo tuyo. */
export function resolveImport(plan: ImportPlan, decisions: Record<string, Resolution>): ImportChanges {
  const out: ImportChanges = { games: [], copies: [], wishlist: [], lists: [] };
  const byKey = new Map(plan.conflicts.map((c) => [c.key, c]));
  const decide = (kind: Conflict["kind"], id: string) => {
    const c = byKey.get(`${kind}:${id}`);
    return c ? { conflict: c, resolution: decisions[c.key] ?? "mantener" } : null;
  };
  const stamp = nowIso();
  /** Juego importado → id con el que queda guardado (o null si se descarta). */
  const gameIdMap = new Map<string, string | null>();

  for (const g of plan.backup.data.games) {
    const d = decide("juego", g.id);
    if (!d) {
      gameIdMap.set(g.id, g.id);
      out.games.push(g);
    } else if (d.resolution === "mantener") {
      gameIdMap.set(g.id, null);
    } else if (d.resolution === "importado") {
      gameIdMap.set(g.id, d.conflict.existingId);
      out.games.push({ ...g, id: d.conflict.existingId, updatedAt: stamp });
    } else {
      const id = newId();
      gameIdMap.set(g.id, id);
      out.games.push({ ...g, id, updatedAt: stamp });
    }
  }

  for (const c of plan.backup.data.copies) {
    const target = gameIdMap.get(c.gameId);
    if (!target) continue;
    const renamed = target !== c.gameId;
    out.copies.push(renamed ? { ...c, id: newId(), gameId: target, updatedAt: stamp } : c);
  }

  for (const w of plan.backup.data.wishlist) {
    const d = decide("deseo", w.id);
    if (!d) out.wishlist.push(w);
    else if (d.resolution === "importado") out.wishlist.push({ ...w, id: d.conflict.existingId, updatedAt: stamp });
    else if (d.resolution === "ambos") out.wishlist.push({ ...w, id: newId(), updatedAt: stamp });
  }

  for (const l of plan.backup.data.lists) {
    const d = decide("lista", l.id);
    const gameIds = l.gameIds.map((id) => gameIdMap.get(id) ?? null).filter((id): id is string => !!id);
    if (!d) out.lists.push({ ...l, gameIds });
    else if (d.resolution === "importado") out.lists.push({ ...l, id: d.conflict.existingId, gameIds, updatedAt: stamp });
    else if (d.resolution === "ambos") out.lists.push({ ...l, id: newId(), name: `${l.name} (importada)`, gameIds, updatedAt: stamp });
  }

  return out;
}
