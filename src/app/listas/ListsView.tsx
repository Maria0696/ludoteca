"use client";

import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { GameCard } from "@/components/game/GameCard";
import gameStyles from "@/components/game/game.module.css";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/fields";
import { buildEntries } from "@/lib/filters";
import { normalizeTitle } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import styles from "./lists.module.css";

export function ListsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { library, actions } = useLibrary();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const selectedId = params.get("id") ?? library.lists[0]?.id ?? null;
  const selected = library.lists.find((l) => l.id === selectedId) ?? null;
  const entries = useMemo(() => buildEntries(library), [library]);
  const listEntries = useMemo(
    () => (selected ? selected.gameIds.map((id) => entries.find((e) => e.game.id === id)).filter((e) => e !== undefined) : []),
    [selected, entries],
  );

  const select = (id: string) => router.replace(`${pathname}?id=${id}`, { scroll: false });

  return (
    <div className={styles.page}>
      <Link href="/biblioteca" className={styles.back}>
        <ArrowLeft aria-hidden />
        Biblioteca
      </Link>
      <h1 className={styles.title}>Mis listas</h1>

      <div className={styles.layout}>
        <aside className={styles.aside}>
          <form
            className={styles.newList}
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return setNameError("Ponle un nombre a la lista.");
              if (library.lists.some((l) => normalizeTitle(l.name) === normalizeTitle(name))) return setNameError("Ya tienes una lista con ese nombre.");
              const list = actions.addList(name);
              setName("");
              setNameError(null);
              select(list.id);
            }}
          >
            <label htmlFor="new-list" className="sr-only">
              Nombre de la nueva lista
            </label>
            <input
              id="new-list"
              className="input"
              placeholder="Nueva lista, p. ej. Partidas rápidas"
              value={name}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "new-list-error" : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn btn-ink">
              <Plus aria-hidden />
              Crear
            </button>
            {nameError && (
              <p className="error" id="new-list-error" style={{ gridColumn: "1 / -1" }}>
                {nameError}
              </p>
            )}
          </form>
          {library.lists.length > 0 && (
            <ul className={styles.lists} aria-label="Listas">
              {library.lists.map((l) => (
                <li key={l.id}>
                  <button type="button" aria-current={l.id === selectedId ? "true" : undefined} onClick={() => select(l.id)}>
                    <span>{l.name}</span>
                    <small className="num">{l.gameIds.length}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={styles.main} aria-label={selected ? `Lista ${selected.name}` : "Lista"}>
          {!selected ? (
            <div className="empty">
              <h2>Sin listas todavía</h2>
              <p>Crea listas a tu medida: «Para jugar con mi pareja», «Partidas rápidas», «Mis favoritos»… Un juego puede estar en varias.</p>
            </div>
          ) : (
            <>
              <div className={styles.listHead}>
                <TextField label="Nombre de la lista" value={selected.name} onSave={(v) => v && actions.renameList(selected.id, v)} maxLength={80} />
                <div className={styles.listActions}>
                  <button type="button" className="btn btn-ink" onClick={() => setPicker(true)}>
                    <Plus aria-hidden />
                    Añadir juegos
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      actions.deleteList(selected.id);
                      router.replace(pathname);
                    }}
                  >
                    <Trash2 aria-hidden />
                    Eliminar lista
                  </button>
                </div>
              </div>
              {listEntries.length === 0 ? (
                <div className="empty">
                  <h2>Lista vacía</h2>
                  <p>Añade juegos desde aquí o desde la ficha de cada juego.</p>
                </div>
              ) : (
                <ul className={gameStyles.grid}>
                  {listEntries.map((e) => (
                    <GameCard key={e.game.id} entry={e} />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      {picker && selected && (
        <GamePicker
          listName={selected.name}
          selectedIds={selected.gameIds}
          onToggle={(gameId) => actions.toggleInList(selected.id, gameId)}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

function GamePicker({
  listName,
  selectedIds,
  onToggle,
  onClose,
}: {
  listName: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const { library } = useLibrary();
  const [q, setQ] = useState("");
  const games = useMemo(() => {
    const n = normalizeTitle(q);
    return [...library.games]
      .filter((g) => !n || normalizeTitle(g.title).includes(n))
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
  }, [library.games, q]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Añadir a «${listName}»`}
      initialFocus="#picker-search"
      footer={
        <button type="button" className="btn btn-ink" onClick={onClose}>
          Hecho
        </button>
      }
    >
      <label className={styles.pickerSearch}>
        <Search aria-hidden />
        <span className="sr-only">Buscar juegos</span>
        <input id="picker-search" type="search" placeholder="Buscar por título" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <ul className={styles.pickerList}>
        {games.map((g) => (
          <li key={g.id}>
            <label className="check">
              <input type="checkbox" checked={selectedIds.includes(g.id)} onChange={() => onToggle(g.id)} />
              <Cover src={g.coverUrl} title={g.title} caption="" className={styles.pickerCover} />
              {g.title}
            </label>
          </li>
        ))}
        {games.length === 0 && <li className="muted">Ningún juego con «{q}».</li>}
      </ul>
    </Dialog>
  );
}
