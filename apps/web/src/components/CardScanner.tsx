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
    <Card className="overflow-hidden border-slate-800 bg-slate-900">
      <div className="relative">
        {/* Header */}
        <div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-slate-950/80 to-transparent p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-purple-400" />
              <span className="text-white">Card Scanner</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scanner View */}
        <div className="relative aspect-video bg-slate-950">
          <div className="absolute inset-0 flex items-center justify-center">
            {scanning ? (
              <div className="space-y-4 text-center">
                <div className="relative">
                  <div className="h-32 w-32 animate-pulse rounded-lg border-4 border-purple-500/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Scan className="h-16 w-16 animate-pulse text-purple-400" />
                  </div>
                </div>
                <p className="text-slate-400">Scanning card...</p>
              </div>
            ) : recognizedCard ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <div>
                  <p className="mb-2 text-sm text-slate-400">
                    Recognized Card:
                  </p>
                  <p className="text-xl text-white">{recognizedCard}</p>
                </div>
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={handleAddToBattlefield}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Add to Battlefield
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRecognizedCard(null)}
                    className="border-slate-700 text-slate-400"
                  >
                    Scan Another
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border-4 border-dashed border-slate-700">
                  <Camera className="h-16 w-16 text-slate-600" />
                </div>
                <div>
                  <p className="mb-2 text-slate-400">Position card in frame</p>
                  <Button
                    onClick={handleScan}
                    className="bg-purple-600 text-white hover:bg-purple-700"
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
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 h-96 w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-purple-500/30">
                {/* Corner indicators */}
                <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-purple-500" />
                <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-purple-500" />
                <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-purple-500" />
                <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-purple-500" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Tips */}
        <div className="border-t border-slate-800 bg-slate-950/50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
            <p className="text-xs text-slate-400">
              For best results, ensure good lighting and hold the card flat in
              the frame. The card name should be clearly visible.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
