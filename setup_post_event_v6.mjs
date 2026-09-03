import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

console.log(
  '⭐ Configurando avaliação do Fechamento da Equipe...'
)

await sql`
  ALTER TABLE post_event_team_reports

  ADD COLUMN IF NOT EXISTS
    rating INTEGER
`

await sql`
  ALTER TABLE post_event_team_reports

  ADD COLUMN IF NOT EXISTS
    rating_comment TEXT
`

await sql`
  ALTER TABLE post_event_team_reports

  DROP CONSTRAINT IF EXISTS
    post_event_team_reports_rating_check
`

await sql`
  ALTER TABLE post_event_team_reports

  ADD CONSTRAINT
    post_event_team_reports_rating_check

  CHECK (
    rating IS NULL
    OR (
      rating >= 1
      AND rating <= 5
    )
  )
`

console.log(
  '✅ Avaliação 1–5 configurada.'
)

const columns = await sql`
  SELECT
    column_name,
    data_type,
    is_nullable

  FROM information_schema.columns

  WHERE
    table_name =
      'post_event_team_reports'

    AND column_name IN (
      'rating',
      'rating_comment'
    )

  ORDER BY
    ordinal_position
`

console.table(columns)
