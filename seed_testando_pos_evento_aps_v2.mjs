import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const EVENT_NAME = 'Testando Pos Evento - APS'

if (process.env.CONFIRM_TEST_SCENARIO !== 'YES') {
  console.error('❌ Confirmação ausente.')
  console.error('Use: CONFIRM_TEST_SCENARIO=YES node --env-file=.env.local seed_testando_pos_evento_aps_v2.mjs')
  process.exit(1)
}

async function cleanupEvent(eventId) {
  await sql`
    DELETE FROM activity_checklist_items
    WHERE checklist_id IN (
      SELECT ac.id
      FROM activity_checklists ac
      JOIN event_roles er ON er.id = ac.event_role_id
      WHERE er.event_id = ${eventId}
    )
  `

  await sql`
    DELETE FROM activity_checklists
    WHERE event_role_id IN (
      SELECT id FROM event_roles
      WHERE event_id = ${eventId}
    )
  `

  await sql`
    DELETE FROM confirmations
    WHERE event_role_id IN (
      SELECT id FROM event_roles
      WHERE event_id = ${eventId}
    )
  `

  await sql`DELETE FROM media_content_deliveries WHERE event_id = ${eventId}`
  await sql`DELETE FROM post_event_answers WHERE event_id = ${eventId}`
  await sql`DELETE FROM post_event_questions WHERE event_id = ${eventId}`
  await sql`DELETE FROM post_event_team_reports WHERE event_id = ${eventId}`
  await sql`DELETE FROM team_expenses WHERE event_id = ${eventId}`
  await sql`DELETE FROM post_event_feedback WHERE event_id = ${eventId}`
  await sql`DELETE FROM post_event_closures WHERE event_id = ${eventId}`
  await sql`DELETE FROM dreamer_attendance_events WHERE event_id = ${eventId}`
  await sql`DELETE FROM event_registrations WHERE event_id = ${eventId}`
  await sql`DELETE FROM tasks WHERE event_id = ${eventId}`
  await sql`DELETE FROM event_roles WHERE event_id = ${eventId}`
  await sql`DELETE FROM events WHERE id = ${eventId}`
}

async function ensureConfirmation(userId, eventRoleId) {
  const existing = await sql`
    SELECT id
    FROM confirmations
    WHERE user_id = ${userId}
      AND event_role_id = ${eventRoleId}
    LIMIT 1
  `

  if (existing[0]) {
    await sql`
      UPDATE confirmations
      SET
        status = 'confirmed',
        cancellation_reason = NULL,
        completed_at = NULL,
        delivery_review_status = NULL,
        delivery_review_note = NULL,
        delivery_reviewed_at = NULL
      WHERE id = ${existing[0].id}
    `
    return Number(existing[0].id)
  }

  const inserted = await sql`
    INSERT INTO confirmations (
      user_id,
      event_role_id,
      status
    )
    VALUES (
      ${userId},
      ${eventRoleId},
      'confirmed'
    )
    RETURNING id
  `

  return Number(inserted[0].id)
}

console.log(`🧪 Preparando cenário: ${EVENT_NAME}`)

const projectRows = await sql`
  SELECT id, name
  FROM projects
  WHERE
    UPPER(name) = 'APS'
    OR UPPER(name) LIKE '%AMIGOS PARA SEMPRE%'
  ORDER BY id
  LIMIT 1
`

const project = projectRows[0]

if (!project) {
  throw new Error('Projeto APS não encontrado.')
}

const projectId = Number(project.id)

const oldEvents = await sql`
  SELECT id
  FROM events
  WHERE name = ${EVENT_NAME}
  ORDER BY id
`

for (const old of oldEvents) {
  console.log(`🧹 Removendo cenário anterior ID ${old.id}...`)
  await cleanupEvent(Number(old.id))
}

const officialRoleNames = [
  'Fotógrafo(a)',
  'Storymaker',
  'Recepção / Check-in de Voluntários',
  'Recepção / Check-in de Assistidos',
  'Despedida / Check-out de Assistidos',
]

const teams = await sql`
  SELECT id, code, name
  FROM teams
  WHERE active = 1
  ORDER BY id
`

const teamByCode = Object.fromEntries(
  teams.map(team => [team.code, team])
)

for (const code of ['media', 'volunteers', 'assisted']) {
  if (!teamByCode[code]) {
    throw new Error(`Equipe obrigatória ausente: ${code}`)
  }
}

const roles = await sql`
  SELECT id, name, team_id, allows_checklist
  FROM roles
  WHERE name = ANY(${officialRoleNames})
`

const roleByName = Object.fromEntries(
  roles.map(role => [role.name, role])
)

for (const name of officialRoleNames) {
  if (!roleByName[name]) {
    throw new Error(`Role oficial ausente: ${name}`)
  }
}

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
    registration_fee,
    registration_deadline,
    registrations_open,
    active
  )
  VALUES (
    ${EVENT_NAME},
    ${projectId},
    'specific',
    'scheduled',
    CURRENT_DATE,
    '09:00',
    'Cenário de Teste — APS',
    CURRENT_TIMESTAMP + INTERVAL '12 hours',
    0,
    CURRENT_TIMESTAMP + INTERVAL '12 hours',
    1,
    1
  )
  RETURNING id
`

const eventId = Number(created[0].id)

const fixedActivities = [
  {
    name: 'Fotógrafo(a)',
    teamCode: 'media',
    vacancyLimit: 3,
    requiresDelivery: 1,
    communityVisible: true,
  },
  {
    name: 'Storymaker',
    teamCode: 'media',
    vacancyLimit: 2,
    requiresDelivery: 1,
    communityVisible: true,
  },
  {
    name: 'Recepção / Check-in de Voluntários',
    teamCode: 'volunteers',
    vacancyLimit: 3,
    requiresDelivery: 0,
    communityVisible: false,
  },
  {
    name: 'Recepção / Check-in de Assistidos',
    teamCode: 'assisted',
    vacancyLimit: 3,
    requiresDelivery: 0,
    communityVisible: false,
  },
  {
    name: 'Despedida / Check-out de Assistidos',
    teamCode: 'assisted',
    vacancyLimit: 3,
    requiresDelivery: 0,
    communityVisible: false,
  },
]

const eventRoleByName = {}

for (const activity of fixedActivities) {
  const role = roleByName[activity.name]
  const team = teamByCode[activity.teamCode]

  const inserted = await sql`
    INSERT INTO event_roles (
      event_id,
      role_id,
      team_id,
      vacancy_limit,
      requires_delivery,
      delivery_deadline,
      community_visible,
      active
    )
    VALUES (
      ${eventId},
      ${role.id},
      ${team.id},
      ${activity.vacancyLimit},
      ${activity.requiresDelivery},
      NULL,
      ${activity.communityVisible},
      1
    )
    RETURNING id
  `

  eventRoleByName[activity.name] =
    Number(inserted[0].id)
}

const volunteerUsers = await sql`
  SELECT DISTINCT
    u.id,
    u.name,
    u.email
  FROM users u
  JOIN user_permissions up
    ON up.user_id = u.id
   AND up.permission = 'volunteer'
   AND up.active = 1
  WHERE
    u.active = 1
    AND u.project_id = ${projectId}
  ORDER BY u.name
`

if (!volunteerUsers.length) {
  throw new Error('Nenhum voluntário ativo do APS encontrado.')
}

/*
 * Descobre se o CHECK atual do banco já aceita "volunteers".
 * O backend do ZIP aceita, mas esta proteção deixa o seed compatível
 * com banco que ainda tenha uma constraint antiga.
 */
const registrationChecks = await sql`
  SELECT pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE
    conrelid = 'event_registrations'::regclass
    AND contype = 'c'
`

const checkText = registrationChecks
  .map(row => String(row.definition || ''))
  .join(' ')

const registrationTeam =
  checkText.includes("'volunteers'")
    ? 'volunteers'
    : 'activities'

for (const volunteer of volunteerUsers) {
  const email =
    String(volunteer.email || '').trim()
    || `teste.user${volunteer.id}@central.local`

  await sql`
    INSERT INTO event_registrations (
      event_id,
      user_id,
      email,
      team,
      status,
      payment_receipt_path,
      coupon_id
    )
    VALUES (
      ${eventId},
      ${volunteer.id},
      ${email},
      ${registrationTeam},
      'confirmed',
      NULL,
      NULL
    )
  `
}

const teamAdmins = await sql`
  SELECT DISTINCT
    u.id,
    u.name,
    u.project_id,
    t.id AS team_id,
    t.code AS team_code,
    t.name AS team_name
  FROM users u
  JOIN user_permissions up
    ON up.user_id = u.id
   AND up.permission = 'admin'
   AND up.admin_scope = 'team'
   AND up.active = 1
  JOIN user_teams ut
    ON ut.user_id = u.id
   AND ut.active = 1
  JOIN teams t
    ON t.id = ut.team_id
   AND t.active = 1
  WHERE
    u.active = 1
    AND (
      u.project_id = ${projectId}
      OR t.code = 'media'
    )
  ORDER BY t.name, u.name
`

const projectAdmins = await sql`
  SELECT DISTINCT
    u.id,
    u.name,
    up.admin_scope,
    CASE
      WHEN up.admin_scope = 'project'
      THEN 0
      ELSE 1
    END AS scope_priority
  FROM users u
  JOIN user_permissions up
    ON up.user_id = u.id
   AND up.permission = 'admin'
   AND up.active = 1
  WHERE
    u.active = 1
    AND (
      up.admin_scope = 'global'
      OR (
        up.admin_scope = 'project'
        AND u.project_id = ${projectId}
      )
    )
  ORDER BY
    scope_priority,
    u.name
`

const teamMembers = await sql`
  SELECT DISTINCT
    u.id,
    u.name,
    u.project_id,
    t.code AS team_code,
    CASE
      WHEN u.project_id = ${projectId}
      THEN 0
      ELSE 1
    END AS project_priority
  FROM users u
  JOIN user_permissions vp
    ON vp.user_id = u.id
   AND vp.permission = 'volunteer'
   AND vp.active = 1
  JOIN user_teams ut
    ON ut.user_id = u.id
   AND ut.active = 1
  JOIN teams t
    ON t.id = ut.team_id
   AND t.active = 1
  WHERE
    u.active = 1
    AND (
      u.project_id = ${projectId}
      OR t.code = 'media'
    )
  ORDER BY
    project_priority,
    u.name
`

function pickResponsible(teamCode) {
  return (
    teamAdmins.find(row =>
      row.team_code === teamCode
      && (
        Number(row.project_id) === projectId
        || teamCode === 'media'
      )
    )
    || teamMembers.find(row =>
      row.team_code === teamCode
      && (
        Number(row.project_id) === projectId
        || teamCode === 'media'
      )
    )
    || projectAdmins[0]
    || volunteerUsers[0]
  )
}

const checklistDefinitions = [
  {
    name: 'Recepção / Check-in de Voluntários',
    teamCode: 'volunteers',
    sourceType: 'event_registrations',
  },
  {
    name: 'Recepção / Check-in de Assistidos',
    teamCode: 'assisted',
    sourceType: 'assisted_people',
  },
  {
    name: 'Despedida / Check-out de Assistidos',
    teamCode: 'assisted',
    sourceType: 'assisted_people',
  },
]

const checklistSummary = []

for (const definition of checklistDefinitions) {
  const responsible = pickResponsible(definition.teamCode)

  if (!responsible?.id) {
    throw new Error(`Sem responsável disponível para ${definition.name}`)
  }

  const eventRoleId = eventRoleByName[definition.name]

  await ensureConfirmation(
    Number(responsible.id),
    eventRoleId
  )

  const createdChecklist = await sql`
    INSERT INTO activity_checklists (
      event_role_id,
      title,
      source_type,
      assigned_user_id,
      active
    )
    VALUES (
      ${eventRoleId},
      ${definition.name},
      ${definition.sourceType},
      ${responsible.id},
      1
    )
    RETURNING id
  `

  const checklistId =
    Number(createdChecklist[0].id)

  if (definition.sourceType === 'event_registrations') {
    await sql`
      INSERT INTO activity_checklist_items (
        checklist_id,
        registration_id,
        checked
      )
      SELECT
        ${checklistId},
        registration.id,
        0
      FROM event_registrations registration
      WHERE
        registration.event_id = ${eventId}
        AND registration.status = 'confirmed'
      ON CONFLICT (
        checklist_id,
        registration_id
      )
      DO NOTHING
    `
  } else if (
    definition.name ===
    'Recepção / Check-in de Assistidos'
  ) {
    await sql`
      INSERT INTO activity_checklist_items (
        checklist_id,
        assisted_person_id,
        checked
      )
      SELECT
        ${checklistId},
        assisted.id,
        0
      FROM assisted_people assisted
      WHERE
        assisted.active = 1
        AND assisted.project_id = ${projectId}
      ON CONFLICT (
        checklist_id,
        assisted_person_id
      )
      WHERE assisted_person_id IS NOT NULL
      DO NOTHING
    `
  }

  checklistSummary.push({
    atividade: definition.name,
    responsavel: responsible.name,
    checklist_id: checklistId,
  })
}

/*
 * Prepara participantes de Mídias para testar entrega.
 * Preferimos voluntário de Mídias; se não houver, usamos o responsável.
 */
const mediaParticipant =
  teamMembers.find(row => row.team_code === 'media')
  || pickResponsible('media')

if (mediaParticipant?.id) {
  await ensureConfirmation(
    Number(mediaParticipant.id),
    eventRoleByName['Fotógrafo(a)']
  )

  await ensureConfirmation(
    Number(mediaParticipant.id),
    eventRoleByName['Storymaker']
  )
}

const assistedCountRows = await sql`
  SELECT COUNT(*)::int AS total
  FROM assisted_people
  WHERE active = 1
    AND project_id = ${projectId}
`

console.log('')
console.log('===== CENÁRIO CRIADO =====')
console.table([{
  event_id: eventId,
  evento: EVENT_NAME,
  projeto: project.name,
  status: 'scheduled',
  voluntarios_inscritos: volunteerUsers.length,
  assistidos_ativos: Number(assistedCountRows[0]?.total || 0),
  equipe_inscricao: registrationTeam,
}])

console.log('')
console.log('===== RESPONSÁVEIS DAS CHECKLISTS =====')
console.table(checklistSummary)

console.log('')
console.log('===== ADMINS DE EQUIPE DISPONÍVEIS =====')
console.table(
  teamAdmins.map(row => ({
    id: Number(row.id),
    nome: row.name,
    equipe: row.team_name,
    codigo: row.team_code,
    projeto_id: Number(row.project_id),
  }))
)

console.log('')
console.log('===== MÍDIAS / ENTREGA =====')
console.table([{
  participante:
    mediaParticipant?.name || 'NÃO ENCONTRADO',
  fotografia:
    Boolean(mediaParticipant?.id),
  storymaker:
    Boolean(mediaParticipant?.id),
}])

console.log('')
console.log('✅ FASE 1 pronta.')
console.log('Teste agora:')
console.log('• checklist dos voluntários')
console.log('• check-in dos assistidos')
console.log('• check-out dos assistidos (após check-in)')
console.log('• atividades de Fotógrafo(a) e Storymaker')
console.log('')
console.log(`EVENT_ID=${eventId}`)
console.log('')
console.log('Quando terminar a parte operacional, rode o script de avanço para Pós-Evento.')
