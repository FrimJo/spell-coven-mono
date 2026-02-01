/**
 * Convex HTTP Router
 *
 * Handles HTTP endpoints, including auth callbacks.
 */

import { httpRouter } from 'convex/server'

import { auth } from './auth'

const http = httpRouter()

// Mount auth routes at /api/auth/*
auth.addHttpRoutes(http)

export default http
