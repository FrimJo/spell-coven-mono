import { useEffect, useRef, useState } from 'react'
import { GAME_ID_PATTERN } from '@/lib/game-id'
import { api } from '@convex/_generated/api'
import { AnimatePresence, domAnimation, LazyMotion, m } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Swords,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'

import { convex } from '../integrations/convex/provider.js'

type JoinPhase = 'input' | 'checking' | 'success' | 'not_found' | 'error'

interface JoinGameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onJoin: (gameId: string) => void
}

export function JoinGameDialog({
  open,
  onOpenChange,
  onJoin,
}: JoinGameDialogProps) {
  const [gameId, setGameId] = useState('')
  const [phase, setPhase] = useState<JoinPhase>('input')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validatedGameId, setValidatedGameId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setGameId('')
      setPhase('input')
      setValidationError(null)
      setValidatedGameId(null)
      abortRef.current?.abort()
      abortRef.current = null
    }
    onOpenChange(nextOpen)
  }

  useEffect(() => {
    if (open && phase === 'input') {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [open, phase])

  const normalizeId = (raw: string) => raw.trim().toUpperCase()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setGameId(raw)
    if (validationError) setValidationError(null)
    if (phase === 'not_found' || phase === 'error') setPhase('input')
  }

  const handleSubmit = async () => {
    const normalized = normalizeId(gameId)

    if (!normalized) {
      setValidationError('Enter a game code to open the portal.')
      return
    }

    if (!GAME_ID_PATTERN.test(normalized)) {
      setValidationError(
        'Game codes are 6 characters — letters and numbers only.',
      )
      return
    }

    setValidationError(null)
    setPhase('checking')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await convex.query(api.rooms.checkRoomAccess, {
        roomId: normalized,
      })

      if (controller.signal.aborted) return

      if (result.status === 'ok') {
        setValidatedGameId(normalized)
        setPhase('success')
      } else if (result.status === 'not_found') {
        setPhase('not_found')
      } else if (result.status === 'full') {
        setValidationError('That room is full — no seats left at the table.')
        setPhase('error')
      } else if (result.status === 'banned') {
        setValidationError("You've been banished from that room.")
        setPhase('error')
      }
    } catch {
      if (controller.signal.aborted) return
      setValidationError(
        'The portal flickered. Check your connection and try again.',
      )
      setPhase('error')
    }
  }

  const handleEnterRoom = () => {
    if (validatedGameId) {
      onJoin(validatedGameId)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (phase === 'success') {
        handleEnterRoom()
      } else if (
        phase === 'input' ||
        phase === 'not_found' ||
        phase === 'error'
      ) {
        handleSubmit()
      }
    }
  }

  const handleTryAgain = () => {
    setPhase('input')
    setValidationError(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const isInputDisabled = phase === 'checking' || phase === 'success'
  const isSubmitDisabled = isInputDisabled || !normalizeId(gameId)

  return (
    <LazyMotion features={domAnimation}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="border-surface-2 bg-surface-1 overflow-hidden sm:max-w-md"
          data-testid="join-game-dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              {phase === 'success' ? 'Portal Opened!' : 'Enter the Battlefield'}
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              {phase === 'success'
                ? 'The coven awaits — step through when ready.'
                : 'Enter a game code to join an existing room.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <div className="flex flex-col items-center space-y-5 py-2">
              {/* Animated icon */}
              <m.div
                className="relative flex h-16 w-16 items-center justify-center rounded-full"
                animate={{
                  backgroundColor:
                    phase === 'success'
                      ? 'rgba(34, 197, 94, 0.2)'
                      : phase === 'not_found' || phase === 'error'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(168, 85, 247, 0.2)',
                }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              >
                <AnimatePresence mode="wait">
                  {phase === 'success' ? (
                    <m.div
                      key="success"
                      initial={{ scale: 0, rotate: -180, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        duration: 0.8,
                        bounce: 0.5,
                      }}
                      className="flex items-center justify-center"
                    >
                      <CheckCircle2 className="text-success h-8 w-8" />
                    </m.div>
                  ) : phase === 'not_found' || phase === 'error' ? (
                    <m.div
                      key="error"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center"
                    >
                      <AlertTriangle className="text-destructive h-8 w-8" />
                    </m.div>
                  ) : (
                    <m.div
                      key="idle"
                      exit={{ scale: 0, rotate: 180, opacity: 0 }}
                      transition={{ duration: 0.4, ease: 'easeInOut' }}
                      className="flex items-center justify-center"
                    >
                      {phase === 'checking' ? (
                        <Loader2 className="text-brand-muted-foreground h-8 w-8 animate-spin" />
                      ) : (
                        <m.div
                          animate={{ scale: [1, 1.08, 1] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        >
                          <Swords className="text-brand-muted-foreground h-8 w-8" />
                        </m.div>
                      )}
                    </m.div>
                  )}
                </AnimatePresence>

                {/* Pulsing ring — only during checking */}
                <AnimatePresence>
                  {phase === 'checking' && (
                    <m.div
                      key="pulse-ring"
                      className="bg-brand/20 absolute inset-0 rounded-full"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{
                        scale: [1, 1.4, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Success burst */}
                <AnimatePresence>
                  {phase === 'success' && (
                    <m.div
                      key="success-burst"
                      className="bg-success/30 absolute inset-0 rounded-full"
                      initial={{ scale: 0.8, opacity: 1 }}
                      animate={{ scale: 2, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  )}
                </AnimatePresence>
              </m.div>

              {/* Status text */}
              <p className="text-text-secondary text-center text-sm font-medium">
                {phase === 'checking' && 'Locating the battlefield...'}
                {phase === 'success' &&
                  `Room ${validatedGameId} found — ready to enter.`}
                {phase === 'not_found' &&
                  'That room has faded from the multiverse. Double-check the code.'}
                {phase === 'error' &&
                  (validationError ?? 'Something went wrong. Try again.')}
                {phase === 'input' && '\u00A0'}
              </p>

              {/* Input area */}
              <div className="w-full space-y-2">
                <Label htmlFor="join-game-id" className="text-text-secondary">
                  Game Code
                </Label>
                <Input
                  ref={inputRef}
                  id="join-game-id"
                  placeholder="e.g. ABC123"
                  value={gameId}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={isInputDisabled}
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                  className={`border-surface-3 bg-surface-0 text-text-primary text-center font-mono text-lg uppercase tracking-widest ${
                    validationError
                      ? 'border-destructive/60 focus-visible:ring-destructive/40'
                      : ''
                  }`}
                  data-testid="join-game-id-input"
                />
                {validationError && phase === 'input' && (
                  <m.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-destructive text-center text-xs"
                    data-testid="join-game-validation-error"
                  >
                    {validationError}
                  </m.p>
                )}
                <p className="text-text-muted text-center text-xs">
                  6-character code — letters &amp; numbers only
                </p>
              </div>

              {/* Actions */}
              <div className="w-full space-y-2">
                {phase === 'success' ? (
                  <Button
                    onClick={handleEnterRoom}
                    className="bg-brand hover:bg-brand w-full text-white transition-all hover:scale-[1.02]"
                    size="lg"
                    data-testid="join-game-enter-button"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Enter Game Room
                  </Button>
                ) : phase === 'not_found' ? (
                  <Button
                    onClick={handleTryAgain}
                    variant="outline"
                    className="border-surface-3 text-text-secondary w-full hover:text-white"
                    size="lg"
                    data-testid="join-game-try-again-button"
                  >
                    Try a Different Code
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    className={`w-full transition-all ${
                      isSubmitDisabled
                        ? 'bg-surface-3 text-text-muted cursor-not-allowed'
                        : 'bg-brand hover:bg-brand text-white'
                    }`}
                    size="lg"
                    data-testid="join-game-submit-button"
                  >
                    {phase === 'checking' ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Searching the Multiverse...
                      </>
                    ) : phase === 'error' ? (
                      'Try Again'
                    ) : (
                      <>
                        <Swords className="mr-2 h-5 w-5" />
                        Join Game Room
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </LazyMotion>
  )
}
