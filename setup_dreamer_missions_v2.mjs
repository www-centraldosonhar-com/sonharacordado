import fs from 'node:fs/promises'
import process from 'node:process'

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const migration = await fs.readFile(
  new URL(
    './migrations/009_dreamer_missions_v2.sql',
    import.meta.url
  ),
  'utf8'
)

const statements = migration
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean)

for (const statement of statements) {
  await sql.query(statement)
}

console.log('✅ Migration 009_dreamer_missions_v2 aplicada.')
