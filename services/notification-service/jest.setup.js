// Set required environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';
