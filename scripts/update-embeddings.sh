#!/bin/bash
# Script to update MTG embeddings to a new version
# Usage: ./scripts/update-embeddings.sh <new-version>
# Example: ./scripts/update-embeddings.sh v1.1

set -e

if [ -z "$1" ]; then
  echo "Error: Version argument required"
  echo "Usage: $0 <version>"
  echo "Example: $0 v1.1"
  exit 1
fi

NEW_VERSION="$1"
SOURCE_DIR="packages/mtg-image-db/index_out"
TARGET_DIR="apps/web/public/data/mtg-embeddings/${NEW_VERSION}"

# Check if source files exist
if [ ! -f "${SOURCE_DIR}/meta.json" ]; then
  echo "Error: Source files not found in ${SOURCE_DIR}"
  echo "Run 'cd packages/mtg-image-db && pnpm build' first"
  exit 1
fi

# Create target directory
echo "Creating directory: ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"

# Copy files
echo "Copying embeddings files..."
cp "${SOURCE_DIR}/meta.json" "${TARGET_DIR}/"
cp "${SOURCE_DIR}/embeddings.i8bin" "${TARGET_DIR}/"
cp "${SOURCE_DIR}/build_manifest.json" "${TARGET_DIR}/"

echo "✓ Files copied successfully"
echo ""
echo "Next steps:"
echo "1. Update VITE_EMBEDDINGS_VERSION in apps/web/.env.development and .env.production to '${NEW_VERSION}'"
echo "   sed -i '' 's/VITE_EMBEDDINGS_VERSION=.*/VITE_EMBEDDINGS_VERSION=${NEW_VERSION}/' apps/web/.env.development"
echo "   sed -i '' 's/VITE_EMBEDDINGS_VERSION=.*/VITE_EMBEDDINGS_VERSION=${NEW_VERSION}/' apps/web/.env.production"
echo "2. Test the app locally: cd apps/web && pnpm dev"
echo "3. Commit the changes: git add apps/web/public/data/mtg-embeddings/${NEW_VERSION} apps/web/.env.*"
echo "4. Update the README.md in apps/web/public/data/mtg-embeddings/ with new version info"
