import fs from 'node:fs/promises'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada.')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const migrationUrl = new URL(
  './migrations/015_dreamer_contributions_pix_receipts_v1.sql',
  import.meta.url,
)

const contents = await fs.readFile(migrationUrl, 'utf8')
const statements = contents
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

try {
  console.log('Aplicando migration 015_dreamer_contributions_pix_receipts_v1...')

  for (const statement of statements) {
    await sql.query(statement)
  }

  console.log('✅ Migration 015_dreamer_contributions_pix_receipts_v1 aplicada.')
} catch (error) {
  console.error(
    '❌ Falha ao aplicar migration 015_dreamer_contributions_pix_receipts_v1:',
    error,
  )
  process.exit(1)
}
