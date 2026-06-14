import type {
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
  ReturnValueForOptionalValidator,
} from 'convex/server'
import type {
  GenericValidator,
  ObjectType,
  PropertyValidators,
  Validator,
} from 'convex/values'

import type { SentryData } from '@repo/observability'
import { sanitizeSentryData } from '@repo/observability'

import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server'
import { action, internalMutation, mutation, query } from './_generated/server'
import { getErrorCode } from './errors'

export interface ConvexSentryMetadata {
  feature: string
  operation: string
  tags?: Record<string, string | number | boolean | undefined>
  extra?: Record<string, SentryData>
}

interface ConvexSentryBreadcrumb {
  timestamp: number
  type: 'default'
  category: string
  message: string
  level: 'info'
  data?: Record<string, SentryData>
}

export interface ConvexSentryScope {
  breadcrumb: (
    category: string,
    message: string,
    data?: Record<string, SentryData>,
  ) => void
}

type ConvexSentryScopeState = {
  scope: ConvexSentryScope
  breadcrumbs: ConvexSentryBreadcrumb[]
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'Error'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isExpectedConvexError(error: unknown): boolean {
  return (
    getErrorCode(error) !== null || getErrorMessage(error) === 'Unauthorized'
  )
}

function parseDsn(dsn: string): { endpoint: string; dsn: string } | null {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace('/', '')
    if (!projectId) return null
    return {
      dsn,
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    }
  } catch {
    return null
  }
}

function createEventId(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

async function sendSentryEvent(event: Record<string, unknown>) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  const parsed = parseDsn(dsn)
  if (!parsed) return

  const eventId = createEventId()
  const payload = JSON.stringify({
    event_id: eventId,
    platform: 'javascript',
    timestamp: Date.now() / 1000,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.CONVEX_CLOUD_URL,
    release:
      process.env.VITE_SENTRY_RELEASE ??
      process.env.VITE_GITHUB_SHA ??
      process.env.VITE_BUILD_NUMBER,
    server_name: 'convex',
    ...event,
  })
  const payloadLength = new TextEncoder().encode(payload).length

  const envelope = [
    JSON.stringify({ event_id: eventId, dsn: parsed.dsn }),
    JSON.stringify({ type: 'event', length: payloadLength }),
    payload,
  ].join('\n')

  try {
    await fetch(parsed.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: envelope,
    })
  } catch (error) {
    console.error('[Sentry] Failed to send Convex event:', error)
  }
}

function createConvexSentryScope(): ConvexSentryScopeState {
  const breadcrumbs: ConvexSentryBreadcrumb[] = []
  return {
    breadcrumbs,
    scope: {
      breadcrumb(category, message, data) {
        const sanitizedData = data ? sanitizeSentryData(data) : undefined
        breadcrumbs.push({
          timestamp: Date.now() / 1000,
          type: 'default',
          category,
          message,
          level: 'info',
          data: sanitizedData,
        })
        console.info('[Sentry breadcrumb]', category, message, sanitizedData)
      },
    },
  }
}

export async function captureConvexException(
  error: unknown,
  options: ConvexSentryMetadata,
  scopeState?: Pick<ConvexSentryScopeState, 'breadcrumbs'>,
) {
  if (isExpectedConvexError(error)) {
    console.info('[Sentry expected error]', getErrorMessage(error), {
      feature: options.feature,
      operation: options.operation,
    })
    return
  }

  await sendSentryEvent({
    level: 'error',
    logger: 'convex',
    tags: {
      service: 'convex',
      feature: options.feature,
      operation: options.operation,
      ...options.tags,
    },
    breadcrumbs: scopeState?.breadcrumbs,
    extra: options.extra ? sanitizeSentryData(options.extra) : undefined,
    exception: {
      values: [
        {
          type: getErrorName(error),
          value: getErrorMessage(error),
        },
      ],
    },
  })
}

export async function captureConvexMessage(
  message: string,
  options: ConvexSentryMetadata,
) {
  await sendSentryEvent({
    level: 'info',
    logger: 'convex',
    message,
    tags: {
      service: 'convex',
      feature: options.feature,
      operation: options.operation,
      ...options.tags,
    },
    extra: options.extra ? sanitizeSentryData(options.extra) : undefined,
  })
}

export async function runWithConvexSentry<T>(
  metadata: ConvexSentryMetadata,
  callback: (scope: ConvexSentryScope) => T | Promise<T>,
): Promise<T> {
  const scopeState = createConvexSentryScope()
  try {
    return await callback(scopeState.scope)
  } catch (error) {
    await captureConvexException(error, metadata, scopeState)
    throw error
  }
}

type ConvexSentryFunctionConfig<
  Ctx,
  ArgsValidator extends PropertyValidators,
  ReturnsValidator extends
    | PropertyValidators
    | Validator<any, 'required', any>
    | GenericValidator
    | void,
  ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator>,
> = {
  args: ArgsValidator
  returns?: ReturnsValidator
  handler: (
    ctx: Ctx,
    args: ObjectType<ArgsValidator>,
    sentry: ConvexSentryScope,
  ) => ReturnValue | Promise<ReturnValue>
}

function wrapConfig<
  Ctx,
  ArgsValidator extends PropertyValidators,
  ReturnsValidator extends
    | PropertyValidators
    | Validator<any, 'required', any>
    | GenericValidator
    | void,
  ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator>,
>(
  metadata: ConvexSentryMetadata,
  config: ConvexSentryFunctionConfig<
    Ctx,
    ArgsValidator,
    ReturnsValidator,
    ReturnValue
  >,
) {
  return {
    ...config,
    handler: (ctx: Ctx, args: ObjectType<ArgsValidator>) =>
      runWithConvexSentry(metadata, (sentry) =>
        config.handler(ctx, args, sentry),
      ),
  }
}

export function sentryQuery<
  ArgsValidator extends PropertyValidators,
  ReturnsValidator extends
    | PropertyValidators
    | Validator<any, 'required', any>
    | GenericValidator
    | void = void,
  ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator> = any,
>(
  metadata: ConvexSentryMetadata,
  config: ConvexSentryFunctionConfig<
    QueryCtx,
    ArgsValidator,
    ReturnsValidator,
    ReturnValue
  >,
): RegisteredQuery<'public', ObjectType<ArgsValidator>, ReturnValue> {
  return query(wrapConfig(metadata, config) as any) as RegisteredQuery<
    'public',
    ObjectType<ArgsValidator>,
    ReturnValue
  >
}

export function sentryMutation<
  ArgsValidator extends PropertyValidators,
  ReturnsValidator extends
    | PropertyValidators
    | Validator<any, 'required', any>
    | GenericValidator
    | void = void,
  ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator> = any,
>(
  metadata: ConvexSentryMetadata,
  config: ConvexSentryFunctionConfig<
    MutationCtx,
    ArgsValidator,
    ReturnsValidator,
    ReturnValue
  >,
): RegisteredMutation<'public', ObjectType<ArgsValidator>, ReturnValue> {
  return mutation(wrapConfig(metadata, config) as any) as RegisteredMutation<
    'public',
    ObjectType<ArgsValidator>,
    ReturnValue
  >
}

export function sentryInternalMutation<
  ArgsValidator extends PropertyValidators,
  ReturnsValidator extends
    | PropertyValidators
    | Validator<any, 'required', any>
    | GenericValidator
    | void = void,
  ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator> = any,
>(
  metadata: ConvexSentryMetadata,
  config: ConvexSentryFunctionConfig<
    MutationCtx,
    ArgsValidator,
    ReturnsValidator,
    ReturnValue
  >,
): RegisteredMutation<'internal', ObjectType<ArgsValidator>, ReturnValue> {
  return internalMutation(
    wrapConfig(metadata, config) as any,
  ) as RegisteredMutation<'internal', ObjectType<ArgsValidator>, ReturnValue>
}

export function sentryAction<
  ArgsValidator extends PropertyValidators,
  ReturnsValidator extends
    | PropertyValidators
    | Validator<any, 'required', any>
    | GenericValidator
    | void = void,
  ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator> = any,
>(
  metadata: ConvexSentryMetadata,
  config: ConvexSentryFunctionConfig<
    ActionCtx,
    ArgsValidator,
    ReturnsValidator,
    ReturnValue
  >,
): RegisteredAction<'public', ObjectType<ArgsValidator>, ReturnValue> {
  return action(wrapConfig(metadata, config) as any) as RegisteredAction<
    'public',
    ObjectType<ArgsValidator>,
    ReturnValue
  >
}
