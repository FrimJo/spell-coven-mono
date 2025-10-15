---
description: Intelligently commit changes in coherent chunks following Conventional Commits
---

## Overview

This workflow analyzes your git changes and creates logical, atomic commits that group related changes together. Each commit follows Conventional Commits format and aims to keep the codebase in a working state.

**Priority: SPEED over perfection.** Make quick, reasonable decisions about grouping. Don't overthink it.

## Execution Steps

### 1. Check for Changes

Run `git status --porcelain` to get a machine-readable list of all changed and untracked files.

If no changes exist, report "No changes to commit" and exit.

### 2. Analyze Changes (Quick Pass)

**Speed optimization**: Scan file paths and git diff summaries first. Only read full diffs if grouping is unclear.

For modified files: Quick `git diff --stat <file>` to see what changed.
For untracked files: Infer purpose from filename and path (only read if ambiguous).

### 3. Group Related Changes (Fast Heuristics)

**Speed first**: Use file paths and simple patterns. When in doubt, group together rather than splitting.

**Quick Grouping Rules:**
- Same directory + related names → same commit
- New files in same feature → same commit  
- Modified files with obvious relationship → same commit
- Docs/specs with matching feature name → same commit
- Config files → separate commit (unless tiny change with feature)
- Tests + implementation → same commit (faster)

**When to split:**
- Only split if changes are clearly unrelated (different features/bugs)
- Don't overthink dependencies or "perfect" atomicity

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

### 4. Determine Commit Scope (Optional)

**Speed tip**: Scope is optional. Skip if not immediately obvious from file path.

Quick scope detection:
- Component file → use component name
- Single module → use module name
- Multiple files → use feature area or skip scope

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

**Message Guidelines (Keep it brief):**
- First line: max 72 characters, imperative mood
- Body: 2-5 bullet points max (what changed, why it matters)
- Skip body if commit is self-explanatory
- Don't write essays - be concise

### 6. Handle Partial File Commits

**Speed approach**: Skip partial file commits unless explicitly requested by user.

Default: Commit entire file with the most relevant group. Partial commits slow things down.

### 7. Validation

After creating commits:
- Run `git log --oneline -n <count>` to show what was committed
- Report summary of commits created

### 8. Smart Heuristics (Simplified)

**Default patterns (fast decisions):**
- Related files → 1 commit (don't overthink order)
- Unrelated features → separate commits
- Everything else → use best judgment, move fast

**Don't worry about:**
- Perfect working state per commit
- Exact dependency order
- Splitting every tiny change

### 9. User Interaction (Streamlined)

**Speed mode**: Show brief summary and commit immediately unless user says "wait" or "show me first".

Brief format:
```
Committing 3 groups:
1. feat(detection): Add DETR model integration (2 files)
2. feat(CardPreview): Add card preview component (2 files)  
3. docs(spec): Update specification (1 file)
```

Then execute commits without waiting for confirmation (user can always undo with git reset).

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

**Speed-focused approach:**
- NO validation, tests, or linting (too slow)
- Quick pattern matching over deep analysis
- Commits may be in broken state (that's fine)
- Good enough > perfect
- Fast iteration > careful planning
- 2-3 commits better than 10 tiny ones
- When in doubt, commit it and move on
