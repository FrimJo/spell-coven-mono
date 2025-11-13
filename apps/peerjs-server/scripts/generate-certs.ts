/**
 * Generate SSL certificates using mkcert for PeerJS server
 * 
 * This script checks if certificates exist, and generates them if missing.
 * Certificates are saved to ./certificates/ directory.
 */

import { existsSync, mkdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const certDir = resolve(__dirname, '../certificates')
// Generate certificates with names that match what the server expects
const keyPath = join(certDir, 'dev.pem')
const certPath = join(certDir, 'cert.pem')

// Check if certificates already exist
if (existsSync(keyPath) && existsSync(certPath)) {
  console.log('[PeerServer] SSL certificates already exist')
  process.exit(0)
}

console.log('[PeerServer] SSL certificates not found, generating...')

// Ensure certificates directory exists
if (!existsSync(certDir)) {
  mkdirSync(certDir, { recursive: true })
}

try {
  // Generate certificates using mkcert
  // mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1
  execSync(
    `mkcert -key-file "${keyPath}" -cert-file "${certPath}" localhost 127.0.0.1`,
    {
      stdio: 'inherit',
    },
  )
  console.log('[PeerServer] SSL certificates generated successfully')
} catch (error) {
  console.error('[PeerServer] Failed to generate SSL certificates')
  console.error('[PeerServer] Make sure mkcert is installed: brew install mkcert')
  console.error('[PeerServer] Or visit: https://github.com/FiloSottile/mkcert')
  process.exit(1)
}

