#!/bin/bash
# Docker build helper script

set -e

VERSION=${1:-latest}
REGISTRY=${2:-local}

echo "Building POLIS Docker image..."
echo "  Version: $VERSION"
echo "  Registry: $REGISTRY"

docker build \
  --tag polis:$VERSION \
  --tag polis:latest \
  --file Dockerfile \
  .

if [ "$REGISTRY" != "local" ]; then
  docker tag polis:$VERSION $REGISTRY/polis:$VERSION
  docker tag polis:latest $REGISTRY/polis:latest
  echo "✅ Image tagged for registry: $REGISTRY"
fi

echo "✅ Docker build complete"
echo ""
echo "To run locally:"
echo "  docker run -p 3143:3143 polis:$VERSION"
echo ""
echo "To run with compose:"
echo "  docker compose up"
