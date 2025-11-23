/**
 * Supabase client singleton
 *
 * Creates a single Supabase client instance for the application.
 * Throws an error if required environment variables are missing.
 */

import { createClient } from '@supabase/supabase-js'
import { env } from '@/env'

if (!env.VITE_SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL is required but not set')
}

if (!env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required but not set')
}

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

