import fs from 'node:fs/promises'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const migration = await fs.readFile(
  new URL('./migrations/013_dreamer_campaign_closure_v2.sql', import.meta.url),
  'utf8'
)

const statements = migration
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean)

for (const statement of statements) {
  await sql.query(statement)
}

console.log('✅ Migration 013_dreamer_campaign_closure_v2 aplicada.')
