import { useState } from 'react';
import { Grid3x3, Layers, Trash2 } from 'lucide-react';
import { Card } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';

export function GameBoard() {
  const [zones] = useState({
    battlefield: [] as string[],
    graveyard: [] as string[],
    exile: [] as string[],
  });

  return (
    <Card className="bg-slate-900 border-slate-800 flex-1 overflow-hidden flex flex-col">
      <Tabs defaultValue="battlefield" className="flex-1 flex flex-col">
        <div className="border-b border-slate-800 px-4 py-3">
          <TabsList className="bg-slate-950">
            <TabsTrigger value="battlefield" className="gap-2">
              <Grid3x3 className="w-4 h-4" />
              Battlefield
            </TabsTrigger>
            <TabsTrigger value="graveyard" className="gap-2">
              <Trash2 className="w-4 h-4" />
              Graveyard
            </TabsTrigger>
            <TabsTrigger value="exile" className="gap-2">
              <Layers className="w-4 h-4" />
              Exile
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="battlefield" className="flex-1 p-4 overflow-auto m-0">
          <div className="h-full">
            {zones.battlefield.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Grid3x3 className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-center">
                  Your battlefield is empty
                  <br />
                  <span className="text-sm">Use the card scanner to add cards to play</span>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {/* Cards would be rendered here */}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="graveyard" className="flex-1 p-4 overflow-auto m-0">
          <div className="h-full">
            {zones.graveyard.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Trash2 className="w-16 h-16 mb-4 opacity-20" />
                <p>No cards in graveyard</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {/* Cards would be rendered here */}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="exile" className="flex-1 p-4 overflow-auto m-0">
          <div className="h-full">
            {zones.exile.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Layers className="w-16 h-16 mb-4 opacity-20" />
                <p>No cards in exile</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {/* Cards would be rendered here */}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <div className="border-t border-slate-800 px-4 py-3 bg-slate-950/50">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-400 hover:text-white"
          >
            Untap All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-400 hover:text-white"
          >
            Draw Card
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-400 hover:text-white"
          >
            Mulligan
          </Button>
        </div>
      </div>
    </Card>
  );
}
