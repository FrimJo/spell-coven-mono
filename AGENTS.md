# Agent Instructions

## Required pre-wrap checks

- Run `bun run react:doctor` before wrapping up any implementation work.
- A task is not considered complete unless React Doctor reports a score of `100/100`.

## React Doctor LLM Skill

- Use the React Doctor LLM skill workflow from the official docs when diagnosing and fixing React issues: https://github.com/millionco/react-doctor
- Apply the suggested fixes, then rerun `bun run react:doctor` until the score reaches `100/100`.
