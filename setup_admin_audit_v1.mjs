import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// ADMIN AUDIT LOG V1
// =========================================================
// Histórico de ações administrativas.
//
// A tabela é append-only pela aplicação:
// criamos registros, mas não teremos função de editar
// ou apagar logs pelo painel administrativo.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id SERIAL PRIMARY KEY,

    actor_user_id INTEGER NOT NULL
      REFERENCES users(id)
      ON DELETE RESTRICT,

    action TEXT NOT NULL,

    entity_type TEXT NOT NULL,

    entity_id INTEGER,

    project_id INTEGER
      REFERENCES projects(id)
      ON DELETE SET NULL,

    event_id INTEGER
      REFERENCES events(id)
      ON DELETE SET NULL,

    details JSONB NOT NULL
      DEFAULT '{}'::jsonb,

    created_at TIMESTAMP
      WITHOUT TIME ZONE
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_admin_audit_project
  ON admin_audit_logs(project_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_admin_audit_event
  ON admin_audit_logs(event_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_admin_audit_actor
  ON admin_audit_logs(actor_user_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_admin_audit_created
  ON admin_audit_logs(created_at DESC)
`

console.log('')
console.log('✅ Admin Audit Log V1 pronto!')
console.log('')

console.table(
  await sql`
    SELECT
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name =
      'admin_audit_logs'
    ORDER BY ordinal_position
  `
)
