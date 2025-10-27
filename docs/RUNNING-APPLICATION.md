# Enterprise Auth System - Running Application

## 🎉 Application Status: RUNNING

All services are successfully running and ready for use!

## Services Status

### ✅ Infrastructure Services (Docker)

| Service | Status | Port | Access |
|---------|--------|------|--------|
| **PostgreSQL** | 🟢 Running | 5432 | localhost:5432 |
| **Redis** | 🟢 Running | 6379 | localhost:6379 |
| **RabbitMQ** | 🟢 Running | 5672, 15672 | Management UI: http://localhost:15672 |
| **MailHog** | 🟢 Running | 1025, 8025 | Web UI: http://localhost:8025 |

### ✅ Application Services

| Service | Status | Port | Health Check |
|---------|--------|------|--------------|
| **API Gateway** | 🟢 Running | 3000 | http://localhost:3000/health |
| **Auth Service** | 🟢 Running | 3001 | http://localhost:3001/health |
| **User Service** | 🟢 Running | 3002 | http://localhost:3002/health |
| **Notification Service** | 🟢 Running | 3004 | http://localhost:3004/health/live |

## Quick Access Links

### 🌐 Web Interfaces

- **MailHog (Email Testing)**: http://localhost:8025
  - View all sent emails in development
  - Test email templates and delivery

- **RabbitMQ Management**: http://localhost:15672
  - Username: `guest`
  - Password: `guest`
  - Monitor message queues and consumers

### 🔌 API Endpoints

- **API Gateway**: http://localhost:3000
- **Auth Service**: http://localhost:3001
- **User Service**: http://localhost:3002
- **Notification Service**: http://localhost:3004

## Testing the Application

### 1. Check Service Health

```bash
# API Gateway
curl http://localhost:3000/health

# Auth Service
curl http://localhost:3001/health

# User Service
curl http://localhost:3002/health

# Notification Service
curl http://localhost:3004/health/live
```

### 2. Test Email Sending

The notification service is connected to MailHog. Any emails sent will appear in the MailHog web UI at http://localhost:8025

### 3. View RabbitMQ Queues

1. Open http://localhost:15672
2. Login with `guest` / `guest`
3. Go to "Queues" tab
4. You should see the `notifications` queue

## Service Logs

All services are running with live reload enabled. Check the console output for:

- ✅ Database connections established
- ✅ Redis connections established  
- ✅ RabbitMQ connections established
- ✅ Services listening on their respective ports

## Environment Configuration

Current configuration (from `.env`):

```
NODE_ENV=development
DATABASE_URL=postgresql://authuser:authpass@localhost:5432/authdb
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
EMAIL_HOST=localhost
EMAIL_PORT=1025
```

## Stopping the Application

### Stop All Services

```bash
# Stop application services (Ctrl+C in the terminal running start-services.ps1)

# Stop Docker containers
docker-compose down
```

### Stop Individual Services

```bash
# Stop specific container
docker stop auth-postgres
docker stop auth-redis
docker stop auth-rabbitmq
docker stop auth-mailhog
```

## Restarting Services

### Restart All

```bash
# Restart Docker containers
docker-compose restart

# Restart application services
powershell -ExecutionPolicy Bypass -File start-services.ps1
```

### Restart Individual Container

```bash
docker-compose restart postgres
docker-compose restart redis
docker-compose restart rabbitmq
docker-compose restart mailhog
```

## Troubleshooting

### Services Won't Start

1. **Check Docker containers are running**:
   ```bash
   docker ps
   ```

2. **Check logs**:
   ```bash
   docker-compose logs -f
   ```

3. **Restart containers**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Database Connection Issues

1. **Verify PostgreSQL is running**:
   ```bash
   docker ps | grep postgres
   ```

2. **Check database logs**:
   ```bash
   docker logs auth-postgres
   ```

3. **Test connection**:
   ```bash
   psql postgresql://authuser:authpass@localhost:5432/authdb
   ```

### Redis Connection Issues

1. **Verify Redis is running**:
   ```bash
   docker ps | grep redis
   ```

2. **Test connection**:
   ```bash
   redis-cli ping
   ```

### Email Not Sending

1. **Check MailHog is running**:
   ```bash
   docker ps | grep mailhog
   ```

2. **View MailHog UI**: http://localhost:8025

3. **Check notification service logs** for connection errors

## Next Steps

### 1. Run Database Migrations

```bash
npm run db:migrate
```

### 2. Seed Test Data (Optional)

```bash
npm run db:seed
```

### 3. Test API Endpoints

Refer to `docs/API-TESTING-GUIDE.md` for comprehensive API testing instructions.

### 4. View Email Templates

Send test emails and view them in MailHog at http://localhost:8025

## Development Workflow

### Making Code Changes

All services run with `ts-node-dev` which provides:
- ✅ Automatic TypeScript compilation
- ✅ Hot reload on file changes
- ✅ Fast restart times

Simply edit your code and the service will automatically restart!

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific service
npm test -w @auth/notification-service

# Run with coverage
npx jest --coverage
```

### Building for Production

```bash
# Build all services
npm run build

# Build specific service
npm run build -w @auth/notification-service
```

## Performance Monitoring

### Check Service Memory Usage

```bash
docker stats
```

### Monitor RabbitMQ

- Queue depth: http://localhost:15672/#/queues
- Message rates
- Consumer status

### Monitor Redis

```bash
redis-cli info stats
```

## Security Notes

⚠️ **Development Configuration**

The current setup is configured for development:
- Redis has no password
- Default credentials for RabbitMQ (guest/guest)
- Debug logging enabled
- CORS allows all origins

**Do not use these settings in production!**

## Support

For issues or questions:
1. Check service logs
2. Review `docs/NOTIFICATION-SERVICE-GUIDE.md`
3. Review `docs/API-TESTING-GUIDE.md`
4. Check Docker container health

---

**Status**: All systems operational ✅  
**Last Updated**: October 26, 2025  
**Environment**: Development
