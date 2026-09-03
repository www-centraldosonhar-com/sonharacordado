import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

console.log(
  '🧩 Configurando responsáveis do Pós-Evento geral...'
)

await sql`
  ALTER TABLE post_event_team_reports
  ADD COLUMN IF NOT EXISTS
    responsible_user_id INTEGER
    REFERENCES users(id)
    ON DELETE SET NULL
`

await sql`
  ALTER TABLE post_event_team_reports
  ADD COLUMN IF NOT EXISTS
    assigned_by INTEGER
    REFERENCES users(id)
    ON DELETE SET NULL
`

await sql`
  ALTER TABLE post_event_team_reports
  ADD COLUMN IF NOT EXISTS
    assigned_at TIMESTAMP
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_post_event_team_reports_responsible
  ON post_event_team_reports(
    responsible_user_id
  )
`

console.log(
  '✅ Estrutura de responsáveis criada!'
)

const columns = await sql`
  SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
  FROM information_schema.columns
  WHERE table_name =
    'post_event_team_reports'
    AND column_name IN (
      'responsible_user_id',
      'assigned_by',
      'assigned_at'
    )
  ORDER BY column_name
`

console.table(columns)
