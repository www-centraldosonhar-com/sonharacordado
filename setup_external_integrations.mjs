import { neon } from '@neondatabase/serverless'
import process from 'node:process'

const sql = neon(process.env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS external_integrations (
    id SERIAL PRIMARY KEY,

    provider VARCHAR(80) NOT NULL,
    integration_key VARCHAR(120) NOT NULL,

    refresh_token TEXT,
    access_token TEXT,
    access_token_expires_at TIMESTAMP,

    account_email TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    active INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(provider, integration_key)
  )
`

console.log('✅ external_integrations pronta.')
