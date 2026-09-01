import fs from 'node:fs/promises'
import process from 'node:process'

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const migration = await fs.readFile(
  new URL(
    './migrations/011_dreamer_community_hub.sql',
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

console.log('✅ Migration 011_dreamer_community_hub aplicada.')
