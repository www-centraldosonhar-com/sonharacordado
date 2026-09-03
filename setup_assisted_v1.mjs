import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

// =========================================================
// ASSISTED PEOPLE V1
// =========================================================
//
// Cadastro-base permanente dos Assistidos.
//
// A participação em um evento será tratada depois por uma
// tabela separada. Portanto:
//
// assisted_people
//   = quem é a pessoa
//
// futura assisted_event_registrations
//   = em qual evento ela participará
//
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS assisted_people (
    id BIGSERIAL PRIMARY KEY,

    full_name TEXT NOT NULL,

    birth_date DATE,

    allergies TEXT NOT NULL
      DEFAULT '',

    notes TEXT NOT NULL
      DEFAULT '',

    guardian_name TEXT NOT NULL,

    guardian_phone TEXT NOT NULL,

    project_id INTEGER NOT NULL
      REFERENCES projects(id),

    active INTEGER NOT NULL
      DEFAULT 1,

    created_by INTEGER
      REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
      DEFAULT CURRENT_TIMESTAMP
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_assisted_people_project

  ON assisted_people (
    project_id
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_assisted_people_active

  ON assisted_people (
    active
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_assisted_people_name

  ON assisted_people (
    LOWER(full_name)
  )
`

console.log(
  '✅ Tabela assisted_people configurada.'
)

const columns = await sql`
  SELECT
    column_name,
    data_type,
    is_nullable

  FROM information_schema.columns

  WHERE table_name =
    'assisted_people'

  ORDER BY ordinal_position
`

console.table(columns)
