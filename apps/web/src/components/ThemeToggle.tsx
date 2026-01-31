/**
 * ThemeToggle - A dropdown menu for selecting light/dark/system theme
 *
 * Features animated sun/moon icons and MTG-inspired styling.
 */

import { Monitor, Moon, Sun } from 'lucide-react'

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

import { type Theme, useTheme } from '../contexts/ThemeContext.js'

interface ThemeToggleProps {
  /** Additional class names */
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative text-text-muted transition-all duration-300 hover:text-white hover:shadow-[0_0_12px_rgba(124,58,237,0.3)] ${className ?? ''}`}
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
        className="border-surface-3 bg-surface-1"
      >
        <DropdownMenuLabel className="text-text-muted">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-surface-3" />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          <DropdownMenuRadioItem
            value="light"
            className="cursor-pointer text-text-secondary focus:bg-surface-2 focus:text-white"
          >
            <Sun className="mr-2 h-4 w-4" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="cursor-pointer text-text-secondary focus:bg-surface-2 focus:text-white"
          >
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="system"
            className="cursor-pointer text-text-secondary focus:bg-surface-2 focus:text-white"
          >
            <Monitor className="mr-2 h-4 w-4" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
