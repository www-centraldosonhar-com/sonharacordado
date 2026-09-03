import { neon } from '@neondatabase/serverless'
import process from 'node:process'

const sql = neon(process.env.DATABASE_URL)

console.log('↩️ Configurando devolução de fechamento...')

await sql`
  ALTER TABLE post_event_team_reports

  ADD COLUMN IF NOT EXISTS
    returned_by INTEGER
      REFERENCES users(id)
      ON DELETE SET NULL
`

await sql`
  ALTER TABLE post_event_team_reports

  ADD COLUMN IF NOT EXISTS
    returned_at TIMESTAMP
`

await sql`
  ALTER TABLE post_event_team_reports

  ADD COLUMN IF NOT EXISTS
    return_reason TEXT
`

console.log('✅ Estrutura de devolução configurada.')
