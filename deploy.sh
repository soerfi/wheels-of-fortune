#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🚀 Starting Wheel of Fortune Deployment..."

# 1. Provide a warning that TypeScript type-checking is now happening inside the Docker build step
echo "🔍 Pre-flight checks (TypeScript Compilation) will run inside the Docker image build process."

# 2. Create data directory for SQLite persistence if it doesn't exist
mkdir -p data
echo "📁 Ensured ./data directory exists for SQLite database."

# 3. Build and Deploy with Docker Compose
echo "📦 Building and starting Docker containers..."
docker-compose up -d --build

echo "✅ Deployment successful! Wheel of Fortune is now running."
echo "You can check logs with: docker-compose logs -f"
