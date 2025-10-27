@echo off
set DATABASE_URL=postgresql://authuser:authpass@localhost:5432/authdb
set REDIS_URL=redis://localhost:6379
set ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
set EMAIL_HOST=localhost
set EMAIL_PORT=1025
set EMAIL_FROM=noreply@authsystem.com
set ENCRYPTION_KEY=dev-32-character-encryption-key-12
set CSRF_SECRET=dev-csrf-secret-change-in-production
set JWT_ACCESS_SECRET=dev-access-secret-key-change-in-production
set JWT_REFRESH_SECRET=dev-refresh-secret-key-change-in-production
set JWT_ACCESS_EXPIRY=15m
set JWT_REFRESH_EXPIRY=30d
set NODE_ENV=development
set LOG_LEVEL=debug

npm run dev:services
