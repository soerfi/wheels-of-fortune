#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🚀 Starting Wheel of Fortune Deployment..."

# 1. Provide a warning that TypeScript type-checking is now happening inside the Docker build step
echo "🔍 Pre-flight checks (TypeScript Compilation) will run inside the Docker image build process."

# 2. Create data directory for SQLite persistence if it doesn't exist
mkdir -p data
echo "📁 Ensured ./data directory exists for SQLite database."

# 3. Build and Deploy the main wheel-app container
echo "📦 Building and starting Wheel of Fortune container..."
docker compose up -d --build wheel-app

# 4. Briefly restart the Proxy to ensure it hooks up to the new container IP if it changed
echo "🔄 Reloading Nginx Reverse Proxy..."
cd deploy-proxy
docker compose down
docker compose up -d
cd ..

echo "✅ Deployment successful! Wheel of Fortune is now running."
echo "You can check logs with: docker compose logs -f wheel-app"
