import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

await sql`
  ALTER TABLE team_expenses
  ADD COLUMN IF NOT EXISTS
    cancellation_reason TEXT
`

await sql`
  ALTER TABLE team_expenses
  ADD COLUMN IF NOT EXISTS
    cancelled_at TIMESTAMP
`

await sql`
  ALTER TABLE team_expenses
  ADD COLUMN IF NOT EXISTS
    cancelled_by INTEGER
`

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname =
        'team_expenses_cancelled_by_fkey'
    ) THEN
      ALTER TABLE team_expenses
      ADD CONSTRAINT
        team_expenses_cancelled_by_fkey
      FOREIGN KEY (cancelled_by)
      REFERENCES users(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$;
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_team_expenses_active
  ON team_expenses(active)
`

console.log('✅ Team Expenses V2 ready!')
console.log('• cancelamento auditável')
