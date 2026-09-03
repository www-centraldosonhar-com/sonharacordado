import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

const TEST_NAME =
  'Teste Motor de Atividades 2026'

// =========================================================
// 1. REMOVE EVENTO DE TESTE ANTERIOR, SE EXISTIR
// =========================================================

const oldEvents = await sql`
  SELECT id
  FROM events
  WHERE name = ${TEST_NAME}
`

for (const event of oldEvents) {
  const eventId =
    Number(event.id)

  await sql`
    DELETE FROM activity_checklist_items
    WHERE checklist_id IN (
      SELECT ac.id
      FROM activity_checklists ac
      JOIN event_roles er
        ON er.id = ac.event_role_id
      WHERE er.event_id = ${eventId}
    )
  `

  await sql`
    DELETE FROM activity_checklists
    WHERE event_role_id IN (
      SELECT id
      FROM event_roles
      WHERE event_id = ${eventId}
    )
  `

  await sql`
    DELETE FROM confirmations
    WHERE event_role_id IN (
      SELECT id
      FROM event_roles
      WHERE event_id = ${eventId}
    )
  `

  await sql`
    DELETE FROM event_roles
    WHERE event_id = ${eventId}
  `

  await sql`
    DELETE FROM event_registrations
    WHERE event_id = ${eventId}
  `

  await sql`
    DELETE FROM events
    WHERE id = ${eventId}
  `
}

console.log(
  '✅ Evento de teste anterior removido.'
)

// =========================================================
// 2. PEGA UM PROJETO REAL PARA O TESTE
// =========================================================

const projects = await sql`
  SELECT
    id,
    name
  FROM projects
  ORDER BY id
  LIMIT 1
`

const project =
  projects[0]

if (!project) {
  throw new Error(
    'Nenhum projeto ativo encontrado.'
  )
}

// =========================================================
// 3. CRIA EVENTO FUTURO/ATIVO
// =========================================================

const created = await sql`
  INSERT INTO events (
    name,
    project_id,
    event_type,
    event_status,
    event_date,
    event_time,
    location,
    confirmation_deadline,
    registrations_open,
    active
  )

  VALUES (
    ${TEST_NAME},
    ${project.id},
    'specific',
    'upcoming',
    CURRENT_DATE + INTERVAL '7 days',
    '09:00',
    'Local de Teste',
    CURRENT_TIMESTAMP + INTERVAL '6 days',
    1,
    1
  )

  RETURNING
    id,
    name,
    project_id,
    event_status,
    event_date,
    registrations_open,
    active
`

const event =
  created[0]

console.log('')
console.log('===== EVENTO CRIADO =====')
console.table(created)

// =========================================================
// 4. BUSCA AS 5 ATIVIDADES CRIADAS AUTOMATICAMENTE
// =========================================================

const activities = await sql`
  SELECT
    er.id AS event_role_id,
    r.name AS activity_name,
    t.code AS team_code,
    t.name AS team_name,
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

  WHERE er.event_id = ${event.id}

  ORDER BY
    t.code,
    r.name
`

console.log('')
console.log('===== ATIVIDADES DO EVENTO =====')
console.table(activities)

// =========================================================
// 5. VALIDA REGRAS ESPERADAS
// =========================================================

const expected = {
  'Fotógrafo(a)': {
    team: 'media',
    checklist: 0,
    delivery: 1,
    community: true,
  },

  'Storymaker': {
    team: 'media',
    checklist: 0,
    delivery: 1,
    community: true,
  },

  'Recepção / Check-in de Voluntários': {
    team: 'volunteers',
    checklist: 1,
    delivery: 0,
    community: false,
  },

  'Recepção / Check-in de Assistidos': {
    team: 'assisted',
    checklist: 1,
    delivery: 0,
    community: false,
  },

  'Despedida / Check-out de Assistidos': {
    team: 'assisted',
    checklist: 1,
    delivery: 0,
    community: false,
  },
}

let ok = true

for (
  const [
    name,
    rule,
  ] of Object.entries(expected)
) {
  const row =
    activities.find(
      item =>
        item.activity_name === name
    )

  if (!row) {
    console.error(
      `❌ Atividade ausente: ${name}`
    )

    ok = false
    continue
  }

  const checklist =
    Number(
      row.allows_checklist
    )

  const delivery =
    Number(
      row.requires_delivery
    )

  const community =
    Boolean(
      row.community_visible
    )

  if (
    row.team_code !== rule.team ||
    checklist !== rule.checklist ||
    delivery !== rule.delivery ||
    community !== rule.community
  ) {
    console.error(
      `❌ Regra incorreta: ${name}`
    )

    console.log({
      esperado:
        rule,

      recebido: {
        team:
          row.team_code,

        checklist,

        delivery,

        community,
      },
    })

    ok = false
  }
}

if (
  activities.filter(
    item =>
      expected[
        item.activity_name
      ]
  ).length !== 5
) {
  console.error(
    '❌ O evento não possui exatamente as 5 atividades oficiais.'
  )

  ok = false
}

console.log('')
console.log(
  ok
    ? '🎯 CENÁRIO PERFEITO: as 5 atividades oficiais estão corretas.'
    : '⚠️ CENÁRIO CRIADO, MAS EXISTEM REGRAS PARA CORRIGIR.'
)

console.log('')
console.log(
  `EVENT_ID=${event.id}`
)
