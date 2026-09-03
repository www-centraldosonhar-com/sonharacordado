import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== CONTAGENS GERAIS =====')

const general = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM events)
      AS events,

    (SELECT COUNT(*)::int FROM users WHERE active = 0)
      AS inactive_users,

    (SELECT COUNT(*)::int FROM event_roles)
      AS event_roles,

    (SELECT COUNT(*)::int FROM confirmations)
      AS confirmations,

    (SELECT COUNT(*)::int FROM event_registrations)
      AS event_registrations,

    (SELECT COUNT(*)::int FROM activity_checklists)
      AS activity_checklists,

    (SELECT COUNT(*)::int FROM activity_checklist_items)
      AS activity_checklist_items,

    (SELECT COUNT(*)::int FROM team_expenses)
      AS team_expenses,

    (SELECT COUNT(*)::int FROM post_event_feedback)
      AS post_event_feedback,

    (SELECT COUNT(*)::int FROM post_event_answers)
      AS post_event_answers,

    (SELECT COUNT(*)::int FROM post_event_questions)
      AS post_event_questions,

    (SELECT COUNT(*)::int FROM post_event_team_reports)
      AS post_event_team_reports,

    (SELECT COUNT(*)::int FROM post_event_closures)
      AS post_event_closures,

    (SELECT COUNT(*)::int FROM media_content_deliveries)
      AS media_content_deliveries,

    (SELECT COUNT(*)::int FROM tasks)
      AS tasks
`

console.table(general)


console.log('\n===== TASKS LIGADAS A EVENTOS =====')

const tasks = await sql`
  SELECT
    id,
    event_id,
    title
  FROM tasks
  WHERE event_id IS NOT NULL
  ORDER BY event_id, id
`

console.table(tasks)


console.log('\n===== INATIVOS + DEPENDÊNCIAS IMPORTANTES =====')

const inactive = await sql`
  SELECT
    u.id,
    u.full_name,
    u.username,
    u.project_id,

    (
      SELECT COUNT(*)::int
      FROM confirmations c
      WHERE c.user_id = u.id
    ) AS confirmations,

    (
      SELECT COUNT(*)::int
      FROM notifications n
      WHERE n.user_id = u.id
    ) AS notifications,

    (
      SELECT COUNT(*)::int
      FROM task_users tu
      WHERE tu.user_id = u.id
    ) AS task_users,

    (
      SELECT COUNT(*)::int
      FROM admin_audit_logs aal
      WHERE aal.actor_user_id = u.id
    ) AS audit_logs,

    (
      SELECT COUNT(*)::int
      FROM announcements a
      WHERE a.created_by = u.id
    ) AS announcements,

    (
      SELECT COUNT(*)::int
      FROM assisted_people ap
      WHERE ap.created_by = u.id
    ) AS assisted_created,

    (
      SELECT COUNT(*)::int
      FROM team_expenses te
      WHERE te.created_by = u.id
    ) AS expenses_created,

    (
      SELECT COUNT(*)::int
      FROM finance_requests fr
      WHERE fr.created_by = u.id
    ) AS finance_created,

    (
      SELECT COUNT(*)::int
      FROM dreamer_profiles dp
      WHERE dp.user_id = u.id
    ) AS dreamer_profiles,

    (
      SELECT COUNT(*)::int
      FROM dreamer_roles dr
      WHERE dr.user_id = u.id
    ) AS dreamer_roles,

    (
      SELECT COUNT(*)::int
      FROM dreamer_referrals dr
      WHERE
        dr.referrer_user_id = u.id
        OR dr.referred_user_id = u.id
    ) AS dreamer_referrals

  FROM users u

  WHERE u.active = 0

  ORDER BY u.id
`

console.table(inactive)


console.log('\n===== DREAMER GLOBAL — PRESERVAR =====')

const dreamer = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM dreamer_campaigns)
      AS campaigns,

    (SELECT COUNT(*)::int FROM dreamer_campaign_teams)
      AS campaign_teams,

    (SELECT COUNT(*)::int FROM dreamer_roles)
      AS roles,

    (SELECT COUNT(*)::int FROM dreamer_profiles)
      AS profiles,

    (SELECT COUNT(*)::int FROM dreamer_contributions)
      AS contributions,

    (SELECT COUNT(*)::int FROM dreamer_fundraising_entries)
      AS fundraising_entries,

    (SELECT COUNT(*)::int FROM dreamer_missions)
      AS missions
`

console.table(dreamer)

console.log(
  '\n✅ DRY RUN concluído. Nenhum dado foi alterado.'
)

process.exit(0)
