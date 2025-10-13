# Spell Coven - MTG Remote Play Platform

A browser-based platform for playing paper Magic: The Gathering remotely with friends. Spell Coven enables MTG players to play their physical cards online through video chat, card recognition, and game management tools—all running in your browser with no downloads required.

## Vision

Spell Coven aims to provide a comprehensive remote play experience for Magic: The Gathering players, competing with platforms like SpellTable by offering:

- **Multi-party Video & Voice**: Browser-based video chat optimized for overhead camera views of playmats (2-4 players per game)
- **Intelligent Card Recognition**: Computer vision powered by CLIP to identify cards in real-time and display rulings/details
- **Game Management Tools**: Life total tracking, commander damage tracking, turn indicators, and game timers
- **Flexible Room System**: Create or join private/public game rooms with format and power level metadata for better matchmaking
- **Device Flexibility**: Use standard webcams or mobile devices as overhead cameras without separate apps
- **Fully Browser-Based**: No installation required—works on modern browsers (Chrome, Firefox, Safari)

## Current Status

**Phase 1 (Current)**: Card recognition system with real-time visual search
- ✅ Browser-based CLIP model for card identification
- ✅ OpenCV.js for card boundary detection
- ✅ Webcam integration with real-time processing
- ✅ Pre-computed embeddings for ~20k+ MTG cards

**Phase 2 (Planned)**: Multi-party video/audio and room system
**Phase 3 (Planned)**: Game aids (life tracking, commander damage, turn management)
**Phase 4 (Planned)**: Enhanced matchmaking and social features

## Target Use Case

Spell Coven is designed for Magic: The Gathering players who want to play with their physical cards remotely against friends. The platform enables:

- **Remote Play Sessions**: Play paper MTG with friends across distances using video chat
- **Casual & Competitive Play**: Support for various formats (Commander, Modern, Standard, etc.) with power level indicators
- **Card Identification**: Quickly identify cards on camera for rules lookups and oracle text
- **Game State Tracking**: Keep track of life totals, commander damage, and turn order
- **Flexible Setup**: Use any webcam or smartphone as an overhead camera—no special equipment needed

### Competitive Landscape

**SpellTable** (by Wizards of the Coast) is the current market leader, offering:
- Free browser-based platform for remote paper Magic
- Multi-party video chat (2-4 players)
- Card recognition with click-to-identify
- Built-in life/commander damage tracking
- Turn indicators and timers
- Mobile device support as overhead cameras

**Spell Coven's Differentiators** (planned):
- Advanced AI-powered card recognition using state-of-the-art CLIP models
- Open-source and community-driven development
- Extensible architecture for custom features and integrations
- Privacy-focused with optional self-hosting capabilities

## Quick Start

1. **Install dependencies:**
   ```sh
   pnpm install
   ```

2. **Start the development server:**
   ```sh
   pnpm dev
   ```

3. **Open the app:**
   Navigate to http://localhost:3000 and click "Start Webcam" to begin scanning cards.

**Note**: On first load, the CLIP model (~150MB quantized) downloads directly to your browser's cache from Hugging Face CDN. Subsequent loads are instant.

## What's inside?

This Turborepo monorepo houses all applications and packages needed to drive the Spell Coven platform:

### Apps and Packages

- **`web`**: Main web application for remote MTG play (Vite + React + TanStack Router)
  - Card recognition with computer vision (Phase 1 - ✅ Complete)
  - Video/audio chat rooms (Phase 2 - Planned)
  - Game management tools (Phase 3 - Planned)
- **`@repo/mtg-image-db`**: Pre-generated CLIP embeddings and metadata for MTG card database
  - Python pipeline for downloading Scryfall data
  - FAISS index builder for efficient similarity search
  - Browser-optimized export (int8 quantization)
- **`@repo/eslint-config`**: Shared ESLint configurations
- **`@repo/typescript-config`**: Shared TypeScript configurations
- **`@repo/tailwind-config`**: Shared Tailwind CSS configuration
- **`@repo/prettier-config`**: Shared Prettier configuration

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/) (Python for data pipeline).

### Key Technologies

**Current (Phase 1)**:
- **Computer Vision**: CLIP (via [@xenova/transformers](https://github.com/xenova/transformers.js)) for image feature extraction
- **Card Detection**: OpenCV.js for real-time card boundary detection
- **Frontend**: React 19, TanStack Router, Tailwind CSS
- **Build Tool**: Vite with TypeScript
- **Monorepo**: Turborepo with pnpm workspaces
- **Data Pipeline**: Python with PyTorch, FAISS, Scryfall API

**Planned (Phase 2+)**:
- **WebRTC**: For peer-to-peer video/audio communication
- **Real-time Sync**: For game state management across players
- **Backend Services**: Room management, matchmaking, user sessions

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build
yarn dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build --filter=docs

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build --filter=docs
yarn exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev
yarn exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev --filter=web

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo login

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo link

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## Development Roadmap

### Phase 1: Card Recognition ✅ (Current)
- [x] CLIP-based visual search engine
- [x] OpenCV.js card boundary detection
- [x] Real-time webcam integration
- [x] Pre-computed embeddings for MTG card database
- [x] Browser-optimized model delivery

### Phase 2: Multi-Party Video & Rooms (Next)
- [ ] WebRTC integration for peer-to-peer video/audio
- [ ] Room creation and joining system
- [ ] Multi-party video layouts (grid, spotlight, focus views)
- [ ] Room metadata (format, power level, player count)
- [ ] Mobile device support as overhead camera

### Phase 3: Game Management Tools
- [ ] Life total tracking
- [ ] Commander damage tracking
- [ ] Turn indicator system
- [ ] Game timer/turn clock
- [ ] Card lookup drawer (click-to-identify integration)

### Phase 4: Enhanced Features
- [ ] Public/private room matchmaking
- [ ] User accounts and game history
- [ ] Replay and spectator modes
- [ ] Custom game rules and formats
- [ ] Community features (friends, invites)

## Contributing

This is an open-source project and contributions are welcome! Whether you're interested in:
- Adding new features (WebRTC, game tools, UI improvements)
- Improving card recognition accuracy
- Optimizing performance
- Writing documentation
- Reporting bugs

Please feel free to open issues or submit pull requests.

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
