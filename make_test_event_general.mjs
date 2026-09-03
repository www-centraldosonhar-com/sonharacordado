import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

const rows = await sql`
  UPDATE events

  SET
    project_id = NULL,
    event_type = 'general',
    event_status = 'post_event',
    post_event_opened_at =
      CURRENT_TIMESTAMP,
    active = 1

  WHERE id = 31

  RETURNING
    id,
    name,
    project_id,
    event_type,
    event_status,
    active
`

console.log('')
console.log(
  '===== EVENTO TESTE ====='
)

console.table(rows)
