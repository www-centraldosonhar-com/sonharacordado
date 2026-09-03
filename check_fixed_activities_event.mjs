import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

const EVENT_NAME =
  'Testando Atividades 2'

const events = await sql`
  SELECT
    id,
    name,
    project_id,
    event_type,
    event_date

  FROM events

  WHERE name =
    ${EVENT_NAME}

  ORDER BY id DESC
  LIMIT 1
`

if (!events[0]) {
  throw new Error(
    `Evento não encontrado: ${EVENT_NAME}`
  )
}

const event =
  events[0]

console.log('\n===== EVENTO =====')
console.table(events)

const activities = await sql`
  SELECT
    er.id
      AS event_role_id,

    r.name
      AS activity_name,

    t.code
      AS team_code,

    er.vacancy_limit,
    er.requires_delivery,
    er.community_visible,

    r.allows_checklist,

    er.active

  FROM event_roles er

  JOIN roles r
    ON r.id =
      er.role_id

  JOIN teams t
    ON t.id =
      er.team_id

  WHERE er.event_id =
    ${event.id}

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

const expected = [
  'Fotógrafo(a)',
  'Storymaker',
  'Recepção / Check-in de Voluntários',
  'Recepção / Check-in de Assistidos',
  'Despedida / Check-out de Assistidos',
]

const names =
  activities.map(
    item =>
      item.activity_name
  )

const missing =
  expected.filter(
    name =>
      !names.includes(name)
  )

if (
  activities.length === 5 &&
  missing.length === 0
) {
  console.log(
    '\n🎯 PERFEITO: as 5 atividades nasceram automaticamente.'
  )
} else {
  console.log(
    '\n❌ FALTANDO:',
    missing
  )
}
