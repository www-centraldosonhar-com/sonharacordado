import fs from 'node:fs/promises'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const migration = await fs.readFile(
  new URL('./migrations/012_dreamer_direct_contributions_v1.sql', import.meta.url),
  'utf8'
)

// O driver serverless do Neon aceita apenas um comando por prepared statement.
// Esta migration contém ALTER TABLE + índices, então executamos cada comando
// individualmente. As instruções usam IF NOT EXISTS, mantendo o setup idempotente.
const statements = migration
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

for (const statement of statements) {
  await sql.query(statement)
}

console.log('✅ Migration 012_dreamer_direct_contributions_v1 aplicada.')
