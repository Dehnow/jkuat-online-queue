/**
 * DEPRECATED: This file is NOT used in production
 * 
 * This file contains TanStack Start-style handlers that were intended for
 * full-stack integration, but the project uses Express + React Router instead.
 * 
 * ACTUAL ROUTE: See api-server.js (lines 308-330)
 * 
 * The api-server.js file handles ticket history API operations:
 * - GET /api/ticketHistory?studentId=X → Get student's ticket history
 * 
 * If you need to modify the /api/ticketHistory route, edit api-server.js instead.
 * This file is kept for reference only.
 */

// ============================================================================
// ORIGINAL CODE - NOT USED IN PRODUCTION - FOR REFERENCE ONLY
// ============================================================================

// import { json } from '@tanstack/start'
// import { db } from '../../db/index'
// import { queueEntries } from '../../db/schema'
// import { eq, desc } from 'drizzle-orm'
//
// export async function GET(request: Request) {
//   try {
//     const url = new URL(request.url)
//     const studentId = url.searchParams.get('studentId')
//
//     if (!studentId) {
//       return json({ error: 'Student ID is required', tickets: [] }, { status: 400 })
//     }
//
//     const tickets = await db.query.queueEntries.findMany({
//       where: eq(queueEntries.studentId, studentId),
//       orderBy: desc(queueEntries.createdAt),
//       limit: 50,
//     })
//
//     return json({
//       tickets: tickets.map(t => ({
//         id: t.id,
//         queueNumber: t.queueNumber,
//         serviceType: t.serviceType,
//         status: t.status,
//         createdAt: t.createdAt,
//         servedAt: t.servedAt,
//       })),
//     })
//   } catch (error) {
//     console.error('Error fetching ticket history:', error)
//     return json({ error: 'Failed to fetch history', tickets: [] }, { status: 500 })
//   }
// }
