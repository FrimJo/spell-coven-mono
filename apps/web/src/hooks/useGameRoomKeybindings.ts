import { useEffect, useMemo, useRef, useState } from 'react'

type GameRoomShortcutId =
  | 'searchCards'
  | 'toggleCommandersPanel'
  | 'openCommanderDamage'

type GameRoomShortcut = {
  id: GameRoomShortcutId
  key: string
  requireModifier: boolean
  requireShift?: boolean
}

type ShortcutHandlers = Partial<Record<GameRoomShortcutId, () => void>>

function getIsMac(): boolean {
  if (typeof navigator === 'undefined') return true
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ??
    navigator.platform ??
    ''
  const ua = navigator.userAgent ?? ''
  return (
    /Mac|iPod|iPhone|iPad/i.test(platform) || /Mac|iPod|iPhone|iPad/i.test(ua)
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

const SHORTCUTS: GameRoomShortcut[] = [
  { id: 'searchCards', key: 'k', requireModifier: true },
  { id: 'toggleCommandersPanel', key: 'm', requireModifier: true },
  {
    id: 'openCommanderDamage',
    key: 'd',
    requireModifier: true,
    requireShift: true,
  },
]

export function useGameRoomShortcutDisplayParts(): Record<
  GameRoomShortcutId,
  string[]
> {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(getIsMac())
  }, [])

  return useMemo(() => {
    const modifierLabel = isMac ? '⌘' : 'Ctrl'

    return {
      searchCards: [modifierLabel, 'K'],
      toggleCommandersPanel: [modifierLabel, 'M'],
      openCommanderDamage: [modifierLabel, '⇧', 'D'],
    }
  }, [isMac])
}

export function useGameRoomKeyboardShortcuts(
  handlers: ShortcutHandlers,
) {
  const handlersRef = useRef<ShortcutHandlers>(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      const isModifierPressed = event.metaKey || event.ctrlKey
      const pressedKey = event.key.toLowerCase()

      for (const shortcut of SHORTCUTS) {
        const modifierMatches = shortcut.requireModifier
          ? isModifierPressed
          : !isModifierPressed
        const shiftMatches = shortcut.requireShift
          ? event.shiftKey
          : !event.shiftKey

        if (
          modifierMatches &&
          shiftMatches &&
          pressedKey === shortcut.key &&
          handlersRef.current[shortcut.id]
        ) {
          event.preventDefault()
          handlersRef.current[shortcut.id]?.()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
