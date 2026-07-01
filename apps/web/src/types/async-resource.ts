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
 * Generic type guard for any object with isPending and error properties
 */
export function isSuccessState<
  T extends { isPending: boolean; error: Error | null },
>(resource: T): resource is T & { isPending: false; error: null } {
  return !resource.isPending && resource.error === null
}

/**
 * Helper type for combining two async resources
 * The combined resource is available when both resources are in success state
 */
export type CombinedAsyncResource<
  TResource1 extends AsyncResource<
    Record<string, unknown>,
    { stream: MediaStream }
  >,
  TResource2 extends AsyncResource<
    Record<string, unknown>,
    { stream: MediaStream }
  >,
> =
  | (TResource1 extends AsyncResourceSuccess<
      Record<string, unknown>,
      { stream: MediaStream }
    >
      ? TResource2 extends AsyncResourceSuccess<
          Record<string, unknown>,
          { stream: MediaStream }
        >
        ? { stream: MediaStream | null }
        : { stream: null }
      : { stream: null })
  | (TResource1 extends AsyncResourcePending<Record<string, unknown>>
      ? { stream: null }
      : TResource1 extends AsyncResourceError<Record<string, unknown>>
        ? { stream: null }
        : never)

/**
 * Type helper to extract the stream from an async resource when it's in success state
 */
export type ExtractStream<T extends AsyncResource> =
  T extends AsyncResourceSuccess<Record<string, unknown>, { stream: infer S }>
    ? S
    : null
