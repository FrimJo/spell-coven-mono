Create release notes in markdown for all changes between the latest `v*` tag and `origin/main`.

Audience:

- Stakeholders and product owners with little to no technical background.

Use plain language and avoid engineering jargon.
Focus on value, impact, and user-visible outcomes.

Use the exact format below.

## Release Title Template

`Release <YYYY-MM-DD> - <plain-language theme>`

Rules:

- Keep it clear and outcome-focused.
- Do not mention low-level implementation details.
- Keep it understandable to non-technical readers.

Examples:

- `Release 2026-02-20 - Faster onboarding and clearer navigation`
- `Release 2026-02-20 - Better reliability and campaign reporting`

## Release Notes Template

```md
# <Release title>

## Highlights

- <most important improvement in one plain-language sentence>
- <second key improvement in one plain-language sentence>
- <third key improvement in one plain-language sentence>

## What This Means for the Business

- <business outcome 1>
- <business outcome 2>

## User Impact

- <who is affected and how>
- <what gets easier, faster, or more reliable>

## Known Limitations

- <any caveat in plain language, or "None in this release">

## Follow-Up (Next Up)

- <upcoming item 1>
- <upcoming item 2>
```

Writing guidelines:

- Prefer "you" and "users" over internal team terms.
- Replace technical terms with outcomes (e.g. "faster page loads" instead of "optimized rendering").
- Keep bullets concise and scannable.
- If a technical term is unavoidable, explain it in plain English.

Output requirements:

- Return exactly two sections in your answer:
  1. `Release Title`
  2. `Release Notes` (markdown body ready to share)
