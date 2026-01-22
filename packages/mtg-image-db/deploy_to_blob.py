#!/usr/bin/env python3
"""
Deploy exported embeddings to Vercel Blob Storage.

Usage:
    python deploy_to_blob.py --major 1 --minor 3 --snapshot
    python deploy_to_blob.py --version v2026-01-20-ab12cd3
    python deploy_to_blob.py --channel latest-dev --snapshot
    python deploy_to_blob.py --channel latest-prod --snapshot --version v2026-01-20-ab12cd3

Environment variables required:
    VITE_BLOB_STORAGE_URL: Base URL for Vercel Blob Storage
    BLOB_READ_WRITE_TOKEN: Authentication token for Vercel Blob
"""
import argparse
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional
import sys

try:
    import requests
except ImportError:
    print("Error: 'requests' library not found. Install with: pip install requests")
    sys.exit(1)

from config import get_config


def get_blob_credentials() -> tuple[str, str, str]:
    """Get Vercel Blob credentials from environment."""
    config = get_config()

    blob_url = config.get('VITE_BLOB_STORAGE_URL')
    upload_url = config.get('BLOB_UPLOAD_URL')
    blob_token = config.get('BLOB_READ_WRITE_TOKEN')

    if not blob_url:
        raise ValueError(
            "VITE_BLOB_STORAGE_URL not found in environment variables"
        )
    if not blob_token:
        raise ValueError(
            "BLOB_READ_WRITE_TOKEN not found in environment variables"
        )

    if not upload_url:
        # Public read URL is typically https://<store>.public.blob.vercel-storage.com
        # Uploads must go to the API host: https://blob.vercel-storage.com/upload
        upload_url = "https://blob.vercel-storage.com"

    return blob_url, upload_url, blob_token


def content_type_for(file_path: Path) -> str:
    if file_path.suffix == ".json":
        return "application/json"
    return "application/octet-stream"


def upload_file_to_blob(
    file_path: Path,
    upload_url: str,
    blob_token: str,
    remote_path: str
) -> bool:
    """
    Upload a single file to Vercel Blob Storage.

    Args:
        file_path: Local file to upload
        upload_url: Base Vercel Blob upload URL
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
            content_type = content_type_for(file_path)
            files = {
                'file': (file_path.name, f, content_type)
            }
            data = {
                'pathname': remote_path,
                'access': 'public',
                'addRandomSuffix': 'false',
                'contentType': content_type,
            }
            headers = {'Authorization': f'Bearer {blob_token}'}

            response = requests.post(
                f"{upload_url.rstrip('/')}/upload",
                files=files,
                data=data,
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


def compute_default_version() -> str:
    date_str = datetime.utcnow().strftime("%Y%m%d")
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception:
        sha = "nogit"
    return f"v{date_str}-{sha}"


def deploy_embeddings(
    version: str,
    channel: Optional[str],
    snapshot: bool,
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
        blob_url, upload_url, blob_token = get_blob_credentials()
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        return False

    targets: list[str] = []
    if snapshot:
        targets.append(version)
    if channel:
        targets.append(channel)
    if not targets:
        print("❌ No destination specified. Use --snapshot and/or --channel.")
        return False

    print(f"\n🚀 Deploying embeddings to Vercel Blob Storage")
    print(f"   Version: {version}")
    if channel:
        print(f"   Channel: {channel}")
    print(f"   Source: {input_dir}")
    print(f"   Destination: {blob_url.rstrip('/')}/")
    print(f"   Upload API: {upload_url.rstrip('/')}/upload")

    # Files to upload
    base_files = [
        "embeddings.f32bin",
        "embeddings.i8bin",
        "meta.json",
        "build_manifest.json",
    ]
    files_to_upload: list[tuple[Path, str]] = []
    for target in targets:
        for filename in base_files:
            src = input_dir / filename
            dst = f"{target}/{filename}"
            files_to_upload.append((src, dst))

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
        success = upload_file_to_blob(src, upload_url, blob_token, dst)
        results.append(success)

    # Summary
    successful = sum(results)
    total = len(results)
    print(f"\n{'='*60}")
    print(f"✓ Upload complete: {successful}/{total} files uploaded successfully")

    if successful == total:
        print(f"\n🎉 Deployment successful!")
        print("   Access your embeddings at:")
        for target in targets:
            print(f"   {blob_url.rstrip('/')}/{target}/")
        return True
    else:
        print(f"\n⚠️  {total - successful} file(s) failed to upload")
        return False


def main():
    ap = argparse.ArgumentParser(
        description="Deploy embeddings to Vercel Blob Storage"
    )
    ap.add_argument(
        "--version",
        help="Snapshot version folder (e.g., v2026-01-20-ab12cd3). Defaults to date+git sha."
    )
    ap.add_argument(
        "--major",
        type=int,
        help="Major version number (legacy, e.g., 1 for v1.3)"
    )
    ap.add_argument(
        "--minor",
        type=int,
        help="Minor version number (legacy, e.g., 3 for v1.3)"
    )
    ap.add_argument(
        "--channel",
        choices=["latest-dev", "latest-prod"],
        help="Channel destination to overwrite (latest-dev or latest-prod)."
    )
    ap.add_argument(
        "--snapshot",
        action="store_true",
        help="Also upload to the immutable snapshot version folder."
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

    if args.version:
        version = args.version
    elif args.major is not None and args.minor is not None:
        version = f"v{args.major}.{args.minor}"
    else:
        version = compute_default_version()

    snapshot = args.snapshot

    success = deploy_embeddings(
        version=version,
        channel=args.channel,
        snapshot=snapshot,
        input_dir=Path(args.input_dir),
        dry_run=args.dry_run
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
