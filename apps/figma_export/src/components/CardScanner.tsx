import React, { useState } from 'react';
import { Camera, X, Scan, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface CardScannerProps {
  onClose: () => void;
}

export function CardScanner({ onClose }: CardScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [recognizedCard, setRecognizedCard] = useState<string | null>(null);

  const handleScan = () => {
    setScanning(true);
    // Simulate card recognition
    setTimeout(() => {
      setRecognizedCard('Lightning Bolt');
      setScanning(false);
    }, 2000);
  };

  const handleAddToBattlefield = () => {
    // Add card to battlefield logic
    setRecognizedCard(null);
  };

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="relative">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-slate-950/80 to-transparent backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-purple-400" />
              <span className="text-white">Card Scanner</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Scanner View */}
        <div className="relative aspect-video bg-slate-950">
          <div className="absolute inset-0 flex items-center justify-center">
            {scanning ? (
              <div className="text-center space-y-4">
                <div className="relative">
                  <div className="w-32 h-32 border-4 border-purple-500/30 rounded-lg animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Scan className="w-16 h-16 text-purple-400 animate-pulse" />
                  </div>
                </div>
                <p className="text-slate-400">Scanning card...</p>
              </div>
            ) : recognizedCard ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-2">Recognized Card:</p>
                  <p className="text-xl text-white">{recognizedCard}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={handleAddToBattlefield}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
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
              <div className="text-center space-y-4">
                <div className="w-32 h-32 border-4 border-dashed border-slate-700 rounded-lg flex items-center justify-center">
                  <Camera className="w-16 h-16 text-slate-600" />
                </div>
                <div>
                  <p className="text-slate-400 mb-2">Position card in frame</p>
                  <Button
                    onClick={handleScan}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Scan Card
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Scanning Frame Overlay */}
          {!recognizedCard && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-96 border-2 border-purple-500/30 rounded-lg">
                {/* Corner indicators */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-500 rounded-br-lg" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Tips */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-400">
              For best results, ensure good lighting and hold the card flat in the frame. 
              The card name should be clearly visible.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
