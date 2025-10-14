"""
CLI argument validation functions.

This module provides validation for command-line arguments to ensure
they meet requirements before script execution begins.
"""
import sys
from typing import Any


def validate_args(args: Any) -> None:
    """
    Validate CLI arguments and exit with clear error messages if invalid.
    
    Checks:
    - limit >= 0 (if specified)
    - batch >= 1
    - size >= 64
    - workers between 1 and 128
    - hnsw_m between 4 and 128
    - hnsw_ef_construction >= hnsw_m
    - checkpoint_frequency >= 100 or 0 (disabled)
    
    Args:
        args: argparse.Namespace object with parsed arguments
    
    Raises:
        SystemExit: If any validation fails (exit code 1)
    """
    errors = []
    
    # Validate limit
    if hasattr(args, "limit") and args.limit is not None:
        if args.limit < 0:
            errors.append("--limit must be >= 0")
    
    # Validate batch size
    if hasattr(args, "batch") and args.batch is not None:
        if args.batch < 1:
            errors.append("--batch must be >= 1")
    
    # Validate image size
    if hasattr(args, "size") and args.size is not None:
        if args.size < 64:
            errors.append("--size must be >= 64 (minimum for CLIP preprocessing)")
    
    # Validate worker count
    if hasattr(args, "workers") and args.workers is not None:
        if args.workers < 1 or args.workers > 128:
            errors.append("--workers must be between 1 and 128")
    
    # Validate HNSW M parameter
    if hasattr(args, "hnsw_m") and args.hnsw_m is not None:
        if args.hnsw_m < 4 or args.hnsw_m > 128:
            errors.append("--hnsw-m must be between 4 and 128")
    
    # Validate HNSW efConstruction parameter
    if hasattr(args, "hnsw_ef_construction") and args.hnsw_ef_construction is not None:
        if args.hnsw_ef_construction < 1 or args.hnsw_ef_construction > 2000:
            errors.append("--hnsw-ef-construction must be between 1 and 2000")
        
        # Check efConstruction >= M
        if hasattr(args, "hnsw_m") and args.hnsw_m is not None:
            if args.hnsw_ef_construction < args.hnsw_m:
                errors.append(f"--hnsw-ef-construction ({args.hnsw_ef_construction}) must be >= --hnsw-m ({args.hnsw_m})")
    
    # Validate checkpoint frequency
    if hasattr(args, "checkpoint_frequency") and args.checkpoint_frequency is not None:
        if args.checkpoint_frequency < 0:
            errors.append("--checkpoint-frequency must be >= 0 (0 disables checkpointing)")
        elif args.checkpoint_frequency > 0 and args.checkpoint_frequency < 100:
            errors.append("--checkpoint-frequency must be >= 100 or 0 to disable")
    
    # Validate timeout values
    if hasattr(args, "timeout_connect") and args.timeout_connect is not None:
        if args.timeout_connect < 1:
            errors.append("--timeout-connect must be >= 1 second")
    
    if hasattr(args, "timeout_read") and args.timeout_read is not None:
        if args.timeout_read < 5:
            errors.append("--timeout-read must be >= 5 seconds")
    
    # Validate max retries
    if hasattr(args, "max_retries") and args.max_retries is not None:
        if args.max_retries < 0:
            errors.append("--max-retries must be >= 0")
    
    # If any errors, print and exit
    if errors:
        print("ERROR: Invalid arguments:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        print("\nRun with --help for usage information.", file=sys.stderr)
        sys.exit(1)


def safe_percentage(numerator: int, denominator: int) -> str:
    """
    Calculate percentage safely, handling division by zero.
    
    Args:
        numerator: Numerator value
        denominator: Denominator value
    
    Returns:
        Formatted percentage string or "N/A" if denominator is zero
    
    Examples:
        >>> safe_percentage(50, 100)
        '50.0%'
        >>> safe_percentage(0, 0)
        'N/A'
        >>> safe_percentage(5, 10)
        '50.0%'
    """
    if denominator == 0:
        return "N/A"
    return f"{(numerator / denominator) * 100:.1f}%"
