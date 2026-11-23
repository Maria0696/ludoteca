"use client";

import { BookOpen, Download, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { manualPageCount } from "@/app/manual/ManualView";
import { Dialog } from "@/components/ui/Dialog";
import { OptionRow } from "@/components/ui/OptionRow";
import { downloadBackup } from "@/lib/backup-download";
import { REMIND_CHOICES, REMIND_KEY, type RemindChoice, describeLastBackup, useBackupStatus } from "@/lib/backup-reminder";
import { DEMO_ART } from "@/lib/demo-art";
import { useLocalChoice } from "@/lib/local-choice";
import { PISTAS_MODES, PISTAS_MODE_KEY, type PistasMode } from "@/lib/pistas";
import { useLibrary } from "@/lib/store";
import { TITLE_MODES, TITLE_MODE_KEY, type TitleMode } from "@/lib/title-screen";
import { DeleteAllGames } from "./DeleteAllGames";
import { SETTINGS_ICON_URL, type SettingsIcon } from "./icons";
import styles from "./settings.module.css";

type Slug = SettingsIcon;

/** Los nombres de los apartados de antes siguen llevando a su sitio. */
const OLD_SLUGS: Record<string, Slug> = { copia: "partida", datos: "cuenta", catalogo: "ayuda", steam: "traer", creditos: "demostracion", eliminar: "borrar" };

const TITLE_LABEL: Record<TitleMode, string> = { siempre: "Siempre", diaria: "Una vez al día", nunca: "Nunca" };
const TITLE_STATUS: Record<TitleMode, string> = { siempre: "Título siempre", diaria: "Título una vez al día", nunca: "Sin pantalla de título" };
const PISTAS_LABEL: Record<PistasMode, string> = { activadas: "Activadas", desactivadas: "Desactivadas" };
const REMIND_LABEL: Record<RemindChoice, string> = { "7": "Cada semana", "14": "Cada 2 semanas", "30": "Cada mes", nunca: "Nunca" };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** La copia en pocas palabras, para el icono: «Copia de hoy», «Copia de hace 3 días»… */
function backupShort(days: number | null | undefined): string {
  if (days === undefined) return "Copia de seguridad";
  if (days === null) return "Sin copia todavía";
  if (days === 0) return "Copia de hoy";
  if (days === 1) return "Copia de ayer";
  return `Copia de hace ${days} días`;
}

/*
 * Ajustes como los de una consola: una columna de iconos de píxeles, cada uno con su estado debajo,
 * y el panel del elegido al lado. En el móvil, los iconos van de dos en dos y el panel queda debajo.
 */
export function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { library, mode, actions } = useLibrary();
  const backup = useBackupStatus();
  const [titleMode, setTitleMode] = useLocalChoice<TitleMode>(TITLE_MODE_KEY, "diaria", TITLE_MODES);
  const [pistas, setPistas] = useLocalChoice<PistasMode>(PISTAS_MODE_KEY, "activadas", PISTAS_MODES);
  const [remind, setRemind] = useLocalChoice<RemindChoice>(REMIND_KEY, "30", REMIND_CHOICES);
  const [includeDemo, setIncludeDemo] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<"comprobando" | "si" | "no">("comprobando");
  const [email, setEmail] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const demoCount = library.games.filter((g) => g.demo).length + library.wishlist.filter((w) => w.demo).length;
  const realCount = library.games.filter((g) => !g.demo).length;
  // En tu biblioteca real no se ofrece; solo aparecería para retirar datos que hubieran quedado.
  const showDemo = mode === "local" || demoCount > 0;
  const games = library.games.length;

  const sections: { slug: Slug; label: string; status: string; danger?: boolean }[] = [
    { slug: "partida", label: "Partida guardada", status: backupShort(backup?.daysSinceBackup) },
    { slug: "traer", label: "Traer juegos", status: "De Steam o un archivo" },
    { slug: "pantalla", label: "Pantalla", status: TITLE_STATUS[titleMode] },
    { slug: "ayuda", label: "Ayuda", status: `Manual de ${manualPageCount()} páginas` },
    { slug: "cuenta", label: "Cuenta", status: mode === "local" ? "Modo local" : "Sincronizada" },
    ...(showDemo ? [{ slug: "demostracion" as const, label: "Demostración", status: demoCount > 0 ? count(demoCount, "elemento", "elementos") : "Sin cargar" }] : []),
    { slug: "borrar", label: "Borrar todo", status: games > 0 ? count(games, "juego", "juegos") : "Biblioteca vacía", danger: true },
  ];
  const raw = params.get("apartado") ?? "";
  const asked = sections.find((s) => s.slug === (OLD_SLUGS[raw] ?? raw))?.slug;
  const current = asked ?? sections[0].slug;
  const section = sections.find((s) => s.slug === current)!;

  useEffect(() => {
    fetch("/api/catalogo/estado")
      .then((r) => r.json())
      .then((d: { configured: boolean }) => setCatalog(d.configured ? "si" : "no"))
      .catch(() => setCatalog("no"));
  }, []);

  useEffect(() => {
    if (mode !== "supabase") return;
    void import("@/lib/supabase/client").then(({ getBrowserSupabase }) =>
      getBrowserSupabase()
        .auth.getUser()
        .then(({ data }) => setEmail(data.user?.email ?? null)),
    );
  }, [mode]);

  // En el móvil el panel queda bajo los iconos: al elegir uno, se baja hasta él.
  useEffect(() => {
    if (asked && window.matchMedia("(max-width: 899px)").matches) panelRef.current?.scrollIntoView({ block: "start" });
  }, [asked]);

  async function leave() {
    const { getBrowserSupabase } = await import("@/lib/supabase/client");
    await getBrowserSupabase().auth.signOut();
    router.replace("/entrar?adios=1");
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <h1 className="screen-title">Ajustes</h1>

      <div className={styles.console}>
        <nav className={`window ${styles.tiles}`} aria-label="Apartados de Ajustes">
          <ul>
            {sections.map((s) => (
              <li key={s.slug} data-danger={s.danger || undefined}>
                <Link href={`/ajustes?apartado=${s.slug}`} scroll={false} aria-current={current === s.slug ? "page" : undefined} className={styles.tile}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio, como la guardiana */}
                  <img src={SETTINGS_ICON_URL[s.slug]} alt="" width={48} height={48} />
                  <span>
                    <b>{s.label}</b>
                    <small>{s.status}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section ref={panelRef} className={`window ${styles.panel}`} data-danger={section.danger || undefined} aria-labelledby="h-apartado">
          <header className={styles.head}>
            {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio, como la guardiana */}
            <img src={SETTINGS_ICON_URL[current]} alt="" width={64} height={64} />
            <div>
              <h2 id="h-apartado">{section.label}</h2>
              <p>{LEADS[current](mode)}</p>
            </div>
          </header>

          {current === "partida" && (
            <>
              <div className={styles.prow}>
                <p className={styles.name}>
                  Copia de seguridad
                  <small>{backup ? describeLastBackup(backup.daysSinceBackup) : "Un archivo con tus juegos, copias y deseos."}</small>
                </p>
                <button type="button" className="btn btn-ink" onClick={() => toast(`Copia exportada: ${downloadBackup(library, { includeDemo })}`)}>
                  <Download aria-hidden />
                  Exportar copia
                </button>
              </div>
              {demoCount > 0 && (
                <label className={`check ${styles.check}`}>
                  <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
                  Incluir los datos de demostración en la copia
                </label>
              )}
              <div className={styles.options}>
                <OptionRow
                  label="Recordarme guardar"
                  hint="Un aviso en el inicio"
                  options={REMIND_CHOICES.map((c) => ({ value: c, label: REMIND_LABEL[c] }))}
                  value={remind}
                  onChange={setRemind}
                />
              </div>
              <p className={styles.note}>
                ¿Recuperar una copia? Está en <Link href="/importar?origen=copia">Traer juegos</Link>, junto a Steam.
              </p>
            </>
          )}

          {current === "traer" && (
            <ul className={styles.sources}>
              <li>
                <Link href="/importar?origen=copia">
                  <b>Copia de seguridad</b>
                  <span>Recuperar tu partida guardada</span>
                </Link>
              </li>
              <li>
                <Link href="/importar?origen=steam">
                  <b>Steam</b>
                  <span>Tus juegos y tus horas</span>
                </Link>
              </li>
            </ul>
          )}

          {current === "pantalla" && (
            <div className={styles.options}>
              <OptionRow
                label="Pantalla de título"
                hint="«Pulsa Start» al entrar en el inicio"
                options={TITLE_MODES.map((m) => ({ value: m, label: TITLE_LABEL[m] }))}
                value={titleMode}
                onChange={setTitleMode}
              />
              <OptionRow
                label="Pistas de la guardiana"
                hint="Te explica cada pantalla la primera vez"
                options={PISTAS_MODES.map((m) => ({ value: m, label: PISTAS_LABEL[m] }))}
                value={pistas}
                onChange={setPistas}
              />
            </div>
          )}

          {current === "ayuda" && (
            <>
              <div className={styles.prow}>
                <p className={styles.name}>
                  Manual de instrucciones
                  <small>Juegos y copias, estados, el mapa de la ficha, ¿A qué juego?…</small>
                </p>
                <Link href="/manual" className="btn" aria-label="Abrir el manual">
                  <BookOpen aria-hidden />
                  Abrir
                </Link>
              </div>
              <p className={styles.note}>
                {catalog === "comprobando"
                  ? "Comprobando el catálogo de carátulas…"
                  : catalog === "si"
                    ? "Al escribir un título verás sugerencias del catálogo: carátula, géneros y duración. Datos de IGDB.com, gratuito para uso no comercial."
                    : "El catálogo de carátulas no está conectado: la carátula, los géneros y la duración se escriben a mano."}
              </p>
            </>
          )}

          {current === "cuenta" && (
            <>
              {mode === "local" ? (
                <p className={styles.text}>
                  Tu biblioteca se guarda solo en este navegador. No se sincroniza con otros dispositivos y se pierde si borras los datos del navegador:
                  guarda copias a menudo en «Partida guardada».
                </p>
              ) : (
                <div className={styles.prow}>
                  <p className={styles.name}>
                    {email ?? "Tu cuenta"}
                    <small>
                      <i className={styles.dot} aria-hidden /> Sincronizada en la nube
                    </small>
                  </p>
                  <button type="button" className="btn" onClick={() => void leave()}>
                    <LogOut aria-hidden />
                    Salir de la ludoteca
                  </button>
                </div>
              )}
              {mode !== "local" && <p className={styles.note}>Al salir, la guardiana cierra la puerta y te pide el correo para volver a entrar.</p>}
            </>
          )}

          {current === "demostracion" && (
            <>
              <div className={styles.prow}>
                <p className={styles.name}>
                  Datos de demostración
                  <small>
                    {demoCount > 0
                      ? `Ahora hay ${demoCount} elementos de demostración ${ownGamesBeside(realCount)}.`
                      : "No hay datos de demostración cargados."}
                  </small>
                </p>
                {demoCount > 0 ? (
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmDemo(true)}>
                    Retirar datos de demostración
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await actions.loadDemo();
                      setBusy(false);
                      toast("Datos de demostración cargados");
                    }}
                  >
                    {busy ? "Cargando…" : "Cargar datos de demostración"}
                  </button>
                )}
              </div>
              <details className={styles.credits}>
                <summary>Ver las {DEMO_ART.length} obras de las imágenes y sus fuentes</summary>
                <ul>
                  {DEMO_ART.map((a) => (
                    <li key={a.key}>
                      <a href={a.page} target="_blank" rel="noreferrer">
                        {a.title}
                      </a>
                      {a.creator ? `, ${a.creator}` : ""} · {a.license} · {a.via}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}

          {current === "borrar" && <DeleteAllGames />}
        </section>
      </div>

      <Dialog
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        title="¿Retirar los datos de demostración?"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmDemo(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                setConfirmDemo(false);
                await actions.removeDemo();
                toast("Datos de demostración retirados");
              }}
            >
              Retirar {demoCount} elementos
            </button>
          </>
        }
      >
        <p>Se eliminan los juegos, copias y deseos de demostración. {ownGamesKept(realCount)}</p>
      </Dialog>
    </div>
  );
}

/** La frase bajo el título de cada panel. */
const LEADS: Record<Slug, (mode: "local" | "supabase" | null) => string> = {
  partida: (mode) =>
    `Tu biblioteca ${mode === "local" ? "vive solo en este navegador" : "está a salvo en la nube"}; la copia es tu partida guardada en tu ordenador, por si algo se borrara.`,
  traer: () => "Lo que ya tienes no se duplica: puedes traer juegos tantas veces como quieras.",
  pantalla: () => "Cómo te recibe la ludoteca.",
  ayuda: () => "Cómo funciona todo, contado con calma.",
  cuenta: (mode) =>
    mode === "local" ? "Modo local: sin cuenta, todo en este navegador." : "Tu biblioteca se ve igual en todos tus dispositivos. Solo tu cuenta puede abrirla.",
  demostracion: () => "Juegos inventados para probar la app. Están marcados y se retiran de una vez sin tocar tu colección.",
  borrar: () => "Vacía la biblioteca de una vez. Tu lista de deseos no se toca.",
};

/** «junto a 3 juegos tuyos», sin hablar de «0 juegos» ni de «1 juegos». */
function ownGamesBeside(n: number) {
  if (n === 0) return "y ningún juego tuyo";
  return `junto a ${n} ${n === 1 ? "juego tuyo" : "juegos tuyos"}`;
}

function ownGamesKept(n: number) {
  if (n === 0) return "No tienes juegos tuyos todavía: solo se va lo de demostración.";
  return n === 1 ? "Tu juego no se toca." : `Tus ${n} juegos no se tocan.`;
}
