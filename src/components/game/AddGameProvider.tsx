"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AddGameDialog } from "./AddGameDialog";

interface AddGameContextValue {
  /** Abre el alta; con `gameId` añade otra copia a ese juego. */
  open(options?: { gameId?: string; title?: string }): void;
}

const AddGameContext = createContext<AddGameContextValue>({ open: () => {} });

export function AddGameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; key: number; gameId?: string; title?: string }>({ open: false, key: 0 });
  const open = useCallback<AddGameContextValue["open"]>(
    (options) => setState((s) => ({ open: true, key: s.key + 1, ...options })),
    [],
  );
  const value = useMemo(() => ({ open }), [open]);
  return (
    <AddGameContext.Provider value={value}>
      {children}
      <AddGameDialog
        key={state.key}
        open={state.open}
        initialGameId={state.gameId}
        initialTitle={state.title}
        onClose={() => setState((s) => ({ ...s, open: false }))}
      />
    </AddGameContext.Provider>
  );
}

export const useAddGame = () => useContext(AddGameContext);
