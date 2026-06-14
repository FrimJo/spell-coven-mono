import { useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, Scan, X } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

interface CardScannerProps {
  onClose: () => void
}

export function CardScanner({ onClose }: CardScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [recognizedCard, setRecognizedCard] = useState<string | null>(null)

  const handleScan = () => {
    setScanning(true)
    // Simulate card recognition
    setTimeout(() => {
      setRecognizedCard('Lightning Bolt')
      setScanning(false)
    }, 2000)
  }

  const handleAddToBattlefield = () => {
    // Add card to battlefield logic
    setRecognizedCard(null)
  }

  return (
    <Card className="border-surface-2 bg-surface-1 overflow-hidden">
      <div className="relative">
        {/* Header */}
        <div className="bg-linear-to-b absolute inset-x-0 top-0 z-10 from-slate-950/80 to-transparent p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="text-brand-muted-foreground size-5" />
              <span className="text-white">Card Scanner</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-text-muted hover:text-white"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* Scanner View */}
        <div className="bg-surface-0 relative aspect-video">
          <div className="absolute inset-0 flex items-center justify-center">
            {scanning ? (
              <div className="space-y-4 text-center">
                <div className="relative">
                  <div className="border-brand/30 size-32 animate-pulse rounded-lg border-4" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Scan className="text-brand-muted-foreground size-16 animate-pulse" />
                  </div>
                </div>
                <p className="text-text-muted">Scanning card...</p>
              </div>
            ) : recognizedCard ? (
              <div className="space-y-4 text-center">
                <div className="bg-success/20 mx-auto flex size-16 items-center justify-center rounded-full">
                  <CheckCircle2 className="text-success size-8" />
                </div>
                <div>
                  <p className="text-text-muted mb-2 text-sm">
                    Recognized Card:
                  </p>
                  <p className="text-xl text-white">{recognizedCard}</p>
                </div>
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={handleAddToBattlefield}
                    className="bg-brand hover:bg-brand text-white"
                  >
                    Add to Battlefield
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRecognizedCard(null)}
                    className="border-surface-3 text-text-muted"
                  >
                    Scan Another
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="border-surface-3 flex size-32 items-center justify-center rounded-lg border-4 border-dashed">
                  <Camera className="text-text-muted size-16" />
                </div>
                <div>
                  <p className="text-text-muted mb-2">Position card in frame</p>
                  <Button
                    onClick={handleScan}
                    className="bg-brand hover:bg-brand text-white"
                  >
                    <Scan className="mr-2 size-4" />
                    Scan Card
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Scanning Frame Overlay */}
          {!recognizedCard && (
            <div className="pointer-events-none absolute inset-0">
              <div className="border-brand/30 absolute left-1/2 top-1/2 h-96 w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2">
                {/* Corner indicators */}
                <div className="border-brand absolute left-0 top-0 size-8 rounded-tl-lg border-l-4 border-t-4" />
                <div className="border-brand absolute right-0 top-0 size-8 rounded-tr-lg border-r-4 border-t-4" />
                <div className="border-brand absolute bottom-0 left-0 size-8 rounded-bl-lg border-b-4 border-l-4" />
                <div className="border-brand absolute bottom-0 right-0 size-8 rounded-br-lg border-b-4 border-r-4" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Tips */}
        <div className="border-surface-2 bg-surface-0/50 border-t p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-info mt-0.5 size-4 shrink-0" />
            <p className="text-text-muted text-xs">
              For best results, ensure good lighting and hold the card flat in
              the frame. The card name should be clearly visible.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
