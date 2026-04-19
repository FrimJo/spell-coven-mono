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
    <div className="relative min-h-screen overflow-hidden bg-surface-0">
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
      <div className="inset-0 from-red-900/20 via-slate-950 to-purple-900/20 absolute bg-linear-to-br" />

      {/* Animated background elements */}
      <div className="inset-0 pointer-events-none absolute overflow-hidden">
        <div className="left-20 top-20 h-64 w-64 animate-pulse blur-3xl absolute rounded-full bg-destructive/10" />
        <div className="bottom-20 right-20 h-96 w-96 animate-pulse blur-3xl absolute rounded-full bg-brand/10 delay-1000" />
      </div>

      <div className="px-4 relative z-10 flex min-h-screen flex-col items-center justify-center text-center">
        {/* Logo/Icon Area */}
        <div className="animate-float mb-8 relative">
          <div className="inset-0 animate-pulse blur-3xl absolute rounded-full bg-destructive/20" />
          <div className="h-32 w-32 rounded-3xl backdrop-blur-sm relative z-10 flex items-center justify-center border border-surface-2 bg-surface-0/50">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>

          {/* Decorative sparkles */}
          <Sparkles className="animate-sparkle -left-6 top-0 h-6 w-6 absolute text-warning drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
          <Sparkles className="animate-sparkle -right-4 bottom-4 h-5 w-5 absolute text-destructive drop-shadow-[0_0_8px_rgba(248,113,113,0.8)] delay-700" />
        </div>

        {/* Text Content */}
        <div className="space-y-6">
          <h1 className="text-8xl font-bold tracking-tighter text-white/10 md:text-9xl">
            500
          </h1>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Spell{' '}
              <span className="from-red-400 to-orange-400 bg-gradient-to-r bg-clip-text text-transparent">
                Fizzled
              </span>
            </h2>
            <p className="max-w-md text-lg mx-auto text-text-muted">
              {error?.message ||
                'Something went wrong while casting that spell. The mana pool has been drained.'}
            </p>
          </div>

          {/* Actions */}
          <div className="gap-4 sm:flex-row flex flex-col items-center justify-center">
            {reset && (
              <Button
                size="lg"
                className="h-12 gap-2 font-medium text-white shadow-lg min-w-[160px] bg-destructive shadow-destructive/25 hover:bg-destructive"
                onClick={reset}
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="h-12 gap-2 font-medium hover:text-white min-w-[160px] border-surface-3 bg-surface-1/50 text-text-secondary hover:bg-surface-2"
              onClick={handleReturnHome}
            >
              <Home className="h-4 w-4" />
              Return Home
            </Button>
          </div>
        </div>

        {/* Footer Text */}
        <div className="bottom-8 text-sm absolute text-text-muted">
          Spell Casters
        </div>
      </div>
    </div>
  )
}
