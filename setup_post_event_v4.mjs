import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

console.log(
  '🧩 Configurando situação financeira por equipe...'
)

await sql`
  ALTER TABLE post_event_team_reports

  ADD COLUMN IF NOT EXISTS
    financial_status TEXT
    NOT NULL
    DEFAULT 'pending'
`

await sql`
  ALTER TABLE post_event_team_reports

  ADD COLUMN IF NOT EXISTS
    financial_completed_at TIMESTAMP
`

await sql`
  ALTER TABLE post_event_team_reports

  ADD COLUMN IF NOT EXISTS
    financial_completed_by INTEGER
    REFERENCES users(id)
    ON DELETE SET NULL
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_post_event_team_reports_financial_status

  ON post_event_team_reports (
    event_id,
    financial_status
  )
`

console.log(
  '✅ Situação financeira por equipe configurada!'
)

const columns = await sql`
  SELECT
    column_name,
    data_type,
    is_nullable,
    column_default

  FROM information_schema.columns

  WHERE
    table_name =
      'post_event_team_reports'

    AND column_name IN (
      'financial_status',
      'financial_completed_at',
      'financial_completed_by'
    )

  ORDER BY
    column_name
`

console.table(columns)
