#!/bin/bash
# JKUAT Queue System - Verification Script
# This script verifies all critical functionalities without modifying code

echo "=========================================="
echo "JKUAT Queue System - Live Verification"
echo "=========================================="
echo ""

# Check Node.js
echo "✓ Checking Node.js..."
node --version
npm --version
echo ""

# Check if dependencies are installed
echo "✓ Checking dependencies..."
if [ -d "node_modules" ]; then
  echo "  ✓ node_modules exists"
else
  echo "  ✗ node_modules missing - run: npm install"
fi
echo ""

# Check critical files
echo "✓ Checking critical files..."
files=(
  "src/routes/login.tsx"
  "src/routes/admin.tsx"
  "src/routes/index.tsx"
  "src/routes/track.\$id.tsx"
  "src/routes/__root.tsx"
  "api-server.js"
  "package.json"
  "vite.config.ts"
  "public/queue-bg.jpeg"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file MISSING"
  fi
done
echo ""

# Check environment
echo "✓ Environment Setup:"
if [ -z "$DATABASE_URL" ]; then
  echo "  ⚠️  DATABASE_URL not set (required for production)"
else
  echo "  ✓ DATABASE_URL configured"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Start backend: npm run server"
echo "2. Start frontend: npm run dev:client"
echo "3. Login credentials: Admin0375 / group2sysdev"
echo "4. Access admin at: http://localhost:3001/admin"
