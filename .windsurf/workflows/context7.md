---
description: Use Context7 MCP server to fetch up-to-date library documentation
---

# Context7 MCP Server Workflow

This workflow ensures you properly use the Context7 MCP server to retrieve accurate, up-to-date documentation for any library or framework.

## When to Use Context7

Use Context7 when you need:
- Current documentation for a specific library version
- Code examples and usage patterns
- API references for external packages
- Framework-specific best practices
- Up-to-date information beyond your training data

## Workflow Steps

### 1. Identify the Library Need

Determine what library documentation is needed based on:
- User's explicit request for a library
- Dependencies in package.json, requirements.txt, etc.
- Import statements in the code
- Framework or tool being used

### 2. Resolve the Library ID

**CRITICAL**: You MUST call `mcp1_resolve-library-id` first, UNLESS the user provides an ID in `/org/project` or `/org/project/version` format.

```
Use mcp1_resolve-library-id with the library name (e.g., "react", "next.js", "mongodb")

This returns:
- Context7-compatible library ID (e.g., "/vercel/next.js")
- Available versions
- Trust scores
- Documentation coverage
```

**Selection criteria**:
- Exact name matches are prioritized
- Higher trust scores (7-10) indicate more authoritative docs
- More code snippets = better documentation coverage
- Match the version to the project's dependencies when possible

### 3. Fetch the Documentation

Once you have the library ID, fetch the docs:

```
Use mcp1_get-library-docs with:
- context7CompatibleLibraryID: The exact ID from step 2 (e.g., "/vercel/next.js/v14.3.0-canary.87")
- topic: Specific area to focus on (e.g., "routing", "hooks", "authentication")
- tokens: Amount of documentation (default 5000, increase for more context)
```

### 4. Apply the Documentation

Use the retrieved documentation to:
- Answer user questions accurately
- Write code following current best practices
- Reference correct API signatures
- Use up-to-date patterns and conventions

## Examples

### Example 1: Next.js Routing
```
1. User asks about Next.js App Router
2. Call mcp1_resolve-library-id with "next.js"
3. Select "/vercel/next.js" (or specific version)
4. Call mcp1_get-library-docs with:
   - context7CompatibleLibraryID: "/vercel/next.js"
   - topic: "app router"
   - tokens: 5000
5. Use the docs to provide accurate routing guidance
```

### Example 2: MongoDB Operations
```
1. User needs MongoDB aggregation help
2. Call mcp1_resolve-library-id with "mongodb"
3. Select "/mongodb/docs"
4. Call mcp1_get-library-docs with:
   - context7CompatibleLibraryID: "/mongodb/docs"
   - topic: "aggregation pipeline"
   - tokens: 7000
5. Provide accurate aggregation examples
```

### Example 3: User Provides Library ID
```
1. User says: "Use /supabase/supabase for auth"
2. SKIP resolve-library-id (ID already provided)
3. Call mcp1_get-library-docs directly with:
   - context7CompatibleLibraryID: "/supabase/supabase"
   - topic: "authentication"
```

## Best Practices

### DO:
- ✅ Always call `resolve-library-id` first (unless ID provided)
- ✅ Use the exact library ID returned by resolve
- ✅ Specify a focused topic to get relevant docs
- ✅ Match library versions to project dependencies
- ✅ Acknowledge when using Context7 docs in your response
- ✅ Increase token count for complex topics

### DON'T:
- ❌ Skip resolve-library-id and guess the library ID
- ❌ Use library IDs that aren't in `/org/project` format
- ❌ Fetch docs for libraries you already know well enough
- ❌ Use overly broad topics (be specific)
- ❌ Ignore version mismatches with project dependencies

## Common Library Patterns

### JavaScript/TypeScript Frameworks
- React: `/facebook/react`
- Next.js: `/vercel/next.js`
- Vue: `/vuejs/vue` or `/vuejs/core`
- Svelte: `/sveltejs/svelte`

### Backend & Databases
- MongoDB: `/mongodb/docs`
- Supabase: `/supabase/supabase`
- Prisma: `/prisma/prisma`

### UI Libraries
- Tailwind CSS: `/tailwindlabs/tailwindcss`
- shadcn/ui: Use the shadcn MCP server instead
- Material-UI: `/mui/material-ui`

## Troubleshooting

**No results from resolve-library-id**:
- Try alternative names (e.g., "nextjs" vs "next.js")
- Try organization name (e.g., "vercel/next.js")
- Check if library has official docs on Context7

**Documentation seems outdated**:
- Request specific version: `/org/project/version`
- Check trust score (prefer 7-10)
- Verify against project's package version

**Too much/too little documentation**:
- Adjust tokens parameter (1000-10000)
- Make topic more specific or broader
- Make multiple calls for different topics
