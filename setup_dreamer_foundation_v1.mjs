import process from 'node:process'
import fs from 'node:fs'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

const migration =
  fs.readFileSync(
    './migrations/007_dreamer_foundation.sql',
    'utf8'
  )

const statements =
  migration
    .split(';')
    .map(
      statement =>
        statement.trim()
    )
    .filter(Boolean)

for (
  const statement
  of statements
) {
  await sql.query(statement)
}

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE 'dreamer_%'
  ORDER BY table_name
`

console.log(
  '✅ Fundação Sócio Sonhador criada.'
)

console.table(tables)

process.exit(0)
