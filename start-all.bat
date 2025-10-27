@echo off
echo Starting Enterprise Auth System...
echo.

REM Load environment variables from .env file
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "%%a=%%b"
)

echo Environment variables loaded
echo.

echo Running database migrations...
call npm run db:migrate
if %errorlevel% neq 0 (
    echo Failed to run migrations
    exit /b %errorlevel%
)

echo.
echo Starting all services...
echo - API Gateway (port 3000)
echo - Auth Service (port 3001)
echo - User Service (port 3002)
echo - Notification Service (port 3004)
echo.
echo Press Ctrl+C to stop all services
echo.

call npm run dev:services
