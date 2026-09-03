import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const rows = await sql`
  SELECT
    id,
    name,
    event_date,
    event_status,
    active,
    registrations_open,
    post_event_opened_at,
    CURRENT_DATE AS today
  FROM events
  WHERE id = 35
`

console.table(rows)
