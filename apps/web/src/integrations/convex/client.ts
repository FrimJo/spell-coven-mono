import { env } from '@/env'
import { ConvexReactClient } from 'convex/react'

export const convex = new ConvexReactClient(env.VITE_CONVEX_URL)
