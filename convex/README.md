# Welcome to your Convex functions directory!

Write your Convex functions here.
See https://docs.convex.dev/functions for more.

A query function that takes two arguments looks like:

```ts
// convex/myFunctions.ts
import { v } from 'convex/values'

import { query } from './_generated/server'

export const myQueryFunction = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query('tablename').collect()

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second)

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents
  },
})
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.myFunctions.myQueryFunction, {
  first: 10,
  second: 'hello',
})
```

A mutation function looks like:

```ts
// convex/myFunctions.ts
import { v } from 'convex/values'

import { mutation } from './_generated/server'

export const myMutationFunction = mutation({
  // Validators for arguments.
  args: {
    first: v.string(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second }
    const id = await ctx.db.insert('messages', message)

    // Optionally, return a value from your mutation.
    return await ctx.db.get('messages', id)
  },
})
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.myFunctions.myMutationFunction)
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: 'Hello!', second: 'me' })
  // OR
  // use the result once the mutation has completed
  mutation({ first: 'Hello!', second: 'me' }).then((result) =>
    console.log(result),
  )
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.

### Preview deploys and `convex:test`

Preview deploy automation is centralized in `scripts/convex-preview.sh`. It is
used by:

- local scripts (`convex:test`, `convex:e2e:ui`)
- GitHub Actions web E2E workflow
- Vercel preview build command

It requires a **preview deploy key** (not a regular deploy key). Create one at:
Dashboard → your deployment → Settings → **Preview deploy keys**. Set it as
`CONVEX_DEPLOY_KEY` when running locally (e.g. in `.env.test` or `.env.local`)
and in CI/Vercel secret settings.

Preview name resolution is automatic:

- `CONVEX_PREVIEW_NAME` / `PREVIEW_NAME` if set
- otherwise Vercel/GitHub ref/sha environment variables
- fallback: `local`

When `convex:test` runs, it persists the dynamically generated preview URL to:

- `.env.test.generated`
- `apps/web/.env.test.generated`

using `VITE_CONVEX_URL=...` so local Playwright runs can reuse the same URL.

#### E2E auth env requirements

`E2E_TEST=1` is managed in the Convex Dashboard under **Default Environment
Variables** so new preview deployments are created with E2E auth mode enabled.

- For new preview deployments: no CLI step is required.
- For existing preview deployments created before this default was added: set
  `E2E_TEST=1` in that deployment's settings page.

`PREVIEW_LOGIN_CODE` remains per-run and is set by CI for each preview deploy.
