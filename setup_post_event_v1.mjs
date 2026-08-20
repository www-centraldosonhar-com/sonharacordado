import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('🚀 Criando estrutura Pós-Evento V1...')


// =========================================================
// 1. EVENTS — STATUS DO CICLO
// =========================================================

await sql`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS
    event_status TEXT
`

await sql`
  UPDATE events
  SET event_status = 'scheduled'
  WHERE event_status IS NULL
`

await sql`
  ALTER TABLE events
  ALTER COLUMN event_status
  SET DEFAULT 'scheduled'
`

await sql`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS
    post_event_opened_at TIMESTAMP
`

await sql`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS
    post_event_closed_at TIMESTAMP
`


// =========================================================
// 2. POST EVENT CLOSURES
// =========================================================
//
// Guarda o fechamento final consolidado.
//
// Enquanto o Pós-Evento estiver aberto,
// os valores continuam sendo calculados
// diretamente das tabelas reais.
//
// Quando o evento for fechado definitivamente,
// salvamos o snapshot aqui.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS post_event_closures (
    id SERIAL PRIMARY KEY,

    event_id INTEGER
      NOT NULL UNIQUE
      REFERENCES events(id)
      ON DELETE CASCADE,

    status TEXT
      NOT NULL DEFAULT 'open',

    final_notes TEXT,

    registered_count INTEGER
      NOT NULL DEFAULT 0,

    present_count INTEGER
      NOT NULL DEFAULT 0,

    absent_count INTEGER
      NOT NULL DEFAULT 0,

    paid_registration_count INTEGER
      NOT NULL DEFAULT 0,

    free_registration_count INTEGER
      NOT NULL DEFAULT 0,

    collected_amount NUMERIC(12, 2)
      NOT NULL DEFAULT 0,

    expenses_amount NUMERIC(12, 2)
      NOT NULL DEFAULT 0,

    balance_amount NUMERIC(12, 2)
      NOT NULL DEFAULT 0,

    finance_validated INTEGER
      NOT NULL DEFAULT 0,

    finance_validated_by INTEGER
      REFERENCES users(id)
      ON DELETE SET NULL,

    finance_validated_at TIMESTAMP,

    opened_by INTEGER
      REFERENCES users(id)
      ON DELETE SET NULL,

    closed_by INTEGER
      REFERENCES users(id)
      ON DELETE SET NULL,

    opened_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    closed_at TIMESTAMP,

    updated_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
      status IN (
        'open',
        'review',
        'closed'
      )
    ),

    CHECK (
      finance_validated IN (
        0,
        1
      )
    )
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_post_event_closures_event
  ON post_event_closures(event_id)
`


// =========================================================
// 3. POST EVENT TEAM REPORTS
// =========================================================
//
// Cada equipe registra seu fechamento.
// Não duplica gastos, missões ou atividades.
// Guarda apenas análise e observações.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS post_event_team_reports (
    id SERIAL PRIMARY KEY,

    event_id INTEGER
      NOT NULL
      REFERENCES events(id)
      ON DELETE CASCADE,

    team_id INTEGER
      NOT NULL
      REFERENCES teams(id)
      ON DELETE CASCADE,

    summary TEXT,

    what_worked TEXT,

    what_to_improve TEXT,

    next_event_notes TEXT,

    status TEXT
      NOT NULL DEFAULT 'pending',

    submitted_by INTEGER
      REFERENCES users(id)
      ON DELETE SET NULL,

    submitted_at TIMESTAMP,

    created_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
      event_id,
      team_id
    ),

    CHECK (
      status IN (
        'pending',
        'submitted',
        'approved'
      )
    )
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_post_event_team_reports_event
  ON post_event_team_reports(event_id)
`


// =========================================================
// 4. POST EVENT FEEDBACK
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS post_event_feedback (
    id SERIAL PRIMARY KEY,

    event_id INTEGER
      NOT NULL
      REFERENCES events(id)
      ON DELETE CASCADE,

    user_id INTEGER
      NOT NULL
      REFERENCES users(id)
      ON DELETE CASCADE,

    rating INTEGER
      NOT NULL,

    comment TEXT,

    created_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
      event_id,
      user_id
    ),

    CHECK (
      rating BETWEEN 1 AND 5
    )
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_post_event_feedback_event
  ON post_event_feedback(event_id)
`


// =========================================================
// 5. VALIDAÇÃO FINAL
// =========================================================

console.log('')
console.log('✅ Pós-Evento V1 criado!')
console.log('')
console.log('• events.event_status')
console.log('• post_event_closures')
console.log('• post_event_team_reports')
console.log('• post_event_feedback')
console.log('')
console.log('Estados previstos:')
console.log('scheduled → post_event → closed')

