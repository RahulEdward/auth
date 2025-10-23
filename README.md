# Enterprise Authentication System

A comprehensive, enterprise-grade authentication and user management system with multi-factor authentication, OAuth integration, RBAC, and subscription management.

## 🚀 Project Status

**Current Phase:** Active Development  
**Completion:** ~25% (5 of 25 major tasks completed)  
**Last Updated:** October 23, 2025

### ✅ Completed Features

- ✅ **Core Authentication** - Email/password with Argon2id hashing
- ✅ **OAuth 2.0 Integration** - Google, Facebook, GitHub social login
- ✅ **Email Verification** - Token-based email verification
- ✅ **Password Reset** - Secure password recovery flow
- ✅ **Token Management** - JWT with refresh token rotation
- ✅ **Session Management** - Device tracking and session control
- ✅ **Account Security** - Account lockout, password history
- ✅ **Database Schema** - Complete PostgreSQL schema with migrations
- ✅ **Shared Utilities** - Password hashing, JWT, validation, logging

### 🔄 In Progress

- ⏳ **Multi-Factor Authentication** - TOTP, SMS, Email MFA (Task 6)

### 📋 Planned Features

- 🔜 User Profile Management
- 🔜 Role-Based Access Control (RBAC)
- 🔜 Subscription Management
- 🔜 Payment Processing
- 🔜 Admin Dashboard
- 🔜 API Gateway with Rate Limiting
- 🔜 Developer SDKs (JS, Python, Java, Go, Ruby)
- 🔜 Landing Page & Marketing Site

## 🎯 Key Features

### Authentication
- 🔐 **Email/Password** - Secure authentication with Argon2id
- 🌐 **OAuth 2.0** - Google, Facebook, GitHub integration
- 🔒 **MFA** - Multi-factor authentication (coming soon)
- 🔑 **Token Management** - JWT with automatic rotation
- 📧 **Email Verification** - Required for account activation
- 🔄 **Password Reset** - Secure recovery with token expiration

### Security
- 🛡️ **Account Lockout** - 5 failed attempts, 30-minute lock
- 📝 **Password History** - Prevents reuse of last 5 passwords
- 🔐 **Token Encryption** - AES-256-GCM for OAuth tokens
- 🎲 **CSRF Protection** - State tokens for OAuth flows
- 🚫 **Rate Limiting** - Redis-based request throttling
- 📊 **Audit Logging** - Complete activity tracking

### Architecture
- 🚀 **Microservices** - Independently deployable services
- 📦 **Monorepo** - npm workspaces for code sharing
- 🐳 **Docker** - Containerized development environment
- ☸️ **Kubernetes-Ready** - Production deployment manifests
- 🔄 **Event-Driven** - Async communication via message queues

## Project Structure

```
enterprise-auth-system/
├── services/           # Microservices
│   ├── api-gateway/   # API Gateway service
│   ├── auth-service/  # Authentication service
│   └── user-service/  # User management service
├── packages/          # Shared packages
│   └── shared/        # Shared utilities and types
├── sdks/              # Client SDKs
│   ├── javascript/
│   ├── python/
│   └── ...
├── scripts/           # Utility scripts
└── docker-compose.yml # Local development setup
```

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd enterprise-auth-system
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start services (requires Docker)
npm run docker:up

# 4. Run migrations and seed data
npm run db:migrate
npm run db:seed

# 5. Start development servers
npm run dev
```

Visit `http://localhost:3001` for the Auth Service API.

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** and Docker Compose (for local development)
- **PostgreSQL** 15+ (via Docker or standalone)
- **Redis** 7+ (via Docker or standalone)

## 🛠️ Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd enterprise-auth-system
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and MailHog
npm run docker:up

# Check logs
npm run docker:logs
```

### 4. Run Database Setup

```bash
# On Linux/Mac
chmod +x scripts/db-setup.sh
./scripts/db-setup.sh

# On Windows
scripts\db-setup.bat

# Or manually
npm run db:migrate
npm run db:seed
```

### 5. Start Development Servers

```bash
npm run dev
```

The API Gateway will be available at `http://localhost:3000`

## 💡 Usage Examples

### Register a New User

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "captchaToken": "your-captcha-token"
  }'
```

### Login with Email/Password

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### OAuth Login (Google)

```bash
# 1. Get authorization URL
curl http://localhost:3001/api/v1/auth/oauth/google/authorize

# 2. User visits the URL and authorizes
# 3. User is redirected back with tokens
```

### Refresh Access Token

```bash
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

## 📜 Available Scripts

### Development
- `npm run dev` - Start all services in development mode
- `npm run dev:services` - Start services with concurrently
- `npm run build` - Build all packages and services

### Testing
- `npm test` - Run tests across all workspaces
- `npm test -w @auth/shared` - Run tests for specific workspace
- `npm test -- --coverage` - Run tests with coverage report

### Code Quality
- `npm run lint` - Lint all TypeScript files
- `npm run format` - Format code with Prettier

### Database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with test data

### Docker
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers
- `npm run docker:logs` - View container logs

## Development

### Workspace Structure

This project uses npm workspaces for monorepo management:

- **services/**: Independent microservices
- **packages/**: Shared libraries and utilities
- **sdks/**: Client SDKs for different languages

### Adding a New Service

```bash
mkdir -p services/new-service
cd services/new-service
npm init -y
# Configure package.json and tsconfig.json
```

### Code Style

- TypeScript with strict mode enabled
- ESLint for linting
- Prettier for formatting
- Follow the existing code structure

## 📚 Documentation

### Available Documentation
- [Requirements](/.kiro/specs/enterprise-auth-system/requirements.md) - Complete feature requirements
- [Design Document](/.kiro/specs/enterprise-auth-system/design.md) - System architecture and design
- [Tasks](/.kiro/specs/enterprise-auth-system/tasks.md) - Implementation task breakdown
- [Database Schema](/docs/database-schema.md) - Complete database documentation
- [OAuth Setup Guide](/services/auth-service/docs/OAUTH_SETUP.md) - OAuth provider configuration
- [Task 4 Report](/docs/task-4-completion-report.md) - Core authentication completion
- [Task 5 Report](/docs/task-5-completion-report.md) - OAuth integration completion
- [Test Results](/docs/TEST_RESULTS.md) - Test execution reports
- [Progress Summary](/docs/PROGRESS_SUMMARY.md) - Overall project progress

### API Endpoints (Auth Service - Port 3001)

#### Core Authentication
- `POST /api/v1/auth/register` - Register new user
- `GET /api/v1/auth/verify-email` - Verify email address
- `POST /api/v1/auth/login` - Login with credentials
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/password/reset-request` - Request password reset
- `POST /api/v1/auth/password/reset` - Reset password with token

#### OAuth Authentication
- `GET /api/v1/auth/oauth/:provider/authorize` - Initiate OAuth flow
- `GET /api/v1/auth/oauth/:provider/callback` - OAuth callback handler
- `POST /api/v1/auth/oauth/link/:provider` - Link OAuth account

**Supported OAuth Providers:** `google`, `facebook`, `github`

### API Documentation (Coming Soon)
- Swagger UI: `http://localhost:3001/api/docs`
- Health Check: `http://localhost:3001/health/live`
- Ready Check: `http://localhost:3001/health/ready`

## 🧪 Testing

### Test Status
✅ **Unit Tests:** 13/13 passing (100%)  
⏳ **Integration Tests:** Pending Docker setup  
📊 **Coverage:** Password utilities fully tested

### Run Tests

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm test -w @auth/shared
npm test -w @auth/auth-service

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Test Results
See [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) for detailed test reports.

## Docker Services

- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **MailHog UI**: `http://localhost:8025`
- **MailHog SMTP**: `localhost:1025`

## ⚙️ Configuration

### Environment Variables

See `.env.example` for all available configuration options.

#### Required Variables
```bash
# Database
DATABASE_URL=postgresql://authuser:authpass@localhost:5432/authdb

# Redis
REDIS_URL=redis://:redispass@localhost:6379

# JWT Secrets (generate secure random strings)
JWT_ACCESS_SECRET=your-access-token-secret
JWT_REFRESH_SECRET=your-refresh-token-secret

# Encryption (32-byte hex key)
ENCRYPTION_KEY=your-32-byte-hex-encryption-key

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

#### OAuth Configuration (Optional)
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/google/callback

# Facebook OAuth
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
FACEBOOK_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/facebook/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/github/callback
```

See [OAuth Setup Guide](/services/auth-service/docs/OAUTH_SETUP.md) for detailed OAuth configuration instructions.

### Generate Secrets

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate encryption key (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🏗️ Technology Stack

### Backend
- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL 15+
- **Cache:** Redis 7+
- **Authentication:** JWT, OAuth 2.0
- **Password Hashing:** Argon2id
- **Validation:** Joi schemas

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **Orchestration:** Kubernetes (production)
- **Monitoring:** Prometheus + Grafana (planned)
- **Logging:** Winston + ELK Stack (planned)

### Development Tools
- **Monorepo:** npm workspaces
- **Testing:** Jest + ts-jest
- **Linting:** ESLint
- **Formatting:** Prettier
- **Type Checking:** TypeScript strict mode

## 📈 Project Metrics

- **Total Tasks:** 25 major tasks
- **Completed:** 5 tasks (20%)
- **API Endpoints:** 9 endpoints
- **Database Tables:** 8 tables
- **Test Coverage:** 100% (password utilities)
- **Lines of Code:** ~5,000+ (and growing)

## 🗺️ Roadmap

### Phase 1: Core Authentication (Current)
- [x] Email/Password authentication
- [x] OAuth 2.0 integration
- [x] Email verification
- [x] Password reset
- [x] Session management
- [ ] Multi-factor authentication

### Phase 2: User Management
- [ ] Profile management
- [ ] Avatar uploads
- [ ] Account lifecycle
- [ ] GDPR compliance

### Phase 3: Authorization
- [ ] Role-based access control
- [ ] Permission system
- [ ] Admin interface

### Phase 4: SaaS Features
- [ ] Subscription management
- [ ] Payment processing
- [ ] Usage tracking

### Phase 5: Developer Experience
- [ ] API Gateway
- [ ] Rate limiting
- [ ] SDK development
- [ ] Documentation site

### Phase 6: Production Ready
- [ ] Kubernetes deployment
- [ ] Monitoring & alerting
- [ ] Security hardening
- [ ] Performance optimization

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation
4. **Run tests and linting**
   ```bash
   npm test
   npm run lint
   npm run format
   ```
5. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines
- Write tests for all new features
- Maintain test coverage above 70%
- Follow TypeScript strict mode
- Document all public APIs
- Use conventional commit messages

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

### Getting Help
- 📖 Check the [documentation](/docs)
- 🐛 Report bugs via [GitHub Issues](https://github.com/your-repo/issues)
- 💬 Ask questions in [Discussions](https://github.com/your-repo/discussions)
- 📧 Email: support@example.com

### Useful Resources
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## 🙏 Acknowledgments

Built with modern best practices and security standards in mind. Special thanks to the open-source community for the amazing tools and libraries that make this project possible.

---

**Made with ❤️ by the Enterprise Auth Team**

*Last Updated: October 23, 2025*
