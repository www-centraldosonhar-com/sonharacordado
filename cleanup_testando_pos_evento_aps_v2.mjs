import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const EVENT_NAME = 'Testando Pos Evento - APS'

if (process.env.CONFIRM_TEST_SCENARIO !== 'YES') {
  console.error('❌ Confirmação ausente.')
  console.error('Use: CONFIRM_TEST_SCENARIO=YES node --env-file=.env.local cleanup_testando_pos_evento_aps_v2.mjs')
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

const events = await sql`
  SELECT id, name
  FROM events
  WHERE name = ${EVENT_NAME}
  ORDER BY id
`

if (!events.length) {
  console.log('ℹ️ Nenhum cenário de teste encontrado. Nada a remover.')
  process.exit(0)
}

for (const event of events) {
  console.log(`🧹 Removendo evento de teste ID ${event.id}...`)
  await cleanupEvent(Number(event.id))
}

console.log('✅ Cenário removido.')
console.log('✅ Usuários, voluntários, admins e Assistidos foram preservados.')
