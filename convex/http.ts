/**
 * Convex HTTP Router
 *
 * Handles HTTP endpoints, including auth callbacks.
 */

import { httpRouter } from 'convex/server'

import { auth } from './auth'
import { previewLogin } from './http/previewLogin'

const http = httpRouter()

// Mount auth routes at /api/auth/*
auth.addHttpRoutes(http)

if (process.env.E2E_TEST === '1') {
  http.route({
    path: '/api/test/login',
    method: 'POST',
    handler: previewLogin,
  })
}

export default http
