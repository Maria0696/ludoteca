import { z } from "zod";
import {
  type Copy,
  type Game,
  type GameAchievements,
  type Library,
  type Settings,
  type SagaExtra,
  type WishItem,
  type YearWrap,
  copySchema,
  emptySettings,
  gameAchievementsSchema,
  gameSchema,
  settingsSchema,
  sagaExtraSchema,
  newId,
  upgradeExtraV1,
  upgradeGameV1,
  normalizeTitle,
  nowIso,
  wishSchema,
  yearWrapSchema,
} from "./model";

/*
 * Copia de seguridad en JSON.
 *
 * Exportar genera un archivo autocontenido. Importar valida el archivo,
 * comprueba que cada copia apunta a un juego del propio archivo y detecta
 * coincidencias con lo que ya tienes. Ninguna coincidencia se resuelve sola:
 * por defecto se mantiene lo tuyo y tú decides caso por caso.
 */

export const BACKUP_APP = "ludoteca";
/** Nombre anterior de la app: sus copias se siguen pudiendo importar. */
const LEGACY_APPS = ["sala-de-los-menesteres"] as const;
/** 2: la franquicia es «franchise» y la saga, «saga». Las del 1 se pasan al 2 al leerlas (ver `upgradeGameV1`). */
export const BACKUP_VERSION = 2;

const backupSchema = z.object({
  app: z.enum([BACKUP_APP, ...LEGACY_APPS]),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  data: z.object({
    games: z.array(gameSchema),
    copies: z.array(copySchema),
    wishlist: z.array(wishSchema),
    /** Juegos de saga que no tienes; las copias de antes no los traen. */
    extras: z.array(sagaExtraSchema).default([]),
    /** Años del Anuario congelados; las copias de antes no los traen. */
    wraps: z.array(yearWrapSchema).default([]),
    /** Logros de Steam de los juegos y el perfil para mirarlos; las copias de antes no los traen. */
    achievements: z.array(gameAchievementsSchema).default([]),
    settings: settingsSchema.default(emptySettings),
    /** Las copias de cuando había «Mis listas» las traen: se aceptan y no se importan. */
    lists: z.array(z.unknown()).optional(),
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
      extras: keep(library.extras),
      wraps: library.wraps,
      achievements: library.achievements,
      settings: library.settings,
    },
  };
}

/** «ludoteca-2026-11-27.json»: con el día de aquí (no el de UTC, que de madrugada aún es el anterior). */
export function backupFileName(date = new Date()): string {
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `ludoteca-${stamp}.json`;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; errors: string[] };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["El archivo no es un JSON válido."] };
  }
  const app = typeof raw === "object" && raw !== null ? (raw as { app?: unknown }).app : undefined;
  if (app !== BACKUP_APP && !(LEGACY_APPS as readonly unknown[]).includes(app)) {
    return { ok: false, errors: ["Este archivo no es una copia de seguridad de esta biblioteca."] };
  }
  const parsed = backupSchema.safeParse(upgradeV1(raw));
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

/** Una copia del formato 1, en el 2; las demás, tal cual. */
function upgradeV1(raw: unknown): unknown {
  const backup = raw as { version?: unknown; data?: { games?: unknown; extras?: unknown } };
  if (backup.version !== 1 || typeof backup.data !== "object" || backup.data === null) return raw;
  const list = (x: unknown, up: (item: unknown) => unknown) => (Array.isArray(x) ? x.map(up) : x);
  return {
    ...backup,
    version: BACKUP_VERSION,
    data: { ...backup.data, games: list(backup.data.games, upgradeGameV1), extras: list(backup.data.extras, upgradeExtraV1) },
  };
}

function describePath(path: PropertyKey[]): string {
  const names: Record<string, string> = { games: "Juego", copies: "Copia", wishlist: "Deseo" };
  const [, section, index, field] = path;
  if (typeof section === "string" && typeof index === "number") {
    return `${names[section] ?? section} n.º ${index + 1}${field ? ` (${String(field)})` : ""}`;
  }
  return path.map(String).join(".") || "Archivo";
}

export type Resolution = "mantener" | "importado" | "ambos";

export interface Conflict {
  key: string;
  kind: "juego" | "deseo";
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
  newCounts: { games: number; copies: number; wishlist: number };
  /** Juegos de saga que no tienes y que aún no están: entran sin preguntar. */
  newExtras: SagaExtra[];
  /** Años del Anuario que no tienes: entran sin preguntar (si ya tienes ese año, se queda el tuyo). */
  newWraps: YearWrap[];
  /** El perfil de Steam del archivo, si tú aún no tienes uno (si ya lo tienes, se queda el tuyo). */
  newSettings: Settings | null;
}

export function planImport(current: Library, backup: Backup): ImportPlan {
  const conflicts: Conflict[] = [];
  let identical = 0;
  const gamesById = new Map(current.games.map((g) => [g.id, g]));
  const gamesByTitle = new Map(current.games.map((g) => [normalizeTitle(g.title), g]));
  const newCounts = { games: 0, copies: 0, wishlist: 0 };

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

  const extraIds = new Set(current.extras.map((x) => x.id));
  const newExtras = backup.data.extras.filter((x) => !extraIds.has(x.id));

  const wrapYears = new Set(current.wraps.map((w) => w.year));
  const newWraps = backup.data.wraps.filter((w) => !wrapYears.has(w.year));

  const newSettings = !current.settings.steamId && backup.data.settings.steamId ? backup.data.settings : null;

  return { backup, conflicts, identical, newCounts, newExtras, newWraps, newSettings };
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
  extras: SagaExtra[];
  wraps: YearWrap[];
  /** Los logros de los juegos que se importan (con el id con que quedan guardados). */
  achievements: GameAchievements[];
  settings?: Settings;
}

/** Calcula qué hay que guardar según las decisiones tomadas. Sin decisión, se mantiene lo tuyo. */
export function resolveImport(plan: ImportPlan, decisions: Record<string, Resolution>): ImportChanges {
  const out: ImportChanges = {
    games: [],
    copies: [],
    wishlist: [],
    extras: plan.newExtras,
    wraps: plan.newWraps,
    achievements: [],
    ...(plan.newSettings ? { settings: plan.newSettings } : {}),
  };
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

  for (const a of plan.backup.data.achievements) {
    const target = gameIdMap.get(a.gameId);
    if (!target) continue;
    out.achievements.push(target === a.gameId ? a : { ...a, id: newId(), gameId: target, updatedAt: stamp });
  }

  for (const w of plan.backup.data.wishlist) {
    const d = decide("deseo", w.id);
    if (!d) out.wishlist.push(w);
    else if (d.resolution === "importado") out.wishlist.push({ ...w, id: d.conflict.existingId, updatedAt: stamp });
    else if (d.resolution === "ambos") out.wishlist.push({ ...w, id: newId(), updatedAt: stamp });
  }

  return out;
}
