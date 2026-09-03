import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

const EVENT_ID = 35

const TEST_USERS = [
  {
    id: 5,
    label: 'Bruna',
    team: 'volunteers',
  },
  {
    id: 7,
    label: 'Beatriz Garcia',
    team: 'assisted',
  },
  {
    id: 6,
    label: 'Rodrigo',
    team: 'media',
  },
]

// =========================================================
// EVENTO
// =========================================================

const events = await sql`
  SELECT
    id,
    name,
    project_id,
    event_type,
    event_status
  FROM events
  WHERE id = ${EVENT_ID}
  LIMIT 1
`

if (!events[0]) {
  throw new Error(
    'Evento 35 não encontrado.'
  )
}

console.log('\n===== EVENTO =====')
console.table(events)

// =========================================================
// GARANTE INSCRIÇÕES CONFIRMADAS
// =========================================================

for (const item of TEST_USERS) {
  const users = await sql`
    SELECT
      id,
      name,
      email
    FROM users
    WHERE
      id = ${item.id}
      AND active = 1
    LIMIT 1
  `

  const user =
    users[0]

  if (!user) {
    throw new Error(
      `Usuário não encontrado: ${item.label}`
    )
  }

  const email =
    user.email ||
    `teste-${item.id}@central.local`

  const existing = await sql`
    SELECT id
    FROM event_registrations
    WHERE
      event_id = ${EVENT_ID}
      AND user_id = ${item.id}
    LIMIT 1
  `

  if (existing[0]) {
    await sql`
      UPDATE event_registrations
      SET
        status = 'confirmed',
        team = ${item.team},
        email = ${email},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${existing[0].id}
    `
  } else {
    await sql`
      INSERT INTO event_registrations (
        event_id,
        user_id,
        email,
        team,
        status
      )
      VALUES (
        ${EVENT_ID},
        ${item.id},
        ${email},
        ${item.team},
        'confirmed'
      )
    `
  }

  console.log(
    `✅ ${user.name} inscrito(a) como ${item.team}`
  )
}

// =========================================================
// RESULTADO
// =========================================================

console.log(
  '\n===== INSCRIÇÕES CRIADAS ====='
)

console.table(
  await sql`
    SELECT
      er.id,
      er.user_id,
      u.name,
      p.name AS project_name,
      er.team,
      er.status

    FROM event_registrations er

    JOIN users u
      ON u.id = er.user_id

    LEFT JOIN projects p
      ON p.id = u.project_id

    WHERE er.event_id = ${EVENT_ID}

    ORDER BY u.name
  `
)

console.log('')
console.log(
  '🎯 Cenário de acesso preparado.'
)
