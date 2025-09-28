#!/usr/bin/env python3
"""
Guard script: Validate that a given text (e.g., PR description) references at least one
SPEC ID that exists in SPEC.md.

Usage examples:
  python3 scripts/check_spec_ids.py --text "Implements browser search [SPEC-FR-BR-02]"
  python3 scripts/check_spec_ids.py --file pr_description.txt
  python3 scripts/check_spec_ids.py --list   # lists all SPEC IDs parsed from SPEC.md

Exit codes:
  0 - Validation passed (at least one referenced SPEC ID exists in SPEC.md)
  1 - No SPEC IDs found in input text
  2 - SPEC IDs found in input text, but none match IDs in SPEC.md
  3 - Other error (e.g., SPEC.md missing)
"""
import argparse
import os
import re
import sys
from typing import Set, List

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC_PATH = os.path.join(REPO_ROOT, "SPEC.md")

# Matches IDs like:
#  - SPEC-FR-DA, SPEC-FR-DA-01, SPEC-FR-EI-02c
#  - SPEC-ARCH-BR-SEARCH
#  - SPEC-AC-BUILD-01.1
SPEC_ID_REGEX = re.compile(r"\bSPEC-[A-Z]+(?:-[A-Z0-9]+)*(?:-\d+(?:\.\d+)?[a-z]?)?\b")


def extract_spec_ids_from_text(text: str) -> List[str]:
    return SPEC_ID_REGEX.findall(text or "")


def load_spec_ids_from_spec_md(path: str) -> Set[str]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"SPEC.md not found at: {path}")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    return set(extract_spec_ids_from_text(content))


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description="Validate PR text references valid SPEC IDs from SPEC.md")
    src = parser.add_mutually_exclusive_group()
    src.add_argument("--text", type=str, help="Text to validate (e.g., PR description)")
    src.add_argument("--file", type=str, help="Path to a file whose contents will be validated")
    parser.add_argument("--list", action="store_true", help="List SPEC IDs parsed from SPEC.md and exit")
    args = parser.parse_args(argv)

    try:
        spec_ids = load_spec_ids_from_spec_md(SPEC_PATH)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 3

    if args.list:
        print("SPEC IDs in SPEC.md:")
        for sid in sorted(spec_ids):
            print(f"- {sid}")
        return 0

    input_text = None
    if args.text is not None:
        input_text = args.text
    elif args.file is not None:
        if not os.path.exists(args.file):
            print(f"Error: --file does not exist: {args.file}", file=sys.stderr)
            return 3
        with open(args.file, "r", encoding="utf-8") as f:
            input_text = f.read()
    else:
        parser.error("one of --text or --file is required (or use --list)")

    referenced = set(extract_spec_ids_from_text(input_text))
    if not referenced:
        print("Validation failed: No SPEC IDs found in the provided text. Please reference at least one SPEC ID from SPEC.md.", file=sys.stderr)
        return 1

    valid = referenced & spec_ids
    invalid = referenced - spec_ids

    if valid:
        print("Validation passed.")
        print("Referenced valid SPEC IDs:")
        for sid in sorted(valid):
            print(f"- {sid}")
    else:
        print("Validation failed: None of the referenced SPEC IDs were found in SPEC.md.", file=sys.stderr)

    if invalid:
        print("Warning: The following SPEC IDs were not found in SPEC.md:", file=sys.stderr)
        for sid in sorted(invalid):
            print(f"- {sid}", file=sys.stderr)

    return 0 if valid else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
