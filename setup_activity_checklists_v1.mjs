import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// ACTIVITY CHECKLISTS V1
// =========================================================
//
// Uma checklist pertence a uma atividade do evento.
//
// source_type:
// event_registrations
//   -> voluntários inscritos/confirmados no evento
//
// Futuramente:
// assisted
// activity_confirmations
// manual
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS activity_checklists (
    id SERIAL PRIMARY KEY,

    event_role_id INTEGER NOT NULL,

    title TEXT NOT NULL,

    source_type TEXT NOT NULL
      DEFAULT 'event_registrations',

    assigned_user_id INTEGER,

    active INTEGER NOT NULL
      DEFAULT 1,

    created_at TIMESTAMP
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS activity_checklist_items (
    id SERIAL PRIMARY KEY,

    checklist_id INTEGER NOT NULL,

    registration_id INTEGER NOT NULL,

    checked INTEGER NOT NULL
      DEFAULT 0,

    checked_at TIMESTAMP,

    checked_by INTEGER,

    notes TEXT,

    updated_at TIMESTAMP
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
      checklist_id,
      registration_id
    )
  )
`

// =========================================================
// FOREIGN KEYS
// =========================================================

const constraints = await sql`
  SELECT conname
  FROM pg_constraint
  WHERE conname IN (
    'activity_checklists_event_role_fkey',
    'activity_checklists_assigned_user_fkey',
    'activity_checklist_items_checklist_fkey',
    'activity_checklist_items_registration_fkey',
    'activity_checklist_items_checked_by_fkey'
  )
`

const existing =
  new Set(
    constraints.map(
      (item) => item.conname
    )
  )

if (
  !existing.has(
    'activity_checklists_event_role_fkey'
  )
) {
  await sql`
    ALTER TABLE activity_checklists
    ADD CONSTRAINT
      activity_checklists_event_role_fkey
    FOREIGN KEY (event_role_id)
    REFERENCES event_roles(id)
    ON DELETE CASCADE
  `
}

if (
  !existing.has(
    'activity_checklists_assigned_user_fkey'
  )
) {
  await sql`
    ALTER TABLE activity_checklists
    ADD CONSTRAINT
      activity_checklists_assigned_user_fkey
    FOREIGN KEY (assigned_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
  `
}

if (
  !existing.has(
    'activity_checklist_items_checklist_fkey'
  )
) {
  await sql`
    ALTER TABLE activity_checklist_items
    ADD CONSTRAINT
      activity_checklist_items_checklist_fkey
    FOREIGN KEY (checklist_id)
    REFERENCES activity_checklists(id)
    ON DELETE CASCADE
  `
}

if (
  !existing.has(
    'activity_checklist_items_registration_fkey'
  )
) {
  await sql`
    ALTER TABLE activity_checklist_items
    ADD CONSTRAINT
      activity_checklist_items_registration_fkey
    FOREIGN KEY (registration_id)
    REFERENCES event_registrations(id)
    ON DELETE CASCADE
  `
}

if (
  !existing.has(
    'activity_checklist_items_checked_by_fkey'
  )
) {
  await sql`
    ALTER TABLE activity_checklist_items
    ADD CONSTRAINT
      activity_checklist_items_checked_by_fkey
    FOREIGN KEY (checked_by)
    REFERENCES users(id)
    ON DELETE SET NULL
  `
}

console.log('')
console.log('✅ Activity Checklists V1 ready!')
console.log('')
console.log('• activity_checklists')
console.log('• activity_checklist_items')
