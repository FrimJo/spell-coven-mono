/**
 * ThemeToggle - A dropdown menu for selecting MTG color themes
 * (White, Blue, Black, Red, Green)
 *
 * Features a palette icon representing theme/color selection.
 */

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 font-semibold relative flex items-center border-brand/50 bg-surface-1 text-brand-muted-foreground transition-all duration-300 hover:border-brand/80 hover:bg-brand/20 hover:text-brand-muted-foreground hover:shadow-[0_0_12px_rgba(124,58,237,0.4)] ${className ?? ''}`}
          title="Toggle theme"
          data-testid="theme-toggle-button"
        >
          {/* Palette icon - represents theme/color selection */}
          <Palette className="h-4 w-4 transition-all duration-300" />
          <span className="text-sm font-bold sm:inline hidden">Theme</span>
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border-surface-3 bg-surface-1"
      >
        <DropdownMenuLabel className="gap-1 text-xs font-normal flex items-center text-text-muted">
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
                className="cursor-pointer text-text-secondary focus:bg-surface-2 focus:text-foreground"
              >
                <span className="mr-2 w-4 flex items-center justify-center">
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
                  <span className="ml-2 text-xs sm:inline hidden text-text-muted">
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
