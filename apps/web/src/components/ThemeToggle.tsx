/**
 * ThemeToggle - A dropdown menu for selecting light/dark/system theme
 * and MTG color themes (White, Blue, Black, Red, Green)
 *
 * Features animated sun/moon icons and MTG-inspired styling.
 */

import { isThemeToggleEnabled } from '@/env'
import { Monitor, Moon, Palette, Sun } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'

import type { MtgColorTheme, Theme } from '../contexts/ThemeContext.js'
import { MTG_THEMES, useTheme } from '../contexts/ThemeContext.js'

interface ThemeToggleProps {
  /** Additional class names */
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, mtgTheme, setMtgTheme } = useTheme()

  if (!isThemeToggleEnabled) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`text-text-muted hover:text-foreground relative transition-all duration-300 hover:shadow-[0_0_12px_rgba(124,58,237,0.3)] ${className ?? ''}`}
          title="Toggle theme"
          data-testid="theme-toggle-button"
        >
          {/* Sun icon - visible in light mode */}
          <Sun
            className={`h-4 w-4 transition-all duration-300 ${
              resolvedTheme === 'light'
                ? 'rotate-0 scale-100'
                : 'rotate-90 scale-0'
            } absolute`}
          />
          {/* Moon icon - visible in dark mode */}
          <Moon
            className={`h-4 w-4 transition-all duration-300 ${
              resolvedTheme === 'dark'
                ? 'rotate-0 scale-100'
                : '-rotate-90 scale-0'
            } absolute`}
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-surface-3 bg-surface-1 w-56"
      >
        <DropdownMenuLabel className="text-text-muted text-xs font-normal">
          Mode
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          <DropdownMenuRadioItem
            value="light"
            className="text-text-secondary focus:bg-surface-2 focus:text-foreground cursor-pointer"
          >
            <Sun className="mr-2 h-4 w-4" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="text-text-secondary focus:bg-surface-2 focus:text-foreground cursor-pointer"
          >
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="system"
            className="text-text-secondary focus:bg-surface-2 focus:text-foreground cursor-pointer"
          >
            <Monitor className="mr-2 h-4 w-4" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator className="bg-surface-3" />
        
        <DropdownMenuLabel className="text-text-muted text-xs font-normal flex items-center gap-1">
          <Palette className="h-3 w-3" />
          MTG Color Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mtgTheme}
          onValueChange={(value) => setMtgTheme(value as MtgColorTheme)}
        >
          {(Object.keys(MTG_THEMES) as MtgColorTheme[]).map((key) => (
            <DropdownMenuRadioItem
              key={key}
              value={key}
              className="text-text-secondary focus:bg-surface-2 focus:text-foreground cursor-pointer"
            >
              <span className="mr-2 w-4 text-center">{MTG_THEMES[key].emoji}</span>
              <span className="flex-1">{MTG_THEMES[key].label}</span>
              {key !== 'none' && (
                <span className="text-text-muted text-xs ml-2 hidden sm:inline">
                  {MTG_THEMES[key].description.split(',')[0]}
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
