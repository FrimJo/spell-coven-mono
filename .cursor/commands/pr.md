Create a pull request proposal in markdown.

Context:

- Base branch: `origin/develop`
- Compare branch: `origin/main` rebased onto `origin/develop`

Use the exact format below.

## PR Title Template

`<type>(<scope>): <short outcome-focused summary>`

Rules:

- Keep title under 72 characters.
- Use one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`.
- Prefer business/user impact over implementation detail.
- Use imperative mood (e.g. "add", "fix", "improve").

Examples:

- `feat(web): add campaign landing page hero variants`
- `fix(auth): prevent session loss after token refresh`

## PR Description Template

```md
## Summary

- <what changed and why in one sentence>
- <key user or business impact>
- <important design/architecture decision if relevant>

## Changes

- <change area 1>
- <change area 2>
- <change area 3>

## Risks and Mitigations

- <risk>: <mitigation>
- <risk>: <mitigation>

## Test Plan

- [ ] <manual or automated check 1>
- [ ] <manual or automated check 2>
- [ ] <manual or automated check 3>

## Screenshots (if UI)

<before/after images or "N/A">

## Rollout and Monitoring

- Rollout: <how this ships>
- Monitoring: <what to watch after deploy>

## Linked Issues

- <ticket/issue link or "N/A">
```

Output requirements:

- Return exactly two sections in your answer:
  1. `PR Title`
  2. `PR Description` (markdown body ready to paste into GitHub)
