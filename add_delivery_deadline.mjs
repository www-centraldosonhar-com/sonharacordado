import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// ACTIVITY DELIVERY DEADLINE
// =========================================================
// Optional deadline for activities that require a
// post-event delivery.
// =========================================================

await sql`
  ALTER TABLE event_roles
  ADD COLUMN IF NOT EXISTS delivery_deadline
  TIMESTAMP
`

console.log(
  '✅ delivery_deadline criado com sucesso!'
)
