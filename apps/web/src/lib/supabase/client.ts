/**
 * Supabase client singleton
 *
 * Creates a single Supabase client instance for the application.
 * Throws an error if required environment variables are missing.
 */

import { env } from '@/env'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
)
