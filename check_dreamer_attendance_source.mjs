import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== EVENTS: COLUNAS =====')

const eventColumns = await sql`
  SELECT
    column_name,
    data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'events'
  ORDER BY ordinal_position
`

console.table(eventColumns)


console.log('\n===== EVENTOS RECENTES =====')

const events = await sql`
  SELECT *
  FROM events
  ORDER BY event_date DESC NULLS LAST
  LIMIT 15
`

console.table(events)


console.log('\n===== VOLUNTÁRIOS ATIVOS POR PROJETO =====')

const volunteers = await sql`
  SELECT
    p.id AS project_id,
    p.name AS project,
    COUNT(DISTINCT u.id)::int AS volunteers
  FROM users u
  JOIN projects p
    ON p.id = u.project_id
  JOIN user_permissions up
    ON up.user_id = u.id
  WHERE
    u.active = 1
    AND up.permission = 'volunteer'
    AND up.active = 1
    AND p.id IN (1, 2, 3)
  GROUP BY
    p.id,
    p.name
  ORDER BY
    p.id
`

console.table(volunteers)


console.log('\n===== CHECKLIST: COLUNAS =====')

const checklistColumns = await sql`
  SELECT
    column_name,
    data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'activity_checklist_items'
  ORDER BY ordinal_position
`

console.table(checklistColumns)


console.log('\n===== CHECK-INS DE VOLUNTÁRIOS =====')

const checkins = await sql`
  SELECT
    e.id AS event_id,
    e.name AS event,
    e.event_date,
    p.id AS project_id,
    p.name AS project,
    COUNT(DISTINCT c.user_id)::int AS checked_in
  FROM activity_checklist_items aci

  JOIN confirmations c
    ON c.id = aci.registration_id

  JOIN event_roles er
    ON er.id = c.event_role_id

  JOIN events e
    ON e.id = er.event_id

  LEFT JOIN projects p
    ON p.id = e.project_id

  JOIN roles r
    ON r.id = er.role_id

  WHERE
    aci.checked = 1
    AND r.name ILIKE '%check-in%'
    AND r.name ILIKE '%volunt%'
    AND p.id IN (1, 2, 3)

  GROUP BY
    e.id,
    e.name,
    e.event_date,
    p.id,
    p.name

  ORDER BY
    e.event_date DESC
`

console.table(checkins)

process.exit(0)
