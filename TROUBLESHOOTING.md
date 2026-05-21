# Troubleshooting Guide

## Common Issues and Solutions

### ❌ "npm: command not found"

**Problem**: Node.js or npm is not installed

**Solution**:
1. Install Node.js from https://nodejs.org/ (v16 or higher)
2. Verify installation:
   ```bash
   node --version
   npm --version
   ```

---

### ❌ "Cannot find module 'express'"

**Problem**: Dependencies not installed

**Solution**:
```bash
npm install
```

Wait for all packages to finish installing (~2-5 minutes).

---

### ❌ "DATABASE_URL not set"

**Problem**: Backend can't connect to database

**Solution**:

1. Create `.env` file from template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your database connection:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/jkuat_queue
   ```

3. Restart backend:
   ```bash
   npm run dev:server
   ```

**PostgreSQL Connection String Format**:
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Examples:
- Local default: `postgresql://postgres:postgres@localhost:5432/jkuat_queue`
- With specific password: `postgresql://user:mypassword@localhost:5432/jkuat_queue`
- Remote server: `postgresql://user:pass@db.example.com:5432/jkuat_queue`

---

### ❌ "connect ECONNREFUSED 127.0.0.1:5432"

**Problem**: PostgreSQL server is not running

**Solution**:

**Windows**:
```bash
# Start PostgreSQL service
# Method 1: Services app
# - Open Services (services.msc)
# - Find "postgresql-x64-XX"
# - Right-click > Start

# Method 2: Command line (admin)
net start postgresql-15
```

**Mac**:
```bash
# Using Homebrew
brew services start postgresql

# Or manually
/usr/local/opt/postgresql/bin/postgres -D /usr/local/var/postgres
```

**Linux**:
```bash
sudo service postgresql start

# Or with systemctl
sudo systemctl start postgresql
```

**Verify PostgreSQL is running**:
```bash
psql --version
psql -U postgres -d postgres -c "SELECT 1"
```

---

### ❌ "database 'jkuat_queue' does not exist"

**Problem**: Database hasn't been created yet

**Solution**:

```bash
# Create database
createdb jkuat_queue

# Verify it was created
psql -l | grep jkuat_queue

# Or connect to it
psql -U postgres -d jkuat_queue
```

If `createdb` command not found, use:
```bash
psql -U postgres -c "CREATE DATABASE jkuat_queue;"
```

---

### ❌ "listen EADDRINUSE: address already in use :::3000"

**Problem**: Port 3000 is already in use

**Solution**:

**Option 1**: Stop the process using the port

Windows:
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill it (replace PID with the number)
taskkill /PID <PID> /F

# Example: taskkill /PID 1234 /F
```

Mac/Linux:
```bash
# Find process
lsof -i :3000

# Kill it (replace PID)
kill -9 <PID>
```

**Option 2**: Use a different port

```bash
PORT=3001 npm run dev:server
```

Then update frontend to call `http://localhost:3001/api/*`

---

### ❌ "Vite error: Failed to load module script"

**Problem**: Frontend build failed

**Solution**:

```bash
# Clear cache
rm -rf node_modules/.vite

# Reinstall dependencies
npm install

# Try again
npm run dev:client
```

---

### ❌ Frontend shows "Cannot GET /"

**Problem**: Frontend not serving correctly

**Solution**:

1. Check frontend is running:
   ```bash
   npm run dev:client
   ```
   Should show: `Local: http://localhost:3001/`

2. Navigate to http://localhost:3001 (not http://localhost:3000)

3. Check console for errors (F12 > Console)

4. Try clearing browser cache:
   - Chrome: Ctrl+Shift+Del
   - Firefox: Ctrl+Shift+Del
   - Safari: Cmd+Shift+Delete

---

### ❌ "Failed to fetch" in browser console

**Problem**: Frontend can't reach backend API

**Solution**:

1. **Verify backend is running**:
   ```bash
   curl http://localhost:3000/api/health
   ```
   Should return `{"status":"ok"}`

2. **Check CORS is enabled**: Backend should show no CORS errors

3. **Check frontend is calling correct URL**:
   - Should be: `http://localhost:3000/api/*`
   - Check in browser Network tab (F12)

4. **If using HTTPS**: Ensure backend also uses HTTPS or disable CORS restrictions

5. **Browser console errors**:
   - Open F12 > Console
   - Look for red error messages
   - Check Network tab to see actual request/response

---

### ❌ "Syntax Error in vite.config.ts"

**Problem**: Configuration file has invalid syntax

**Solution**:

1. Open `vite.config.ts`
2. Check for:
   - Missing commas between properties
   - Unclosed braces `{}`
   - Unclosed brackets `[]`
   - Quotes not matching `"` or `'`

3. Compare with working version in git

4. Restart dev server

---

### ❌ "TypeError: Cannot read properties of undefined"

**Problem**: Variable is undefined (common in routing issues)

**Solution**:

1. Check browser console (F12) for full error
2. Find file and line number in stack trace
3. Verify object exists before accessing properties
4. Common causes:
   - Route params not loaded
   - API response not received
   - Component not mounted

Example fix:
```javascript
// ❌ Wrong
const data = response.data.entries

// ✅ Right
const data = response?.data?.entries || []
```

---

### ❌ "ReferenceError: __dirname is not defined"

**Problem**: Using CommonJS in ES modules

**Solution**:

In `.js` files, ensure `package.json` has:
```json
"type": "module"
```

And use ES6 imports:
```javascript
// ❌ Wrong
const path = require('path')

// ✅ Right
import path from 'path'
```

---

### ❌ Admin credentials not working

**Problem**: Login rejected with `Admin0375` / `group2sysdev`

**Solution**:

1. **For API calls**: Use Basic Auth header
   ```bash
   # Base64 encode: Admin0375:group2sysdev
   curl -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=" \
     http://localhost:3000/api/admin/report
   ```

2. **For frontend login**: 
   - Username: `Admin0375`
   - Password: `group2sysdev`

3. **If still rejected**:
   - Check credentials in `api-server.js`
   - Verify Authorization header is formatted correctly
   - Check if special characters need escaping

---

### ❌ Queue entry not saving to database

**Problem**: POST /api/queue returns success but data isn't in database

**Solution**:

1. Verify database is connected:
   ```bash
   psql -d jkuat_queue -c "SELECT * FROM queue_entries;"
   ```

2. Check table exists:
   ```bash
   psql -d jkuat_queue -c "\dt"
   ```

3. If table missing, create it manually:
   ```sql
   CREATE TABLE queue_entries (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     student_id TEXT NOT NULL,
     service_type VARCHAR(20) NOT NULL,
     queue_number INTEGER NOT NULL,
     status VARCHAR(20) NOT NULL DEFAULT 'waiting',
     created_at TIMESTAMP DEFAULT NOW(),
     served_at TIMESTAMP
   );
   ```

4. Restart backend: `npm run dev:server`

---

### ❌ "Port 3001 already in use"

**Problem**: Another process is using Vite's port

**Solution**:

```bash
# Find process on port 3001
netstat -ano | findstr :3001  # Windows
lsof -i :3001                 # Mac/Linux

# Kill it
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # Mac/Linux

# Or use different port
VITE_PORT=3002 npm run dev:client
```

---

### ❌ Hot module reload (HMR) not working

**Problem**: Changes to files don't auto-reload

**Solution**:

1. Restart dev server:
   ```bash
   # Stop with Ctrl+C
   npm run dev:client
   ```

2. Clear browser cache: Ctrl+Shift+Del

3. Hard refresh: Ctrl+F5 or Cmd+Shift+R

4. Check file watcher limit (Linux only):
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

---

### ❌ TypeScript errors in terminal

**Problem**: Type checking fails but code runs

**Solution**:

1. Check the specific error
2. Install missing types:
   ```bash
   npm install --save-dev @types/node
   ```

3. Fix type errors in code
4. Or suppress temporarily:
   ```typescript
   // @ts-ignore
   const x = unknownValue
   ```

---

### ❌ "CORS policy: No 'Access-Control-Allow-Origin' header"

**Problem**: Browser blocks API request from different origin

**Solution**:

**Should be fixed by default**, but verify:

1. Check backend has CORS middleware:
   ```javascript
   app.use(cors({
     origin: ['http://localhost:3001', 'http://localhost:5173'],
     credentials: true,
   }))
   ```

2. If deploying: Update allowed origins in `api-server.js`

3. Test without CORS (browser dev mode):
   - Chrome: Launch with `--disable-web-security`
   - Not recommended for production

---

### ❌ "Cannot find index.html"

**Problem**: Vite can't find HTML entry point

**Solution**:

1. Verify `index.html` exists in project root
2. Should have:
   ```html
   <!DOCTYPE html>
   <html>
     <head>
       <title>JKUAT Queue</title>
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="/src/main.tsx"></script>
     </body>
   </html>
   ```

3. Verify `src/main.tsx` exists and is valid React

---

## Getting Help

If you're still stuck:

1. **Check logs**:
   - Frontend: Browser console (F12)
   - Backend: Terminal output

2. **Search documentation**:
   - `SETUP.md` - Setup instructions
   - `API_TESTING.md` - API examples
   - `DEPLOYMENT.md` - Deployment help

3. **Verify setup**:
   ```bash
   node verify-setup.js
   ```

4. **Test components individually**:
   - Test backend: `curl http://localhost:3000/api/health`
   - Test frontend: Navigate to `http://localhost:3001`

5. **Reset and reinstall**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOENT: no such file or directory, open '.env'` | Missing .env file | `cp .env.example .env` |
| `ECONNREFUSED` | Database not running | Start PostgreSQL |
| `EADDRINUSE` | Port in use | Use different port or kill process |
| `401 Unauthorized` | Bad credentials | Check auth header format |
| `404 Not Found` | Wrong URL or endpoint | Check API endpoint path |
| `CORS policy error` | Origin not allowed | Update CORS in backend |
| `SyntaxError: Unexpected token` | Invalid JSON | Check JSON formatting |
| `Cannot GET /` | Frontend not running | `npm run dev:client` |
| `Timeout` | Server not responding | Restart backend |

---

## Still Need Help?

- Check your **shell output** for error messages
- Look at **browser console** (F12 > Console)
- Enable **verbose logging**: Set `DEBUG=*` before running
- Try **restarting everything**: Stop all services and start fresh
- Review **documentation** in `SETUP.md` and `API_TESTING.md`
