import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('🔎 Localizando projeto PPF...')

const projectRows = await sql`
  SELECT
    id,
    name
  FROM projects
  WHERE
    UPPER(name) = 'PPF'
    OR UPPER(name) LIKE '%PREPARANDO%'
  ORDER BY id
  LIMIT 1
`

if (!projectRows[0]) {
  throw new Error(
    'Projeto PPF não encontrado.'
  )
}

const projectId =
  Number(projectRows[0].id)

const eventName =
  'Teste Pós-Evento 2026'


// =========================================================
// PROCURA EVENTO EXISTENTE
// =========================================================

const existingRows = await sql`
  SELECT
    id
  FROM events
  WHERE
    name = ${eventName}
  ORDER BY id DESC
  LIMIT 1
`

let eventId


// =========================================================
// CRIA OU ATUALIZA
// =========================================================

if (existingRows[0]) {
  eventId =
    Number(existingRows[0].id)

  await sql`
    UPDATE events
    SET
      project_id =
        ${projectId},

      event_date =
        CURRENT_DATE,

      event_time =
        '09:00:00',

      location =
        'Local de Teste',

      confirmation_deadline =
        CURRENT_TIMESTAMP,

      event_type =
        'specific',

      active =
        1,

      registrations_open =
        1,

      event_status =
        'post_event',

      post_event_opened_at =
        CURRENT_TIMESTAMP

    WHERE id =
      ${eventId}
  `

  console.log(
    `✅ Evento existente atualizado. ID: ${eventId}`
  )
} else {
  const insertedRows = await sql`
    INSERT INTO events (
      name,
      project_id,
      event_date,
      event_time,
      location,
      confirmation_deadline,
      event_type,
      active,
      registrations_open,
      event_status,
      post_event_opened_at
    )

    VALUES (
      ${eventName},
      ${projectId},
      CURRENT_DATE,
      '09:00:00',
      'Local de Teste',
      CURRENT_TIMESTAMP,
      'specific',
      1,
      1,
      'post_event',
      CURRENT_TIMESTAMP
    )

    RETURNING id
  `

  eventId =
    Number(
      insertedRows[0].id
    )

  console.log(
    `✅ Evento criado. ID: ${eventId}`
  )
}


// =========================================================
// CONFERÊNCIA
// =========================================================

const checkRows = await sql`
  SELECT
    event.id,
    event.name,
    project.name
      AS project_name,
    event.event_date,
    event.event_time,
    event.location,
    event.confirmation_deadline,
    event.event_type,
    event.active,
    event.registrations_open,
    event.event_status,
    event.post_event_opened_at

  FROM events event

  LEFT JOIN projects project
    ON project.id =
      event.project_id

  WHERE event.id =
    ${eventId}
`

console.log('')
console.log('===== EVENTO DE TESTE =====')
console.table(checkRows)

console.log('')
console.log(
  '🔥 O evento agora existe no banco.'
)
