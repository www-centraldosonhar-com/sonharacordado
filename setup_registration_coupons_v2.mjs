import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

// =========================================================
// REGISTRATION COUPONS V2
// =========================================================
//
// project_id:
// - NULL = cupom global / legado;
// - preenchido = cupom exclusivo daquele projeto.
//
// Admin Geral pode administrar todos.
// Admin de Projeto administra apenas os seus.
// =========================================================

await sql`
  ALTER TABLE registration_coupons
  ADD COLUMN IF NOT EXISTS
    project_id INTEGER
`

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname =
        'registration_coupons_project_id_fkey'
    ) THEN
      ALTER TABLE registration_coupons
      ADD CONSTRAINT
        registration_coupons_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE RESTRICT;
    END IF;
  END
  $$;
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_registration_coupons_project
  ON registration_coupons(project_id)
`

console.log(
  '✅ Registration Coupons V2 ready!'
)

console.log(
  '• cupons agora podem pertencer a um projeto'
)

console.log(
  '• cupons antigos continuam globais'
)
