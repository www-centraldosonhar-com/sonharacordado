import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const eventRows = await sql`
  SELECT
    id,
    name,
    project_id,
    event_type,
    event_date
  FROM events
  WHERE name = 'Testando Atividades 2'
  ORDER BY id DESC
  LIMIT 1
`

if (!eventRows[0]) {
  throw new Error(
    'Evento Testando Atividades 2 não encontrado.'
  )
}

const event = eventRows[0]

console.log('\n===== EVENTO =====')
console.table(eventRows)

console.log('\n===== ATIVIDADES =====')

console.table(
  await sql`
    SELECT
      er.id AS event_role_id,
      r.name AS activity_name,
      t.code AS team_code,
      er.community_visible,
      er.vacancy_limit
    FROM event_roles er
    JOIN roles r
      ON r.id = er.role_id
    JOIN teams t
      ON t.id = er.team_id
    WHERE er.event_id = ${event.id}
    ORDER BY t.code, r.name
  `
)

console.log('\n===== USUÁRIOS + EQUIPES =====')

console.table(
  await sql`
    SELECT
      u.id,
      u.name,
      p.name AS project_name,
      t.code AS team_code,
      t.name AS team_name,
      ut.active AS team_active
    FROM users u
    LEFT JOIN projects p
      ON p.id = u.project_id
    LEFT JOIN user_teams ut
      ON ut.user_id = u.id
    LEFT JOIN teams t
      ON t.id = ut.team_id
    WHERE u.active = 1
    ORDER BY
      p.name,
      u.name,
      t.code
    LIMIT 120
  `
)

console.log('\n===== INSCRIÇÕES NO EVENTO =====')

console.table(
  await sql`
    SELECT
      registration.id,
      registration.user_id,
      u.name,
      p.name AS project_name,
      registration.team,
      registration.status
    FROM event_registrations registration
    JOIN users u
      ON u.id = registration.user_id
    LEFT JOIN projects p
      ON p.id = u.project_id
    WHERE registration.event_id = ${event.id}
    ORDER BY u.name
  `
)

console.log('\n===== CONFIRMAÇÕES DE ATIVIDADES =====')

console.table(
  await sql`
    SELECT
      c.id,
      c.user_id,
      u.name,
      r.name AS activity_name,
      t.code AS team_code,
      c.status
    FROM confirmations c
    JOIN users u
      ON u.id = c.user_id
    JOIN event_roles er
      ON er.id = c.event_role_id
    JOIN roles r
      ON r.id = er.role_id
    JOIN teams t
      ON t.id = er.team_id
    WHERE er.event_id = ${event.id}
    ORDER BY u.name, r.name
  `
)
