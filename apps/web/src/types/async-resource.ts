/**
 * Generic types for representing async resource states
 * These can be reused for any async operation that has pending/error/success states
 */

/**
 * Base type for async resource states
 */
export type AsyncResourceBase<
  TBase extends Record<string, unknown> = Record<string, unknown>,
> = TBase

/**
 * Pending state - resource is loading
 */
export type AsyncResourcePending<
  TBase extends Record<string, unknown> = Record<string, unknown>,
> = AsyncResourceBase<TBase> & {
  isPending: true
  error: Error | null
}

/**
 * Error state - resource failed to load
 */
export type AsyncResourceError<
  TBase extends Record<string, unknown> = Record<string, unknown>,
> = AsyncResourceBase<TBase> & {
  isPending: false
  error: Error
}

/**
 * Success state - resource loaded successfully
 */
export type AsyncResourceSuccess<
  TBase extends Record<string, unknown> = Record<string, unknown>,
  TData extends Record<string, unknown> = Record<string, unknown>,
> = AsyncResourceBase<TBase> & {
  isPending: false
  error: null
} & TData

/**
 * Union type representing all possible async resource states
 */
export type AsyncResource<
  TBase extends Record<string, unknown> = Record<string, unknown>,
  TData extends Record<string, unknown> = Record<string, unknown>,
> =
  | AsyncResourcePending<TBase>
  | AsyncResourceError<TBase>
  | AsyncResourceSuccess<TBase, TData>

/**
 * Type guard to check if an async resource is in success state
 */
export function isAsyncResourceSuccess<
  TBase extends Record<string, unknown> = Record<string, unknown>,
  TData extends Record<string, unknown> = Record<string, unknown>,
>(
  resource: AsyncResource<TBase, TData>,
): resource is AsyncResourceSuccess<TBase, TData> {
  return !resource.isPending && resource.error === null
}

/**
 * Generic type guard for any object with isPending and error properties
 */
export function isSuccessState<
  T extends { isPending: boolean; error: Error | null },
>(resource: T): resource is T & { isPending: false; error: null } {
  return !resource.isPending && resource.error === null
}

/**
 * Type guard to check if an async resource is in error state
 */
export function isAsyncResourceError<
  TBase extends Record<string, unknown> = {},
>(
  resource: AsyncResource<TBase, Record<string, unknown>>,
): resource is AsyncResourceError<TBase> {
  return !resource.isPending && resource.error !== null
}

/**
 * Type guard to check if an async resource is pending
 */
export function isAsyncResourcePending<
  TBase extends Record<string, unknown> = {},
>(
  resource: AsyncResource<TBase, Record<string, unknown>>,
): resource is AsyncResourcePending<TBase> {
  return resource.isPending === true
}

/**
 * Helper type for combining two async resources
 * The combined resource is available when both resources are in success state
 */
export type CombinedAsyncResource<
  TResource1 extends AsyncResource<{}, { stream: MediaStream }>,
  TResource2 extends AsyncResource<{}, { stream: MediaStream }>,
> =
  | (TResource1 extends AsyncResourceSuccess<{}, { stream: MediaStream }>
      ? TResource2 extends AsyncResourceSuccess<{}, { stream: MediaStream }>
        ? { stream: MediaStream | null }
        : { stream: null }
      : { stream: null })
  | (TResource1 extends AsyncResourcePending<{}>
      ? { stream: null }
      : TResource1 extends AsyncResourceError<{}>
        ? { stream: null }
        : never)

/**
 * Type helper to extract the stream from an async resource when it's in success state
 */
export type ExtractStream<T extends AsyncResource> =
  T extends AsyncResourceSuccess<{}, { stream: infer S }> ? S : null
