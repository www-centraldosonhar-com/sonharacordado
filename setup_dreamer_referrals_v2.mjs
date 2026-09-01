import process from 'node:process'
import fs from 'node:fs'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const migration = fs.readFileSync('./migrations/010_dreamer_referrals_v2.sql', 'utf8')
const statements = migration.split(';').map(item => item.trim()).filter(Boolean)

for (const statement of statements) {
  await sql.query(statement)
}

console.log('✅ Migration 010_dreamer_referrals_v2 aplicada.')
process.exit(0)
