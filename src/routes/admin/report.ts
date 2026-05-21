import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq, gte, lte, and, desc } from 'drizzle-orm'

// Basic Auth helper
function getBasicAuth(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Basic ')) {
    return null
  }

  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString()
  const [username, password] = credentials.split(':')
  return { username, password }
}

function verifyAuth(request: Request): boolean {
  const auth = getBasicAuth(request)
  if (!auth) return false

  const validUsername = 'Admin0375'
  const validPassword = 'group2sysdev'

  return auth.username === validUsername && auth.password === validPassword
}

export async function GET(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const serviceType = url.searchParams.get('service')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build query filters
    const filters = []

    if (serviceType) {
      filters.push(eq(queueEntries.serviceType, serviceType as 'registrar' | 'finance' | 'ict_helpdesk'))
    }

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      filters.push(
        and(
          gte(queueEntries.createdAt, start),
          lte(queueEntries.createdAt, end)
        )
      )
    }

    // Get served entries
    const servedEntries = await db.query.queueEntries.findMany({
      where: filters.length > 0 
        ? and(eq(queueEntries.status, 'served'), ...filters)
        : eq(queueEntries.status, 'served'),
      orderBy: desc(queueEntries.servedAt),
    })

    // Calculate stats
    const totalServed = servedEntries.length
    const avgWaitTime = servedEntries.length > 0
      ? servedEntries.reduce((sum, entry) => {
          if (entry.createdAt && entry.servedAt) {
            return sum + (entry.servedAt.getTime() - entry.createdAt.getTime())
          }
          return sum
        }, 0) / totalServed / 1000 / 60
      : 0

    return json({
      totalServed,
      averageWaitTimeMinutes: Math.round(avgWaitTime),
      entries: servedEntries.map(entry => ({
        id: entry.id,
        queueNumber: entry.queueNumber,
        name: entry.name,
        studentId: entry.studentId,
        service: entry.serviceType,
        createdAt: entry.createdAt,
        servedAt: entry.servedAt,
        waitTimeMinutes: entry.servedAt && entry.createdAt 
          ? Math.round((entry.servedAt.getTime() - entry.createdAt.getTime()) / 1000 / 60)
          : 0,
      })),
    })
  } catch (error) {
    console.error('Admin report error:', error)
    return json({ error: 'Failed to fetch report' }, { status: 500 })
  }
}
