/**
 * Copies the card index artifacts from repo-root `static/card-index/`
 * into `apps/web/public/card-index/` so Vite includes them in the
 * deployed public bundle. Runs as part of the web app's prebuild step.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')

const src = resolve(repoRoot, 'static', 'card-index')
const dest = resolve(repoRoot, 'apps', 'web', 'public', 'card-index')

if (!existsSync(src)) {
  console.error(`[copy-card-index] Source does not exist: ${src}`)
  process.exit(1)
}

mkdirSync(dirname(dest), { recursive: true })
cpSync(src, dest, { recursive: true })
console.log(`[copy-card-index] Copied ${src} -> ${dest}`)
