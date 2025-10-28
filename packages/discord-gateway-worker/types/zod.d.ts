declare module 'zod' {
  interface ZodType<T> {
    _output: T
    optional(): ZodType<T | undefined>
    nullable(): ZodType<T | null>
  }

  type ZodLiteral<T> = ZodType<T>
  type ZodEnum<T extends readonly string[]> = ZodType<T[number]>
  type ZodUnknown = ZodType<unknown>

  interface ZodString extends ZodType<string> {
    regex(pattern: RegExp): ZodString
  }

  interface ZodNumber extends ZodType<number> {
    int(): ZodNumber
    min(value: number): ZodNumber
    max(value: number): ZodNumber
    positive(): ZodNumber
  }

  type ZodShape = Record<string, ZodType<unknown>>

  type ZodObject<T extends ZodShape> = ZodType<{ [K in keyof T]: T[K]['_output'] }>

  type ZodUnion<T extends readonly [ZodType<unknown>, ...ZodType<unknown>[]]> = ZodType<
    T[number]['_output']
  >

  const z: {
    object<T extends ZodShape>(shape: T): ZodObject<T>
    literal<T extends string | number | boolean | bigint>(value: T): ZodLiteral<T>
    enum<T extends readonly string[]>(values: T): ZodEnum<T>
    unknown(): ZodUnknown
    string(): ZodString
    number(): ZodNumber
    union<T extends readonly [ZodType<unknown>, ...ZodType<unknown>[]]>(
      members: T,
    ): ZodUnion<T>
  }

  type Infer<T extends ZodType<unknown>> = T['_output']

  export { z, ZodType }
  export type infer<T extends ZodType<unknown>> = Infer<T>
}
