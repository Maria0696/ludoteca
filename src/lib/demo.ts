import { demoBackdropUrl, demoCoverUrl } from "./demo-art";
import type { Copy, Game, GameList, GameStatus, Library, Mood, PlayMode, WishItem } from "./model";
import { newId } from "./model";

/*
 * Datos de demostración. Todo lo que crea este módulo lleva `demo: true`
 * y se retira de una vez desde Ajustes, sin tocar tu colección real.
 * Las carátulas son obras de arte de dominio público (ver demo-art.ts),
 * no arte oficial de los juegos.
 */

const ART_KEY: Record<string, string> = {
  "Kirby y la tierra olvidada": "kirby",
  "The Legend of Zelda: Tears of the Kingdom": "zelda-tears-of-the-kingdom",
};

/** Clave del arte de demostración: el título en minúsculas y con guiones. */
export function demoArtKey(title: string): string {
  return (
    ART_KEY[title] ??
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

interface DemoGame {
  title: string;
  status: GameStatus;
  genres: string[];
  modes: PlayMode[];
  moods: Mood[];
  session?: number;
  length?: number;
  rating?: number;
  hours?: number;
  favorite?: boolean;
  completed100?: boolean;
  finishedMonthsAgo?: number;
  lastPlayedDaysAgo?: number;
  copies: { platform: string; format: "fisico" | "digital"; acquiredMonthsAgo: number; price?: number; store?: string; edition?: string; availability?: Copy["availability"]; hasCase?: boolean; hasFullArtwork?: boolean; artworkPrintPending?: boolean; shelf?: string; lentTo?: string }[];
}

const GAMES: DemoGame[] = [
  { title: "Hades", status: "jugando", genres: ["Roguelike", "Acción"], modes: ["solo"], moods: ["accion", "reto", "rapida"], session: 30, length: 22, rating: 9.5, hours: 41, favorite: true, lastPlayedDaysAgo: 1,
    copies: [{ platform: "Switch", format: "digital", acquiredMonthsAgo: 30, price: 24.99, store: "Nintendo eShop", hasCase: true, hasFullArtwork: false, artworkPrintPending: true, shelf: "Balda 2" }] },
  { title: "Hollow Knight", status: "pausado", genres: ["Metroidvania", "Plataformas"], modes: ["solo"], moods: ["reto", "accion"], session: 60, length: 30, rating: 9, hours: 18, lastPlayedDaysAgo: 120,
    copies: [{ platform: "Switch", format: "digital", acquiredMonthsAgo: 40, price: 14.99, store: "Nintendo eShop", hasCase: true, hasFullArtwork: true, shelf: "Balda 2" }] },
  { title: "Spiritfarer", status: "jugando", genres: ["Gestión", "Aventura"], modes: ["solo", "coop_local"], moods: ["tranquila", "historia"], session: 45, length: 30, rating: 8.5, hours: 12, lastPlayedDaysAgo: 4,
    copies: [{ platform: "Switch", format: "digital", acquiredMonthsAgo: 8, price: 29.99, store: "Nintendo eShop" }] },
  { title: "Metroid Dread", status: "pendiente", genres: ["Metroidvania"], modes: ["solo"], moods: ["accion", "reto"], session: 60, length: 9,
    copies: [{ platform: "Switch", format: "fisico", acquiredMonthsAgo: 26, price: 49.95, store: "GAME", shelf: "Balda 1" }] },
  { title: "Kirby y la tierra olvidada", status: "pendiente", genres: ["Plataformas"], modes: ["solo", "coop_local"], moods: ["tranquila", "accion"], session: 40, length: 12,
    copies: [{ platform: "Switch", format: "fisico", acquiredMonthsAgo: 14, price: 44.9, store: "El Corte Inglés", shelf: "Balda 1" }] },
  { title: "Overcooked! 2", status: "pendiente", genres: ["Cooperativo", "Fiesta"], modes: ["coop_local", "coop_online"], moods: ["rapida", "accion"], session: 20, length: 10,
    copies: [{ platform: "Switch", format: "fisico", acquiredMonthsAgo: 20, price: 19.99, store: "Amazon", shelf: "Balda 1" }] },
  { title: "The Legend of Zelda: Tears of the Kingdom", status: "completado", genres: ["Aventura", "Mundo abierto"], modes: ["solo"], moods: ["historia", "tranquila"], session: 90, length: 60, rating: 10, hours: 132, favorite: true, finishedMonthsAgo: 10,
    copies: [{ platform: "Switch", format: "fisico", acquiredMonthsAgo: 29, price: 69.99, store: "GAME", edition: "Edición coleccionista", shelf: "Balda 1" }] },
  { title: "Celeste", status: "completado", genres: ["Plataformas"], modes: ["solo"], moods: ["reto", "rapida", "historia"], session: 30, length: 8, rating: 9, hours: 14, completed100: true, finishedMonthsAgo: 3,
    copies: [{ platform: "Switch", format: "fisico", acquiredMonthsAgo: 36, price: 29.99, store: "Amazon", shelf: "Balda 1" }, { platform: "PC", format: "digital", acquiredMonthsAgo: 50, price: 4.99, store: "Steam" }] },
  { title: "Unpacking", status: "completado", genres: ["Puzles"], modes: ["solo"], moods: ["tranquila", "rapida"], session: 25, length: 4, rating: 8, hours: 5, finishedMonthsAgo: 2,
    copies: [{ platform: "Switch", format: "digital", acquiredMonthsAgo: 6, price: 19.99, store: "Nintendo eShop" }] },
  { title: "Astro Bot", status: "jugando", genres: ["Plataformas"], modes: ["solo"], moods: ["tranquila", "accion"], session: 30, length: 12, rating: 9, hours: 6, lastPlayedDaysAgo: 2,
    copies: [{ platform: "PS5", format: "fisico", acquiredMonthsAgo: 2, price: 59.99, store: "MediaMarkt", shelf: "Balda 3" }] },
  { title: "It Takes Two", status: "pendiente", genres: ["Aventura", "Cooperativo"], modes: ["coop_local", "coop_online"], moods: ["historia", "accion"], session: 60, length: 14,
    copies: [{ platform: "PS5", format: "fisico", acquiredMonthsAgo: 18, price: 29.99, store: "GAME", shelf: "Balda 3" }, { platform: "PC", format: "digital", acquiredMonthsAgo: 12, availability: "suscripcion" }] },
  { title: "Outer Wilds", status: "pendiente", genres: ["Exploración", "Misterio"], modes: ["solo"], moods: ["historia"], session: 60, length: 18,
    copies: [{ platform: "PS5", format: "digital", acquiredMonthsAgo: 34, price: 12.49, store: "PlayStation Store" }] },
  { title: "Final Fantasy VII Remake", status: "pendiente", genres: ["Rol", "Acción"], modes: ["solo"], moods: ["historia", "accion"], session: 90, length: 35,
    copies: [{ platform: "PS5", format: "fisico", acquiredMonthsAgo: 22, price: 24.95, store: "CEX", edition: "Intergrade", shelf: "Balda 3" }] },
  { title: "Ghost of Tsushima", status: "pausado", genres: ["Acción", "Mundo abierto"], modes: ["solo"], moods: ["historia", "accion"], session: 60, length: 40, rating: 8, hours: 23, lastPlayedDaysAgo: 200,
    copies: [{ platform: "PS5", format: "fisico", acquiredMonthsAgo: 31, price: 39.99, store: "GAME", edition: "Director's Cut", shelf: "Balda 3" }] },
  { title: "Returnal", status: "abandonado", genres: ["Roguelike", "Disparos"], modes: ["solo"], moods: ["reto", "accion"], session: 45, length: 25, rating: 6, hours: 9,
    copies: [{ platform: "PS5", format: "digital", acquiredMonthsAgo: 28, availability: "suscripcion" }] },
  { title: "Red Dead Redemption 2", status: "pausado", genres: ["Aventura", "Mundo abierto"], modes: ["solo"], moods: ["historia", "tranquila"], session: 120, length: 50, rating: 9, hours: 37, lastPlayedDaysAgo: 400,
    copies: [{ platform: "PS4", format: "fisico", acquiredMonthsAgo: 60, price: 19.9, store: "Wallapop", shelf: "Balda 4", lentTo: "Lucía" }] },
  { title: "Inside", status: "completado", genres: ["Puzles", "Plataformas"], modes: ["solo"], moods: ["historia"], session: 60, length: 4, rating: 8.5, hours: 4, finishedMonthsAgo: 26,
    copies: [{ platform: "PS4", format: "digital", acquiredMonthsAgo: 48, price: 4.99, store: "PlayStation Store" }] },
  { title: "Stardew Valley", status: "jugando", genres: ["Gestión", "Granja"], modes: ["solo", "coop_online"], moods: ["tranquila", "rapida"], session: 30, length: 60, rating: 9, hours: 88, favorite: true, lastPlayedDaysAgo: 6,
    copies: [{ platform: "PC", format: "digital", acquiredMonthsAgo: 70, price: 13.99, store: "Steam" }] },
  { title: "Disco Elysium", status: "abandonado", genres: ["Rol", "Narrativo"], modes: ["solo"], moods: ["historia"], session: 90, length: 25, rating: 7, hours: 11,
    copies: [{ platform: "PC", format: "digital", acquiredMonthsAgo: 44, price: 9.99, store: "GOG" }] },
  { title: "Baldur's Gate 3", status: "pendiente", genres: ["Rol"], modes: ["solo", "coop_online"], moods: ["historia"], session: 120, length: 75,
    copies: [{ platform: "PC", format: "digital", acquiredMonthsAgo: 11, price: 59.99, store: "Steam" }] },
  { title: "Mario Kart 8 Deluxe", status: "jugando", genres: ["Carreras"], modes: ["solo", "competitivo", "coop_local"], moods: ["rapida", "accion"], session: 15, rating: 8, hours: 60, lastPlayedDaysAgo: 9,
    copies: [{ platform: "Switch", format: "fisico", acquiredMonthsAgo: 66, price: 49.99, store: "GAME", shelf: "Balda 1" }] },
  { title: "A Short Hike", status: "pendiente", genres: ["Aventura"], modes: ["solo"], moods: ["tranquila", "rapida"], session: 30, length: 3,
    copies: [{ platform: "PC", format: "digital", acquiredMonthsAgo: 16, price: 6.99, store: "Steam" }] },
];

const WISHES: { title: string; platform: string; priority: WishItem["priority"]; target?: number; notes?: string; genres: string[]; prices?: { amount: number; store: string; daysAgo: number }[] }[] = [
  { title: "Hollow Knight: Silksong", platform: "Switch 2", priority: "alta", target: 15, genres: ["Metroidvania"], prices: [{ amount: 19.5, store: "Nintendo eShop", daysAgo: 12 }] },
  { title: "Split Fiction", platform: "PS5", priority: "alta", target: 30, notes: "Para jugar en pareja después de It Takes Two.", genres: ["Cooperativo"], prices: [{ amount: 49.99, store: "PlayStation Store", daysAgo: 40 }, { amount: 37.9, store: "Amazon", daysAgo: 3 }] },
  { title: "Okami HD", platform: "Switch", priority: "media", target: 12, genres: ["Aventura"] },
  { title: "Pentiment", platform: "PC", priority: "baja", genres: ["Narrativo"], notes: "Esperar a una rebaja." },
];

const LISTS: { name: string; titles: string[] }[] = [
  { name: "Para jugar con mi pareja", titles: ["It Takes Two", "Overcooked! 2", "Mario Kart 8 Deluxe", "Spiritfarer"] },
  { name: "Partidas rápidas", titles: ["Mario Kart 8 Deluxe", "Hades", "Unpacking", "A Short Hike"] },
  { name: "Mis favoritos", titles: ["The Legend of Zelda: Tears of the Kingdom", "Hades", "Stardew Valley"] },
];

function isoDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function createDemoLibrary(today = new Date()): Library {
  const games: Game[] = [];
  const copies: Copy[] = [];
  const idByTitle = new Map<string, string>();

  GAMES.forEach((d, index) => {
    const id = newId();
    idByTitle.set(d.title, id);
    const created = new Date(today.getTime() - (GAMES.length - index) * 86_400_000 * 9).toISOString();
    games.push({
      id,
      title: d.title,
      coverUrl: demoCoverUrl(demoArtKey(d.title)),
      backdropUrl: demoBackdropUrl(demoArtKey(d.title)),
      igdbId: null,
      genres: d.genres,
      tags: [],
      status: d.status,
      completed100: d.completed100 ?? false,
      favorite: d.favorite ?? false,
      rating: d.rating ?? null,
      hoursPlayed: d.hours ?? null,
      notes: null,
      // Empezado siempre antes de la última partida y de la fecha de fin.
      startedAt:
        d.status !== "pendiente"
          ? isoDaysAgo(today, Math.max(d.lastPlayedDaysAgo ?? 0, (d.finishedMonthsAgo ?? 0) * 30) + 40)
          : null,
      finishedAt: d.finishedMonthsAgo != null ? isoDaysAgo(today, d.finishedMonthsAgo * 30) : null,
      lastPlayedAt: d.lastPlayedDaysAgo != null ? isoDaysAgo(today, d.lastPlayedDaysAgo) : d.finishedMonthsAgo != null ? isoDaysAgo(today, d.finishedMonthsAgo * 30) : null,
      modes: d.modes,
      moods: d.moods,
      sessionMinutes: d.session ?? null,
      lengthHours: d.length ?? null,
      createdAt: created,
      updatedAt: created,
      demo: true,
    });
    for (const c of d.copies) {
      copies.push({
        id: newId(),
        gameId: id,
        platform: c.platform,
        edition: c.edition ?? null,
        format: c.format,
        availability: c.availability ?? "comprado",
        subscriptionService: c.availability === "suscripcion" ? (c.platform === "PC" ? "PC Game Pass" : "PlayStation Plus") : null,
        acquiredAt: isoDaysAgo(today, c.acquiredMonthsAgo * 30),
        pricePaid: c.price ?? null,
        store: c.store ?? null,
        hasCase: c.hasCase ?? (c.format === "fisico" ? true : null),
        hasFullArtwork: c.hasFullArtwork ?? (c.format === "fisico" ? true : null),
        artworkPrintPending: c.artworkPrintPending ?? null,
        artworkUrl: null,
        shelfLocation: c.shelf ?? null,
        lentTo: c.lentTo ?? null,
        lentAt: c.lentTo ? isoDaysAgo(today, 20) : null,
        createdAt: created,
        updatedAt: created,
        demo: true,
      });
    }
  });

  const stamp = today.toISOString();
  const wishlist: WishItem[] = WISHES.map((w) => ({
    id: newId(),
    title: w.title,
    coverUrl: demoCoverUrl(demoArtKey(w.title)),
    igdbId: null,
    platform: w.platform,
    priority: w.priority,
    targetPrice: w.target ?? null,
    notes: w.notes ?? null,
    genres: w.genres,
    prices: (w.prices ?? []).map((p) => ({ id: newId(), amount: p.amount, store: p.store, date: isoDaysAgo(today, p.daysAgo) })),
    createdAt: stamp,
    updatedAt: stamp,
    demo: true,
  }));

  const lists: GameList[] = LISTS.map((l) => ({
    id: newId(),
    name: l.name,
    gameIds: l.titles.map((t) => idByTitle.get(t)).filter((id): id is string => !!id),
    createdAt: stamp,
    updatedAt: stamp,
    demo: true,
  }));

  return { games, copies, wishlist, lists };
}
