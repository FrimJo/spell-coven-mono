// React Doctor reports hypotheses, so keep exclusions narrow and documented.
export default {
  ignore: {
    files: ['.output/**', 'dist/**', 'src/routeTree.gen.ts'],
    rules: [
      // React Compiler is enabled. Preserve existing manual memoization during
      // the initial rollout because some call sites rely on stable identity.
      'react-doctor/react-compiler-no-manual-memoization',
      // React Compiler currently reports unsupported syntax (for example,
      // try/finally) that application code cannot meaningfully remediate.
      'react-hooks-js/todo',
    ],
    overrides: [
      {
        files: ['src/components/LiveKitTrackElement.tsx'],
        // Live WebRTC tracks do not have a caption file that can be supplied
        // through a static <track> element.
        rules: ['react-doctor/media-has-caption'],
      },
      {
        files: [
          'src/components/VideoStreamGrid.tsx',
          'src/routes/__root.tsx',
          'src/routes/phone-camera.tsx',
        ],
        // These effects create or synchronize browser-owned resources. State
        // updates occur as part of that external synchronization.
        rules: [
          // Underlying React Compiler rule; not listed by `doctor rules`.
          'react-hooks-js/set-state-in-effect',
          'react-doctor/no-initialize-state',
        ],
      },
      {
        files: ['src/components/GameStatsPanel.tsx'],
        // The mutation writes through Convex; consumers receive live Convex
        // subscription updates rather than TanStack Query cache data.
        rules: ['react-doctor/query-mutation-missing-invalidation'],
      },
      {
        files: [
          'src/components/CardSearchCommand.tsx',
          'src/components/JoinGameDialog.tsx',
        ],
        // These guards intentionally follow awaited requests so stale or
        // cancelled responses cannot update current UI state.
        rules: ['react-doctor/async-defer-await'],
      },
      {
        files: [
          'src/components/GameRoomSidebar.tsx',
          'src/components/MediaSetupPanel.tsx',
          'src/components/SidebarCard.tsx',
        ],
        // These effects synchronize scrolling or media elements, not events
        // that should be moved into a prop callback.
        rules: ['react-doctor/no-event-handler'],
      },
      {
        files: ['src/routes/debug.sentry.tsx'],
        // This state intentionally triggers a render-time error boundary test.
        rules: ['react-doctor/rerender-state-only-in-handlers'],
      },
      {
        files: [
          'src/components/CardSearchCommand.tsx',
          'src/routes/phone-camera.tsx',
        ],
        // Unmount cleanup must read the latest timer/browser resource ref.
        rules: ['react-doctor/exhaustive-deps'],
      },
      {
        files: ['src/routes/phone-camera.tsx'],
        // Camera acquisition, room connection, and track publication are
        // causally ordered and cannot be parallelized safely.
        rules: ['react-doctor/async-parallel'],
      },
      {
        files: ['src/components/CommanderSearchInput.tsx'],
        // This is the ARIA combobox/listbox pattern; a datalist cannot provide
        // the custom async option behavior or active-descendant semantics.
        rules: [
          'react-doctor/no-static-element-interactions',
          'react-doctor/prefer-tag-over-role',
        ],
      },
    ],
  },
} as const
