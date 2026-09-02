import process from 'node:process'
import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida.')

const sql = neon(process.env.DATABASE_URL)
const migration = await readFile(new URL('./migrations/016_dreamer_stories_v1.sql', import.meta.url), 'utf8')
for (const statement of migration.split(';').map(value => value.trim()).filter(Boolean)) {
  await sql.query(statement)
}
console.log('dreamer_stories_v1: OK')
