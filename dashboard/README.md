# Mailflow Dashboard

React-based admin dashboard for the Mailflow email dispatching system.

## Tech Stack

- **React 18** with TypeScript
- **Refine 4.x** - Admin framework
- **Ant Design 5.x** - UI components
- **Tailwind CSS 3.x** - Utility-first styling
- **Vite 6.x** - Build tool
- **Recharts** - Charts and visualizations
- **Axios** - HTTP client

## Features

### 📊 Dashboard Overview
- System health monitoring
- Real-time metrics (emails, error rates, processing time)
- Time series charts for last 24 hours
- Auto-refresh every 30 seconds

### 📬 Queue Management
- List all SQS queues with statistics
- Inspect queue messages
- Message preview and full JSON view
- Filter by queue type (inbound/outbound/dlq)

### 📝 Logs Viewer
- Query CloudWatch logs with time range
- Filter by log level (ERROR, WARN, INFO, DEBUG)
- Search by message ID or correlation ID
- Syntax-highlighted JSON logs
- Export logs to JSON

### 💾 Storage Browser
- S3 bucket statistics
- Recent objects listing
- Storage trends (charts)
- Download files via presigned URLs

### ✉️ Test Email
- Send test inbound emails (via SES)
- Send test outbound emails (via SQS)
- View test history
- Validate email addresses and content

### ⚙️ Configuration
- View system configuration (read-only)
- Routing rules, security settings
- Attachment configuration
- JSON view with syntax highlighting

## Development

### Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and set your API URL
vim .env
```

### Run Development Server

```bash
npm run dev
```

Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

## Authentication

The dashboard uses JWT authentication. To access:

1. Get a JWT token from your identity provider
2. Token must include:
   - `teams` array containing "Team Mailflow"
   - `iss` claim matching your configured issuer
   - Valid `exp` (not expired)

3. On the login page, paste your JWT token
4. The token is stored in localStorage and sent with all API requests

## Deployment

### Using Makefile (from project root)

```bash
# Build dashboard
make dashboard-build

# Deploy to S3
make dashboard-deploy ENVIRONMENT=dev

# Or deploy everything (Lambda + Dashboard + Infrastructure)
make deploy
```

### Manual Deployment

```bash
# 1. Build
npm run build

# 2. Deploy to S3
aws s3 sync dist/ s3://mailflow-dashboard-dev/ --delete

# 3. Invalidate CloudFront cache (if needed)
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | API Gateway URL | `https://abc123.execute-api.us-east-1.amazonaws.com/v1/api` |

## Project Structure

```
dashboard/
├── src/
│   ├── pages/
│   │   ├── dashboard/      # Overview page
│   │   ├── queues/         # Queue management
│   │   ├── logs/           # Log viewer
│   │   ├── storage/        # Storage browser
│   │   ├── test/           # Test email sender
│   │   ├── config/         # Configuration viewer
│   │   └── login/          # Login page
│   ├── providers/
│   │   ├── authProvider.ts # JWT authentication
│   │   └── dataProvider.ts # API data provider
│   ├── utils/
│   │   └── api.ts          # Axios client with JWT
│   ├── App.tsx             # Main app with Refine setup
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles with Tailwind
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

## License

MIT
