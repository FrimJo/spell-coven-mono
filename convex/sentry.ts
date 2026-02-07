import type { ObjectType, PropertyValidators } from 'convex/values'
import * as Sentry from '@sentry/node'

const globalForSentry = globalThis as typeof globalThis & {
  __spellCovenSentryInitialized?: boolean
}

const SENSITIVE_KEY_REGEX =
  /(token|password|authorization|cookie|secret|api[_-]?key|refresh|access|session|jwt|bearer)/i

const DEFAULT_TRACES_SAMPLE_RATE = 0.2
const DEVELOPMENT_TRACES_SAMPLE_RATE = 1

const SENTRY_ENVIRONMENT =
  process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development'

const VITE_SENTRY_RELEASE =
  process.env.VITE_VERCEL_GIT_COMMIT_SHA ??
  process.env.VITE_GITHUB_SHA ??
  process.env.VITE_BUILD_NUMBER

const IS_PRODUCTION = SENTRY_ENVIRONMENT === 'production'

export const sentryConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  release: VITE_SENTRY_RELEASE,
}

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, Math.min(parsed, 1))
}

function scrubObject(value: unknown): unknown {
  if (!value) return value
  if (Array.isArray(value)) {
    return value.map((item) => scrubObject(item))
  }
  if (typeof value !== 'object') {
    return value
  }

  const result: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '[Filtered]'
      continue
    }
    result[key] = scrubObject(nested)
  }
  return result
}

function pickSafeArgs<T extends Record<string, unknown>>(
  args: T,
  safeKeys: string[] | undefined,
): Record<string, unknown> | undefined {
  if (!safeKeys || safeKeys.length === 0) return undefined
  const result: Record<string, unknown> = {}
  for (const key of safeKeys) {
    if (key in args) {
      result[key] = scrubObject(args[key])
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function sanitizeEvent(event: Sentry.Event): Sentry.Event | null {
  if (event.request) {
    if (event.request.cookies) {
      delete event.request.cookies
    }
    if (event.request.headers) {
      const headers = { ...event.request.headers }
      for (const headerKey of Object.keys(headers)) {
        if (SENSITIVE_KEY_REGEX.test(headerKey)) {
          delete headers[headerKey]
        }
      }
      event.request.headers = headers
    }
    if (event.request.data) {
      delete event.request.data
    }
  }

  if (event.extra) {
    event.extra = scrubObject(event.extra) as Record<string, unknown>
  }

  return event
}

export function initSentry() {
  if (globalForSentry.__spellCovenSentryInitialized) return

  Sentry.init({
    dsn: sentryConfig.dsn,
    environment: sentryConfig.environment,
    release: sentryConfig.release,
    enabled: Boolean(sentryConfig.dsn),
    tracesSampleRate: parseSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      IS_PRODUCTION
        ? DEFAULT_TRACES_SAMPLE_RATE
        : DEVELOPMENT_TRACES_SAMPLE_RATE,
    ),
    sendDefaultPii: false,
    maxBreadcrumbs: 50,
    beforeSend: sanitizeEvent,
  })

  Sentry.setTag('service', 'convex')
  Sentry.setTag('env', sentryConfig.environment)
  if (sentryConfig.release) {
    Sentry.setTag('release', sentryConfig.release)
  }

  globalForSentry.__spellCovenSentryInitialized = true
}

export function isSentryDevelopmentEnvironment(): boolean {
  return sentryConfig.environment === 'development'
}

export type SentryHandlerOptions<Args extends Record<string, unknown>> = {
  safeArgs?: (keyof Args | string)[]
  tags?: Record<string, string>
}

function normalizeSafeKeys<Args extends Record<string, unknown>>(
  safeArgs: (keyof Args | string)[] | undefined,
): string[] | undefined {
  return safeArgs?.map((key) => key.toString())
}

function wrapHandler<ArgsValidator extends PropertyValidators, Return, Ctx>(
  name: string,
  type: 'query' | 'mutation' | 'action',
  handler: (
    ctx: Ctx,
    args: ObjectType<ArgsValidator>,
  ) => Promise<Return> | Return,
  options?: SentryHandlerOptions<ObjectType<ArgsValidator>>,
) {
  initSentry()

  return async (ctx: Ctx, args: ObjectType<ArgsValidator>): Promise<Return> => {
    const safeArgs = pickSafeArgs(args, normalizeSafeKeys(options?.safeArgs))

    return Sentry.startSpan(
      {
        name: `convex.${name}`,
        op: `convex.${type}`,
      },
      async () =>
        Sentry.withScope(async (scope) => {
          scope.setTag('service', 'convex')
          scope.setTag('function', name)
          scope.setTag('functionType', type)
          scope.setTag('env', sentryConfig.environment)
          if (sentryConfig.release) {
            scope.setTag('release', sentryConfig.release)
          }
          if (options?.tags) {
            for (const [tagKey, tagValue] of Object.entries(options.tags)) {
              scope.setTag(tagKey, tagValue)
            }
          }
          if (safeArgs) {
            scope.setContext('args', safeArgs)
          }

          try {
            return await handler(ctx, args)
          } catch (error) {
            Sentry.captureException(error)
            throw error
          }
        }),
    )
  }
}

export function sentryQuery<
  ArgsValidator extends PropertyValidators,
  Return,
  Ctx,
>(
  name: string,
  config: {
    args: ArgsValidator
    handler: (
      ctx: Ctx,
      args: ObjectType<ArgsValidator>,
    ) => Promise<Return> | Return
  },
  options?: SentryHandlerOptions<ObjectType<ArgsValidator>>,
) {
  return configBuilder('query', name, config, options)
}

export function sentryMutation<
  ArgsValidator extends PropertyValidators,
  Return,
  Ctx,
>(
  name: string,
  config: {
    args: ArgsValidator
    handler: (
      ctx: Ctx,
      args: ObjectType<ArgsValidator>,
    ) => Promise<Return> | Return
  },
  options?: SentryHandlerOptions<ObjectType<ArgsValidator>>,
) {
  return configBuilder('mutation', name, config, options)
}

export function sentryAction<
  ArgsValidator extends PropertyValidators,
  Return,
  Ctx,
>(
  name: string,
  config: {
    args: ArgsValidator
    handler: (
      ctx: Ctx,
      args: ObjectType<ArgsValidator>,
    ) => Promise<Return> | Return
  },
  options?: SentryHandlerOptions<ObjectType<ArgsValidator>>,
) {
  return configBuilder('action', name, config, options)
}

function configBuilder<ArgsValidator extends PropertyValidators, Return, Ctx>(
  type: 'query' | 'mutation' | 'action',
  name: string,
  config: {
    args: ArgsValidator
    handler: (
      ctx: Ctx,
      args: ObjectType<ArgsValidator>,
    ) => Promise<Return> | Return
  },
  options?: SentryHandlerOptions<ObjectType<ArgsValidator>>,
) {
  return {
    ...config,
    handler: wrapHandler(name, type, config.handler, options),
  }
}

export async function withDbSpan<T>(
  name: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  initSentry()
  return Sentry.startSpan({ op: 'db', name }, operation)
}

export async function withExternalSpan<T>(
  name: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  initSentry()
  return Sentry.startSpan({ op: 'http.client', name }, operation)
}

export async function withAiSpan<T>(
  name: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  initSentry()
  return Sentry.startSpan({ op: 'ai.model', name }, operation)
}

export async function withComputationSpan<T>(
  name: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  initSentry()
  return Sentry.startSpan({ op: 'compute', name }, operation)
}
