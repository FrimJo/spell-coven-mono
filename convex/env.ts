import z from 'zod'

const toBool = (value: unknown): boolean =>
  z.coerce.boolean().safeParse(value).data ?? false

export const isE2ePreview = toBool(process.env.E2E_TEST)
const isCi = toBool(process.env.CI)
const deploymentName = `${process.env.CONVEX_DEPLOYMENT ?? ''} ${process.env.VERCEL_ENV ?? ''}`
const looksLikePreviewDeployment = /preview|e2e|test|dev/i.test(deploymentName)
const hasPreviewName = Boolean(
  process.env.CONVEX_PREVIEW_NAME ?? process.env.PREVIEW_NAME,
)
const explicitAllowPreviewAuth = toBool(process.env.ALLOW_PREVIEW_AUTH)

/**
 * Additional defense-in-depth guard to avoid accidentally enabling
 * preview password auth on production-like deployments.
 */
export const isPreviewAuthAllowed =
  isE2ePreview &&
  (explicitAllowPreviewAuth || isCi || hasPreviewName || looksLikePreviewDeployment)
