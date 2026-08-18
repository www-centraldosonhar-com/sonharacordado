import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// REGISTRATIONS V1
// =========================================================
// Separação importante:
//
// event_registrations = inscrição no evento
// confirmations      = atividade específica no evento
//
// Um usuário pode estar inscrito sem assumir atividade.
// =========================================================


// =========================================================
// 1. EVENTS
// =========================================================

await sql`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_fee
  NUMERIC(10, 2)
`

await sql`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_deadline
  TIMESTAMP
`

await sql`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registrations_open
  INTEGER NOT NULL DEFAULT 1
`


// =========================================================
// 2. REGISTRATION COUPONS
// =========================================================
// Cupom = gratuidade total.
//
// Não confirma automaticamente.
// O Admin ainda precisa aprovar.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS registration_coupons (
    id SERIAL PRIMARY KEY,

    code TEXT NOT NULL UNIQUE,

    usage_limit INTEGER NOT NULL,

    active INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (usage_limit > 0)
  )
`


// =========================================================
// 3. EVENT REGISTRATIONS
// =========================================================
//
// Status possíveis:
//
// pending_payment_review
// pending_coupon_review
// confirmed
// payment_rejected
// cancelled
//
// team:
// activities
// assisted
// media
// kitchen
//
// As equipes são controladas pelo código.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS event_registrations (
    id SERIAL PRIMARY KEY,

    event_id INTEGER NOT NULL
      REFERENCES events(id)
      ON DELETE CASCADE,

    user_id INTEGER NOT NULL
      REFERENCES users(id)
      ON DELETE CASCADE,

    email TEXT NOT NULL,

    team TEXT NOT NULL,

    status TEXT NOT NULL
      DEFAULT 'pending_payment_review',

    payment_receipt_path TEXT,

    coupon_id INTEGER
      REFERENCES registration_coupons(id)
      ON DELETE SET NULL,

    rejection_reason TEXT,

    created_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    reviewed_at TIMESTAMP,

    reviewed_by INTEGER
      REFERENCES users(id)
      ON DELETE SET NULL,

    UNIQUE(event_id, user_id),

    CHECK (
      team IN (
        'activities',
        'assisted',
        'media',
        'kitchen'
      )
    ),

    CHECK (
      status IN (
        'pending_payment_review',
        'pending_coupon_review',
        'confirmed',
        'payment_rejected',
        'cancelled'
      )
    )
  )
`


// =========================================================
// INDEXES
// =========================================================

await sql`
  CREATE INDEX IF NOT EXISTS
  idx_event_registrations_event
  ON event_registrations(event_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
  idx_event_registrations_user
  ON event_registrations(user_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
  idx_event_registrations_status
  ON event_registrations(status)
`

await sql`
  CREATE INDEX IF NOT EXISTS
  idx_event_registrations_coupon
  ON event_registrations(coupon_id)
`

console.log('')
console.log('✅ Registrations v1 database ready!')
console.log('')
console.log('Created / verified:')
console.log('• events.registration_fee')
console.log('• events.registration_deadline')
console.log('• events.registrations_open')
console.log('• registration_coupons')
console.log('• event_registrations')
