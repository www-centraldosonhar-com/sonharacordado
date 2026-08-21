import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL não encontrada.')
}

const sql = neon(databaseUrl)

await sql`
  ALTER TABLE event_roles
  ADD COLUMN IF NOT EXISTS
    community_visible BOOLEAN NOT NULL DEFAULT FALSE
`

console.log('✅ event_roles.community_visible criado.')
