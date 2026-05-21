/**
 * DEPRECATED: This file is NOT used in production
 * 
 * ACTUAL ROUTE: See api-server.js (lines 407-425)
 * 
 * The api-server.js file handles admin report API operations:
 * - GET /api/admin/report → Get all served entries (with Basic Auth)
 * 
 * If you need to modify the /api/admin/report route, edit api-server.js instead.
 */

// ORIGINAL CODE - NOT USED IN PRODUCTION
// See api-server.js for the actual implementation
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
