import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const EVENT_NAME = 'Testando Pos Evento - APS'

if (process.env.CONFIRM_TEST_SCENARIO !== 'YES') {
  console.error('❌ Confirmação ausente.')
  console.error('Use: CONFIRM_TEST_SCENARIO=YES node --env-file=.env.local advance_testando_pos_evento_aps_v2.mjs')
  process.exit(1)
}

const events = await sql`
  SELECT id, name, project_id, event_status, event_date
  FROM events
  WHERE name = ${EVENT_NAME}
  ORDER BY id DESC
  LIMIT 1
`

const event = events[0]

if (!event) {
  throw new Error('Cenário de teste não encontrado. Rode primeiro o seed v2.')
}

const eventId = Number(event.id)

const openerRows = await sql`
  SELECT DISTINCT
    u.id,
    u.name,
    up.admin_scope
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
        AND u.project_id = ${event.project_id}
      )
    )
  ORDER BY
    CASE WHEN up.admin_scope = 'project' THEN 0 ELSE 1 END,
    u.name
  LIMIT 1
`

const opener = openerRows[0]

if (!opener) {
  throw new Error('Nenhum Admin de Projeto/Geral disponível para abrir o Pós-Evento.')
}

await sql`
  UPDATE events
  SET
    event_status = 'post_event',
    post_event_opened_at =
      COALESCE(post_event_opened_at, CURRENT_TIMESTAMP),
    registrations_open = 0,
    active = 0
  WHERE id = ${eventId}
`

await sql`
  INSERT INTO post_event_closures (
    event_id,
    status,
    opened_by
  )
  VALUES (
    ${eventId},
    'open',
    ${opener.id}
  )
  ON CONFLICT (event_id)
  DO UPDATE SET
    status =
      CASE
        WHEN post_event_closures.status = 'closed'
        THEN post_event_closures.status
        ELSE 'open'
      END,
    updated_at = CURRENT_TIMESTAMP
`

const activeTeams = await sql`
  SELECT id, code, name
  FROM teams
  WHERE active = 1
  ORDER BY name
`

for (const team of activeTeams) {
  await sql`
    INSERT INTO post_event_team_reports (
      event_id,
      team_id,
      status,
      financial_status
    )
    VALUES (
      ${eventId},
      ${team.id},
      'pending',
      'pending'
    )
    ON CONFLICT (event_id, team_id)
    DO NOTHING
  `
}

const questionCountRows = await sql`
  SELECT COUNT(*)::int AS total
  FROM post_event_questions
  WHERE event_id = ${eventId}
`

if (Number(questionCountRows[0]?.total || 0) === 0) {
  const questions = [
    'O que funcionou melhor na sua equipe neste evento?',
    'O que podemos melhorar para o próximo evento?',
    'Existe algum ponto importante que a coordenação precisa saber?',
  ]

  for (let index = 0; index < questions.length; index += 1) {
    await sql`
      INSERT INTO post_event_questions (
        event_id,
        question_text,
        position,
        required,
        active,
        created_by
      )
      VALUES (
        ${eventId},
        ${questions[index]},
        ${index + 1},
        TRUE,
        TRUE,
        ${opener.id}
      )
    `
  }
}

const attendance = await sql`
  SELECT
    COUNT(DISTINCT registration.user_id)::int
      AS inscritos,
    COUNT(DISTINCT registration.user_id)
      FILTER (WHERE item.checked = 1)::int
      AS presentes
  FROM event_registrations registration
  LEFT JOIN activity_checklists checklist
    ON checklist.event_role_id IN (
      SELECT er.id
      FROM event_roles er
      JOIN roles role ON role.id = er.role_id
      WHERE
        er.event_id = ${eventId}
        AND role.name =
          'Recepção / Check-in de Voluntários'
    )
    AND checklist.active = 1
  LEFT JOIN activity_checklist_items item
    ON item.checklist_id = checklist.id
   AND item.registration_id = registration.id
  WHERE
    registration.event_id = ${eventId}
    AND registration.status = 'confirmed'
`

const reports = await sql`
  SELECT
    report.id,
    team.name AS equipe,
    report.status,
    report.financial_status
  FROM post_event_team_reports report
  JOIN teams team
    ON team.id = report.team_id
  WHERE report.event_id = ${eventId}
  ORDER BY team.name
`

const deliveryParticipants = await sql`
  SELECT
    confirmation.id AS confirmation_id,
    user.name AS participante,
    role.name AS atividade,
    event_role.requires_delivery
  FROM confirmations confirmation
  JOIN users user
    ON user.id = confirmation.user_id
  JOIN event_roles event_role
    ON event_role.id = confirmation.event_role_id
  JOIN roles role
    ON role.id = event_role.role_id
  WHERE
    event_role.event_id = ${eventId}
    AND confirmation.status = 'confirmed'
    AND event_role.requires_delivery = 1
  ORDER BY role.name, user.name
`

console.log('')
console.log('===== PÓS-EVENTO ABERTO =====')
console.table([{
  event_id: eventId,
  evento: EVENT_NAME,
  status: 'post_event',
  aberto_por: opener.name,
  inscritos: Number(attendance[0]?.inscritos || 0),
  presentes_com_checkin: Number(attendance[0]?.presentes || 0),
}])

console.log('')
console.log('===== FECHAMENTOS POR EQUIPE =====')
console.table(reports)

console.log('')
console.log('===== ENTREGA DE MÍDIAS PREPARADA =====')
console.table(deliveryParticipants)

console.log('')
console.log('✅ FASE 2 pronta para testar:')
console.log('• fechamento de cada Admin de Equipe')
console.log('• Sem Gastos / Doação / Com Gastos')
console.log('• perguntas + avaliação do fechamento')
console.log('• aprovação/devolução pelo Admin de Projeto/Geral')
console.log('• entrega de fotos/Storymaker')
console.log('• feedback dos voluntários que tiveram check-in')
console.log('')
console.log('ℹ️ Checklists ficam bloqueadas no Pós-Evento por regra do sistema.')
