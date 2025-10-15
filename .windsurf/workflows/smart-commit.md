---
description: Intelligently commit changes in coherent chunks following Conventional Commits
---

## Overview

This workflow analyzes your git changes and creates logical, atomic commits that group related changes together. Each commit follows Conventional Commits format and aims to keep the codebase in a working state.

## Execution Steps

### 1. Check for Changes

Run `git status --porcelain` to get a machine-readable list of all changed and untracked files.

If no changes exist, report "No changes to commit" and exit.

### 2. Analyze Changes

For each modified file, run `git diff <file>` to understand what changed.

For untracked files, read the file to understand its purpose.

### 3. Group Related Changes

Group changes into logical commits based on these heuristics:

**Grouping Rules:**
- **New feature files together**: If multiple new files implement the same feature (e.g., component + types + constants), group them
- **Related modifications**: Changes in multiple files that serve the same purpose (e.g., adding a new prop to a component and updating its usage)
- **Type definitions with implementations**: Type changes should be committed with the code that uses them
- **Test files with implementation**: Tests for a feature should be committed with that feature
- **Documentation with code**: README, spec, or doc changes related to code changes should be grouped
- **Configuration changes separately**: Package.json, config files, etc. should be separate unless directly related to a feature
- **Refactoring separately**: Pure refactoring (no behavior change) should be separate from feature work
- **Bug fixes separately**: Bug fixes should be isolated commits

**Commit Type Detection:**
- `feat:` - New features, components, or capabilities
- `fix:` - Bug fixes
- `refactor:` - Code restructuring without behavior change
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `docs:` - Documentation only
- `style:` - Formatting, whitespace (no code change)
- `chore:` - Build process, dependencies, tooling
- `wip:` - Work in progress (incomplete feature)
- `revert:` - Reverting previous changes

### 4. Determine Commit Scope

For each group, determine the scope (optional but recommended):
- Component name (e.g., `feat(CardPreview):`)
- Module name (e.g., `feat(webcam):`)
- Package name in monorepo (e.g., `feat(web):`)
- Feature area (e.g., `feat(detection):`)

### 5. Create Commits

For each logical group:

1. **Stage the changes**: Use `git add <files>` for the specific files in this group
2. **Craft commit message**:
   ```
   <type>(<scope>): <short description>
   
   <optional body with details>
   - Bullet point 1
   - Bullet point 2
   
   <optional footer>
   ```
3. **Execute commit**: Run `git commit -m "<message>"`

**Message Guidelines:**
- First line: max 72 characters, imperative mood ("add" not "added")
- Body: explain WHAT and WHY, not HOW
- Include breaking changes in footer if applicable
- Reference issue numbers if relevant

### 6. Handle Partial File Commits

If a file has multiple unrelated changes that should be in different commits:

1. Use `git add -p <file>` for interactive staging
2. Stage only the hunks related to the current commit
3. Commit that subset
4. Repeat for remaining changes

**Note**: This requires user interaction, so ask for confirmation before using interactive mode.

### 7. Validation

After creating commits:
- Run `git log --oneline -n <count>` to show what was committed
- Report summary of commits created

### 8. Smart Heuristics

**Working State Detection:**
- If changes include both type definitions and implementations, commit types first
- If changes include both tests and implementation, prefer committing together
- If changes span multiple layers (UI + logic + types), commit bottom-up (types → logic → UI)

**Common Patterns:**
- New component + its usage → 2 commits (component first, integration second)
- Refactoring + new feature → 2 commits (refactor first, feature second)
- Bug fix + test → 1 commit (together)
- Multiple independent features → separate commits
- WIP incomplete work → single `wip:` commit with clear description

### 9. User Interaction

Before committing, show the user:
```
Found X groups of changes:

1. feat(detection): Add DETR model integration
   - apps/web/src/lib/detection-constants.ts (new)
   - apps/web/src/types/card-query.ts (modified)
   
2. feat(CardPreview): Add new card preview component
   - apps/web/src/components/CardPreview.tsx (new)
   - apps/web/src/components/GameRoom.tsx (modified)

3. docs(spec): Update feature specification
   - specs/008-replace-opencv-card/spec.md (modified)

Proceed with these commits? (yes/no/edit)
```

If user says "edit", ask which commits to modify or skip.

### 10. Error Handling

- If `git add` fails, report the error and skip that commit
- If `git commit` fails, show the error and ask how to proceed
- If conflicts exist, report them and halt
- If working directory is not clean after all commits, report remaining changes

## Example Usage

User types: `/smart-commit` or just "commit"

The workflow will:
1. Analyze all changes
2. Group them logically
3. Show proposed commits
4. Execute after confirmation
5. Report results

## Notes

- This workflow does NOT run validation, tests, or linting
- It uses common sense to group changes, not strict rules
- Some commits may be in a broken state (that's acceptable)
- Focus on logical coherence over perfect working state
- Prefer smaller, focused commits over large monolithic ones
