#!/usr/bin/env python3
"""
Deploy exported embeddings to Vercel Blob Storage.

Usage:
    python deploy_to_blob.py --major 1 --minor 3
    python deploy_to_blob.py --major 1 --minor 3 --input-dir index_out

Environment variables required:
    VITE_BLOB_STORAGE_URL: Base URL for Vercel Blob Storage
    BLOB_READ_WRITE_TOKEN: Authentication token for Vercel Blob
"""
import argparse
import json
import os
from pathlib import Path
from typing import Optional
import sys

try:
    import requests
except ImportError:
    print("Error: 'requests' library not found. Install with: pip install requests")
    sys.exit(1)

from config import get_config


def get_blob_credentials() -> tuple[str, str]:
    """Get Vercel Blob credentials from environment."""
    config = get_config()

    blob_url = config.get('VITE_BLOB_STORAGE_URL')
    blob_token = config.get('BLOB_READ_WRITE_TOKEN')

    if not blob_url:
        raise ValueError(
            "VITE_BLOB_STORAGE_URL not found in environment variables"
        )
    if not blob_token:
        raise ValueError(
            "BLOB_READ_WRITE_TOKEN not found in environment variables"
        )

    return blob_url, blob_token


def upload_file_to_blob(
    file_path: Path,
    blob_url: str,
    blob_token: str,
    remote_path: str
) -> bool:
    """
    Upload a single file to Vercel Blob Storage.

    Args:
        file_path: Local file to upload
        blob_url: Base Vercel Blob URL
        blob_token: Authentication token
        remote_path: Remote path in blob storage (e.g., "v1.3/embeddings.f32bin")

    Returns:
        True if successful, False otherwise
    """
    if not file_path.exists():
        print(f"❌ File not found: {file_path}")
        return False

    file_size_mb = file_path.stat().st_size / 1e6
    print(f"📤 Uploading {file_path.name} ({file_size_mb:.1f} MB) → {remote_path}")

    try:
        with open(file_path, 'rb') as f:
            files = {'file': (remote_path, f)}
            headers = {'Authorization': f'Bearer {blob_token}'}

            # Vercel Blob API endpoint
            response = requests.post(
                f"{blob_url.rstrip('/')}/upload",
                files=files,
                headers=headers,
                timeout=300  # 5 minute timeout for large files
            )

            if response.status_code in [200, 201]:
                print(f"✓ Uploaded: {remote_path}")
                return True
            else:
                print(f"❌ Upload failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False

    except requests.exceptions.Timeout:
        print(f"❌ Upload timeout for {file_path.name}")
        return False
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return False


def deploy_embeddings(
    major: int,
    minor: int,
    input_dir: Path = Path("index_out"),
    dry_run: bool = False
) -> bool:
    """
    Deploy embeddings to Vercel Blob Storage.

    Args:
        major: Major version number
        minor: Minor version number
        input_dir: Directory containing exported files
        dry_run: If True, only show what would be uploaded

    Returns:
        True if all files uploaded successfully, False otherwise
    """
    # Validate input directory
    if not input_dir.exists():
        print(f"❌ Input directory not found: {input_dir}")
        return False

    # Get credentials
    try:
        blob_url, blob_token = get_blob_credentials()
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        return False

    # Version folder
    version_folder = f"v{major}.{minor}"
    print(f"\n🚀 Deploying embeddings to Vercel Blob Storage")
    print(f"   Version: {version_folder}")
    print(f"   Source: {input_dir}")
    print(f"   Destination: {blob_url.rstrip('/')}/{version_folder}/")

    # Files to upload
    files_to_upload = [
        (input_dir / "embeddings.f32bin", f"{version_folder}/embeddings.f32bin"),
        (input_dir / "embeddings.i8bin", f"{version_folder}/embeddings.i8bin"),
        (input_dir / "meta.json", f"{version_folder}/meta.json"),
        (input_dir / "build_manifest.json", f"{version_folder}/build_manifest.json"),
    ]

    # Filter to only existing files
    existing_files = [(src, dst) for src, dst in files_to_upload if src.exists()]

    if not existing_files:
        print(f"❌ No files found to upload in {input_dir}")
        return False

    print(f"\n📋 Files to upload ({len(existing_files)}):")
    for src, dst in existing_files:
        size_mb = src.stat().st_size / 1e6
        print(f"   - {src.name} ({size_mb:.1f} MB) → {dst}")

    if dry_run:
        print("\n🏁 Dry run complete (no files uploaded)")
        return True

    # Upload files
    print(f"\n⏳ Uploading {len(existing_files)} file(s)...")
    results = []
    for src, dst in existing_files:
        success = upload_file_to_blob(src, blob_url, blob_token, dst)
        results.append(success)

    # Summary
    successful = sum(results)
    total = len(results)
    print(f"\n{'='*60}")
    print(f"✓ Upload complete: {successful}/{total} files uploaded successfully")

    if successful == total:
        print(f"\n🎉 Deployment successful!")
        print(f"   Access your embeddings at:")
        print(f"   {blob_url.rstrip('/')}/{version_folder}/")
        return True
    else:
        print(f"\n⚠️  {total - successful} file(s) failed to upload")
        return False


def main():
    ap = argparse.ArgumentParser(
        description="Deploy embeddings to Vercel Blob Storage"
    )
    ap.add_argument(
        "--major",
        type=int,
        required=True,
        help="Major version number (e.g., 1 for v1.3)"
    )
    ap.add_argument(
        "--minor",
        type=int,
        required=True,
        help="Minor version number (e.g., 3 for v1.3)"
    )
    ap.add_argument(
        "--input-dir",
        default="index_out",
        help="Directory containing exported files (default: index_out)"
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be uploaded without actually uploading"
    )

    args = ap.parse_args()

    success = deploy_embeddings(
        major=args.major,
        minor=args.minor,
        input_dir=Path(args.input_dir),
        dry_run=args.dry_run
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
