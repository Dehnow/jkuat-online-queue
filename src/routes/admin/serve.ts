/**
 * DEPRECATED: This file is NOT used in production
 * 
 * ACTUAL ROUTE: See api-server.js (lines 357-405)
 * 
 * The api-server.js file handles admin serve API operations:
 * - POST /api/admin/serve → Serve next, complete, or cancel queue entry
 * 
 * If you need to modify the /api/admin/serve route, edit api-server.js instead.
 */

// ORIGINAL CODE - NOT USED IN PRODUCTION
// See api-server.js for the actual implementation

    // Stop serving current entry for this service
    if (action === 'serve_next') {
      // Get the next waiting entry
      const nextEntry = await db.query.queueEntries.findFirst({
        where: and(
          eq(queueEntries.serviceType, serviceType as 'registrar' | 'finance' | 'ict_helpdesk'),
          eq(queueEntries.status, 'waiting')
        ),
        orderBy: (entries) => entries.createdAt,
      })

      if (!nextEntry) {
        return json({ error: 'No waiting entries' }, { status: 404 })
      }

      // First, mark current serving as served
      await db
        .update(queueEntries)
        .set({ status: 'served', servedAt: new Date() })
        .where(
          and(
            eq(queueEntries.serviceType, serviceType),
            eq(queueEntries.status, 'serving')
          )
        )

      // Then mark next as serving
      await db
        .update(queueEntries)
        .set({ status: 'serving' })
        .where(eq(queueEntries.id, nextEntry.id))

      return json({
        success: true,
        nowServing: nextEntry.queueNumber,
        entryId: nextEntry.id,
      })
    }

    if (action === 'complete' && entryId) {
      await db
        .update(queueEntries)
        .set({ status: 'served', servedAt: new Date() })
        .where(eq(queueEntries.id, entryId))

      return json({ success: true })
    }

    if (action === 'cancel' && entryId) {
      await db
        .update(queueEntries)
        .set({ status: 'cancelled' })
        .where(eq(queueEntries.id, entryId))

      return json({ success: true })
    }

    return json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Admin serve error:', error)
    return json({ error: 'Failed to process action' }, { status: 500 })
  }
}
