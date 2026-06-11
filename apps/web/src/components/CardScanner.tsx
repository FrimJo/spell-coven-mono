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
    <Card className="overflow-hidden border-surface-2 bg-surface-1">
      <div className="relative">
        {/* Header */}
        <div className="left-0 right-0 top-0 from-slate-950/80 p-4 backdrop-blur-sm absolute z-10 bg-gradient-to-b to-transparent">
          <div className="flex items-center justify-between">
            <div className="gap-2 flex items-center">
              <Camera className="h-5 w-5 text-brand-muted-foreground" />
              <span className="text-white">Card Scanner</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:text-white text-text-muted"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scanner View */}
        <div className="aspect-video relative bg-surface-0">
          <div className="inset-0 absolute flex items-center justify-center">
            {scanning ? (
              <div className="space-y-4 text-center">
                <div className="relative">
                  <div className="h-32 w-32 animate-pulse rounded-lg border-4 border-brand/30" />
                  <div className="inset-0 absolute flex items-center justify-center">
                    <Scan className="h-16 w-16 animate-pulse text-brand-muted-foreground" />
                  </div>
                </div>
                <p className="text-text-muted">Scanning card...</p>
              </div>
            ) : recognizedCard ? (
              <div className="space-y-4 text-center">
                <div className="h-16 w-16 mx-auto flex items-center justify-center rounded-full bg-success/20">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <p className="mb-2 text-sm text-text-muted">
                    Recognized Card:
                  </p>
                  <p className="text-xl text-white">{recognizedCard}</p>
                </div>
                <div className="gap-2 flex justify-center">
                  <Button
                    onClick={handleAddToBattlefield}
                    className="text-white bg-brand hover:bg-brand"
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
                <div className="h-32 w-32 flex items-center justify-center rounded-lg border-4 border-dashed border-surface-3">
                  <Camera className="h-16 w-16 text-text-muted" />
                </div>
                <div>
                  <p className="mb-2 text-text-muted">Position card in frame</p>
                  <Button
                    onClick={handleScan}
                    className="text-white bg-brand hover:bg-brand"
                  >
                    <Scan className="mr-2 h-4 w-4" />
                    Scan Card
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Scanning Frame Overlay */}
          {!recognizedCard && (
            <div className="inset-0 pointer-events-none absolute">
              <div className="h-96 w-64 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-brand/30">
                {/* Corner indicators */}
                <div className="left-0 top-0 h-8 w-8 absolute rounded-tl-lg border-t-4 border-l-4 border-brand" />
                <div className="right-0 top-0 h-8 w-8 absolute rounded-tr-lg border-t-4 border-r-4 border-brand" />
                <div className="bottom-0 left-0 h-8 w-8 absolute rounded-bl-lg border-b-4 border-l-4 border-brand" />
                <div className="bottom-0 right-0 h-8 w-8 absolute rounded-br-lg border-r-4 border-b-4 border-brand" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Tips */}
        <div className="p-4 border-t border-surface-2 bg-surface-0/50">
          <div className="gap-2 flex items-start">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-info" />
            <p className="text-xs text-text-muted">
              For best results, ensure good lighting and hold the card flat in
              the frame. The card name should be clearly visible.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
