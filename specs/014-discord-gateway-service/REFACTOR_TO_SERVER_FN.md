# Refactor API Routes to createServerFn Pattern

**Date**: 2025-10-27  
**Status**: ✅ Complete

## Overview

Refactored API route handlers to use the `createServerFn` pattern from TanStack Start, matching the pattern used in `discord-rooms.ts`. This provides better separation of concerns, reusability, and testability.

## Files Refactored

### 1. `/api/create-room.ts`
**Before**: Direct route handler with inline logic (147 lines)  
**After**: Separate server function + route wrapper (167 lines)

### 2. `/api/end-room.$channelId.ts`
**Before**: Direct route handler with inline logic (138 lines)  
**After**: Separate server function + route wrapper (167 lines)

## Pattern Comparison

### Before (Old Pattern)
```typescript
export const Route = createFileRoute('/api/create-room')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Extract headers
          const authHeader = request.headers.get('Authorization')
          const token = extractBearerToken(authHeader)
          
          // Verify JWT
          await verifyJWT(token, { ... })
          
          // Parse body
          const body = await request.json()
          
          // Business logic...
          
          // Return Response object
          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(JSON.stringify({ error }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
```

### After (New Pattern)
```typescript
// 1. Server-only secrets helper
const getSecrets = createServerOnlyFn(() => {
  const botToken = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.PRIMARY_GUILD_ID
  // ... validation
  return { botToken, guildId, ... }
})

// 2. Typed input/output interfaces
interface CreateRoomInput {
  authHeader: string | null
  body: unknown
}

interface CreateRoomOutput {
  channelId: string
  name: string
  guildId: string
}

// 3. Server function with business logic
export const createRoomFn = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateRoomInput) => data)
  .handler(async ({ data }): Promise<CreateRoomOutput> => {
    const { authHeader, body } = data
    const { botToken, guildId, ... } = getSecrets()
    
    // Extract and verify JWT
    const token = extractBearerToken(authHeader)
    if (!token) {
      throw new Error('Missing Authorization header')
    }
    
    await verifyJWT(token, { ... })
    
    // Business logic...
    
    // Return typed data (not Response object)
    return response
  })

// 4. Route wrapper for HTTP handling
export const Route = createFileRoute('/api/create-room')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const authHeader = request.headers.get('Authorization')
          const body = await request.json()
          
          const result = await createRoomFn({ data: { authHeader, body } })
          
          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          // Error handling with status codes
          const message = error instanceof Error ? error.message : 'Internal server error'
          const status = message.includes('Authorization') ? 401 :
                        message.includes('Invalid request') ? 400 : 500
          
          return new Response(JSON.stringify({ error, message }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
```

## Benefits

### 1. **Separation of Concerns**
- **Business Logic**: In `createRoomFn` / `deleteRoomFn`
- **HTTP Handling**: In Route handler
- **Secrets Management**: In `getSecrets()`

### 2. **Reusability**
Server functions can be called from:
- API routes (HTTP)
- Other server functions
- Server-side loaders
- Server-side actions
- Tests

Example:
```typescript
// Can be called directly in tests
const result = await createRoomFn({
  data: {
    authHeader: 'Bearer token',
    body: { name: 'test-room' }
  }
})
```

### 3. **Type Safety**
- Input/output interfaces clearly defined
- No `any` types
- TypeScript validates data flow

### 4. **Testability**
- Server functions can be unit tested without HTTP layer
- Easier to mock dependencies
- Clear input/output contracts

### 5. **Consistency**
- Matches pattern used in `discord-rooms.ts`
- Consistent error handling
- Consistent secrets management

### 6. **Error Handling**
- Server functions throw errors (simple)
- Route handlers convert to HTTP status codes
- Clear error messages with appropriate status codes

## Architecture

### Before
```
Route Handler
├── Extract headers/body
├── Verify JWT
├── Validate input
├── Business logic
├── Format response
└── Return Response object
```

### After
```
Route Handler (HTTP layer)
├── Extract headers/body
└── Call Server Function
    ├── getSecrets() → Environment validation
    ├── Extract & verify JWT
    ├── Validate input
    ├── Business logic
    └── Return typed data
└── Convert to Response object
```

## Implementation Details

### Secrets Management
```typescript
const getSecrets = createServerOnlyFn(() => {
  const botToken = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.PRIMARY_GUILD_ID
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE
  const jwksUrl = process.env.JWT_PUBLIC_JWK_URL

  // Validate all required env vars
  if (!botToken?.length) {
    throw new Error('DISCORD_BOT_TOKEN environment variable is not defined')
  }
  // ... more validation

  return { botToken, guildId, jwtIssuer, jwtAudience, jwksUrl }
})
```

**Benefits**:
- Single place to validate environment variables
- Type-safe access to secrets
- Fails fast if misconfigured

### Input Validation
```typescript
interface CreateRoomInput {
  authHeader: string | null
  body: unknown
}

export const createRoomFn = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateRoomInput) => data)
  .handler(async ({ data }): Promise<CreateRoomOutput> => {
    // data is typed as CreateRoomInput
  })
```

**Benefits**:
- Clear input contract
- Type-safe data access
- Runtime validation possible

### Error Handling
```typescript
// In server function: throw errors
if (!token) {
  throw new Error('Missing Authorization header')
}

// In route handler: convert to HTTP status
catch (error) {
  const message = error instanceof Error ? error.message : 'Internal server error'
  const status = message.includes('Authorization') ? 401 :
                message.includes('Invalid request') ? 400 : 500
  
  return new Response(JSON.stringify({ error, message }), { status, ... })
}
```

**Benefits**:
- Simple error handling in business logic
- Centralized HTTP status mapping
- Consistent error responses

## Testing

### Type Checking ✅
```bash
pnpm check-types
# All packages pass
```

### Linting ✅
```bash
pnpm lint
# All packages pass
```

### Manual Testing Required
- [ ] Test POST `/api/create-room` with valid JWT
- [ ] Test POST `/api/create-room` with invalid JWT (401)
- [ ] Test POST `/api/create-room` with invalid body (400)
- [ ] Test DELETE `/api/end-room/:channelId` with valid JWT
- [ ] Test DELETE `/api/end-room/:channelId` with invalid channel ID (400)
- [ ] Test DELETE `/api/end-room/:channelId` with non-existent channel (404)

## Migration Guide

### For Future API Routes

When creating new API routes, follow this pattern:

1. **Create secrets helper** (if not exists)
```typescript
const getSecrets = createServerOnlyFn(() => {
  // Validate and return env vars
})
```

2. **Define input/output interfaces**
```typescript
interface MyInput {
  authHeader: string | null
  // ... other inputs
}

interface MyOutput {
  // ... output fields
}
```

3. **Create server function**
```typescript
export const myFn = createServerFn({ method: 'POST' })
  .inputValidator((data: MyInput) => data)
  .handler(async ({ data }): Promise<MyOutput> => {
    // Business logic
    // Throw errors for failures
    return result
  })
```

4. **Create route wrapper**
```typescript
export const Route = createFileRoute('/api/my-route')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Extract inputs from request
          const result = await myFn({ data: inputs })
          return new Response(JSON.stringify(result), { status: 200, ... })
        } catch (error) {
          // Map errors to HTTP status codes
          return new Response(JSON.stringify({ error }), { status: 500, ... })
        }
      },
    },
  },
})
```

## Success Criteria

✅ Both API routes refactored  
✅ Pattern matches `discord-rooms.ts`  
✅ Type checking passes  
✅ Linting passes  
✅ Server functions are reusable  
✅ Clear separation of concerns  
✅ Consistent error handling  
✅ Type-safe input/output  

## Conclusion

Successfully refactored both API routes to use the `createServerFn` pattern. The code is now more maintainable, testable, and consistent with the rest of the codebase.

**Key Improvements**:
- ✅ Separation of business logic from HTTP handling
- ✅ Reusable server functions
- ✅ Type-safe input/output contracts
- ✅ Consistent secrets management
- ✅ Better error handling
- ✅ Easier to test

The refactored code follows TanStack Start best practices and provides a solid foundation for future API development.
