import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== EVENTO TESTE =====')

console.table(
  await sql`
    SELECT
      id,
      name,
      project_id,
      event_type,
      event_status,
      active
    FROM events
    WHERE id = 31
  `
)

console.log('\n===== FUNCOES DO EVENTO =====')

console.table(
  await sql`
    SELECT
      er.id AS event_role_id,
      r.name AS role_name,
      t.code AS team_code,
      t.name AS team_name
    FROM event_roles er
    JOIN roles r
      ON r.id = er.role_id
    LEFT JOIN teams t
      ON t.id = r.team_id
    WHERE er.event_id = 31
    ORDER BY er.id
  `
)

console.log('\n===== USUARIOS ATIVOS PARA TESTE =====')

console.table(
  await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      p.name AS project_name
    FROM users u
    LEFT JOIN projects p
      ON p.id = u.project_id
    WHERE u.active = 1
    ORDER BY u.id
    LIMIT 30
  `
)

console.log('\n===== INSCRICOES EXISTENTES NO EVENTO 31 =====')

console.table(
  await sql`
    SELECT
      er.id,
      er.user_id,
      u.name,
      er.team,
      er.status
    FROM event_registrations er
    JOIN users u
      ON u.id = er.user_id
    WHERE er.event_id = 31
    ORDER BY er.id
  `
)

console.log('\n===== AVALIACOES EXISTENTES =====')

console.table(
  await sql`
    SELECT
      pf.user_id,
      u.name,
      pf.rating,
      pf.comment
    FROM post_event_feedback pf
    JOIN users u
      ON u.id = pf.user_id
    WHERE pf.event_id = 31
  `
)
