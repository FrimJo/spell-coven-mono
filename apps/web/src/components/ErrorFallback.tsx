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
      <div
        className="
        absolute inset-0 bg-linear-to-br from-purple-900/20 via-slate-950
        to-blue-900/20
      "
      />

      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="
          absolute top-20 left-20 size-64 animate-pulse rounded-full bg-brand/10
          blur-3xl
        "
        />
        <div
          className="
          animate-glow-pulse absolute right-20 bottom-20 size-96 rounded-full
          bg-destructive/10 blur-3xl delay-1000
        "
        />
        <div
          className="
          absolute top-1/3 right-1/3 size-48 animate-pulse rounded-full
          bg-info/10 blur-3xl delay-700
        "
        />
      </div>

      <div
        className="
        relative z-10 flex min-h-screen flex-col items-center justify-center
        px-4 text-center
      "
      >
        {/* Icon / Card area */}
        <div className="animate-float relative mb-8">
          <div
            className="
            animate-glow-pulse absolute inset-0 rounded-full bg-destructive/10
            blur-3xl
          "
          />
          <div
            className="
            relative z-10 flex size-32 items-center justify-center rounded-3xl
            border border-surface-2 bg-surface-0/80 shadow-xl backdrop-blur-sm
          "
          >
            <AlertTriangle
              className="
              size-16 text-destructive
              drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]
            "
            />
          </div>
          <Sparkles
            className="
            animate-sparkle absolute top-0 -left-6 size-6 text-warning
            drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]
          "
          />
          <Sparkles
            className="
            animate-sparkle absolute -right-4 bottom-4 size-5
            text-destructive/80 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]
            delay-700
          "
          />
        </div>

        {/* Text content */}
        <div className="animate-fade-in-up space-y-6">
          <div className="space-y-2">
            <h1
              className="
              text-3xl font-bold text-white
              md:text-4xl
            "
            >
              Your spell{' '}
              <span
                className="
                bg-linear-to-r from-amber-400 via-red-400 to-rose-400
                bg-clip-text text-transparent
              "
              >
                fizzled
              </span>
            </h1>
            <p className="mx-auto max-w-md text-lg text-text-muted">
              Something went wrong in the Blind Eternities. The weave of mana
              was disrupted—but you can try again or planeswalk back to safety.
            </p>
          </div>

          {/* Error details (collapsed by default feel: subtle, not alarming) */}
          {error && (
            <div
              className="
              mx-auto max-w-lg rounded-xl border border-border-muted
              bg-surface-1/80 px-4 py-3 text-left backdrop-blur-sm
            "
            >
              <p className="font-mono text-sm wrap-break-word text-text-muted">
                {error.message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div
            className="
            flex flex-col items-center justify-center gap-4
            sm:flex-row
          "
          >
            {resetErrorBoundary && (
              <Button
                size="lg"
                className="
                  h-12 min-w-[160px] gap-2 bg-brand font-medium text-white
                  shadow-lg shadow-brand/25
                  hover:bg-brand
                "
                onClick={resetErrorBoundary}
              >
                <RotateCcw className="size-4" />
                Try again
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="
                h-12 min-w-[160px] gap-2 border-surface-3 bg-surface-1/50
                font-medium text-text-secondary
                hover:bg-surface-2 hover:text-white
              "
              onClick={handleReturnHome}
            >
              <Home className="size-4" />
              Return home
            </Button>
          </div>
        </div>

        <div className="absolute bottom-8 text-sm text-text-muted">
          Spell Coven
        </div>
      </div>
    </div>
  )
}
