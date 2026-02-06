import { rmSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default function globalTeardown() {
  const storageDir = resolve(__dirname, '../.playwright-storage')
  rmSync(storageDir, { recursive: true, force: true })
}
