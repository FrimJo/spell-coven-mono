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
  Search,
  Settings,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/components/sheet'

import logoBlue from '../assets/logo_1024_blue.png'
import logoDeath from '../assets/logo_1024_death.png'
import logoFire from '../assets/logo_1024_fire.png'
import logoGreen from '../assets/logo_1024_green.png'
import logoWarmGold from '../assets/logo_1024_warmgold.png'
import logo from '../assets/logo_1024x1024.png'
import { useTheme } from '../contexts/ThemeContext.js'
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
  onSignIn?: () => void

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
    <div className="flex items-center gap-2">
      <img
        src={logoSrc}
        alt="Spell Coven Logo"
        className={`${sizeClasses} ${roundedClasses} object-contain`}
      />
      <span className={`${textClasses} text-text-primary font-bold`}>
        Spell Coven
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
          className="text-text-secondary hover:text-text-primary flex items-center gap-2"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="bg-brand text-white">
              {user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">{user.username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-surface-3 bg-surface-1"
      >
        <DropdownMenuItem
          onClick={signOut}
          className="text-text-secondary focus:bg-surface-2 focus:text-text-primary cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
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
    <header className="border-border-muted bg-surface-0/80 border-b backdrop-blur-md">
      {/* Subtle gradient border effect */}
      <div className="via-brand/30 absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent" />

      <div className="container relative mx-auto flex items-center justify-between px-4 py-4">
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <a
              key={item.targetId}
              href={`#${item.targetId}`}
              onClick={(e) => handleNavClick(e, item.targetId)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              {item.label}
            </a>
          ))}

          <a
            href="https://github.com/FrimJo/spell-coven-mono"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
            title="View on GitHub"
          >
            <Github className="h-5 w-5" />
            <span className="sr-only">GitHub</span>
          </a>

          <ThemeToggle />

          {/* Auth section */}
          {isAuthLoading ? (
            <div className="bg-surface-2 h-9 w-24 animate-pulse rounded-md" />
          ) : isAuthenticated ? (
            <UserMenu />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onSignIn}
              className="border-brand/50 text-brand-muted-foreground hover:bg-brand/20 hover:text-brand-muted-foreground gap-2"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in with Discord</span>
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
              className="border-border-muted bg-surface-0/95 flex w-full flex-col border-l p-0 backdrop-blur-xl sm:max-w-sm"
            >
              <SheetHeader className="border-border-muted border-b px-6 py-4">
                <div className="flex items-center gap-2">
                  <Logo size="small" />
                </div>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-1 px-4 py-6">
                {navItems.map((item) => (
                  <a
                    key={item.targetId}
                    href={`#${item.targetId}`}
                    onClick={(e) => handleNavClick(e, item.targetId)}
                    className="text-text-secondary hover:bg-surface-2 hover:text-text-primary flex items-center rounded-lg px-4 py-3 text-lg font-medium transition-colors"
                  >
                    {item.label}
                  </a>
                ))}

                {/* GitHub link in mobile menu */}
                <a
                  href="https://github.com/FrimJo/spell-coven-mono"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-secondary hover:bg-surface-2 hover:text-text-primary flex items-center gap-3 rounded-lg px-4 py-3 text-lg font-medium transition-colors"
                >
                  <Github className="h-5 w-5" />
                  GitHub
                </a>

                {/* Theme toggle in mobile menu */}
                <div className="flex items-center justify-between rounded-lg px-4 py-3">
                  <span className="text-text-secondary text-lg font-medium">
                    Theme
                  </span>
                  <ThemeToggle />
                </div>
              </div>

              <div className="border-border-muted border-t p-6">
                {isAuthLoading ? (
                  <div className="bg-surface-2 h-12 w-full animate-pulse rounded-lg" />
                ) : isAuthenticated && user ? (
                  <div className="flex flex-col gap-4">
                    <div className="border-border-muted bg-surface-1/50 flex items-center gap-3 rounded-xl border p-3">
                      <Avatar className="border-surface-3 h-10 w-10 border">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="bg-brand text-white">
                          {user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-text-primary font-medium">
                          {user.username}
                        </span>
                        <span className="text-text-muted text-xs">
                          Logged in
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={signOut}
                      className="border-surface-3 text-text-secondary hover:bg-surface-2 hover:text-text-primary h-12 w-full justify-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    onClick={onSignIn}
                    className="group relative h-14 w-full gap-3 overflow-hidden border border-white/10 bg-gradient-to-r from-[#5865F2] to-purple-600 text-lg font-semibold text-white shadow-[0_0_30px_rgba(88,101,242,0.4)] transition-all hover:scale-105 hover:from-[#4752C4] hover:to-purple-700 hover:shadow-[0_0_50px_rgba(88,101,242,0.6)]"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
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
}: AppHeaderProps) {
  return (
    <header className="border-surface-2 bg-surface-1/80 shrink-0 border-b backdrop-blur-md">
      {/* Subtle gradient border effect */}
      <div className="via-brand/20 absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent" />

      <div className="relative flex items-center justify-between px-4 py-3">
        {/* Left side */}
        <div className="flex items-center gap-4">
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

          <div className="bg-surface-3 h-6 w-px" />

          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-text-muted text-sm">Share Link:</span>
            <code
              className="bg-surface-2 text-brand-muted-foreground hover:bg-surface-3 cursor-pointer break-all rounded px-2 py-1 text-sm transition-colors"
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
              className="text-text-muted hover:text-text-primary"
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
            className="text-text-muted hover:text-text-primary sm:hidden"
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
        <div className="flex items-center gap-3">
          {/* Search Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onSearchClick}
            className="border-surface-3 bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text-primary gap-2"
            title="Search cards (⌘K)"
            data-testid="search-button"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search cards</span>
            <kbd className="bg-surface-3 text-text-muted pointer-events-none hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-75 sm:inline-flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          <ThemeToggle />

          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className="text-text-muted hover:text-text-primary"
            title="Audio & video settings"
            data-testid="settings-button"
          >
            <Settings className="h-4 w-4" />
          </Button>

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
