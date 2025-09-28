# PR Title

Provide a concise summary of the change. Include the primary SPEC ID(s) in the title if possible, e.g., "Implement browser search debounce [SPEC-FR-BR-02]".

## Summary
- What changed and why?
- Link to any issues if applicable.

## SPEC Linkage
- SPEC Version: see `SPEC.md` (top of file)
- SPEC IDs covered in this PR (required):
  - [ ] SPEC-...
  - [ ] SPEC-...

> Tip: Run the guard to validate these IDs exist in `SPEC.md`:
>
> ```sh
> python3 scripts/check_spec_ids.py --text "$(cat <<'BODY'
> <paste your PR description here>
> BODY
> )"
> ```

## Acceptance Criteria Status
- Describe which acceptance criteria are affected and whether they pass.
- Include links to logs or screenshots for UI behavior (if any).

## Tests
- [ ] Unit tests updated/added
- [ ] E2E/UI tests updated/added
- [ ] Manual QA notes included (if applicable)

## Environment / Dependencies
- Env files touched:
  - [ ] `environment-cpu.yml`
  - [ ] `environment-gpu.yml`
  - [ ] `environment-mps.yml`
- Notes about dependency changes:

## Screenshots / Logs
- Add any relevant screenshots or log excerpts.

## Checklist
- [ ] PR description includes at least one valid SPEC ID present in `SPEC.md`
- [ ] Acceptance criteria updated or verified
- [ ] Documentation updated (if needed)
