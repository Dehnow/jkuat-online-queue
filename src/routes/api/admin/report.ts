import { createFileRoute } from '@tanstack/react-router';
import { db } from '../../../../db/index.js';
import { queueEntries } from '../../../../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const ADMIN_USERNAME = 'Admin0375';
const ADMIN_PASSWORD = 'group2sysdev';

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Basic ')) return false;
  const decoded = atob(authHeader.slice(6));
  const [u, p] = decoded.split(':');
  return u === ADMIN_USERNAME && p === ADMIN_PASSWORD;
}

export const Route = createFileRoute('/api/admin/report')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!checkAuth(request)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const served = await db.select()
          .from(queueEntries)
          .where(eq(queueEntries.status, 'served'))
          .orderBy(desc(queueEntries.servedAt));

        return Response.json(served);
      },
    },
  },
});