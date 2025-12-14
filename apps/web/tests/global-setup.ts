import { existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { FullConfig } from '@playwright/test'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Parse a .env file and set environment variables
 */
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return

  const content = readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match && match[1] && match[2] !== undefined) {
      const key = match[1].trim()
      let value = match[2].trim()
      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      // Only set if not already defined (allows overrides from actual env)
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}

// Load environment variables from .env files (same order as the with-env script)
const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(__dirname, '../../..')

// Load in order of precedence (later files override earlier ones)
loadEnvFile(resolve(repoRoot, '.env.development'))
loadEnvFile(resolve(repoRoot, '.env.development.local'))
loadEnvFile(resolve(webRoot, '.env.development'))
loadEnvFile(resolve(webRoot, '.env.development.local'))

// Path to store the browser state with authenticated session
const STORAGE_DIR = resolve(__dirname, '../.playwright-storage')
const STORAGE_STATE_PATH = resolve(STORAGE_DIR, 'state.json')

/**
 * Global setup for Playwright tests.
 *
 * Instead of going through Discord OAuth (which opens the desktop app),
 * we authenticate directly with Supabase using the Admin API.
 *
 * Required environment variables:
 * - VITE_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for admin API)
 * - DISCORD_TEST_USER: Test user email (to find/create the user)
 * - DISCORD_TEST_USER_PSW: Not needed for admin API, but kept for compatibility
 *
 * The service role key allows us to generate a session for any user without
 * going through the normal auth flow.
 */
async function globalSetup(config: FullConfig) {
  console.log(
    '🚀 Starting global setup - authenticating with Supabase Admin API...',
  )

  // Get credentials from environment
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const testEmail = process.env.DISCORD_TEST_USER

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.development',
    )
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY in .env.development\n' +
        'The service role key is required to generate sessions for e2e testing.\n' +
        'Find it in your Supabase dashboard under Settings → API → service_role key',
    )
  }

  if (!testEmail) {
    throw new Error('Missing DISCORD_TEST_USER (email) in .env.development')
  }

  // Ensure storage directory exists
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true })
    console.log(`📁 Created storage directory: ${STORAGE_DIR}`)
  }

  // Create Supabase admin client with service role key
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Find the test user by email
  console.log(`🔍 Looking up test user: ${testEmail}...`)
  const { data: users, error: listError } =
    await supabaseAdmin.auth.admin.listUsers()

  if (listError) {
    console.error('❌ Failed to list users:', listError.message)
    throw new Error(`Failed to list users: ${listError.message}`)
  }

  const testUser = users.users.find((u) => u.email === testEmail)

  if (!testUser) {
    throw new Error(
      `Test user not found: ${testEmail}\n` +
        'Make sure this user has logged in via Discord OAuth at least once.',
    )
  }

  console.log(`✅ Found test user: ${testUser.id}`)

  // Generate a session for the test user using admin API
  console.log('🔐 Generating session for test user...')

  // Use the admin API to generate a link, which gives us a session
  const { data: sessionData, error: sessionError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: testEmail,
    })

  if (sessionError || !sessionData) {
    console.error('❌ Failed to generate session:', sessionError?.message)
    throw new Error(`Failed to generate session: ${sessionError?.message}`)
  }

  // The generated link contains a token we can use
  // Extract the token from the link and verify it
  const linkUrl = new URL(sessionData.properties.action_link)
  const token = linkUrl.searchParams.get('token')
  const tokenType = linkUrl.searchParams.get('type')

  if (!token) {
    throw new Error('No token in generated link')
  }

  console.log('✅ Generated magic link token')

  // Create a regular client to verify the token and get a session
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: verifyData, error: verifyError } =
    await supabase.auth.verifyOtp({
      token_hash: token,
      type: tokenType as 'magiclink',
    })

  if (verifyError || !verifyData.session) {
    console.error('❌ Failed to verify token:', verifyError?.message)
    throw new Error(`Failed to verify token: ${verifyError?.message}`)
  }

  const session = verifyData.session
  const user = verifyData.user

  console.log('✅ Authenticated successfully!')
  console.log(`   User ID: ${user?.id}`)
  console.log(`   Email: ${user?.email}`)

  // Now launch browser and inject the session
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  try {
    // Navigate to the app
    const baseURL = config.projects[0]?.use.baseURL || 'https://localhost:1234'
    console.log(`📍 Navigating to ${baseURL}`)
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' })

    // Inject the Supabase session into localStorage
    // Supabase stores auth in localStorage with a specific key format
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

    console.log(
      `💉 Injecting session into localStorage (key: ${storageKey})...`,
    )

    await page.evaluate(
      ({ key, session }) => {
        localStorage.setItem(key, JSON.stringify(session))
      },
      {
        key: storageKey,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type,
          user: session.user,
        },
      },
    )

    // Reload to pick up the session
    console.log('🔄 Reloading page to apply session...')
    await page.reload({ waitUntil: 'networkidle' })

    // Wait for auth to be established
    await page.waitForTimeout(2000)

    // Verify we're authenticated by checking for authenticated UI elements
    const isAuthenticated = await page
      .locator('button:has-text("Create Game"), button:has-text("Join Game")')
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (!isAuthenticated) {
      // Check if there's an avatar or username displayed
      const hasUserMenu = await page
        .locator('[class*="avatar"], [class*="Avatar"]')
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false)

      if (!hasUserMenu) {
        // Take a screenshot for debugging
        const screenshotPath = resolve(STORAGE_DIR, 'auth-failure.png')
        await page.screenshot({ path: screenshotPath, fullPage: true })
        console.log(`📸 Failure screenshot saved to ${screenshotPath}`)

        throw new Error(
          'Authentication failed - user not logged in after injecting session',
        )
      }
    }

    console.log('✅ Session verified - user is authenticated!')

    // Save the browser storage state (cookies, localStorage, sessionStorage)
    await context.storageState({ path: STORAGE_STATE_PATH })
    console.log(`💾 Browser storage state saved to ${STORAGE_STATE_PATH}`)
  } finally {
    await context.close()
    await browser.close()
  }

  console.log('🎉 Global setup completed successfully!')
}

export default globalSetup
