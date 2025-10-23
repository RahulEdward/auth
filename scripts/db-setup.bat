@echo off
REM Database setup script for Windows

echo Starting database setup...

REM Check if Docker containers are running
docker ps | findstr auth-postgres >nul
if errorlevel 1 (
  echo PostgreSQL container not running. Starting Docker Compose...
  docker-compose up -d postgres redis
  echo Waiting for PostgreSQL to be ready...
  timeout /t 5 /nobreak >nul
)

REM Run migrations
echo Running database migrations...
call npm run db:migrate -w @auth/shared

REM Run seeds
echo Seeding database with test data...
call npm run db:seed -w @auth/shared

echo Database setup complete!
echo.
echo Test users created:
echo   - admin@example.com (password: Password123!)
echo   - user@example.com (password: Password123!)
echo   - premium@example.com (password: Password123!)
