#!/usr/bin/env python3
"""
Standalone utility to validate cached images.

This script scans a cache directory and validates all images,
reporting corrupted or invalid files.
"""
import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from helpers import validate_cache_directory


def main():
    ap = argparse.ArgumentParser(
        description="Validate cached MTG card images"
    )
    ap.add_argument("--cache", required=True,
                    help="Directory containing cached images to validate.")
    ap.add_argument("--fix", action="store_true",
                    help="Remove corrupted files (use with caution).")
    ap.add_argument("--report", default=None,
                    help="Write validation report to this file (JSON format).")
    args = ap.parse_args()
    
    cache_dir = Path(args.cache)
    
    if not cache_dir.exists():
        print(f"ERROR: Cache directory does not exist: {cache_dir}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Validating images in: {cache_dir}")
    print("=" * 60)
    
    # Run validation
    results = validate_cache_directory(cache_dir)
    
    # Display results
    print(f"\nValidation Results:")
    print(f"  Total images: {results['total']:,}")
    print(f"  Valid images: {results['valid']:,}")
    print(f"  Invalid images: {results['invalid']:,}")
    
    if results['invalid'] > 0:
        print(f"\nInvalid files:")
        for failure in results['failures']:
            print(f"  - {failure['path']}: {failure['reason']}")
    
    # Fix corrupted files if requested
    if args.fix and results['invalid'] > 0:
        print(f"\n⚠️  Removing {results['invalid']} corrupted files...")
        removed = 0
        for failure in results['failures']:
            file_path = cache_dir / failure['path']
            try:
                file_path.unlink()
                removed += 1
            except Exception as e:
                print(f"  Failed to remove {failure['path']}: {e}")
        print(f"✓ Removed {removed} corrupted files")
    
    # Write report if requested
    if args.report:
        import json
        report_path = Path(args.report)
        with open(report_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n✓ Validation report written to: {report_path}")
    
    # Exit with error code if validation failed
    if results['invalid'] > 0:
        print(f"\n⚠️  Validation failed: {results['invalid']} corrupted files found")
        if not args.fix:
            print("   Run with --fix to remove corrupted files")
        sys.exit(1)
    else:
        print(f"\n✓ All images are valid!")
        sys.exit(0)


if __name__ == "__main__":
    main()
