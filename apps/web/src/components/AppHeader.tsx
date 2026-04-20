/**
 * AppHeader - Shared header component for landing page and game room
 *
 * Features MTG-inspired styling with glass-morphism and purple accents.
 */

import { useAuth } from '@/contexts/AuthContext'
import {
  ArrowLeft,
  Check,
  Copy,
  Github,
  LogIn,
  LogOut,
  Menu,
  Palette,
  Search,
  Settings,
  Swords,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/components/sheet'

import type { MtgColorTheme } from '../contexts/ThemeContext.js'
import logoBlue from '../assets/logo_1024_blue.png'
import logoDeath from '../assets/logo_1024_death.png'
import logoFire from '../assets/logo_1024_fire.png'
import logoGreen from '../assets/logo_1024_green.png'
import logoWarmGold from '../assets/logo_1024_warmgold.png'
import logo from '../assets/logo_1024x1024.png'
import { MTG_THEMES, useTheme } from '../contexts/ThemeContext.js'
import { useSearchShortcutParts } from '../hooks/useSearchShortcut.js'
import { ThemeToggle } from './ThemeToggle.js'

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  label: string
  targetId: string
}

interface AppHeaderProps {
  /** Header variant - determines which elements are shown */
  variant: 'landing' | 'game'

  // Landing-specific props
  /** Navigation items for smooth scroll (landing only) */
  navItems?: NavItem[]
  /** Callback when sign in is clicked (landing only) */
  onSignIn?: (provider?: 'discord' | 'google') => void | Promise<void>

  // Game-specific props
  /** Shareable link to display (game only) */
  shareLink?: string
  /** Whether the link was recently copied (game only) */
  copied?: boolean
  /** Callback when leave button is clicked (game only) */
  onLeave?: () => void
  /** Callback when copy link is clicked (game only) */
  onCopyLink?: () => void
  /** Callback when settings button is clicked (game only) */
  onOpenSettings?: () => void
  /** Callback when search button is clicked (game only) */
  onSearchClick?: () => void
  /** Whether the commanders panel is open (game only) */
  commandersPanelOpen?: boolean
  /** Callback to toggle commanders panel (game only) */
  onCommandersPanelToggle?: () => void
  /** Shortcut parts for commanders panel, e.g. ['⌘', 'M'] (game only) */
  commanderShortcutParts?: string[]
}

// ============================================================================
// Shared Components
// ============================================================================

function Logo({ size = 'default' }: { size?: 'default' | 'small' }) {
  const { mtgTheme } = useTheme()
  const sizeClasses = size === 'small' ? 'h-8 w-8' : 'h-10 w-10'
  const textClasses = size === 'small' ? 'text-lg' : 'text-xl'
  const roundedClasses = size === 'small' ? 'rounded-lg' : 'rounded-xl'
  // Use theme-specific logos
  const logoSrc =
    mtgTheme === 'white'
      ? logoWarmGold
      : mtgTheme === 'red'
        ? logoFire
        : mtgTheme === 'blue'
          ? logoBlue
          : mtgTheme === 'black'
            ? logoDeath
            : mtgTheme === 'green'
              ? logoGreen
              : logo

  return (
    <div className="gap-2 flex items-center">
      <img
        src={logoSrc}
        alt="Spell Casters Logo"
        className={`${sizeClasses} ${roundedClasses} object-contain`}
      />
      <span className={`${textClasses} font-bold text-text-primary`}>
        Spell Casters
      </span>
    </div>
  )
}

function UserMenu() {
  const { user, signOut } = useAuth()

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 flex items-center text-text-secondary hover:text-text-primary"
          title={user.username}
          data-testid="header-user-menu"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="text-white bg-brand">
              {user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="lg:inline hidden max-w-[8rem] truncate">
            {user.username}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-surface-3 bg-surface-1"
      >
        <DropdownMenuItem
          onClick={signOut}
          className="cursor-pointer text-text-secondary focus:bg-surface-2 focus:text-text-primary"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SettingsDropdown({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { mtgTheme, setMtgTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-text-muted hover:text-text-primary"
          title="Audio & video settings"
          data-testid="settings-button"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border-surface-3 bg-surface-1"
      >
        {onOpenSettings && (
          <DropdownMenuItem
            onClick={onOpenSettings}
            className="cursor-pointer text-text-secondary focus:bg-surface-2 focus:text-text-primary"
          >
            <Settings className="mr-2 h-4 w-4" />
            Setup Audio & Video
          </DropdownMenuItem>
        )}
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

// ============================================================================
// Landing Header
// ============================================================================

function LandingHeader({ navItems = [], onSignIn }: AppHeaderProps) {
  const { user, isLoading: isAuthLoading, signOut } = useAuth()
  const isAuthenticated = !!user

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string,
  ) => {
    e.preventDefault()
    const element = document.getElementById(targetId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header className="backdrop-blur-md border-b border-border-muted bg-surface-0/80">
      {/* Subtle gradient border effect */}
      <div className="inset-x-0 bottom-0 absolute h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

      <div className="px-4 py-4 relative container mx-auto flex items-center justify-between">
        <Logo />

        {/* Desktop Navigation */}
        <nav className="gap-6 md:flex hidden items-center">
          {navItems.map((item) => (
            <a
              key={item.targetId}
              href={`#${item.targetId}`}
              onClick={(e) => handleNavClick(e, item.targetId)}
              className="text-text-secondary transition-colors hover:text-text-primary"
            >
              {item.label}
            </a>
          ))}

          <a
            href="https://github.com/FrimJo/spell-casters-mono"
            target="_blank"
            rel="noopener noreferrer"
            className="gap-1.5 flex items-center text-text-secondary transition-colors hover:text-text-primary"
            title="View on GitHub"
          >
            <Github className="h-5 w-5" />
            <span className="sr-only">GitHub</span>
          </a>

          <ThemeToggle />

          {/* Auth section */}
          {isAuthLoading ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-surface-2" />
          ) : isAuthenticated ? (
            <UserMenu />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSignIn?.('discord')}
              className="gap-2 border-brand/50 text-brand-muted-foreground hover:bg-brand/20 hover:text-brand-muted-foreground"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in</span>
            </Button>
          )}
        </nav>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
                className="text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="p-0 backdrop-blur-xl sm:max-w-sm flex w-full flex-col border-l border-border-muted bg-surface-0/95"
            >
              <SheetHeader className="px-6 py-4 border-b border-border-muted">
                <div className="gap-2 flex items-center">
                  <Logo size="small" />
                </div>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              </SheetHeader>

              <div className="gap-1 px-4 py-6 flex flex-1 flex-col">
                {navItems.map((item) => (
                  <a
                    key={item.targetId}
                    href={`#${item.targetId}`}
                    onClick={(e) => handleNavClick(e, item.targetId)}
                    className="px-4 py-3 text-lg font-medium flex items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                  >
                    {item.label}
                  </a>
                ))}

                {/* GitHub link in mobile menu */}
                <a
                  href="https://github.com/FrimJo/spell-casters-mono"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-3 px-4 py-3 text-lg font-medium flex items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                >
                  <Github className="h-5 w-5" />
                  GitHub
                </a>

                {/* Theme toggle in mobile menu */}
                <div className="px-4 py-3 flex items-center justify-between rounded-lg">
                  <span className="text-lg font-medium text-text-secondary">
                    Theme
                  </span>
                  <ThemeToggle />
                </div>
              </div>

              <div className="p-6 border-t border-border-muted">
                {isAuthLoading ? (
                  <div className="h-12 animate-pulse w-full rounded-lg bg-surface-2" />
                ) : isAuthenticated && user ? (
                  <div className="gap-4 flex flex-col">
                    <div className="gap-3 p-3 flex items-center rounded-xl border border-border-muted bg-surface-1/50">
                      <Avatar className="h-10 w-10 border border-surface-3">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="text-white bg-brand">
                          {user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">
                          {user.username}
                        </span>
                        <span className="text-xs text-text-muted">
                          Logged in
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={signOut}
                      className="h-12 gap-2 w-full justify-center border-surface-3 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => onSignIn?.('discord')}
                    className="group h-14 gap-3 border-white/10 to-purple-600 text-lg font-semibold text-white hover:to-purple-700 relative w-full overflow-hidden border bg-gradient-to-r from-[#5865F2] shadow-[0_0_30px_rgba(88,101,242,0.4)] transition-all hover:scale-105 hover:from-[#4752C4] hover:shadow-[0_0_50px_rgba(88,101,242,0.6)]"
                  >
                    <div className="inset-0 bg-white/20 absolute opacity-0 transition-opacity group-hover:opacity-100" />
                    <svg
                      className="h-6 w-6 transition-transform group-hover:scale-110"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Sign in with Discord
                  </Button>
                )}
                {!isAuthenticated && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onSignIn?.('google')}
                    className="h-14 gap-3 text-lg font-semibold bg-white text-gray-800 hover:bg-gray-100 w-full"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.49-1.13 2.75-2.41 3.6v3h3.89c2.28-2.1 3.59-5.2 3.59-8.84z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.25v3.09C3.23 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.27 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3V6.61H1.25C.45 8.2 0 9.96 0 12s.45 3.8 1.25 5.39l4.02-3.09z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.74c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.23 2.7 1.25 6.61l4.02 3.09C6.22 6.85 8.87 4.74 12 4.74z"
                      />
                    </svg>
                    Sign in with Google
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

// ============================================================================
// Game Header
// ============================================================================

function GameHeader({
  shareLink,
  copied = false,
  onLeave,
  onCopyLink,
  onOpenSettings,
  onSearchClick,
  commandersPanelOpen = false,
  onCommandersPanelToggle,
  commanderShortcutParts,
}: AppHeaderProps) {
  const shortcut = useSearchShortcutParts()
  return (
    <header className="backdrop-blur-md shrink-0 border-b border-surface-2 bg-surface-1/80">
      {/* Subtle gradient border effect */}
      <div className="inset-x-0 bottom-0 absolute h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent" />

      <div className="px-4 py-3 relative flex items-center justify-between">
        {/* Left side */}
        <div className="gap-4 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="text-text-muted hover:text-text-primary"
            title="Leave game room"
            data-testid="leave-game-button"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Leave
          </Button>

          <div className="h-6 w-px bg-surface-3" />

          <div className="min-w-0 gap-2 sm:flex hidden flex-1 items-center">
            <span className="text-sm shrink-0 text-text-muted">
              Share Link:
            </span>
            <code
              className="min-w-0 rounded px-2 py-1 text-sm flex-1 cursor-pointer truncate bg-surface-2 text-brand-muted-foreground transition-colors hover:bg-surface-3"
              data-testid="game-id-display"
              onClick={onCopyLink}
              title="Click to copy shareable link"
            >
              {shareLink}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyLink}
              className="shrink-0 text-text-muted hover:text-text-primary"
              title="Copy shareable link"
              data-testid="copy-share-link-button"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Mobile: Show only copy button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyLink}
            className="sm:hidden text-text-muted hover:text-text-primary"
            title="Copy shareable link"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="ml-2">Copy Link</span>
          </Button>
        </div>

        {/* Right side */}
        <div className="gap-3 flex items-center">
          {/* Commanders – global list, same style as Search */}
          {onCommandersPanelToggle && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCommandersPanelToggle}
              className={`gap-2 border-surface-3 ${
                commandersPanelOpen
                  ? 'bg-surface-3 text-text-primary'
                  : 'bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text-primary'
              }`}
              title={
                commanderShortcutParts
                  ? `View and edit commanders list (${commanderShortcutParts.join('')})`
                  : 'View and edit commanders list'
              }
              data-testid="commanders-panel-button"
            >
              <Swords className="h-4 w-4" />
              <span className="sm:inline hidden">Commanders</span>
              {commanderShortcutParts && commanderShortcutParts.length > 0 && (
                <kbd className="h-5 gap-1 rounded px-1.5 font-mono font-medium sm:inline-flex pointer-events-none hidden items-center border bg-surface-3 text-[10px] text-text-muted opacity-75 select-none">
                  {commanderShortcutParts.map((part, i) => (
                    <span key={i} className="text-xs">
                      {part}
                    </span>
                  ))}
                </kbd>
              )}
            </Button>
          )}

          {/* Search Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onSearchClick}
            className="gap-2 border-surface-3 bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text-primary"
            title={`Search cards (${shortcut.modifier}${shortcut.modifier.length === 1 ? '' : '+'}${shortcut.key})`}
            data-testid="search-button"
          >
            <Search className="h-4 w-4" />
            <span className="sm:inline hidden">Search cards</span>
            <kbd className="h-5 gap-1 rounded px-1.5 font-mono font-medium sm:inline-flex pointer-events-none hidden items-center border bg-surface-3 text-[10px] text-text-muted opacity-75 select-none">
              <span className="text-xs">{shortcut.modifier}</span>
              {shortcut.key}
            </kbd>
          </Button>

          <SettingsDropdown onOpenSettings={onOpenSettings} />

          <UserMenu />
        </div>
      </div>
    </header>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function AppHeader(props: AppHeaderProps) {
  if (props.variant === 'landing') {
    return <LandingHeader {...props} />
  }
  return <GameHeader {...props} />
}
