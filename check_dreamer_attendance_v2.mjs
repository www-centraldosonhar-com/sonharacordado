import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== PRESENÇA POR PROJETO DO VOLUNTÁRIO =====')

const rows = await sql`
  SELECT
    e.id AS event_id,
    e.name AS event,
    e.event_date,

    volunteer_project.id
      AS project_id,

    volunteer_project.name
      AS project,

    COUNT(
      DISTINCT volunteer.id
    )::int AS checked_in

  FROM activity_checklist_items aci

  JOIN confirmations confirmation
    ON confirmation.id =
      aci.registration_id

  JOIN users volunteer
    ON volunteer.id =
      confirmation.user_id

  JOIN projects volunteer_project
    ON volunteer_project.id =
      volunteer.project_id

  JOIN event_roles er
    ON er.id =
      confirmation.event_role_id

  JOIN events e
    ON e.id =
      er.event_id

  JOIN roles role
    ON role.id =
      er.role_id

  WHERE
    aci.checked = 1

    AND role.name ILIKE '%check-in%'
    AND role.name ILIKE '%volunt%'

    AND volunteer_project.id
      IN (1, 2, 3)

  GROUP BY
    e.id,
    e.name,
    e.event_date,
    volunteer_project.id,
    volunteer_project.name

  ORDER BY
    e.event_date DESC,
    volunteer_project.id
`

console.table(rows)

console.log('\n===== VOLUNTÁRIOS ATIVOS =====')

const totals = await sql`
  SELECT
    project.id AS project_id,
    project.name AS project,

    COUNT(
      DISTINCT users.id
    )::int AS volunteers

  FROM users

  JOIN projects project
    ON project.id =
      users.project_id

  JOIN user_permissions permission
    ON permission.user_id =
      users.id

  WHERE
    users.active = 1

    AND permission.permission =
      'volunteer'

    AND permission.active = 1

    AND project.id
      IN (1, 2, 3)

  GROUP BY
    project.id,
    project.name

  ORDER BY
    project.id
`

console.table(totals)

process.exit(0)
