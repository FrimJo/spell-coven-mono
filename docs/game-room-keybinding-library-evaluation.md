# Game Room Keybinding Library Evaluation

This note summarizes strong third-party options for keyboard shortcut handling in React game-room style UIs (global shortcuts, cross-platform key labels, and command-scoped handlers).

## Socket.dev data collection status
I attempted to fetch package pages from Socket.dev for each candidate package:
- `https://socket.dev/npm/package/react-hotkeys-hook`
- `https://socket.dev/npm/package/tinykeys`
- `https://socket.dev/npm/package/hotkeys-js`

In this execution environment, all Socket.dev requests returned **HTTP 403** at the proxy tunnel layer, so score/risk fields could not be retrieved programmatically.

## Ranked recommendation (most recommended → least)

### 1) `react-hotkeys-hook` (Most recommended)
- **Website**: https://react-hotkeys-hook.vercel.app/
- **Strengths**
  - Purpose-built React hook API.
  - Scoping and enable/disable flags are convenient for modal-heavy screens.
  - Includes handling for modifiers and configurable event options.
- **Socket.dev status in this environment**
  - Package page request attempted, but blocked with HTTP 403.
- **Why rank #1**
  - Best ergonomic fit with current React architecture and least custom plumbing.

### 2) `tinykeys`
- **Website**: https://github.com/jamiebuilds/tinykeys
- **Strengths**
  - Small and framework-agnostic.
  - Excellent for global window/document bindings.
  - Simple key-combo grammar (`$mod+K`, `Shift+D`, etc.).
- **Socket.dev status in this environment**
  - Package page request attempted, but blocked with HTTP 403.
- **Why rank #2**
  - Strong lightweight fallback if we prefer minimal dependency surface over React-specific ergonomics.

### 3) `hotkeys-js` (Least recommended for current needs)
- **Website**: https://github.com/jaywcjlove/hotkeys-js
- **Strengths**
  - Mature, widely used keyboard library.
  - Rich binding/unbinding and scope support.
- **Socket.dev status in this environment**
  - Package page request attempted, but blocked with HTTP 403.
- **Why rank #3**
  - Most imperative of the three options; useful for complex scopes, but less aligned with current hook-centric React patterns.

## Side-by-side summary
| Library | React-first DX | Size / minimalism | Advanced imperative scopes | Socket.dev retrievable here |
|---|---|---|---|---|
| `react-hotkeys-hook` | High | Medium | Medium | No (HTTP 403) |
| `tinykeys` | Medium | High | Medium | No (HTTP 403) |
| `hotkeys-js` | Medium | Medium | High | No (HTTP 403) |

## Adoption notes
- Preserve current command map IDs (`searchCards`, `toggleCommandersPanel`, `openCommanderDamage`) so menu keycaps and behavior remain synced.
- Keep editable-element guards (inputs/textareas/contenteditable) for non-text actions.
- Ensure platform display strings continue using `⌘` on macOS and `Ctrl` elsewhere.
- When environment/network allows, re-run Socket.dev checks and append exact score/risk fields before dependency adoption.
