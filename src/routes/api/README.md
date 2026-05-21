/**
 * DEPRECATED: This file is NOT used in production
 * 
 * This file appears to be leftover from a planned TanStack Start migration.
 * 
 * ACTUAL API ROUTES: See api-server.js
 * 
 * In production, all API routes are handled by api-server.js:
 * - GET  /api/queue          - Get queue status
 * - POST /api/queue          - Join queue
 * - GET  /api/queue/:id      - Get queue entry details
 * - GET  /api/ticketHistory  - Get student's ticket history
 * - POST /api/admin/serve    - Admin serve next
 * - GET  /api/admin/report   - Admin report (all served entries)
 * 
 * The api-server.js file handles all backend operations and database
 * connectivity. This directory structure (src/routes/api/) is NOT used
 * in the deployed application.
 * 
 * Architecture:
 * - Frontend: React SPA (Vite + React Router)
 * - Backend: Express server (api-server.js)
 * - Database: PostgreSQL via Drizzle ORM (inline in api-server.js)
 * - Deployment: Single Express server on port 3000 serving both frontend and API
 */

// This file should not be imported or used anywhere
// If you need to modify API routes, edit api-server.js instead
