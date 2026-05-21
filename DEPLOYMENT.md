# Production Deployment Guide

## Building for Production

### 1. Build Frontend
```bash
npm run build
```

This creates `dist/` folder with optimized static files.

### 2. Build Backend
The backend is already production-ready. No build step needed.

## Deployment Options

### Option 1: Single Server (Recommended for Small Scale)

Host both frontend and backend on the same server:

```bash
# On server
npm install --production
npm run build

# Start backend on port 3000
PORT=3000 node api-server.js

# Serve frontend with web server (nginx/apache)
# Point to dist/ folder
```

**Nginx configuration** (serve frontend, proxy API):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /path/to/dist;
        try_files $uri /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Netlify (Recommended for Ease)

1. Push code to GitHub
2. Connect to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variable: `DATABASE_URL`

The backend can run on:
- Netlify Functions (serverless)
- Separate Node.js server
- Railway, Render, Heroku, etc.

### Option 3: Docker (Scalable)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "api-server.js"]
```

Build and run:
```bash
docker build -t jkuat-queue .
docker run -e DATABASE_URL="..." -p 3000:3000 jkuat-queue
```

### Option 4: Separate Services (Enterprise)

**Frontend**:
- Deploy `dist/` to CDN or static hosting
- Next: Vercel, Netlify, GitHub Pages

**Backend**:
- Deploy `api-server.js` to:
  - Railway (node)
  - Render
  - Heroku
  - AWS EC2
  - DigitalOcean

## Environment Variables for Production

```env
DATABASE_URL=postgresql://user:password@db.example.com:5432/jkuat_queue
PORT=3000
NODE_ENV=production
```

## Performance Optimizations

### Frontend
- Gzip compression: `npm run build` auto-minifies
- Use CDN for static assets
- Enable browser caching

### Backend
- Use connection pooling (postgres library does this)
- Add database indexes:
  ```sql
  CREATE INDEX idx_queue_service ON queue_entries(service_type);
  CREATE INDEX idx_queue_status ON queue_entries(status);
  ```
- Use load balancer if multiple instances

## Monitoring & Logging

Add logging to backend:
```javascript
import fs from 'fs'

const logStream = fs.createWriteStream('logs/api.log', { flags: 'a' })
app.use(morgan('combined', { stream: logStream }))
```

Monitor health:
```bash
# Check API health
curl https://yourdomain.com/api/health

# Monitor database
SELECT count(*) FROM queue_entries
```

## Backup Strategy

### Database Backups
```bash
# Backup
pg_dump "postgresql://user:password@host:5432/db" > backup.sql

# Restore
psql "postgresql://user:password@host:5432/db" < backup.sql
```

Schedule daily backups:
```bash
0 2 * * * pg_dump "postgresql://..." | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
```

## SSL/TLS Certificate

Use Let's Encrypt (free):
```bash
# On Ubuntu with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com
```

## Security Checklist

- ✅ Use HTTPS/SSL
- ✅ Set strong DATABASE_URL password
- ✅ Change admin credentials in production
- ✅ Enable CORS only for trusted domains
- ✅ Use environment variables for secrets
- ✅ Keep dependencies updated
- ✅ Monitor for security vulnerabilities

## Troubleshooting Production

### API Connection Timeout
- Check database is accessible from server
- Verify firewall rules
- Check connection pool settings

### High Memory Usage
- Check for memory leaks
- Monitor active connections
- Use `NODE_ENV=production`

### Slow Queries
- Add database indexes
- Monitor query performance
- Enable caching

## Support

For deployment issues:
1. Check application logs
2. Monitor database performance
3. Review API response times
4. Test locally first
