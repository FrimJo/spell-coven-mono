import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        GAME_ROOM: {
          durableObject: 'GameRoomCoordinator',
        },
      },
      durableObjects: {
        GAME_ROOM: 'GameRoomCoordinator',
      },
    },
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
  },
});
