import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const events = await sql`
  SELECT
    id,
    name,
    project_id,
    event_type,
    event_date
  FROM events
  WHERE name = 'Testando Atividades 1'
  ORDER BY id DESC
  LIMIT 1
`

if (!events[0]) {
  throw new Error(
    'Evento Testando Atividades 1 não encontrado.'
  )
}

console.log('\n===== EVENTO =====')
console.table(events)

const activities = await sql`
  SELECT
    er.id AS event_role_id,
    r.name AS activity_name,
    t.code AS team_code,
    er.vacancy_limit,
    er.requires_delivery,
    er.community_visible,
    r.allows_checklist,
    er.active

  FROM event_roles er

  JOIN roles r
    ON r.id = er.role_id

  JOIN teams t
    ON t.id = er.team_id

  WHERE er.event_id = ${events[0].id}

  ORDER BY
    t.code,
    r.name
`

console.log('\n===== ATIVIDADES =====')
console.table(activities)

console.log(
  '\nTOTAL:',
  activities.length
)
