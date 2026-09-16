import fs from 'node:fs/promises'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada.')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

const migrationUrl = new URL(
  './migrations/017_dreamer_historical_events.sql',
  import.meta.url,
)

const contents = await fs.readFile(migrationUrl, 'utf8')

const statements = contents
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

try {
  console.log('Aplicando migration 017_dreamer_historical_events...')

  for (const statement of statements) {
    await sql.query(statement)
  }

  console.log('✅ Migration 017 aplicada.')

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'dreamer_historical_events',
        'dreamer_historical_event_projects',
        'dreamer_historical_attendance'
      )
    ORDER BY table_name
  `

  console.log('')
  console.log('===== TABELAS CRIADAS =====')

  for (const table of tables) {
    console.log(`✓ ${table.table_name}`)
  }

  if (tables.length !== 3) {
    throw new Error(
      `Esperávamos 3 tabelas históricas, mas encontramos ${tables.length}.`
    )
  }

  console.log('')
  console.log('🏆 Estrutura de eventos históricos pronta.')
} catch (error) {
  console.error(
    '❌ Falha ao aplicar migration 017_dreamer_historical_events:',
    error,
  )
  process.exit(1)
}
