import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

const rows = await sql`
  UPDATE events

  SET
    event_status = 'upcoming',
    post_event_opened_at = NULL,
    registrations_open = 0,
    active = 1

  WHERE id = 31

  RETURNING
    id,
    name,
    event_status,
    active,
    registrations_open,
    post_event_opened_at
`

console.table(rows)

await sql`
  DELETE FROM post_event_closures
  WHERE event_id = 31
`

console.log(
  '✅ Evento 31 resetado para abrir o Pós-Evento pela interface.'
)
