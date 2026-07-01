# Spell Coven Web

The web application provides remote paper Magic rooms with video, voice,
manual Scryfall card search, life totals, commander damage, and room controls.

## Development

```sh
cd apps/web
bun run with-env -- vite dev
```

The local server uses HTTPS at `https://localhost:1234`.

## Validation

```sh
bun typecheck
bun lint
bun test
```
