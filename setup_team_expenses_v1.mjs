import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

// =========================================================
// TEAM EXPENSES V1
// =========================================================
//
// Cada lançamento pertence obrigatoriamente a:
// - um evento;
// - uma equipe;
// - um usuário que fez o lançamento.
//
// O comprovante fica no Supabase Storage privado.
// O banco guarda somente o caminho do arquivo.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS team_expenses (
    id SERIAL PRIMARY KEY,

    event_id INTEGER NOT NULL
      REFERENCES events(id)
      ON DELETE CASCADE,

    team_id INTEGER NOT NULL
      REFERENCES teams(id),

    description TEXT NOT NULL,

    amount NUMERIC(12, 2) NOT NULL,

    receipt_path TEXT,

    created_by INTEGER NOT NULL
      REFERENCES users(id),

    active INTEGER NOT NULL
      DEFAULT 1,

    created_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CHECK (amount >= 0)
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_team_expenses_event
  ON team_expenses(event_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_team_expenses_team
  ON team_expenses(team_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_team_expenses_created_by
  ON team_expenses(created_by)
`

console.log(
  '✅ Team Expenses V1 ready!'
)

console.log(
  '• team_expenses'
)
