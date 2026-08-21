import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL não encontrada.')
}

const sql = neon(databaseUrl)

await sql`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS birth_date DATE
`

await sql`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allergies TEXT
`

console.log('✅ users.birth_date criado.')
console.log('✅ users.allergies criado.')
