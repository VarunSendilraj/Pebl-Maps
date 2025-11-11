"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface EvalContextType {
  isEvalActive: boolean;
}

interface EvalActionsType {
  setEvalActive: (active: boolean) => void;
}

const EvalContext = createContext<EvalContextType | undefined>(undefined);
const EvalActionsContext = createContext<EvalActionsType | undefined>(undefined);

export function EvalProvider({ children }: { children: ReactNode }) {
  const [isEvalActive, setIsEvalActive] = useState<boolean>(false);

  const setEvalActive = useCallback((active: boolean) => {
    setIsEvalActive(active);
  }, []);

  return (
    <EvalContext.Provider value={{ isEvalActive }}>
      <EvalActionsContext.Provider value={{ setEvalActive }}>
        {children}
      </EvalActionsContext.Provider>
    </EvalContext.Provider>
  );
}

export function useEval() {
  const context = useContext(EvalContext);
  if (context === undefined) {
    throw new Error("useEval must be used within an EvalProvider");
  }
  return context;
}

export function useEvalActions() {
  const context = useContext(EvalActionsContext);
  if (context === undefined) {
    throw new Error("useEvalActions must be used within an EvalProvider");
  }
  return context;
}

