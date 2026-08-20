import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

console.log(
  '💰 Configurando fechamento financeiro de gastos...'
)

await sql`
  ALTER TABLE post_event_closures
  ADD COLUMN IF NOT EXISTS
    expenses_closed INTEGER
    NOT NULL
    DEFAULT 0
`

await sql`
  ALTER TABLE post_event_closures
  ADD COLUMN IF NOT EXISTS
    expenses_closed_by INTEGER
    REFERENCES users(id)
    ON DELETE SET NULL
`

await sql`
  ALTER TABLE post_event_closures
  ADD COLUMN IF NOT EXISTS
    expenses_closed_at TIMESTAMP
`

console.log(
  '✅ Estrutura de fechamento de gastos criada!'
)

const columns = await sql`
  SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
  FROM information_schema.columns
  WHERE table_name =
    'post_event_closures'
    AND column_name IN (
      'expenses_closed',
      'expenses_closed_by',
      'expenses_closed_at'
    )
  ORDER BY column_name
`

console.table(columns)
