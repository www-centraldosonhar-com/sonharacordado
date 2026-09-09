import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL

if (!databaseUrl) {
  console.error('❌ URL do banco não encontrada.')
  process.exit(1)
}

const sql = neon(databaseUrl)

// =========================================================
// ACTIVITY CHECKLIST ASSIGNEES V1
// =========================================================
// Permite múltiplos operadores na MESMA checklist.
// O assigned_user_id antigo permanece como responsável
// principal por compatibilidade com o código legado.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS
    activity_checklist_assignees (
      checklist_id INTEGER NOT NULL
        REFERENCES activity_checklists(id)
        ON DELETE CASCADE,

      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      created_at TIMESTAMP
        WITHOUT TIME ZONE
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (checklist_id, user_id)
    )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_activity_checklist_assignees_user
  ON activity_checklist_assignees(user_id)
`

await sql`
  INSERT INTO activity_checklist_assignees (
    checklist_id,
    user_id
  )
  SELECT
    id,
    assigned_user_id
  FROM activity_checklists
  WHERE assigned_user_id IS NOT NULL
  ON CONFLICT (checklist_id, user_id)
  DO NOTHING
`

console.log('')
console.log('✅ Múltiplos responsáveis de checklist prontos!')
console.log('')

console.table(
  await sql`
    SELECT
      ac.id AS checklist_id,
      ac.title,
      COUNT(aca.user_id)::int AS responsaveis
    FROM activity_checklists ac
    LEFT JOIN activity_checklist_assignees aca
      ON aca.checklist_id = ac.id
    WHERE ac.active = 1
    GROUP BY ac.id, ac.title
    ORDER BY ac.id
  `
)
