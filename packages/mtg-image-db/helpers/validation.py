"""
Image validation functions for cache integrity.

This module provides functions to validate cached image files before embedding,
preventing corrupted data from entering the pipeline.
"""
from pathlib import Path
from PIL import Image, UnidentifiedImageError


def validate_image(path: Path) -> tuple[bool, str | None]:
    """
    Validate that a file is a valid, loadable image.
    
    Performs two-stage validation:
    1. Image.verify() - checks file integrity without full decode
    2. Image.load() - ensures the image can actually be decoded
    
    Args:
        path: Path to image file to validate
    
    Returns:
        Tuple of (is_valid, error_message)
        - (True, None) if image is valid
        - (False, error_message) if validation fails
    
    Examples:
        >>> validate_image(Path("valid.jpg"))
        (True, None)
        >>> validate_image(Path("corrupted.jpg"))
        (False, "Truncated file")
        >>> validate_image(Path("error.html"))
        (False, "Not a valid image format")
    """
    if not path.exists():
        return False, "File does not exist"
    
    if path.stat().st_size == 0:
        return False, "File is empty (0 bytes)"
    
    try:
        # First pass: verify file integrity
        with Image.open(path) as img:
            img.verify()
        
        # Second pass: ensure decodable (verify() closes the file)
        with Image.open(path) as img:
            img.load()
        
        return True, None
    
    except UnidentifiedImageError:
        return False, "Not a valid image format (may be HTML error page)"
    
    except (OSError, SyntaxError) as e:
        # OSError: file I/O issues, truncated files
        # SyntaxError: corrupted image data
        return False, f"Corrupted or truncated file: {str(e)}"
    
    except Exception as e:
        # Catch-all for unexpected errors
        return False, f"Validation error: {str(e)}"


def validate_cache_directory(cache_dir: Path) -> dict:
    """
    Validate all image files in a cache directory.
    
    Args:
        cache_dir: Path to cache directory
    
    Returns:
        Dictionary with validation results:
        {
            "total": int,
            "valid": int,
            "invalid": int,
            "failures": [{"path": str, "reason": str}, ...]
        }
    """
    results = {
        "total": 0,
        "valid": 0,
        "invalid": 0,
        "failures": []
    }
    
    if not cache_dir.exists():
        return results
    
    # Check all image files (common extensions)
    for ext in ["*.jpg", "*.jpeg", "*.png", "*.gif", "*.webp"]:
        for path in cache_dir.glob(ext):
            results["total"] += 1
            is_valid, error = validate_image(path)
            
            if is_valid:
                results["valid"] += 1
            else:
                results["invalid"] += 1
                results["failures"].append({
                    "path": str(path.name),
                    "reason": error
                })
    
    return results
