'use client'

import { createContext, useContext, useMemo } from 'react'

type CommandersPanelContextValue = {
  openCommandersPanel: () => void
}

const CommandersPanelContext =
  createContext<CommandersPanelContextValue | null>(null)

export function CommandersPanelProvider({
  children,
  onOpenPanel,
}: {
  children: React.ReactNode
  onOpenPanel: () => void
}) {
  const value = useMemo<CommandersPanelContextValue>(
    () => ({
      openCommandersPanel: onOpenPanel,
    }),
    [onOpenPanel],
  )
  return (
    <CommandersPanelContext.Provider value={value}>
      {children}
    </CommandersPanelContext.Provider>
  )
}

export function useCommandersPanel(): CommandersPanelContextValue | null {
  return useContext(CommandersPanelContext)
}
