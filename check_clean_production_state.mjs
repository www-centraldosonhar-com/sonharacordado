import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== ESTRUTURA PRINCIPAL =====')

const structure = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM projects)
      AS projects,

    (SELECT COUNT(*)::int FROM teams)
      AS teams,

    (SELECT COUNT(*)::int FROM roles)
      AS roles,

    (SELECT COUNT(*)::int FROM users WHERE active = 1)
      AS active_users,

    (SELECT COUNT(*)::int FROM assisted_people WHERE active = 1)
      AS active_assisted,

    (SELECT COUNT(*)::int FROM events)
      AS events
`

console.table(structure)


console.log('\n===== USUÁRIOS ATIVOS POR PROJETO =====')

const users = await sql`
  SELECT
    p.name AS project,
    COUNT(u.id)::int AS active_users
  FROM projects p

  LEFT JOIN users u
    ON u.project_id = p.id
    AND u.active = 1

  GROUP BY
    p.id,
    p.name

  ORDER BY
    p.id
`

console.table(users)


console.log('\n===== SÓCIO SONHADOR =====')

const dreamer = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM dreamer_campaigns)
      AS campaigns,

    (SELECT COUNT(*)::int FROM dreamer_campaign_teams)
      AS campaign_teams,

    (SELECT COUNT(*)::int FROM dreamer_roles)
      AS dreamer_roles,

    (SELECT COUNT(*)::int FROM dreamer_missions)
      AS missions,

    (SELECT COUNT(*)::int FROM dreamer_fundraising_entries)
      AS fundraising_entries,

    (SELECT COUNT(*)::int FROM dreamer_attendance_events)
      AS attendance_events
`

console.table(dreamer)


console.log('\n===== ADMINS SÓCIO =====')

const admins = await sql`
  SELECT
    u.id,
    u.full_name,
    u.username,
    u.active,
    dr.role_code
  FROM dreamer_roles dr

  JOIN users u
    ON u.id = dr.user_id

  WHERE dr.role_code = 'dreamer_admin'

  ORDER BY u.id
`

console.table(admins)


console.log('\n===== CAMPANHA OLIMPÍADA =====')

const olympiad = await sql`
  SELECT
    dc.id,
    dc.name,
    dc.slug,
    dc.status,
    p.name AS project,
    dct.volunteer_count
  FROM dreamer_campaigns dc

  JOIN dreamer_campaign_teams dct
    ON dct.campaign_id = dc.id

  JOIN projects p
    ON p.id = dct.project_id

  WHERE dc.slug = 'olimpiada-sonhadora'

  ORDER BY p.id
`

console.table(olympiad)


console.log('\n===== RESÍDUOS OPERACIONAIS =====')

const residue = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM events)
      AS events,

    (SELECT COUNT(*)::int FROM event_roles)
      AS event_roles,

    (SELECT COUNT(*)::int FROM confirmations)
      AS confirmations,

    (SELECT COUNT(*)::int FROM event_registrations)
      AS registrations,

    (SELECT COUNT(*)::int FROM activity_checklists)
      AS checklists,

    (SELECT COUNT(*)::int FROM team_expenses)
      AS expenses,

    (SELECT COUNT(*)::int FROM post_event_feedback)
      AS feedback,

    (SELECT COUNT(*)::int FROM post_event_team_reports)
      AS reports
`

console.table(residue)

console.log('\n✅ Verificação concluída. Nenhum dado foi alterado.')

process.exit(0)
