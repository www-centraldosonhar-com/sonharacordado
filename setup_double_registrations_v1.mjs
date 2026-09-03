import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// DOUBLE REGISTRATIONS V1
// =========================================================
//
// Um evento específico pode apontar explicitamente para um
// evento geral complementar (ex.: Formação de Valores).
//
// Ao confirmar a inscrição do evento principal, a Central
// cria/atualiza uma inscrição espelho no evento vinculado.
// O espelho é identificado por paired_from_registration_id,
// evitando duplicações e permitindo sincronizar cancelamento.
// =========================================================

await sql`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS paired_registration_event_id INTEGER
`

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'events_paired_registration_event_id_fkey'
    ) THEN
      ALTER TABLE events
      ADD CONSTRAINT events_paired_registration_event_id_fkey
      FOREIGN KEY (paired_registration_event_id)
      REFERENCES events(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$;
`

await sql`
  CREATE INDEX IF NOT EXISTS idx_events_paired_registration_event
  ON events(paired_registration_event_id)
`

await sql`
  ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS paired_from_registration_id INTEGER
`

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'event_registrations_paired_from_registration_id_fkey'
    ) THEN
      ALTER TABLE event_registrations
      ADD CONSTRAINT event_registrations_paired_from_registration_id_fkey
      FOREIGN KEY (paired_from_registration_id)
      REFERENCES event_registrations(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$;
`

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_paired_source_unique
  ON event_registrations(paired_from_registration_id)
  WHERE paired_from_registration_id IS NOT NULL
`

console.log('✅ Double Registrations V1 ready!')
console.log('• evento específico pode vincular uma Formação/evento geral')
console.log('• inscrição espelho é rastreável e idempotente')
