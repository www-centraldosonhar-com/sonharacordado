import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== CHECKLIST DA BRUNA =====')

const rows = await sql`
  SELECT
    ac.id AS checklist_id,
    ac.title,
    ac.active AS checklist_active,
    ac.assigned_user_id,

    u.name AS responsible_name,

    er.id AS event_role_id,
    er.active AS event_role_active,

    r.name AS activity_name,

    e.id AS event_id,
    e.name AS event_name,
    e.event_status,
    e.event_date

  FROM activity_checklists ac

  JOIN users u
    ON u.id = ac.assigned_user_id

  JOIN event_roles er
    ON er.id = ac.event_role_id

  JOIN roles r
    ON r.id = er.role_id

  JOIN events e
    ON e.id = er.event_id

  WHERE
    ac.assigned_user_id = 5
    AND e.id = 35
`

console.table(rows)

console.log('\n===== ITENS =====')

const items = await sql`
  SELECT
    aci.id,
    aci.registration_id,
    aci.checked

  FROM activity_checklist_items aci

  JOIN activity_checklists ac
    ON ac.id = aci.checklist_id

  JOIN event_roles er
    ON er.id = ac.event_role_id

  WHERE
    ac.assigned_user_id = 5
    AND er.event_id = 35
`

console.table(items)
