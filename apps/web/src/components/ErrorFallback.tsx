import { AlertTriangle, Home, RotateCcw, Sparkles } from 'lucide-react'

import { Button } from '@repo/ui/components/button'

interface ErrorFallbackProps {
  error?: Error
  resetErrorBoundary?: () => void
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  const handleReturnHome = () => {
    window.location.href = '/'
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
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .animate-glow-pulse {
          animation: glow-pulse 3s ease-in-out infinite;
        }
        .delay-700 { animation-delay: 700ms; }
        .delay-1000 { animation-delay: 1000ms; }
        .delay-1500 { animation-delay: 1500ms; }
      `}</style>

      {/* Background with gradient overlay */}
      <div className="inset-0 from-purple-900/20 via-slate-950 to-blue-900/20 absolute bg-linear-to-br" />

      {/* Animated background elements */}
      <div className="inset-0 pointer-events-none absolute overflow-hidden">
        <div className="left-20 top-20 h-64 w-64 animate-pulse blur-3xl absolute rounded-full bg-brand/10" />
        <div className="animate-glow-pulse bottom-20 right-20 h-96 w-96 blur-3xl absolute rounded-full bg-destructive/10 delay-1000" />
        <div className="h-48 w-48 animate-pulse blur-3xl absolute top-1/3 right-1/3 rounded-full bg-info/10 delay-700" />
      </div>

      <div className="px-4 relative z-10 flex min-h-screen flex-col items-center justify-center text-center">
        {/* Icon / Card area */}
        <div className="animate-float mb-8 relative">
          <div className="animate-glow-pulse inset-0 blur-3xl absolute rounded-full bg-destructive/10" />
          <div className="h-32 w-32 rounded-3xl shadow-xl backdrop-blur-sm relative z-10 flex items-center justify-center border border-surface-2 bg-surface-0/80">
            <AlertTriangle className="h-16 w-16 text-destructive drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]" />
          </div>
          <Sparkles className="animate-sparkle -left-6 top-0 h-6 w-6 absolute text-warning drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
          <Sparkles className="animate-sparkle -right-4 bottom-4 h-5 w-5 absolute text-destructive/80 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] delay-700" />
        </div>

        {/* Text content */}
        <div className="animate-fade-in-up space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Your spell{' '}
              <span className="from-amber-400 via-red-400 to-rose-400 bg-gradient-to-r bg-clip-text text-transparent">
                fizzled
              </span>
            </h1>
            <p className="max-w-md text-lg mx-auto text-text-muted">
              Something went wrong in the Blind Eternities. The weave of mana
              was disrupted—but you can try again or planeswalk back to safety.
            </p>
          </div>

          {/* Error details (collapsed by default feel: subtle, not alarming) */}
          {error && (
            <div className="max-w-lg px-4 py-3 backdrop-blur-sm mx-auto rounded-xl border border-border-muted bg-surface-1/80 text-left">
              <p className="font-mono text-sm break-words text-text-muted">
                {error.message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="gap-4 sm:flex-row flex flex-col items-center justify-center">
            {resetErrorBoundary && (
              <Button
                size="lg"
                className="h-12 gap-2 font-medium text-white shadow-lg min-w-[160px] bg-brand shadow-brand/25 hover:bg-brand"
                onClick={resetErrorBoundary}
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 font-medium hover:text-white min-w-[160px] border-surface-3 bg-surface-1/50 text-text-secondary hover:bg-surface-2"
              onClick={handleReturnHome}
            >
              <Home className="h-4 w-4" />
              Return home
            </Button>
          </div>
        </div>

        <div className="bottom-8 text-sm absolute text-text-muted">
          Spell Casters
        </div>
      </div>
    </div>
  )
}
