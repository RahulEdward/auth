#!/bin/bash

# Database setup script for development

set -e

echo "🚀 Starting database setup..."

# Check if Docker containers are running
if ! docker ps | grep -q auth-postgres; then
  echo "❌ PostgreSQL container not running. Starting Docker Compose..."
  docker-compose up -d postgres redis
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 5
fi

# Run migrations
echo "📦 Running database migrations..."
npm run db:migrate -w @auth/shared

# Run seeds
echo "🌱 Seeding database with test data..."
npm run db:seed -w @auth/shared

echo "✅ Database setup complete!"
echo ""
echo "Test users created:"
echo "  - admin@example.com (password: Password123!)"
echo "  - user@example.com (password: Password123!)"
echo "  - premium@example.com (password: Password123!)"
