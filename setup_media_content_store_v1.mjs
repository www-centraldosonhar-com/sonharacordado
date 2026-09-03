import process from 'node:process'
import fs from 'node:fs'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const migration = fs.readFileSync(
  './migrations/006_media_content_deliveries.sql',
  'utf8'
)

const statements = migration
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean)

for (const statement of statements) {
  await sql.query(statement)
}

console.log(
  '✅ Armazém de Criação preparado.'
)

const tables = await sql`
  SELECT
    table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'media_content_deliveries'
`

console.log(tables)

process.exit(0)
