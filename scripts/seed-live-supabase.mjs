import postgres from 'postgres';

const DATABASE_URL = 'postgresql://postgres.pqqxhzzrqedznnjdjcin:gamejerker11314D%24@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
const sql = postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false } });

try {
  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.message_type AS ENUM ('feedback', 'admin_request', 'admin_response');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'office_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.office_status AS ENUM ('open', 'closed');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_type' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.service_type AS ENUM ('registrar', 'finance', 'ict_helpdesk');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.queue_status AS ENUM ('waiting', 'serving', 'served', 'cancelled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mpesa_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.mpesa_status AS ENUM ('pending', 'success', 'failed');
      END IF;
    END $$;
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public.admin_requests (
      id SERIAL PRIMARY KEY,
      office_id INTEGER,
      staff_username TEXT NOT NULL,
      request_type TEXT NOT NULL,
      request_data TEXT,
      status public.request_status NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      responded_at TIMESTAMP
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public.feedback_messages (
      id SERIAL PRIMARY KEY,
      office_id INTEGER NOT NULL,
      staff_username TEXT NOT NULL,
      message_type public.message_type NOT NULL,
      message TEXT NOT NULL,
      response TEXT,
      responded_by TEXT,
      status public.request_status NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      responded_at TIMESTAMP
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public.offices (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      service_type public.service_type NOT NULL,
      status public.office_status NOT NULL DEFAULT 'open',
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by TEXT
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public.queue_entries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      student_id TEXT NOT NULL,
      service_type public.service_type NOT NULL,
      queue_number INTEGER NOT NULL,
      status public.queue_status NOT NULL DEFAULT 'waiting',
      created_at TIMESTAMP DEFAULT NOW(),
      served_at TIMESTAMP,
      office_id INTEGER,
      is_golden BOOLEAN NOT NULL DEFAULT FALSE,
      golden_ticket_ref TEXT,
      mpesa_transaction_id TEXT,
      mpesa_status public.mpesa_status,
      mpesa_paid_at TIMESTAMP,
      can_upgrade_to_golden BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public.staff_accounts (
      id SERIAL PRIMARY KEY,
      office_id INTEGER NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      has_admin_privilege BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by TEXT
    );
  `);

  const officeCount = await sql`SELECT COUNT(*)::int AS count FROM public.offices`;
  if ((officeCount[0]?.count ?? 0) === 0) {
    await sql.unsafe(`
      INSERT INTO public.offices (name, service_type, status, username, password, created_by)
      VALUES
        ('Registrar Main Office', 'registrar', 'open', 'registrar_staff', 'password123', 'Admin0375'),
        ('Finance Office', 'finance', 'open', 'finance_staff', 'password123', 'Admin0375'),
        ('ICT Helpdesk', 'ict_helpdesk', 'open', 'ict_staff', 'password123', 'Admin0375');
    `);
  }

  const staffCount = await sql`SELECT COUNT(*)::int AS count FROM public.staff_accounts`;
  if ((staffCount[0]?.count ?? 0) === 0) {
    await sql.unsafe(`
      INSERT INTO public.staff_accounts (office_id, username, password, has_admin_privilege, created_by)
      VALUES
        (1, 'registrar_staff', 'password123', true, 'Admin0375'),
        (2, 'finance_staff', 'password123', true, 'Admin0375'),
        (3, 'ict_staff', 'password123', true, 'Admin0375');
    `);
  }

  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  const offices = await sql`SELECT * FROM public.offices ORDER BY id`;
  const staff = await sql`SELECT * FROM public.staff_accounts ORDER BY id`;

  console.log('TABLES', JSON.stringify(tables, null, 2));
  console.log('OFFICES', JSON.stringify(offices, null, 2));
  console.log('STAFF', JSON.stringify(staff, null, 2));
  console.log('SCHEMA_SEED_OK');
} catch (error) {
  console.error('SCHEMA_SEED_ERROR', error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
