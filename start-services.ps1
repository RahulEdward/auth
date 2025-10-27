# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        Write-Host "Set $name"
    }
}

Write-Host "`nEnvironment variables loaded successfully!`n"

Write-Host "Starting services..."
Write-Host "- Notification Service on port 3004"
Write-Host "- Auth Service on port 3001"
Write-Host "- User Service on port 3002"
Write-Host "- API Gateway on port 3000"
Write-Host "`nPress Ctrl+C to stop all services`n"

# Start all services concurrently
npm run dev:services
