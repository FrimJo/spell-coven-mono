import { useState } from 'react'
import * as Sentry from '@sentry/react'
import { CheckCircle2, MessageSquareText } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Textarea } from '@repo/ui/components/textarea'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  associatedEventId?: string
  variant?: 'general' | 'error'
}

type SubmissionState = 'editing' | 'submitted' | 'error'

export function FeedbackDialog({
  open,
  onOpenChange,
  associatedEventId,
  variant = 'general',
}: FeedbackDialogProps) {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>('editing')
  const isErrorReport = variant === 'error'

  const resetForm = () => {
    setMessage('')
    setEmail('')
    setSubmissionState('editing')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedMessage = message.trim()
    if (!trimmedMessage) return

    try {
      Sentry.captureFeedback({
        message: trimmedMessage,
        email: isErrorReport ? undefined : email.trim() || undefined,
        source: isErrorReport ? 'error_page' : 'beta_banner',
        ...(associatedEventId ? { associatedEventId } : {}),
        tags: {
          feature: isErrorReport ? 'error_feedback' : 'beta_feedback',
        },
      })
      setSubmissionState('submitted')
    } catch {
      setSubmissionState('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-surface-2 bg-surface-1 sm:max-w-md">
        {submissionState === 'submitted' ? (
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <CheckCircle2 className="text-success size-12" aria-hidden="true" />
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-white">Feedback sent</DialogTitle>
              <DialogDescription className="text-text-muted">
                {isErrorReport
                  ? 'Your note is now attached to this fizzle. Thanks for helping the coven investigate.'
                  : 'Thanks for helping improve Spell Coven.'}
              </DialogDescription>
            </DialogHeader>
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <div className="bg-brand/15 mb-1 flex size-10 items-center justify-center rounded-full">
                <MessageSquareText
                  className="text-brand-muted-foreground size-5"
                  aria-hidden="true"
                />
              </div>
              <DialogTitle className="text-white">
                {isErrorReport ? 'Report this fizzle' : 'Share feedback'}
              </DialogTitle>
              <DialogDescription className="text-text-muted">
                {isErrorReport
                  ? 'The mishap is already logged. Add what you were doing so the coven can trace the miscast.'
                  : 'Tell us what worked, what did not, or what would make Spell Coven better.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="feedback-message">
                {isErrorReport ? 'What happened?' : 'Feedback'}
              </Label>
              <Textarea
                id="feedback-message"
                name="feedback"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value)
                  if (submissionState === 'error') {
                    setSubmissionState('editing')
                  }
                }}
                placeholder={
                  isErrorReport
                    ? 'What did you try, and what did you expect to happen?'
                    : 'What would you like us to know?'
                }
                required
                maxLength={2000}
                rows={6}
                className="resize-y"
                autoFocus
              />
              <p className="text-text-muted text-right text-xs">
                {message.length}/2000
              </p>
            </div>

            {!isErrorReport && (
              <div className="space-y-2">
                <Label htmlFor="feedback-email">Email (optional)</Label>
                <Input
                  id="feedback-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <p className="text-text-muted text-xs">
                  Include your email only if you are happy for us to follow up.
                </p>
              </div>
            )}

            {submissionState === 'error' && (
              <p role="alert" className="text-destructive text-sm">
                Feedback could not be sent. Please try again.
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!message.trim()}>
                {isErrorReport ? 'Send report' : 'Send feedback'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
