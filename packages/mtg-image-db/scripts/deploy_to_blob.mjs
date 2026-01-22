#!/usr/bin/env node
import { put } from '@vercel/blob'
import dotenv from 'dotenv'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function parseArgs(argv) {
  const args = new Map()
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i]
    if (!key) continue
    if (key.startsWith('--')) {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        args.set(key, true)
        continue
      }
      args.set(key, value)
      i += 1
    }
  }
  return args
}

function loadEnvFiles() {
  const scriptDir = fileURLToPath(new URL('.', import.meta.url))
  const rootDir = resolve(scriptDir, '..', '..', '..')
  const envDev = resolve(rootDir, '.env.development')
  const envLocal = resolve(rootDir, '.env.development.local')

  dotenv.config({ path: envDev })
  dotenv.config({ path: envLocal, override: true })
}

function computeDefaultVersion() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  let sha = 'nogit'
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    // ignore
  }
  return `v${date}-${sha}`
}

function contentTypeFor(fileName) {
  if (fileName.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

async function uploadFile({ token, pathname, filePath, dryRun, allowOverwrite }) {
  if (!existsSync(filePath)) {
    return { ok: false, message: `Missing file: ${filePath}` }
  }
  const sizeMb = statSync(filePath).st_size / 1e6
  console.log(`📤 Uploading ${filePath} (${sizeMb.toFixed(1)} MB) → ${pathname}`)
  if (dryRun) {
    return { ok: true, url: null }
  }

  const stream = createReadStream(filePath)
  const result = await put(pathname, stream, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: allowOverwrite || false,
    token,
    contentType: contentTypeFor(filePath),
  })
  return { ok: true, url: result.url }
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv)
  const inputDir = resolve(args.get('--input-dir') || 'index_out')
  const channel = args.get('--channel')
  const snapshot = Boolean(args.get('--snapshot'))
  const dryRun = Boolean(args.get('--dry-run'))
  const version = args.get('--version') || computeDefaultVersion()

  if (!channel && !snapshot) {
    console.error('❌ No destination specified. Use --snapshot and/or --channel.')
    process.exit(1)
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.error('❌ BLOB_READ_WRITE_TOKEN not set')
    process.exit(1)
  }

  const blobUrl = process.env.VITE_BLOB_STORAGE_URL || ''
  console.log('\n🚀 Deploying embeddings to Vercel Blob Storage')
  console.log(`   Version: ${version}`)
  if (channel) console.log(`   Channel: ${channel}`)
  console.log(`   Source: ${inputDir}`)
  if (blobUrl) console.log(`   Destination: ${blobUrl.replace(/\/$/, '')}/`)

  const targets = []
  if (snapshot) targets.push(version)
  if (channel) targets.push(channel)

  const files = [
    'embeddings.f32bin',
    'embeddings.i8bin',
    'meta.json',
    'build_manifest.json',
  ]

  let success = 0
  let total = 0
  for (const target of targets) {
    // Allow overwrite for all targets:
    // - Channels (latest-dev, latest-prod) are mutable and should be overwritable
    // - Snapshots (v20260122-aa6bbcd) should also allow overwrite since version names
    //   are deterministic (date+sha), so redeploying the same version should update it
    for (const fileName of files) {
      const filePath = resolve(inputDir, fileName)
      if (!existsSync(filePath)) continue
      total += 1
      const pathname = `${target}/${fileName}`
      try {
        const result = await uploadFile({ 
          token, 
          pathname, 
          filePath, 
          dryRun, 
          allowOverwrite: true 
        })
        if (result.ok) success += 1
      } catch (err) {
        console.error(`❌ Upload error for ${pathname}:`, err?.message || err)
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✓ Upload complete: ${success}/${total} files uploaded successfully`)
  if (!dryRun && success !== total) {
    process.exit(1)
  }

  if (blobUrl) {
    console.log('\nAccess your embeddings at:')
    for (const target of targets) {
      console.log(`  ${blobUrl.replace(/\/$/, '')}/${target}/`)
    }
  }
}

main().catch((err) => {
  console.error('❌ Deployment failed:', err?.message || err)
  process.exit(1)
})
