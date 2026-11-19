"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { STAGES } from "@/app/juego/[id]/progress";
import { CARTRIDGE_URL, CHEST_OPEN_URL, DIGITAL_URL, KEEPER_URL } from "@/components/pixel/sprites";
import { StatusMark } from "@/components/ui/StatusMark";
import { GAME_STATUSES } from "@/lib/model";
import { reiniciarPistas } from "@/lib/pistas";
import styles from "./manual.module.css";

type Page = { title: string; art: ReactNode; text: ReactNode };

/* eslint-disable @next/next/no-img-element -- dibujos de píxeles propios */
const PAGES: Page[] = [
  {
    title: "Juegos y copias",
    art: (
      <div className={styles.copies} aria-hidden>
        <figure>
          <img src={CARTRIDGE_URL} alt="" />
          <figcaption>Físico</figcaption>
        </figure>
        <figure>
          <img src={DIGITAL_URL} alt="" />
          <figcaption>Digital</figcaption>
        </figure>
      </div>
    ),
    text: (
      <>
        <p>Un juego es la obra; cada copia, un ejemplar que tienes: su plataforma, su formato y de dónde salió.</p>
        <p>Un mismo juego puede tener varias copias, por ejemplo una en Switch y otra en PC.</p>
        <p>Con el teclado, la tecla / te lleva al buscador.</p>
      </>
    ),
  },
  {
    title: "Estados",
    art: (
      <ul className={styles.states}>
        {GAME_STATUSES.map((s) => (
          <li key={s}>
            <StatusMark status={s} />
          </li>
        ))}
      </ul>
    ),
    text: (
      <>
        <p>Cada juego está en uno de cinco estados, dichos como en una recreativa y con su nombre de siempre.</p>
        <p>El estado se cambia en la ficha de cada juego, y la biblioteca te deja filtrar por él.</p>
      </>
    ),
  },
  {
    title: "El mapa de la ficha",
    art: (
      <ol className={styles.stages}>
        {STAGES.map((stage, i) => (
          <li key={stage} data-done={i < 4 || undefined}>
            <b aria-hidden>{i + 1}</b>
            {stage}
          </li>
        ))}
      </ol>
    ),
    text: (
      <>
        <p>Cada juego es una aventura de siete niveles. Toca uno y la ficha te lleva a su misión.</p>
        <p>En la ficha, todo se cambia tocándolo y se guarda solo.</p>
      </>
    ),
  },
  {
    title: "Inserta moneda",
    art: (
      <div className={styles.coin} aria-hidden>
        Inserta moneda
        <small>He jugado hoy</small>
      </div>
    ),
    text: <p>Púlsalo en la ficha los días que juegues: apunta tu partida y la verás en «Última partida» y en tu inicio.</p>,
  },
  {
    title: "Añadir un juego",
    art: <img className={styles.sprite} src={CHEST_OPEN_URL} alt="" aria-hidden />,
    text: (
      <>
        <p>«Añadir juego» abre el cofre. Título, plataforma y formato bastan.</p>
        <p>Precio, horas, notas y estantería se completan después en la ficha.</p>
        <p>Con el teclado, la tecla A abre el cofre.</p>
      </>
    ),
  },
  {
    title: "¿A qué juego?",
    art: (
      <div className={styles.session} aria-hidden>
        <span>1 h</span>
        <span>Sola</span>
        <span data-on>Cualquier plataforma</span>
      </div>
    ),
    text: <p>Dile cuánto tiempo tienes y con quién juegas: te propone juegos de tu biblioteca que tienes disponibles y te explica por qué.</p>,
  },
  {
    title: "La guardiana",
    art: <img className={styles.sprite} src={KEEPER_URL} alt="" aria-hidden />,
    text: (
      <>
        <p>La primera vez que abres una ficha, la guardiana te cuenta lo esencial en un bocadillo, junto a ella en el mapa.</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            reiniciarPistas();
            toast("Las pistas volverán a salir en las fichas");
          }}
        >
          Volver a ver las pistas de la guardiana
        </button>
      </>
    ),
  },
];
/* eslint-enable @next/next/no-img-element */

/** El manual de instrucciones, como el librito de un juego: una página por tema. */
export function ManualView() {
  const router = useRouter();
  const params = useSearchParams();
  const asked = Number(params.get("pagina"));
  const index = Number.isInteger(asked) && asked >= 1 && asked <= PAGES.length ? asked - 1 : 0;
  const page = PAGES[index];

  const go = (i: number) => {
    if (i < 0 || i >= PAGES.length) return;
    router.replace(`/manual?pagina=${i + 1}`, { scroll: false });
  };

  // ← y → pasan de página, salvo mientras se escribe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={styles.page}>
      <Link href="/ajustes" className="back-link">
        <ChevronLeft aria-hidden />
        Ajustes
      </Link>
      <h1 className="screen-title">Manual de instrucciones</h1>

      <section key={index} className={`window ${styles.book}`} aria-labelledby="h-pagina">
        <div className={styles.art}>{page.art}</div>
        <div className={styles.text}>
          <h2 id="h-pagina">{page.title}</h2>
          {page.text}
        </div>
      </section>

      <nav className={styles.pager} aria-label="Páginas del manual">
        <button type="button" className="btn" disabled={index === 0} onClick={() => go(index - 1)}>
          <ChevronLeft aria-hidden />
          Anterior
        </button>
        <p aria-live="polite">
          Página {index + 1} de {PAGES.length}
        </p>
        <button type="button" className="btn" disabled={index === PAGES.length - 1} onClick={() => go(index + 1)}>
          Siguiente
          <ChevronRight aria-hidden />
        </button>
      </nav>

      <ol className={styles.index} aria-label="Índice">
        {PAGES.map((p, i) => (
          <li key={p.title}>
            <button type="button" aria-current={i === index ? "page" : undefined} onClick={() => go(i)}>
              {p.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
