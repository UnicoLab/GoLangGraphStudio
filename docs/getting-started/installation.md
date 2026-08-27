# Installation Guide

This guide will help you set up GoLangGraph Studio in different environments.

## System Requirements

### Minimum Requirements
- **Node.js**: 20.19.x or higher
- **npm**: 8.x or higher (comes with Node.js)
- **Memory**: 2GB RAM
- **Storage**: 500MB free space

### Recommended Requirements
- **Node.js**: 22.x LTS
- **npm**: 9.x or higher
- **Memory**: 4GB RAM
- **Storage**: 1GB free space

## Installation Methods

### Method 1: Local Development Setup

This is the recommended method for development and testing.

#### Step 1: Clone the Repository

```bash
git clone https://github.com/UnicoLab/GoLangGraphStudio.git
cd GoLangGraphStudio
```

#### Step 2: Install Node.js Dependencies

=== "npm"

    ```bash
    npm install
    ```

=== "yarn"

    ```bash
    yarn install
    ```

=== "pnpm"

    ```bash
    pnpm install
    ```

#### Step 3: Start Development Server

=== "npm"

    ```bash
    npm start
    ```

=== "yarn"

    ```bash
    yarn start
    ```

=== "pnpm"

    ```bash
    pnpm start
    ```

The application will be available at `http://localhost:5173`.

### Method 2: Docker Setup

For containerized deployment and production environments.

#### Prerequisites
- Docker 20.x or higher
- Docker Compose 2.x or higher

#### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/UnicoLab/GoLangGraphStudio.git
cd GoLangGraphStudio

# Build and run with Docker
docker build -t golanggraph-studio .
docker run -p 3000:80 golanggraph-studio
```

#### Docker Compose Setup

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  golanggraph-studio:
    build: .
    ports:
      - "3000:80"
    restart: unless-stopped
    depends_on:
      - golanggraph-backend

  # Optional: Add GoLangGraph backend
  golanggraph-backend:
    image: unicolab/golanggraph:latest
    ports:
      - "8080:8080"
    restart: unless-stopped
```

Run with:

```bash
docker-compose up -d
```

### Method 3: Production Build

For deploying to production servers.

#### Step 1: Create Production Build

```bash
npm run build
```

This creates an optimized build in the `build` directory.

#### Step 2: Serve with Web Server

=== "nginx"

    ```nginx
    server {
        listen 80;
        server_name your-domain.com;
        root /path/to/build;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
    ```

=== "Apache"

    ```apache
    <VirtualHost *:80>
        ServerName your-domain.com
        DocumentRoot /path/to/build

        <Directory /path/to/build>
            Options Indexes FollowSymLinks
            AllowOverride All
            Require all granted
        </Directory>

        # Enable React Router
        FallbackResource /index.html
    </VirtualHost>
    ```

=== "Express.js"

    ```javascript
    const express = require('express');
    const path = require('path');
    const app = express();

    app.use(express.static(path.join(__dirname, 'build')));

    app.get('/*', (req, res) => {
      res.sendFile(path.join(__dirname, 'build', 'index.html'));
    });

    app.listen(3000);
    ```

## Environment Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# GoLangGraph Server Configuration
VITE_API_URL=http://localhost:8080
```

### Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | GoLangGraph server URL for local development or a custom build | `http://localhost:8080` | No |

## Verification

### Health Check

After installation, verify everything is working:

1. **Frontend**: Open `http://localhost:5173`
2. **Connection Test**: Click "Connect" in the setup screen
3. **Console Check**: Open browser dev tools and check for errors

### Common Issues

**Port Already in Use**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

**Node Version Issues**
```bash
# Check Node version
node --version

# Use Node Version Manager (if installed)
nvm use 18
```

**Dependency Issues**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

After successful installation:

1. Follow the [Quick Start Guide](quick-start.md)
2. Configure your GoLangGraph connection in the Studio setup screen
3. Explore the [Graph View](../features/graph-view.md)

## Troubleshooting

For installation issues, check the [GitHub Issues](https://github.com/UnicoLab/GoLangGraphStudio/issues).
