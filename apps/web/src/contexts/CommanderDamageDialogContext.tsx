'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

type CommanderDamageDialogContextValue = {
  /** When set, the overlay for this player id should open its commander damage dialog */
  openForPlayerId: string | null
  setOpenForPlayerId: (playerId: string | null) => void
}

const CommanderDamageDialogContext =
  createContext<CommanderDamageDialogContextValue | null>(null)

export function CommanderDamageDialogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [openForPlayerId, setOpenForPlayerIdState] = useState<string | null>(
    null,
  )
  const setOpenForPlayerId = useCallback((playerId: string | null) => {
    setOpenForPlayerIdState(playerId)
  }, [])
  const value = useMemo<CommanderDamageDialogContextValue>(
    () => ({ openForPlayerId, setOpenForPlayerId }),
    [openForPlayerId, setOpenForPlayerId],
  )
  return (
    <CommanderDamageDialogContext.Provider value={value}>
      {children}
    </CommanderDamageDialogContext.Provider>
  )
}

export function useCommanderDamageDialog(): CommanderDamageDialogContextValue | null {
  return useContext(CommanderDamageDialogContext)
}
