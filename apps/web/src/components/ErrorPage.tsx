import { useEffect, useRef } from 'react'
import * as Sentry from '@sentry/react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Home, RefreshCw, Sparkles } from 'lucide-react'

import { Button } from '@repo/ui/components/button'

interface ErrorPageProps {
  error?: Error
  reset?: () => void
}

export function ErrorPage({ error, reset }: ErrorPageProps) {
  const navigate = useNavigate()
  const reportedRef = useRef(false)

  useEffect(() => {
    if (error && !reportedRef.current) {
      reportedRef.current = true
      Sentry.captureException(error, {
        tags: { source: 'router_default_error' },
      })
    }
  }, [error])

  const handleReturnHome = () => {
    // Use replace: true to properly handle navigation from error states
    // This ensures the router clears any error state and transitions cleanly
    navigate({ to: '/', replace: true })
  }

  return (
    <div className="bg-surface-0 relative min-h-screen overflow-hidden">
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        .animate-sparkle {
          animation: sparkle 3s ease-in-out infinite;
        }
        .delay-700 { animation-delay: 700ms; }
        .delay-1000 { animation-delay: 1000ms; }
        .delay-1500 { animation-delay: 1500ms; }
      `}</style>

      {/* Background with gradient overlay */}
      <div className="bg-linear-to-br absolute inset-0 from-red-900/20 via-slate-950 to-purple-900/20" />

      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-destructive/10 absolute left-20 top-20 h-64 w-64 animate-pulse rounded-full blur-3xl" />
        <div className="bg-brand/10 absolute bottom-20 right-20 h-96 w-96 animate-pulse rounded-full blur-3xl delay-1000" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        {/* Logo/Icon Area */}
        <div className="animate-float relative mb-8">
          <div className="bg-destructive/20 absolute inset-0 animate-pulse rounded-full blur-3xl" />
          <div className="border-surface-2 bg-surface-0/50 relative z-10 flex h-32 w-32 items-center justify-center rounded-3xl border backdrop-blur-sm">
            <AlertTriangle className="text-destructive h-16 w-16" />
          </div>

          {/* Decorative sparkles */}
          <Sparkles className="animate-sparkle text-warning absolute -left-6 top-0 h-6 w-6 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
          <Sparkles className="animate-sparkle text-destructive absolute -right-4 bottom-4 h-5 w-5 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)] delay-700" />
        </div>

        {/* Text Content */}
        <div className="space-y-6">
          <h1 className="text-8xl font-bold tracking-tighter text-white/10 md:text-9xl">
            500
          </h1>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Spell{' '}
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Fizzled
              </span>
            </h2>
            <p className="text-text-muted mx-auto max-w-md text-lg">
              {error?.message ||
                'Something went wrong while casting that spell. The mana pool has been drained.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {reset && (
              <Button
                size="lg"
                className="bg-destructive shadow-destructive/25 hover:bg-destructive h-12 min-w-[160px] gap-2 font-medium text-white shadow-lg"
                onClick={reset}
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="border-surface-3 bg-surface-1/50 text-text-secondary hover:bg-surface-2 h-12 min-w-[160px] gap-2 font-medium hover:text-white"
              onClick={handleReturnHome}
            >
              <Home className="h-4 w-4" />
              Return Home
            </Button>
          </div>
        </div>

        {/* Footer Text */}
        <div className="text-text-muted absolute bottom-8 text-sm">
          Spell Coven
        </div>
      </div>
    </div>
  )
}
