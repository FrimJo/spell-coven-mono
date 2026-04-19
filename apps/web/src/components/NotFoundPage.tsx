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
      <div className="inset-0 from-purple-900/20 via-slate-950 to-blue-900/20 absolute bg-linear-to-br" />

      {/* Animated background elements */}
      <div className="inset-0 pointer-events-none absolute overflow-hidden">
        <div className="left-20 top-20 h-64 w-64 animate-pulse blur-3xl absolute rounded-full bg-brand/10" />
        <div className="bottom-20 right-20 h-96 w-96 animate-pulse blur-3xl absolute rounded-full bg-info/10 delay-1000" />
      </div>

      <div className="px-4 relative z-10 flex min-h-screen flex-col items-center justify-center text-center">
        {/* Logo/Icon Area */}
        <div className="animate-float mb-8 relative">
          <div className="inset-0 animate-pulse blur-3xl absolute rounded-full bg-brand/20" />
          <div className="h-32 w-32 rounded-3xl backdrop-blur-sm relative z-10 flex items-center justify-center border border-surface-2 bg-surface-0/50">
            <Ghost className="h-16 w-16 text-brand-muted-foreground" />
          </div>

          {/* Decorative sparkles */}
          <Sparkles className="animate-sparkle -left-6 top-0 h-6 w-6 absolute text-warning drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
          <Sparkles className="animate-sparkle -right-4 bottom-4 h-5 w-5 absolute text-info drop-shadow-[0_0_8px_rgba(147,197,253,0.8)] delay-700" />
        </div>

        {/* Text Content */}
        <div className="space-y-6">
          <h1 className="text-8xl font-bold tracking-tighter text-white/10 md:text-9xl">
            404
          </h1>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Lost in the{' '}
              <span className="from-purple-400 to-blue-400 bg-gradient-to-r bg-clip-text text-transparent">
                Blind Eternities
              </span>
            </h2>
            <p className="max-w-md text-lg mx-auto text-text-muted">
              The page you are looking for has been exiled or never existed.
              Let&apos;s planeswalk you back to safety.
            </p>
          </div>

          {/* Actions */}
          <div className="gap-4 sm:flex-row flex flex-col items-center justify-center">
            <Button
              size="lg"
              className="h-12 gap-2 font-medium text-white shadow-lg min-w-[160px] bg-brand shadow-brand/25 hover:bg-brand"
              onClick={handleReturnHome}
            >
              <Home className="h-4 w-4" />
              Return Home
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 gap-2 font-medium hover:text-white min-w-[160px] border-surface-3 bg-surface-1/50 text-text-secondary hover:bg-surface-2"
              onClick={() => window.history.back()}
            >
              <MoveLeft className="h-4 w-4" />
              Go Back
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
