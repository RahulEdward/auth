# Admin Dashboard - Enterprise Auth System

React-based admin dashboard for managing the Enterprise Authentication System.

## Features

- **Dashboard Overview**: Real-time metrics, user growth charts, authentication method breakdown
- **User Management**: Search, filter, view, activate/deactivate, delete, and impersonate users
- **Audit Logs**: View and export audit logs with filtering capabilities
- **System Settings**: Manage feature flags, view system health, clear cache
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for routing
- **Zustand** for state management
- **Axios** for API calls
- **Recharts** for data visualization

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend services running (API Gateway, User Service, Auth Service)

### Installation

```bash
cd services/admin-dashboard
npm install
```

### Configuration

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

### Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── api/              # API client and service functions
│   ├── client.ts     # Axios instance with interceptors
│   └── admin.ts      # Admin API functions
├── components/       # Reusable components
│   └── Layout.tsx    # Main layout with sidebar
├── pages/            # Page components
│   ├── Login.tsx     # Login page
│   ├── Dashboard.tsx # Dashboard overview
│   ├── Users.tsx     # User management
│   ├── UserDetails.tsx # User details
│   ├── AuditLogs.tsx # Audit logs
│   └── Settings.tsx  # System settings
├── store/            # State management
│   └── authStore.ts  # Authentication state
├── types/            # TypeScript types
│   └── index.ts      # Type definitions
├── App.tsx           # Main app component
├── App.css           # Global styles
└── main.tsx          # Entry point
```

## Features

### Dashboard
- Total users count
- Active sessions count
- Failed logins (24h)
- Revenue metrics (MTD)
- User growth chart (30 days)
- Authentication methods pie chart
- Auto-refresh every 30 seconds

### User Management
- Search users by email or name
- Filter by status (active, inactive, deactivated)
- View user details
- Activate/deactivate users
- Delete users
- Impersonate users
- Pagination support

### Audit Logs
- View all audit logs
- Filter by action and resource
- Export to CSV or JSON
- Pagination support

### System Settings
- View system health status
- Manage feature flags (enable/disable)
- Clear cache (sessions, rate limits, all)

## API Integration

The dashboard connects to the backend API at the URL specified in `VITE_API_URL`.

### Authentication

Login with admin credentials:
- Email: admin@example.com
- Password: your-admin-password

The JWT token is stored in localStorage and automatically included in all API requests.

### Protected Routes

All routes except `/login` require authentication. Unauthenticated users are redirected to the login page.

## Development

### Adding New Pages

1. Create a new component in `src/pages/`
2. Add the route in `src/App.tsx`
3. Add navigation link in `src/components/Layout.tsx`

### Adding New API Functions

1. Add the function in `src/api/admin.ts`
2. Use the `apiClient` instance for making requests
3. Add TypeScript types in `src/types/index.ts`

## Deployment

### Docker

Build the Docker image:

```bash
docker build -t admin-dashboard .
```

Run the container:

```bash
docker run -p 5173:5173 -e VITE_API_URL=http://api.example.com admin-dashboard
```

### Static Hosting

Build the app and deploy the `dist` folder to any static hosting service:

- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

## Security

- JWT tokens are stored in localStorage with persistence
- All API requests include the Authorization header
- 401 responses automatically log out the user
- HTTPS should be used in production

## License

MIT
