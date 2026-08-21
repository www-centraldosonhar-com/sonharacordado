import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL não encontrada.')
}

const sql = neon(databaseUrl)

await sql`
  CREATE TABLE IF NOT EXISTS community_monthly_settings (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    word VARCHAR(120) NOT NULL,
    message TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (year, month)
  )
`

console.log('✅ community_monthly_settings pronta.')
