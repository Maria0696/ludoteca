import {
  type Copy,
  type Game,
  type Library,
  type Mood,
  MOOD_LABEL,
  isCopyAvailable,
} from "./model";

/*
 * «¿A qué juego?»: recomendaciones por reglas, sin IA.
 *
 * Primero se descarta lo que no cumple los filtros (plataforma, copia
 * disponible, intención y compañía). Después se puntúa lo que queda con
 * reglas que se pueden explicar en una frase cada una. El tiempo disponible
 * se compara con la duración típica de una sesión (`sessionMinutes`), no con
 * la duración total del juego (`lengthHours`).
 */

export type Intent = "nuevo" | "continuar" | "cualquiera";
export type Company = "solo" | "acompanado";

export interface RecommendInput {
  /** Minutos disponibles en esta sesión; null = sin límite. */
  minutes: number | null;
  /** Plataforma elegida; null = cualquiera. */
  platform: string | null;
  intent: Intent;
  company: Company;
  mood: Mood | null;
}

export interface Recommendation {
  game: Game;
  copies: Copy[];
  score: number;
  reasons: string[];
  caveats: string[];
}

export interface RecommendResult {
  picks: Recommendation[];
  /** Total de juegos que cumplen los filtros (antes de puntuar). */
  eligible: number;
  /** Cuántos juegos cayó cada filtro, para explicar un resultado vacío. */
  excluded: { platform: number; unavailable: number; status: number; company: number; discarded: number };
  /** Datos que faltan entre los candidatos y limitan la recomendación. */
  limitations: string[];
}

const COMPANY_MODES = ["coop_local", "coop_online", "competitivo"] as const;

export function recommend(
  library: Library,
  input: RecommendInput,
  options: { discarded?: ReadonlySet<string>; count?: number; today?: Date } = {},
): RecommendResult {
  const discarded = options.discarded ?? new Set<string>();
  const count = options.count ?? 3;
  const today = options.today ?? new Date();
  const copiesByGame = groupCopies(library.copies);
  const excluded = { platform: 0, unavailable: 0, status: 0, company: 0, discarded: 0 };
  const scored: Recommendation[] = [];
  let missingSession = 0;
  let missingMood = 0;
  let missingModes = 0;

  for (const game of library.games) {
    const all = copiesByGame.get(game.id) ?? [];
    const onPlatform = input.platform ? all.filter((c) => c.platform === input.platform) : all;
    if (onPlatform.length === 0) {
      excluded.platform++;
      continue;
    }
    const available = onPlatform.filter(isCopyAvailable);
    if (available.length === 0) {
      excluded.unavailable++;
      continue;
    }
    if (!statusMatches(game, input.intent)) {
      excluded.status++;
      continue;
    }
    const companyFit = companyMatches(game, input.company);
    if (companyFit === "no") {
      excluded.company++;
      continue;
    }
    if (discarded.has(game.id)) {
      excluded.discarded++;
      continue;
    }

    const rec: Recommendation = { game, copies: available, score: 0, reasons: [], caveats: [] };

    if (companyFit === "unknown") {
      missingModes++;
      rec.score -= 1;
      rec.caveats.push(
        input.company === "acompanado"
          ? "No consta si admite jugar acompañada."
          : "No consta si se puede jugar en solitario.",
      );
    } else if (input.company === "acompanado") {
      rec.score += 2;
      rec.reasons.push("Se puede jugar acompañada.");
    }

    scoreTime(rec, input, () => missingSession++);
    scoreMood(rec, input, () => missingMood++);
    scoreProgress(rec, today);

    if (game.favorite) {
      rec.score += 1;
      rec.reasons.push("Está entre tus favoritos.");
    }
    scored.push(rec);
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (b.game.lastPlayedAt ?? "").localeCompare(a.game.lastPlayedAt ?? "") ||
      a.game.title.localeCompare(b.game.title, "es"),
  );

  const limitations: string[] = [];
  const eligible = scored.length;
  if (eligible > 0) {
    if (input.minutes !== null && missingSession > 0)
      limitations.push(
        `${missingSession} de ${eligible} candidatos no tienen duración de sesión; los he comparado sin ese dato.`,
      );
    if (input.mood && missingMood > 0)
      limitations.push(`${missingMood} de ${eligible} candidatos no tienen tipo de experiencia indicado.`);
    if (missingModes > 0)
      limitations.push(`${missingModes} de ${eligible} candidatos no indican si admiten jugar acompañada o en solitario.`);
  }

  return { picks: scored.slice(0, count), eligible, excluded, limitations };
}

function groupCopies(copies: Copy[]): Map<string, Copy[]> {
  const map = new Map<string, Copy[]>();
  for (const c of copies) {
    const list = map.get(c.gameId);
    if (list) list.push(c);
    else map.set(c.gameId, [c]);
  }
  return map;
}

function statusMatches(game: Game, intent: Intent): boolean {
  if (intent === "nuevo") return game.status === "pendiente";
  if (intent === "continuar") return game.status === "jugando" || game.status === "pausado";
  return game.status === "pendiente" || game.status === "jugando" || game.status === "pausado";
}

function companyMatches(game: Game, company: Company): "yes" | "no" | "unknown" {
  if (game.modes.length === 0) return "unknown";
  if (company === "acompanado") return game.modes.some((m) => (COMPANY_MODES as readonly string[]).includes(m)) ? "yes" : "no";
  return game.modes.includes("solo") ? "yes" : "no";
}

function scoreTime(rec: Recommendation, input: RecommendInput, onMissing: () => void) {
  const session = rec.game.sessionMinutes;
  if (input.minutes === null) return;
  if (session == null) {
    onMissing();
    rec.caveats.push("No sé cuánto dura una sesión de este juego.");
    return;
  }
  if (session <= input.minutes) {
    rec.score += 3;
    rec.reasons.push(`Una sesión suele durar unos ${formatMinutes(session)} y tienes ${formatMinutes(input.minutes)}.`);
  } else if (session <= input.minutes * 1.5) {
    rec.caveats.push(`Las sesiones suelen alargarse a unos ${formatMinutes(session)}.`);
  } else {
    rec.score -= 3;
    rec.caveats.push(`Una sesión suele pedir ${formatMinutes(session)}, más de lo que tienes.`);
  }
  if (input.intent !== "continuar" && rec.game.status === "pendiente" && rec.game.lengthHours != null && rec.game.lengthHours <= 10) {
    rec.score += 1;
    rec.reasons.push(`Es corto: unas ${formatHours(rec.game.lengthHours)} en total.`);
  }
}

function scoreMood(rec: Recommendation, input: RecommendInput, onMissing: () => void) {
  if (!input.mood) return;
  const moods = rec.game.moods;
  if (moods.length === 0) {
    onMissing();
    return;
  }
  if (moods.includes(input.mood)) {
    rec.score += 3;
    rec.reasons.push(`Lo marcaste como «${MOOD_LABEL[input.mood]}».`);
  } else {
    rec.score -= 2;
    rec.caveats.push(`No lo marcaste como «${MOOD_LABEL[input.mood]}».`);
  }
  if (input.mood === "rapida" && rec.game.sessionMinutes != null && rec.game.sessionMinutes <= 30) {
    rec.score += 1;
  }
}

function scoreProgress(rec: Recommendation, today: Date) {
  const g = rec.game;
  if (g.status === "jugando") {
    rec.score += 2;
    rec.reasons.push("Lo estás jugando: retomarlo cuesta poco.");
  } else if (g.status === "pausado") {
    rec.score += 1;
    rec.reasons.push(g.lastPlayedAt ? `Lo dejaste en pausa; última partida ${describeAgo(g.lastPlayedAt, today)}.` : "Lo dejaste en pausa.");
  } else if (g.status === "pendiente") {
    const acquired = rec.copies.map((c) => c.acquiredAt).filter(Boolean).sort()[0];
    if (acquired) {
      const years = (today.getTime() - Date.parse(acquired)) / (365.25 * 86_400_000);
      if (years >= 1) {
        rec.score += Math.min(1.5, years / 2);
        rec.reasons.push(`Lleva esperando desde ${formatMonthYear(acquired)}.`);
      }
    }
  }
  if (g.lastPlayedAt && g.status !== "pendiente") {
    const days = (today.getTime() - Date.parse(g.lastPlayedAt)) / 86_400_000;
    if (days <= 3) rec.score += 1;
  }
  if (g.rating != null && g.rating >= 8) rec.score += 0.5;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatHours(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;
}

function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(iso));
}

function describeAgo(iso: string, today: Date): string {
  const days = Math.round((today.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.round(days / 30);
  if (months < 12) return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.round(months / 12);
  return `hace ${years} ${years === 1 ? "año" : "años"}`;
}
