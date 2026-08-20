import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

console.log(
  '🚨 Criando solicitações financeiras...'
)

await sql`
  CREATE TABLE IF NOT EXISTS
    finance_requests (
      id SERIAL PRIMARY KEY,

      project_id INTEGER
        NOT NULL
        REFERENCES projects(id)
        ON DELETE RESTRICT,

      event_id INTEGER
        REFERENCES events(id)
        ON DELETE SET NULL,

      created_by INTEGER
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

      subject TEXT NOT NULL,

      message TEXT NOT NULL,

      priority TEXT
        NOT NULL
        DEFAULT 'normal',

      response_deadline TIMESTAMP,

      status TEXT
        NOT NULL
        DEFAULT 'pending',

      response_text TEXT,

      responded_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

      responded_at TIMESTAMP,

      resolved_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

      resolved_at TIMESTAMP,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      CHECK (
        priority IN (
          'normal',
          'urgent'
        )
      ),

      CHECK (
        status IN (
          'pending',
          'answered',
          'resolved'
        )
      )
    )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_finance_requests_project
  ON finance_requests(project_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_finance_requests_event
  ON finance_requests(event_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_finance_requests_status
  ON finance_requests(status)
`

console.log('')
console.log(
  '✅ finance_requests criada!'
)

console.log('')
console.log(
  'Fluxo: pending → answered → resolved'
)
