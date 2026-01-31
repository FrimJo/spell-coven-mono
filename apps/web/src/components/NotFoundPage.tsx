import { useNavigate } from '@tanstack/react-router'
import { Ghost, Home, MoveLeft, Sparkles } from 'lucide-react'

import { Button } from '@repo/ui/components/button'

export function NotFoundPage() {
  const navigate = useNavigate()

  const handleReturnHome = () => {
    // Use replace: true to properly handle navigation from route-level notFound()
    // This ensures the router clears the not-found state
    navigate({ to: '/', replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
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
      <div className="bg-linear-to-br absolute inset-0 from-purple-900/20 via-slate-950 to-blue-900/20" />

      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-20 top-20 h-64 w-64 animate-pulse rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-20 h-96 w-96 animate-pulse rounded-full bg-blue-500/10 blur-3xl delay-1000" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        {/* Logo/Icon Area */}
        <div className="animate-float relative mb-8">
          <div className="absolute inset-0 animate-pulse rounded-full bg-purple-500/20 blur-3xl" />
          <div className="relative z-10 flex h-32 w-32 items-center justify-center rounded-3xl border border-slate-800 bg-slate-950/50 backdrop-blur-sm">
            <Ghost className="h-16 w-16 text-purple-400" />
          </div>

          {/* Decorative sparkles */}
          <Sparkles className="animate-sparkle absolute -left-6 top-0 h-6 w-6 text-yellow-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
          <Sparkles className="animate-sparkle absolute -right-4 bottom-4 h-5 w-5 text-blue-300 drop-shadow-[0_0_8px_rgba(147,197,253,0.8)] delay-700" />
        </div>

        {/* Text Content */}
        <div className="space-y-6">
          <h1 className="text-8xl font-bold tracking-tighter text-white/10 md:text-9xl">
            404
          </h1>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Lost in the{' '}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Blind Eternities
              </span>
            </h2>
            <p className="mx-auto max-w-md text-lg text-slate-400">
              The page you are looking for has been exiled or never existed.
              Let&apos;s planeswalk you back to safety.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-12 min-w-[160px] gap-2 bg-purple-600 font-medium text-white shadow-lg shadow-purple-500/25 hover:bg-purple-700"
              onClick={handleReturnHome}
            >
              <Home className="h-4 w-4" />
              Return Home
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 min-w-[160px] gap-2 border-slate-700 bg-slate-900/50 font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => window.history.back()}
            >
              <MoveLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>

        {/* Footer Text */}
        <div className="absolute bottom-8 text-sm text-slate-600">
          Spell Coven
        </div>
      </div>
    </div>
  )
}
