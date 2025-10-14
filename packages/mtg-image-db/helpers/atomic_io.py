"""
Atomic file write operations.

This module provides functions for atomic file writes to prevent partial
file corruption during interruptions or failures.
"""
import os
from pathlib import Path
from typing import BinaryIO


def atomic_write(target_path: Path, data: bytes) -> bool:
    """
    Write data to a file atomically using a temporary file.
    
    Process:
    1. Write to temporary .part file
    2. Flush and fsync to ensure data is on disk
    3. Atomically rename to target path
    
    This prevents partial files from being treated as valid if the
    write is interrupted.
    
    Args:
        target_path: Final destination path for the file
        data: Binary data to write
    
    Returns:
        True if write succeeded, False otherwise
    
    Examples:
        >>> atomic_write(Path("output.jpg"), image_bytes)
        True
    """
    temp_path = target_path.with_suffix(target_path.suffix + ".part")
    
    try:
        # Ensure parent directory exists
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to temporary file
        with open(temp_path, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())  # Ensure data is written to disk
        
        # Atomically rename to target
        os.replace(temp_path, target_path)
        return True
    
    except (OSError, IOError) as e:
        # Clean up temp file if it exists
        if temp_path.exists():
            try:
                temp_path.unlink()
            except:
                pass
        return False


def atomic_write_stream(target_path: Path, stream: BinaryIO, chunk_size: int = 16384) -> bool:
    """
    Write data from a stream to a file atomically.
    
    Useful for writing HTTP response streams without loading entire
    content into memory.
    
    Args:
        target_path: Final destination path for the file
        stream: Binary stream to read from (e.g., response.iter_content())
        chunk_size: Size of chunks to read/write (default: 16KB)
    
    Returns:
        True if write succeeded, False otherwise
    
    Examples:
        >>> response = requests.get(url, stream=True)
        >>> atomic_write_stream(Path("output.jpg"), response.iter_content(16384))
        True
    """
    temp_path = target_path.with_suffix(target_path.suffix + ".part")
    
    try:
        # Ensure parent directory exists
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write stream to temporary file
        with open(temp_path, "wb") as f:
            for chunk in stream:
                if chunk:  # Filter out keep-alive chunks
                    f.write(chunk)
            f.flush()
            os.fsync(f.fileno())  # Ensure data is written to disk
        
        # Atomically rename to target
        os.replace(temp_path, target_path)
        return True
    
    except (OSError, IOError) as e:
        # Clean up temp file if it exists
        if temp_path.exists():
            try:
                temp_path.unlink()
            except:
                pass
        return False


def cleanup_partial_files(directory: Path) -> int:
    """
    Remove all .part files from a directory.
    
    Useful for cleaning up after interrupted downloads.
    
    Args:
        directory: Directory to clean
    
    Returns:
        Number of .part files removed
    """
    if not directory.exists():
        return 0
    
    count = 0
    for part_file in directory.glob("*.part"):
        try:
            part_file.unlink()
            count += 1
        except:
            pass
    
    return count
