import type { SupabaseClient } from "@supabase/supabase-js";
import type { Copy, Game, Library, SagaExtra, WishItem } from "../model";
import type { Changes, Repository } from "./types";

/*
 * Modo sincronizado: tablas de Supabase protegidas con seguridad por filas.
 * Las columnas usan snake_case; aquí se traducen al modelo de la app.
 */

type Row = Record<string, unknown>;

const gameCols: [keyof Game, string][] = [
  ["id", "id"], ["title", "title"], ["coverUrl", "cover_url"], ["backdropUrl", "backdrop_url"], ["igdbId", "igdb_id"], ["steamAppId", "steam_app_id"], ["genres", "genres"],
  ["tags", "tags"], ["status", "status"], ["completed100", "completed_100"], ["endless", "endless"], ["favorite", "favorite"],
  ["rating", "rating"], ["metacritic", "metacritic"], ["criticRating", "critic_rating"], ["summary", "summary"], ["developer", "developer"], ["franchise", "franchise"], ["saga", "saga"], ["sagaOrder", "saga_order"],
  ["releaseDate", "release_date"], ["ageRating", "age_rating"], ["hoursPlayed", "hours_played"], ["notes", "notes"], ["startedAt", "started_at"],
  ["finishedAt", "finished_at"], ["pastRuns", "past_runs"], ["lastPlayedAt", "last_played_at"], ["modes", "modes"], ["moods", "moods"],
  ["sessionMinutes", "session_minutes"], ["lengthHours", "length_hours"], ["demo", "demo"],
  ["createdAt", "created_at"], ["updatedAt", "updated_at"],
];

const copyCols: [keyof Copy, string][] = [
  ["id", "id"], ["gameId", "game_id"], ["platform", "platform"], ["edition", "edition"], ["format", "format"],
  ["availability", "availability"], ["subscriptionService", "subscription_service"], ["acquiredAt", "acquired_at"],
  ["pricePaid", "price_paid"], ["priceKind", "price_kind"], ["bundleWith", "bundle_with"], ["store", "store"], ["hasCase", "has_case"], ["hasFullArtwork", "has_full_artwork"],
  ["artworkUrl", "artwork_url"], ["shelfLocation", "shelf_location"],
  ["lentTo", "lent_to"], ["lentAt", "lent_at"], ["demo", "demo"], ["createdAt", "created_at"], ["updatedAt", "updated_at"],
];

const wishCols: [keyof WishItem, string][] = [
  ["id", "id"], ["title", "title"], ["coverUrl", "cover_url"], ["igdbId", "igdb_id"], ["platform", "platform"],
  ["priority", "priority"], ["targetPrice", "target_price"], ["notes", "notes"], ["genres", "genres"],
  ["prices", "prices"], ["demo", "demo"], ["createdAt", "created_at"], ["updatedAt", "updated_at"],
];

const extraCols: [keyof SagaExtra, string][] = [
  ["id", "id"], ["saga", "saga"], ["igdbId", "igdb_id"], ["title", "title"], ["coverUrl", "cover_url"],
  ["releaseDate", "release_date"], ["sagaOrder", "saga_order"], ["demo", "demo"], ["createdAt", "created_at"], ["updatedAt", "updated_at"],
];

/** Sin la tabla de los juegos de saga que no tienes (migración 0012 sin aplicar), la biblioteca carga igual. */
const missingTable = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /saga_extras/.test(error.message ?? "")));

const NUMERIC = new Set(["rating", "hours_played", "length_hours", "price_paid", "target_price"]);

function toRow<T>(item: T, cols: [keyof T, string][]): Row {
  const row: Row = {};
  for (const [key, col] of cols) {
    const value = item[key];
    row[col] = value === undefined ? null : value;
  }
  if (row.demo == null) row.demo = false;
  return row;
}

function fromRow<T>(row: Row, cols: [keyof T, string][]): T {
  const out: Record<string, unknown> = {};
  for (const [key, col] of cols) {
    let value = row[col];
    if (value != null && NUMERIC.has(col)) value = Number(value);
    out[key as string] = value;
  }
  return out as T;
}

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  constructor(private readonly db: SupabaseClient) {}

  async load(): Promise<Library> {
    const [games, copies, wishlist, extras] = await Promise.all([
      this.db.from("games").select("*"),
      this.db.from("copies").select("*"),
      this.db.from("wishlist").select("*"),
      this.db.from("saga_extras").select("*"),
    ]);
    for (const r of [games, copies, wishlist]) if (r.error) throw new Error(r.error.message);
    if (extras.error && !missingTable(extras.error)) throw new Error(extras.error.message);
    return {
      // Juegos sin vueltas guardadas: sin vueltas anteriores. (Guardar necesita la columna past_runs: migración 0010.)
      games: (games.data ?? []).map((r) => fromRow<Game>(r, gameCols)).map((g) => ({ ...g, pastRuns: g.pastRuns ?? [], saga: g.saga ?? null, sagaOrder: g.sagaOrder ?? null })),
      copies: (copies.data ?? []).map((r) => fromRow<Copy>(r, copyCols)),
      wishlist: (wishlist.data ?? []).map((r) => fromRow<WishItem>(r, wishCols)),
      extras: extras.error ? [] : (extras.data ?? []).map((r) => fromRow<SagaExtra>(r, extraCols)),
    };
  }

  async save(changes: Changes): Promise<void> {
    // Los juegos van primero: las copias dependen de ellos.
    if (changes.games?.length) await this.upsert("games", changes.games.map((g) => toRow(g, gameCols)));
    await Promise.all([
      changes.copies?.length ? this.upsert("copies", changes.copies.map((c) => toRow(c, copyCols))) : null,
      changes.wishlist?.length ? this.upsert("wishlist", changes.wishlist.map((w) => toRow(w, wishCols))) : null,
      changes.extras?.length ? this.upsert("saga_extras", changes.extras.map((x) => toRow(x, extraCols))) : null,
    ]);
  }

  private async upsert(table: string, rows: Row[]) {
    const { error } = await this.db.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  private async remove(table: string, column: string, value: string | boolean) {
    const { error } = await this.db.from(table).delete().eq(column, value);
    if (error) throw new Error(error.message);
  }

  deleteGame(id: string) {
    return this.remove("games", "id", id);
  }

  deleteCopy(id: string) {
    return this.remove("copies", "id", id);
  }
  deleteWish(id: string) {
    return this.remove("wishlist", "id", id);
  }

  deleteExtra(id: string) {
    return this.remove("saga_extras", "id", id);
  }

  async deleteAllGames() {
    // Las copias se borran en cascada con su juego. Supabase exige un filtro para borrar.
    const games = await this.db.from("games").delete().not("id", "is", null);
    if (games.error) throw new Error(games.error.message);
    const extras = await this.db.from("saga_extras").delete().not("id", "is", null);
    if (extras.error && !missingTable(extras.error)) throw new Error(extras.error.message);
  }

  async deleteDemo() {
    await this.remove("copies", "demo", true);
    await this.remove("games", "demo", true);
    await this.remove("wishlist", "demo", true);
    const extras = await this.db.from("saga_extras").delete().eq("demo", true);
    if (extras.error && !missingTable(extras.error)) throw new Error(extras.error.message);
  }
}
