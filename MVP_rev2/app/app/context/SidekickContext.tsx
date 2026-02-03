'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SidekickContextValue {
  isOpen: boolean;
  openSidekick: () => void;
  closeSidekick: () => void;
}

const SidekickContext = createContext<SidekickContextValue | null>(null);

export function SidekickProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openSidekick = useCallback(() => setIsOpen(true), []);
  const closeSidekick = useCallback(() => setIsOpen(false), []);
  return (
    <SidekickContext.Provider value={{ isOpen, openSidekick, closeSidekick }}>
      {children}
    </SidekickContext.Provider>
  );
}

export function useSidekick(): SidekickContextValue | null {
  return useContext(SidekickContext);
}
