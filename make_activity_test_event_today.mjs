import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const rows = await sql`
  UPDATE events

  SET
    event_date = CURRENT_DATE,
    confirmation_deadline = CURRENT_TIMESTAMP,
    active = 1,
    registrations_open = 0

  WHERE id = 35

  RETURNING
    id,
    name,
    event_date,
    event_status,
    active,
    registrations_open
`

console.table(rows)

console.log(
  '✅ Evento 35 ajustado para hoje somente para teste.'
)
