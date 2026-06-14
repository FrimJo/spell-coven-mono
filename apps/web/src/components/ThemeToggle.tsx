/**
 * ThemeToggle - A dropdown menu for selecting MTG color themes
 * (White, Blue, Black, Red, Green)
 *
 * Features a palette icon representing theme/color selection.
 */

import { useState } from 'react'
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

function ThemeOptionIcon({ themeKey }: { themeKey: MtgColorTheme }) {
  const theme = MTG_THEMES[themeKey]
  const iconSvg = theme.iconSvg
  const iconColor = theme.iconColor

  return (
    <span className="mr-2 flex w-4 items-center justify-center">
      {iconSvg && iconColor ? (
        <span
          className="size-4 shrink-0 overflow-hidden [&_svg]:block [&_svg]:size-full"
          style={{ color: iconColor }}
          title={`${theme.label} mana`}
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
      ) : (
        <Settings className="size-4" aria-label="Default theme" />
      )}
    </span>
  )
}

function ThemeOptionLabel({ themeKey }: { themeKey: MtgColorTheme }) {
  const theme = MTG_THEMES[themeKey]

  return (
    <>
      <span className="flex-1">{theme.label}</span>
      {themeKey !== 'none' && (
        <span className="text-text-muted ml-2 hidden text-xs sm:inline">
          {theme.description.split(',')[0]}
        </span>
      )}
    </>
  )
}

/** Inline theme list for contexts where a portaled dropdown is unreliable (e.g. mobile sheet). */
export function ThemePickerInline() {
  const { mtgTheme, setMtgTheme } = useTheme()

  return (
    <div className="px-4 py-3">
      <div className="text-text-muted mb-2 flex items-center gap-1 px-4 text-xs font-normal">
        <Palette className="size-3" />
        Theme
      </div>
      <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-1">
        {(Object.keys(MTG_THEMES) as MtgColorTheme[]).map((key) => {
          const isSelected = mtgTheme === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid={`theme-option-${key}`}
              onClick={() => setMtgTheme(key)}
              className={`text-text-secondary hover:bg-surface-2 hover:text-text-primary flex cursor-pointer items-center rounded-lg px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-surface-2 text-text-primary' : ''} `}
            >
              <ThemeOptionIcon themeKey={key} />
              <ThemeOptionLabel themeKey={key} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mtgTheme, setMtgTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`border-brand/50 bg-surface-1 text-brand-muted-foreground hover:border-brand/80 hover:bg-brand/20 hover:text-brand-muted-foreground relative flex items-center gap-2 font-semibold transition-all duration-300 hover:shadow-[0_0_12px_rgba(124,58,237,0.4)] ${className ?? ''} `}
          title="Toggle theme"
          data-testid="theme-toggle-button"
        >
          <Palette className="size-4 transition-all duration-300" />
          <span className="hidden text-sm font-bold sm:inline">Theme</span>
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-surface-3 bg-surface-1 w-56"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="text-text-muted flex items-center gap-1 text-xs font-normal">
          <Palette className="size-3" />
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mtgTheme}
          onValueChange={(value) => {
            setMtgTheme(value as MtgColorTheme)
            setOpen(false)
          }}
        >
          {(Object.keys(MTG_THEMES) as MtgColorTheme[]).map((key) => (
            <DropdownMenuRadioItem
              key={key}
              value={key}
              onSelect={() => setOpen(false)}
              className="text-text-secondary focus:bg-surface-2 focus:text-foreground cursor-pointer"
            >
              <ThemeOptionIcon themeKey={key} />
              <ThemeOptionLabel themeKey={key} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
