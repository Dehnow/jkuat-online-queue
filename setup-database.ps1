# JKUAT Queue - Database Setup Script
# This script will configure the database connection for Render deployment

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "JKUAT Queue - Database Connection Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Choose your database option:" -ForegroundColor Yellow
Write-Host "1. LocalTunnel (already running on port 5432)" -ForegroundColor Green
Write-Host "2. ngrok (requires authtoken)" -ForegroundColor Blue
Write-Host "3. Free Cloud PostgreSQL (Neon - no setup needed)" -ForegroundColor Magenta
Write-Host ""

# For quick setup, use LocalTunnel which is ALREADY RUNNING
$choice = Read-Host "Enter option (1-3) [recommended: 1]"

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "Using LocalTunnel:" -ForegroundColor Green
    $tunnelUrl = "every-horses-feel.loca.lt"
    
    # Build DATABASE_URL for LocalTunnel
    # LocalTunnel format: hostname only (no protocol for raw TCP tunnel)
    $databaseUrl = "postgresql://postgres:gamejerker@$tunnelUrl/jkuat_online_queue_local"
    
    Write-Host "LocalTunnel URL: $tunnelUrl" -ForegroundColor Green
    Write-Host "Generated DATABASE_URL:" -ForegroundColor Yellow
    Write-Host $databaseUrl
    Write-Host ""
    Write-Host "COPY this URL and paste it into Render environment variables:" -ForegroundColor Cyan
    Write-Host "1. Go to: https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60/env" -ForegroundColor Blue
    Write-Host "2. Update DATABASE_URL with the URL above" -ForegroundColor Blue
    Write-Host "3. Click 'Save'" -ForegroundColor Blue
    Write-Host "4. Go to Deploys tab and click 'Manual Deploy'" -ForegroundColor Blue
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Keep the LocalTunnel running (terminal with 'lt --port 5432' must stay open)" -ForegroundColor Yellow
    Write-Host ""
}
elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "Using ngrok:" -ForegroundColor Blue
    Write-Host "1. Go to: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Blue
    Write-Host "2. Copy your authtoken" -ForegroundColor Blue
    Write-Host "3. Run: .\ngrok.exe config add-authtoken YOUR_TOKEN_HERE" -ForegroundColor Blue
    Write-Host "4. Run: .\ngrok.exe tcp 5432" -ForegroundColor Blue
    Write-Host "5. You'll see a URL like: tcp://X.tcp.ngrok.io:XXXXX" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Then update Render DATABASE_URL to:" -ForegroundColor Yellow
    Write-Host "postgresql://postgres:gamejerker@X.tcp.ngrok.io:XXXXX/jkuat_online_queue_local" -ForegroundColor Green
    Write-Host ""
}
elseif ($choice -eq "3") {
    Write-Host ""
    Write-Host "Using Neon (Recommended - no tunneling needed):" -ForegroundColor Magenta
    Write-Host "1. Go to: https://console.neon.tech/signup" -ForegroundColor Blue
    Write-Host "2. Sign up with GitHub (1 click)" -ForegroundColor Blue
    Write-Host "3. Create a new project" -ForegroundColor Blue
    Write-Host "4. Copy the Connection String (PostgreSQL format)" -ForegroundColor Blue
    Write-Host "5. Update Render DATABASE_URL with it" -ForegroundColor Blue
    Write-Host ""
}

Write-Host "After updating DATABASE_URL in Render, run:" -ForegroundColor Cyan
Write-Host "  npm run verify-deploy" -ForegroundColor Green
