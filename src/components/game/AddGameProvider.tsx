"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AddGameDialog } from "./AddGameDialog";

interface AddGameContextValue {
  /** Abre el alta; con `gameId` añade otra copia a ese juego. */
  open(options?: { gameId?: string; title?: string }): void;
  /** A qué copia ha mandado el cofre a apuntar detalles; `round` cambia en cada envío. */
  details: { round: number; gameId: string | null; copyId: string | null };
  /** El inventario ya se ha presentado: no debe repetirlo al volver a la ficha. */
  detailsShown(): void;
}

const AddGameContext = createContext<AddGameContextValue>({
  open: () => {},
  details: { round: 0, gameId: null, copyId: null },
  detailsShown: () => {},
});

export function AddGameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; key: number; gameId?: string; title?: string }>({ open: false, key: 0 });
  const [details, setDetails] = useState<AddGameContextValue["details"]>({ round: 0, gameId: null, copyId: null });
  const open = useCallback<AddGameContextValue["open"]>(
    (options) => setState((s) => ({ open: true, key: s.key + 1, ...options })),
    [],
  );
  const detailsShown = useCallback(() => setDetails((d) => ({ ...d, gameId: null, copyId: null })), []);
  const value = useMemo(() => ({ open, details, detailsShown }), [open, details, detailsShown]);
  return (
    <AddGameContext.Provider value={value}>
      {children}
      <AddGameDialog
        key={state.key}
        open={state.open}
        initialGameId={state.gameId}
        initialTitle={state.title}
        onClose={() => setState((s) => ({ ...s, open: false }))}
        onDetails={(gameId, copyId) => setDetails((d) => ({ round: d.round + 1, gameId, copyId }))}
      />
    </AddGameContext.Provider>
  );
}

export const useAddGame = () => useContext(AddGameContext);
