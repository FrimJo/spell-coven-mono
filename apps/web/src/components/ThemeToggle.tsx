/**
 * ThemeToggle - A dropdown menu for selecting MTG color themes
 * (White, Blue, Black, Red, Green)
 *
 * Features a palette icon representing theme/color selection.
 */

import { isThemeToggleEnabled } from '@/env'
import { Palette, Settings } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'

import type { MtgColorTheme } from '../contexts/ThemeContext.js'
import { MTG_THEMES, useTheme } from '../contexts/ThemeContext.js'

interface ThemeToggleProps {
  /** Additional class names */
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mtgTheme, setMtgTheme } = useTheme()

  if (!isThemeToggleEnabled) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={`border-brand/50 bg-surface-1 text-brand-muted-foreground hover:bg-brand/20 hover:text-brand-muted-foreground hover:border-brand/80 relative flex items-center gap-2 px-3 py-2 font-semibold transition-all duration-300 hover:shadow-[0_0_12px_rgba(124,58,237,0.4)] ${className ?? ''}`}
          title="Toggle theme"
          data-testid="theme-toggle-button"
        >
          {/* Palette icon - represents theme/color selection */}
          <Palette className="h-5 w-5 transition-all duration-300" />
          <span className="hidden text-sm font-bold sm:inline">Theme</span>
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-surface-3 bg-surface-1 w-56"
      >
        <DropdownMenuLabel className="text-text-muted flex items-center gap-1 text-xs font-normal">
          <Palette className="h-3 w-3" />
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mtgTheme}
          onValueChange={(value) => setMtgTheme(value as MtgColorTheme)}
        >
          {(Object.keys(MTG_THEMES) as MtgColorTheme[]).map((key) => {
            const theme = MTG_THEMES[key]
            const iconSvg = theme.iconSvg
            const iconColor = theme.iconColor
            return (
              <DropdownMenuRadioItem
                key={key}
                value={key}
                className="text-text-secondary focus:bg-surface-2 focus:text-foreground cursor-pointer"
              >
                <span className="mr-2 flex w-4 items-center justify-center">
                  {iconSvg && iconColor ? (
                    <span
                      className="h-4 w-4 shrink-0 overflow-hidden [&_svg]:block [&_svg]:size-full"
                      style={{ color: iconColor }}
                      title={`${theme.label} mana`}
                      dangerouslySetInnerHTML={{ __html: iconSvg }}
                    />
                  ) : (
                    <Settings className="h-4 w-4" aria-label="Default theme" />
                  )}
                </span>
                <span className="flex-1">{theme.label}</span>
                {key !== 'none' && (
                  <span className="text-text-muted ml-2 hidden text-xs sm:inline">
                    {theme.description.split(',')[0]}
                  </span>
                )}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
