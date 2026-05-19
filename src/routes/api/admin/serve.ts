import { createFileRoute } from '@tanstack/react-router';
import { db } from '../../../../db/index.js';
import { queueEntries } from '../../../../db/schema.js';
import { eq, and, asc } from 'drizzle-orm';

const ADMIN_USERNAME = 'Admin0375';
const ADMIN_PASSWORD = 'group2sysdev';

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Basic ')) return false;
  const decoded = atob(authHeader.slice(6));
  const [u, p] = decoded.split(':');
  return u === ADMIN_USERNAME && p === ADMIN_PASSWORD;
}

export async function POST(request: Request) {
  // Get token from Authorization header or query param
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (token !== process.env.ADMIN_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // ... rest of your logic
}
export const Route = createFileRoute('/api/admin/serve')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { serviceType, action, entryId } = await request.json() as {
          serviceType: 'registrar' | 'finance' | 'ict_helpdesk';
          action: 'serve_next' | 'complete' | 'cancel';
          entryId?: number;
        };

        if (action === 'serve_next') {
          // Mark currently serving as served
          await db.update(queueEntries)
            .set({ status: 'served', servedAt: new Date() })
            .where(and(eq(queueEntries.serviceType, serviceType), eq(queueEntries.status, 'serving')));

          // Get next waiting
          const waiting = await db.select().from(queueEntries)
            .where(and(eq(queueEntries.serviceType, serviceType), eq(queueEntries.status, 'waiting')))
            .orderBy(asc(queueEntries.queueNumber))
            .limit(1);

          if (waiting.length === 0) return Response.json({ message: 'No more in queue' });

          const [next] = await db.update(queueEntries)
            .set({ status: 'serving' })
            .where(eq(queueEntries.id, waiting[0].id))
            .returning();

          return Response.json(next);
        }

        if (action === 'complete' && entryId) {
          const [updated] = await db.update(queueEntries)
            .set({ status: 'served', servedAt: new Date() })
            .where(eq(queueEntries.id, entryId))
            .returning();
          return Response.json(updated);
        }

        if (action === 'cancel' && entryId) {
          const [updated] = await db.update(queueEntries)
            .set({ status: 'cancelled' })
            .where(eq(queueEntries.id, entryId))
            .returning();
          return Response.json(updated);
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
      },
    },
  },
});