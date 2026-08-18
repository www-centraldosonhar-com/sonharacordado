import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// ACTIVITY WORKFLOW
// =========================================================
// Defines whether an activity requires a post-event
// delivery before the admin can finalize it.
// =========================================================

await sql`
  ALTER TABLE event_roles
  ADD COLUMN IF NOT EXISTS requires_delivery
  INTEGER NOT NULL DEFAULT 0
`

// =========================================================
// CONFIRMATION WORKFLOW
// =========================================================
// Stores when the admin approves/finalizes an activity.
// Once finalized, it can disappear from the volunteer's
// active commitments without deleting its history.
// =========================================================

await sql`
  ALTER TABLE confirmations
  ADD COLUMN IF NOT EXISTS completed_at
  TIMESTAMP
`

// =========================================================
// MISSION WORKFLOW
// =========================================================
// Stores when the admin approves/finalizes a volunteer's
// participation in a mission.
// =========================================================

await sql`
  ALTER TABLE task_users
  ADD COLUMN IF NOT EXISTS completed_at
  TIMESTAMP
`

console.log('✅ Workflow fields created successfully!')
