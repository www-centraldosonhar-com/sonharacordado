import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// PHOTO DELIVERY STATUS
// =========================================================
// Stores when a volunteer completed the photo delivery
// for a confirmed Photography role.
// =========================================================

await sql`
  ALTER TABLE confirmations
  ADD COLUMN IF NOT EXISTS photo_submitted_at
  TIMESTAMP
`

console.log(
  '✅ photo_submitted_at criado em confirmations!'
)
